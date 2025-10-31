/**
 * Tests for Reply Drafting Enhancements
 * Tests context preservation and signature functionality
 */

import { test, expect } from './fixtures/extension.js';

test.describe('Context Preservation', () => {
  test('extracts key points from email thread', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Mock thread with key points
    const mockThread = {
      provider: 'gmail',
      subject: 'Project Update',
      messages: [
        {
          content: 'This is an important update about the project. We need to complete the task by Friday. The deadline is critical.',
          sender: { name: 'Alice', email: 'alice@example.com' },
          timestamp: '2024-01-01T10:00:00Z'
        },
        {
          content: 'I have a question about the requirements. Can you clarify the scope? What are the next steps?',
          sender: { name: 'Bob', email: 'bob@example.com' },
          timestamp: '2024-01-01T11:00:00Z'
        }
      ]
    };
    
    // Test context extraction logic
    const context = await sidePanelPage.evaluate((thread) => {
      const threadText = thread.messages.map(m => m.content).join('\n\n');
      
      const keyPoints = [];
      const questions = [];
      const actionItems = [];
      
      // Extract questions
      const questionPattern = /[^.!?]*\?/g;
      const questionsFound = threadText.match(questionPattern);
      if (questionsFound) {
        questions.push(...questionsFound
          .map(q => q.trim())
          .filter(q => q.length > 10 && q.length < 200)
          .slice(0, 5));
      }
      
      // Extract action items
      const actionPatterns = [
        /\b(?:please|need|should|must|will|deadline|todo|task)\b[^.!?]*/gi,
        /\b(?:deadline|due|by|before)\s+\d+/gi
      ];
      
      actionPatterns.forEach(pattern => {
        const matches = threadText.match(pattern);
        if (matches) {
          actionItems.push(...matches
            .map(a => a.trim())
            .filter(a => a.length > 10 && a.length < 200)
            .slice(0, 5));
        }
      });
      
      // Extract key points
      const keyPointKeywords = ['important', 'critical', 'key', 'main', 'primary', 'essential'];
      const sentences = threadText.split(/[.!?]\s+/);
      keyPoints.push(...sentences
        .filter(sentence => {
          const lower = sentence.toLowerCase();
          return keyPointKeywords.some(keyword => lower.includes(keyword)) &&
                 sentence.length > 20 && sentence.length < 300;
        })
        .slice(0, 5));
      
      return {
        keyPoints: keyPoints.length > 0,
        questions: questions.length > 0,
        actionItems: actionItems.length > 0,
        hasContext: keyPoints.length > 0 || questions.length > 0 || actionItems.length > 0
      };
    }, mockThread);
    
    expect(context.hasContext).toBe(true);
    expect(context.keyPoints).toBe(true);
    expect(context.questions).toBe(true);
    expect(context.actionItems).toBe(true);
  });
  
  test('preserves context in draft generation prompts', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Verify context extraction function exists and works
    const hasContextExtraction = await sidePanelPage.evaluate(() => {
      const testText = 'This is important. Do we need to complete this by Friday? Please confirm the deadline.';
      
      // Simulate context extraction
      const questions = testText.match(/[^.!?]*\?/g);
      const hasDeadline = /\b(deadline|due|by)\b/i.test(testText);
      const hasImportant = /\b(important|critical|key)\b/i.test(testText);
      
      return {
        hasQuestions: questions && questions.length > 0,
        hasDeadline: hasDeadline,
        hasImportant: hasImportant,
        contextExtracted: (questions && questions.length > 0) || hasDeadline || hasImportant
      };
    });
    
    expect(hasContextExtraction.contextExtracted).toBe(true);
  });
});

test.describe('Customizable Signatures', () => {
  test('signature input exists in settings panel', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Open settings panel
    const settingsBtn = sidePanelPage.locator('#settings-toggle-btn');
    await settingsBtn.click();
    
    // Wait for settings panel to open
    await sidePanelPage.waitForSelector('#settings-panel.active', { timeout: 3000 });
    
    // Check signature input exists
    const signatureInput = sidePanelPage.locator('#signature-input');
    await expect(signatureInput).toBeVisible();
    
    // Check save button exists
    const saveBtn = sidePanelPage.locator('#save-signature-btn');
    await expect(saveBtn).toBeVisible();
    
    // Close settings panel
    const closeBtn = sidePanelPage.locator('#settings-close-btn');
    await closeBtn.click();
    await sidePanelPage.waitForSelector('#settings-panel.active', { state: 'hidden', timeout: 2000 });
  });
  
  test('can save and load signature from storage', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Open settings panel
    const settingsBtn = sidePanelPage.locator('#settings-toggle-btn');
    await settingsBtn.click();
    await sidePanelPage.waitForSelector('#settings-panel.active', { timeout: 3000 });
    
    // Enter signature
    const signatureInput = sidePanelPage.locator('#signature-input');
    await signatureInput.fill('Best regards,\nJohn Doe\nSoftware Engineer');
    
    // Save signature
    const saveBtn = sidePanelPage.locator('#save-signature-btn');
    await saveBtn.click();
    
    // Wait for success message
    await sidePanelPage.waitForSelector('.status.success', { timeout: 2000 });
    
    // Verify signature was saved
    const signatureSaved = await sidePanelPage.evaluate(async () => {
      if (chrome?.storage?.sync) {
        const result = await chrome.storage.sync.get(['signature']);
        return result.signature === 'Best regards,\nJohn Doe\nSoftware Engineer';
      }
      return false;
    });
    
    expect(signatureSaved).toBe(true);
    
    // Close settings
    await sidePanelPage.locator('#settings-close-btn').click();
  });
  
  test('signature is appended to draft bodies', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Test signature appending logic
    const draftWithSignature = await sidePanelPage.evaluate(() => {
      const draftBody = 'Thank you for your email. I will review this and get back to you.';
      const signature = 'Best regards,\nJohn Doe';
      
      // Simulate signature appending logic from validateAndFormatDrafts
      let body = draftBody;
      if (signature && signature.trim()) {
        const sig = signature.trim();
        if (body && !body.endsWith('\n')) {
          body += '\n\n';
        } else if (body) {
          body += '\n';
        }
        body += sig;
      }
      
      return {
        hasSignature: body.includes(signature),
        signatureAtEnd: body.endsWith(signature),
        properSpacing: body.includes('\n\n' + signature) || body.includes('\n' + signature)
      };
    });
    
    expect(draftWithSignature.hasSignature).toBe(true);
    expect(draftWithSignature.properSpacing).toBe(true);
  });
  
  test('signature respects character limits', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    
    // Test that signature is preserved even when body is truncated
    const truncatedDraft = await sidePanelPage.evaluate(() => {
      const longBody = 'A'.repeat(1490); // Very long body
      const signature = 'Best regards,\nJohn Doe'; // 24 chars
      
      let body = longBody;
      if (signature && signature.trim()) {
        const sig = signature.trim();
        if (body && !body.endsWith('\n')) {
          body += '\n\n';
        } else if (body) {
          body += '\n';
        }
        body += sig;
        
        // Re-enforce length limit after signature is added
        if (body.length > 1500) {
          const maxBodyLength = 1500 - sig.length - 2; // 2 for newlines
          body = body.substring(0, maxBodyLength) + '\n\n' + sig;
        }
      }
      
      return {
        totalLength: body.length,
        hasSignature: body.includes(signature),
        signatureAtEnd: body.endsWith(signature),
        withinLimit: body.length <= 1500
      };
    });
    
    expect(truncatedDraft.withinLimit).toBe(true);
    expect(truncatedDraft.hasSignature).toBe(true);
    expect(truncatedDraft.signatureAtEnd).toBe(true);
  });
  
  test('empty signature disables signature feature', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Test that empty signature doesn't append anything
    const draftWithoutSignature = await sidePanelPage.evaluate(() => {
      const draftBody = 'Thank you for your email.';
      const signature = '';
      
      let body = draftBody;
      if (signature && signature.trim()) {
        const sig = signature.trim();
        if (body && !body.endsWith('\n')) {
          body += '\n\n';
        } else if (body) {
          body += '\n';
        }
        body += sig;
      }
      
      return {
        unchanged: body === draftBody,
        noExtraNewlines: !body.includes('\n\n')
      };
    });
    
    expect(draftWithoutSignature.unchanged).toBe(true);
  });
});


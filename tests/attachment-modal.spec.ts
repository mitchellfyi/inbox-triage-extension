import { test, expect } from './fixtures/extension.js';

test.describe('Attachment Detail Modal', () => {
  test('opens modal when attachment card is clicked', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Wait for side panel instance to be initialized
    await sidePanelPage.waitForFunction(() => {
      return typeof window.sidePanelInstance !== 'undefined';
    }, { timeout: 5000 });
    
    // Mock attachment data
    const mockAttachment = {
      name: 'test-document.pdf',
      type: 'pdf',
      size: 1024000,
      date: new Date().toISOString(),
      summary: 'This is a test summary for the attachment.'
    };
    
    // Trigger modal via JavaScript
    await sidePanelPage.evaluate((attachment) => {
      window.sidePanelInstance.showAttachmentDetails(attachment);
    }, mockAttachment);
    
    // Wait for modal to appear
    await sidePanelPage.waitForSelector('#attachment-modal-overlay.active', { timeout: 2000 });
    
    // Check modal is visible
    const modal = sidePanelPage.locator('#attachment-modal-overlay');
    await expect(modal).toHaveClass(/active/);
    
    // Check modal title
    const title = sidePanelPage.locator('#attachment-modal-title');
    await expect(title).toHaveText('test-document.pdf');
  });

  test('displays attachment metadata correctly', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    await sidePanelPage.waitForFunction(() => {
      return typeof window.sidePanelInstance !== 'undefined';
    }, { timeout: 5000 });
    
    const mockAttachment = {
      name: 'test-image.jpg',
      type: 'image',
      size: 512000,
      date: new Date('2024-01-15T10:30:00Z').toISOString(),
      summary: 'Test image summary'
    };
    
    await sidePanelPage.evaluate((attachment) => {
      window.sidePanelInstance.showAttachmentDetails(attachment);
    }, mockAttachment);
    
    await sidePanelPage.waitForSelector('#attachment-modal-overlay.active', { timeout: 2000 });
    
    // Check metadata section exists
    const modalBody = sidePanelPage.locator('#attachment-modal-body');
    await expect(modalBody).toBeVisible();
    
    // Check that metadata content is displayed
    const content = await modalBody.textContent();
    expect(content).toContain('test-image.jpg');
    expect(content).toContain('IMAGE');
  });

  test('displays summary when available', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    await sidePanelPage.waitForFunction(() => {
      return typeof window.sidePanelInstance !== 'undefined';
    }, { timeout: 5000 });
    
    const mockAttachment = {
      name: 'document.docx',
      type: 'docx',
      summary: 'This document contains important information about the project.'
    };
    
    await sidePanelPage.evaluate((attachment) => {
      window.sidePanelInstance.showAttachmentDetails(attachment);
    }, mockAttachment);
    
    await sidePanelPage.waitForSelector('#attachment-modal-overlay.active', { timeout: 2000 });
    
    const modalBody = sidePanelPage.locator('#attachment-modal-body');
    const content = await modalBody.textContent();
    expect(content).toContain('This document contains important information about the project.');
  });

  test('closes modal when close button is clicked', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    await sidePanelPage.waitForFunction(() => {
      return typeof window.sidePanelInstance !== 'undefined';
    }, { timeout: 5000 });
    
    const mockAttachment = { name: 'test.pdf', type: 'pdf' };
    
    await sidePanelPage.evaluate((attachment) => {
      window.sidePanelInstance.showAttachmentDetails(attachment);
    }, mockAttachment);
    
    await sidePanelPage.waitForSelector('#attachment-modal-overlay.active', { timeout: 2000 });
    
    // Click close button
    const closeBtn = sidePanelPage.locator('#attachment-modal-close');
    await closeBtn.click();
    
    // Wait for modal to close (transition animation)
    await sidePanelPage.waitForFunction(() => {
      const overlay = document.getElementById('attachment-modal-overlay');
      return overlay && !overlay.classList.contains('active');
    }, { timeout: 1000 });
    
    const modal = sidePanelPage.locator('#attachment-modal-overlay');
    await expect(modal).not.toHaveClass(/active/);
  });

  test('handles attachments without summary gracefully', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    await sidePanelPage.waitForFunction(() => {
      return typeof window.sidePanelInstance !== 'undefined';
    }, { timeout: 5000 });
    
    const mockAttachment = {
      name: 'new-file.pdf',
      type: 'pdf',
      size: 2048000
      // No summary provided
    };
    
    await sidePanelPage.evaluate((attachment) => {
      window.sidePanelInstance.showAttachmentDetails(attachment);
    }, mockAttachment);
    
    await sidePanelPage.waitForSelector('#attachment-modal-overlay.active', { timeout: 2000 });
    
    const modalBody = sidePanelPage.locator('#attachment-modal-body');
    const content = await modalBody.textContent();
    expect(content).toContain('No summary available yet');
    expect(content).toContain('Analyze');
  });

  test('formats file sizes correctly', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    await sidePanelPage.waitForFunction(() => {
      return typeof window.sidePanelInstance !== 'undefined';
    }, { timeout: 5000 });
    
    // Test various file sizes
    const testCases = [
      { size: 1024, expected: 'KB' },
      { size: 1024 * 1024, expected: 'MB' },
      { size: 1024 * 1024 * 1024, expected: 'GB' }
    ];
    
    for (const testCase of testCases) {
      const formatted = await sidePanelPage.evaluate((size) => {
        return window.sidePanelInstance.formatFileSize(size);
      }, testCase.size);
      
      expect(formatted).toContain(testCase.expected);
    }
  });
});

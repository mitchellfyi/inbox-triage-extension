import { test, expect } from './fixtures/extension.js';

test.describe('Content Script', () => {
  test('extracts email thread from Gmail page', async ({ context, extensionId }) => {
    // Create a mock Gmail page
    const gmailPage = await context.newPage();
    await gmailPage.goto('data:text/html,<html><body><h1>Gmail Test</h1></body></html>');
    
    // Inject content scripts
    await gmailPage.addScriptTag({ path: 'content/selectors.js' });
    await gmailPage.addScriptTag({ path: 'content/content.js' });
    
    // Wait for initialization
    await gmailPage.waitForTimeout(500);
    
    // Test ping message
    const pingResponse = await gmailPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
          resolve(response);
        });
      });
    });
    
    expect(pingResponse).toEqual({ success: true, ready: true });
    
    await gmailPage.close();
  });

  test('handles extractThread message', async ({ context, extensionId }) => {
    // Create a mock Gmail page with email content
    const gmailPage = await context.newPage();
    await gmailPage.setContent(`
      <html>
        <body>
          <h2 data-thread-id="123"><span>Test Subject</span></h2>
          <div data-message-id="msg1">
            <div class="ii gt">
              <div>Test email content here</div>
            </div>
          </div>
        </body>
      </html>
    `);
    
    // Inject content scripts
    await gmailPage.addScriptTag({ path: 'content/selectors.js' });
    await gmailPage.addScriptTag({ path: 'content/content.js' });
    
    // Wait for initialization
    await gmailPage.waitForTimeout(500);
    
    // Test extractThread message
    const extractResponse = await gmailPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'extractThread' }, (response) => {
          resolve(response);
        });
      });
    });
    
    // Should return thread data
    expect(extractResponse).toBeDefined();
    expect(extractResponse.success).toBe(true);
    expect(extractResponse.thread).toBeDefined();
    expect(extractResponse.thread.provider).toBe('gmail');
    
    await gmailPage.close();
  });

  test('handles unsupported pages gracefully', async ({ context }) => {
    // Create a non-email page
    const testPage = await context.newPage();
    await testPage.goto('data:text/html,<html><body><h1>Regular Page</h1></body></html>');
    
    // Inject content scripts
    await testPage.addScriptTag({ path: 'content/selectors.js' });
    await testPage.addScriptTag({ path: 'content/content.js' });
    
    // Wait for initialization
    await testPage.waitForTimeout(500);
    
    // Should handle gracefully (siteConfig will be null)
    const isInitialized = await testPage.evaluate(() => {
      // Check if extractor exists but is not initialized for unsupported site
      return typeof window.getEmailThreadText === 'function';
    });
    
    expect(isInitialized).toBe(true);
    
    await testPage.close();
  });
});

test.describe('Message Passing', () => {
  test('side panel can communicate with service worker', async ({ sidePanelPage }) => {
    // Test message passing from side panel to service worker
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkAIStatus' }, (response) => {
          resolve(response);
        });
      });
    });
    
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.capabilities).toBeDefined();
  });

  test('handles unknown message actions gracefully', async ({ sidePanelPage }) => {
    // Test error handling for unknown actions
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'unknownAction' }, (response) => {
          resolve(response);
        });
      });
    });
    
    expect(response).toBeDefined();
    expect(response.success).toBe(false);
    expect(response.error).toContain('Unknown action');
  });
});


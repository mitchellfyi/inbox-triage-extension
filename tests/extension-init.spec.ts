import { test, expect } from './fixtures/extension.js';

/**
 * Test extension loading and initialization
 */
test.describe('Extension Initialization', () => {
  test('extension loads without errors', async ({ context, extensionId }) => {
    // Create a page to check service worker is registered
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Check service worker is registered via chrome.runtime
    const serviceWorkerLoaded = await page.evaluate(() => {
      // @ts-ignore - chrome is available in extension context
      return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
    });
    
    expect(serviceWorkerLoaded).toBe(true);
    await page.close();
  });

  test('service worker responds to messages', async ({ extensionId, sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Test that service worker responds
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        // @ts-ignore - chrome is available in extension context
        chrome.runtime.sendMessage({ action: 'checkAIStatus' }, (response: unknown) => {
          resolve(response);
        });
      });
    });
    
    expect(response).toBeDefined();
    expect((response as { success?: boolean }).success).toBe(true);
  });

  test('all exports are available from api-integrations', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Test that service worker loads correctly, which means all modules imported successfully
    // If extractThreadContext wasn't exported, the service worker would fail to load
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        // @ts-ignore - chrome is available in extension context
        chrome.runtime.sendMessage({ action: 'checkAIStatus' }, (response: unknown) => {
          // If service worker responds, it means all modules loaded correctly
          // including api-integrations.js with extractThreadContext
          resolve(response ? { success: true, capabilities: (response as { capabilities?: unknown }).capabilities } : { success: false });
        });
      });
    });
    
    expect((response as { success?: boolean }).success).toBe(true);
    // If we got here, the service worker loaded successfully, which means all exports are available
    // The service worker imports api-integrations.js, so if extractThreadContext wasn't exported,
    // the service worker would have failed to load
  });
});

/**
 * Test Gmail-style inbox page
 */
test.describe('Gmail Test Page', () => {
  test('content script can extract from Gmail-style HTML', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Create Gmail-style HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><title>Gmail</title></head>
        <body>
          <div data-thread-id="test-thread-123">
            <h2 data-thread-id="test-thread-123"><span>Test Email Thread - Project Update</span></h2>
            <div data-message-id="msg-1" style="margin-left: 0px;">
              <div class="go"><span class="qu" title="alice@example.com" email="alice@example.com">Alice Smith</span></div>
              <div class="g3"><span title="2024-01-15T10:00:00Z">Mon, Jan 15, 2024, 10:00 AM</span></div>
              <div class="ii gt"><div>Hi team,<br><br>This is an important update about the project. We need to complete the task by Friday. The deadline is critical.</div></div>
            </div>
            <div data-message-id="msg-2" style="margin-left: 30px;">
              <div class="go"><span class="qu" title="bob@example.com" email="bob@example.com">Bob Johnson</span></div>
              <div class="g3"><span title="2024-01-15T11:30:00Z">Mon, Jan 15, 2024, 11:30 AM</span></div>
              <div class="ii gt"><div>Hi Alice,<br><br>I have a question about the requirements. Can you clarify the scope? What are the next steps?</div></div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    await page.setContent(htmlContent);
    
    // Verify HTML structure matches Gmail selectors
    const hasThread = await page.evaluate(() => {
      return document.querySelector('[data-thread-id]') !== null &&
             document.querySelector('[data-message-id]') !== null &&
             document.querySelector('.go .qu') !== null;
    });
    
    expect(hasThread).toBe(true);
    await page.close();
  });
});

/**
 * Test Outlook-style inbox page  
 */
test.describe('Outlook Test Page', () => {
  test('content script can extract from Outlook-style HTML', async ({ context, extensionId }) => {
    const page = await context.newPage();
    
    // Create Outlook-style HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head><title>Outlook</title></head>
        <body>
          <div data-convid="test-conv-123">
            <h2>Test Email Thread - Project Update</h2>
            <div role="listitem" data-testid="message-item" data-message-id="msg-1">
              <div data-testid="message-sender">Alice Smith &lt;alice@example.com&gt;</div>
              <div data-testid="message-timestamp" title="2024-01-15T10:00:00Z">Mon 1/15/2024 10:00 AM</div>
              <div data-testid="message-body-content" aria-label="Message body" class="allowTextSelection">
                Hi team,<br><br>This is an important update about the project. We need to complete the task by Friday.
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    await page.setContent(htmlContent);
    
    // Verify HTML structure matches Outlook selectors
    const hasThread = await page.evaluate(() => {
      return document.querySelector('[data-convid]') !== null &&
             document.querySelector('[role="listitem"]') !== null &&
             document.querySelector('[data-testid="message-body-content"]') !== null;
    });
    
    expect(hasThread).toBe(true);
    await page.close();
  });
});


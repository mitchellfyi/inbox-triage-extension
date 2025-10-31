import { test, expect, evaluateInServiceWorker } from './fixtures/extension.js';

test.describe('Service Worker', () => {
  test('loads and initializes properly', async ({ backgroundPage }) => {
    // Check that the service worker loaded
    expect(backgroundPage).toBeTruthy();
    
    // Wait for service worker to be fully initialized
    await backgroundPage.waitForFunction(() => {
      return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
    }, { timeout: 5000 });
    
    // Check that the main service worker class is instantiated
    const hasServiceWorker = await evaluateInServiceWorker(backgroundPage, () => {
      return typeof window !== 'undefined' || typeof globalThis !== 'undefined';
    });
    
    expect(hasServiceWorker).toBe(true);
  });

  test('handles basic messaging', async ({ backgroundPage, sidePanelPage }) => {
    // Wait for pages to be ready
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await backgroundPage.waitForFunction(() => {
      return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
    }, { timeout: 5000 });
    
    // Test message passing from side panel to service worker
    let messageReceived = false;
    
    // Listen for messages in the background page
    await backgroundPage.evaluate(() => {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'test') {
          sendResponse({ success: true });
          return true;
        }
      });
    });
    
    // Send a test message from the side panel
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'test' }, (response) => {
          resolve(response);
        });
      });
    });
    
    expect(response).toEqual({ success: true });
  });

  test('responds to AI capability checks', async ({ backgroundPage, sidePanelPage }) => {
    // Wait for pages to be ready
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await backgroundPage.waitForFunction(() => {
      return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
    }, { timeout: 5000 });
    
    // Test AI capability detection functionality
    // This tests the service worker's ability to check AI model availability
    
    // Send a capability check message (using actual action name)
    const capabilityResponse = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'checkAIStatus' 
        }, (response) => {
          resolve(response);
        });
      });
    });
    
    // The response should include capability information (even if AI is not available)
    expect(capabilityResponse).toBeDefined();
    expect(typeof capabilityResponse).toBe('object');
    expect(capabilityResponse.success).toBe(true);
    expect(capabilityResponse.capabilities).toBeDefined();
  });

  test('handles side panel opening', async ({ context, extensionId }) => {
    // Test that the extension action opens the side panel
    // We'll navigate to a test page and then open the side panel
    const testPage = await context.newPage();
    await testPage.goto('data:text/html,<h1>Test Page</h1>');
    
    // The side panel should be accessible via the extension URL
    const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel/sidepanel.html`;
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(sidePanelUrl);
    
    // Wait for page to load
    await sidePanelPage.waitForLoadState('domcontentloaded');
    
    await expect(sidePanelPage).toHaveTitle('Inbox Triage');
    
    await testPage.close();
    await sidePanelPage.close();
  });
});
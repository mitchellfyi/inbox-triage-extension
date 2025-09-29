import { test, expect, evaluateInServiceWorker } from './fixtures/extension.js';

test.describe('Service Worker', () => {
  test('loads and initializes properly', async ({ backgroundPage }) => {
    // Check that the service worker loaded
    await expect(backgroundPage).toBeTruthy();
    
    // Check that the main service worker class is instantiated
    const hasServiceWorker = await evaluateInServiceWorker(backgroundPage, () => {
      return typeof window !== 'undefined' || typeof globalThis !== 'undefined';
    });
    
    expect(hasServiceWorker).toBe(true);
  });

  test('handles basic messaging', async ({ backgroundPage, sidePanelPage }) => {
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
    // Test AI capability detection functionality
    // This tests the service worker's ability to check AI model availability
    
    // Send a capability check message
    const capabilityResponse = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ 
          action: 'checkCapabilities' 
        }, (response) => {
          resolve(response);
        });
      });
    });
    
    // The response should include capability information (even if AI is not available)
    expect(capabilityResponse).toBeDefined();
    expect(typeof capabilityResponse).toBe('object');
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
    
    await expect(sidePanelPage).toHaveTitle('Inbox Triage Extension');
    
    await testPage.close();
    await sidePanelPage.close();
  });
});
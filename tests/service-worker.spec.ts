import { test, expect } from './fixtures/extension.js';

test.describe('Service Worker', () => {
  test('loads and initializes properly', async ({ sidePanelPage }) => {
    // Wait for page to be ready
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Test that service worker is available by checking if we can send messages
    // In headless mode, we can't directly access backgroundPage, so we test via message passing
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkAIStatus' }, (response) => {
          resolve(response);
        });
      });
    });
    
    // If we get a response, the service worker is loaded and initialized
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    expect(response.capabilities).toBeDefined();
  });

  test('handles basic messaging', async ({ sidePanelPage }) => {
    // Wait for page to be ready
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Test message passing from side panel to service worker
    // The service worker should handle unknown actions gracefully
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'test' }, (response) => {
          resolve(response);
        });
      });
    });
    
    // Service worker should respond (even if it's an error for unknown action)
    expect(response).toBeDefined();
  });

  test('responds to AI capability checks', async ({ sidePanelPage }) => {
    // Wait for page to be ready
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
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

  test('statusBroadcaster is properly scoped as instance property', async ({ sidePanelPage, backgroundPage }) => {
    // This test specifically verifies the fix for ReferenceError: statusBroadcaster is not defined
    // The service worker should initialize AI capabilities without throwing ReferenceError
    // because statusBroadcaster is now correctly referenced as this.statusBroadcaster
    
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Trigger AI initialization by checking status multiple times
    // This exercises the initializeAI() method which uses statusBroadcaster
    const responses = await Promise.all([
      sidePanelPage.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'checkAIStatus' }, (response) => {
            resolve(response);
          });
        });
      }),
      sidePanelPage.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'checkAIStatus' }, (response) => {
            resolve(response);
          });
        });
      }),
    ]);
    
    // All responses should succeed - if statusBroadcaster caused ReferenceError, initialization would fail
    responses.forEach(response => {
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.capabilities).toBeDefined();
    });
    
    // Verify no ReferenceError occurred in service worker
    // The successful responses indicate statusBroadcaster was correctly accessed
    // If it was undefined, we would see initialization failures
  });
});
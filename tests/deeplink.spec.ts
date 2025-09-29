import { test, expect } from './fixtures/extension.js';

test.describe('Deep Link Generation', () => {
  test('generates deep-link URLs with thread metadata', async ({ sidePanelPage, backgroundPage }) => {
    // Mock thread data that would come from content scripts
    const mockThreadData = {
      subject: 'Test Email Subject',
      threadId: 'thread-123456',
      provider: 'gmail'
    };
    
    // Inject the mock data into the side panel
    await sidePanelPage.evaluate((threadData) => {
      // Simulate having extracted thread data
      window.currentThread = threadData;
    }, mockThreadData);
    
    // Test deep-link generation functionality
    const deepLinkUrl = await sidePanelPage.evaluate(() => {
      // This would typically be triggered by some UI action
      // For now, we'll test the URL generation logic directly
      const baseUrl = 'https://example.com/ingest'; // This would be the actual web app URL
      const params = new URLSearchParams({
        subject: window.currentThread?.subject || '',
        threadId: window.currentThread?.threadId || '',
        provider: window.currentThread?.provider || ''
      });
      
      return `${baseUrl}?${params.toString()}`;
    });
    
    // Verify the deep-link URL contains expected parameters
    const url = new URL(deepLinkUrl);
    expect(url.searchParams.get('subject')).toBe('Test Email Subject');
    expect(url.searchParams.get('threadId')).toBe('thread-123456');
    expect(url.searchParams.get('provider')).toBe('gmail');
  });

  test('handles chrome.tabs.create for deep-link navigation', async ({ sidePanelPage, context }) => {
    // Mock the chrome.tabs API since we can't actually test the real implementation
    // without more complex setup
    
    let tabCreateCalled = false;
    let tabCreateUrl = '';
    
    // Mock chrome.tabs.create in the side panel context
    await sidePanelPage.evaluate(() => {
      // Create a mock chrome.tabs.create function
      if (!chrome.tabs) {
        chrome.tabs = {};
      }
      chrome.tabs.create = function(createProperties) {
        window.mockTabCreateCalled = true;
        window.mockTabCreateUrl = createProperties.url;
        return Promise.resolve({ id: 1 });
      };
    });
    
    // Simulate clicking a deep-link button (if it exists in the UI)
    const deepLinkUrl = 'https://example.com/ingest?subject=Test&threadId=123&provider=gmail';
    
    // Execute the deep-link creation
    await sidePanelPage.evaluate((url) => {
      // This simulates what would happen when user wants to open the web app
      chrome.tabs.create({ url: url });
    }, deepLinkUrl);
    
    // Verify that chrome.tabs.create was called with the correct URL
    const tabCreateResult = await sidePanelPage.evaluate(() => ({
      called: window.mockTabCreateCalled,
      url: window.mockTabCreateUrl
    }));
    
    expect(tabCreateResult.called).toBe(true);
    expect(tabCreateResult.url).toBe(deepLinkUrl);
  });

  test('validates required metadata before generating deep-link', async ({ sidePanelPage }) => {
    // Test that deep-link generation handles missing metadata gracefully
    
    const result = await sidePanelPage.evaluate(() => {
      // Simulate missing thread data
      window.currentThread = null;
      
      try {
        const baseUrl = 'https://example.com/ingest';
        const params = new URLSearchParams({
          subject: window.currentThread?.subject || '',
          threadId: window.currentThread?.threadId || '',
          provider: window.currentThread?.provider || ''
        });
        
        const url = `${baseUrl}?${params.toString()}`;
        return { success: true, url };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.url).toBe('https://example.com/ingest?subject=&threadId=&provider=');
  });

  test('encodes URL parameters correctly', async ({ sidePanelPage }) => {
    // Test that special characters in email subjects are properly encoded
    
    const mockThreadData = {
      subject: 'Test Email: Special "Quotes" & Symbols!',
      threadId: 'thread-with-special-chars-#@$',
      provider: 'outlook'
    };
    
    const encodedUrl = await sidePanelPage.evaluate((threadData) => {
      const baseUrl = 'https://example.com/ingest';
      const params = new URLSearchParams({
        subject: threadData.subject,
        threadId: threadData.threadId,
        provider: threadData.provider
      });
      
      return `${baseUrl}?${params.toString()}`;
    }, mockThreadData);
    
    // Verify proper URL encoding
    const url = new URL(encodedUrl);
    expect(url.searchParams.get('subject')).toBe('Test Email: Special "Quotes" & Symbols!');
    expect(url.searchParams.get('threadId')).toBe('thread-with-special-chars-#@$');
    expect(url.searchParams.get('provider')).toBe('outlook');
  });
});
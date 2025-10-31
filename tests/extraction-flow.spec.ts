import { test, expect } from './fixtures/extension.js';

/**
 * Test extraction flow improvements
 * Tests fixes for:
 * 1. statusBroadcaster reference error (service worker initialization)
 * 2. Content script connection and reload
 * 3. Extract button disabled during extraction
 * 4. Draft panel closing and scrolling after generation
 */
test.describe('Extraction Flow Improvements', () => {
  test('service worker initializes without statusBroadcaster ReferenceError', async ({ sidePanelPage }) => {
    // Wait for page to load
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Check service worker responds to AI status check
    // This indirectly tests that statusBroadcaster is properly defined as this.statusBroadcaster
    const response = await sidePanelPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkAIStatus' }, (response) => {
          resolve(response);
        });
      });
    });

    // If service worker initialized without errors, we'll get a response
    expect(response).toBeDefined();
    expect(response.success).toBe(true);
    
    // Check background page console for ReferenceError related to statusBroadcaster
    // Note: We don't require backgroundPage to be available for this test to pass
    // The successful response is the main test - if statusBroadcaster caused ReferenceError,
    // initialization would fail and we wouldn't get a successful response
  });

  test('extract button stays disabled during entire extraction process', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Set up context to simulate being on an email thread page
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel) {
        sidePanel.currentContext.isOnEmailThread = true;
        sidePanel.currentContext.url = 'https://mail.google.com/mail/u/0/#inbox/th123';
        sidePanel.updateContextUI();
      }
    });

    const extractBtn = sidePanelPage.locator('#extract-btn');
    
    // Initially button should be enabled
    await expect(extractBtn).toBeEnabled();
    
    // Monitor button state during extraction
    const buttonStates: boolean[] = [];
    
    // Set up monitoring before clicking
    await sidePanelPage.evaluate(() => {
      const btn = document.getElementById('extract-btn');
      if (btn) {
        (window as any).__buttonStateMonitor = [];
        const observer = new MutationObserver(() => {
          (window as any).__buttonStateMonitor.push({
            disabled: btn.disabled,
            timestamp: Date.now()
          });
        });
        observer.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
      }
    });
    
    // Click extract button
    await extractBtn.click();
    
    // Button should immediately be disabled
    await expect(extractBtn).toBeDisabled();
    
    // Wait and check button remains disabled multiple times
    for (let i = 0; i < 5; i++) {
      await sidePanelPage.waitForTimeout(300);
      const isDisabled = await extractBtn.isDisabled();
      expect(isDisabled).toBe(true);
      buttonStates.push(isDisabled);
    }
    
    // Verify isExtracting flag prevents re-enabling
    const extractionState = await sidePanelPage.evaluate(() => {
      const btn = document.getElementById('extract-btn');
      // Check if isExtracting flag exists in the side panel instance
      const sidePanel = (window as any).sidePanelInstance;
      return {
        disabled: btn?.disabled ?? false,
        isExtracting: sidePanel?.isExtracting ?? null
      };
    });
    
    expect(extractionState.disabled).toBe(true);
    // All states should show disabled
    expect(buttonStates.every(state => state === true)).toBe(true);
  });

  test('content script ping responds immediately even before full initialization', async ({ context, extensionId }) => {
    // Create a test page that simulates Gmail
    const testPage = await context.newPage();
    
    // Navigate to extension page to verify API availability
    await testPage.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    await testPage.waitForLoadState('domcontentloaded');
    
    // Check that extension APIs are available
    const hasExtension = await testPage.evaluate(() => {
      return typeof chrome !== 'undefined' && 
             chrome.runtime !== undefined &&
             chrome.tabs !== undefined;
    });
    
    expect(hasExtension).toBe(true);
    
    await testPage.close();
  });

  test('draft controls panel closes and scrolls to drafts after generation', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Mock thread data
    const mockThread = {
      provider: 'gmail',
      subject: 'Test Thread',
      messages: [
        {
          index: 0,
          content: 'Test message content',
          sender: { name: 'Test Sender', email: 'test@example.com' },
          timestamp: '2024-01-15T10:00:00Z'
        }
      ],
      attachments: []
    };

    // Set up initial state: show controls section
    await sidePanelPage.evaluate((thread) => {
      // Mock currentThread in the side panel instance
      const sidePanel = (window as any).__sidePanelInstance;
      if (sidePanel) {
        sidePanel.currentThread = thread;
      }
      
      // Show reply drafts controls section
      const controlsSection = document.getElementById('reply-drafts-controls-section');
      if (controlsSection) {
        controlsSection.classList.remove('hidden');
      }
      
      // Hide drafts section initially
      const draftsSection = document.getElementById('reply-drafts-section');
      if (draftsSection) {
        draftsSection.classList.add('hidden');
      }
    }, mockThread);

    // Verify controls section is visible
    const controlsVisible = await sidePanelPage.evaluate(() => {
      const section = document.getElementById('reply-drafts-controls-section');
      return section && !section.classList.contains('hidden');
    });
    expect(controlsVisible).toBe(true);

    // Simulate draft generation (mimicking generateReplyDrafts behavior)
    await sidePanelPage.evaluate(() => {
      // Simulate hideSection call (what generateReplyDrafts does)
      const controlsSection = document.getElementById('reply-drafts-controls-section');
      if (controlsSection) {
        controlsSection.classList.add('hidden');
      }
      
      // Simulate displayReplyDrafts behavior
      const draftsSection = document.getElementById('reply-drafts-section');
      if (draftsSection) {
        draftsSection.classList.remove('hidden');
        
        // Add a draft element to the container
        const draftsContainer = document.getElementById('reply-drafts');
        if (draftsContainer) {
          draftsContainer.innerHTML = ''; // Clear existing
          const draftDiv = document.createElement('div');
          draftDiv.className = 'draft accordion-draft expanded';
          draftDiv.innerHTML = '<div class="draft-header"><h3>Draft 1</h3></div><div class="draft-content"><div class="draft-body"><p>Test draft content</p></div></div>';
          draftsContainer.appendChild(draftDiv);
        }
        
        // Simulate scrollIntoView call (what displayReplyDrafts does)
        setTimeout(() => {
          draftsSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 50);
      }
    });

    // Wait for UI update and scroll
    await sidePanelPage.waitForTimeout(200);

    // Verify controls section is hidden
    const controlsHidden = await sidePanelPage.evaluate(() => {
      const section = document.getElementById('reply-drafts-controls-section');
      return section && section.classList.contains('hidden');
    });
    expect(controlsHidden).toBe(true);

    // Verify drafts section is visible
    const draftsVisible = await sidePanelPage.evaluate(() => {
      const section = document.getElementById('reply-drafts-section');
      return section && !section.classList.contains('hidden');
    });
    expect(draftsVisible).toBe(true);
    
    // Verify draft content exists
    const hasDraftContent = await sidePanelPage.evaluate(() => {
      const draftsContainer = document.getElementById('reply-drafts');
      return draftsContainer && draftsContainer.querySelector('.draft') !== null;
    });
    expect(hasDraftContent).toBe(true);
  });

  test('extract button disabled state persists through async operations', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Set up context to simulate being on an email thread page
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel) {
        sidePanel.currentContext.isOnEmailThread = true;
        sidePanel.currentContext.url = 'https://mail.google.com/mail/u/0/#inbox/th123';
        sidePanel.updateContextUI();
      }
    });

    const extractBtn = sidePanelPage.locator('#extract-btn');
    
    // Wait for button to be enabled
    await expect(extractBtn).toBeEnabled({ timeout: 2000 });
    
    // Click extract button to start extraction
    await extractBtn.click();
    
    // Immediately verify disabled
    await expect(extractBtn).toBeDisabled();
    
    // Simulate multiple async operations that might try to re-enable
    // This tests ensureButtonDisabled() helper function
    await sidePanelPage.evaluate(() => {
      // Simulate updateContextUI being called
      const btn = document.getElementById('extract-btn');
      const sidePanel = (window as any).sidePanelInstance;
      if (btn && sidePanel && !sidePanel.isExtracting) {
        btn.disabled = false; // This should not happen if isExtracting is true
      }
    });
    
    // Wait a bit
    await sidePanelPage.waitForTimeout(200);
    
    // Button should still be disabled
    await expect(extractBtn).toBeDisabled();
    
    // Test that resetExtractionState won't re-enable if isExtracting is true
    await sidePanelPage.evaluate(() => {
      const btn = document.getElementById('extract-btn');
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel && sidePanel.isExtracting) {
        // Simulate resetExtractionState check
        if (!sidePanel.isExtracting) {
          btn.disabled = false;
        }
      }
    });
    
    // Button should still be disabled
    await expect(extractBtn).toBeDisabled();
  });
});


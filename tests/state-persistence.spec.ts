import { test, expect } from './fixtures/extension.js';

/**
 * Test state persistence features
 * Tests for:
 * 1. State saving when thread extracted, summary generated, drafts created
 * 2. State restoration when returning to same thread URL
 * 3. State clearing when navigating to different thread
 */
test.describe('State Persistence', () => {
  test('saves state after thread extraction', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Mock thread extraction
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel) {
        sidePanel.currentThread = {
          provider: 'gmail',
          subject: 'Test Thread',
          messages: [{ index: 0, content: 'Test', sender: { name: 'Test', email: 'test@example.com' } }],
          attachments: []
        };
        sidePanel.currentContext.url = 'https://mail.google.com/mail/u/0/#inbox/th123';
        sidePanel.saveState();
      }
    });

    // Check if state was saved
    const stateSaved = await sidePanelPage.evaluate(async () => {
      const result = await chrome.storage.local.get('inboxTriageState');
      return result.inboxTriageState !== undefined;
    });

    expect(stateSaved).toBe(true);
  });

  test('restores state when returning to same thread URL', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    const mockState = {
      threadUrl: 'https://mail.google.com/mail/u/0/#inbox/th123',
      thread: {
        provider: 'gmail',
        subject: 'Test Thread',
        messages: [{ index: 0, content: 'Test', sender: { name: 'Test', email: 'test@example.com' } }],
        attachments: []
      },
      summary: 'Test summary',
      drafts: [{ type: 'Draft 1', body: 'Test draft' }],
      timestamp: Date.now()
    };

    // Save state
    await sidePanelPage.evaluate(async (state) => {
      await chrome.storage.local.set({ inboxTriageState: state });
    }, mockState);

    // Set current context to match
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel) {
        sidePanel.currentContext.url = 'https://mail.google.com/mail/u/0/#inbox/th123';
        sidePanel.currentContext.isOnEmailThread = true;
      }
    });

    // Restore state
    const restored = await sidePanelPage.evaluate(async () => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel) {
        return await sidePanel.restoreState();
      }
      return false;
    });

    expect(restored).toBe(true);
  });

  test('does not restore state when URL does not match', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    const mockState = {
      threadUrl: 'https://mail.google.com/mail/u/0/#inbox/th123',
      thread: { provider: 'gmail', subject: 'Test' },
      summary: 'Test summary',
      drafts: [],
      timestamp: Date.now()
    };

    // Save state
    await sidePanelPage.evaluate(async (state) => {
      await chrome.storage.local.set({ inboxTriageState: state });
    }, mockState);

    // Set current context to different URL
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel) {
        sidePanel.currentContext.url = 'https://mail.google.com/mail/u/0/#inbox/th456';
        sidePanel.currentContext.isOnEmailThread = true;
      }
    });

    // Restore state
    const restored = await sidePanelPage.evaluate(async () => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel) {
        return await sidePanel.restoreState();
      }
      return false;
    });

    expect(restored).toBe(false);
  });
});

/**
 * Test draft creation in email client
 * Tests for:
 * 1. Create Draft button appears on each draft
 * 2. Button triggers draft creation in Gmail/Outlook
 * 3. Error handling when not on email page
 */
test.describe('Draft Creation in Email Client', () => {
  test('create draft button appears on each draft', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Mock drafts display
    const mockDrafts = [
      { type: 'Draft 1', body: 'Test draft content' },
      { type: 'Draft 2', body: 'Another draft' }
    ];

    await sidePanelPage.evaluate((drafts) => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel && sidePanel.draftRenderer) {
        sidePanel.draftRenderer.render(drafts);
      }
    }, mockDrafts);

    // Check for create draft buttons
    const createDraftButtons = await sidePanelPage.locator('.create-draft-btn').count();
    expect(createDraftButtons).toBeGreaterThan(0);
  });

  test('create draft button is accessible', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    const mockDrafts = [{ type: 'Draft 1', body: 'Test draft' }];

    await sidePanelPage.evaluate((drafts) => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel && sidePanel.draftRenderer) {
        sidePanel.draftRenderer.render(drafts);
      }
    }, mockDrafts);

    const createDraftBtn = sidePanelPage.locator('.create-draft-btn').first();
    await expect(createDraftBtn).toBeVisible();
    await expect(createDraftBtn).toBeEnabled();
    
    // Check ARIA label
    const ariaLabel = await createDraftBtn.getAttribute('aria-describedby');
    expect(ariaLabel).toBeTruthy();
  });
});

/**
 * Test loading indicators
 * Tests for:
 * 1. Loading indicators appear during operations
 * 2. Different indicators for different operation types
 * 3. Animations are present
 */
test.describe('Loading Indicators', () => {
  test('loading status shows spinner for long operations', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Trigger loading status
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel && sidePanel.displayManager) {
        sidePanel.displayManager.updateStatus('Generating summary...', 'loading');
      }
    });

    // Check for spinner
    const spinner = await sidePanelPage.locator('.loading-spinner').count();
    expect(spinner).toBeGreaterThan(0);
  });

  test('loading status shows dots for short operations', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Trigger loading status
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel && sidePanel.displayManager) {
        sidePanel.displayManager.updateStatus('Connecting...', 'loading');
      }
    });

    // Check for loading dots
    const dots = await sidePanelPage.locator('.loading-dots').count();
    expect(dots).toBeGreaterThan(0);
  });

  test('loading status has progress bar animation', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    // Trigger loading status
    await sidePanelPage.evaluate(() => {
      const sidePanel = (window as any).sidePanelInstance;
      if (sidePanel && sidePanel.displayManager) {
        sidePanel.displayManager.updateStatus('Processing...', 'loading');
      }
    });

    // Check status element has loading class and progress bar
    const statusElement = sidePanelPage.locator('.status.loading');
    await expect(statusElement).toBeVisible();
    
    // Check CSS animation is applied (progress bar via ::after pseudo-element)
    const hasAnimation = await statusElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return styles.animationName !== 'none' || styles.backgroundSize !== 'auto';
    });
    expect(hasAnimation).toBe(true);
  });

  test('disabled buttons show loading state', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });

    const extractBtn = sidePanelPage.locator('#extract-btn');
    
    // Disable button
    await extractBtn.evaluate((btn) => {
      (btn as HTMLButtonElement).disabled = true;
    });

    // Check button has disabled state
    await expect(extractBtn).toBeDisabled();
    
    // Check for loading gradient animation (for main buttons)
    const hasGradient = await extractBtn.evaluate((btn) => {
      const styles = window.getComputedStyle(btn);
      return styles.backgroundImage !== 'none' && styles.backgroundImage !== '';
    });
    expect(hasGradient).toBe(true);
  });
});


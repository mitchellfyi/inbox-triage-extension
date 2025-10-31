import { test as baseTest, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  backgroundPage: Page;
  sidePanelPage: Page;
}

/**
 * Playwright fixture for loading Chrome extension in persistent context
 * Provides utilities for extension testing including ID discovery and page access
 */
export const test = baseTest.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const extensionPath = path.resolve(process.cwd());
    
    // Launch persistent context with extension loaded
    const context = await chromium.launchPersistentContext('', {
      headless: false, // Extensions require headed mode for installation
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
      ],
      channel: 'chromium',
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Get extension ID from chrome://extensions page
    const page = await context.newPage();
    
    try {
      await page.goto('chrome://extensions', { waitUntil: 'domcontentloaded' });
      
      // Enable developer mode if not already enabled
      const devModeToggle = page.locator('#devMode');
      const isEnabled = await devModeToggle.isChecked().catch(() => false);
      if (!isEnabled) {
        await devModeToggle.click();
        await page.waitForTimeout(1000); // Wait for UI update
      }
      
      // Wait for extensions to load
      await page.waitForTimeout(2000);
      
      // Find the extension card by name - try multiple selectors
      const extensionCard = page.locator('extensions-item').filter({
        hasText: 'Inbox Triage Extension'
      });
      
      await extensionCard.waitFor({ state: 'visible', timeout: 15000 });
      
      // Extract extension ID from the card's id attribute
      // Extension IDs in chrome://extensions are in format like "extension-id-abc123..."
      let extensionId = await extensionCard.getAttribute('id');
      
      // If ID is not directly available, try getting it from the extension's URL or data attribute
      if (!extensionId) {
        // Try alternative: get from the extension's details URL
        const detailsLink = extensionCard.locator('a[href*="chrome-extension://"]').first();
        const linkCount = await detailsLink.count();
        if (linkCount > 0) {
          const href = await detailsLink.getAttribute('href');
          if (href) {
            const match = href.match(/chrome-extension:\/\/([^/]+)/);
            if (match) {
              extensionId = match[1];
            }
          }
        }
      }
      
      // If still no ID, try using the extension's name-based selector and extract from URL
      if (!extensionId) {
        // Get all extensions and find ours by name
        const allExtensions = await page.locator('extensions-item').all();
        for (const ext of allExtensions) {
          const name = await ext.textContent();
          if (name && name.includes('Inbox Triage Extension')) {
            const detailsLink = ext.locator('a[href*="chrome-extension://"]').first();
            const linkCount = await detailsLink.count();
            if (linkCount > 0) {
              const href = await detailsLink.getAttribute('href');
              if (href) {
                const match = href.match(/chrome-extension:\/\/([^/]+)/);
                if (match) {
                  extensionId = match[1];
                  break;
                }
              }
            }
          }
        }
      }
      
      // Final fallback: use the service worker's runtime ID
      if (!extensionId) {
        // Try to get ID from context
        const backgroundPages = context.backgroundPages();
        if (backgroundPages.length > 0) {
          const bgPage = backgroundPages[0];
          const runtimeId = await bgPage.evaluate(() => {
            return chrome.runtime.id;
          }).catch(() => null);
          if (runtimeId) {
            extensionId = runtimeId;
          }
        }
      }
      
      if (!extensionId) {
        throw new Error('Could not find extension ID. Make sure the extension is loaded correctly.');
      }

      await use(extensionId);
    } finally {
      await page.close().catch(() => {
        // Ignore errors if page already closed
      });
    }
  },

  backgroundPage: async ({ context }, use) => {
    // Wait for background page to be available
    // Service workers may take a moment to initialize
    let backgroundPage = context.backgroundPages()[0];
    
    if (!backgroundPage) {
      // Wait for background page event with timeout
      try {
        backgroundPage = await context.waitForEvent('backgroundpage', { timeout: 15000 });
      } catch (error) {
        // If timeout, try getting it again
        backgroundPage = context.backgroundPages()[0];
        if (!backgroundPage) {
          throw new Error('Background page did not load within timeout. Ensure extension is properly loaded.');
        }
      }
    }
    
    // Wait for service worker to be ready
    try {
      await backgroundPage.waitForFunction(() => {
        return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
      }, { timeout: 10000 });
    } catch (error) {
      // Some service workers might not expose chrome immediately
      // Try to evaluate something to verify it's working
      try {
        await backgroundPage.evaluate(() => {
          return typeof self !== 'undefined';
        });
      } catch (e) {
        throw new Error('Service worker context not available');
      }
    }
    
    await use(backgroundPage);
  },

  sidePanelPage: async ({ context, extensionId }, use) => {
    // Open side panel page directly
    const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel/sidepanel.html`;
    const page = await context.newPage();
    
    try {
      await page.goto(sidePanelUrl, { waitUntil: 'domcontentloaded' });
      
      // Wait for page to be fully loaded
      await page.waitForLoadState('domcontentloaded');
      
      // Wait for main script to execute and DOM to be ready
      await page.waitForFunction(() => {
        return document.querySelector('#extract-btn') !== null;
      }, { timeout: 10000 });
      
      await use(page);
    } finally {
      // Always close the page, even if test fails
      await page.close().catch(() => {
        // Ignore errors if page already closed
      });
    }
  },
});

export { expect } from '@playwright/test';

/**
 * Helper function to evaluate code in service worker context
 */
export async function evaluateInServiceWorker(backgroundPage: Page, fn: Function, ...args: any[]) {
  return await backgroundPage.evaluate(fn, ...args);
}
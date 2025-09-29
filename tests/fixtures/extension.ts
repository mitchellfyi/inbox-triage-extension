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
    await page.goto('chrome://extensions');
    
    // Enable developer mode if not already enabled
    const devModeToggle = page.locator('#devMode');
    const isEnabled = await devModeToggle.isChecked();
    if (!isEnabled) {
      await devModeToggle.click();
      await page.waitForTimeout(1000); // Wait for UI update
    }
    
    // Find the extension card by name
    const extensionCard = page.locator('extensions-item').filter({
      hasText: 'Inbox Triage Extension'
    });
    
    await extensionCard.waitFor({ state: 'visible' });
    
    // Extract extension ID from the card's id attribute
    const extensionId = await extensionCard.getAttribute('id');
    
    if (!extensionId) {
      throw new Error('Could not find extension ID');
    }

    await page.close();
    await use(extensionId);
  },

  backgroundPage: async ({ context }, use) => {
    // Wait for background page to be available
    let backgroundPage = context.backgroundPages()[0];
    if (!backgroundPage) {
      backgroundPage = await context.waitForEvent('backgroundpage');
    }
    
    await use(backgroundPage);
  },

  sidePanelPage: async ({ context, extensionId }, use) => {
    // Open side panel page directly
    const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel/sidepanel.html`;
    const page = await context.newPage();
    await page.goto(sidePanelUrl);
    
    await use(page);
  },
});

export { expect } from '@playwright/test';

/**
 * Helper function to evaluate code in service worker context
 */
export async function evaluateInServiceWorker(backgroundPage: Page, fn: Function, ...args: any[]) {
  return await backgroundPage.evaluate(fn, ...args);
}
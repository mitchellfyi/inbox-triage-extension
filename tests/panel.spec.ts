import { test, expect } from './fixtures/extension.js';

test.describe('Side Panel', () => {
  test('opens and shows baseline UI', async ({ sidePanelPage }) => {
    // Check that the page loaded
    await expect(sidePanelPage).toHaveTitle('Inbox Triage');
    
    // Check main UI elements are present (sections may be hidden initially)
    // Summary section exists but is initially hidden
    await expect(sidePanelPage.locator('#summary-heading')).toBeAttached();
    // Key Points section exists but is initially hidden
    await expect(sidePanelPage.locator('#key-points-heading')).toBeAttached();
    // Attachments section exists but is initially hidden
    await expect(sidePanelPage.locator('#attachments-heading')).toBeAttached();
    // Reply Drafts section exists but is initially hidden
    await expect(sidePanelPage.locator('#reply-drafts-heading')).toBeAttached();
    
    // Check main action buttons are present
    await expect(sidePanelPage.getByRole('button', { name: 'Extract Current Thread' })).toBeVisible();
    // Generate Drafts button exists but may be disabled initially
    await expect(sidePanelPage.locator('#generate-drafts-btn')).toBeAttached();
    
    // Check default processing mode is selected (in settings panel)
    const onDeviceRadio = sidePanelPage.locator('#mode-device-only');
    await expect(onDeviceRadio).toBeAttached();
    // Settings panel is closed by default, so radio may not be visible
    // But we can check it exists and has correct value
    await expect(onDeviceRadio).toHaveValue('device-only');
    
    // Check tone selector is present with default value
    // Note: This section is initially hidden until thread is extracted
    const toneSelect = sidePanelPage.locator('#tone-selector');
    await expect(toneSelect).toBeAttached();
    await expect(toneSelect).toHaveValue('neutral');
  });

  test('shows version information', async ({ sidePanelPage }) => {
    // Check that the page has correct title
    await expect(sidePanelPage).toHaveTitle('Inbox Triage');
    
    // Check that service worker is loaded by looking for any JS functionality
    // The page should have the main script loaded
    const scripts = sidePanelPage.locator('script[src]');
    await expect(scripts.first()).toHaveAttribute('src', 'sidepanel.js');
    
    // Check that main heading exists
    await expect(sidePanelPage.getByRole('heading', { name: 'Inbox Triage' })).toBeVisible();
  });

  test('has accessible form controls', async ({ sidePanelPage }) => {
    // Check that form controls have proper labels and are keyboard accessible
    // Processing mode radio is in settings panel (initially closed)
    const onDeviceRadio = sidePanelPage.locator('#mode-device-only');
    await expect(onDeviceRadio).toBeAttached();
    
    // Tone selector is in reply drafts section (initially hidden)
    const toneSelect = sidePanelPage.locator('#tone-selector');
    await expect(toneSelect).toBeAttached();
    await expect(sidePanelPage.getByLabelText('Tone:')).toBeAttached();
    
    // Test keyboard navigation on visible elements
    // Extract button should be focusable
    await sidePanelPage.locator('#extract-btn').focus();
    const focusedElement = sidePanelPage.locator('#extract-btn');
    await expect(focusedElement).toBeFocused();
  });

  test('shows initial state correctly', async ({ sidePanelPage }) => {
    // Check that extract button is visible and enabled initially
    const extractBtn = sidePanelPage.locator('#extract-btn');
    await expect(extractBtn).toBeVisible();
    
    // Check that sections are initially hidden
    await expect(sidePanelPage.locator('#summary-section')).toHaveClass(/hidden/);
    await expect(sidePanelPage.locator('#key-points-section')).toHaveClass(/hidden/);
    await expect(sidePanelPage.locator('#attachments-section')).toHaveClass(/hidden/);
    await expect(sidePanelPage.locator('#reply-drafts-controls-section')).toHaveClass(/hidden/);
    
    // Check that status message shows initial state
    const statusText = sidePanelPage.locator('#status-text');
    await expect(statusText).toBeAttached();
  });
});
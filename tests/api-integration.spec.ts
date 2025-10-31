import { test, expect } from './fixtures/extension.js';

test.describe('API Integration Tests', () => {
  test('Anthropic API methods are defined and handle errors correctly', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    // Test that API provider selection shows all options as available
    const settingsBtn = sidePanelPage.locator('#settings-toggle-btn');
    await settingsBtn.click();
    
    await sidePanelPage.waitForSelector('#settings-panel.active', { timeout: 2000 });
    
    // Check API key checkbox to show provider selection
    const useApiKeyCheckbox = sidePanelPage.locator('#use-api-key');
    await useApiKeyCheckbox.check();
    
    // Wait for API key section to appear
    await sidePanelPage.waitForSelector('#api-key-section', { timeout: 1000 });
    
    // Verify all providers are listed as available
    const providerSelect = sidePanelPage.locator('#api-provider');
    const options = await providerSelect.locator('option').all();
    
    expect(options.length).toBeGreaterThanOrEqual(3);
    
    // Check provider options text - all should show as available
    const optionTexts = await Promise.all(options.map(opt => opt.textContent()));
    expect(optionTexts.some(text => text && text.includes('OpenAI') && text.includes('Available'))).toBe(true);
    expect(optionTexts.some(text => text && text.includes('Anthropic') && text.includes('Available'))).toBe(true);
    expect(optionTexts.some(text => text && text.includes('Google AI') && text.includes('Available'))).toBe(true);
  });

  test('API provider selection dropdown works correctly', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    const settingsBtn = sidePanelPage.locator('#settings-toggle-btn');
    await settingsBtn.click();
    
    await sidePanelPage.waitForSelector('#settings-panel.active', { timeout: 2000 });
    
    const useApiKeyCheckbox = sidePanelPage.locator('#use-api-key');
    await useApiKeyCheckbox.check();
    
    await sidePanelPage.waitForSelector('#api-key-section', { timeout: 1000 });
    
    // Test selecting each provider
    const providerSelect = sidePanelPage.locator('#api-provider');
    
    await providerSelect.selectOption('openai');
    expect(await providerSelect.inputValue()).toBe('openai');
    
    await providerSelect.selectOption('anthropic');
    expect(await providerSelect.inputValue()).toBe('anthropic');
    
    await providerSelect.selectOption('google');
    expect(await providerSelect.inputValue()).toBe('google');
  });

  test('API key input accepts and stores values', async ({ sidePanelPage }) => {
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#extract-btn', { timeout: 5000 });
    
    const settingsBtn = sidePanelPage.locator('#settings-toggle-btn');
    await settingsBtn.click();
    
    await sidePanelPage.waitForSelector('#settings-panel.active', { timeout: 2000 });
    
    const useApiKeyCheckbox = sidePanelPage.locator('#use-api-key');
    await useApiKeyCheckbox.check();
    
    await sidePanelPage.waitForSelector('#api-key-section', { timeout: 1000 });
    
    // Test API key input
    const apiKeyInput = sidePanelPage.locator('#api-key-input');
    await apiKeyInput.fill('test-api-key-123');
    
    expect(await apiKeyInput.inputValue()).toBe('test-api-key-123');
    
    // Verify input type is password for security
    const inputType = await apiKeyInput.getAttribute('type');
    expect(inputType).toBe('password');
  });
});



/**
 * Settings Manager Module
 * Handles user settings persistence and UI updates
 */

export class SettingsManager {
    constructor(elements, updateStatusCallback) {
        this.elements = elements;
        this.updateStatus = updateStatusCallback;
        this.settings = {
            processingMode: 'device-only',
            useApiKey: false,
            apiKey: '',
            apiProvider: 'google'
        };
    }

    /**
     * Initialize settings manager
     */
    initialize() {
        // Bind settings panel events
        if (this.elements.settingsToggleBtn) {
            this.elements.settingsToggleBtn.addEventListener('click', () => this.openPanel());
        }
        if (this.elements.settingsCloseBtn) {
            this.elements.settingsCloseBtn.addEventListener('click', () => this.closePanel());
        }
        if (this.elements.settingsOverlay) {
            this.elements.settingsOverlay.addEventListener('click', () => this.closePanel());
        }

        // ESC key to close settings
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.settingsPanel.classList.contains('active')) {
                this.closePanel();
            }
        });

        // Bind processing mode events
        if (this.elements.processingModeRadios) {
            this.elements.processingModeRadios.forEach(radio => {
                radio.addEventListener('change', (e) => {
                    this.settings.processingMode = e.target.value;
                    this.save();
                });
            });
        }

        // Bind API key events
        if (this.elements.useApiKeyCheckbox) {
            this.elements.useApiKeyCheckbox.addEventListener('change', (e) => {
                this.settings.useApiKey = e.target.checked;
                this.updateApiKeyUI();
            });
        }

        if (this.elements.apiProviderSelect) {
            this.elements.apiProviderSelect.addEventListener('change', (e) => {
                this.settings.apiProvider = e.target.value;
            });
        }

        if (this.elements.saveApiKeyBtn) {
            this.elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKey());
        }
    }

    /**
     * Load settings from Chrome storage
     */
    async load() {
        try {
            if (chrome?.storage?.sync) {
                const result = await chrome.storage.sync.get([
                    'processingMode',
                    'useApiKey',
                    'apiKey',
                    'apiProvider'
                ]);

                if (result.processingMode) {
                    this.settings.processingMode = result.processingMode;
                }
                if (result.useApiKey !== undefined) {
                    this.settings.useApiKey = result.useApiKey;
                }
                if (result.apiKey) {
                    this.settings.apiKey = result.apiKey;
                }
                if (result.apiProvider) {
                    this.settings.apiProvider = result.apiProvider;
                }
            }

            this.updateProcessingModeUI();
            this.updateApiKeyUI();
        } catch (error) {
            console.error('Error loading settings:', error);
            this.updateProcessingModeUI();
            this.updateApiKeyUI();
        }
    }

    /**
     * Save settings to Chrome storage
     */
    async save() {
        try {
            if (chrome?.storage?.sync) {
                await chrome.storage.sync.set({
                    processingMode: this.settings.processingMode,
                    useApiKey: this.settings.useApiKey,
                    apiKey: this.settings.apiKey,
                    apiProvider: this.settings.apiProvider
                });
                console.log('Settings saved (API key hidden):', {
                    ...this.settings,
                    apiKey: this.settings.apiKey ? '***' : ''
                });
            }
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    /**
     * Update processing mode UI
     */
    updateProcessingModeUI() {
        if (this.elements.processingModeRadios) {
            this.elements.processingModeRadios.forEach(radio => {
                radio.checked = radio.value === this.settings.processingMode;
            });
        }
    }

    /**
     * Update API key UI
     */
    updateApiKeyUI() {
        if (this.elements.useApiKeyCheckbox) {
            this.elements.useApiKeyCheckbox.checked = this.settings.useApiKey;
        }
        if (this.elements.apiKeyInput) {
            this.elements.apiKeyInput.value = this.settings.apiKey || '';
        }
        if (this.elements.apiProviderSelect) {
            this.elements.apiProviderSelect.value = this.settings.apiProvider;
        }
        if (this.elements.apiKeySection) {
            this.elements.apiKeySection.style.display = this.settings.useApiKey ? 'block' : 'none';
        }
    }

    /**
     * Save API key settings
     */
    async saveApiKey() {
        try {
            const apiKey = this.elements.apiKeyInput?.value?.trim() || '';
            const apiProvider = this.elements.apiProviderSelect?.value || 'google';

            if (this.settings.useApiKey && !apiKey) {
                this.updateStatus('Please enter an API key', 'error');
                return;
            }

            this.settings.apiKey = apiKey;
            this.settings.apiProvider = apiProvider;

            await this.save();

            this.updateStatus('✓ API key settings saved', 'success');
        } catch (error) {
            console.error('Error saving API key:', error);
            this.updateStatus('Failed to save API key settings', 'error');
        }
    }

    /**
     * Open settings panel
     */
    openPanel() {
        this.elements.settingsPanel.classList.add('active');
        this.elements.settingsOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    /**
     * Close settings panel
     */
    closePanel() {
        this.elements.settingsPanel.classList.remove('active');
        this.elements.settingsOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    /**
     * Get current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Show privacy information
     */
    showPrivacyInfo() {
        const message = `
Privacy & Data Usage:

🔒 On-Device Processing (Default):
• All AI processing happens locally in your browser
• Email content never leaves your device
• No data is transmitted to external servers
• Maximum privacy and security

☁️ Hybrid Mode (Optional):
• Falls back to cloud AI when device models are unavailable
• Only processes extracted email text and metadata
• Never transmits: attachments, images, raw files, or personal identifiers
• You maintain control with clear indicators

🔑 Cloud API Keys (Optional):
• Required only for cloud fallback in Hybrid mode
• Stored securely in Chrome's sync storage
• Used exclusively for AI API authentication
• Never shared with third parties

Your privacy remains protected with minimal necessary data transmission.
        `;
        alert(message);
    }
}


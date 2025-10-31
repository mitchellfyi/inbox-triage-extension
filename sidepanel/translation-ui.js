/**
 * Translation UI Module
 * Handles all translation-related functionality in the side panel
 */

export class TranslationUI {
    constructor(elements, updateStatusCallback) {
        this.elements = elements;
        this.updateStatus = updateStatusCallback;
        this.translationSettings = {
            targetLanguage: 'none',
            originalSummary: null,
            originalKeyPoints: null,
            originalDrafts: new Map()
        };
        this.isTranslatingDrafts = false; // Track if translation is in progress to prevent loops
    }

    /**
     * Initialize translation UI
     */
    initialize() {
        if (this.elements.targetLanguageSelect) {
            this.elements.targetLanguageSelect.addEventListener('change', () => this.onLanguageChange());
        }
    }

    /**
     * Load translation settings
     */
    async loadSettings() {
        try {
            if (chrome?.storage?.sync) {
                const result = await chrome.storage.sync.get(['translationLanguage']);
                if (result.translationLanguage && result.translationLanguage !== 'none') {
                    // Verify translation is still available before enabling
                    const isAvailable = await this.checkTranslationAvailability('en', result.translationLanguage);
                    if (isAvailable) {
                        this.translationSettings.targetLanguage = result.translationLanguage;
                    } else {
                        // Reset to 'none' if no longer available
                        console.log('Saved translation language no longer available, resetting to none');
                        this.translationSettings.targetLanguage = 'none';
                        await this.saveSettings();
                    }
                } else {
                    this.translationSettings.targetLanguage = result.translationLanguage || 'none';
                }
            }
            this.updateUI();
        } catch (error) {
            console.error('Error loading translation settings:', error);
        }
    }
    
    /**
     * Check if translation is available for a language pair
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {Promise<boolean>} True if translation is available
     */
    async checkTranslationAvailability(sourceLanguage, targetLanguage) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'checkTranslationAvailability',
                sourceLanguage,
                targetLanguage
            });
            
            return response && response.available;
        } catch (error) {
            console.warn('Error checking translation availability:', error);
            return false;
        }
    }

    /**
     * Save translation settings
     */
    async saveSettings() {
        try {
            if (chrome?.storage?.sync) {
                await chrome.storage.sync.set({
                    translationLanguage: this.translationSettings.targetLanguage
                });
            }
        } catch (error) {
            console.error('Error saving translation settings:', error);
        }
    }

    /**
     * Update translation UI with current language setting
     * Only updates if the select value doesn't already match (prevents resetting user selection)
     */
    updateUI() {
        if (this.elements.targetLanguageSelect) {
            const currentValue = this.elements.targetLanguageSelect.value;
            const targetValue = this.translationSettings.targetLanguage || 'none';
            // Only update if values don't match (prevents resetting during user interaction)
            if (currentValue !== targetValue) {
                this.elements.targetLanguageSelect.value = targetValue;
            }
        }
    }

    /**
     * Handle language selection change
     */
    async onLanguageChange() {
        const newLanguage = this.elements.targetLanguageSelect.value;
        const oldLanguage = this.translationSettings.targetLanguage;
        
        // Update internal state immediately to prevent race conditions
        this.translationSettings.targetLanguage = newLanguage;
        
        // If switching from a language to "none", restore originals
        if (newLanguage === 'none' && oldLanguage !== 'none') {
            this.restoreOriginalContent();
            this.updateStatus('Translation disabled, showing original content', 'info');
            await this.saveSettings();
            return;
        }
        
        // If switching to a language, ensure model is downloaded and translate content
        if (newLanguage !== 'none') {
            // Save settings first to persist the selection
            await this.saveSettings();
            
            // Prevent recursive translation calls
            if (this.isTranslatingDrafts) {
                console.log('Translation already in progress, skipping onLanguageChange translation');
                return;
            }
            
            try {
                // Check availability first (non-blocking check)
                const availabilityCheck = await chrome.runtime.sendMessage({
                    action: 'checkTranslationAvailability',
                    sourceLanguage: 'en',
                    targetLanguage: newLanguage
                });
                
                if (availabilityCheck && availabilityCheck.available) {
                    // Translation is available, proceed with translation
                    try {
                        // Try to translate existing content (only if not already translating)
                        if (!this.isTranslatingDrafts) {
                            await this.translateExistingContent();
                        }
                    } catch (translateError) {
                        console.error('Error translating content:', translateError);
                        const langName = this.getLanguageName(newLanguage);
                        this.updateStatus(`Translation selected: ${langName}. Content will be translated as it becomes available.`, 'info');
                    }
                } else if (availabilityCheck && availabilityCheck.needsDownload) {
                    // Model needs to download - show message but keep selection
                    const langName = this.getLanguageName(newLanguage);
                    this.updateStatus(`Downloading translation model for ${langName}... This may take a moment.`, 'loading');
                    // Try to translate anyway - it will trigger download
                    try {
                        if (!this.isTranslatingDrafts) {
                            await this.translateExistingContent();
                        }
                    } catch (translateError) {
                        // Download in progress - selection is kept, will translate when ready
                        console.log('Translation model downloading, will translate when ready');
                    }
                } else {
                    // Translation not available - show message but keep selection
                    const langName = this.getLanguageName(newLanguage);
                    this.updateStatus(`Translation to ${langName} may not be available. Please check Chrome AI settings.`, 'info');
                    // Don't reset selection - user may want to keep it for when it becomes available
                }
            } catch (error) {
                console.error('Error checking translation availability:', error);
                const langName = this.getLanguageName(newLanguage);
                this.updateStatus(`Translation to ${langName} selected. Checking availability...`, 'info');
                // Don't reset selection on error - might be temporary
                // Try to translate anyway in case it works
                try {
                    if (!this.isTranslatingDrafts) {
                        await this.translateExistingContent();
                    }
                } catch (translateError) {
                    // Silent fail - selection is kept
                    console.log('Translation not immediately available, but selection kept');
                }
            }
        }
    }

    /**
     * Restore original (untranslated) content
     */
    restoreOriginalContent() {
        // Restore summary
        if (this.translationSettings.originalSummary && this.elements.summary) {
            this.elements.summary.textContent = this.translationSettings.originalSummary;
        }
        
        // Restore key points
        if (this.translationSettings.originalKeyPoints && this.elements.keyPoints && this.displayKeyPointsCallback) {
            this.displayKeyPointsCallback(this.translationSettings.originalKeyPoints);
        }
        
        // Restore drafts
        if (this.currentDrafts && this.currentDrafts.length > 0 && this.translationSettings.originalDrafts.size > 0) {
            this.currentDrafts.forEach((draft, index) => {
                if (this.translationSettings.originalDrafts.has(index)) {
                    draft.body = this.translationSettings.originalDrafts.get(index);
                }
            });
            if (this.displayReplyDraftsCallback) {
                // Skip translation when restoring - already in original language
                this.displayReplyDraftsCallback(this.currentDrafts, true);
            }
        }
    }

    /**
     * Translate all existing content when language changes
     */
    async translateExistingContent() {
        const language = this.translationSettings.targetLanguage;
        if (language === 'none') return;
        
        let translatedCount = 0;
        
        // Translate summary if exists
        if (this.elements.summary && this.elements.summary.textContent.trim()) {
            try {
                await this.translateSummary();
                translatedCount++;
            } catch (error) {
                console.error('Error translating summary:', error);
            }
        }
        
        // Translate key points if exist
        if (this.translationSettings.originalKeyPoints && this.translationSettings.originalKeyPoints.length > 0) {
            try {
                await this.translateKeyPoints();
                translatedCount++;
            } catch (error) {
                console.error('Error translating key points:', error);
            }
        }
        
        // Translate drafts if exist
        if (this.currentDrafts && this.currentDrafts.length > 0) {
            try {
                await this.translateAllDrafts();
                translatedCount += this.currentDrafts.length;
                
                // Update display after translating drafts - but check if we're already in a display cycle
                // Only call callback if we're not already displaying (prevents infinite loops)
                if (this.displayReplyDraftsCallback && !this.isTranslatingDrafts) {
                    this.displayReplyDraftsCallback(this.currentDrafts, true);
                }
            } catch (error) {
                console.error('Error translating drafts:', error);
            }
        }
        
        if (translatedCount > 0) {
            const langName = this.getLanguageName(language);
            this.updateStatus(`✓ Content translated to ${langName}`, 'success');
        }
    }

    /**
     * Translate summary text
     */
    async translateSummary() {
        if (!this.elements.summary) return;
        
        const originalText = this.translationSettings.originalSummary || this.elements.summary.textContent;
        if (!originalText || !originalText.trim()) return;
        
        // Store original if not stored yet
        if (!this.translationSettings.originalSummary) {
            this.translationSettings.originalSummary = originalText;
        }
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'translateText',
                text: originalText,
                sourceLanguage: 'en',
                targetLanguage: targetLanguage
            });
            
            if (response && response.success) {
                this.elements.summary.textContent = response.translatedText;
            } else {
                console.warn('Translation unavailable:', response?.error);
                // Silently fail - translation is optional
            }
        } catch (error) {
            console.warn('Translation error:', error.message);
            // Silently fail - translation is optional
        }
    }

    /**
     * Translate key points
     */
    async translateKeyPoints() {
        const originalKeyPoints = this.translationSettings.originalKeyPoints;
        if (!originalKeyPoints || originalKeyPoints.length === 0) return;
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            const translatedPoints = [];
            
            for (const point of originalKeyPoints) {
                const response = await chrome.runtime.sendMessage({
                    action: 'translateText',
                    text: point,
                    sourceLanguage: 'en',
                    targetLanguage: targetLanguage
                });
                
                if (response && response.success) {
                    translatedPoints.push(response.translatedText);
                } else {
                    // If translation fails, keep original
                    translatedPoints.push(point);
                }
            }
            
            // Display translated key points
            if (this.displayKeyPointsCallback) {
                this.displayKeyPointsCallback(translatedPoints);
            }
        } catch (error) {
            console.error('Error translating key points:', error);
        }
    }

    /**
     * Translate all drafts
     * Note: Does not trigger re-render - caller should handle display update
     */
    async translateAllDrafts() {
        if (!this.currentDrafts || this.currentDrafts.length === 0) return;
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        // Prevent recursive translation calls
        if (this.isTranslatingDrafts) {
            console.log('Translation already in progress, skipping');
            return;
        }
        
        this.isTranslatingDrafts = true;
        
        try {
            for (let i = 0; i < this.currentDrafts.length; i++) {
                await this.translateDraft(i);
            }
            
            // Don't trigger re-render here - caller will handle it
            // This prevents infinite loops when called from displayReplyDrafts
        } catch (error) {
            console.error('Error translating drafts:', error);
        } finally {
            this.isTranslatingDrafts = false;
        }
    }

    /**
     * Translate a single draft
     * @param {number} index - Draft index
     */
    async translateDraft(index) {
        if (!this.currentDrafts || index < 0 || index >= this.currentDrafts.length) return;
        
        const draft = this.currentDrafts[index];
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        // Check if this draft is already translated (compare with original)
        const originalBody = this.translationSettings.originalDrafts.get(index);
        if (originalBody && draft.body === originalBody) {
            // Draft hasn't been translated yet, proceed
        } else if (!originalBody) {
            // Store original if not stored yet
            this.translationSettings.originalDrafts.set(index, draft.body);
        } else {
            // Draft appears to already be translated (body != originalBody)
            // Don't translate again to avoid loops
            console.log(`Draft ${index} already appears translated, skipping`);
            return;
        }
        
        // Use stored original for translation
        const textToTranslate = this.translationSettings.originalDrafts.get(index);
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'translateText',
                text: textToTranslate,
                sourceLanguage: 'en',
                targetLanguage: targetLanguage
            });
            
            if (response && response.success) {
                draft.body = response.translatedText;
            }
        } catch (error) {
            console.error(`Error translating draft ${index}:`, error);
        }
    }

    /**
     * Get human-readable language name
     * @param {string} code - Language code
     * @returns {string} Language name
     */
    getLanguageName(code) {
        const languages = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'it': 'Italian',
            'nl': 'Dutch',
            'pl': 'Polish',
            'tr': 'Turkish'
        };
        return languages[code] || code;
    }

    /**
     * Set current drafts reference
     */
    setCurrentDrafts(drafts) {
        this.currentDrafts = drafts;
    }

    /**
     * Set callbacks for UI updates
     */
    setCallbacks(displayKeyPoints, displayReplyDrafts) {
        this.displayKeyPointsCallback = displayKeyPoints;
        this.displayReplyDraftsCallback = displayReplyDrafts;
    }

    /**
     * Store original summary and key points
     */
    storeOriginals(summary, keyPoints) {
        if (!this.translationSettings.originalSummary) {
            this.translationSettings.originalSummary = summary;
        }
        if (!this.translationSettings.originalKeyPoints) {
            this.translationSettings.originalKeyPoints = [...keyPoints];
        }
    }

    /**
     * Handle model status updates
     */
    handleModelStatus(type, capabilities) {
        if (type === 'translator') {
            if (capabilities?.status === 'downloading') {
                const langName = this.getLanguageName(capabilities.targetLanguage);
                this.updateStatus(`Downloading translation model for ${langName}... This may take a moment.`, 'loading');
            } else if (capabilities?.status === 'complete') {
                const langName = this.getLanguageName(capabilities.targetLanguage);
                this.updateStatus(`✓ Translation model ready for ${langName}`, 'success');
            }
        }
    }

    /**
     * Reset translation state (clear stored originals)
     * Called when extraction state is reset
     */
    resetState() {
        this.translationSettings.originalSummary = null;
        this.translationSettings.originalKeyPoints = null;
        this.translationSettings.originalDrafts.clear();
        this.currentDrafts = null;
        // Keep targetLanguage setting - user's preference should persist
    }
}


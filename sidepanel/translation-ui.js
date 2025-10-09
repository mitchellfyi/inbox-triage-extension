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
                if (result.translationLanguage) {
                    this.translationSettings.targetLanguage = result.translationLanguage;
                }
            }
            this.updateUI();
        } catch (error) {
            console.error('Error loading translation settings:', error);
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
     */
    updateUI() {
        if (this.elements.targetLanguageSelect) {
            this.elements.targetLanguageSelect.value = this.translationSettings.targetLanguage || 'none';
        }
    }

    /**
     * Handle language selection change
     */
    async onLanguageChange() {
        const newLanguage = this.elements.targetLanguageSelect.value;
        const oldLanguage = this.translationSettings.targetLanguage;
        
        this.translationSettings.targetLanguage = newLanguage;
        await this.saveSettings();
        
        // If switching from a language to "none", restore originals
        if (newLanguage === 'none' && oldLanguage !== 'none') {
            this.restoreOriginalContent();
            this.updateStatus('Translation disabled, showing original content', 'info');
            return;
        }
        
        // If switching to a language, ensure model is downloaded and translate content
        if (newLanguage !== 'none') {
            // Check if translation model is available
            this.updateStatus(`Checking translation model for ${this.getLanguageName(newLanguage)}...`, 'loading');
            
            try {
                // This will trigger download if needed
                const response = await chrome.runtime.sendMessage({
                    action: 'translateText',
                    text: 'test', // Small test text to trigger model download
                    sourceLanguage: 'en',
                    targetLanguage: newLanguage
                });
                
                if (response && response.success) {
                    // Model is ready, translate existing content
                    await this.translateExistingContent();
                } else {
                    this.updateStatus(`Translation unavailable: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error('Error initializing translation:', error);
                this.updateStatus(`Translation error: ${error.message}`, 'error');
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
            this.updateStatus(`Translating summary to ${this.getLanguageName(targetLanguage)}...`, 'loading');
            
            const response = await chrome.runtime.sendMessage({
                action: 'translateText',
                text: originalText,
                sourceLanguage: 'en',
                targetLanguage: targetLanguage
            });
            
            if (response && response.success) {
                this.elements.summary.textContent = response.translatedText;
            } else {
                console.error('Translation failed:', response?.error);
                this.updateStatus(`Translation failed: ${response?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error translating summary:', error);
            this.updateStatus(`Translation error: ${error.message}`, 'error');
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
     */
    async translateAllDrafts() {
        if (!this.currentDrafts || this.currentDrafts.length === 0) return;
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            for (let i = 0; i < this.currentDrafts.length; i++) {
                await this.translateDraft(i);
            }
            
            // Refresh draft display (skip translation since we just translated)
            if (this.displayReplyDraftsCallback) {
                this.displayReplyDraftsCallback(this.currentDrafts, true);
            }
        } catch (error) {
            console.error('Error translating drafts:', error);
        }
    }

    /**
     * Translate a single draft
     * @param {number} index - Draft index
     */
    async translateDraft(index) {
        if (!this.currentDrafts || index < 0 || index >= this.currentDrafts.length) return;
        
        const draft = this.currentDrafts[index];
        const originalBody = this.translationSettings.originalDrafts.get(index) || draft.body;
        
        // Store original if not stored yet
        if (!this.translationSettings.originalDrafts.has(index)) {
            this.translationSettings.originalDrafts.set(index, draft.body);
        }
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'translateText',
                text: originalBody,
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
}


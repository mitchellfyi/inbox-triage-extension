/**
 * TranslationService - Handles multilingual translation using Chrome's Translator API
 * Reference: https://developer.chrome.com/docs/ai/translator-api
 */
export class TranslationService {
    constructor() {
        this.sessions = new Map();
        this.isAvailable = false;
    }

    async initialize() {
        if ('Translator' in self) {
            try {
                // Check if translation API exists and is functional
                // We'll check specific language pairs when translate() is called
                this.isAvailable = true;
                console.log('Translator API detected in browser');
                return true;
            } catch (error) {
                console.error('Error checking Translator availability:', error);
                this.isAvailable = false;
                return false;
            }
        }
        console.log('Translator API not available in this browser');
        this.isAvailable = false;
        return false;
    }

    /**
     * Check if translation is available for a language pair
     * @param {string} sourceLanguage - Source language code
     * @param {string} targetLanguage - Target language code
     * @returns {Promise<Object>} Availability status with details
     */
    async checkAvailability(sourceLanguage, targetLanguage) {
        if (!this.isAvailable) {
            await this.initialize();
        }
        
        if (!this.isAvailable) {
            return {
                available: false,
                state: 'no',
                reason: 'Translator API not available in this browser',
                needsDownload: false
            };
        }
        
        try {
            const availability = await Translator.availability({
                sourceLanguage,
                targetLanguage
            });
            
            console.log(`Translation availability for ${sourceLanguage}→${targetLanguage}: ${availability}`);
            
            // Handle different availability states
            const isAvailable = availability === 'readily' || 
                               availability === 'available' || 
                               availability === 'after-download' ||
                               availability === 'downloadable';
            
            const needsDownload = availability === 'after-download' || 
                                 availability === 'downloadable';
            
            let reason = null;
            if (!isAvailable) {
                if (availability === 'no' || availability === 'unavailable') {
                    reason = `Translation not supported for ${sourceLanguage}→${targetLanguage}. This language pair may not be available in your Chrome version.`;
                } else {
                    reason = `Translation availability unknown: ${availability}`;
                }
            }
            
            return {
                available: isAvailable,
                state: availability,
                needsDownload: needsDownload,
                reason: reason
            };
        } catch (error) {
            console.error('Error checking translation availability:', error);
            return {
                available: false,
                state: 'error',
                reason: error.message,
                needsDownload: false
            };
        }
    }

    async translate(text, sourceLanguage, targetLanguage) {
        // Check availability first
        const availabilityCheck = await this.checkAvailability(sourceLanguage, targetLanguage);
        
        // If not available and not downloadable, throw error
        if (!availabilityCheck.available && !availabilityCheck.needsDownload) {
            const reason = availabilityCheck.reason || `Translation not supported for ${sourceLanguage}→${targetLanguage}. This language pair may not be available in your Chrome version.`;
            throw new Error(reason);
        }
        
        // Warn if download is needed
        if (availabilityCheck.needsDownload) {
            console.log(`Translation model for ${sourceLanguage}→${targetLanguage} needs download. This may take a moment...`);
        }
        
        // If availability is 'downloadable', try to create translator anyway (it will trigger download)
        // The Translator API will handle the download automatically when we create the session

        const sessionKey = `${sourceLanguage}-${targetLanguage}`;
        
        // Create or reuse translation session
        if (!this.sessions.has(sessionKey)) {
            try {
                console.log(`Creating translator for ${sourceLanguage}→${targetLanguage}...`);
                const translator = await Translator.create({
                    sourceLanguage,
                    targetLanguage,
                    monitor(m) {
                        m.addEventListener('downloadprogress', (e) => {
                            console.log(`Translation model download progress: ${Math.round(e.loaded * 100)}%`);
                        });
                    }
                });
                console.log(`Translator created successfully for ${sourceLanguage}→${targetLanguage}`);
                this.sessions.set(sessionKey, translator);
            } catch (error) {
                console.error('Error creating translator:', error);
                throw new Error(`Failed to create translator: ${error.message}`);
            }
        }

        const translator = this.sessions.get(sessionKey);
        try {
            const result = await translator.translate(text);
            console.log(`Translation successful (${text.length} chars → ${result.length} chars)`);
            return result;
        } catch (error) {
            console.error('Translation error:', error);
            // Remove failed session
            this.sessions.delete(sessionKey);
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    cleanup() {
        for (const [key, translator] of this.sessions.entries()) {
            try {
                // Translators don't have a destroy method, just clear the map
                console.log(`Cleaning up translator session: ${key}`);
            } catch (error) {
                console.error(`Error cleaning up session ${key}:`, error);
            }
        }
        this.sessions.clear();
    }
}


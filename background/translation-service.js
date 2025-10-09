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
                // Check if translation is available for a common language pair
                const availability = await Translator.availability({
                    sourceLanguage: 'en',
                    targetLanguage: 'es'
                });
                this.isAvailable = availability === 'readily' || availability === 'available';
                console.log('Translator API availability:', availability);
                return this.isAvailable;
            } catch (error) {
                console.error('Error checking Translator availability:', error);
                return false;
            }
        }
        console.log('Translator API not available in this browser');
        return false;
    }

    async translate(text, sourceLanguage, targetLanguage) {
        if (!this.isAvailable) {
            const isAvailable = await this.initialize();
            if (!isAvailable) {
                throw new Error('Translator API not available');
            }
        }

        const sessionKey = `${sourceLanguage}-${targetLanguage}`;
        
        // Create or reuse translation session
        if (!this.sessions.has(sessionKey)) {
            try {
                const translator = await Translator.create({
                    sourceLanguage,
                    targetLanguage,
                    monitor(m) {
                        m.addEventListener('downloadprogress', (e) => {
                            console.log(`Translation model download: ${e.loaded * 100}%`);
                        });
                    }
                });
                this.sessions.set(sessionKey, translator);
            } catch (error) {
                console.error('Error creating translator:', error);
                throw new Error(`Failed to create translator: ${error.message}`);
            }
        }

        const translator = this.sessions.get(sessionKey);
        try {
            return await translator.translate(text);
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


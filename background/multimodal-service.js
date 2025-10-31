/**
 * Multimodal Analysis Service
 * Handles image analysis using Chrome's Prompt API with multimodal capabilities
 * Reference: https://developer.chrome.com/docs/ai/built-in
 */

export class MultimodalAnalysisService {
    constructor() {
        this.session = null;
        this.availability = null;
        this.supportsImages = false;
    }

    async initialize() {
        if ('ai' in self && 'languageModel' in self.ai) {
            try {
                // Check language model availability
                this.availability = await self.ai.languageModel.capabilities();
                
                console.log('Language Model capabilities:', this.availability);
                
                // Check if available and supports images
                if (this.availability.available === 'readily' || 
                    this.availability.available === 'available' || 
                    this.availability.available === 'after-download') {
                    // Note: Image support detection may vary by Chrome version
                    // For now, we'll attempt to use it if language model is available
                    this.supportsImages = true;
                    console.log('Multimodal capabilities: Image analysis may be available');
                    return true;
                }
            } catch (error) {
                console.error('Error checking multimodal capabilities:', error);
                return false;
            }
        }
        console.log('Language Model API not available');
        return false;
    }

    async analyzeImage(imageData, analysisType = 'general', context = '') {
        if (!this.supportsImages) {
            const isAvailable = await this.initialize();
            if (!isAvailable) {
                throw new Error('Multimodal image analysis not available');
            }
        }

        try {
            // Create session if not exists
            if (!this.session) {
                this.session = await self.ai.languageModel.create({
                    systemPrompt: this.getSystemPrompt(analysisType),
                    temperature: 0.3,
                    topK: 3
                });
            }

            const prompt = this.buildPrompt(analysisType, context);
            
            // Attempt multimodal prompt with image
            // Note: Image input support depends on Chrome version and flags
            let response;
            try {
                response = await this.session.prompt(prompt, { image: imageData });
            } catch (error) {
                // Fallback: try without explicit image parameter
                console.warn('Image parameter not supported, attempting text-only analysis:', error);
                response = await this.session.prompt(`${prompt}\n\nNote: Image analysis limited - describe based on context.`);
            }

            return this.parseResponse(response, analysisType);
        } catch (error) {
            console.error('Image analysis error:', error);
            throw new Error(`Image analysis failed: ${error.message}`);
        }
    }

    getSystemPrompt(analysisType) {
        const prompts = {
            general: 'You are an AI assistant that analyzes images in email attachments. Provide clear, concise descriptions focusing on business-relevant content.',
            ocr: 'You are an OCR system. Extract all visible text from images accurately. Maintain formatting and structure. If you cannot see the image clearly, indicate that.',
            chart: 'You are a data visualization analyst. Describe charts, graphs, and diagrams, including key data points, trends, and insights.',
            context: 'You are analyzing an image attachment in context of an email conversation. Explain how the image relates to the discussion.'
        };
        return prompts[analysisType] || prompts.general;
    }

    buildPrompt(analysisType, context) {
        const prompts = {
            general: 'Describe this image in 2-3 sentences. Focus on key elements that would be relevant in a business email context.',
            ocr: 'Extract all text visible in this image. Preserve formatting, line breaks, and structure. If no text is visible, respond with "No text detected".',
            chart: 'Analyze this chart or visualization. Describe: 1) Type of visualization, 2) Key data points, 3) Main trends or insights.',
            context: `This image was attached to an email about: ${context}\n\nDescribe the image and explain its relevance to the email discussion.`
        };
        return prompts[analysisType] || prompts.general;
    }

    parseResponse(response, analysisType) {
        return {
            type: analysisType,
            description: response.trim(),
            timestamp: Date.now()
        };
    }

    cleanup() {
        if (this.session) {
            this.session.destroy();
            this.session = null;
        }
    }
}


/**
 * Service Worker for Inbox Triage Extension
 * Handles AI processing, side panel management, and background tasks
 */

import { TranslationService } from './translation-service.js';
import { MultimodalAnalysisService } from './multimodal-service.js';

class InboxTriageServiceWorker {
    constructor() {
        this.aiCapabilities = {
            summarizer: null,
            promptApi: null,
            translator: null,
            multimodal: null,
            available: false
        };
        
        // Initialize services
        this.translationService = new TranslationService();
        this.multimodalService = new MultimodalAnalysisService();
        
        // Periodic check interval (30 seconds)
        this.modelCheckInterval = null;
        
        this.init();
    }
    
    async init() {
        console.log('Inbox Triage Service Worker initialized');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize AI capabilities
        await this.initializeAI();
        
        // Set up side panel
        this.setupSidePanel();
    }
    
    setupEventListeners() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstall(details);
        });
        
        // Handle messages from content scripts and side panel
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
        
        // Handle action button clicks (open side panel)
        chrome.action.onClicked.addListener((tab) => {
            this.openSidePanel(tab);
        });
    }
    
    async initializeAI() {
        try {
            // Check if AI capabilities are available using correct global constructors
            // Reference: https://developer.chrome.com/docs/ai/summarizer-api
            // Reference: https://developer.chrome.com/docs/ai/prompt-api
            
            // Check Summarizer API (available in Chrome 138+)
            // Reference: https://developer.chrome.com/docs/ai/summarizer-api
            // Example: const availability = await Summarizer.availability();
            if ('Summarizer' in self) {
                try {
                    const summarizerAvailability = await Summarizer.availability();
                    this.aiCapabilities.summarizer = {
                        available: summarizerAvailability
                    };
                    console.log('Summarizer API available:', summarizerAvailability);
                    
                    // Broadcast initial model status to side panel if it's open
                    this.broadcastModelStatus('summarizer', this.aiCapabilities.summarizer);
                } catch (error) {
                    console.error('Error checking Summarizer availability:', error);
                }
            } else {
                console.log('Summarizer API not available');
            }
            
            // Check Language Model API (Prompt API)
            // Available in Chrome 138+ for Extensions only
            // Reference: https://developer.chrome.com/docs/ai/prompt-api
            // Following same pattern as Summarizer API
            if ('LanguageModel' in self) {
                try {
                    const languageModelAvailability = await LanguageModel.availability();
                    this.aiCapabilities.promptApi = {
                        available: languageModelAvailability
                    };
                    console.log('Language Model API (Prompt API) available:', languageModelAvailability);
                    
                    // Broadcast initial model status to side panel if it's open
                    this.broadcastModelStatus('promptApi', this.aiCapabilities.promptApi);
                } catch (error) {
                    console.error('Error checking LanguageModel availability:', error);
                }
            } else {
                console.log('Language Model API (Prompt API) not available');
            }
            
            // Check Translator API
            // Available in Chrome 138+ for Extensions
            // Reference: https://developer.chrome.com/docs/ai/translator-api
            if ('Translator' in self) {
                try {
                    // Check availability for a common language pair (en -> es)
                    const translatorAvailability = await Translator.availability({
                        sourceLanguage: 'en',
                        targetLanguage: 'es'
                    });
                    this.aiCapabilities.translator = {
                        available: translatorAvailability
                    };
                    console.log('Translator API available:', translatorAvailability);
                    
                    // Initialize translation service
                    if (translatorAvailability === 'readily' || translatorAvailability === 'available') {
                        await this.translationService.initialize();
                    }
                    
                    // Broadcast initial model status to side panel if it's open
                    this.broadcastModelStatus('translator', this.aiCapabilities.translator);
                } catch (error) {
                    console.error('Error checking Translator availability:', error);
                }
            } else {
                console.log('Translator API not available');
            }
            
            this.aiCapabilities.available = !!(
                this.aiCapabilities.summarizer || 
                this.aiCapabilities.promptApi ||
                this.aiCapabilities.translator
            );
            
            // Log Chrome AI status for debugging
            if (this.aiCapabilities.available) {
                console.log('Chrome Built-in AI initialized successfully');
                console.log('Summarizer:', this.aiCapabilities.summarizer?.available || 'not available');
                console.log('Prompt API:', this.aiCapabilities.promptApi?.available || 'not available');
                console.log('Translator API:', this.aiCapabilities.translator?.available || 'not available');
            } else {
                console.warn('Chrome Built-in AI not available. Please ensure you are using Chrome 138+ with required flags enabled.');
                console.log('Required flags:');
                console.log('  - chrome://flags/#optimization-guide-on-device-model');
                console.log('  - chrome://flags/#prompt-api-for-gemini-nano');
                console.log('  - chrome://flags/#summarization-api-for-gemini-nano');
                console.log('  - chrome://flags/#translation-api');
                this.broadcastModelStatus('none', null);
            }
        } catch (error) {
            console.error('Error initializing AI capabilities:', error);
            this.broadcastModelStatus('error', { error: this.sanitizeErrorMessage(error.message) });
        }
        
        // Start periodic checks for model availability
        this.startPeriodicModelCheck();
    }
    
    /**
     * Start periodic checks for AI model availability
     * This helps detect when models finish downloading
     */
    startPeriodicModelCheck() {
        // Only check if we have at least one model that might become available
        const shouldCheck = (!this.aiCapabilities.summarizer || 
                            this.aiCapabilities.summarizer?.available !== 'readily') ||
                           (!this.aiCapabilities.promptApi || 
                            this.aiCapabilities.promptApi?.available !== 'readily');
        
        if (!shouldCheck) {
            return;
        }
        
        // Clear existing interval if any
        if (this.modelCheckInterval) {
            clearInterval(this.modelCheckInterval);
        }
        
        // Check every 30 seconds
        this.modelCheckInterval = setInterval(async () => {
            await this.recheckModelAvailability();
        }, 30000);
    }
    
    /**
     * Stop periodic model checking
     */
    stopPeriodicModelCheck() {
        if (this.modelCheckInterval) {
            clearInterval(this.modelCheckInterval);
            this.modelCheckInterval = null;
        }
    }
    
    /**
     * Recheck AI model availability (used for periodic updates)
     */
    async recheckModelAvailability() {
        try {
            let hasUpdates = false;
            
            // Check Summarizer API using global constructor (matching docs exactly)
            if ('Summarizer' in self) {
                try {
                    const newAvailability = await Summarizer.availability();
                    const newCapabilities = { available: newAvailability };
                    
                    // Check if status changed
                    if (!this.aiCapabilities.summarizer || 
                        this.aiCapabilities.summarizer.available !== newAvailability) {
                        
                        this.aiCapabilities.summarizer = newCapabilities;
                        this.broadcastModelStatus('summarizer', newCapabilities);
                        hasUpdates = true;
                    }
                } catch (error) {
                    console.error('Error rechecking Summarizer:', error);
                }
            }
            
            // Check Language Model API using global constructor (matching docs pattern)
            if ('LanguageModel' in self) {
                try {
                    const newAvailability = await LanguageModel.availability();
                    const newCapabilities = { available: newAvailability };
                    
                    // Check if status changed
                    if (!this.aiCapabilities.promptApi || 
                        this.aiCapabilities.promptApi.available !== newAvailability) {
                        
                        this.aiCapabilities.promptApi = newCapabilities;
                        this.broadcastModelStatus('promptApi', newCapabilities);
                        hasUpdates = true;
                    }
                } catch (error) {
                    console.error('Error rechecking LanguageModel:', error);
                }
            }
            
            // Update overall availability
            const newOverallAvailability = !!(
                this.aiCapabilities.summarizer || 
                this.aiCapabilities.promptApi
            );
            
            if (this.aiCapabilities.available !== newOverallAvailability) {
                this.aiCapabilities.available = newOverallAvailability;
                hasUpdates = true;
            }
            
            // Stop periodic checking if both models are ready
            if (this.aiCapabilities.summarizer?.available === 'readily' && 
                this.aiCapabilities.promptApi?.available === 'readily') {
                this.stopPeriodicModelCheck();
            }
            
            if (hasUpdates) {
                console.log('AI capabilities updated:', this.aiCapabilities);
            }
            
        } catch (error) {
            console.error('Error rechecking AI capabilities:', error);
            // Don't broadcast errors from periodic checks to avoid spam
        }
    }
    
    /**
     * Broadcast model status updates to the side panel
     * @param {string} type - Type of model (summarizer, promptApi, none, error)
     * @param {Object} capabilities - Capabilities object or null
     */
    broadcastModelStatus(type, capabilities) {
        try {
            chrome.runtime.sendMessage({
                action: 'modelStatus',
                type: type,
                capabilities: capabilities
            }).catch(error => {
                // Ignore errors if no listeners (side panel might not be open)
                console.debug('No model status listeners:', error.message);
            });
        } catch (error) {
            console.debug('Error broadcasting model status:', error);
        }
    }
    
    setupSidePanel() {
        // Configure side panel to open when extension icon is clicked
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
    
    handleInstall(details) {
        if (details.reason === 'install') {
            console.log('Extension installed');
            // Could show welcome page or instructions here
        } else if (details.reason === 'update') {
            console.log('Extension updated');
        }
    }
    
    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'generateSummary':
                    await this.generateSummary(message.thread, sendResponse, message.userSettings);
                    break;
                    
                case 'generateDrafts':
                    await this.generateReplyDrafts(message.thread, message.tone, message.guidance, sendResponse, message.userSettings);
                    break;
                    
                case 'processAttachment':
                    await this.processAttachment(message.attachment, sendResponse);
                    break;
                    
                case 'translateText':
                    await this.handleTranslation(message, sendResponse);
                    break;
                    
                case 'checkTranslationAvailability':
                    await this.handleTranslationAvailabilityCheck(message, sendResponse);
                    break;
                    
                case 'analyzeImage':
                    await this.handleImageAnalysis(message, sendResponse);
                    break;
                    
                case 'checkAIStatus':
                    sendResponse({ 
                        success: true, 
                        capabilities: this.aiCapabilities 
                    });
                    break;
                    
                case 'openSidePanel':
                    await this.openSidePanel(sender.tab);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ 
                        success: false, 
                        error: `Unknown action: ${message.action}` 
                    });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ 
                success: false, 
                error: this.sanitizeErrorMessage(error.message)
            });
        }
    }
    
    /**
     * Handle translation availability check requests
     * @param {Object} message - Availability check request message
     * @param {Function} sendResponse - Response callback
     */
    async handleTranslationAvailabilityCheck(message, sendResponse) {
        try {
            const { sourceLanguage, targetLanguage } = message;
            
            if (!sourceLanguage || !targetLanguage) {
                throw new Error('Source and target languages are required');
            }
            
            // Check availability using translation service
            const availabilityCheck = await this.translationService.checkAvailability(
                sourceLanguage,
                targetLanguage
            );
            
            sendResponse({
                success: true,
                available: availabilityCheck.available,
                state: availabilityCheck.state,
                needsDownload: availabilityCheck.needsDownload,
                reason: availabilityCheck.reason
            });
            
        } catch (error) {
            console.error('Error checking translation availability:', error);
            sendResponse({
                success: false,
                available: false,
                error: this.sanitizeErrorMessage(error.message)
            });
        }
    }
    
    /**
     * Handle translation requests from side panel
     * @param {Object} message - Translation request message
     * @param {Function} sendResponse - Response callback
     */
    async handleTranslation(message, sendResponse) {
        try {
            const { text, sourceLanguage, targetLanguage } = message;
            
            // Validate input
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text for translation');
            }
            
            if (!sourceLanguage || !targetLanguage) {
                throw new Error('Source and target languages are required');
            }
            
            // Check if Translator API is available
            if (!('Translator' in self)) {
                throw new Error('Translator API not available. Please ensure Chrome 138+ with translation features enabled.');
            }
            
            // Check availability for this language pair
            const availability = await Translator.availability({
                sourceLanguage,
                targetLanguage
            });
            
            console.log(`Translation availability for ${sourceLanguage} → ${targetLanguage}:`, availability);
            
            // If downloadable, inform user and proceed (download will start automatically)
            if (availability === 'downloadable' || availability === 'after-download') {
                this.broadcastModelStatus('translator', { 
                    status: 'downloading',
                    sourceLanguage,
                    targetLanguage
                });
            }
            
            // Perform translation (this will trigger download if needed)
            const translatedText = await this.translationService.translate(
                text,
                sourceLanguage,
                targetLanguage
            );
            
            // Broadcast completion status
            this.broadcastModelStatus('translator', { 
                status: 'complete',
                sourceLanguage,
                targetLanguage
            });
            
            sendResponse({
                success: true,
                translatedText,
                sourceLanguage,
                targetLanguage
            });
            
        } catch (error) {
            console.error('Translation error:', error);
            const sanitizedError = this.sanitizeErrorMessage(error.message);
            sendResponse({
                success: false,
                error: sanitizedError
            });
        }
    }
    
    /**
     * Handle image analysis requests from side panel
     * @param {Object} message - Image analysis request message
     * @param {Function} sendResponse - Response callback
     */
    async handleImageAnalysis(message, sendResponse) {
        try {
            const { imageUrl, analysisType = 'general', context = '' } = message;
            
            // Validate input
            if (!imageUrl || typeof imageUrl !== 'string') {
                throw new Error('Invalid image URL for analysis');
            }
            
            // Check if multimodal service is available
            const isAvailable = await this.multimodalService.initialize();
            if (!isAvailable) {
                throw new Error('Multimodal image analysis not available. Please ensure you are using a compatible Chrome version with AI features enabled.');
            }
            
            // Broadcast analysis starting
            this.broadcastModelStatus('multimodal', { 
                status: 'analyzing',
                analysisType
            });
            
            // Fetch image data
            let imageData;
            try {
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                
                // Convert to base64 for Prompt API
                imageData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (fetchError) {
                throw new Error(`Failed to fetch image: ${fetchError.message}`);
            }
            
            // Perform analysis
            const result = await this.multimodalService.analyzeImage(
                imageData,
                analysisType,
                context
            );
            
            // Broadcast completion status
            this.broadcastModelStatus('multimodal', { 
                status: 'complete',
                analysisType
            });
            
            sendResponse({
                success: true,
                analysis: result
            });
            
        } catch (error) {
            console.error('Image analysis error:', error);
            const sanitizedError = this.sanitizeErrorMessage(error.message);
            
            // Broadcast error status
            this.broadcastModelStatus('multimodal', { 
                status: 'error',
                error: sanitizedError
            });
            
            sendResponse({
                success: false,
                error: sanitizedError
            });
        }
    }
    
    async generateSummary(thread, sendResponse, userSettings = null) {
        try {
            const processingMode = userSettings?.processingMode || 'device-only';
            const useApiKey = userSettings?.useApiKey || false;
            let usedFallback = false;
            
            // If user has configured a custom API key, use it
            if (useApiKey && userSettings?.apiKey) {
                return await this.generateSummaryWithExternalAPI(thread, sendResponse, userSettings);
            }
            
            // Apply hybrid fallback decision rules as documented in SPEC.md
            const fallbackDecision = this.shouldUseCloudFallback('summarization', processingMode, thread);
            
            if (fallbackDecision.shouldFallback && processingMode === 'hybrid') {
                // Cloud fallback would be implemented here
                // For now, show privacy-preserving error message
                throw new Error(`${fallbackDecision.reason}. Cloud fallback is not implemented to maintain privacy guarantees.`);
            }
            
            // Check AI capabilities first
            if (!this.aiCapabilities.summarizer) {
                if (processingMode === 'hybrid') {
                    throw new Error('AI summarization is not available in this browser. Cloud fallback is not implemented to maintain privacy guarantees. Please use Chrome 120+ with AI features enabled.');
                } else {
                    throw new Error('AI summarization is not available in this browser. Please use Chrome 120+ with AI features enabled.');
                }
            }
            
            // Check if model is ready  
            const capabilities = this.aiCapabilities.summarizer;
            if (capabilities.available === 'after-download') {
                if (processingMode === 'hybrid') {
                    throw new Error('AI model is downloading. Cloud fallback is not implemented to maintain privacy guarantees. Please wait for download to complete.');
                } else {
                    throw new Error('AI model is downloading. This may take a few minutes. Please try again later.');
                }
            } else if (capabilities.available === 'no') {
                if (processingMode === 'hybrid') {
                    throw new Error('AI summarization is not available. Cloud fallback is not implemented to maintain privacy guarantees. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                } else {
                    throw new Error('AI summarization is not available. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                }
            }
            
            // Combine all message content and apply content size limits
            let fullText = this.combineThreadMessages(thread);
            
            // Apply content size limits as per SPEC.md (32,000 characters max)
            if (fullText && fullText.length > 32000) {
                console.warn('Content exceeds 32,000 character limit, truncating for on-device processing');
                fullText = this.truncateContentForProcessing(fullText, 32000);
            }
            
            if (!fullText || fullText.length < 50) {
                throw new Error('Not enough content to summarize');
            }
            
            // Broadcast progress update
            this.broadcastModelStatus('summarizing', { stage: 'generating_tldr' });
            
            // Create TL;DR summarizer session - matching docs exactly
            // Reference: https://developer.chrome.com/docs/ai/summarizer-api
            // Example from docs: const summarizer = await Summarizer.create({...})
            const tldrSummarizer = await Summarizer.create({
                type: 'tldr',
                format: 'plain-text',
                length: 'short',
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Summarizer download progress: ${e.loaded * 100}%`);
                    });
                }
            });
            
            // Generate TL;DR summary
            const summary = await tldrSummarizer.summarize(fullText);
            tldrSummarizer.destroy();
            
            // Broadcast progress update
            this.broadcastModelStatus('summarizing', { stage: 'generating_key_points' });
            
            let keyPoints = [];
            
            // Try to use key-points summarizer if available, fallback to manual extraction
            try {
                const keyPointsSummarizer = await Summarizer.create({
                    type: 'key-points',
                    format: 'plain-text',
                    length: 'short',
                    monitor(m) {
                        m.addEventListener('downloadprogress', (e) => {
                            console.log(`Key-points summarizer download: ${e.loaded * 100}%`);
                        });
                    }
                });
                
                const keyPointsText = await keyPointsSummarizer.summarize(fullText);
                keyPointsSummarizer.destroy();
                
                // Parse the key points text into an array
                keyPoints = this.parseKeyPointsFromText(keyPointsText);
                
            } catch (keyPointsError) {
                console.warn('Key-points summarizer not available, using fallback extraction:', keyPointsError.message);
                // Fallback to manual extraction
                keyPoints = this.extractKeyPoints(fullText, 5);
            }
            
            // Broadcast completion
            this.broadcastModelStatus('summarizing', { stage: 'completed' });
            
            sendResponse({
                success: true,
                summary: summary,
                keyPoints: keyPoints,
                usedFallback: usedFallback
            });
            
        } catch (error) {
            console.error('Summary generation error:', error);
            
            // Sanitize error message for user display
            const sanitizedError = this.sanitizeErrorMessage(error.message);
            
            this.broadcastModelStatus('summarizing', { 
                stage: 'error', 
                error: sanitizedError
            });
            
            sendResponse({
                success: false,
                error: sanitizedError
            });
        }
    }
    
    async generateReplyDrafts(thread, tone, guidance, sendResponse, userSettings = null) {
        try {
            const processingMode = userSettings?.processingMode || 'device-only';
            const useApiKey = userSettings?.useApiKey || false;
            let usedFallback = false;
            
            // If user has configured a custom API key, use it
            if (useApiKey && userSettings?.apiKey) {
                return await this.generateDraftsWithExternalAPI(thread, tone, guidance, sendResponse, userSettings);
            }
            
            // Apply hybrid fallback decision rules as documented in SPEC.md  
            const fallbackDecision = this.shouldUseCloudFallback('drafting', processingMode, thread);
            
            if (fallbackDecision.shouldFallback && processingMode === 'hybrid') {
                // Cloud fallback would be implemented here
                // For now, show privacy-preserving error message
                throw new Error(`${fallbackDecision.reason}. Cloud fallback is not implemented to maintain privacy guarantees.`);
            }
            
            if (!this.aiCapabilities.promptApi) {
                if (processingMode === 'hybrid') {
                    throw new Error('Language Model API not available. Cloud fallback is not implemented to maintain privacy guarantees. Please enable AI features in Chrome.');
                } else {
                    throw new Error('Language Model API not available. Please enable AI features in Chrome.');
                }
            }
            
            // Check if model is ready
            const capabilities = this.aiCapabilities.promptApi;
            if (capabilities.available === 'after-download') {
                if (processingMode === 'hybrid') {
                    throw new Error('AI model is downloading. Cloud fallback is not implemented to maintain privacy guarantees. Please wait for download to complete.');
                } else {
                    throw new Error('AI model is downloading. This may take a few minutes. Please try again later.');
                }
            } else if (capabilities.available === 'no') {
                if (processingMode === 'hybrid') {
                    throw new Error('Language Model API is not available. Cloud fallback is not implemented to maintain privacy guarantees. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                } else {
                    throw new Error('Language Model API is not available. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                }
            }
            
            const fullText = this.combineThreadMessages(thread);
            const subject = thread.subject || 'Re: Email Thread';
            
            if (!fullText || fullText.length < 20) {
                throw new Error('Not enough content to generate meaningful replies');
            }
            
            // Create language model session - matching docs pattern exactly
            // Following same pattern as Summarizer API
            // Reference: https://developer.chrome.com/docs/ai/prompt-api
            // Example: const session = await LanguageModel.create({...})
            const session = await LanguageModel.create({
                initialPrompts: [
                    { role: 'system', content: this.createSystemPrompt(tone) }
                ],
                temperature: 0.7,
                topK: 3
            });
            
            // Generate drafts using structured prompt
            const prompt = this.createReplyPrompt(fullText, subject, tone, guidance);
            const response = await session.prompt(prompt);
            
            // Clean up session immediately
            session.destroy();
            
            // Parse and validate JSON response
            let drafts;
            try {
                // Clean the response - remove any non-JSON text
                const cleanedResponse = this.cleanJsonResponse(response);
                drafts = JSON.parse(cleanedResponse);
                
                // Validate against schema
                const validation = this.validateDraftsSchema(drafts);
                if (!validation.isValid) {
                    console.warn('Schema validation failed:', validation.errors);
                    throw new Error(`Invalid response format: ${validation.errors.join(', ')}`);
                }
                
            } catch (parseError) {
                console.warn('JSON parsing failed, using fallback:', parseError.message);
                // Enhanced fallback with original response
                drafts = this.createFallbackDrafts(response, subject, tone);
            }
            
            // Validate and format drafts
            const formattedDrafts = this.validateAndFormatDrafts(drafts, subject);
            
            // Ensure we always have exactly 3 drafts
            if (formattedDrafts.length !== 3) {
                console.warn(`Expected 3 drafts, got ${formattedDrafts.length}, using fallback`);
                const fallback = this.createFallbackDrafts('', subject, tone);
                const fallbackFormatted = this.validateAndFormatDrafts(fallback, subject);
                
                sendResponse({
                    success: true,
                    drafts: fallbackFormatted,
                    warning: 'AI response was incomplete, using fallback drafts',
                    usedFallback: usedFallback
                });
                return;
            }
            
            sendResponse({
                success: true,
                drafts: formattedDrafts,
                usedFallback: usedFallback
            });
            
        } catch (error) {
            console.error('Draft generation error:', error);
            
            // Sanitize error message for user display
            const sanitizedError = this.sanitizeErrorMessage(error.message);
            
            sendResponse({
                success: false,
                error: sanitizedError
            });
        }
    }
    
    /**
     * Process a single attachment for AI analysis
     * @param {Object} attachment - Attachment metadata and content
     * @param {Function} sendResponse - Response callback
     */
    async processAttachment(attachment, sendResponse) {
        try {
            // Check AI capabilities first
            if (!this.aiCapabilities.summarizer && !this.aiCapabilities.promptApi) {
                throw new Error('AI processing is not available in this browser. Please use Chrome 120+ with AI features enabled.');
            }
            
            let extractedText = '';
            let processedContent = '';
            
            // For now, implement basic attachment processing based on type
            // This is a simplified version that will be enhanced with actual file parsing
            switch (attachment.type) {
                case 'image':
                    processedContent = await this.processImageAttachment(attachment);
                    break;
                    
                case 'pdf':
                case 'docx':
                case 'xlsx':
                    processedContent = await this.processDocumentAttachment(attachment);
                    break;
                    
                default:
                    throw new Error(`Unsupported attachment type: ${attachment.type}`);
            }
            
            // Generate summary using Summarizer API
            let summary = '';
            if (processedContent && this.aiCapabilities.summarizer?.available === 'readily') {
                summary = await this.generateAttachmentSummary(processedContent, attachment);
            } else {
                summary = `${attachment.name} (${attachment.type.toUpperCase()}) - Local processing capabilities coming soon.`;
            }
            
            sendResponse({
                success: true,
                attachment: {
                    ...attachment,
                    extractedContent: processedContent,
                    summary: summary,
                    processed: true
                }
            });
            
        } catch (error) {
            console.error('Attachment processing error:', error);
            
            const sanitizedError = this.sanitizeErrorMessage(error.message);
            sendResponse({
                success: false,
                error: sanitizedError,
                attachment: {
                    ...attachment,
                    summary: `Error processing ${attachment.name}: ${sanitizedError}`,
                    processed: false
                }
            });
        }
    }
    
    /**
     * Process image attachment using multimodal Prompt API
     * @param {Object} attachment - Image attachment
     * @returns {string} Extracted description
     */
    async processImageAttachment(attachment) {
        try {
            // Check if multimodal Prompt API is available
            if (!this.aiCapabilities.promptApi || this.aiCapabilities.promptApi.available !== 'readily') {
                return `Image analysis unavailable - AI model not ready`;
            }
            
            // For now, return a placeholder since we need to implement actual image fetching
            // In the full implementation, we would:
            // 1. Fetch the image blob from attachment.downloadUrl
            // 2. Convert to base64 or appropriate format
            // 3. Use the multimodal Prompt API to analyze the image
            
            return `Image attachment: ${attachment.name}. Full image analysis capabilities coming soon with multimodal AI integration.`;
            
        } catch (error) {
            console.error('Image processing error:', error);
            return `Error analyzing image: ${error.message}`;
        }
    }
    
    /**
     * Process document attachment (PDF, DOCX, XLSX)
     * @param {Object} attachment - Document attachment  
     * @returns {string} Extracted text content
     */
    async processDocumentAttachment(attachment) {
        try {
            // For now, return a placeholder since we need to implement file parsing libraries
            // In the full implementation, we would:
            // 1. Fetch the document blob from attachment.downloadUrl  
            // 2. Use appropriate library (PDF.js, mammoth.js, SheetJS) to extract text
            // 3. Return the extracted text content
            
            const typeMap = {
                'pdf': 'PDF text extraction',
                'docx': 'Word document text extraction', 
                'xlsx': 'Spreadsheet data extraction'
            };
            
            const description = typeMap[attachment.type] || 'Document processing';
            return `${description} for ${attachment.name}. Full document parsing capabilities coming soon with integrated file processing libraries.`;
            
        } catch (error) {
            console.error('Document processing error:', error);
            return `Error processing document: ${error.message}`;
        }
    }
    
    /**
     * Generate summary of attachment content using Summarizer API
     * @param {string} content - Extracted content from attachment
     * @param {Object} attachment - Attachment metadata
     * @returns {string} Generated summary
     */
    async generateAttachmentSummary(content, attachment) {
        try {
            if (!content || content.length < 50) {
                return `${attachment.name} - Content too short to summarize effectively`;
            }
            
            // Create summarizer session for attachment content
            const summarizer = await self.ai.summarizer.create({
                type: 'tl;dr',
                format: 'plain-text',
                length: 'short'
            });
            
            // Generate summary with context about the file type
            const contextualContent = `File: ${attachment.name} (${attachment.type.toUpperCase()})\n\n${content}`;
            const summary = await summarizer.summarize(contextualContent);
            
            // Clean up session
            summarizer.destroy();
            
            return summary;
            
        } catch (error) {
            console.error('Attachment summary generation error:', error);
            return `${attachment.name} - Error generating summary: ${error.message}`;
        }
    }
    
    /**
     * Clean JSON response by removing non-JSON text
     * @param {string} response - Raw response from AI
     * @returns {string} Cleaned JSON string
     */
    cleanJsonResponse(response) {
        // Find JSON object boundaries
        const startIndex = response.indexOf('{');
        const lastIndex = response.lastIndexOf('}');
        
        if (startIndex === -1 || lastIndex === -1) {
            throw new Error('No JSON object found in response');
        }
        
        return response.substring(startIndex, lastIndex + 1);
    }
    
    combineThreadMessages(thread) {
        if (!thread.messages || thread.messages.length === 0) {
            return '';
        }
        
        return thread.messages
            .map(msg => `From: ${msg.sender?.name || 'Unknown'}\n${msg.content}`)
            .join('\n\n---\n\n');
    }
    
    /**
     * Parse key points text returned by the AI into an array
     * @param {string} keyPointsText - Text containing key points from AI
     * @returns {Array<string>} Array of key points
     */
    parseKeyPointsFromText(keyPointsText) {
        if (!keyPointsText || typeof keyPointsText !== 'string') {
            return [];
        }
        
        // Split by common delimiters and clean up
        const points = keyPointsText
            .split(/[\n\r•\-\*]\s*/)
            .map(point => point.trim())
            .filter(point => point.length > 10 && !point.match(/^(\d+\.|\•|\-|\*)/))
            .slice(0, 5); // Limit to 5 key points
        
        return points.length > 0 ? points : [keyPointsText.trim()];
    }
    
    extractKeyPoints(text, maxPoints = 5) {
        // Simple key point extraction (could be enhanced with AI)
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const keyPoints = [];
        
        // Look for sentences with key indicators
        const indicators = ['important', 'need', 'require', 'must', 'should', 'deadline', 'urgent'];
        
        sentences.forEach(sentence => {
            if (keyPoints.length >= maxPoints) return;
            
            const lowerSentence = sentence.toLowerCase();
            if (indicators.some(indicator => lowerSentence.includes(indicator))) {
                keyPoints.push(sentence.trim());
            }
        });
        
        // Fill remaining slots with longest sentences
        if (keyPoints.length < maxPoints) {
            const remainingSentences = sentences
                .filter(s => !keyPoints.includes(s.trim()))
                .sort((a, b) => b.length - a.length);
            
            const needed = maxPoints - keyPoints.length;
            keyPoints.push(...remainingSentences.slice(0, needed).map(s => s.trim()));
        }
        
        return keyPoints.filter(point => point.length > 0);
    }
    
    /**
     * JSON Schema for reply drafts to ensure structured output
     * @returns {Object} JSON schema object for validation
     */
    getReplyDraftsSchema() {
        return {
            type: "object",
            required: ["drafts"],
            properties: {
                drafts: {
                    type: "array",
                    minItems: 3,
                    maxItems: 3,
                    items: {
                        type: "object",
                        required: ["type", "subject", "body"],
                        properties: {
                            type: {
                                type: "string",
                                minLength: 1,
                                maxLength: 50
                            },
                            subject: {
                                type: "string",
                                minLength: 1,
                                maxLength: 100
                            },
                            body: {
                                type: "string",
                                minLength: 10,
                                maxLength: 1500
                            }
                        },
                        additionalProperties: false
                    }
                }
            },
            additionalProperties: false
        };
    }
    
    /**
     * Validate reply drafts against JSON schema
     * @param {Object} drafts - The drafts object to validate
     * @returns {Object} Validation result with isValid and errors
     */
    validateDraftsSchema(drafts) {
        const schema = this.getReplyDraftsSchema();
        const errors = [];
        
        try {
            // Basic structure validation
            if (!drafts || typeof drafts !== 'object') {
                errors.push('Response must be a valid JSON object');
                return { isValid: false, errors };
            }
            
            if (!drafts.drafts || !Array.isArray(drafts.drafts)) {
                errors.push('Response must contain a "drafts" array');
                return { isValid: false, errors };
            }
            
            if (drafts.drafts.length !== 3) {
                errors.push(`Must contain exactly 3 drafts, found ${drafts.drafts.length}`);
                return { isValid: false, errors };
            }
            
            // Validate each draft
            drafts.drafts.forEach((draft, index) => {
                if (!draft || typeof draft !== 'object') {
                    errors.push(`Draft ${index + 1} must be an object`);
                    return;
                }
                
                // Check required fields
                const requiredFields = ['type', 'subject', 'body'];
                requiredFields.forEach(field => {
                    if (!draft[field] || typeof draft[field] !== 'string') {
                        errors.push(`Draft ${index + 1} missing or invalid "${field}" field`);
                    }
                });
                
                // Check field length constraints
                if (draft.type && draft.type.length > 50) {
                    errors.push(`Draft ${index + 1} type too long (max 50 chars)`);
                }
                if (draft.subject && draft.subject.length > 100) {
                    errors.push(`Draft ${index + 1} subject too long (max 100 chars)`);
                }
                if (draft.body && draft.body.length > 1500) {
                    errors.push(`Draft ${index + 1} body too long (max 1500 chars)`);
                }
                if (draft.body && draft.body.length < 10) {
                    errors.push(`Draft ${index + 1} body too short (min 10 chars)`);
                }
            });
            
            return { isValid: errors.length === 0, errors };
            
        } catch (error) {
            errors.push(`Validation error: ${error.message}`);
            return { isValid: false, errors };
        }
    }
    
    /**
     * Create system prompt with JSON schema constraints
     * @param {string} tone - The tone to use for replies
     * @returns {string} System prompt with schema requirements
     */
    createSystemPrompt(tone) {
        return `You are an AI assistant helping to draft email replies. Generate responses that are:
- ${tone} in tone
- Professional and appropriate for business communication
- Concise but complete
- Properly structured with subject and body
- Return responses as valid JSON with exactly 3 drafts

CRITICAL: You must respond with ONLY valid JSON in the exact format below. Do not include any other text or explanations:
{
  "drafts": [
    {"type": "string", "subject": "string (max 100 chars)", "body": "string (max 500 chars)"},
    {"type": "string", "subject": "string (max 100 chars)", "body": "string (max 1000 chars)"},
    {"type": "string", "subject": "string (max 100 chars)", "body": "string (max 1500 chars)"}
  ]
}

Each draft must have exactly these three fields: type, subject, body. Generate exactly 3 drafts.`;
    }
    
    /**
     * Create a structured prompt for reply generation with JSON schema specification
     * @param {string} threadText - The email thread content
     * @param {string} originalSubject - The original email subject
     * @param {string} tone - The tone to use for replies
     * @returns {string} Structured prompt with JSON requirements
     */
    createReplyPrompt(threadText, originalSubject, tone, guidance = '') {
        const guidanceSection = guidance ? `\nUSER GUIDANCE:\n${guidance}\n` : '';
        
        return `Based on this email thread, generate 3 different reply drafts in ${tone} tone.

THREAD:
${threadText}

ORIGINAL SUBJECT: ${originalSubject}${guidanceSection}

Generate exactly 3 reply drafts with these characteristics:
1. SHORT RESPONSE: Quick acknowledgment (1-2 sentences, max 500 chars body)
2. MEDIUM RESPONSE: Detailed with clarifications (2-3 paragraphs, max 1000 chars body) 
3. COMPREHENSIVE RESPONSE: Complete with next steps (3-4 paragraphs, max 1500 chars body)
${guidance ? '\nIncorporate the user guidance above into all three drafts where relevant.\n' : ''}
Respond with ONLY the following JSON format (no other text):
{
  "drafts": [
    {
      "type": "Quick Response",
      "subject": "Re: ${originalSubject}",
      "body": "Brief acknowledgment and next steps in ${tone} tone"
    },
    {
      "type": "Detailed Response", 
      "subject": "Re: ${originalSubject}",
      "body": "Comprehensive response with clarifications in ${tone} tone"
    },
    {
      "type": "Action-Oriented Response",
      "subject": "Re: ${originalSubject}", 
      "body": "Complete response with specific next steps in ${tone} tone"
    }
  ]
}`;
    }
    
    /**
     * Create fallback drafts if AI response parsing fails
     * @param {string} response - The failed AI response (for context)
     * @param {string} subject - The original email subject
     * @param {string} tone - The selected tone
     * @returns {Object} Fallback drafts object
     */
    createFallbackDrafts(response, subject, tone) {
        const toneAdjustments = {
            neutral: {
                quick: 'Thank you for your email. I will review this and get back to you soon.',
                medium: 'I received your email and understand your request. Let me look into this and provide you with a detailed response by end of day.',
                detailed: 'Thank you for reaching out. I will review the information you provided and schedule a follow-up meeting to discuss next steps. I will send you a meeting invite within the next 24 hours.'
            },
            friendly: {
                quick: 'Thanks so much for your email! I\'ll take a look and get back to you shortly.',
                medium: 'Hi there! I got your email and really appreciate you reaching out. Let me dive into this and I\'ll send you a thoughtful response later today.',
                detailed: 'Hi! Thanks for your message - I really appreciate you taking the time to reach out. I want to give this the attention it deserves, so I\'ll review everything carefully and set up some time for us to chat about next steps. Expect a meeting invite from me soon!'
            },
            assertive: {
                quick: 'I have received your email and will respond with the requested information shortly.',
                medium: 'I understand your request and will provide a comprehensive response. I will review the details and deliver my analysis by the end of the business day.',
                detailed: 'I have carefully noted your requirements and will address each point systematically. I will conduct a thorough review of the information provided and schedule a meeting to present my findings and recommended action items. You can expect my detailed response within 24 hours.'
            },
            formal: {
                quick: 'Thank you for your correspondence. I shall review your request and respond accordingly.',
                medium: 'I acknowledge receipt of your message and appreciate you bringing this matter to my attention. I will conduct a thorough review of the information provided and respond with a comprehensive analysis by close of business today.',
                detailed: 'Dear colleague, I am writing to acknowledge receipt of your correspondence. I appreciate you taking the time to outline your requirements in detail. I shall conduct a comprehensive review of all materials provided and prepare a thorough response addressing each of your points. I will schedule a follow-up meeting to discuss the matter further and present my recommendations. Please expect my detailed response within one business day.'
            }
        };
        
        const selectedTone = toneAdjustments[tone] || toneAdjustments.neutral;
        
        return {
            drafts: [
                {
                    type: 'Quick Response',
                    subject: `Re: ${subject}`,
                    body: selectedTone.quick
                },
                {
                    type: 'Acknowledgment',
                    subject: `Re: ${subject}`,
                    body: selectedTone.medium
                },
                {
                    type: 'Next Steps',
                    subject: `Re: ${subject}`,
                    body: selectedTone.detailed
                }
            ]
        };
    }
    
    /**
     * Validate and format drafts with enhanced error checking
     * @param {Object} drafts - The drafts object to validate and format
     * @param {string} originalSubject - The original email subject for fallback
     * @returns {Array} Array of validated and formatted draft objects
     */
    validateAndFormatDrafts(drafts, originalSubject) {
        const draftArray = drafts.drafts || drafts || [];
        
        if (!Array.isArray(draftArray)) {
            console.warn('Drafts is not an array, creating empty array');
            return [];
        }
        
        return draftArray.slice(0, 3).map((draft, index) => {
            // Ensure draft is an object
            if (!draft || typeof draft !== 'object') {
                console.warn(`Draft ${index + 1} is not an object, using defaults`);
                draft = {};
            }
            
            // Sanitize and validate each field
            const type = this.sanitizeString(draft.type, 50) || `Draft ${index + 1}`;
            const subject = this.sanitizeString(draft.subject, 100) || `Re: ${originalSubject}`;
            const body = this.sanitizeString(draft.body, 1500) || 'No content generated.';
            
            return {
                type,
                subject,
                body
            };
        });
    }
    
    /**
     * Sanitize and truncate string fields
     * @param {*} value - The value to sanitize
     * @param {number} maxLength - Maximum allowed length
     * @returns {string|null} Sanitized string or null if invalid
     */
    sanitizeString(value, maxLength) {
        if (typeof value !== 'string') {
            return null;
        }
        
        // Remove any potentially harmful content
        const sanitized = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/javascript:/gi, '') // Remove javascript: URLs
            .trim();
        
        if (sanitized.length === 0) {
            return null;
        }
        
        // Truncate if too long
        return sanitized.length > maxLength 
            ? sanitized.substring(0, maxLength - 3) + '...' 
            : sanitized;
    }
    
    /**
     * Sanitize error messages to prevent technical details from reaching users
     * @param {string} errorMessage - Raw error message
     * @returns {string} User-friendly error message
     */
    sanitizeErrorMessage(errorMessage) {
        if (!errorMessage || typeof errorMessage !== 'string') {
            return 'An unexpected error occurred. Please try again.';
        }
        
        // Define patterns for technical errors and their user-friendly alternatives
        const errorMappings = [
            {
                patterns: [/stack trace/i, /error.*stack/i, /at\s+\w+\s*\(/, /\n\s*at\s+/],
                message: 'An unexpected error occurred. Please try again.'
            },
            {
                patterns: [/language model.*not available/i, /prompt api.*not available/i],
                message: 'AI reply drafting is not available. Please enable Chrome AI features or try using Chrome 120+.'
            },
            {
                patterns: [/summarizer.*not available/i, /summarization.*not available/i],
                message: 'AI summarization is not available. Please enable Chrome AI features or try using Chrome 120+.'
            },
            {
                patterns: [/downloading/i, /after.*download/i],
                message: 'AI models are still downloading. This can take several minutes. Please try again shortly.'
            },
            {
                patterns: [/session.*failed/i, /session.*error/i],
                message: 'AI processing session failed. Please try again.'
            },
            {
                patterns: [/invalid.*json/i, /json.*parse/i, /unexpected token/i],
                message: 'AI response was malformed. Please try regenerating.'
            },
            {
                patterns: [/network.*error/i, /connection.*failed/i, /timeout/i],
                message: 'Connection error occurred. Please check your internet connection and try again.'
            },
            {
                patterns: [/permission.*denied/i, /not.*authorized/i],
                message: 'Permission denied. Please ensure Chrome AI features are enabled.'
            }
        ];
        
        // Check for known error patterns
        for (const mapping of errorMappings) {
            if (mapping.patterns.some(pattern => pattern.test(errorMessage))) {
                return mapping.message;
            }
        }
        
        // For unknown errors, provide a generic message but preserve some context if it's safe
        const safeMessage = errorMessage.replace(/\s*at\s+.*$/gm, '') // Remove stack traces
                                      .split('\n')[0] // Take only first line
                                      .replace(/^(TypeError|Error|ReferenceError|SyntaxError):\s*/i, '') // Remove error types
                                      .trim();
        
        // If the cleaned message is too short or technical, use generic message
        if (safeMessage.length < 10 || /^[A-Z_]+$/i.test(safeMessage)) {
            return 'An unexpected error occurred. Please try again.';
        }
        
        // Return the cleaned message if it seems user-friendly
        return safeMessage.charAt(0).toUpperCase() + safeMessage.slice(1);
    }
    
    /**
     * Determine if cloud fallback should be used based on documented decision rules
     * Reference: SPEC.md - Hybrid Fallback Decision Rules
     * @param {string} operation - 'summarization' or 'drafting'
     * @param {string} processingMode - 'device-only' or 'hybrid'
     * @param {Object} thread - Email thread data
     * @returns {Object} Decision result with shouldFallback flag and reason
     */
    shouldUseCloudFallback(operation, processingMode, thread = null) {
        // Never fallback if not in hybrid mode
        if (processingMode !== 'hybrid') {
            return { shouldFallback: false, reason: 'Device-only mode selected' };
        }
        
        // Check model availability - as per SPEC.md requirements
        const capabilities = operation === 'summarization' ? 
            this.aiCapabilities.summarizer : this.aiCapabilities.promptApi;
        
        if (!capabilities) {
            return { 
                shouldFallback: true, 
                reason: `${operation} API not available in this browser`,
                trigger: 'model_unavailable'
            };
        }
        
        if (capabilities.available === 'no') {
            return { 
                shouldFallback: true, 
                reason: `${operation} model is not available`,
                trigger: 'model_unavailable'
            };
        }
        
        // Don't fallback during download - wait for completion as per SPEC.md
        if (capabilities.available === 'after-download') {
            return { 
                shouldFallback: false, 
                reason: 'Model is downloading, waiting for completion',
                trigger: 'model_downloading'
            };
        }
        
        // Check content size limits if thread provided
        if (thread) {
            const fullText = this.combineThreadMessages(thread);
            
            // Content size limit check (32,000 characters as per SPEC.md)
            if (fullText && fullText.length > 32000) {
                return { 
                    shouldFallback: true, 
                    reason: 'Content exceeds on-device processing limits',
                    trigger: 'content_size_limit',
                    contentLength: fullText.length
                };
            }
            
            // Token estimation (rough approximation: 1 token ≈ 4 characters)
            const estimatedTokens = Math.ceil((fullText?.length || 0) / 4);
            const tokenLimit = operation === 'summarization' ? 4000 : 8000;
            
            if (estimatedTokens > tokenLimit) {
                return { 
                    shouldFallback: true, 
                    reason: `Content exceeds ${operation} token limits`,
                    trigger: 'token_limit',
                    estimatedTokens,
                    tokenLimit
                };
            }
        }
        
        // If all checks pass, use local processing
        return { shouldFallback: false, reason: 'Local processing available' };
    }
    
    /**
     * Truncate content for local processing while preserving essential information
     * @param {string} content - Original content
     * @param {number} maxLength - Maximum character length  
     * @returns {string} Truncated content
     */
    truncateContentForProcessing(content, maxLength) {
        if (!content || content.length <= maxLength) return content;
        
        // Try to truncate at sentence boundaries to preserve coherence
        const sentences = content.split(/[.!?]+/);
        let truncated = '';
        let totalLength = 0;
        
        for (const sentence of sentences) {
            const sentenceWithPunct = sentence.trim() + '.';
            if (totalLength + sentenceWithPunct.length > maxLength - 100) {
                // Leave some buffer for essential information marker
                break;
            }
            truncated += sentenceWithPunct + ' ';
            totalLength += sentenceWithPunct.length + 1;
        }
        
        // Add truncation indicator
        truncated += '\n\n[Content truncated for processing...]';
        
        return truncated.trim();
    }
    
    /**
     * Prepare content for cloud processing (text only, no attachments)
     * This ensures only extracted text is sent, never raw files or images
     * @param {Object} thread - Email thread data
     * @returns {Object} Sanitized content for cloud processing
     */
    prepareContentForCloudProcessing(thread) {
        // Extract only text content, never attachments or images
        const textContent = this.combineThreadMessages(thread);
        
        return {
            content: textContent,
            metadata: {
                threadLength: thread.messages?.length || 0,
                subject: thread.subject || '',
                // Never include attachment content or personal identifiers
                hasAttachments: (thread.attachments?.length || 0) > 0,
                attachmentCount: thread.attachments?.length || 0
            }
        };
    }
    
    /**
     * Generate summary using external API (OpenAI, Anthropic, Google)
     * @param {Object} thread - Email thread data
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings including API key
     */
    async generateSummaryWithExternalAPI(thread, sendResponse, userSettings) {
        try {
            const fullText = this.combineThreadMessages(thread);
            
            if (!fullText || fullText.length < 50) {
                throw new Error('Not enough content to summarize');
            }
            
            const provider = userSettings.apiProvider || 'openai';
            const apiKey = userSettings.apiKey;
            
            let summary = '';
            let keyPoints = [];
            
            // Call appropriate API based on provider
            switch (provider) {
                case 'openai':
                    const openaiResult = await this.callOpenAISummarize(fullText, apiKey);
                    summary = openaiResult.summary;
                    keyPoints = openaiResult.keyPoints;
                    break;
                    
                case 'anthropic':
                    const claudeResult = await this.callAnthropicSummarize(fullText, apiKey);
                    summary = claudeResult.summary;
                    keyPoints = claudeResult.keyPoints;
                    break;
                    
                case 'google':
                    const geminiResult = await this.callGoogleAISummarize(fullText, apiKey);
                    summary = geminiResult.summary;
                    keyPoints = geminiResult.keyPoints;
                    break;
                    
                default:
                    throw new Error(`Unsupported API provider: ${provider}`);
            }
            
            sendResponse({
                success: true,
                summary: summary,
                keyPoints: keyPoints,
                usedFallback: true // Indicate external API was used
            });
            
        } catch (error) {
            console.error('External API summary generation error:', error);
            const sanitizedError = this.sanitizeErrorMessage(error.message);
            sendResponse({
                success: false,
                error: `External API error: ${sanitizedError}`
            });
        }
    }
    
    /**
     * Generate drafts using external API (OpenAI, Anthropic, Google)
     * @param {Object} thread - Email thread data
     * @param {string} tone - Selected tone
     * @param {string} guidance - User guidance
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings including API key
     */
    async generateDraftsWithExternalAPI(thread, tone, guidance, sendResponse, userSettings) {
        try {
            const fullText = this.combineThreadMessages(thread);
            const subject = thread.subject || 'Re: Email Thread';
            
            if (!fullText || fullText.length < 20) {
                throw new Error('Not enough content to generate meaningful replies');
            }
            
            const provider = userSettings.apiProvider || 'openai';
            const apiKey = userSettings.apiKey;
            
            let drafts = [];
            
            // Call appropriate API based on provider
            switch (provider) {
                case 'openai':
                    drafts = await this.callOpenAIDrafts(fullText, subject, tone, guidance, apiKey);
                    break;
                    
                case 'anthropic':
                    drafts = await this.callAnthropicDrafts(fullText, subject, tone, guidance, apiKey);
                    break;
                    
                case 'google':
                    drafts = await this.callGoogleAIDrafts(fullText, subject, tone, guidance, apiKey);
                    break;
                    
                default:
                    throw new Error(`Unsupported API provider: ${provider}`);
            }
            
            // Validate and format drafts
            const formattedDrafts = this.validateAndFormatDrafts({ drafts }, subject);
            
            if (formattedDrafts.length !== 3) {
                console.warn(`Expected 3 drafts, got ${formattedDrafts.length}`);
                const fallback = this.createFallbackDrafts('', subject, tone);
                const fallbackFormatted = this.validateAndFormatDrafts(fallback, subject);
                
                sendResponse({
                    success: true,
                    drafts: fallbackFormatted,
                    warning: 'External API response was incomplete, using fallback drafts',
                    usedFallback: true
                });
                return;
            }
            
            sendResponse({
                success: true,
                drafts: formattedDrafts,
                usedFallback: true // Indicate external API was used
            });
            
        } catch (error) {
            console.error('External API draft generation error:', error);
            const sanitizedError = this.sanitizeErrorMessage(error.message);
            sendResponse({
                success: false,
                error: `External API error: ${sanitizedError}`
            });
        }
    }
    
    /**
     * Call OpenAI API for summarization
     * @param {string} text - Text to summarize
     * @param {string} apiKey - OpenAI API key
     * @returns {Object} Summary and key points
     */
    async callOpenAISummarize(text, apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that summarizes email threads. Provide a concise TL;DR summary and extract 3-5 key points.'
                    },
                    {
                        role: 'user',
                        content: `Summarize this email thread:\n\n${text}\n\nProvide:\n1. A TL;DR summary (under 100 words)\n2. 3-5 key points as a bullet list`
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse the response to extract summary and key points
        const parts = content.split(/Key [Pp]oints?:|Summary:/);
        const summary = parts[0].replace(/TL;DR:?/i, '').trim();
        const keyPointsText = parts[parts.length - 1].trim();
        const keyPoints = keyPointsText.split(/\n/).filter(line => line.trim().match(/^[\-\•\*\d]/)).map(line => line.replace(/^[\-\•\*\d\.\)]\s*/, '').trim()).slice(0, 5);
        
        return { summary, keyPoints };
    }
    
    /**
     * Call OpenAI API for draft generation
     * @param {string} text - Thread text
     * @param {string} subject - Email subject
     * @param {string} tone - Selected tone
     * @param {string} guidance - User guidance
     * @param {string} apiKey - OpenAI API key
     * @returns {Array} Draft objects
     */
    async callOpenAIDrafts(text, subject, tone, guidance, apiKey) {
        const prompt = this.createReplyPrompt(text, subject, tone, guidance);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: this.createSystemPrompt(tone)
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1500,
                response_format: { type: 'json_object' }
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        // Parse JSON response
        const parsed = JSON.parse(content);
        return parsed.drafts || [];
    }
    
    /**
     * Placeholder for Anthropic API calls (Claude)
     * TODO: Implement when Anthropic API key is provided
     */
    async callAnthropicSummarize(text, apiKey) {
        throw new Error('Anthropic API integration coming soon. Please use OpenAI or Google AI for now.');
    }
    
    async callAnthropicDrafts(text, subject, tone, guidance, apiKey) {
        throw new Error('Anthropic API integration coming soon. Please use OpenAI or Google AI for now.');
    }
    
    /**
     * Placeholder for Google AI API calls (Gemini)
     * TODO: Implement when Google AI API key is provided
     */
    async callGoogleAISummarize(text, apiKey) {
        throw new Error('Google AI API integration coming soon. Please use OpenAI for now.');
    }
    
    async callGoogleAIDrafts(text, subject, tone, guidance, apiKey) {
        throw new Error('Google AI API integration coming soon. Please use OpenAI for now.');
    }
    
    async openSidePanel(tab) {
        try {
            await chrome.sidePanel.open({ tabId: tab.id });
        } catch (error) {
            console.error('Error opening side panel:', error);
        }
    }
}

// Initialize service worker
new InboxTriageServiceWorker();
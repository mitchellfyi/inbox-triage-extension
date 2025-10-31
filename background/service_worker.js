/**
 * Service Worker for Inbox Triage Extension
 * Handles AI processing, side panel management, and background tasks
 */

import { TranslationService } from './translation-service.js';
import { MultimodalAnalysisService } from './multimodal-service.js';
import { sanitizeErrorMessage } from '../utils/error-handler.js';
import { createStatusBroadcaster } from '../utils/status-utils.js';
import { createSuccessResponse, createErrorResponseForService } from '../utils/response-utils.js';
import { validateDraftsSchema, validateAndFormatDrafts } from '../utils/validation.js';
import { OpenAIAPI, AnthropicAPI, GoogleAIAPI, createSystemPrompt, createReplyPrompt } from './api-integrations.js';
import { SummaryService } from './summary-service.js';
import { DraftService } from './draft-service.js';
import { AttachmentService } from './attachment-service.js';

class InboxTriageServiceWorker {
    constructor() {
        this.aiCapabilities = {
            summarizer: null,
            promptApi: null,
            translator: null,
            multimodal: null,
            available: false
        };
        
        // Initialize services with standardized status broadcaster
        // Reference: utils/status-utils.js - createStatusBroadcaster for status update patterns
        const statusBroadcaster = createStatusBroadcaster(chrome.runtime.sendMessage.bind(chrome.runtime));
        
        // Store broadcaster for use in broadcastModelStatus method (backward compatibility)
        this.statusBroadcaster = statusBroadcaster;
        
        this.translationService = new TranslationService();
        this.multimodalService = new MultimodalAnalysisService();
        this.summaryService = new SummaryService({
            aiCapabilities: this.aiCapabilities,
            broadcastModelStatus: statusBroadcaster,
            shouldUseCloudFallback: (operation, processingMode, thread) => this.shouldUseCloudFallback(operation, processingMode, thread)
        });
        this.draftService = new DraftService({
            aiCapabilities: this.aiCapabilities,
            shouldUseCloudFallback: (operation, processingMode, thread) => this.shouldUseCloudFallback(operation, processingMode, thread),
            summaryService: this.summaryService
        });
        this.attachmentService = new AttachmentService({
            aiCapabilities: this.aiCapabilities
        });
        
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
    
    /**
     * Initialize AI capabilities and check model availability
     * 
     * Reference: docs/spec.md - AI Model Availability Handling requirements
     * Reference: https://developer.chrome.com/docs/ai/built-in
     * 
     * Checks availability of Summarizer, Prompt API, and Translator APIs.
     * Starts periodic monitoring to detect when models finish downloading.
     */
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
                    this.statusBroadcaster('summarizer', this.aiCapabilities.summarizer);
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
                    this.statusBroadcaster('promptApi', this.aiCapabilities.promptApi);
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
                    this.statusBroadcaster('translator', this.aiCapabilities.translator);
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
                this.statusBroadcaster('none', null);
            }
        } catch (error) {
            console.error('Error initializing AI capabilities:', error);
            this.statusBroadcaster('error', { error: sanitizeErrorMessage(error.message) });
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
                        this.statusBroadcaster('summarizer', newCapabilities);
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
                        this.statusBroadcaster('promptApi', newCapabilities);
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
                error: sanitizeErrorMessage(error.message)
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
                error: sanitizeErrorMessage(error.message)
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
            
            sendResponse(createSuccessResponse({
                translatedText,
                sourceLanguage,
                targetLanguage
            }));
            
        } catch (error) {
            console.error('Translation error:', error);
            sendResponse(createErrorResponseForService(error, 'Translation'));
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
            
            sendResponse(createSuccessResponse({
                analysis: result
            }));
            
        } catch (error) {
            console.error('Image analysis error:', error);
            sendResponse(createErrorResponseForService(error, 'Image analysis'));
        }
    }
    
    /**
     * Generate summary of email thread using Summarizer API
     * 
     * Reference: docs/spec.md - AI-Powered Summarization requirements
     * Reference: https://developer.chrome.com/docs/ai/summarizer-api
     * 
     * Delegates to SummaryService for implementation
     * 
     * @param {Object} thread - Email thread data
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings (processing mode, API key)
     */
    async generateSummary(thread, sendResponse, userSettings = null) {
        return await this.summaryService.generateSummary(thread, sendResponse, userSettings);
    }
    
    /**
     * Generate reply drafts using Prompt API with JSON schema
     * 
     * Reference: docs/spec.md - Reply Draft Generation requirements
     * Reference: https://developer.chrome.com/docs/ai/prompt-api
     * 
     * Delegates to DraftService for implementation
     * 
     * @param {Object} thread - Email thread data
     * @param {string} tone - Selected tone (neutral, friendly, assertive, formal)
     * @param {string} guidance - User-provided guidance for drafts
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings (processing mode, API key)
     */
    async generateReplyDrafts(thread, tone, guidance, sendResponse, userSettings = null) {
        return await this.draftService.generateReplyDrafts(thread, tone, guidance, sendResponse, userSettings);
    }
    
    /**
     * Process a single attachment for AI analysis
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * 
     * Delegates to AttachmentService for implementation
     * 
     * @param {Object} attachment - Attachment metadata and content
     * @param {Function} sendResponse - Response callback
     */
    async processAttachment(attachment, sendResponse) {
        return await this.attachmentService.processAttachment(attachment, sendResponse);
    }
    
    /**
     * Determine if cloud fallback should be used based on documented decision rules
     * Reference: docs/spec.md - Hybrid Fallback Decision Rules
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
        
        // Check model availability - as per docs/spec.md requirements
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
        
        // Don't fallback during download - wait for completion as per docs/spec.md
        if (capabilities.available === 'after-download') {
            return { 
                shouldFallback: false, 
                reason: 'Model is downloading, waiting for completion',
                trigger: 'model_downloading'
            };
        }
        
        // Check content size limits if thread provided
        if (thread) {
            const fullText = this.summaryService.combineThreadMessages(thread);
            
            // Content size limit check (32,000 characters as per docs/spec.md)
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
     * Delegates to SummaryService
     * @param {string} content - Original content
     * @param {number} maxLength - Maximum character length  
     * @returns {string} Truncated content
     */
    truncateContentForProcessing(content, maxLength) {
        return this.summaryService.truncateContentForProcessing(content, maxLength);
    }
    
    /**
     * Prepare content for cloud processing (text only, no attachments)
     * Delegates to SummaryService
     * @param {Object} thread - Email thread data
     * @returns {Object} Sanitized content for cloud processing
     */
    prepareContentForCloudProcessing(thread) {
        return this.summaryService.prepareContentForCloudProcessing(thread);
    }
    
    /**
     * Generate summary using external API (OpenAI, Anthropic, Google)
     * Delegates to SummaryService
     * @param {Object} thread - Email thread data
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings including API key
     */
    async generateSummaryWithExternalAPI(thread, sendResponse, userSettings) {
        return await this.summaryService.generateSummaryWithExternalAPI(thread, sendResponse, userSettings);
    }
    
    /**
     * Generate drafts using external API (OpenAI, Anthropic, Google)
     * Delegates to DraftService
     * @param {Object} thread - Email thread data
     * @param {string} tone - Selected tone
     * @param {string} guidance - User guidance
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings including API key
     */
    async generateDraftsWithExternalAPI(thread, tone, guidance, sendResponse, userSettings) {
        return await this.draftService.generateDraftsWithExternalAPI(thread, tone, guidance, sendResponse, userSettings);
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
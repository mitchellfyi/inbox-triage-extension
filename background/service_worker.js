/**
 * Service Worker for Inbox Triage Extension
 * Handles AI processing, side panel management, and background tasks
 */

class InboxTriageServiceWorker {
    constructor() {
        this.aiCapabilities = {
            summarizer: null,
            promptApi: null,
            available: false
        };
        
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
            // Check if AI capabilities are available
            if ('ai' in window) {
                // Check Summarizer API
                if ('summarizer' in window.ai) {
                    const summarizerCapabilities = await window.ai.summarizer.capabilities();
                    this.aiCapabilities.summarizer = summarizerCapabilities;
                    console.log('Summarizer API available:', summarizerCapabilities);
                    
                    // Broadcast initial model status to side panel if it's open
                    this.broadcastModelStatus('summarizer', summarizerCapabilities);
                }
                
                // Check Language Model API (Prompt API)
                if ('languageModel' in window.ai) {
                    const languageModelCapabilities = await window.ai.languageModel.capabilities();
                    this.aiCapabilities.promptApi = languageModelCapabilities;
                    console.log('Language Model API available:', languageModelCapabilities);
                    
                    // Broadcast initial model status to side panel if it's open
                    this.broadcastModelStatus('promptApi', languageModelCapabilities);
                }
                
                this.aiCapabilities.available = !!(
                    this.aiCapabilities.summarizer || 
                    this.aiCapabilities.promptApi
                );
            } else {
                console.log('AI APIs not available in this browser');
                this.broadcastModelStatus('none', null);
            }
        } catch (error) {
            console.error('Error initializing AI capabilities:', error);
            this.broadcastModelStatus('error', { error: error.message });
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
                    await this.generateSummary(message.thread, sendResponse);
                    break;
                    
                case 'generateDrafts':
                    await this.generateReplyDrafts(message.thread, message.tone, sendResponse);
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
                error: error.message 
            });
        }
    }
    
    async generateSummary(thread, sendResponse) {
        try {
            // Check AI capabilities first
            if (!this.aiCapabilities.summarizer) {
                throw new Error('AI summarization is not available in this browser. Please use Chrome 120+ with AI features enabled.');
            }
            
            // Check if model is ready
            const capabilities = this.aiCapabilities.summarizer;
            if (capabilities.available === 'after-download') {
                throw new Error('AI model is downloading. This may take a few minutes. Please try again later.');
            } else if (capabilities.available === 'no') {
                throw new Error('AI summarization is not available. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
            }
            
            // Combine all message content
            const fullText = this.combineThreadMessages(thread);
            
            if (!fullText || fullText.length < 50) {
                throw new Error('Not enough content to summarize');
            }
            
            // Broadcast progress update
            this.broadcastModelStatus('summarizing', { stage: 'generating_tldr' });
            
            // Create TL;DR summarizer session
            const tldrSummarizer = await window.ai.summarizer.create({
                type: 'tl;dr',
                format: 'plain-text',
                length: 'short'
            });
            
            // Generate TL;DR summary
            const summary = await tldrSummarizer.summarize(fullText);
            tldrSummarizer.destroy();
            
            // Broadcast progress update
            this.broadcastModelStatus('summarizing', { stage: 'generating_key_points' });
            
            let keyPoints = [];
            
            // Try to use key-points summarizer if available, fallback to manual extraction
            try {
                const keyPointsSummarizer = await window.ai.summarizer.create({
                    type: 'key-points',
                    format: 'plain-text',
                    length: 'short'
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
                keyPoints: keyPoints
            });
            
        } catch (error) {
            console.error('Summary generation error:', error);
            this.broadcastModelStatus('summarizing', { stage: 'error', error: error.message });
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }
    
    async generateReplyDrafts(thread, tone, sendResponse) {
        try {
            if (!this.aiCapabilities.promptApi) {
                throw new Error('Language Model API not available. Please enable AI features in Chrome.');
            }
            
            // Check if model is ready
            const capabilities = this.aiCapabilities.promptApi;
            if (capabilities.available === 'after-download') {
                throw new Error('AI model is downloading. This may take a few minutes. Please try again later.');
            } else if (capabilities.available === 'no') {
                throw new Error('Language Model API is not available. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
            }
            
            const fullText = this.combineThreadMessages(thread);
            const subject = thread.subject || 'Re: Email Thread';
            
            if (!fullText || fullText.length < 20) {
                throw new Error('Not enough content to generate meaningful replies');
            }
            
            // Create language model session with enhanced configuration
            const session = await window.ai.languageModel.create({
                systemPrompt: this.createSystemPrompt(tone),
                temperature: 0.7,
                topK: 3
            });
            
            // Generate drafts using structured prompt
            const prompt = this.createReplyPrompt(fullText, subject, tone);
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
                    warning: 'AI response was incomplete, using fallback drafts'
                });
                return;
            }
            
            sendResponse({
                success: true,
                drafts: formattedDrafts
            });
            
        } catch (error) {
            console.error('Draft generation error:', error);
            sendResponse({
                success: false,
                error: error.message
            });
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
    createReplyPrompt(threadText, originalSubject, tone) {
        return `Based on this email thread, generate 3 different reply drafts in ${tone} tone.

THREAD:
${threadText}

ORIGINAL SUBJECT: ${originalSubject}

Generate exactly 3 reply drafts with these characteristics:
1. SHORT RESPONSE: Quick acknowledgment (1-2 sentences, max 500 chars body)
2. MEDIUM RESPONSE: Detailed with clarifications (2-3 paragraphs, max 1000 chars body) 
3. COMPREHENSIVE RESPONSE: Complete with next steps (3-4 paragraphs, max 1500 chars body)

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
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
            
            const fullText = this.combineThreadMessages(thread);
            const subject = thread.subject || 'Re: Email Thread';
            
            // Create language model session
            const session = await window.ai.languageModel.create({
                systemPrompt: this.createSystemPrompt(tone)
            });
            
            // Generate drafts using structured prompt
            const prompt = this.createReplyPrompt(fullText, subject, tone);
            const response = await session.prompt(prompt);
            
            // Parse JSON response
            let drafts;
            try {
                drafts = JSON.parse(response);
            } catch (parseError) {
                // Fallback if JSON parsing fails
                drafts = this.createFallbackDrafts(response, subject, tone);
            }
            
            // Validate and format drafts
            const formattedDrafts = this.validateAndFormatDrafts(drafts, subject);
            
            // Clean up
            session.destroy();
            
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
    
    createSystemPrompt(tone) {
        return `You are an AI assistant helping to draft email replies. Generate responses that are:
- ${tone} in tone
- Professional and appropriate for business communication
- Concise but complete
- Properly structured with subject and body
- Return responses as valid JSON with exactly 3 drafts

Always respond with a JSON object containing an array of drafts, each with 'type', 'subject', and 'body' fields.`;
    }
    
    createReplyPrompt(threadText, originalSubject, tone) {
        return `Based on this email thread, generate 3 different reply drafts in ${tone} tone:

THREAD:
${threadText}

Original Subject: ${originalSubject}

Generate 3 reply options:
1. Short/Quick response (1-2 sentences)
2. Medium response with clarifications (2-3 paragraphs) 
3. Detailed response with next steps (3-4 paragraphs)

Return as JSON:
{
  "drafts": [
    {
      "type": "Quick Response",
      "subject": "Re: ${originalSubject}",
      "body": "..."
    },
    {
      "type": "Detailed Response", 
      "subject": "Re: ${originalSubject}",
      "body": "..."
    },
    {
      "type": "Action-Oriented Response",
      "subject": "Re: ${originalSubject}", 
      "body": "..."
    }
  ]
}`;
    }
    
    createFallbackDrafts(response, subject, tone) {
        // Create basic drafts if AI response parsing fails
        return {
            drafts: [
                {
                    type: 'Quick Response',
                    subject: `Re: ${subject}`,
                    body: 'Thank you for your email. I will review this and get back to you soon.'
                },
                {
                    type: 'Acknowledgment',
                    subject: `Re: ${subject}`,
                    body: 'I received your email and understand your request. Let me look into this and provide you with a detailed response by end of day.'
                },
                {
                    type: 'Next Steps',
                    subject: `Re: ${subject}`,
                    body: 'Thank you for reaching out. I will review the information you provided and schedule a follow-up meeting to discuss next steps. I will send you a meeting invite within the next 24 hours.'
                }
            ]
        };
    }
    
    validateAndFormatDrafts(drafts, originalSubject) {
        const draftArray = drafts.drafts || drafts || [];
        
        return draftArray.map((draft, index) => ({
            type: draft.type || `Draft ${index + 1}`,
            subject: draft.subject || `Re: ${originalSubject}`,
            body: draft.body || 'No content generated.'
        }));
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
/**
 * Content Script for Inbox Triage Extension
 * Extracts email thread content from Gmail and Outlook
 */

class EmailThreadExtractor {
    constructor() {
        this.siteConfig = getSelectorsForCurrentSite();
        this.isInitialized = false;
        this.init();
    }
    
    init() {
        if (!this.siteConfig) {
            console.log('Inbox Triage: Unsupported email provider');
            return;
        }
        
        console.log(`Inbox Triage: Initialized for ${this.siteConfig.provider}`);
        this.isInitialized = true;
        
        // Listen for messages from side panel
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }
    
    handleMessage(message, sender, sendResponse) {
        if (!this.isInitialized) {
            sendResponse({ success: false, error: 'Extractor not initialized' });
            return;
        }
        
        switch (message.action) {
            case 'extractThread':
                this.extractCurrentThread()
                    .then(thread => sendResponse({ success: true, thread }))
                    .catch(error => sendResponse({ success: false, error: error.message }));
                return true; // Keep message channel open for async response
                
            case 'checkPageReady':
                sendResponse({ success: true, ready: this.isPageReady() });
                return true;
                
            default:
                sendResponse({ success: false, error: 'Unknown action' });
        }
    }
    
    async extractCurrentThread() {
        try {
            // Wait for page to be ready
            await this.waitForPageReady();
            
            const threadData = {
                provider: this.siteConfig.provider,
                subject: this.extractSubject(),
                messages: this.extractMessages(),
                extractedAt: new Date().toISOString(),
                url: window.location.href
            };
            
            // Validate that we found content
            if (!threadData.subject && threadData.messages.length === 0) {
                throw new Error('No email content found. Make sure you are viewing an email thread.');
            }
            
            console.log('Extracted thread data:', threadData);
            return threadData;
            
        } catch (error) {
            console.error('Thread extraction error:', error);
            throw error;
        }
    }
    
    extractSubject() {
        const { selectors } = this.siteConfig;
        
        // Try primary subject selector
        let subjectElement = document.querySelector(selectors.subject);
        
        // Try alternative selector if primary fails
        if (!subjectElement && selectors.subjectAlt) {
            subjectElement = document.querySelector(selectors.subjectAlt);
        }
        
        if (subjectElement) {
            return this.cleanText(subjectElement.textContent);
        }
        
        return null;
    }
    
    extractMessages() {
        const { selectors } = this.siteConfig;
        const messages = [];
        
        // Find all message elements
        const messageElements = document.querySelectorAll(selectors.messages);
        
        messageElements.forEach((messageEl, index) => {
            const message = this.extractSingleMessage(messageEl, index);
            if (message && message.content) {
                messages.push(message);
            }
        });
        
        // If no messages found with primary method, try alternative approach
        if (messages.length === 0) {
            const alternativeMessage = this.extractAlternativeMessage();
            if (alternativeMessage) {
                messages.push(alternativeMessage);
            }
        }
        
        return messages;
    }
    
    extractSingleMessage(messageElement, index) {
        const { selectors } = this.siteConfig;
        
        // Skip draft or compose messages
        if (this.isDraftOrCompose(messageElement)) {
            return null;
        }
        
        // Extract message body content
        let bodyElement = messageElement.querySelector(selectors.messageBody);
        if (!bodyElement && selectors.messageBodyAlt) {
            bodyElement = messageElement.querySelector(selectors.messageBodyAlt);
        }
        
        const content = bodyElement ? this.cleanText(bodyElement.textContent) : '';
        
        if (!content) {
            return null;
        }
        
        // Extract metadata
        const sender = this.extractSenderInfo(messageElement);
        const timestamp = this.extractTimestamp(messageElement);
        
        return {
            index,
            content,
            sender,
            timestamp,
            wordCount: content.split(/\s+/).length
        };
    }
    
    extractAlternativeMessage() {
        // Fallback method for when standard selectors don't work
        const { selectors } = this.siteConfig;
        
        // Try to find any email content in common patterns
        const contentSelectors = [
            '.ii.gt div',  // Gmail alternative
            '.elementToProof', // Outlook alternative
            '[role="main"] [data-testid*="message"]',
            '.message-body',
            '.email-content'
        ];
        
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const content = this.cleanText(element.textContent);
                if (content && content.length > 20) { // Minimum content threshold
                    return {
                        index: 0,
                        content,
                        sender: 'Unknown',
                        timestamp: null,
                        wordCount: content.split(/\s+/).length
                    };
                }
            }
        }
        
        return null;
    }
    
    extractSenderInfo(messageElement) {
        const { selectors } = this.siteConfig;
        
        let senderName = '';
        let senderEmail = '';
        
        // Extract sender name
        const senderNameEl = messageElement.querySelector(selectors.senderName || selectors.sender);
        if (senderNameEl) {
            senderName = this.cleanText(senderNameEl.textContent);
        }
        
        // Extract sender email if available
        const senderEmailEl = messageElement.querySelector(selectors.senderEmail || selectors.sender);
        if (senderEmailEl) {
            const emailAttr = senderEmailEl.getAttribute('email');
            senderEmail = emailAttr || this.extractEmailFromText(senderEmailEl.textContent);
        }
        
        return {
            name: senderName || 'Unknown',
            email: senderEmail || ''
        };
    }
    
    extractTimestamp(messageElement) {
        const { selectors } = this.siteConfig;
        
        const timestampEl = messageElement.querySelector(selectors.timestamp);
        if (timestampEl) {
            // Try title attribute first (often contains full datetime)
            const title = timestampEl.getAttribute('title');
            if (title) {
                return title;
            }
            
            // Fall back to text content
            return this.cleanText(timestampEl.textContent);
        }
        
        return null;
    }
    
    isDraftOrCompose(element) {
        const { selectors } = this.siteConfig;
        
        // Check if element is a draft or compose area
        if (selectors.draftArea && element.matches(selectors.draftArea)) {
            return true;
        }
        
        if (selectors.composeArea && element.matches(selectors.composeArea)) {
            return true;
        }
        
        // Check for common draft/compose indicators
        const skipSelectors = UTILITY_SELECTORS.skipElements;
        for (const selector of skipSelectors) {
            if (element.matches(selector) || element.querySelector(selector)) {
                return true;
            }
        }
        
        return false;
    }
    
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/^\s+|\s+$/g, '') // Trim
            .replace(/\n\s*\n/g, '\n\n') // Clean up line breaks
            .trim();
    }
    
    extractEmailFromText(text) {
        const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
        const match = text.match(emailRegex);
        return match ? match[1] : '';
    }
    
    isPageReady() {
        const { selectors } = this.siteConfig;
        
        // Check if main email containers are present
        return !!(
            document.querySelector(selectors.threadContainer) ||
            document.querySelector(selectors.messages) ||
            document.querySelector(selectors.subject)
        );
    }
    
    async waitForPageReady(timeout = 5000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (this.isPageReady()) {
                return true;
            }
            
            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Page did not become ready within timeout period');
    }
}

// Initialize the extractor when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new EmailThreadExtractor();
    });
} else {
    new EmailThreadExtractor();
}
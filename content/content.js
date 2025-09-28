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
                attachments: this.extractAttachments(),
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

    /**
     * Combines all thread messages into a single string with deduplication and trimming
     * Respects the 50,000-character limit as specified in requirements
     * @returns {string} Combined thread text or empty string if no content
     */
    combineThreadMessagesAsText() {
        try {
            const threadData = this.extractCurrentThreadSync();
            if (!threadData || !threadData.messages || threadData.messages.length === 0) {
                return '';
            }

            // Combine all message content with sender info
            let combinedText = '';
            const seenContent = new Set(); // For duplicate detection
            
            // Add subject if available
            if (threadData.subject) {
                combinedText += `Subject: ${threadData.subject}\n\n`;
            }
            
            // Process each message
            for (const message of threadData.messages) {
                if (!message.content) continue;
                
                // Create a normalized version for duplicate detection
                const normalizedContent = this.cleanText(message.content).toLowerCase();
                
                // Skip if we've seen this content before (duplicate removal)
                if (seenContent.has(normalizedContent)) {
                    continue;
                }
                seenContent.add(normalizedContent);
                
                // Add sender info and content
                const senderName = message.sender?.name || 'Unknown';
                const messageText = `From: ${senderName}\n${message.content}\n\n---\n\n`;
                
                // Check if adding this message would exceed the 50,000 character limit
                if ((combinedText + messageText).length > 50000) {
                    console.warn('Thread content truncated at 50,000 characters');
                    break;
                }
                
                combinedText += messageText;
            }
            
            // Final cleanup and trimming
            combinedText = combinedText.replace(/\n\n---\n\n$/, ''); // Remove trailing separator
            combinedText = this.cleanText(combinedText);
            
            // Ensure we don't exceed the limit after cleanup
            if (combinedText.length > 50000) {
                combinedText = combinedText.substring(0, 50000);
                // Try to end at a word boundary if possible
                const lastSpace = combinedText.lastIndexOf(' ');
                if (lastSpace > 49000) { // Only if we're not cutting too much
                    combinedText = combinedText.substring(0, lastSpace) + '...';
                }
            }
            
            return combinedText;
            
        } catch (error) {
            console.error('Error combining thread messages:', error);
            return '';
        }
    }

    /**
     * Synchronous version of thread extraction for the global function
     * @returns {Object|null} Thread data or null if extraction fails
     */
    extractCurrentThreadSync() {
        try {
            if (!this.isPageReady()) {
                return null;
            }
            
            return {
                provider: this.siteConfig.provider,
                subject: this.extractSubject(),
                messages: this.extractMessages(),
                extractedAt: new Date().toISOString(),
                url: window.location.href
            };
            
        } catch (error) {
            console.error('Sync thread extraction error:', error);
            return null;
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
        
        // Skip hidden or collapsed messages
        if (this.isHiddenOrTruncated(messageElement)) {
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
    
    /**
     * Extract attachments from the current email thread
     * @returns {Array<Object>} Array of attachment objects with metadata
     */
    extractAttachments() {
        const { selectors } = this.siteConfig;
        const attachments = [];
        
        try {
            // Find all attachment elements in the thread
            const attachmentElements = document.querySelectorAll(selectors.attachments);
            
            attachmentElements.forEach((attachmentEl, index) => {
                const attachment = this.extractSingleAttachment(attachmentEl, index);
                if (attachment) {
                    attachments.push(attachment);
                }
            });
            
            console.log(`Found ${attachments.length} attachments`);
            return attachments;
            
        } catch (error) {
            console.error('Error extracting attachments:', error);
            return [];
        }
    }
    
    /**
     * Extract metadata from a single attachment element
     * @param {Element} attachmentElement - DOM element containing attachment
     * @param {number} index - Index of attachment in the thread
     * @returns {Object|null} Attachment metadata object or null if invalid
     */
    extractSingleAttachment(attachmentElement, index) {
        const { selectors } = this.siteConfig;
        
        try {
            // Extract attachment name
            let name = '';
            const nameEl = attachmentElement.querySelector(selectors.attachmentNames);
            if (nameEl) {
                name = this.cleanText(nameEl.textContent);
            }
            
            // Extract attachment link
            let downloadUrl = '';
            const linkEl = attachmentElement.querySelector(selectors.attachmentLinks);
            if (linkEl) {
                downloadUrl = linkEl.href || linkEl.getAttribute('href') || '';
            }
            
            // Extract size if available
            let size = '';
            const sizeEl = attachmentElement.querySelector(selectors.attachmentSizes);
            if (sizeEl) {
                size = this.cleanText(sizeEl.textContent);
            }
            
            // Skip if no name or download URL
            if (!name && !downloadUrl) {
                return null;
            }
            
            // Determine file type from extension
            const fileType = this.getAttachmentType(name);
            
            return {
                index,
                name: name || `Attachment ${index + 1}`,
                size,
                type: fileType,
                downloadUrl,
                processable: this.isProcessableAttachment(fileType),
                summary: null, // Will be populated during processing
                extractedContent: null // Will be populated during processing
            };
            
        } catch (error) {
            console.error('Error extracting single attachment:', error);
            return null;
        }
    }
    
    /**
     * Determine attachment type from filename
     * @param {string} filename - Name of the attachment file
     * @returns {string} File type category
     */
    getAttachmentType(filename) {
        if (!filename) return 'unknown';
        
        const extension = filename.toLowerCase().split('.').pop();
        
        switch (extension) {
            case 'pdf':
                return 'pdf';
            case 'docx':
            case 'doc':
                return 'docx';
            case 'xlsx':
            case 'xls':
                return 'xlsx';
            case 'png':
            case 'jpg':
            case 'jpeg':
            case 'gif':
            case 'bmp':
            case 'webp':
                return 'image';
            default:
                return 'unknown';
        }
    }
    
    /**
     * Check if attachment type can be processed locally
     * @param {string} fileType - File type category
     * @returns {boolean} True if processable
     */
    isProcessableAttachment(fileType) {
        return ['pdf', 'docx', 'xlsx', 'image'].includes(fileType);
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
        const skipSelectors = (typeof UTILITY_SELECTORS !== 'undefined') ? 
            UTILITY_SELECTORS.skipElements : 
            [
                '[data-is-draft="true"]',
                '.compose',
                '.reply-box',
                '[data-testid*="compose"]',
                '.gmail_signature',
                '.signature'
            ];
        
        for (const selector of skipSelectors) {
            if (element.matches(selector) || element.querySelector(selector)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if an element represents hidden or truncated content that should be excluded
     * @param {Element} element - The element to check
     * @returns {boolean} True if the element should be skipped
     */
    isHiddenOrTruncated(element) {
        // Check if element is hidden via CSS
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' || 
            computedStyle.visibility === 'hidden' || 
            computedStyle.opacity === '0') {
            return true;
        }
        
        // Check for collapsed/truncated message indicators
        const truncatedIndicators = [
            '.trimmed',
            '.collapsed',
            '.truncated',
            '[data-is-collapsed="true"]',
            '.gmail_quote_attribution', // Gmail quoted content
            '.quote', // General quoted content
            '[style*="display: none"]',
            '[style*="visibility: hidden"]'
        ];
        
        for (const selector of truncatedIndicators) {
            if (element.matches(selector) || element.querySelector(selector)) {
                return true;
            }
        }
        
        // Check if the element has very little content (likely a stub)
        const textContent = element.textContent?.trim() || '';
        if (textContent.length < 10) {
            return true;
        }
        
        return false;
    }
    
    cleanText(text) {
        if (!text) return '';
        
        return text
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/^\s+|\s+$/g, '') // Trim start and end
            .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up excessive line breaks
            .replace(/\t+/g, ' ') // Replace tabs with spaces
            .replace(/[\r\f\v]/g, '') // Remove other whitespace chars
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

// Global instance reference for the global function
let globalExtractorInstance = null;

// Initialize the extractor when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        globalExtractorInstance = new EmailThreadExtractor();
    });
} else {
    globalExtractorInstance = new EmailThreadExtractor();
}

/**
 * Global function exposed on window object to extract email thread text
 * This function is called by the service worker to get the current thread text
 * @returns {string} Combined email thread text as a single string, respecting 50,000 char limit
 */
window.getEmailThreadText = function() {
    if (!globalExtractorInstance || !globalExtractorInstance.isInitialized) {
        console.warn('EmailThreadExtractor not initialized');
        return '';
    }
    
    const threadText = globalExtractorInstance.combineThreadMessagesAsText();
    console.log('Global function returning thread text:', threadText.length, 'characters');
    return threadText;
};
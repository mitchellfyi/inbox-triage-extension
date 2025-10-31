/**
 * Content Script for Inbox Triage Extension
 * Extracts email thread content from Gmail and Outlook
 * 
 * Reference: docs/spec.md - Email Thread Extraction requirements
 * Reference: AGENTS.md - Content Script Layer architecture
 */

console.log('Inbox Triage: Content script starting to load...');

// Content scripts in MV3 can't use ES modules, so we use dynamic imports
let cleanText, extractEmailFromText, parseTimestamp, normalizeTimestamp, parseRelativeTime;
let createThreadObserver, setupUrlChangeMonitor, detectUITheme;

// Global instance reference - set up immediately so message listener can access it
let globalExtractorInstance = null;

// Set up message listener IMMEDIATELY so ping works even before initialization
// This is critical for the side panel to detect content script presence
try {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Inbox Triage: Message received:', message.action);
        
        // Handle ping immediately, even if extractor not initialized
        if (message.action === 'ping') {
            console.log('Inbox Triage: Ping received, responding immediately');
            sendResponse({ success: true, ready: true });
            return true;
        }
        
        // For other messages, delegate to extractor instance
        if (globalExtractorInstance) {
            return globalExtractorInstance.handleMessage(message, sender, sendResponse);
        }
        
        // Extractor not initialized yet
        console.warn('Inbox Triage: Message received but extractor not initialized');
        sendResponse({ success: false, error: 'Content script not initialized yet' });
        return true;
    });
    
    console.log('Inbox Triage: Message listener registered');
} catch (error) {
    console.error('Inbox Triage: Failed to set up message listener:', error);
}

// Load utility modules dynamically
(async function loadUtilities() {
    try {
        const textCleaner = await import(chrome.runtime.getURL('utils/text-cleaner.js'));
        cleanText = textCleaner.cleanText;
        extractEmailFromText = textCleaner.extractEmailFromText;
        
        const timestampParser = await import(chrome.runtime.getURL('utils/timestamp-parser.js'));
        parseTimestamp = timestampParser.parseTimestamp;
        normalizeTimestamp = timestampParser.normalizeTimestamp;
        parseRelativeTime = timestampParser.parseRelativeTime;
        
        const mutationObserver = await import(chrome.runtime.getURL('content/mutation-observer.js'));
        createThreadObserver = mutationObserver.createThreadObserver;
        
        const urlMonitor = await import(chrome.runtime.getURL('content/url-monitor.js'));
        setupUrlChangeMonitor = urlMonitor.setupUrlChangeMonitor;
        
        const uiThemeDetector = await import(chrome.runtime.getURL('utils/ui-theme-detector.js'));
        detectUITheme = uiThemeDetector.detectUITheme;
        
        console.log('Inbox Triage: Utility modules loaded');
    } catch (error) {
        console.error('Inbox Triage: Failed to load utility modules:', error);
    }
})();

class EmailThreadExtractor {
    constructor() {
        // Check if getSelectorsForCurrentSite is available
        if (typeof getSelectorsForCurrentSite !== 'function') {
            console.error('Inbox Triage: getSelectorsForCurrentSite not available - selectors.js may not have loaded');
            this.siteConfig = null;
            this.isInitialized = false;
            return;
        }
        
        this.siteConfig = getSelectorsForCurrentSite();
        this.isInitialized = false;
        this.mutationObserver = null;
        this.observerTimeout = null;
        // Wait for utilities to load before initializing
        this.init();
    }
    
    async init() {
        if (!this.siteConfig) {
            console.log('Inbox Triage: Unsupported email provider on', window.location.hostname);
            return;
        }
        
        // Wait for utility modules to load
        let retries = 0;
        while ((!cleanText || !createThreadObserver || !setupUrlChangeMonitor || !detectUITheme) && retries < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            retries++;
        }
        
        if (!cleanText || !createThreadObserver || !setupUrlChangeMonitor || !detectUITheme) {
            console.error('Inbox Triage: Utility modules not loaded, some features may not work');
        }
        
        console.log(`Inbox Triage: Content script initialized for ${this.siteConfig.provider} on ${window.location.href}`);
        this.isInitialized = true;
        
        // Initialize MutationObserver for dynamic content handling
        this.setupMutationObserver();
        
        // Also listen for URL changes (Gmail/Outlook use pushState for navigation)
        this.setupUrlChangeListener();
    }
    
    /**
     * Setup MutationObserver to watch for DOM changes in email threads
     * Handles dynamic content updates in Gmail and Outlook SPAs
     */
    setupMutationObserver() {
        if (!this.siteConfig) return;
        if (!createThreadObserver) {
            console.warn('Inbox Triage: createThreadObserver not loaded yet');
            return;
        }
        
        const { selectors } = this.siteConfig;
        
        this.mutationObserver = createThreadObserver({
            selectors,
            onUpdate: () => this.handleThreadUpdate(),
            isPageReady: () => this.isPageReady()
        });
    }
    
    /**
     * Handle thread updates detected by MutationObserver
     * Revalidates thread structure and updates internal state
     */
    handleThreadUpdate() {
        console.log('Inbox Triage: Thread update detected, revalidating...');
        
        // Re-check if page is still ready
        if (!this.isPageReady()) {
            console.log('Inbox Triage: Page no longer ready, may have navigated away');
            return;
        }
        
        // Verify thread still exists
        const { selectors } = this.siteConfig;
        const threadContainer = document.querySelector(selectors.threadContainer) || 
                               document.querySelector(selectors.threadView);
        
        if (!threadContainer) {
            console.log('Inbox Triage: Thread container not found, page may have changed');
            return;
        }
        
        // Update initialization status if needed
        if (!this.isInitialized) {
            this.isInitialized = true;
            console.log('Inbox Triage: Re-initialized after thread update');
        }
    }
    
    /**
     * Setup listener for URL changes (SPA navigation)
     * Gmail and Outlook use pushState/replaceState for navigation
     */
    setupUrlChangeListener() {
        if (!setupUrlChangeMonitor) {
            console.warn('Inbox Triage: setupUrlChangeMonitor not loaded yet');
            return;
        }
        
        this.urlChangeCleanup = setupUrlChangeMonitor((newUrl) => {
            this.handleUrlChange();
        });
    }
    
    /**
     * Handle URL changes (SPA navigation)
     * Re-initializes observer if needed for new thread
     */
    handleUrlChange() {
        console.log('Inbox Triage: URL changed, checking for thread updates');
        
        // Check if still on a supported email page
        const newSiteConfig = getSelectorsForCurrentSite();
        if (!newSiteConfig) {
            console.log('Inbox Triage: Navigated away from email page');
            this.cleanup();
            return;
        }
        
        // Update site config if provider changed
        if (newSiteConfig.provider !== this.siteConfig?.provider) {
            console.log(`Inbox Triage: Provider changed from ${this.siteConfig?.provider} to ${newSiteConfig.provider}`);
            this.siteConfig = newSiteConfig;
        }
        
        // Re-check page readiness
        setTimeout(() => {
            if (this.isPageReady()) {
                this.handleThreadUpdate();
                
                // Restart observer if it was stopped
                if (!this.mutationObserver) {
                    this.setupMutationObserver();
                }
            }
        }, 500); // Wait for page to stabilize
    }
    
    /**
     * Cleanup MutationObserver and event listeners
     */
    cleanup() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        if (this.observerTimeout) {
            clearTimeout(this.observerTimeout);
            this.observerTimeout = null;
        }
        
        if (this.urlChangeCleanup) {
            this.urlChangeCleanup();
            this.urlChangeCleanup = null;
        }
        
        this.isInitialized = false;
        console.log('Inbox Triage: Cleaned up observers');
    }
    
    handleMessage(message, sender, sendResponse) {
        console.log('Content script received message:', message.action);
        
        // Handle ping immediately, even if not fully initialized
        if (message.action === 'ping') {
            sendResponse({ success: true, ready: true });
            return true;
        }
        
        if (!this.isInitialized) {
            const error = `Content script not initialized for ${window.location.hostname}. Please refresh the page.`;
            console.error('Inbox Triage:', error);
            sendResponse({ success: false, error });
            return true;
        }
        
        switch (message.action) {
            case 'extractThread':
                console.log('Starting thread extraction...');
                this.extractCurrentThread()
                    .then(thread => {
                        console.log('Thread extraction successful:', thread);
                        sendResponse({ success: true, thread });
                    })
                    .catch(error => {
                        console.error('Thread extraction failed:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // Keep message channel open for async response
                
            case 'checkPageReady':
                sendResponse({ success: true, ready: this.isPageReady() });
                return true;
                
            case 'createDraft':
                console.log('Creating draft in email client...');
                this.createDraftInEmailUI(message.draftBody)
                    .then(() => {
                        sendResponse({ success: true });
                    })
                    .catch(error => {
                        console.error('Failed to create draft:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // Keep message channel open for async response
                
            default:
                console.warn('Unknown action received:', message.action);
                sendResponse({ success: false, error: `Unknown action: ${message.action}` });
                return true;
        }
    }
    
    /**
     * Extract current email thread from DOM
     * 
     * Reference: docs/spec.md - Email Thread Extraction requirements
     * 
     * Extracts all thread content including subject, messages, attachments,
     * and metadata without sending data to external servers.
     * 
     * @returns {Promise<Object>} Thread data object with messages and attachments
     * @throws {Error} If no email content found or extraction fails
     */
    async extractCurrentThread() {
        try {
            // Wait for page to be ready
            await this.waitForPageReady();
            
            // Detect UI theme and view mode
            const uiConfig = detectUITheme(this.siteConfig.provider);
            
            const threadData = {
                provider: this.siteConfig.provider,
                subject: this.extractSubject(),
                messages: this.extractMessages(),
                attachments: this.extractAttachments(),
                extractedAt: new Date().toISOString(),
                url: window.location.href,
                uiTheme: uiConfig.theme,
                viewMode: uiConfig.viewMode,
                density: uiConfig.density
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
     * Enhanced for nested threads with proper thread structure representation
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
            
            // Process each message with thread structure awareness
            for (const message of threadData.messages) {
                if (!message.content) continue;
                
                // Create a normalized version for duplicate detection
                const normalizedContent = cleanText ? cleanText(message.content).toLowerCase() : message.content.toLowerCase();
                
                // Skip if we've seen this content before (duplicate removal)
                if (seenContent.has(normalizedContent)) {
                    continue;
                }
                seenContent.add(normalizedContent);
                
                // Build message text with thread structure indicators
                const senderName = message.sender?.name || 'Unknown';
                let messageText = `From: ${senderName}`;
                
                // Add thread depth indicator for nested messages
                if (message.isNested && message.threadDepth > 0) {
                    const indent = '  '.repeat(message.threadDepth);
                    messageText = `${indent}${messageText}`;
                }
                
                // Add timestamp if available
                if (message.timestamp) {
                    messageText += ` (${message.timestamp})`;
                }
                
                messageText += `\n${message.content}\n\n`;
                
                // Add separator - use different separator for nested threads
                if (message.isNested) {
                    messageText += `${'  '.repeat(message.threadDepth)}---\n\n`;
                } else {
                    messageText += '---\n\n';
                }
                
                // Check if adding this message would exceed the 50,000 character limit
                if ((combinedText + messageText).length > 50000) {
                    console.warn('Thread content truncated at 50,000 characters');
                    break;
                }
                
                combinedText += messageText;
            }
            
            // Final cleanup and trimming
            combinedText = combinedText.replace(/\n\n---\n\n$/, ''); // Remove trailing separator
            combinedText = cleanText ? cleanText(combinedText) : combinedText.trim();
            
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
            
            // Detect UI theme and view mode  
            const uiConfig = detectUITheme ? detectUITheme(this.siteConfig.provider) : { theme: 'light', viewMode: 'default', density: 'default' };
            
            const threadData = {
                provider: this.siteConfig.provider,
                subject: this.extractSubject(),
                messages: this.extractMessages(),
                attachments: this.extractAttachments(),
                extractedAt: new Date().toISOString(),
                url: window.location.href,
                uiTheme: uiConfig.theme,
                viewMode: uiConfig.viewMode,
                density: uiConfig.density
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
            return cleanText ? cleanText(subjectElement.textContent) : subjectElement.textContent.trim();
        }
        
        return null;
    }
    
    /**
     * Extract messages from thread with improved nested thread handling
     * 
     * Enhanced to handle complex reply chains by:
     * - Detecting thread depth and nesting relationships
     * - Preserving chronological order while respecting thread structure
     * - Handling collapsed/nested replies
     * - Detecting quoted content boundaries
     * 
     * @returns {Array<Object>} Array of message objects with thread metadata
     */
    extractMessages() {
        const { selectors } = this.siteConfig;
        const messages = [];
        
        // Find all message elements
        const messageElements = document.querySelectorAll(selectors.messages);
        
        // Build a map of message elements to their DOM position for thread analysis
        const messageMap = new Map();
        messageElements.forEach((el, index) => {
            messageMap.set(el, index);
        });
        
        // Extract messages with thread relationship detection
        messageElements.forEach((messageEl, index) => {
            const message = this.extractSingleMessage(messageEl, index);
            if (message && message.content) {
                // Detect thread depth and relationships
                const threadInfo = this.detectThreadInfo(messageEl, messageElements, index);
                message.threadDepth = threadInfo.depth;
                message.parentIndex = threadInfo.parentIndex;
                message.isNested = threadInfo.isNested;
                message.hasQuotedContent = threadInfo.hasQuotedContent;
                
                messages.push(message);
            }
        });
        
        // Sort messages by chronological order if timestamps are available
        // This ensures proper thread ordering even with nested structures
        messages.sort((a, b) => {
            // If we have timestamps, use them
                if (a.timestamp && b.timestamp) {
                    const timeA = parseTimestamp ? parseTimestamp(a.timestamp) : null;
                    const timeB = parseTimestamp ? parseTimestamp(b.timestamp) : null;
                if (timeA && timeB) {
                    return timeA - timeB;
                }
            }
            // Fall back to index order
            return a.index - b.index;
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
    
    /**
     * Detect thread information for a message element
     * Analyzes DOM structure to determine thread depth, parent relationships, and nesting
     * 
     * @param {Element} messageElement - The message DOM element
     * @param {NodeList} allMessages - All message elements in the thread
     * @param {number} currentIndex - Current message index
     * @returns {Object} Thread information object
     */
    detectThreadInfo(messageElement, allMessages, currentIndex) {
        const info = {
            depth: 0,
            parentIndex: null,
            isNested: false,
            hasQuotedContent: false
        };
        
        // Check for nested structure indicators
        // Gmail uses indentation/positioning to show nesting
        const computedStyle = window.getComputedStyle(messageElement);
        const marginLeft = parseInt(computedStyle.marginLeft) || 0;
        const paddingLeft = parseInt(computedStyle.paddingLeft) || 0;
        
        // Detect nesting depth based on indentation (common in Gmail)
        if (marginLeft > 0 || paddingLeft > 20) {
            info.isNested = true;
            // Estimate depth based on indentation (each level typically 20-40px)
            info.depth = Math.floor((marginLeft + paddingLeft) / 30);
        }
        
        // Check for quoted content indicators
        const quotedSelectors = [
            '.gmail_quote',
            '.gmail_extra',
            '.quote',
            '[class*="quoted"]',
            '[class*="reply"]',
            '.gmail_default'
        ];
        
        for (const selector of quotedSelectors) {
            if (messageElement.querySelector(selector)) {
                info.hasQuotedContent = true;
                break;
            }
        }
        
        // Try to find parent message by looking for previous messages with lower depth
        if (info.isNested && currentIndex > 0) {
            for (let i = currentIndex - 1; i >= 0; i--) {
                const prevElement = allMessages[i];
                if (prevElement) {
                    const prevStyle = window.getComputedStyle(prevElement);
                    const prevMarginLeft = parseInt(prevStyle.marginLeft) || 0;
                    const prevPaddingLeft = parseInt(prevStyle.paddingLeft) || 0;
                    const prevDepth = Math.floor((prevMarginLeft + prevPaddingLeft) / 30);
                    
                    // Found a parent if it has lower depth
                    if (prevDepth < info.depth) {
                        info.parentIndex = i;
                        break;
                    }
                }
            }
        }
        
        // Check for Outlook-specific nested indicators
        if (this.siteConfig.provider === 'outlook') {
            const parentConvid = messageElement.closest('[data-convid]');
            if (parentConvid && parentConvid !== messageElement) {
                info.isNested = true;
                info.depth = 1; // Outlook typically has simpler nesting
            }
        }
        
        return info;
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
        
        const content = bodyElement ? (cleanText ? cleanText(bodyElement.textContent) : bodyElement.textContent.trim()) : '';
        
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
                const content = cleanText ? cleanText(element.textContent) : element.textContent.trim();
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
                name = cleanText ? cleanText(nameEl.textContent) : nameEl.textContent.trim();
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
                size = cleanText ? cleanText(sizeEl.textContent) : sizeEl.textContent.trim();
            }
            
            // Skip if no name or download URL
            if (!name && !downloadUrl) {
                return null;
            }
            
            // Determine file type from extension
            const fileType = this.getAttachmentType(name);
            
            // For images, try to extract the actual image URL for preview/analysis
            let imageUrl = null;
            if (fileType === 'image') {
                // Try to find embedded image in attachment card
                const imgEl = attachmentElement.querySelector('img');
                if (imgEl && imgEl.src) {
                    imageUrl = imgEl.src;
                }
                
                // Alternative: check for background image
                if (!imageUrl) {
                    const bgImage = window.getComputedStyle(attachmentElement).backgroundImage;
                    if (bgImage && bgImage !== 'none') {
                        const match = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
                        if (match) {
                            imageUrl = match[1];
                        }
                    }
                }
                
                // Fallback: use download URL if it's a direct image link
                if (!imageUrl && downloadUrl) {
                    imageUrl = downloadUrl;
                }
            }
            
            return {
                index,
                name: name || `Attachment ${index + 1}`,
                size,
                type: fileType,
                downloadUrl,
                imageUrl, // Image URL for preview and analysis
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
            senderName = cleanText ? cleanText(senderNameEl.textContent) : senderNameEl.textContent.trim();
        }
        
        // Extract sender email if available
        const senderEmailEl = messageElement.querySelector(selectors.senderEmail || selectors.sender);
        if (senderEmailEl) {
            const emailAttr = senderEmailEl.getAttribute('email');
            senderEmail = emailAttr || (extractEmailFromText ? extractEmailFromText(senderEmailEl.textContent) : '');
        }
        
        return {
            name: senderName || 'Unknown',
            email: senderEmail || ''
        };
    }
    
    /**
     * Extract timestamp from message element with improved parsing
     * Tries multiple extraction strategies and normalizes the output
     * 
     * @param {Element} messageElement - The message DOM element
     * @returns {string|null} Normalized timestamp string or null if not found
     */
    extractTimestamp(messageElement) {
        const { selectors } = this.siteConfig;
        const timestampEl = messageElement.querySelector(selectors.timestamp);
        
        if (timestampEl) {
            // Strategy 1: Try title attribute first (often contains full datetime)
            const title = timestampEl.getAttribute('title');
            if (title && title.trim().length > 0) {
                return normalizeTimestamp ? normalizeTimestamp(title) : title;
            }
            
            // Strategy 2: Check data attributes for timestamp
            const dataTimestamp = timestampEl.getAttribute('data-timestamp') || 
                                 timestampEl.getAttribute('data-time') ||
                                 timestampEl.getAttribute('datetime');
            if (dataTimestamp && dataTimestamp.trim().length > 0) {
                return normalizeTimestamp ? normalizeTimestamp(dataTimestamp) : dataTimestamp;
            }
            
            // Strategy 3: Extract from text content
            const textContent = timestampEl.textContent;
            if (textContent && textContent.trim().length > 0) {
                return normalizeTimestamp ? normalizeTimestamp(textContent) : textContent.trim();
            }
            
            // Strategy 4: Check parent element for timestamp attributes
            const parent = timestampEl.parentElement;
            if (parent) {
                const parentTimestamp = parent.getAttribute('title') || 
                                       parent.getAttribute('data-timestamp');
                if (parentTimestamp && parentTimestamp.trim().length > 0) {
                    return normalizeTimestamp ? normalizeTimestamp(parentTimestamp) : parentTimestamp;
                }
            }
        }
        
        // Strategy 5: Try alternative timestamp selectors (provider-specific)
        if (this.siteConfig.provider === 'gmail') {
            // Gmail sometimes uses different timestamp locations
            const altTimestamp = messageElement.querySelector('.g3 span, .gK span');
            if (altTimestamp) {
                const altTitle = altTimestamp.getAttribute('title');
                if (altTitle) {
                    return normalizeTimestamp ? normalizeTimestamp(altTitle) : altTitle;
                }
                return normalizeTimestamp ? normalizeTimestamp(altTimestamp.textContent) : altTimestamp.textContent.trim();
            }
        } else if (this.siteConfig.provider === 'outlook') {
            // Outlook timestamp variations based on version
            const variant = this.siteConfig.variant || 'default';
            let altSelectors = [];
            
            if (variant === 'office365') {
                // Office 365 specific selectors
                altSelectors = [
                    '[data-testid="message-header-date"]',
                    '[aria-label*="Date"]',
                    '.ms-fontColor-neutralSecondary',
                    '[class*="dateTime"]'
                ];
            } else if (variant === 'com') {
                // Outlook.com specific selectors
                altSelectors = [
                    '[data-testid="message-header-date"]',
                    '[aria-label*="received"]',
                    '.ms-fontColor-neutralSecondary'
                ];
            } else {
                // Default Outlook selectors
                altSelectors = [
                    '[data-testid="message-header-date"]',
                    '[data-testid*="date"]',
                    '.ms-fontColor-neutralSecondary'
                ];
            }
            
            for (const selector of altSelectors) {
                const altTimestamp = messageElement.querySelector(selector);
                if (altTimestamp) {
                    const altTitle = altTimestamp.getAttribute('title') || 
                                   altTimestamp.getAttribute('aria-label');
                    if (altTitle) {
                        return normalizeTimestamp ? normalizeTimestamp(altTitle) : altTitle;
                    }
                    const textContent = altTimestamp.textContent;
                    if (textContent && textContent.trim().length > 0) {
                        return normalizeTimestamp ? normalizeTimestamp(textContent) : textContent.trim();
                    }
                }
            }
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

    /**
     * Format draft content for insertion into contenteditable editor
     * Escapes HTML entities and converts newlines to <br> tags
     * @param {string} draftBody - Draft body text
     * @returns {string} Formatted HTML string
     */
    formatDraftContentForEditor(draftBody) {
        if (!draftBody) return '';
        
        // Escape HTML entities to prevent XSS
        const div = document.createElement('div');
        div.textContent = draftBody;
        const escaped = div.innerHTML;
        
        // Convert newlines to <br> tags
        // Handle both \n and \r\n line endings
        return escaped
            .replace(/\r\n/g, '<br>')
            .replace(/\n/g, '<br>')
            .replace(/\r/g, '<br>');
    }

    /**
     * Create draft in email client (Gmail/Outlook)
     * Opens reply compose window and fills it with draft content
     * @param {string} draftBody - Draft body text to insert
     * @returns {Promise<void>}
     */
    async createDraftInEmailUI(draftBody) {
        const { provider, selectors } = this.siteConfig;
        
        if (provider === 'gmail') {
            await this.createGmailDraft(draftBody);
        } else if (provider === 'outlook') {
            await this.createOutlookDraft(draftBody);
        } else {
            throw new Error(`Unsupported email provider: ${provider}`);
        }
    }

    /**
     * Create draft in Gmail
     */
    async createGmailDraft(draftBody) {
        // Find and click Reply button
        const replySelectors = [
            '[aria-label*="Reply"]',
            '[data-tooltip*="Reply"]',
            '[data-tooltip*="Reply all"]',
            'div[role="button"][aria-label*="Reply"]',
            '.ams.bkH button[aria-label*="Reply"]',
            '[gh="cm"]', // Gmail compose shortcut
            'div[role="button"][data-tooltip="Reply"]'
        ];

        let replyButton = null;
        for (const selector of replySelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                if ((text.includes('reply') || ariaLabel.includes('reply')) && 
                    !ariaLabel.includes('reply all') && 
                    !ariaLabel.includes('forward')) {
                    replyButton = btn;
                    break;
                }
            }
            if (replyButton) break;
        }

        if (!replyButton) {
            throw new Error('Could not find Reply button in Gmail');
        }

        // Click Reply button
        replyButton.click();
        
        // Wait for compose window to open
        await new Promise(resolve => setTimeout(resolve, 500));

        // Find compose body editor
        const composeBodySelectors = [
            '.Am.Al.editable',
            '[contenteditable="true"][aria-label*="Message"]',
            '[contenteditable="true"][aria-label*="Email"]',
            '.Am.Al.editable[contenteditable="true"]',
            'div[contenteditable="true"][aria-label*="Message Body"]'
        ];

        let composeBody = null;
        let retries = 0;
        while (!composeBody && retries < 20) {
            for (const selector of composeBodySelectors) {
                const element = document.querySelector(selector);
                if (element && element.offsetParent !== null) { // Check if visible
                    composeBody = element;
                    break;
                }
            }
            if (!composeBody) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }
        }

        if (!composeBody) {
            throw new Error('Could not find compose body editor in Gmail');
        }

        // Focus and insert content
        composeBody.focus();
        
        // Clear any existing content
        composeBody.textContent = '';
        
        // Insert draft body with preserved newlines
        // Convert newlines to <br> tags for contenteditable elements
        const formattedBody = this.formatDraftContentForEditor(draftBody);
        composeBody.innerHTML = formattedBody;
        
        // Trigger input event to ensure Gmail recognizes the change
        const inputEvent = new Event('input', { bubbles: true });
        composeBody.dispatchEvent(inputEvent);
        
        // Also trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        composeBody.dispatchEvent(changeEvent);

        console.log('Draft content inserted into Gmail compose window');
    }

    /**
     * Create draft in Outlook
     */
    async createOutlookDraft(draftBody) {
        // Find and click Reply button
        const replySelectors = [
            '[aria-label*="Reply"]',
            '[data-testid*="reply"]',
            'button[aria-label*="Reply"]',
            '[role="button"][aria-label*="Reply"]',
            'button:has-text("Reply")',
            '[title*="Reply"]'
        ];

        let replyButton = null;
        for (const selector of replySelectors) {
            const buttons = Array.from(document.querySelectorAll(selector));
            for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase() || '';
                const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
                const title = btn.getAttribute('title')?.toLowerCase() || '';
                if ((text.includes('reply') || ariaLabel.includes('reply') || title.includes('reply')) && 
                    !ariaLabel.includes('reply all') && 
                    !ariaLabel.includes('forward')) {
                    // Check if button is visible
                    if (btn.offsetParent !== null) {
                        replyButton = btn;
                        break;
                    }
                }
            }
            if (replyButton) break;
        }

        if (!replyButton) {
            throw new Error('Could not find Reply button in Outlook');
        }

        // Click Reply button
        replyButton.click();
        
        // Wait for compose window to open
        await new Promise(resolve => setTimeout(resolve, 800));

        // Find compose body editor
        const composeBodySelectors = [
            '[data-testid="compose-body"]',
            '[data-testid="compose-body-wrapper"] [contenteditable="true"]',
            '[aria-label*="Message body"]',
            '[contenteditable="true"][aria-label*="Message"]',
            '[contenteditable="true"][data-testid*="compose"]',
            '.elementToProof',
            '[role="textbox"]'
        ];

        let composeBody = null;
        let retries = 0;
        while (!composeBody && retries < 25) {
            for (const selector of composeBodySelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    // Check if it's in the compose area
                    const composeArea = element.closest('[data-testid*="compose"]');
                    if (composeArea && element.offsetParent !== null) {
                        composeBody = element;
                        break;
                    }
                }
                if (composeBody) break;
            }
            if (!composeBody) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }
        }

        if (!composeBody) {
            throw new Error('Could not find compose body editor in Outlook');
        }

        // Focus and insert content
        composeBody.focus();
        
        // Clear any existing content
        if (composeBody.textContent) {
            composeBody.textContent = '';
        }
        
        // Insert draft body with preserved newlines
        // Convert newlines to <br> tags for contenteditable elements
        const formattedBody = this.formatDraftContentForEditor(draftBody);
        composeBody.innerHTML = formattedBody;
        
        // Trigger input event
        const inputEvent = new Event('input', { bubbles: true });
        composeBody.dispatchEvent(inputEvent);
        
        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true });
        composeBody.dispatchEvent(changeEvent);

        console.log('Draft content inserted into Outlook compose window');
    }
}

// Initialize the extractor when the page loads
try {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Inbox Triage: DOMContentLoaded, creating extractor instance');
            try {
                globalExtractorInstance = new EmailThreadExtractor();
            } catch (error) {
                console.error('Inbox Triage: Failed to create extractor instance:', error);
            }
        });
    } else {
        console.log('Inbox Triage: Document already loaded, creating extractor instance');
        try {
            globalExtractorInstance = new EmailThreadExtractor();
        } catch (error) {
            console.error('Inbox Triage: Failed to create extractor instance:', error);
        }
    }
} catch (error) {
    console.error('Inbox Triage: Failed to initialize extractor:', error);
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
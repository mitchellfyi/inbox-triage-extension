/**
 * CSS Selectors for Gmail and Outlook email extraction
 * These selectors target the email thread content in different email providers
 */

const EMAIL_SELECTORS = {
    gmail: {
        // Main thread container
        threadContainer: '[data-thread-id]',
        
        // Individual email messages within thread
        messages: '[data-message-id]',
        
        // Email content areas
        messageBody: '[data-message-id] .ii.gt div',
        messageBodyAlt: '[data-message-id] .a3s.aiL',
        
        // Subject line
        subject: 'h2[data-thread-id] span',
        subjectAlt: '[data-legacy-thread-id] h2 span',
        
        // Sender information
        sender: '[data-message-id] .go span[email]',
        senderName: '[data-message-id] .go .qu span[title]',
        
        // Date/time
        timestamp: '[data-message-id] .g3 span[title]',
        
        // Thread view indicator
        threadView: '[data-thread-id]',
        
        // Compose/reply area (to avoid extracting)
        composeArea: '.M9[data-message-id]',
        draftArea: '[data-is-draft="true"]',
        
        // Attachment selectors
        attachments: '[data-message-id] .aZo',
        attachmentLinks: '[data-message-id] .aZo a',
        attachmentNames: '[data-message-id] .aZo .aV3',
        attachmentSizes: '[data-message-id] .aZo .SaRA'
    },
    
    outlook: {
        // Main thread container
        threadContainer: '[data-convid]',
        
        // Individual messages
        messages: '[data-convid] [role="listitem"]',
        
        // Message content
        messageBody: '[data-testid="message-body-content"]',
        messageBodyAlt: '.rps_1679 .elementToProof',
        
        // Subject
        subject: '[data-testid="conversation-subject"]',
        subjectAlt: 'h1[id*="subject"]',
        
        // Sender information  
        sender: '[data-testid="message-header-sender-name"]',
        senderEmail: '[data-testid="message-header-sender-email"]',
        
        // Timestamp
        timestamp: '[data-testid="message-header-date"]',
        
        // Thread container
        threadView: '[data-testid="conversation-container"]',
        
        // Areas to avoid
        composeArea: '[data-testid="compose-body-wrapper"]',
        replyArea: '[data-testid="reply-compose-box"]',
        
        // Attachment selectors
        attachments: '[data-testid*="attachment"]',
        attachmentLinks: '[data-testid*="attachment"] a',
        attachmentNames: '[data-testid="attachment-name"]',
        attachmentSizes: '[data-testid="attachment-size"]'
    }
};

/**
 * Get the appropriate selectors for the current email provider
 */
function getSelectorsForCurrentSite() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('mail.google.com')) {
        return { provider: 'gmail', selectors: EMAIL_SELECTORS.gmail };
    } else if (hostname.includes('outlook.')) {
        return { provider: 'outlook', selectors: EMAIL_SELECTORS.outlook };
    }
    
    return null;
}

/**
 * Additional utility selectors that might be useful
 */
const UTILITY_SELECTORS = {
    // Common patterns for avoiding extraction of certain elements
    skipElements: [
        '[data-is-draft="true"]',
        '.compose',
        '.reply-box',
        '[data-testid*="compose"]',
        '.gmail_signature',
        '.signature'
    ],
    
    // Loading indicators
    loadingIndicators: [
        '.loading',
        '[data-testid="loading"]',
        '.spinner'
    ]
};

// Export for use in content script
if (typeof module !== 'undefined') {
    module.exports = { EMAIL_SELECTORS, getSelectorsForCurrentSite, UTILITY_SELECTORS };
}
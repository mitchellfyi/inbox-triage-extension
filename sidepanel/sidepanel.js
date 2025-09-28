/**
 * Side Panel JavaScript for Inbox Triage Extension
 * Handles UI interactions and communication with content scripts
 */

class InboxTriageSidePanel {
    constructor() {
        this.currentThread = null;
        this.currentSummary = null;
        this.currentDrafts = [];
        
        this.initializeElements();
        this.bindEvents();
        this.checkInitialStatus();
    }
    
    async checkInitialStatus() {
        try {
            this.updateStatus('Checking AI model availability...', 'loading');
            
            // Check if we're in an extension context
            if (!chrome?.runtime?.sendMessage) {
                this.updateStatus('Running outside Chrome extension context - AI features unavailable', 'error');
                return;
            }
            
            // Request current AI status from background script
            const response = await chrome.runtime.sendMessage({
                action: 'checkAIStatus'
            });
            
            if (response && response.success) {
                const { summarizer, promptApi, available } = response.capabilities;
                
                if (available) {
                    // Check individual model status
                    let readyModels = [];
                    let downloadingModels = [];
                    let unavailableModels = [];
                    
                    if (summarizer) {
                        if (summarizer.available === 'readily') {
                            readyModels.push('Summarization');
                        } else if (summarizer.available === 'after-download') {
                            downloadingModels.push('Summarization');
                        } else {
                            unavailableModels.push('Summarization');
                        }
                    }
                    
                    if (promptApi) {
                        if (promptApi.available === 'readily') {
                            readyModels.push('Reply Drafting');
                        } else if (promptApi.available === 'after-download') {
                            downloadingModels.push('Reply Drafting');
                        } else {
                            unavailableModels.push('Reply Drafting');
                        }
                    }
                    
                    // Update status based on model states
                    if (readyModels.length > 0 && downloadingModels.length === 0 && unavailableModels.length === 0) {
                        this.updateStatus('AI models ready. You can analyze email threads.', 'success');
                    } else if (downloadingModels.length > 0) {
                        this.updateStatus(`AI models downloading: ${downloadingModels.join(', ')}. This may take several minutes...`, 'loading');
                    } else if (unavailableModels.length > 0) {
                        this.updateStatus('Some AI features are not available. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.', 'error');
                    } else {
                        this.updateStatus('Ready to analyze email threads', 'success');
                    }
                } else {
                    this.updateStatus('AI features not available. Please use Chrome 120+ with experimental AI enabled.', 'error');
                }
            } else {
                this.updateStatus('Unable to check AI model status. Ready to analyze email threads.', 'info');
            }
        } catch (error) {
            console.error('Error checking initial status:', error);
            this.updateStatus('Unable to check AI model status. Ready to analyze email threads.', 'info');
        }
    }
    
    initializeElements() {
        this.elements = {
            status: document.getElementById('status-text'),
            extractBtn: document.getElementById('extract-btn'),
            summary: document.getElementById('summary'),
            keyPoints: document.getElementById('key-points'),
            attachments: document.getElementById('attachments'),
            toneSelector: document.getElementById('tone-selector'),
            generateDraftsBtn: document.getElementById('generate-drafts-btn'),
            replyDrafts: document.getElementById('reply-drafts')
        };
    }
    
    bindEvents() {
        this.elements.extractBtn.addEventListener('click', () => this.extractCurrentThread());
        this.elements.generateDraftsBtn.addEventListener('click', () => this.generateReplyDrafts());
        this.elements.toneSelector.addEventListener('change', () => this.onToneChange());
        
        // Keyboard navigation support
        this.elements.extractBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.extractCurrentThread();
            }
        });
        
        this.elements.generateDraftsBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.generateReplyDrafts();
            }
        });
        
        // Listen for messages from content scripts and background
        if (chrome?.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                this.handleMessage(message, sender, sendResponse);
            });
        }
    }
    
    updateStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        const statusElement = this.elements.status.parentElement;
        
        // Remove existing status classes
        statusElement.classList.remove('loading', 'error', 'success', 'info');
        // Add new status class
        statusElement.classList.add(type);
        
        // Update ARIA live region for screen readers
        this.elements.status.setAttribute('aria-label', `Status: ${message}`);
    }

    async extractCurrentThread() {
        try {
            this.updateStatus('Extracting thread text...', 'loading');
            this.elements.extractBtn.disabled = true;
            
            // Check if we're in an extension context
            if (!chrome?.tabs?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            // Get current active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) {
                throw new Error('No active tab found');
            }
            
            // Send message to content script to extract thread
            const response = await chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'extractThread' 
            });
            
            if (response && response.success) {
                this.currentThread = response.thread;
                await this.generateSummary();
                this.displayAttachments();
                this.elements.generateDraftsBtn.disabled = false;
                this.updateStatus('Thread extracted successfully', 'success');
            } else {
                throw new Error(response?.error || 'Failed to extract thread');
            }
        } catch (error) {
            console.error('Error extracting thread:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.elements.extractBtn.disabled = false;
        }
    }
    
    async generateSummary() {
        if (!this.currentThread) return;
        
        try {
            this.updateStatus('Generating summary...', 'loading');
            
            // Check if we're in an extension context
            if (!chrome?.runtime?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            // Request summary generation from background script
            const response = await chrome.runtime.sendMessage({
                action: 'generateSummary',
                thread: this.currentThread
            });
            
            if (response && response.success) {
                this.displaySummary(response.summary, response.keyPoints);
                this.updateStatus('Summary generated successfully', 'success');
            } else {
                // Error message is already sanitized by the service worker
                throw new Error(response?.error || 'Failed to generate summary');
            }
        } catch (error) {
            console.error('Error generating summary:', error);
            // Display the sanitized error message from the service worker
            this.updateStatus(`Summary error: ${error.message}`, 'error');
        }
    }
    
    displaySummary(summary, keyPoints) {
        this.elements.summary.textContent = summary;
        this.elements.summary.classList.remove('placeholder');
        
        if (keyPoints && keyPoints.length > 0) {
            const pointsList = document.createElement('ul');
            pointsList.setAttribute('role', 'list');
            
            keyPoints.forEach((point, index) => {
                const li = document.createElement('li');
                li.textContent = point;
                li.setAttribute('role', 'listitem');
                pointsList.appendChild(li);
            });
            
            this.elements.keyPoints.innerHTML = '';
            this.elements.keyPoints.appendChild(pointsList);
            this.elements.keyPoints.classList.remove('placeholder');
            this.elements.keyPoints.setAttribute('aria-label', `${keyPoints.length} key points extracted from email thread`);
        }
    }
    
    /**
     * Display attachments in the side panel
     */
    displayAttachments() {
        const attachments = this.currentThread?.attachments || [];
        
        if (attachments.length === 0) {
            this.elements.attachments.innerHTML = '<div class="placeholder">No attachments found in current thread.</div>';
            return;
        }
        
        // Create attachments list
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.className = 'attachments-container';
        
        attachments.forEach((attachment, index) => {
            const attachmentCard = this.createAttachmentCard(attachment, index);
            attachmentsContainer.appendChild(attachmentCard);
        });
        
        this.elements.attachments.innerHTML = '';
        this.elements.attachments.appendChild(attachmentsContainer);
        this.elements.attachments.classList.remove('placeholder');
        this.elements.attachments.setAttribute('aria-label', `${attachments.length} attachments found in email thread`);
        
        // Process attachments for summaries
        this.processAttachments(attachments);
    }
    
    /**
     * Create an attachment card element
     * @param {Object} attachment - Attachment metadata
     * @param {number} index - Card index
     * @returns {HTMLElement} Attachment card element
     */
    createAttachmentCard(attachment, index) {
        const card = document.createElement('div');
        card.className = 'attachment-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Attachment: ${attachment.name}, ${attachment.size || 'unknown size'}`);
        
        // Create attachment header
        const header = document.createElement('div');
        header.className = 'attachment-header';
        
        // Create file type icon
        const icon = document.createElement('div');
        icon.className = `attachment-icon ${attachment.type}`;
        icon.textContent = this.getFileTypeIcon(attachment.type);
        
        // Create attachment info
        const info = document.createElement('div');
        info.className = 'attachment-info';
        
        const name = document.createElement('div');
        name.className = 'attachment-name';
        name.textContent = attachment.name;
        name.title = attachment.name; // For overflow tooltip
        
        const meta = document.createElement('div');
        meta.className = 'attachment-meta';
        
        const size = document.createElement('span');
        size.textContent = attachment.size || 'Unknown size';
        
        const processable = document.createElement('span');
        processable.textContent = attachment.processable ? 'Processable' : 'View only';
        
        meta.appendChild(size);
        meta.appendChild(processable);
        
        info.appendChild(name);
        info.appendChild(meta);
        
        header.appendChild(icon);
        header.appendChild(info);
        
        card.appendChild(header);
        
        // Create summary section (initially with placeholder)
        const summary = document.createElement('div');
        summary.className = 'attachment-summary';
        
        if (attachment.processable) {
            summary.innerHTML = '<span class="attachment-loading">Analyzing attachment...</span>';
        } else {
            summary.innerHTML = '<span class="attachment-error">File type not supported for analysis</span>';
        }
        
        card.appendChild(summary);
        
        // Add click handler for future detailed view
        card.addEventListener('click', () => this.showAttachmentDetails(attachment));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.showAttachmentDetails(attachment);
            }
        });
        
        return card;
    }
    
    /**
     * Get icon text for file type
     * @param {string} fileType - File type category
     * @returns {string} Icon text
     */
    getFileTypeIcon(fileType) {
        switch (fileType) {
            case 'pdf': return 'PDF';
            case 'docx': return 'DOC';
            case 'xlsx': return 'XLS';
            case 'image': return 'IMG';
            default: return '?';
        }
    }
    
    /**
     * Process attachments for AI summarization
     * @param {Array} attachments - List of attachments to process
     */
    async processAttachments(attachments) {
        for (const attachment of attachments) {
            if (attachment.processable) {
                try {
                    // For now, just show a placeholder
                    // TODO: Implement actual file processing and AI summarization
                    await this.processAttachment(attachment);
                } catch (error) {
                    console.error('Error processing attachment:', error);
                    this.updateAttachmentSummary(attachment.index, 'Error processing attachment', true);
                }
            }
        }
    }
    
    /**
     * Process a single attachment (now calls service worker)
     * @param {Object} attachment - Attachment to process
     */
    async processAttachment(attachment) {
        try {
            // Check if we're in an extension context
            if (!chrome?.runtime?.sendMessage) {
                throw new Error('Chrome extension API not available');
            }
            
            const response = await chrome.runtime.sendMessage({
                action: 'processAttachment',
                attachment: attachment
            });
            
            if (response && response.success) {
                const processedAttachment = response.attachment;
                this.updateAttachmentSummary(processedAttachment.index, processedAttachment.summary, false);
            } else {
                const errorMsg = response?.error || 'Failed to process attachment';
                this.updateAttachmentSummary(attachment.index, errorMsg, true);
            }
            
        } catch (error) {
            console.error('Error processing attachment via service worker:', error);
            
            // Provide fallback message for non-extension contexts
            if (error.message.includes('Chrome extension API not available')) {
                this.updateAttachmentSummary(attachment.index, 'Extension API required for attachment processing', true);
            } else {
                this.updateAttachmentSummary(attachment.index, `Error: ${error.message}`, true);
            }
        }
    }
    
    /**
     * Update attachment summary in the UI
     * @param {number} attachmentIndex - Index of attachment
     * @param {string} summary - Summary text
     * @param {boolean} isError - Whether this is an error message
     */
    updateAttachmentSummary(attachmentIndex, summary, isError = false) {
        const cards = this.elements.attachments.querySelectorAll('.attachment-card');
        if (cards[attachmentIndex]) {
            const summaryEl = cards[attachmentIndex].querySelector('.attachment-summary');
            if (summaryEl) {
                summaryEl.innerHTML = `<span class="${isError ? 'attachment-error' : ''}">${summary}</span>`;
            }
        }
    }
    
    /**
     * Show detailed view of attachment (placeholder for now)
     * @param {Object} attachment - Attachment to show details for
     */
    showAttachmentDetails(attachment) {
        // TODO: Implement modal or expanded view
        console.log('Showing details for attachment:', attachment);
        alert(`Detailed view for ${attachment.name}\n\nThis feature will show full extracted content and detailed analysis.`);
    }
    
    async generateReplyDrafts() {
        if (!this.currentThread) return;
        
        try {
            this.updateStatus('Generating reply drafts...', 'loading');
            this.elements.generateDraftsBtn.disabled = true;
            
            // Check if we're in an extension context
            if (!chrome?.runtime?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            const tone = this.elements.toneSelector.value;
            const response = await chrome.runtime.sendMessage({
                action: 'generateDrafts',
                thread: this.currentThread,
                tone: tone
            });
            
            if (response && response.success) {
                this.currentDrafts = response.drafts;
                this.displayReplyDrafts(response.drafts);
                
                // Check if there was a warning (fallback used)
                if (response.warning) {
                    this.updateStatus(`Reply drafts generated with fallback: ${response.warning}`, 'success');
                } else {
                    this.updateStatus('Reply drafts generated successfully', 'success');
                }
            } else {
                // Error message is already sanitized by the service worker
                throw new Error(response?.error || 'Failed to generate drafts');
            }
        } catch (error) {
            console.error('Error generating drafts:', error);
            
            // Display the sanitized error message from the service worker
            this.updateStatus(`Draft error: ${error.message}`, 'error');
        } finally {
            this.elements.generateDraftsBtn.disabled = false;
        }
    }
    
    displayReplyDrafts(drafts) {
        this.elements.replyDrafts.innerHTML = '';
        this.elements.replyDrafts.classList.remove('placeholder');
        
        if (drafts && drafts.length > 0) {
            this.elements.replyDrafts.setAttribute('aria-label', `${drafts.length} reply drafts generated`);
            
            drafts.forEach((draft, index) => {
                const draftElement = this.createDraftElement(draft, index);
                this.elements.replyDrafts.appendChild(draftElement);
            });
        } else {
            this.elements.replyDrafts.innerHTML = '<div class="placeholder">No drafts to display.</div>';
            this.elements.replyDrafts.setAttribute('aria-label', 'No reply drafts available');
        }
    }
    
    createDraftElement(draft, index) {
        const draftDiv = document.createElement('div');
        draftDiv.className = 'draft';
        draftDiv.setAttribute('role', 'article');
        draftDiv.setAttribute('aria-labelledby', `draft-title-${index}`);
        
        // Escape content to prevent XSS
        const escapedSubject = this.escapeHtml(draft.subject || `Draft ${index + 1}`);
        const escapedBody = this.escapeHtml(draft.body || '');
        const escapedType = this.escapeHtml(draft.type || `Draft ${index + 1}`);
        
        draftDiv.innerHTML = `
            <div class="draft-header">
                <h3 id="draft-title-${index}">${escapedType}</h3>
                <button type="button" 
                        onclick="copyToClipboard('${escapedSubject}', '${escapedBody}', this)"
                        aria-describedby="copy-help-${index}">
                    Copy Draft
                </button>
                <span id="copy-help-${index}" class="sr-only">
                    Copy this reply draft to clipboard including subject and body
                </span>
            </div>
            <div class="draft-content">
                <div class="draft-subject"><strong>Subject:</strong> ${escapedSubject}</div>
                <div class="draft-body">${escapedBody}</div>
            </div>
        `;
        return draftDiv;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    onToneChange() {
        if (this.currentThread && this.currentDrafts.length > 0) {
            // Show immediate feedback that tone is being applied
            this.updateStatus('Regenerating drafts with new tone...', 'loading');
            // Auto-regenerate drafts when tone changes
            this.generateReplyDrafts();
        }
    }
    
    handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'threadExtracted':
                // Handle thread extraction completion from content script
                break;
            case 'modelStatus':
                // Handle AI model availability updates
                this.updateModelStatus(message.type, message.capabilities);
                break;
            default:
                console.log('Unhandled message:', message);
        }
    }
    
    updateModelStatus(type, capabilities) {
        console.log('Model status update:', type, capabilities);
        
        switch (type) {
            case 'none':
                this.updateStatus('AI features not available. Please use Chrome 120+ with experimental AI enabled.', 'error');
                break;
                
            case 'error':
                this.updateStatus(`AI initialization error: ${capabilities?.error || 'Unknown error'}`, 'error');
                break;
                
            case 'summarizer':
                this.handleSummarizerStatus(capabilities);
                break;
                
            case 'promptApi':
                this.handlePromptApiStatus(capabilities);
                break;
                
            case 'summarizing':
                this.handleSummarizingProgress(capabilities);
                break;
                
            default:
                console.log('Unknown model status type:', type);
        }
    }
    
    handleSummarizerStatus(capabilities) {
        if (!capabilities) return;
        
        if (capabilities.available === 'readily') {
            console.log('Summarizer model is ready');
            // Enable summary button if available
            const summaryBtn = document.querySelector('#generate-summary-btn, .generate-summary');
            if (summaryBtn) {
                summaryBtn.disabled = false;
                summaryBtn.textContent = 'Generate Summary';
                summaryBtn.title = '';
            }
        } else if (capabilities.available === 'after-download') {
            this.updateStatus('AI summarization model is downloading. This may take several minutes...', 'loading');
            this.disableSummaryGeneration('Model downloading...');
        } else if (capabilities.available === 'no') {
            this.updateStatus('AI summarization is not available. Please enable Chrome AI in Settings > Privacy and security > Experimental AI, or try using Chrome 120+.', 'error');
            this.disableSummaryGeneration('AI summarization unavailable');
        }
    }
    
    handlePromptApiStatus(capabilities) {
        if (!capabilities) return;
        
        if (capabilities.available === 'readily') {
            console.log('Language model is ready');
            // Enable draft generation if summarizer is also available
            this.updateDraftButtonState();
        } else if (capabilities.available === 'after-download') {
            this.updateStatus('AI reply drafting model is downloading. This can take several minutes...', 'loading');
            this.disableDraftGeneration('Model downloading...');
        } else if (capabilities.available === 'no') {
            this.updateStatus('AI reply drafting is not available. Please enable Chrome AI in Settings > Privacy and security > Experimental AI, or try using Chrome 120+.', 'error');
            this.disableDraftGeneration('AI drafting unavailable');
        }
    }
    
    handleSummarizingProgress(capabilities) {
        if (!capabilities) return;
        
        switch (capabilities.stage) {
            case 'generating_tldr':
                this.updateStatus('Generating TL;DR summary...', 'loading');
                break;
            case 'generating_key_points':
                this.updateStatus('Extracting key points...', 'loading');
                break;
            case 'completed':
                // Don't update status here - let the generateSummary method handle success
                break;
            case 'error':
                this.updateStatus(`Summarization error: ${capabilities.error}`, 'error');
                break;
        }
    }
    
    /**
     * Update draft generation button state based on model availability
     */
    updateDraftButtonState() {
        // Check if we have at least one AI model available
        if (this.elements.generateDraftsBtn) {
            this.elements.generateDraftsBtn.disabled = false;
            this.elements.generateDraftsBtn.textContent = 'Generate Drafts';
            this.elements.generateDraftsBtn.title = '';
        }
    }
    
    /**
     * Disable draft generation with user-friendly message
     * @param {string} reason - Reason for disabling
     */
    disableDraftGeneration(reason) {
        if (this.elements.generateDraftsBtn) {
            this.elements.generateDraftsBtn.disabled = true;
            this.elements.generateDraftsBtn.textContent = reason;
            this.elements.generateDraftsBtn.title = `Cannot generate drafts: ${reason}`;
        }
    }
    
    /**
     * Disable summary generation with user-friendly message
     * @param {string} reason - Reason for disabling
     */
    disableSummaryGeneration(reason) {
        const summaryBtn = document.querySelector('#generate-summary-btn, .generate-summary');
        if (summaryBtn) {
            summaryBtn.disabled = true;
            summaryBtn.textContent = reason;
            summaryBtn.title = `Cannot generate summary: ${reason}`;
        }
    }
}

// Global function to copy drafts to clipboard with visual feedback
window.copyToClipboard = async (subject, body, buttonElement) => {
    try {
        const fullText = `Subject: ${subject}\n\n${body}`;
        await navigator.clipboard.writeText(fullText);
        
        if (buttonElement) {
            // Show visual feedback
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'Copied!';
            buttonElement.classList.add('copy-success');
            buttonElement.setAttribute('aria-label', 'Draft copied to clipboard successfully');
            
            // Reset after 2 seconds
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.classList.remove('copy-success');
                buttonElement.setAttribute('aria-label', 'Copy this reply draft to clipboard');
            }, 2000);
        }
        
        console.log('Draft copied to clipboard');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        if (buttonElement) {
            const originalText = buttonElement.textContent;
            buttonElement.textContent = 'Copy Failed';
            buttonElement.style.background = '#f44336';
            
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.style.background = '';
            }, 2000);
        }
    }
};

// Initialize side panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InboxTriageSidePanel();
});
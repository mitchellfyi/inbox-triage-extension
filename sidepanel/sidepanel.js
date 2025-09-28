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
            
            // Request current AI status from background script
            const response = await chrome.runtime.sendMessage({
                action: 'checkAIStatus'
            });
            
            if (response && response.success) {
                if (response.capabilities.available) {
                    this.updateStatus('Ready to analyse email threads', 'success');
                } else {
                    this.updateStatus('AI models not ready. Some features may be limited.', 'error');
                }
            } else {
                this.updateStatus('Ready to analyse email threads');
            }
        } catch (error) {
            console.error('Error checking initial status:', error);
            this.updateStatus('Ready to analyse email threads');
        }
    }
    
    initializeElements() {
        this.elements = {
            status: document.getElementById('status-text'),
            extractBtn: document.getElementById('extract-btn'),
            summary: document.getElementById('summary'),
            keyPoints: document.getElementById('key-points'),
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
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
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
            
            // Request summary generation from background script
            const response = await chrome.runtime.sendMessage({
                action: 'generateSummary',
                thread: this.currentThread
            });
            
            if (response && response.success) {
                this.displaySummary(response.summary, response.keyPoints);
                this.updateStatus('Summary generated successfully', 'success');
            } else {
                throw new Error(response?.error || 'Failed to generate summary');
            }
        } catch (error) {
            console.error('Error generating summary:', error);
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
    
    async generateReplyDrafts() {
        if (!this.currentThread) return;
        
        try {
            this.updateStatus('Generating reply drafts...', 'loading');
            this.elements.generateDraftsBtn.disabled = true;
            
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
                throw new Error(response?.error || 'Failed to generate drafts');
            }
        } catch (error) {
            console.error('Error generating drafts:', error);
            
            // Provide more specific error messages
            let errorMessage = error.message;
            if (errorMessage.includes('Language Model API not available')) {
                errorMessage = 'AI drafting feature is not available. Please use Chrome 120+ with experimental AI features enabled.';
            } else if (errorMessage.includes('downloading')) {
                errorMessage = 'AI model is still downloading. This can take several minutes. Please try again shortly.';
            }
            
            this.updateStatus(`Draft error: ${errorMessage}`, 'error');
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
        } else if (capabilities.available === 'after-download') {
            this.updateStatus('AI model is downloading. This may take several minutes...', 'loading');
        } else if (capabilities.available === 'no') {
            this.updateStatus('AI summarization is not available. Please enable Chrome AI in Settings > Privacy and security > Experimental AI.', 'error');
        }
    }
    
    handlePromptApiStatus(capabilities) {
        if (!capabilities) return;
        
        if (capabilities.available === 'readily') {
            console.log('Language model is ready');
        } else if (capabilities.available === 'after-download') {
            console.log('Language model is downloading...');
        } else if (capabilities.available === 'no') {
            console.log('Language model is not available');
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
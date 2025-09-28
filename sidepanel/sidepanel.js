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
        this.updateStatus('Ready to analyze email threads');
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
        
        // Listen for messages from content scripts and background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
        });
    }
    
    updateStatus(message, type = 'info') {
        this.elements.status.textContent = message;
        const statusElement = this.elements.status.parentElement;
        statusElement.className = `status ${type}`;
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
                this.updateStatus('Thread extracted successfully');
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
                this.updateStatus('Summary generated successfully');
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
            keyPoints.forEach(point => {
                const li = document.createElement('li');
                li.textContent = point;
                pointsList.appendChild(li);
            });
            this.elements.keyPoints.innerHTML = '';
            this.elements.keyPoints.appendChild(pointsList);
            this.elements.keyPoints.classList.remove('placeholder');
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
                this.updateStatus('Reply drafts generated successfully');
            } else {
                throw new Error(response?.error || 'Failed to generate drafts');
            }
        } catch (error) {
            console.error('Error generating drafts:', error);
            this.updateStatus(`Draft error: ${error.message}`, 'error');
        } finally {
            this.elements.generateDraftsBtn.disabled = false;
        }
    }
    
    displayReplyDrafts(drafts) {
        this.elements.replyDrafts.innerHTML = '';
        this.elements.replyDrafts.classList.remove('placeholder');
        
        drafts.forEach((draft, index) => {
            const draftElement = this.createDraftElement(draft, index);
            this.elements.replyDrafts.appendChild(draftElement);
        });
    }
    
    createDraftElement(draft, index) {
        const draftDiv = document.createElement('div');
        draftDiv.className = 'draft';
        draftDiv.innerHTML = `
            <div class="draft-header">
                <h3>${draft.type || `Draft ${index + 1}`}</h3>
                <button type="button" onclick="copyToClipboard('${draft.subject}', '${draft.body}')">
                    Copy
                </button>
            </div>
            <div class="draft-subject"><strong>Subject:</strong> ${draft.subject}</div>
            <div class="draft-body">${draft.body}</div>
        `;
        return draftDiv;
    }
    
    onToneChange() {
        if (this.currentThread && this.currentDrafts.length > 0) {
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
                this.updateModelStatus(message.status);
                break;
            default:
                console.log('Unhandled message:', message);
        }
    }
    
    updateModelStatus(status) {
        // TODO: Update UI based on AI model availability
        console.log('Model status:', status);
    }
}

// Global function to copy drafts to clipboard
window.copyToClipboard = async (subject, body) => {
    try {
        const fullText = `Subject: ${subject}\n\n${body}`;
        await navigator.clipboard.writeText(fullText);
        // Could show a temporary success message here
        console.log('Draft copied to clipboard');
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
    }
};

// Initialize side panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InboxTriageSidePanel();
});
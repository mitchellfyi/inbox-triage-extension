/**
 * Side Panel JavaScript for Inbox Triage Extension
 * Handles UI interactions and communication with content scripts
 */

class InboxTriageSidePanel {
    constructor() {
        this.currentThread = null;
        this.currentSummary = null;
        this.currentDrafts = [];
        this.userSettings = {
            processingMode: 'device-only', // default to on-device only
            useApiKey: false,
            apiKey: '',
            apiProvider: 'google' // google, anthropic, openai
        };
        this.currentContext = {
            isOnEmailThread: false,
            provider: null, // 'gmail' or 'outlook'
            url: ''
        };
        this.translationSettings = {
            targetLanguage: 'none',
            originalSummary: null,
            originalKeyPoints: null,
            originalDrafts: new Map() // Map<draftIndex, originalBody>
        };
        this.statusHideTimeout = null;
        
        this.initializeElements();
        this.bindEvents();
        this.loadUserSettings();
        this.checkCurrentContext();
        this.checkInitialStatus();
        
        // Poll for URL changes every 2 seconds
        setInterval(() => {
            this.checkCurrentContext();
        }, 2000);
    }
    
    async checkCurrentContext() {
        try {
            // Check if we're in an extension context
            if (!chrome?.tabs?.query) {
                this.currentContext.isOnEmailThread = false;
                this.updateContextUI();
                return;
            }
            
            // Get current active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) {
                this.currentContext.isOnEmailThread = false;
                this.updateContextUI();
                return;
            }
            
            const url = tabs[0].url || '';
            const previousUrl = this.currentContext.url;
            this.currentContext.url = url;
            
            // Check if URL changed (page navigation or refresh)
            const urlChanged = previousUrl && previousUrl !== url;
            
            // Check if on Gmail or Outlook
            if (url.includes('mail.google.com')) {
                this.currentContext.isOnEmailThread = true;
                this.currentContext.provider = 'gmail';
            } else if (url.includes('outlook.live.com') || url.includes('outlook.office.com') || url.includes('outlook.office365.com')) {
                this.currentContext.isOnEmailThread = true;
                this.currentContext.provider = 'outlook';
            } else {
                this.currentContext.isOnEmailThread = false;
                this.currentContext.provider = null;
            }
            
            this.updateContextUI(urlChanged);
            
        } catch (error) {
            console.error('Error checking current context:', error);
            this.currentContext.isOnEmailThread = false;
            this.updateContextUI();
        }
    }
    
    updateContextUI(urlChanged = false) {
        const extractBtn = this.elements.extractBtn;
        
        // If URL changed, reset the UI state
        if (urlChanged) {
            this.currentThread = null;
            this.currentDrafts = [];
            
            // Show extract button again
            this.showSection(this.elements.extractSection, false);
            
            // Hide all result sections
            this.hideSection(this.elements.summarySection);
            this.hideSection(this.elements.keyPointsSection);
            this.hideSection(this.elements.attachmentsSection);
            this.hideSection(this.elements.replyDraftsControlsSection);
            this.hideSection(this.elements.replyDraftsSection);
            
            // Disable generate drafts button
            this.elements.generateDraftsBtn.disabled = true;
            
            // Clear status message
            this.updateStatus('Ready to analyse email threads', 'info');
        }
        
        if (this.currentContext.isOnEmailThread) {
            extractBtn.disabled = false;
            // Show extract section if it was hidden due to successful extraction
            if (this.elements.extractSection.classList.contains('hidden') && !this.currentThread) {
                this.showSection(this.elements.extractSection, false);
            }
        } else {
            extractBtn.disabled = true;
            this.updateStatus('Navigate to Gmail or Outlook to use this extension', 'info');
        }
    }
    
    async checkInitialStatus() {
        try {
            // Show context-aware status message
            if (!this.currentContext.isOnEmailThread) {
                this.updateStatus('Navigate to Gmail or Outlook to use this extension', 'info');
                return;
            }
            
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
            extractSection: document.getElementById('extract-section'),
            summary: document.getElementById('summary'),
            keyPoints: document.getElementById('key-points'),
            attachments: document.getElementById('attachments'),
            toneSelector: document.getElementById('tone-selector'),
            guidanceText: document.getElementById('guidance-text'),
            micBtn: document.getElementById('mic-btn'),
            micStatus: document.getElementById('mic-status'),
            generateDraftsBtn: document.getElementById('generate-drafts-btn'),
            replyDrafts: document.getElementById('reply-drafts'),
            // Section containers
            summarySection: document.getElementById('summary-section'),
            keyPointsSection: document.getElementById('key-points-section'),
            attachmentsSection: document.getElementById('attachments-section'),
            replyDraftsControlsSection: document.getElementById('reply-drafts-controls-section'),
            replyDraftsSection: document.getElementById('reply-drafts-section'),
            // Settings panel
            settingsToggleBtn: document.getElementById('settings-toggle-btn'),
            settingsPanel: document.getElementById('settings-panel'),
            settingsOverlay: document.getElementById('settings-overlay'),
            settingsCloseBtn: document.getElementById('settings-close-btn'),
            // Settings elements
            deviceOnlyRadio: document.getElementById('mode-device-only'),
            hybridRadio: document.getElementById('mode-hybrid'),
            privacyNotice: document.getElementById('privacy-notice'),
            // API key settings
            useApiKeyCheckbox: document.getElementById('use-api-key'),
            apiKeyInput: document.getElementById('api-key-input'),
            apiProviderSelect: document.getElementById('api-provider'),
            apiKeySection: document.getElementById('api-key-section'),
            saveApiKeyBtn: document.getElementById('save-api-key-btn'),
            // Translation settings
            targetLanguageSelect: document.getElementById('target-language')
        };
        
        // Initialize voice recognition
        this.speechRecognition = null;
        this.isListening = false;
        this.initializeSpeechRecognition();
        
        // Setup accordion functionality
        this.setupAccordions();
    }
    
    /**
     * Setup accordion expand/collapse functionality
     */
    setupAccordions() {
        const accordionHeaders = document.querySelectorAll('.section-header');
        
        accordionHeaders.forEach(header => {
            header.addEventListener('click', () => this.toggleAccordion(header));
            
            // Add keyboard support
            header.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.toggleAccordion(header);
                }
            });
        });
    }
    
    /**
     * Toggle accordion section expand/collapse
     */
    toggleAccordion(header) {
        const section = header.closest('.section');
        const isExpanded = section.classList.contains('expanded');
        
        if (isExpanded) {
            section.classList.remove('expanded');
            header.setAttribute('aria-expanded', 'false');
        } else {
            section.classList.add('expanded');
            header.setAttribute('aria-expanded', 'true');
        }
    }
    
    /**
     * Show a section and optionally expand it
     */
    showSection(sectionElement, autoExpand = true) {
        if (sectionElement) {
            sectionElement.classList.remove('hidden');
            if (autoExpand && !sectionElement.classList.contains('expanded')) {
                sectionElement.classList.add('expanded');
                const header = sectionElement.querySelector('.section-header');
                if (header) {
                    header.setAttribute('aria-expanded', 'true');
                }
            }
        }
    }
    
    /**
     * Hide a section
     */
    hideSection(sectionElement) {
        if (sectionElement) {
            sectionElement.classList.add('hidden');
        }
    }
    
    /**
     * Open the settings panel
     */
    openSettings() {
        this.elements.settingsPanel.classList.add('active');
        this.elements.settingsOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }
    
    /**
     * Close the settings panel
     */
    closeSettings() {
        this.elements.settingsPanel.classList.remove('active');
        this.elements.settingsOverlay.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
    
    bindEvents() {
        this.elements.extractBtn.addEventListener('click', () => this.extractCurrentThread());
        this.elements.generateDraftsBtn.addEventListener('click', () => this.generateReplyDrafts());
        this.elements.toneSelector.addEventListener('change', () => this.onToneChange());
        this.elements.micBtn.addEventListener('click', () => this.toggleVoiceDictation());
        
        // Settings panel toggle
        this.elements.settingsToggleBtn.addEventListener('click', () => this.openSettings());
        this.elements.settingsCloseBtn.addEventListener('click', () => this.closeSettings());
        this.elements.settingsOverlay.addEventListener('click', () => this.closeSettings());
        
        // ESC key to close settings
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.elements.settingsPanel.classList.contains('active')) {
                this.closeSettings();
            }
        });
        
        // Settings event listeners
        this.elements.deviceOnlyRadio.addEventListener('change', () => this.onProcessingModeChange());
        this.elements.hybridRadio.addEventListener('change', () => this.onProcessingModeChange());
        
        // API key settings
        if (this.elements.useApiKeyCheckbox) {
            this.elements.useApiKeyCheckbox.addEventListener('change', () => this.onApiKeyToggle());
        }
        if (this.elements.saveApiKeyBtn) {
            this.elements.saveApiKeyBtn.addEventListener('click', () => this.saveApiKeySettings());
        }
        
        // Translation settings
        if (this.elements.targetLanguageSelect) {
            this.elements.targetLanguageSelect.addEventListener('change', () => this.onLanguageChange());
        }
        
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
        
        this.elements.micBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleVoiceDictation();
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
        // Clear any existing hide timeout
        if (this.statusHideTimeout) {
            clearTimeout(this.statusHideTimeout);
            this.statusHideTimeout = null;
        }
        
        this.elements.status.textContent = message;
        const statusElement = this.elements.status.parentElement;
        
        // Hide status container if message is empty
        if (!message || message.trim() === '') {
            statusElement.classList.add('hidden');
            this.elements.status.setAttribute('aria-label', '');
            return;
        }
        
        // Show status container
        statusElement.classList.remove('hidden');
        
        // Remove existing status classes
        statusElement.classList.remove('loading', 'error', 'success', 'info');
        // Add new status class
        statusElement.classList.add(type);
        
        // Update ARIA live region for screen readers
        this.elements.status.setAttribute('aria-label', `Status: ${message}`);
        
        // Auto-hide after timeout based on type
        // Don't auto-hide loading states (they'll be updated with completion)
        if (type !== 'loading') {
            const hideDelay = type === 'error' ? 10000 : 5000; // Errors stay longer
            this.statusHideTimeout = setTimeout(() => {
                statusElement.classList.add('hidden');
                this.elements.status.setAttribute('aria-label', '');
            }, hideDelay);
        }
    }

    async extractCurrentThread() {
        let extractionSucceeded = false;
        
        try {
            this.updateStatus('Checking page context...', 'loading');
            this.elements.extractBtn.disabled = true;
            
            // Check if we're in an extension context
            if (!chrome?.tabs?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            this.updateStatus('Locating active email tab...', 'loading');
            
            // Get current active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) {
                throw new Error('No active tab found');
            }
            
            const currentTab = tabs[0];
            const currentUrl = currentTab.url || '';
            
            // Verify we're on a supported email provider
            if (!currentUrl.includes('mail.google.com') && 
                !currentUrl.includes('outlook.live.com') && 
                !currentUrl.includes('outlook.office.com') && 
                !currentUrl.includes('outlook.office365.com')) {
                throw new Error('Please navigate to Gmail or Outlook to extract email threads');
            }
            
            const provider = currentUrl.includes('mail.google.com') ? 'Gmail' : 'Outlook';
            this.updateStatus(`Connecting to ${provider}...`, 'loading');
            
            console.log('Sending extractThread message to tab:', currentTab.id, 'URL:', currentUrl);
            
            // Send message to content script to extract thread
            let response;
            try {
                response = await chrome.tabs.sendMessage(currentTab.id, { 
                    action: 'extractThread' 
                });
            } catch (sendError) {
                console.error('Failed to send message to content script:', sendError);
                throw new Error('Could not communicate with the page. Try refreshing the Gmail/Outlook tab and try again.');
            }
            
            this.updateStatus('Reading email thread...', 'loading');
            console.log('Received response from content script:', response);
            
            if (response && response.success) {
                this.currentThread = response.thread;
                
                // Validate thread data
                if (!this.currentThread || !this.currentThread.messages) {
                    throw new Error('Invalid thread data received from content script');
                }
                
                const messageCount = this.currentThread.messages.length;
                const attachmentCount = this.currentThread.attachments?.length || 0;
                
                this.updateStatus(`Extracted ${messageCount} message${messageCount !== 1 ? 's' : ''}, ${attachmentCount} attachment${attachmentCount !== 1 ? 's' : ''}`, 'loading');
                console.log('Thread extracted:', messageCount, 'messages');
                
                await this.generateSummary();
                this.displayAttachments();
                
                // Show reply drafts controls now that we have a thread
                this.showSection(this.elements.replyDraftsControlsSection, false);
                this.elements.generateDraftsBtn.disabled = false;
                
                // Hide extract button now that thread is extracted
                this.hideSection(this.elements.extractSection);
                
                // Mark extraction as successful
                extractionSucceeded = true;
                
                // Show success message (will auto-hide)
                this.updateStatus('✓ Thread analysis complete', 'success');
            } else {
                const errorMsg = response?.error || 'Failed to extract thread - no response from content script';
                console.error('Thread extraction failed:', errorMsg, 'Full response:', response);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('Error extracting thread:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
        } finally {
            // Only re-enable button if extraction failed
            // If succeeded, section is hidden so button state doesn't matter
            if (!extractionSucceeded) {
                this.elements.extractBtn.disabled = false;
            }
        }
    }
    
    async generateSummary() {
        if (!this.currentThread) return;
        
        try {
            this.updateStatus('Preparing content for AI analysis...', 'loading');
            
            // Check if we're in an extension context
            if (!chrome?.runtime?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            const isUsingCloud = this.userSettings.processingMode === 'hybrid';
            const processingType = isUsingCloud ? 'on-device/cloud' : 'on-device';
            
            this.updateStatus(`Generating summary (${processingType} AI)...`, 'loading');
            
            // Request summary generation from background script
            const response = await chrome.runtime.sendMessage({
                action: 'generateSummary',
                thread: this.currentThread,
                userSettings: this.userSettings
            });
            
            if (response && response.success) {
                this.updateStatus('Rendering summary...', 'loading');
                this.displaySummary(response.summary, response.keyPoints);
                this.addProcessingIndicator('summarization', response.usedFallback || false);
                
                // Show final status with processing method
                const method = response.usedFallback ? 'cloud' : 'on-device';
                this.updateStatus(`✓ Summary generated (${method})`, 'success');
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
        // Display summary
        this.elements.summary.textContent = summary;
        this.showSection(this.elements.summarySection);
        
        // Store original summary for translation
        if (!this.translationSettings.originalSummary) {
            this.translationSettings.originalSummary = summary;
        }
        
        // Display key points
        if (keyPoints && keyPoints.length > 0) {
            // Store original key points for translation
            if (!this.translationSettings.originalKeyPoints) {
                this.translationSettings.originalKeyPoints = [...keyPoints];
            }
            
            this.displayKeyPoints(keyPoints);
        }
    }
    
    /**
     * Display key points in the UI
     * @param {Array<string>} keyPoints - Array of key point strings
     */
    displayKeyPoints(keyPoints) {
        if (!keyPoints || keyPoints.length === 0) return;
        
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
        this.elements.keyPoints.setAttribute('aria-label', `${keyPoints.length} key points extracted from email thread`);
        this.showSection(this.elements.keyPointsSection);
    }
    
    /**
     * Display attachments in the side panel
     */
    displayAttachments() {
        const attachments = this.currentThread?.attachments || [];
        
        // Only show section if there are attachments
        if (attachments.length === 0) {
            this.hideSection(this.elements.attachmentsSection);
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
        this.elements.attachments.setAttribute('aria-label', `${attachments.length} attachments found in email thread`);
        
        // Show the section
        this.showSection(this.elements.attachmentsSection);
        
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
        const processableCount = attachments.filter(a => a.processable).length;
        let processed = 0;
        
        for (const attachment of attachments) {
            if (attachment.processable) {
                try {
                    processed++;
                    this.updateStatus(`Analyzing attachment ${processed}/${processableCount}: ${attachment.name}...`, 'loading');
                    await this.processAttachment(attachment);
                } catch (error) {
                    console.error('Error processing attachment:', error);
                    this.updateAttachmentSummary(attachment.index, 'Error processing attachment', true);
                }
            }
        }
        
        if (processableCount > 0) {
            this.updateStatus(`✓ Analyzed ${processableCount} attachment${processableCount !== 1 ? 's' : ''}`, 'success');
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
            this.updateStatus('Preparing draft request...', 'loading');
            this.elements.generateDraftsBtn.disabled = true;
            
            // Check if we're in an extension context
            if (!chrome?.runtime?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            const tone = this.elements.toneSelector.value;
            const guidance = this.elements.guidanceText.value.trim();
            
            const isUsingCloud = this.userSettings.processingMode === 'hybrid';
            const processingType = isUsingCloud ? 'on-device/cloud' : 'on-device';
            
            this.updateStatus(`Composing ${tone} replies (${processingType} AI)...`, 'loading');
            
            const response = await chrome.runtime.sendMessage({
                action: 'generateDrafts',
                thread: this.currentThread,
                tone: tone,
                guidance: guidance,
                userSettings: this.userSettings
            });
            
            if (response && response.success) {
                this.updateStatus('Validating draft quality...', 'loading');
                
                this.currentDrafts = response.drafts;
                this.displayReplyDrafts(response.drafts);
                this.addProcessingIndicator('drafting', response.usedFallback || false);
                
                // Show final status with processing method and count
                const method = response.usedFallback ? 'cloud' : 'on-device';
                const draftCount = response.drafts?.length || 0;
                
                if (response.warning) {
                    this.updateStatus(`✓ ${draftCount} draft${draftCount !== 1 ? 's' : ''} generated (${method}): ${response.warning}`, 'success');
                } else {
                    this.updateStatus(`✓ ${draftCount} ${tone} draft${draftCount !== 1 ? 's' : ''} ready (${method})`, 'success');
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
        
        if (drafts && drafts.length > 0) {
            this.elements.replyDrafts.setAttribute('aria-label', `${drafts.length} reply drafts generated`);
            
            drafts.forEach((draft, index) => {
                const draftElement = this.createDraftElement(draft, index);
                this.elements.replyDrafts.appendChild(draftElement);
            });
            
            // Show the section
            this.showSection(this.elements.replyDraftsSection);
        } else {
            // Hide section if no drafts
            this.hideSection(this.elements.replyDraftsSection);
        }
    }
    
    createDraftElement(draft, index) {
        const draftDiv = document.createElement('div');
        // Only expand the first draft (index 0), collapse others
        const isExpanded = index === 0;
        draftDiv.className = `draft accordion-draft${isExpanded ? ' expanded' : ''}`;
        draftDiv.setAttribute('role', 'article');
        draftDiv.setAttribute('aria-labelledby', `draft-title-${index}`);
        
        // Store reference to draft for copy functionality
        draftDiv._draftData = draft;
        
        // Create header element
        const header = document.createElement('div');
        header.className = 'draft-header';
        header.setAttribute('tabindex', '0');
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        header.setAttribute('aria-controls', `draft-content-${index}`);
        
        // Create title
        const title = document.createElement('h3');
        title.id = `draft-title-${index}`;
        title.textContent = draft.type || `Draft ${index + 1}`;
        
        // Create actions container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'draft-actions';
        
        // Create copy button
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'copy-draft-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.setAttribute('aria-describedby', `copy-help-${index}`);
        
        // Create toggle indicator
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'draft-toggle';
        toggleSpan.setAttribute('aria-hidden', 'true');
        toggleSpan.textContent = '▼';
        
        // Create screen reader help text
        const helpSpan = document.createElement('span');
        helpSpan.id = `copy-help-${index}`;
        helpSpan.className = 'sr-only';
        helpSpan.textContent = 'Copy this reply draft to clipboard';
        
        // Assemble header
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(toggleSpan);
        header.appendChild(title);
        header.appendChild(actionsDiv);
        header.appendChild(helpSpan);
        
        // Create content section
        const content = document.createElement('div');
        content.id = `draft-content-${index}`;
        content.className = 'draft-content';
        
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'draft-body';
        bodyDiv.textContent = draft.body || '';
        
        content.appendChild(bodyDiv);
        
        // Assemble draft element
        draftDiv.appendChild(header);
        draftDiv.appendChild(content);
        
        // Add click handler for accordion toggle
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking the copy button
            if (e.target.closest('.copy-draft-btn')) {
                return;
            }
            this.toggleDraftAccordion(draftDiv);
        });
        
        // Add keyboard support for accordion
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggleDraftAccordion(draftDiv);
            }
        });
        
        // Add copy button handler
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const draftData = draftDiv._draftData;
            if (draftData && draftData.body) {
                this.copyDraftToClipboard(draftData.body, copyBtn);
            }
        });
        
        return draftDiv;
    }
    
    /**
     * Toggle draft accordion expand/collapse
     */
    toggleDraftAccordion(draftElement) {
        const isExpanded = draftElement.classList.contains('expanded');
        
        if (isExpanded) {
            draftElement.classList.remove('expanded');
            const header = draftElement.querySelector('.draft-header');
            header.setAttribute('aria-expanded', 'false');
        } else {
            draftElement.classList.add('expanded');
            const header = draftElement.querySelector('.draft-header');
            header.setAttribute('aria-expanded', 'true');
        }
    }
    
    /**
     * Copy draft to clipboard
     */
    async copyDraftToClipboard(body, button) {
        try {
            await navigator.clipboard.writeText(body);
            
            // Visual feedback
            const originalText = button.textContent;
            button.textContent = '✓ Copied';
            button.classList.add('copy-success');
            
            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copy-success');
            }, 2000);
            
            this.updateStatus('Draft copied to clipboard', 'success');
        } catch (error) {
            console.error('Failed to copy draft:', error);
            this.updateStatus('Failed to copy draft to clipboard', 'error');
        }
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
    
    /**
     * Initialize Speech Recognition API for voice dictation
     */
    initializeSpeechRecognition() {
        // Check if Web Speech API is supported
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech recognition not supported');
            this.elements.micBtn.disabled = true;
            this.elements.micBtn.title = 'Speech recognition not supported in this browser';
            return;
        }
        
        // Use the webkit prefix if available, fallback to standard
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechRecognition = new SpeechRecognition();
        
        // Configure speech recognition
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'en-US';
        
        // Event handlers
        this.speechRecognition.onstart = () => {
            this.isListening = true;
            this.updateMicrophoneUI('listening');
        };
        
        this.speechRecognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (finalTranscript) {
                // Add the transcribed text to the guidance text area
                const currentText = this.elements.guidanceText.value;
                const newText = currentText ? `${currentText} ${finalTranscript}` : finalTranscript;
                this.elements.guidanceText.value = newText.trim();
                
                // Focus on the textarea and move cursor to end
                this.elements.guidanceText.focus();
                this.elements.guidanceText.setSelectionRange(newText.length, newText.length);
            }
            
            if (interimTranscript) {
                this.updateMicStatus(`Listening: ${interimTranscript}`, 'listening');
            }
        };
        
        this.speechRecognition.onend = () => {
            this.isListening = false;
            this.updateMicrophoneUI('idle');
        };
        
        this.speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            
            let errorMessage = 'Voice recognition error';
            switch (event.error) {
                case 'not-allowed':
                case 'service-not-allowed':
                    errorMessage = 'Microphone permission denied. Please allow microphone access.';
                    break;
                case 'no-speech':
                    errorMessage = 'No speech detected. Try again.';
                    break;
                case 'network':
                    errorMessage = 'Network error. Voice recognition requires internet connection.';
                    break;
                case 'audio-capture':
                    errorMessage = 'Microphone not available.';
                    break;
                default:
                    errorMessage = `Voice recognition error: ${event.error}`;
            }
            
            this.updateMicStatus(errorMessage, 'error');
            this.updateMicrophoneUI('error');
            
            // Clear error message after 5 seconds
            setTimeout(() => {
                if (!this.isListening) {
                    this.updateMicStatus('', '');
                    this.updateMicrophoneUI('idle');
                }
            }, 5000);
        };
    }
    
    /**
     * Toggle voice dictation on/off
     */
    toggleVoiceDictation() {
        if (!this.speechRecognition) {
            this.updateMicStatus('Speech recognition not supported', 'error');
            return;
        }
        
        if (this.isListening) {
            // Stop listening
            this.speechRecognition.stop();
        } else {
            // Start listening
            try {
                this.speechRecognition.start();
                this.updateMicStatus('Starting voice recognition...', 'listening');
            } catch (error) {
                console.error('Error starting speech recognition:', error);
                this.updateMicStatus('Failed to start voice recognition', 'error');
            }
        }
    }
    
    /**
     * Update microphone button UI state
     * @param {string} state - Current state: 'idle', 'listening', 'error'
     */
    updateMicrophoneUI(state) {
        const micBtn = this.elements.micBtn;
        
        // Remove all state classes
        micBtn.classList.remove('listening');
        
        switch (state) {
            case 'listening':
                micBtn.classList.add('listening');
                micBtn.setAttribute('aria-label', 'Stop voice dictation');
                micBtn.title = 'Click to stop voice dictation';
                break;
            case 'error':
                micBtn.setAttribute('aria-label', 'Voice dictation error');
                micBtn.title = 'Voice dictation error - try again';
                break;
            case 'idle':
            default:
                micBtn.setAttribute('aria-label', 'Start voice dictation');
                micBtn.title = 'Click to start voice dictation';
                break;
        }
    }
    
    /**
     * Update microphone status text
     * @param {string} message - Status message to display
     * @param {string} type - Status type: 'listening', 'error', or empty string
     */
    updateMicStatus(message, type = '') {
        const micStatus = this.elements.micStatus;
        micStatus.textContent = message;
        
        // Remove all status classes
        micStatus.classList.remove('listening', 'error');
        
        // Add appropriate class
        if (type) {
            micStatus.classList.add(type);
        }
    }
    
    /**
     * Handle API key toggle
     */
    onApiKeyToggle() {
        const useApiKey = this.elements.useApiKeyCheckbox.checked;
        this.userSettings.useApiKey = useApiKey;
        
        // Show/hide API key input section
        if (this.elements.apiKeySection) {
            this.elements.apiKeySection.style.display = useApiKey ? 'block' : 'none';
        }
        
        // If disabling API key, clear it
        if (!useApiKey) {
            this.userSettings.apiKey = '';
            if (this.elements.apiKeyInput) {
                this.elements.apiKeyInput.value = '';
            }
        }
        
        this.saveUserSettings();
    }
    
    /**
     * Save API key settings
     */
    async saveApiKeySettings() {
        if (!this.elements.apiKeyInput || !this.elements.apiProviderSelect) {
            return;
        }
        
        const apiKey = this.elements.apiKeyInput.value.trim();
        const provider = this.elements.apiProviderSelect.value;
        
        if (this.userSettings.useApiKey && !apiKey) {
            this.updateStatus('Please enter an API key or disable the API key option', 'error');
            return;
        }
        
        this.userSettings.apiKey = apiKey;
        this.userSettings.apiProvider = provider;
        
        await this.saveUserSettings();
        this.updateStatus('API key settings saved', 'success');
    }
    
    /**
     * Load user settings from Chrome storage
     */
    async loadUserSettings() {
        try {
            if (chrome?.storage?.sync) {
                const result = await chrome.storage.sync.get([
                    'processingMode', 
                    'useApiKey', 
                    'apiKey', 
                    'apiProvider',
                    'translationLanguage'
                ]);
                
                if (result.processingMode) {
                    this.userSettings.processingMode = result.processingMode;
                }
                if (result.useApiKey !== undefined) {
                    this.userSettings.useApiKey = result.useApiKey;
                }
                if (result.apiKey) {
                    this.userSettings.apiKey = result.apiKey;
                }
                if (result.apiProvider) {
                    this.userSettings.apiProvider = result.apiProvider;
                }
                if (result.translationLanguage) {
                    this.translationSettings.targetLanguage = result.translationLanguage;
                }
            }
            
            // Update UI to reflect loaded settings
            this.updateProcessingModeUI();
            this.updateApiKeyUI();
            this.updateTranslationUI();
        } catch (error) {
            console.error('Error loading user settings:', error);
            // Use default settings if loading fails
            this.updateProcessingModeUI();
            this.updateApiKeyUI();
            this.updateTranslationUI();
        }
    }
    
    /**
     * Save user settings to Chrome storage
     */
    async saveUserSettings() {
        try {
            if (chrome?.storage?.sync) {
                await chrome.storage.sync.set({
                    processingMode: this.userSettings.processingMode,
                    useApiKey: this.userSettings.useApiKey,
                    apiKey: this.userSettings.apiKey,
                    apiProvider: this.userSettings.apiProvider,
                    translationLanguage: this.translationSettings.targetLanguage
                });
                console.log('User settings saved (API key hidden):', {
                    ...this.userSettings,
                    apiKey: this.userSettings.apiKey ? '***' : ''
                });
            }
        } catch (error) {
            console.error('Error saving user settings:', error);
        }
    }
    
    /**
     * Update API key UI based on current settings
     */
    updateApiKeyUI() {
        if (this.elements.useApiKeyCheckbox) {
            this.elements.useApiKeyCheckbox.checked = this.userSettings.useApiKey;
        }
        
        if (this.elements.apiKeySection) {
            this.elements.apiKeySection.style.display = this.userSettings.useApiKey ? 'block' : 'none';
        }
        
        if (this.elements.apiKeyInput && this.userSettings.apiKey) {
            this.elements.apiKeyInput.value = this.userSettings.apiKey;
        }
        
        if (this.elements.apiProviderSelect && this.userSettings.apiProvider) {
            this.elements.apiProviderSelect.value = this.userSettings.apiProvider;
        }
    }
    
    /**
     * Handle processing mode change
     */
    onProcessingModeChange() {
        const selectedMode = document.querySelector('input[name="processing-mode"]:checked')?.value;
        if (selectedMode) {
            this.userSettings.processingMode = selectedMode;
            this.saveUserSettings();
            this.updateProcessingModeUI();
            console.log('Processing mode changed to:', selectedMode);
        }
    }
    
    /**
     * Update UI based on current processing mode
     */
    updateProcessingModeUI() {
        // Set radio button selection
        if (this.userSettings.processingMode === 'hybrid') {
            this.elements.hybridRadio.checked = true;
            this.elements.deviceOnlyRadio.checked = false;
            this.elements.privacyNotice.classList.remove('hidden');
        } else {
            this.elements.deviceOnlyRadio.checked = true;
            this.elements.hybridRadio.checked = false;
            this.elements.privacyNotice.classList.add('hidden');
        }
    }
    
    /**
     * Add processing indicator to status or results  
     * @param {string} operation - The operation being performed (e.g., 'summarization', 'drafting')
     * @param {boolean} usedFallback - Whether cloud fallback was used
     */
    addProcessingIndicator(operation, usedFallback = false) {
        if (this.userSettings.processingMode === 'hybrid' && usedFallback) {
            // Show cloud processing indicator
            this.showCloudProcessingIndicator(operation);
            console.log(`${operation} processed using cloud fallback`);
        } else {
            console.log(`${operation} processed on-device`);
        }
    }
    
    /**
     * Display cloud processing indicator in the UI
     * @param {string} operation - The operation that used cloud processing
     */
    showCloudProcessingIndicator(operation) {
        // Create or update cloud processing indicator
        let indicator = document.getElementById('cloud-processing-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'cloud-processing-indicator';
            indicator.className = 'cloud-indicator';
            indicator.innerHTML = `
                <span class="cloud-icon">☁️</span>
                <span class="indicator-text">Cloud processing used</span>
                <button class="info-button" onclick="this.showCloudInfo()" aria-label="Learn more about cloud processing">ⓘ</button>
            `;
            
            // Add to the appropriate section
            const targetSection = operation === 'summarization' ? 
                document.getElementById('summary') : 
                document.getElementById('drafts');
                
            if (targetSection) {
                targetSection.insertBefore(indicator, targetSection.firstChild);
            }
        }
        
        // Update the text for current operation
        const textElement = indicator.querySelector('.indicator-text');
        if (textElement) {
            textElement.textContent = `${operation} processed in cloud for enhanced reliability`;
        }
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (indicator && indicator.parentNode) {
                indicator.remove();
            }
        }, 10000);
    }
    
    /**
     * Show information about cloud processing
     */
    showCloudInfo() {
        const message = `
Cloud Processing Information:

✅ Only extracted email text was sent to cloud services
✅ No attachments, images, or files were transmitted  
✅ Processing occurred due to device limitations or content size
✅ You can disable cloud fallback in Processing Settings

Your privacy remains protected with minimal necessary data transmission.
        `;
        alert(message);
    }
    
    /**
     * Update translation UI with current language setting
     */
    updateTranslationUI() {
        if (this.elements.targetLanguageSelect) {
            this.elements.targetLanguageSelect.value = this.translationSettings.targetLanguage || 'none';
        }
    }
    
    /**
     * Handle language selection change
     */
    async onLanguageChange() {
        const newLanguage = this.elements.targetLanguageSelect.value;
        const oldLanguage = this.translationSettings.targetLanguage;
        
        this.translationSettings.targetLanguage = newLanguage;
        await this.saveUserSettings();
        
        // If switching from a language to "none", restore originals
        if (newLanguage === 'none' && oldLanguage !== 'none') {
            this.restoreOriginalContent();
            this.updateStatus('Translation disabled, showing original content', 'info');
            return;
        }
        
        // If switching to a language, translate existing content
        if (newLanguage !== 'none') {
            await this.translateExistingContent();
        }
    }
    
    /**
     * Restore original (untranslated) content
     */
    restoreOriginalContent() {
        // Restore summary
        if (this.translationSettings.originalSummary && this.elements.summary) {
            this.elements.summary.textContent = this.translationSettings.originalSummary;
        }
        
        // Restore key points
        if (this.translationSettings.originalKeyPoints && this.elements.keyPoints) {
            this.displayKeyPoints(this.translationSettings.originalKeyPoints);
        }
        
        // Restore drafts
        if (this.currentDrafts.length > 0 && this.translationSettings.originalDrafts.size > 0) {
            this.currentDrafts.forEach((draft, index) => {
                if (this.translationSettings.originalDrafts.has(index)) {
                    draft.body = this.translationSettings.originalDrafts.get(index);
                }
            });
            this.displayReplyDrafts(this.currentDrafts);
        }
    }
    
    /**
     * Translate all existing content when language changes
     */
    async translateExistingContent() {
        const language = this.translationSettings.targetLanguage;
        if (language === 'none') return;
        
        let translatedCount = 0;
        
        // Translate summary if exists
        if (this.elements.summary && this.elements.summary.textContent.trim()) {
            try {
                await this.translateSummary();
                translatedCount++;
            } catch (error) {
                console.error('Error translating summary:', error);
            }
        }
        
        // Translate key points if exist
        if (this.translationSettings.originalKeyPoints && this.translationSettings.originalKeyPoints.length > 0) {
            try {
                await this.translateKeyPoints();
                translatedCount++;
            } catch (error) {
                console.error('Error translating key points:', error);
            }
        }
        
        // Translate drafts if exist
        if (this.currentDrafts.length > 0) {
            try {
                await this.translateAllDrafts();
                translatedCount += this.currentDrafts.length;
            } catch (error) {
                console.error('Error translating drafts:', error);
            }
        }
        
        if (translatedCount > 0) {
            const langName = this.getLanguageName(language);
            this.updateStatus(`✓ Content translated to ${langName}`, 'success');
        }
    }
    
    /**
     * Translate summary text
     */
    async translateSummary() {
        if (!this.elements.summary) return;
        
        const originalText = this.translationSettings.originalSummary || this.elements.summary.textContent;
        if (!originalText || !originalText.trim()) return;
        
        // Store original if not stored yet
        if (!this.translationSettings.originalSummary) {
            this.translationSettings.originalSummary = originalText;
        }
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            this.updateStatus(`Translating summary to ${this.getLanguageName(targetLanguage)}...`, 'loading');
            
            const response = await chrome.runtime.sendMessage({
                action: 'translateText',
                text: originalText,
                sourceLanguage: 'en',
                targetLanguage: targetLanguage
            });
            
            if (response && response.success) {
                this.elements.summary.textContent = response.translatedText;
            } else {
                console.error('Translation failed:', response?.error);
                this.updateStatus(`Translation failed: ${response?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error translating summary:', error);
            this.updateStatus(`Translation error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Translate key points
     */
    async translateKeyPoints() {
        const originalKeyPoints = this.translationSettings.originalKeyPoints;
        if (!originalKeyPoints || originalKeyPoints.length === 0) return;
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            const translatedPoints = [];
            
            for (const point of originalKeyPoints) {
                const response = await chrome.runtime.sendMessage({
                    action: 'translateText',
                    text: point,
                    sourceLanguage: 'en',
                    targetLanguage: targetLanguage
                });
                
                if (response && response.success) {
                    translatedPoints.push(response.translatedText);
                } else {
                    // If translation fails, keep original
                    translatedPoints.push(point);
                }
            }
            
            // Display translated key points
            this.displayKeyPoints(translatedPoints);
        } catch (error) {
            console.error('Error translating key points:', error);
        }
    }
    
    /**
     * Translate all drafts
     */
    async translateAllDrafts() {
        if (this.currentDrafts.length === 0) return;
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            for (let i = 0; i < this.currentDrafts.length; i++) {
                await this.translateDraft(i);
            }
            
            // Refresh draft display
            this.displayReplyDrafts(this.currentDrafts);
        } catch (error) {
            console.error('Error translating drafts:', error);
        }
    }
    
    /**
     * Translate a single draft
     * @param {number} index - Draft index
     */
    async translateDraft(index) {
        if (index < 0 || index >= this.currentDrafts.length) return;
        
        const draft = this.currentDrafts[index];
        const originalBody = this.translationSettings.originalDrafts.get(index) || draft.body;
        
        // Store original if not stored yet
        if (!this.translationSettings.originalDrafts.has(index)) {
            this.translationSettings.originalDrafts.set(index, draft.body);
        }
        
        const targetLanguage = this.translationSettings.targetLanguage;
        if (targetLanguage === 'none') return;
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'translateText',
                text: originalBody,
                sourceLanguage: 'en',
                targetLanguage: targetLanguage
            });
            
            if (response && response.success) {
                draft.body = response.translatedText;
            }
        } catch (error) {
            console.error(`Error translating draft ${index}:`, error);
        }
    }
    
    /**
     * Get human-readable language name
     * @param {string} code - Language code
     * @returns {string} Language name
     */
    getLanguageName(code) {
        const languages = {
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'zh': 'Chinese',
            'ja': 'Japanese',
            'ko': 'Korean',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'it': 'Italian',
            'nl': 'Dutch',
            'pl': 'Polish',
            'tr': 'Turkish'
        };
        return languages[code] || code;
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
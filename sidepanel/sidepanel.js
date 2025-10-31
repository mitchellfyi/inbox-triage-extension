/**
 * Side Panel JavaScript for Inbox Triage Extension
 * Handles UI interactions and communication with content scripts
 * 
 * Reference: SPEC.md - Side Panel Layer requirements
 * Reference: AGENTS.md - Side Panel Layer architecture
 */

import { TranslationUI } from './translation-ui.js';
import { VoiceInput } from './voice-input.js';
import { SettingsManager } from './settings-manager.js';
import { DraftRenderer } from './draft-renderer.js';

class InboxTriageSidePanel {
    constructor() {
        this.currentThread = null;
        this.currentSummary = null;
        this.currentDrafts = [];
        this.currentContext = {
            isOnEmailThread: false,
            provider: null, // 'gmail' or 'outlook'
            url: ''
        };
        this.statusHideTimeout = null;
        this.isVisible = document.visibilityState === 'visible';
        
        this.initializeElements();
        
        // Initialize modules
        this.translationUI = new TranslationUI(
            this.elements,
            (msg, type) => this.updateStatus(msg, type)
        );
        this.translationUI.setCallbacks(
            (keyPoints) => this.displayKeyPoints(keyPoints),
            (drafts) => this.displayReplyDrafts(drafts)
        );
        
        this.voiceInput = new VoiceInput(
            this.elements,
            (msg, type) => this.updateStatus(msg, type)
        );
        
        this.settingsManager = new SettingsManager(
            this.elements,
            (msg, type) => this.updateStatus(msg, type)
        );
        
        this.draftRenderer = new DraftRenderer(
            this.elements,
            (msg, type) => this.updateStatus(msg, type)
        );
        
        this.bindEvents();
        this.loadUserSettings();
        this.checkCurrentContext();
        this.checkInitialStatus();
        
        // Poll for URL changes every 2 seconds
        setInterval(() => {
            this.checkCurrentContext();
        }, 2000);
        
        // Set up visibility change detection to reset state when panel reopens
        this.setupVisibilityTracking();
        
        // Set up global error handlers
        this.setupGlobalErrorHandlers();
    }
    
    /**
     * Setup visibility tracking to detect when side panel is reopened
     * This allows us to reset state when the extension is closed and reopened
     */
    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            const wasHidden = !this.isVisible;
            this.isVisible = document.visibilityState === 'visible';
            
            // If the panel was hidden and is now visible (reopened)
            if (wasHidden && this.isVisible) {
                console.log('Side panel reopened - resetting extraction state');
                this.resetExtractionState();
                this.checkCurrentContext();
            }
        });
    }
    
    /**
     * Setup global error handlers to catch unhandled exceptions
     */
    setupGlobalErrorHandlers() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.updateStatus(`Unexpected error: ${event.reason?.message || event.reason || 'Unknown error'}`, 'error');
            
            // Re-enable extract button if it's disabled
            if (this.elements.extractBtn && this.elements.extractBtn.disabled) {
                this.elements.extractBtn.disabled = false;
                console.log('Extract button re-enabled after unhandled error');
            }
            
            // Prevent default error handling
            event.preventDefault();
        });
        
        // Catch synchronous errors
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error);
            this.updateStatus(`System error: ${event.error?.message || event.message || 'Unknown error'}`, 'error');
            
            // Re-enable extract button if it's disabled
            if (this.elements.extractBtn && this.elements.extractBtn.disabled) {
                this.elements.extractBtn.disabled = false;
                console.log('Extract button re-enabled after uncaught error');
            }
            
            // Prevent default error handling
            event.preventDefault();
        });
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
            this.resetExtractionState();
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
    
    /**
     * Reset extraction state and UI to initial state
     * Called when URL changes or panel is reopened
     */
    resetExtractionState() {
        // Reset state variables
        this.currentThread = null;
        this.currentDrafts = [];
        this.currentSummary = null;
        
        // Show extract button again
        this.showSection(this.elements.extractSection, false);
        this.elements.extractBtn.disabled = false;
        
        // Hide all result sections
        this.hideSection(this.elements.summarySection);
        this.hideSection(this.elements.keyPointsSection);
        this.hideSection(this.elements.attachmentsSection);
        this.hideSection(this.elements.replyDraftsControlsSection);
        this.hideSection(this.elements.replyDraftsSection);
        
        // Clear content
        if (this.elements.summary) this.elements.summary.textContent = '';
        if (this.elements.keyPoints) this.elements.keyPoints.innerHTML = '';
        if (this.elements.attachments) this.elements.attachments.innerHTML = '';
        if (this.elements.replyDrafts) this.elements.replyDrafts.innerHTML = '';
        
        // Disable generate drafts button
        this.elements.generateDraftsBtn.disabled = true;
        
        // Clear status message
        this.updateStatus('Ready to analyse email threads', 'info');
        
        // Reset translation state
        if (this.translationUI) {
            this.translationUI.resetState();
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
        
        // Initialize modules
        this.translationUI.initialize();
        this.voiceInput.initialize();
        this.settingsManager.initialize();
        
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

    /**
     * Ensure content script is loaded in the target tab
     * Injects content script programmatically if not already loaded
     * @param {number} tabId - The tab ID to check
     */
    async ensureContentScriptLoaded(tabId) {
        try {
            // Try to ping the content script to see if it's loaded
            const pingResponse = await Promise.race([
                chrome.tabs.sendMessage(tabId, { action: 'ping' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
            ]);
            
            // If we get a response, content script is loaded
            if (pingResponse) {
                console.log('Content script already loaded');
                return;
            }
        } catch (error) {
            // Content script not loaded or not responding, inject it
            console.log('Content script not responding, injecting...', error.message);
            
            try {
                // Inject the content scripts in order
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content/selectors.js']
                });
                
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['content/content.js']
                });
                
                // Wait a bit for initialization
                await new Promise(resolve => setTimeout(resolve, 500));
                
                console.log('Content script injected successfully');
            } catch (injectError) {
                console.error('Failed to inject content script:', injectError);
                throw new Error('Could not initialize page connection. Please try refreshing the page.');
            }
        }
    }
    
    /**
     * Extract current email thread from active tab
     * 
     * Reference: SPEC.md - Email Thread Extraction requirements
     * 
     * Coordinates with content script to extract thread content,
     * validates the data, and triggers summary generation.
     * 
     * @returns {Promise<void>}
     */
    async extractCurrentThread() {
        // Prevent multiple simultaneous extractions
        if (this.elements.extractBtn.disabled) {
            return;
        }
        
        let extractionSucceeded = false;
        
        try {
            // Disable button immediately
            this.elements.extractBtn.disabled = true;
            this.updateStatus('Checking page context...', 'loading');
            
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
            
            // Ensure content script is loaded before trying to communicate
            await this.ensureContentScriptLoaded(currentTab.id);
            
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
                
                // Try to generate summary - catch errors to avoid leaving button disabled
                try {
                    await this.generateSummary();
                } catch (summaryError) {
                    console.error('Summary generation failed:', summaryError);
                    this.updateStatus(`Thread extracted, but summary failed: ${summaryError.message}`, 'error');
                    // Don't mark extraction as failed - thread was successfully extracted
                }
                
                this.displayAttachments();
                
                // Show reply drafts controls now that we have a thread
                this.showSection(this.elements.replyDraftsControlsSection, false);
                this.elements.generateDraftsBtn.disabled = false;
                
                // Hide extract button now that thread is extracted
                this.hideSection(this.elements.extractSection);
                
                // Mark extraction as successful
                extractionSucceeded = true;
                
                // Show success message (will auto-hide)
                this.updateStatus('✓ Thread extraction complete', 'success');
            } else {
                const errorMsg = response?.error || 'Failed to extract thread - no response from content script';
                console.error('Thread extraction failed:', errorMsg, 'Full response:', response);
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('Error extracting thread:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
            // Ensure button is re-enabled on error
            extractionSucceeded = false;
        } finally {
            // Button state management:
            // - If extraction succeeded: button stays disabled and section is hidden
            // - If extraction failed: re-enable button so user can try again
            if (!extractionSucceeded) {
                this.elements.extractBtn.disabled = false;
                // Make sure section is visible for retry
                if (this.elements.extractSection.classList.contains('hidden')) {
                    this.showSection(this.elements.extractSection, false);
                }
                console.log('Extract button re-enabled after error');
            } else {
                console.log('Extract button remains disabled after successful extraction');
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
            
            const userSettings = this.settingsManager.getSettings();
            
            this.updateStatus('Generating summary...', 'loading');
            
            // Request summary generation from background script
            const response = await chrome.runtime.sendMessage({
                action: 'generateSummary',
                thread: this.currentThread,
                userSettings
            });
            
            if (response && response.success) {
                this.updateStatus('Rendering summary...', 'loading');
                this.displaySummary(response.summary, response.keyPoints);
                this.addProcessingIndicator('summarization', response.usedFallback || false);
                
                // Show final status
                this.updateStatus('✓ Summary generated', 'success');
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
        
        // Store originals for translation (via TranslationUI module)
        this.translationUI.storeOriginals(summary, keyPoints || []);
        
        // Display key points
        if (keyPoints && keyPoints.length > 0) {
            this.displayKeyPoints(keyPoints);
        }
        
        // Auto-translate if a language is selected (with error handling)
        if (this.translationUI.translationSettings.targetLanguage !== 'none') {
            setTimeout(async () => {
                try {
                    await this.translationUI.translateSummary();
                    await this.translationUI.translateKeyPoints();
                } catch (error) {
                    console.error('Auto-translation failed:', error);
                    // Don't show error to user - just log it
                }
            }, 100);
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
        
        // Add image preview for image attachments
        if (attachment.type === 'image' && attachment.imageUrl) {
            const imagePreview = document.createElement('div');
            imagePreview.className = 'attachment-image-preview';
            
            const img = document.createElement('img');
            img.src = attachment.imageUrl;
            img.alt = attachment.name;
            img.loading = 'lazy';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '200px';
            img.style.objectFit = 'contain';
            
            imagePreview.appendChild(img);
            card.appendChild(imagePreview);
            
            // Add image analysis buttons
            const analysisButtons = document.createElement('div');
            analysisButtons.className = 'image-analysis-buttons';
            
            const analyzeBtn = document.createElement('button');
            analyzeBtn.type = 'button';
            analyzeBtn.className = 'analyze-image-btn';
            analyzeBtn.textContent = '🔍 Analyze Image';
            analyzeBtn.title = 'Analyze this image with AI';
            analyzeBtn.onclick = (e) => {
                e.stopPropagation();
                this.analyzeImage(attachment, 'general', index);
            };
            
            const ocrBtn = document.createElement('button');
            ocrBtn.type = 'button';
            ocrBtn.className = 'analyze-image-btn';
            ocrBtn.textContent = '📄 Extract Text';
            ocrBtn.title = 'Extract text from this image (OCR)';
            ocrBtn.onclick = (e) => {
                e.stopPropagation();
                this.analyzeImage(attachment, 'ocr', index);
            };
            
            analysisButtons.appendChild(analyzeBtn);
            analysisButtons.appendChild(ocrBtn);
            card.appendChild(analysisButtons);
        }
        
        // Create summary/analysis section
        const summary = document.createElement('div');
        summary.className = 'attachment-summary';
        summary.id = `attachment-analysis-${index}`;
        
        if (attachment.type === 'image') {
            summary.innerHTML = '<span class="attachment-info">Click analyze to get AI insights</span>';
        } else if (attachment.processable) {
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
     * Show detailed view of attachment (placeholder implementation)
     * 
     * STATUS: Not yet implemented - uses alert() as temporary placeholder
     * See TODO.md Section "Attachment Processing" - "Detailed view modal"
     * 
     * This method is called when users click on an attachment card to view
     * full extracted content and detailed analysis. Currently shows an alert
     * as a placeholder.
     * 
     * Future implementation should:
     * - Create a modal overlay with full attachment details
     * - Display extracted content (for processed attachments)
     * - Show comprehensive analysis results
     * - Include download/view options
     * - Support keyboard navigation and accessibility
     * 
     * Reference: SPEC.md - Attachment Summary Display requirements
     * 
     * @param {Object} attachment - Attachment to show details for
     */
    showAttachmentDetails(attachment) {
        // TODO: Implement modal or expanded view per TODO.md
        // This is a placeholder implementation that will be replaced with
        // a proper modal dialog showing full attachment content and analysis
        console.log('Showing details for attachment:', attachment);
        
        // Temporary placeholder - will be replaced with modal implementation
        alert(`Detailed view for ${attachment.name}\n\nThis feature will show full extracted content and detailed analysis.\n\nSee TODO.md for implementation roadmap.`);
    }
    
    /**
     * Analyze an image attachment using multimodal AI
     * @param {Object} attachment - Attachment object
     * @param {string} analysisType - Type of analysis ('general', 'ocr', 'chart', 'context')
     * @param {number} index - Attachment index
     */
    async analyzeImage(attachment, analysisType = 'general', index) {
        if (!attachment.imageUrl) {
            this.updateStatus('Image URL not available for analysis', 'error');
            return;
        }
        
        const summaryElement = document.getElementById(`attachment-analysis-${index}`);
        if (!summaryElement) return;
        
        try {
            // Show loading state
            summaryElement.innerHTML = '<span class="attachment-loading">🤖 Analyzing image with AI...</span>';
            this.updateStatus('Analyzing image...', 'loading');
            
            // Get context from email for contextual analysis
            const context = analysisType === 'context' ? this.currentThread.subject : '';
            
            // Send analysis request to background
            const response = await chrome.runtime.sendMessage({
                action: 'analyzeImage',
                imageUrl: attachment.imageUrl,
                analysisType,
                context
            });
            
            if (response && response.success) {
                const analysis = response.analysis;
                
                // Display results
                summaryElement.innerHTML = '';
                summaryElement.className = 'attachment-summary analysis-result';
                
                const header = document.createElement('div');
                header.className = 'analysis-header';
                header.textContent = this.getAnalysisTypeLabel(analysisType);
                
                const description = document.createElement('div');
                description.className = 'analysis-description';
                description.textContent = analysis.description;
                
                summaryElement.appendChild(header);
                summaryElement.appendChild(description);
                
                // For OCR, add copy button
                if (analysisType === 'ocr' && analysis.description !== 'No text detected') {
                    const copyBtn = document.createElement('button');
                    copyBtn.type = 'button';
                    copyBtn.className = 'copy-text-btn';
                    copyBtn.textContent = '📋 Copy Text';
                    copyBtn.onclick = async () => {
                        try {
                            await navigator.clipboard.writeText(analysis.description);
                            copyBtn.textContent = '✓ Copied!';
                            setTimeout(() => {
                                copyBtn.textContent = '📋 Copy Text';
                            }, 2000);
                        } catch (error) {
                            console.error('Failed to copy:', error);
                        }
                    };
                    summaryElement.appendChild(copyBtn);
                }
                
                this.updateStatus(`✓ Image analyzed successfully`, 'success');
            } else {
                throw new Error(response?.error || 'Image analysis failed');
            }
            
        } catch (error) {
            console.error('Image analysis error:', error);
            summaryElement.innerHTML = `<span class="attachment-error">Analysis failed: ${error.message}</span>`;
            this.updateStatus(`Image analysis error: ${error.message}`, 'error');
        }
    }
    
    /**
     * Get human-readable label for analysis type
     * @param {string} type - Analysis type
     * @returns {string} Label
     */
    getAnalysisTypeLabel(type) {
        const labels = {
            general: '🔍 AI Analysis',
            ocr: '📄 Extracted Text',
            chart: '📊 Chart Analysis',
            context: '🎯 Contextual Analysis'
        };
        return labels[type] || '🔍 Analysis';
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
            
            const userSettings = this.settingsManager.getSettings();
            
            this.updateStatus(`Composing ${tone} replies...`, 'loading');
            
            const response = await chrome.runtime.sendMessage({
                action: 'generateDrafts',
                thread: this.currentThread,
                tone: tone,
                guidance: guidance,
                userSettings
            });
            
            if (response && response.success) {
                this.updateStatus('Validating draft quality...', 'loading');
                
                this.currentDrafts = response.drafts;
                this.displayReplyDrafts(response.drafts);
                this.addProcessingIndicator('drafting', response.usedFallback || false);
                
                // Show final status with count
                const draftCount = response.drafts?.length || 0;
                
                if (response.warning) {
                    this.updateStatus(`✓ ${draftCount} draft${draftCount !== 1 ? 's' : ''} generated: ${response.warning}`, 'success');
                } else {
                    this.updateStatus(`✓ ${draftCount} ${tone} draft${draftCount !== 1 ? 's' : ''} ready`, 'success');
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
    
    displayReplyDrafts(drafts, skipTranslation = false) {
        // Update translation module with current drafts
        this.translationUI.setCurrentDrafts(drafts);
        
        // Render drafts using the draft renderer module
        this.draftRenderer.render(drafts, () => {
            // Auto-translate if a language is selected (but only on initial render)
            if (!skipTranslation && this.translationUI.translationSettings.targetLanguage !== 'none') {
                setTimeout(async () => {
                    try {
                        await this.translationUI.translateAllDrafts();
                        // Re-render with translated content, but skip further translation
                        this.displayReplyDrafts(drafts, true);
                    } catch (error) {
                        console.error('Auto-translation of drafts failed:', error);
                        // Don't show error to user - just log it
                    }
                }, 100);
            }
        });
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
        
        // Track model download state for button management
        const isDownloading = capabilities?.status === 'downloading' || 
                            capabilities?.available === 'after-download';
        
        if (isDownloading) {
            // Disable extract button during model downloads
            if (this.elements.extractBtn) {
                this.elements.extractBtn.disabled = true;
                this.elements.extractBtn.title = 'Please wait for model download to complete';
            }
        } else {
            // Re-enable extract button after download completes
            if (this.elements.extractBtn && this.currentContext.isOnEmailThread) {
                this.elements.extractBtn.disabled = false;
                this.elements.extractBtn.title = '';
            }
        }
        
        // Delegate translation model status to TranslationUI module
        if (type === 'translator') {
            this.translationUI.handleModelStatus(type, capabilities);
            return; // Early return to prevent fallthrough
        }
        
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
        const settings = this.settingsManager.getSettings();
        settings.useApiKey = useApiKey;
        
        // Show/hide API key input section
        if (this.elements.apiKeySection) {
            this.elements.apiKeySection.style.display = useApiKey ? 'block' : 'none';
        }
        
        // If disabling API key, clear it
        if (!useApiKey) {
            settings.apiKey = '';
            if (this.elements.apiKeyInput) {
                this.elements.apiKeyInput.value = '';
            }
        }
        
        this.settingsManager.settings = settings;
        this.settingsManager.save();
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
        
        const settings = this.settingsManager.settings;
        if (settings.useApiKey && !apiKey) {
            this.updateStatus('Please enter an API key or disable the API key option', 'error');
            return;
        }
        
        settings.apiKey = apiKey;
        settings.apiProvider = provider;
        
        await this.settingsManager.save();
        this.updateStatus('API key settings saved', 'success');
    }
    
    /**
     * Load user settings from Chrome storage
     */
    async loadUserSettings() {
        await this.settingsManager.load();
        await this.translationUI.loadSettings();
    }
    
    /**
     * Save user settings to Chrome storage
     */
    async saveUserSettings() {
        await this.settingsManager.save();
    }
    
    /**
     * Update API key UI based on current settings
     */
    updateApiKeyUI() {
        const settings = this.settingsManager.settings;
        
        if (this.elements.useApiKeyCheckbox) {
            this.elements.useApiKeyCheckbox.checked = settings.useApiKey;
        }
        
        if (this.elements.apiKeySection) {
            this.elements.apiKeySection.style.display = settings.useApiKey ? 'block' : 'none';
        }
        
        if (this.elements.apiKeyInput && settings.apiKey) {
            this.elements.apiKeyInput.value = settings.apiKey;
        }
        
        if (this.elements.apiProviderSelect && settings.apiProvider) {
            this.elements.apiProviderSelect.value = settings.apiProvider;
        }
    }
    
    /**
     * Handle processing mode change
     */
    onProcessingModeChange() {
        const selectedMode = document.querySelector('input[name="processing-mode"]:checked')?.value;
        if (selectedMode) {
            this.settingsManager.settings.processingMode = selectedMode;
            this.settingsManager.save();
            this.updateProcessingModeUI();
            console.log('Processing mode changed to:', selectedMode);
        }
    }
    
    /**
     * Update UI based on current processing mode
     */
    updateProcessingModeUI() {
        const settings = this.settingsManager.settings;
        
        // Set radio button selection
        if (settings.processingMode === 'hybrid') {
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
        const settings = this.settingsManager.settings;
        if (settings.processingMode === 'hybrid' && usedFallback) {
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
}

// Global function to copy drafts to clipboard with visual feedback
// Note: subject parameter kept for backwards compatibility but not used
window.copyToClipboard = async (subject, body, buttonElement) => {
    try {
        // Only copy the body text (subject removed)
        await navigator.clipboard.writeText(body);
        
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
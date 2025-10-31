/**
 * Side Panel JavaScript for Inbox Triage Extension
 * Handles UI interactions and communication with content scripts
 * 
 * Reference: docs/spec.md - Side Panel Layer requirements
 * Reference: AGENTS.md - Side Panel Layer architecture
 */

import { TranslationUI } from './translation-ui.js';
import { VoiceInput } from './voice-input.js';
import { SettingsManager } from './settings-manager.js';
import { DraftRenderer } from './draft-renderer.js';
import { AttachmentHandler } from './attachment-handler.js';
import { DisplayManager } from './display-manager.js';

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
        this.isVisible = document.visibilityState === 'visible';
        this.isExtracting = false; // Track if extraction is in progress
        this.isGenerating = false; // Track if draft generation is in progress
        this.isTranslatingDrafts = false; // Track if draft translation is in progress
        
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
        
        this.attachmentHandler = new AttachmentHandler({
            elements: this.elements,
            updateStatus: (msg, type) => this.updateStatus(msg, type),
            getCurrentThread: () => this.currentThread
        });
        
        // DisplayManager must be created after settingsManager since it depends on it
        this.displayManager = new DisplayManager({
            elements: this.elements,
            settingsManager: this.settingsManager
        });
        
        this.bindEvents();
        this.loadUserSettings();
        this.checkCurrentContext().then(() => {
            // Try to restore persisted state after checking context
            return this.restoreState();
        }).then(() => {
            this.checkInitialStatus();
        });
        
        // Poll for URL changes every 2 seconds
        setInterval(() => {
            this.checkCurrentContext();
        }, 2000);
        
        // Set up visibility change detection to restore state when panel reopens
        this.setupVisibilityTracking();
        
        // Set up global error handlers
        this.setupGlobalErrorHandlers();
    }
    
    /**
     * Setup visibility tracking to detect when side panel is reopened
     * This allows us to restore state when the extension is closed and reopened
     */
    setupVisibilityTracking() {
        document.addEventListener('visibilitychange', () => {
            const wasHidden = !this.isVisible;
            this.isVisible = document.visibilityState === 'visible';
            
            // If the panel was hidden and is now visible (reopened)
            if (wasHidden && this.isVisible) {
                console.log('Side panel reopened - checking for persisted state');
                this.checkCurrentContext().then(() => {
                    // Try to restore persisted state
                    this.restoreState();
                });
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
            
            // Re-enable extract button if it's disabled (but not if extraction or generation is in progress)
            if (this.elements.extractBtn && this.elements.extractBtn.disabled && !this.isExtracting && !this.isGenerating) {
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
            
            // Re-enable extract button if it's disabled (but not if extraction or generation is in progress)
            if (this.elements.extractBtn && this.elements.extractBtn.disabled && !this.isExtracting && !this.isGenerating) {
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
            // Only enable button if extraction is not in progress and generation is not in progress
            if (!this.isExtracting && !this.isGenerating) {
                extractBtn.disabled = false;
            }
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
    /**
     * Save current state to chrome.storage.local for persistence
     */
    async saveState() {
        try {
            if (!chrome?.storage?.local) {
                console.warn('Chrome storage API not available');
                return;
            }

            // Only save if we have data to persist
            if (!this.currentThread && !this.currentSummary && (!this.currentDrafts || this.currentDrafts.length === 0)) {
                return;
            }

            const stateToSave = {
                threadUrl: this.currentContext.url || '',
                thread: this.currentThread,
                summary: this.currentSummary,
                drafts: this.currentDrafts,
                timestamp: Date.now()
            };

            await chrome.storage.local.set({ inboxTriageState: stateToSave });
            console.log('State saved to storage');
        } catch (error) {
            console.error('Error saving state:', error);
        }
    }

    /**
     * Restore persisted state from chrome.storage.local if URL matches
     */
    async restoreState() {
        try {
            if (!chrome?.storage?.local) {
                console.warn('Chrome storage API not available');
                return false;
            }

            // Get current URL
            const currentUrl = this.currentContext.url || '';
            
            // Only restore if we're on an email thread page
            if (!this.currentContext.isOnEmailThread || !currentUrl) {
                return false;
            }

            // Get saved state
            const result = await chrome.storage.local.get('inboxTriageState');
            const savedState = result.inboxTriageState;

            if (!savedState) {
                console.log('No saved state found');
                return false;
            }

            // Check if saved state is for the current URL
            // For Gmail and Outlook, URLs can change slightly (hash, query params) but still be the same thread
            // We'll match by checking if the thread ID or conversation ID is in the URL
            const savedUrl = savedState.threadUrl || '';
            const urlMatches = this.urlsMatch(savedUrl, currentUrl);

            if (!urlMatches) {
                console.log('Saved state URL does not match current URL - not restoring');
                return false;
            }

            // Restore state
            if (savedState.thread) {
                this.currentThread = savedState.thread;
            }

            if (savedState.summary) {
                this.currentSummary = savedState.summary;
                
                // Restore summary display
                const keyPoints = savedState.thread?.keyPoints || [];
                this.displaySummary(savedState.summary, keyPoints);
            }

            if (savedState.drafts && savedState.drafts.length > 0) {
                this.currentDrafts = savedState.drafts;
                
                // Restore drafts display
                this.displayReplyDrafts(savedState.drafts, true); // Skip translation on restore
                
                // Hide controls section since drafts are already generated
                this.hideSection(this.elements.replyDraftsControlsSection);
            }

            // Restore attachments if thread was restored
            if (this.currentThread) {
                this.displayAttachments();
            }

            // Update UI to reflect restored state
            if (this.currentThread) {
                this.showSection(this.elements.extractSection, false);
                this.elements.extractBtn.disabled = true; // Disable since thread is already extracted
            }

            console.log('State restored from storage');
            this.updateStatus('Restored previous analysis', 'success');
            
            return true;
        } catch (error) {
            console.error('Error restoring state:', error);
            return false;
        }
    }

    /**
     * Check if two URLs match (same thread/conversation)
     * Handles Gmail and Outlook URL variations
     */
    urlsMatch(url1, url2) {
        if (!url1 || !url2) return false;
        if (url1 === url2) return true;

        // Extract thread/conversation IDs from URLs
        const extractThreadId = (url) => {
            // Gmail: https://mail.google.com/mail/u/0/#inbox/th123 or ?th=thread-id
            // Pattern: #inbox/th{id} or ?th={id}
            const gmailHashMatch = url.match(/#inbox\/th([^&/?#]+)/);
            if (gmailHashMatch) return gmailHashMatch[1];
            
            const gmailQueryMatch = url.match(/[?&]th=([^&]+)/);
            if (gmailQueryMatch) return gmailQueryMatch[1];

            // Outlook: https://outlook.live.com/mail/0/inbox/conversation-id or /mail/id/...
            const outlookMatch = url.match(/\/(?:conversation|id)\/([^/?#]+)/);
            if (outlookMatch) return outlookMatch[1];

            return null;
        };

        const id1 = extractThreadId(url1);
        const id2 = extractThreadId(url2);

        if (id1 && id2) {
            return id1 === id2;
        }

        // Fallback: compare normalized URLs (remove hash, some query params)
        try {
            const u1 = new URL(url1);
            const u2 = new URL(url2);
            
            // Remove common query params that don't affect thread identity
            const paramsToIgnore = ['tab', 'view', 'refreshed'];
            paramsToIgnore.forEach(param => {
                u1.searchParams.delete(param);
                u2.searchParams.delete(param);
            });

            return u1.origin + u1.pathname + u1.search === u2.origin + u2.pathname + u2.search;
        } catch {
            return false;
        }
    }

    resetExtractionState() {
        // Reset state variables
        this.currentThread = null;
        this.currentDrafts = [];
        this.currentSummary = null;
        
        // Clear saved state
        if (chrome?.storage?.local) {
            chrome.storage.local.remove('inboxTriageState').catch(err => {
                console.error('Error clearing saved state:', err);
            });
        }
        
        // Show extract button again (but keep disabled if extraction or generation is in progress)
        this.showSection(this.elements.extractSection, false);
        if (!this.isExtracting && !this.isGenerating) {
            this.elements.extractBtn.disabled = false;
        }
        
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
            
            // Request current AI status from background script with retry
            // Sometimes the service worker needs a moment to initialize
            let response;
            let retries = 0;
            const maxRetries = 3;
            
            while (retries < maxRetries) {
                try {
                    response = await chrome.runtime.sendMessage({
                        action: 'checkAIStatus'
                    });
                    
                    if (response && response.success) {
                        break;
                    }
                } catch (error) {
                    console.log(`AI status check attempt ${retries + 1} failed:`, error);
                    if (retries < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
                retries++;
            }
            
            if (!response) {
                this.updateStatus('Unable to connect to service worker. Try reloading the extension.', 'error');
                return;
            }
            
            if (response && response.success) {
                const { summarizer, promptApi, available } = response.capabilities;
                
                // Log detailed status for debugging
                console.log('AI Capabilities Status:', {
                    available,
                    summarizer: summarizer?.available,
                    promptApi: promptApi?.available,
                    hasSummarizer: !!summarizer,
                    hasPromptApi: !!promptApi
                });
                
                if (available) {
                    // Check individual model status
                    let readyModels = [];
                    let downloadingModels = [];
                    let unavailableModels = [];
                    
                    if (summarizer) {
                        if (summarizer.available === 'readily' || summarizer.available === 'available') {
                            readyModels.push('Summarization');
                        } else if (summarizer.available === 'after-download') {
                            downloadingModels.push('Summarization');
                        } else if (summarizer.available === 'no' || summarizer.available === 'unavailable') {
                            // API exists but models not available - might need flags or download
                            unavailableModels.push('Summarization');
                        } else {
                            // Unknown status - treat as unavailable but log it
                            console.warn('Unknown Summarizer availability status:', summarizer.available);
                            unavailableModels.push('Summarization');
                        }
                    }
                    
                    if (promptApi) {
                        if (promptApi.available === 'readily' || promptApi.available === 'available') {
                            readyModels.push('Reply Drafting');
                        } else if (promptApi.available === 'after-download') {
                            downloadingModels.push('Reply Drafting');
                        } else if (promptApi.available === 'no' || promptApi.available === 'unavailable') {
                            // API exists but models not available - might need flags or download
                            unavailableModels.push('Reply Drafting');
                        } else {
                            // Unknown status - treat as unavailable but log it
                            console.warn('Unknown Prompt API availability status:', promptApi.available);
                            unavailableModels.push('Reply Drafting');
                        }
                    }
                    
                    // Update status based on model states
                    if (readyModels.length > 0 && downloadingModels.length === 0 && unavailableModels.length === 0) {
                        this.updateStatus('AI models ready. You can analyze email threads.', 'success');
                    } else if (downloadingModels.length > 0) {
                        this.updateStatus(`AI models downloading: ${downloadingModels.join(', ')}. This may take several minutes...`, 'loading');
                    } else if (unavailableModels.length > 0) {
                        // More helpful error message with debugging info
                        const hasApis = (summarizer !== null) || (promptApi !== null);
                        const summarizerStatus = summarizer?.available || 'unknown';
                        const promptApiStatus = promptApi?.available || 'unknown';
                        
                        if (hasApis) {
                            // APIs exist but models unavailable
                            // Check if it's "no" which might mean flags not fully enabled or models need download trigger
                            const needsDownload = summarizerStatus === 'after-download' || promptApiStatus === 'after-download';
                            const isNo = summarizerStatus === 'no' || promptApiStatus === 'no';
                            
                            if (needsDownload) {
                                this.updateStatus(`AI models downloading: ${downloadingModels.join(', ')}. This may take several minutes...`, 'loading');
                            } else if (isNo) {
                                // APIs exist but return "no" - likely flag or configuration issue
                                console.warn('AI APIs exist but return "no":', {
                                    summarizer: summarizerStatus,
                                    promptApi: promptApiStatus,
                                    chromeVersion: navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'
                                });
                                
                                // Provide actionable troubleshooting steps
                                const troubleshootingSteps = [
                                    '1) Ensure Chrome 138+ (check chrome://version)',
                                    '2) Verify flags enabled: chrome://flags/#optimization-guide-on-device-model, #prompt-api-for-gemini-nano, #summarization-api-for-gemini-nano',
                                    '3) Reload extension: chrome://extensions → click reload',
                                    '4) Fully restart Chrome (not just reload)',
                                    '5) Check Chrome AI settings: Settings > Privacy and security > Experimental AI'
                                ];
                                
                                console.log('Troubleshooting steps:', troubleshootingSteps);
                                
                                this.updateStatus(
                                    'AI models return "no" status. Check browser console (F12) for detailed troubleshooting steps. Common fix: Reload extension after enabling flags.',
                                    'error'
                                );
                            } else {
                                // Unknown status
                                this.updateStatus(`AI models unavailable (Summarizer: ${summarizerStatus}, Prompt API: ${promptApiStatus}). Check chrome://flags and reload extension.`, 'error');
                            }
                        } else {
                            // APIs don't exist at all
                            this.updateStatus('Chrome AI APIs not detected. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI, and ensure required flags are enabled.', 'error');
                        }
                    } else {
                        this.updateStatus('Ready to analyze email threads', 'success');
                    }
                } else {
                    // No APIs detected at all
                    this.updateStatus('AI features not available. Please use Chrome 138+ with experimental AI enabled. Check chrome://flags for AI-related flags.', 'error');
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
            apiProviderNotice: document.getElementById('api-provider-notice'),
            // Signature settings
            signatureInput: document.getElementById('signature-input'),
            saveSignatureBtn: document.getElementById('save-signature-btn'),
            // Translation settings
            targetLanguageSelect: document.getElementById('target-language'),
            // Attachment modal
            attachmentModalOverlay: document.getElementById('attachment-modal-overlay'),
            attachmentModalClose: document.getElementById('attachment-modal-close'),
            attachmentModalTitle: document.getElementById('attachment-modal-title'),
            attachmentModalBody: document.getElementById('attachment-modal-body')
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
        this.displayManager.showSection(sectionElement, autoExpand);
    }
    
    /**
     * Hide a section
     */
    hideSection(sectionElement) {
        this.displayManager.hideSection(sectionElement);
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
        
        // Attachment modal event listeners
        if (this.elements.attachmentModalClose) {
            this.elements.attachmentModalClose.addEventListener('click', () => this.attachmentHandler.closeAttachmentModal());
        }
        if (this.elements.attachmentModalOverlay) {
            this.elements.attachmentModalOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.attachmentModalOverlay) {
                    this.attachmentHandler.closeAttachmentModal();
                }
            });
        }
        
        // API provider selection warning (no longer needed - all providers are available)
        // Removed warning notice since all providers are now implemented
        
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
        this.displayManager.updateStatus(message, type);
    }

    /**
     * Ensure content script is loaded in the target tab
     * Injects content script programmatically if not already loaded
     * @param {number} tabId - The tab ID to check
     */
    async ensureContentScriptLoaded(tabId) {
        // Helper function to ping content script with timeout
        const pingContentScript = async (timeout = 2000) => {
            try {
                const response = await Promise.race([
                    chrome.tabs.sendMessage(tabId, { action: 'ping' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
                ]);
                return response;
            } catch (error) {
                // Return null for any error (timeout, no listener, etc.)
                return null;
            }
        };
        
        // First, try to ping existing content script (loaded from manifest)
        console.log('Checking if content script is loaded...');
        const existingPing = await pingContentScript(1500);
        if (existingPing && existingPing.success) {
            console.log('Content script already loaded and responding');
            return { reloaded: false };
        }
        
        // Content script not responding - try to reload it
        console.log('Content script not responding. Attempting to reload content scripts...');
        
        try {
            // Get tab info to check URL
            const tab = await chrome.tabs.get(tabId);
            const url = tab.url || '';
            
            // Verify we're on a supported email provider
            const isSupportedEmail = url.includes('mail.google.com') || 
                                   url.includes('outlook.live.com') || 
                                   url.includes('outlook.office.com') || 
                                   url.includes('outlook.office365.com');
            
            if (!isSupportedEmail) {
                throw new Error('Please navigate to Gmail or Outlook to use this extension.');
            }
            
            // Try to reload the content scripts by reloading the page
            // This is the most reliable way to ensure content scripts are loaded
            // Note: For Gmail/Outlook web apps, reloading is safe as they preserve state
            console.log('Reloading page to inject content scripts...');
            
            // Update status to inform user about reload
            // Note: This will only work if updateStatus is available (it should be)
            if (typeof this.updateStatus === 'function') {
                this.updateStatus('Reloading page to connect...', 'loading');
            }
            
            await chrome.tabs.reload(tabId);
            
            // Wait for page to reload and content script to initialize
            // Give it time for the page to reload and scripts to load
            console.log('Waiting for page reload and content script initialization...');
            
            // Update status during wait
            if (typeof this.updateStatus === 'function') {
                this.updateStatus('Waiting for page to reload...', 'loading');
            }
            
            let pingSuccess = false;
            const maxAttempts = 12; // More attempts since we need to wait for page reload
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                // Wait longer on first attempt to allow page reload
                const delay = attempt === 0 ? 2000 : 500 + (attempt * 300);
                if (attempt > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                try {
                    const pingResponse = await pingContentScript(2000);
                    if (pingResponse && pingResponse.success) {
                        console.log(`Content script verified ready after reload and ${attempt + 1} attempt(s)`);
                        pingSuccess = true;
                        break;
                    }
                } catch (error) {
                    // Page might still be reloading, continue waiting
                    console.log(`Page still reloading or content script initializing (attempt ${attempt + 1})...`);
                    
                    // Update status periodically during wait
                    if (typeof this.updateStatus === 'function' && attempt % 2 === 0) {
                        this.updateStatus(`Connecting... (attempt ${attempt + 1})`, 'loading');
                    }
                }
                
                if (attempt < maxAttempts - 1) {
                    console.log(`Content script ping attempt ${attempt + 1} failed, waiting and retrying...`);
                }
            }
            
            if (!pingSuccess) {
                // Even after reload, content script isn't responding
                // This is unusual - might be a configuration issue
                throw new Error('Content script not responding after reload. Please try refreshing the page manually.');
            }
            
            console.log('Content script verified and ready after reload');
            return { reloaded: true };
        } catch (error) {
            console.error('Failed to ensure content script is loaded:', error);
            
            // If reload failed (e.g., permission denied), try without reload
            if (error.message.includes('reload') || error.message.includes('Cannot access')) {
                console.log('Reload failed, trying to wait for existing content script...');
                
                // Last resort: wait for content script that might be loading
                let pingSuccess = false;
                for (let attempt = 0; attempt < 8; attempt++) {
                    const delay = 500 + (attempt * 400);
                    if (attempt > 0) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                    
                    const pingResponse = await pingContentScript(2000);
                    if (pingResponse && pingResponse.success) {
                        console.log(`Content script verified ready after ${attempt + 1} attempt(s) (no reload)`);
                        pingSuccess = true;
                        break;
                    }
                    
                    if (attempt < 7) {
                        console.log(`Content script ping attempt ${attempt + 1} failed, waiting and retrying...`);
                    }
                }
                
                if (!pingSuccess) {
                    throw new Error('Content script not responding. Please refresh the Gmail/Outlook tab and try again.');
                }
                
                return { reloaded: false };
            } else {
                // Re-throw the original error
                throw error;
            }
        }
    }
    
    /**
     * Extract current email thread from active tab
     * 
     * Reference: docs/spec.md - Email Thread Extraction requirements
     * 
     * Coordinates with content script to extract thread content,
     * validates the data, and triggers summary generation.
     * 
     * @returns {Promise<void>}
     */
    async extractCurrentThread() {
        // Prevent multiple simultaneous extractions
        if (this.elements.extractBtn.disabled || this.isExtracting) {
            return;
        }
        
        let extractionSucceeded = false;
        this.isExtracting = true; // Mark extraction as in progress
        
        try {
            // Disable button immediately and keep it disabled throughout extraction
            this.elements.extractBtn.disabled = true;
            this.updateStatus('Checking page context...', 'loading');
            
            // Ensure button stays disabled (guard against any code that might re-enable it)
            const ensureButtonDisabled = () => {
                if (this.isExtracting && !extractionSucceeded) {
                    this.elements.extractBtn.disabled = true;
                }
            };
            
            // Check if we're in an extension context
            if (!chrome?.tabs?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            this.updateStatus('Locating active email tab...', 'loading');
            ensureButtonDisabled(); // Ensure button stays disabled
            
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
            ensureButtonDisabled(); // Ensure button stays disabled
            
            console.log('Sending extractThread message to tab:', currentTab.id, 'URL:', currentUrl);
            
            // Ensure content script is loaded before trying to communicate
            // This will automatically reload the page if needed to inject content scripts
            let connectionResult;
            try {
                connectionResult = await this.ensureContentScriptLoaded(currentTab.id);
                ensureButtonDisabled(); // Ensure button stays disabled after connection
            } catch (error) {
                // If connection failed, show helpful error message
                if (error.message.includes('reload') || error.message.includes('refresh')) {
                    throw new Error(`${error.message} You can then try extracting the thread again.`);
                }
                throw error;
            }
            
            this.updateStatus(`Connected to ${provider}`, 'success');
            ensureButtonDisabled(); // Ensure button stays disabled
            
            // After reload, wait for page to be fully loaded and ready
            // Only do this if we actually reloaded the page
            if (connectionResult && connectionResult.reloaded) {
                this.updateStatus('Waiting for page to finish loading...', 'loading');
                ensureButtonDisabled(); // Ensure button stays disabled
                
                // Wait for tab to finish loading
                await new Promise((resolve) => {
                    const checkTabStatus = async () => {
                        try {
                            const tab = await chrome.tabs.get(currentTab.id);
                            if (tab.status === 'complete') {
                                resolve();
                            } else {
                                setTimeout(checkTabStatus, 200);
                            }
                        } catch (error) {
                            // Tab might have been closed or navigated away
                            resolve(); // Continue anyway
                        }
                    };
                    checkTabStatus();
                });
                
                // Wait a bit more for Gmail/Outlook SPA to initialize
                this.updateStatus('Waiting for email thread to load...', 'loading');
                ensureButtonDisabled(); // Ensure button stays disabled
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
            // Verify content script is initialized and page is ready
            // Retry readiness check multiple times with increasing delays
            let pageReady = false;
            const maxReadinessAttempts = 10;
            
            for (let attempt = 0; attempt < maxReadinessAttempts; attempt++) {
                ensureButtonDisabled(); // Ensure button stays disabled during readiness checks
                
                try {
                    const readinessCheck = await chrome.tabs.sendMessage(currentTab.id, { 
                        action: 'checkPageReady' 
                    });
                    
                    if (readinessCheck && readinessCheck.success && readinessCheck.ready) {
                        pageReady = true;
                        console.log(`Page ready after ${attempt + 1} readiness check(s)`);
                        break;
                    }
                    
                    if (attempt < maxReadinessAttempts - 1) {
                        // Wait before retrying
                        const delay = 500 + (attempt * 300);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        
                        if (typeof this.updateStatus === 'function') {
                            this.updateStatus(`Waiting for email thread... (${attempt + 1}/${maxReadinessAttempts})`, 'loading');
                        }
                    }
                } catch (readinessError) {
                    console.log(`Readiness check attempt ${attempt + 1} failed:`, readinessError.message);
                    
                    if (attempt < maxReadinessAttempts - 1) {
                        // Wait before retrying
                        const delay = 500 + (attempt * 300);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
            }
            
            if (!pageReady) {
                throw new Error('Page is not ready yet. Please wait for the email thread to fully load, then try again.');
            }
            
            this.updateStatus('Page ready, extracting thread...', 'loading');
            ensureButtonDisabled(); // Ensure button stays disabled
            
            // Send message to content script to extract thread
            let response;
            try {
                response = await chrome.tabs.sendMessage(currentTab.id, { 
                    action: 'extractThread' 
                });
                ensureButtonDisabled(); // Ensure button stays disabled during extraction
            } catch (sendError) {
                console.error('Failed to send message to content script:', sendError);
                throw new Error('Could not communicate with the page. Try refreshing the Gmail/Outlook tab and try again.');
            }
            
            this.updateStatus('Reading email thread...', 'loading');
            ensureButtonDisabled(); // Ensure button stays disabled while processing
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
                // Only enable generate button if not currently generating
                if (!this.isGenerating) {
                    this.elements.generateDraftsBtn.disabled = false;
                }
                
                // Hide extract button now that thread is extracted
                this.hideSection(this.elements.extractSection);
                
                // Mark extraction as successful
                extractionSucceeded = true;
                
                // Save state after successful thread extraction
                this.saveState();
                
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
            // Mark extraction as complete
            this.isExtracting = false;
            
            // Button state management:
            // - If extraction succeeded: button stays disabled and section is hidden
            // - If extraction failed: re-enable button so user can try again (unless generation is in progress)
            if (!extractionSucceeded) {
                // Only re-enable if generation is not in progress
                if (!this.isGenerating) {
                    this.elements.extractBtn.disabled = false;
                    // Make sure section is visible for retry
                    if (this.elements.extractSection.classList.contains('hidden')) {
                        this.showSection(this.elements.extractSection, false);
                    }
                    console.log('Extract button re-enabled after error');
                } else {
                    console.log('Extract button remains disabled because generation is in progress');
                }
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
                this.currentSummary = response.summary; // Store summary
                this.displaySummary(response.summary, response.keyPoints);
                this.addProcessingIndicator('summarization', response.usedFallback || false);
                
                // Save state after displaying summary
                this.saveState();
                
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
        
        // Store summary in instance variable
        this.currentSummary = summary;
        
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
                    // Save state after translation completes
                    this.saveState();
                } catch (error) {
                    console.error('Auto-translation failed:', error);
                    // Don't show error to user - just log it
                }
            }, 100);
        } else {
            // Save state if no translation needed
            this.saveState();
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
        
        // Use attachment handler to display attachments
        this.attachmentHandler.displayAttachments(attachments);
        
        // Update aria-label
        this.elements.attachments.setAttribute('aria-label', `${attachments.length} attachments found in email thread`);
        
        // Show the section
        this.showSection(this.elements.attachmentsSection);
        
        // Process attachments for summaries
        this.attachmentHandler.processAttachments(attachments);
    }
    
    /**
     * Show attachment details modal (wrapper for AttachmentHandler)
     * Exposed for testing purposes
     * @param {Object} attachment - Attachment object
     */
    showAttachmentDetails(attachment) {
        this.attachmentHandler.showAttachmentDetails(attachment);
    }
    
    /**
     * Format file size (wrapper for AttachmentHandler)
     * Exposed for testing purposes
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        return this.attachmentHandler.formatFileSize(bytes);
    }
    
    async generateReplyDrafts() {
        if (!this.currentThread || this.isGenerating) return;
        
        let generationSucceeded = false;
        this.isGenerating = true; // Mark generation as in progress
        
        try {
            this.updateStatus('Preparing draft request...', 'loading');
            this.elements.generateDraftsBtn.disabled = true;
            // Also disable extract button during generation
            this.elements.extractBtn.disabled = true;
            
            // Ensure buttons stay disabled throughout generation
            const ensureButtonDisabled = () => {
                if (this.isGenerating && !generationSucceeded) {
                    this.elements.generateDraftsBtn.disabled = true;
                    this.elements.extractBtn.disabled = true;
                }
            };
            
            // Check if we're in an extension context
            if (!chrome?.runtime?.sendMessage) {
                throw new Error('Chrome extension API not available. Please load this as a Chrome extension.');
            }
            
            const tone = this.elements.toneSelector.value;
            const guidance = this.elements.guidanceText.value.trim();
            
            const userSettings = this.settingsManager.getSettings();
            
            console.log('Starting draft generation:', { tone, guidanceLength: guidance.length, hasThread: !!this.currentThread });
            this.updateStatus(`Composing ${tone} replies...`, 'loading');
            ensureButtonDisabled(); // Ensure button stays disabled
            
            // Add timeout to prevent hanging (draft generation can take 30-60 seconds)
            const response = await Promise.race([
                chrome.runtime.sendMessage({
                    action: 'generateDrafts',
                    thread: this.currentThread,
                    tone: tone,
                    guidance: guidance,
                    userSettings
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Draft generation timed out after 90 seconds. Please try again.')), 90000)
                )
            ]);
            
            console.log('Draft generation response received:', response?.success ? 'success' : 'error');
            ensureButtonDisabled(); // Ensure button stays disabled after async call
            
            if (response && response.success) {
                ensureButtonDisabled(); // Ensure button stays disabled
                
                const drafts = response.drafts || [];
                this.currentDrafts = drafts;
                
                // Calculate draft count before any operations that might fail
                const draftCount = drafts.length;
                
                // Hide the controls panel before displaying drafts
                this.hideSection(this.elements.replyDraftsControlsSection);
                
                // Display drafts (which will scroll to them after rendering)
                try {
                    if (drafts.length > 0) {
                        this.displayReplyDrafts(drafts);
                        this.addProcessingIndicator('drafting', response.usedFallback || false);
                    }
                } catch (displayError) {
                    console.error('Error displaying drafts:', displayError);
                    // Continue even if display fails - drafts are still generated
                }
                
                // Always update status to success message, regardless of display success
                // Use setTimeout to ensure status update happens after any synchronous operations
                setTimeout(() => {
                    if (response.warning) {
                        this.updateStatus(`✓ ${draftCount} draft${draftCount !== 1 ? 's' : ''} generated: ${response.warning}`, 'success');
                    } else {
                        this.updateStatus(`✓ ${draftCount} ${tone} draft${draftCount !== 1 ? 's' : ''} ready`, 'success');
                    }
                }, 0);
                
                // Mark generation as successful
                generationSucceeded = true;
            } else {
                // Error message is already sanitized by the service worker
                throw new Error(response?.error || 'Failed to generate drafts');
            }
        } catch (error) {
            console.error('Error generating drafts:', error);
            
            // Display the sanitized error message from the service worker
            this.updateStatus(`Draft error: ${error.message}`, 'error');
            generationSucceeded = false;
        } finally {
            // Mark generation as complete
            this.isGenerating = false;
            
            // Button state management:
            // - If generation succeeded: generate button stays disabled (drafts are already generated)
            // - If generation failed: re-enable generate button so user can try again
            // - Extract button: re-enable if generation failed, keep disabled if succeeded (thread already extracted)
            if (!generationSucceeded) {
                this.elements.generateDraftsBtn.disabled = false;
                // Re-enable extract button only if not currently extracting
                if (!this.isExtracting) {
                    this.elements.extractBtn.disabled = false;
                }
                console.log('Generate drafts button re-enabled after error');
            } else {
                // Generation succeeded - extract button should stay disabled since thread is already extracted
                console.log('Generate drafts button remains disabled after successful generation');
            }
        }
    }
    
    displayReplyDrafts(drafts, skipTranslation = false) {
        // Prevent recursive calls during translation
        if (this.isTranslatingDrafts) {
            console.log('Translation in progress, skipping displayReplyDrafts call');
            return;
        }
        
        // Update translation module with current drafts
        this.translationUI.setCurrentDrafts(drafts);
        
        // Store drafts in instance variable
        this.currentDrafts = drafts;
        
        // Render drafts using the draft renderer module
        this.draftRenderer.render(drafts, () => {
            // Scroll to drafts section after rendering
            if (this.elements.replyDraftsSection && !this.elements.replyDraftsSection.classList.contains('hidden')) {
                setTimeout(() => {
                    this.elements.replyDraftsSection.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'start' 
                    });
                }, 50);
            }
            
            // Auto-translate if a language is selected (but only on initial render)
            if (!skipTranslation && this.translationUI.translationSettings.targetLanguage !== 'none') {
                // Mark translation as in progress to prevent recursive calls
                this.isTranslatingDrafts = true;
                
                setTimeout(async () => {
                    try {
                        await this.translationUI.translateAllDrafts();
                        // Re-render with translated content, but skip further translation
                        // Pass the already-translated drafts directly to avoid re-translation
                        this.isTranslatingDrafts = false; // Clear flag before re-render
                        this.displayReplyDrafts(this.currentDrafts, true);
                        // Save state after translation completes (only once)
                        this.saveState();
                    } catch (error) {
                        console.error('Auto-translation of drafts failed:', error);
                        this.isTranslatingDrafts = false; // Clear flag on error
                        // Still save state even if translation failed
                        this.saveState();
                    }
                }, 100);
            } else {
                // Save state if no translation needed or translation was skipped
                this.saveState();
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
            // Re-enable extract button after download completes (unless extraction or generation is in progress)
            if (this.elements.extractBtn && this.currentContext.isOnEmailThread && !this.isExtracting && !this.isGenerating) {
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
        // Don't enable if generation is in progress
        if (this.elements.generateDraftsBtn && !this.isGenerating) {
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
        this.displayManager.addProcessingIndicator(operation, usedFallback);
    }
    
    /**
     * Show information about cloud processing
     * 
     * Displays privacy information when cloud processing is used.
     * Uses status message instead of alert() for better UX.
     */
    showCloudInfo() {
        const message = `Cloud processing used. Only extracted email text was sent—no attachments, images, or files. Your privacy remains protected. You can disable cloud fallback in Processing Settings.`;
        this.updateStatus(message, 'info');
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

// Initialize side panel when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sidePanelInstance = new InboxTriageSidePanel();
    });
} else {
    window.sidePanelInstance = new InboxTriageSidePanel();
}
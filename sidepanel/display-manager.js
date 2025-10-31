/**
 * Display Manager Module
 * Handles UI display state management, status messages, and section visibility
 * 
 * This module encapsulates display-related UI logic to keep sidepanel.js focused
 * on orchestration and coordination.
 */

/**
 * Display Manager
 * Manages status messages, section visibility, and processing indicators
 */
export class DisplayManager {
    /**
     * @param {Object} dependencies - Service dependencies
     * @param {Object} dependencies.elements - DOM elements object
     * @param {Object} dependencies.settingsManager - Settings manager instance
     */
    constructor(dependencies) {
        this.elements = dependencies.elements;
        this.settingsManager = dependencies.settingsManager;
        this.statusHideTimeout = null;
    }

    /**
     * Update status message in the UI
     * @param {string} message - Status message
     * @param {string} type - Status type ('info', 'loading', 'success', 'error')
     */
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
     * Show a section and optionally expand it
     * @param {HTMLElement} sectionElement - Section element to show
     * @param {boolean} autoExpand - Whether to automatically expand the section
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
     * @param {HTMLElement} sectionElement - Section element to hide
     */
    hideSection(sectionElement) {
        if (sectionElement) {
            sectionElement.classList.add('hidden');
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
                <button class="info-button" onclick="window.sidePanelInstance.showCloudInfo()" aria-label="Learn more about cloud processing">ⓘ</button>
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
}


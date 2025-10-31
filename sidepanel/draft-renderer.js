/**
 * Draft Renderer Module
 * Handles draft creation, display, and interactions
 */

export class DraftRenderer {
    constructor(elements, updateStatusCallback) {
        this.elements = elements;
        this.updateStatus = updateStatusCallback;
    }

    /**
     * Render drafts to the UI
     * @param {Array} drafts - Array of draft objects
     * @param {Function} onDisplay - Callback after drafts are displayed
     */
    render(drafts, onDisplay = null) {
        this.elements.replyDrafts.innerHTML = '';

        if (drafts && drafts.length > 0) {
            this.elements.replyDrafts.setAttribute('aria-label', `${drafts.length} reply drafts generated`);

            drafts.forEach((draft, index) => {
                const draftElement = this.createDraftElement(draft, index);
                this.elements.replyDrafts.appendChild(draftElement);
            });

            // Show the section
            this.showSection(this.elements.replyDraftsSection);

            if (onDisplay) {
                onDisplay();
            }
        } else {
            // Hide section if no drafts
            this.hideSection(this.elements.replyDraftsSection);
        }
    }

    /**
     * Create a draft element
     * @param {Object} draft - Draft object
     * @param {number} index - Draft index
     * @returns {HTMLElement} Draft element
     */
    createDraftElement(draft, index) {
        const draftDiv = document.createElement('div');
        const isExpanded = index === 0;
        draftDiv.className = `draft accordion-draft${isExpanded ? ' expanded' : ''}`;
        draftDiv.setAttribute('role', 'article');
        draftDiv.setAttribute('aria-labelledby', `draft-title-${index}`);

        // Store reference to draft for copy functionality
        draftDiv._draftData = draft;

        // Create header
        const header = this.createDraftHeader(draft, index, isExpanded);

        // Create content
        const content = this.createDraftContent(draft, index);

        // Assemble
        draftDiv.appendChild(header);
        draftDiv.appendChild(content);

        // Add accordion functionality
        this.addAccordionBehavior(header, content, draftDiv);

        return draftDiv;
    }

    /**
     * Create draft header
     */
    createDraftHeader(draft, index, isExpanded) {
        const header = document.createElement('div');
        header.className = 'draft-header';
        header.setAttribute('tabindex', '0');
        header.setAttribute('role', 'button');
        header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        header.setAttribute('aria-controls', `draft-content-${index}`);

        // Title
        const title = document.createElement('h3');
        title.id = `draft-title-${index}`;
        title.textContent = draft.type || `Draft ${index + 1}`;

        // Toggle indicator
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'draft-toggle';
        toggleSpan.setAttribute('aria-hidden', 'true');
        toggleSpan.textContent = '▼';

        // Assemble header (only title and toggle)
        header.appendChild(title);
        header.appendChild(toggleSpan);

        return header;
    }

    /**
     * Create draft content
     */
    createDraftContent(draft, index) {
        const content = document.createElement('div');
        content.id = `draft-content-${index}`;
        content.className = 'draft-content';

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'draft-body';

        // Body (subject removed - only show body text)
        const bodyP = document.createElement('p');
        bodyP.className = 'draft-text';
        bodyP.textContent = draft.body;
        bodyDiv.appendChild(bodyP);

        // Actions container (moved from header to below content)
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'draft-actions';

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'copy-draft-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.setAttribute('aria-describedby', `copy-help-${index}`);

        // Create Draft button
        const createDraftBtn = document.createElement('button');
        createDraftBtn.type = 'button';
        createDraftBtn.className = 'create-draft-btn';
        createDraftBtn.textContent = 'Create Draft';
        createDraftBtn.setAttribute('aria-describedby', `create-draft-help-${index}`);

        // Screen reader help text
        const helpSpan = document.createElement('span');
        helpSpan.id = `copy-help-${index}`;
        helpSpan.className = 'sr-only';
        helpSpan.textContent = 'Copy this reply draft to clipboard';

        const createDraftHelpSpan = document.createElement('span');
        createDraftHelpSpan.id = `create-draft-help-${index}`;
        createDraftHelpSpan.className = 'sr-only';
        createDraftHelpSpan.textContent = 'Create draft in email client';

        // Assemble actions
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(createDraftBtn);
        actionsDiv.appendChild(helpSpan);
        actionsDiv.appendChild(createDraftHelpSpan);

        // Assemble content: body first, then actions
        content.appendChild(bodyDiv);
        content.appendChild(actionsDiv);
        
        return content;
    }

    /**
     * Add accordion behavior to draft
     */
    addAccordionBehavior(header, content, draftDiv) {
        const toggle = () => {
            const isExpanded = draftDiv.classList.toggle('expanded');
            header.setAttribute('aria-expanded', isExpanded.toString());

            // Update toggle indicator
            const toggleSpan = header.querySelector('.draft-toggle');
            if (toggleSpan) {
                toggleSpan.textContent = isExpanded ? '▼' : '▶';
            }
        };

        // Click to toggle
        header.addEventListener('click', (e) => {
            toggle();
        });

        // Keyboard support
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });

        // Copy button handler (buttons are now in content, not header)
        const copyBtn = content.querySelector('.copy-draft-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyDraftToClipboard(draftDiv._draftData, copyBtn);
            });
        }

        // Create Draft button handler (buttons are now in content, not header)
        const createDraftBtn = content.querySelector('.create-draft-btn');
        if (createDraftBtn) {
            createDraftBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.createDraftInEmailUI(draftDiv._draftData, createDraftBtn);
            });
        }
    }

    /**
     * Create draft in email client (Gmail/Outlook)
     * @param {Object} draft - Draft object
     * @param {HTMLElement} buttonElement - Create Draft button element
     */
    async createDraftInEmailUI(draft, buttonElement) {
        // Store original button text BEFORE changing it (needed in catch block too)
        const originalText = buttonElement ? buttonElement.textContent : 'Create Draft';
        const originalAriaLabel = buttonElement ? buttonElement.getAttribute('aria-label') : 'Create draft in email client';
        
        try {
            // Get current tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]) {
                throw new Error('No active tab found');
            }

            const tabId = tabs[0].id;
            const url = tabs[0].url || '';

            // Check if we're on Gmail or Outlook
            const isGmail = url.includes('mail.google.com');
            const isOutlook = url.includes('outlook.live.com') || 
                             url.includes('outlook.office.com') || 
                             url.includes('outlook.office365.com');

            if (!isGmail && !isOutlook) {
                throw new Error('Please navigate to Gmail or Outlook to create a draft');
            }
            
            // Update button state
            if (buttonElement) {
                buttonElement.textContent = 'Creating...';
                buttonElement.disabled = true;
                buttonElement.setAttribute('aria-label', 'Creating draft in email client...');
            }

            // Send message to content script to create draft
            const response = await chrome.tabs.sendMessage(tabId, {
                action: 'createDraft',
                draftBody: draft.body
            });

            if (response && response.success) {
                if (buttonElement) {
                    buttonElement.textContent = 'Created!';
                    buttonElement.classList.add('create-success');
                    buttonElement.setAttribute('aria-label', 'Draft created successfully');

                    setTimeout(() => {
                        buttonElement.textContent = originalText;
                        buttonElement.classList.remove('create-success');
                        buttonElement.disabled = false;
                        buttonElement.setAttribute('aria-label', originalAriaLabel);
                    }, 2000);
                }

                this.updateStatus('✓ Draft created in email client', 'success');
            } else {
                throw new Error(response?.error || 'Failed to create draft');
            }
        } catch (error) {
            console.error('Failed to create draft:', error);

            if (buttonElement) {
                buttonElement.textContent = 'Failed';
                buttonElement.classList.add('create-error');
                buttonElement.setAttribute('aria-label', 'Failed to create draft');

                setTimeout(() => {
                    buttonElement.textContent = originalText;
                    buttonElement.classList.remove('create-error');
                    buttonElement.disabled = false;
                    buttonElement.setAttribute('aria-label', originalAriaLabel);
                }, 2000);
            }

            this.updateStatus(`Failed to create draft: ${error.message}`, 'error');
        }
    }

    /**
     * Copy draft to clipboard
     * @param {Object} draft - Draft object
     * @param {HTMLElement} buttonElement - Copy button element
     */
    async copyDraftToClipboard(draft, buttonElement) {
        try {
            // Only copy the body text (subject removed)
            await navigator.clipboard.writeText(draft.body);

            if (buttonElement) {
                const originalText = buttonElement.textContent;
                buttonElement.textContent = 'Copied!';
                buttonElement.classList.add('copy-success');
                buttonElement.setAttribute('aria-label', 'Draft copied to clipboard successfully');

                setTimeout(() => {
                    buttonElement.textContent = originalText;
                    buttonElement.classList.remove('copy-success');
                    buttonElement.setAttribute('aria-label', 'Copy this reply draft to clipboard');
                }, 2000);
            }

            this.updateStatus('✓ Draft copied to clipboard', 'success');
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

            this.updateStatus('Failed to copy draft', 'error');
        }
    }

    /**
     * Show a section
     */
    showSection(section) {
        if (section) {
            section.classList.remove('hidden');
        }
    }

    /**
     * Hide a section
     */
    hideSection(section) {
        if (section) {
            section.classList.add('hidden');
        }
    }
}


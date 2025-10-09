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

        // Actions container
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'draft-actions';

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'copy-draft-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.setAttribute('aria-describedby', `copy-help-${index}`);

        // Toggle indicator
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'draft-toggle';
        toggleSpan.setAttribute('aria-hidden', 'true');
        toggleSpan.textContent = '▼';

        // Screen reader help text
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

        // Subject line
        if (draft.subject) {
            const subjectLabel = document.createElement('strong');
            subjectLabel.textContent = 'Subject: ';
            const subjectText = document.createElement('span');
            subjectText.textContent = draft.subject;

            const subjectP = document.createElement('p');
            subjectP.className = 'draft-subject';
            subjectP.appendChild(subjectLabel);
            subjectP.appendChild(subjectText);
            bodyDiv.appendChild(subjectP);
        }

        // Body
        const bodyP = document.createElement('p');
        bodyP.className = 'draft-text';
        bodyP.textContent = draft.body;
        bodyDiv.appendChild(bodyP);

        content.appendChild(bodyDiv);
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
            // Don't toggle if clicking the copy button
            if (e.target.classList.contains('copy-draft-btn') || e.target.closest('.copy-draft-btn')) {
                return;
            }
            toggle();
        });

        // Keyboard support
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle();
            }
        });

        // Copy button handler
        const copyBtn = header.querySelector('.copy-draft-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.copyDraftToClipboard(draftDiv._draftData, copyBtn);
            });
        }
    }

    /**
     * Copy draft to clipboard
     * @param {Object} draft - Draft object
     * @param {HTMLElement} buttonElement - Copy button element
     */
    async copyDraftToClipboard(draft, buttonElement) {
        try {
            const fullText = `Subject: ${draft.subject}\n\n${draft.body}`;
            await navigator.clipboard.writeText(fullText);

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


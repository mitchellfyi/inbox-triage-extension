/**
 * Attachment Handler Module
 * Handles attachment UI display, interaction, and processing
 * 
 * This module encapsulates all attachment-related UI logic to keep sidepanel.js focused
 * on orchestration and coordination.
 */

/**
 * Attachment Handler
 * Manages attachment card creation, modal display, and image analysis
 */
export class AttachmentHandler {
    /**
     * @param {Object} dependencies - Service dependencies
     * @param {Object} dependencies.elements - DOM elements object
     * @param {Function} dependencies.updateStatus - Function to update status messages
     * @param {Function} dependencies.getCurrentThread - Function to get current thread for context
     */
    constructor(dependencies) {
        this.elements = dependencies.elements;
        this.updateStatus = dependencies.updateStatus;
        this.getCurrentThread = dependencies.getCurrentThread;
    }

    /**
     * Display attachments in the UI
     * @param {Array} attachments - List of attachments to display
     */
    displayAttachments(attachments) {
        if (!this.elements.attachments) return;
        
        if (!attachments || attachments.length === 0) {
            this.elements.attachments.innerHTML = '<p class="placeholder">No attachments found</p>';
            return;
        }
        
        // Clear existing attachments
        this.elements.attachments.innerHTML = '';
        
        // Create container for attachment cards
        const attachmentsContainer = document.createElement('div');
        attachmentsContainer.className = 'attachments-container';
        
        attachments.forEach((attachment, index) => {
            attachment.index = index; // Store index for updates
            const attachmentCard = this.createAttachmentCard(attachment, index);
            attachmentsContainer.appendChild(attachmentCard);
        });
        
        this.elements.attachments.appendChild(attachmentsContainer);
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
        
        // Add click handler for detailed view
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
     * Process a single attachment (calls service worker)
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
     * Show attachment details in a modal dialog
     * 
     * Displays comprehensive attachment information including:
     * - Attachment metadata (name, size, type, date)
     * - Extracted content (if available)
     * - AI-generated summary (if available)
     * - Analysis results (for images)
     * - Download/view options
     * 
     * Reference: docs/spec.md - Attachment Summary Display requirements
     * 
     * @param {Object} attachment - Attachment to show details for
     */
    showAttachmentDetails(attachment) {
        if (!attachment || !this.elements.attachmentModalBody) return;
        
        // Update modal title
        if (this.elements.attachmentModalTitle) {
            this.elements.attachmentModalTitle.textContent = attachment.name || 'Attachment Details';
        }
        
        // Clear previous content
        this.elements.attachmentModalBody.innerHTML = '';
        
        // Metadata section
        const metadataSection = this.createDetailSection('Metadata', [
            `Name: ${attachment.name || 'Unknown'}`,
            `Type: ${attachment.type?.toUpperCase() || 'Unknown'}`,
            `Size: ${attachment.size ? this.formatFileSize(attachment.size) : 'Unknown'}`,
            attachment.date ? `Date: ${new Date(attachment.date).toLocaleString()}` : null
        ].filter(Boolean).join('\n'));
        
        // Summary section
        const summarySection = this.createDetailSection('Summary', 
            attachment.summary || 'No summary available yet. Click "Analyze" in the attachment card to generate an AI summary.',
            !attachment.summary
        );
        
        // Extracted content section (if available)
        let extractedSection = null;
        if (attachment.extractedContent) {
            extractedSection = this.createDetailSection('Extracted Content', 
                attachment.extractedContent.substring(0, 5000) + (attachment.extractedContent.length > 5000 ? '\n\n... (content truncated)' : '')
            );
        }
        
        // Analysis results section (for images)
        let analysisSection = null;
        if (attachment.analysis) {
            analysisSection = this.createDetailSection('AI Analysis', 
                typeof attachment.analysis === 'string' ? attachment.analysis : JSON.stringify(attachment.analysis, null, 2)
            );
        }
        
        // Assemble modal content
        this.elements.attachmentModalBody.appendChild(metadataSection);
        this.elements.attachmentModalBody.appendChild(summarySection);
        if (extractedSection) {
            this.elements.attachmentModalBody.appendChild(extractedSection);
        }
        if (analysisSection) {
            this.elements.attachmentModalBody.appendChild(analysisSection);
        }
        
        // Show modal
        this.elements.attachmentModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus on close button for accessibility
        if (this.elements.attachmentModalClose) {
            this.elements.attachmentModalClose.focus();
        }
    }

    /**
     * Create a detail section for the attachment modal
     * @param {string} title - Section title
     * @param {string} content - Section content
     * @param {boolean} isEmpty - Whether content is empty/placeholder
     * @returns {HTMLElement} Section element
     */
    createDetailSection(title, content, isEmpty = false) {
        const section = document.createElement('div');
        section.className = 'attachment-detail-section';
        
        const heading = document.createElement('h3');
        heading.textContent = title;
        section.appendChild(heading);
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'attachment-detail-content' + (isEmpty ? ' empty' : '');
        contentDiv.textContent = content;
        section.appendChild(contentDiv);
        
        return section;
    }

    /**
     * Close the attachment detail modal
     */
    closeAttachmentModal() {
        if (this.elements.attachmentModalOverlay) {
            this.elements.attachmentModalOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Format file size in human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
            const currentThread = this.getCurrentThread();
            const context = analysisType === 'context' ? (currentThread?.subject || '') : '';
            
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
}


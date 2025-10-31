/**
 * Attachment Processing Service
 * Handles attachment processing and summarization for email attachments
 * 
 * This module encapsulates all attachment processing logic to keep service_worker.js focused
 * on orchestration and coordination.
 */

import { sanitizeErrorMessage } from '../utils/error-handler.js';

/**
 * Attachment Processing Service
 * Handles image and document attachment processing
 */
export class AttachmentService {
    /**
     * @param {Object} dependencies - Service dependencies
     * @param {Object} dependencies.aiCapabilities - AI capabilities object
     */
    constructor(dependencies) {
        this.aiCapabilities = dependencies.aiCapabilities;
    }

    /**
     * Process a single attachment for AI analysis
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * 
     * Processes attachments (images, PDFs, DOCX, XLSX) entirely on-device.
     * For images: uses multimodal Prompt API (triggered via UI)
     * For documents: placeholder (PDF/DOCX/XLSX parsing not yet implemented)
     * 
     * @param {Object} attachment - Attachment metadata and content
     * @param {Function} sendResponse - Response callback
     */
    async processAttachment(attachment, sendResponse) {
        try {
            // Check AI capabilities first
            if (!this.aiCapabilities.summarizer && !this.aiCapabilities.promptApi) {
                throw new Error('AI processing is not available in this browser. Please use Chrome 120+ with AI features enabled.');
            }
            
            let extractedText = '';
            let processedContent = '';
            
            // For now, implement basic attachment processing based on type
            // This is a simplified version that will be enhanced with actual file parsing
            switch (attachment.type) {
                case 'image':
                    processedContent = await this.processImageAttachment(attachment);
                    break;
                    
                case 'pdf':
                case 'docx':
                case 'xlsx':
                    processedContent = await this.processDocumentAttachment(attachment);
                    break;
                    
                default:
                    throw new Error(`Unsupported attachment type: ${attachment.type}`);
            }
            
            // Generate summary using Summarizer API
            let summary = '';
            if (processedContent && this.aiCapabilities.summarizer?.available === 'readily') {
                summary = await this.generateAttachmentSummary(processedContent, attachment);
            } else {
                summary = `${attachment.name} (${attachment.type.toUpperCase()}) - Local processing capabilities coming soon.`;
            }
            
            sendResponse({
                success: true,
                attachment: {
                    ...attachment,
                    extractedContent: processedContent,
                    summary: summary,
                    processed: true
                }
            });
            
        } catch (error) {
            console.error('Attachment processing error:', error);
            
            const sanitizedError = sanitizeErrorMessage(error.message);
            sendResponse({
                success: false,
                error: sanitizedError,
                attachment: {
                    ...attachment,
                    summary: `Error processing ${attachment.name}: ${sanitizedError}`,
                    processed: false
                }
            });
        }
    }

    /**
     * Process image attachment during bulk processing
     * 
     * STATUS: Partial implementation - Individual image analysis is fully functional via UI
     * 
     * Image analysis is fully implemented and available via the "Analyze Image" button
     * in the attachment card UI (sidepanel.js analyzeImage() method). This method is
     * called during bulk attachment processing and provides a helpful message directing
     * users to use the UI button for full analysis capabilities.
     * 
     * Full image analysis includes:
     * - General image understanding and description
     * - OCR text extraction from images
     * - Chart and diagram analysis
     * - Contextual analysis based on email content
     * 
     * Future enhancement: Implement bulk image fetching and analysis here for automated
     * processing of all images in a thread. This would require fetching image blobs
     * and using multimodal Prompt API for batch processing.
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * Reference: sidepanel.js analyzeImage() - Full implementation
     * 
     * @param {Object} attachment - Image attachment metadata
     * @returns {string} Helpful message directing users to UI analysis feature
     */
    async processImageAttachment(attachment) {
        try {
            // Check if multimodal Prompt API is available
            if (!this.aiCapabilities.promptApi || this.aiCapabilities.promptApi.available !== 'readily') {
                return `Image analysis unavailable - AI model not ready. Please ensure Chrome AI features are enabled.`;
            }
            
            // Note: Full image analysis is implemented in sidepanel.js analyzeImage() method
            // which uses multimodal Prompt API. This method is called during bulk processing
            // but individual image analysis should be triggered via the UI.
            // 
            // Future enhancement: Implement full image fetching and analysis here for bulk processing
            // Reference: docs/spec.md - Attachment Content Processing requirements
            
            // Image analysis is available via the UI button in sidepanel.js
            // This method is called during bulk processing and returns a helpful message
            return `Image: ${attachment.name}\n\nClick the "Analyze Image" button in the attachment card below to view AI-powered analysis, OCR text extraction, and detailed image understanding.`;
            
        } catch (error) {
            console.error('Image processing error:', error);
            return `Error analyzing image: ${error.message}`;
        }
    }

    /**
     * Process document attachment (PDF, DOCX, XLSX)
     * 
     * STATUS: Planned - Requires file parsing libraries (not yet implemented)
     * 
     * Document parsing requires integration of file parsing libraries:
     * - PDF.js for PDF text extraction
     * - mammoth.js for Word document (.docx) parsing
     * - SheetJS for spreadsheet (.xlsx) data extraction
     * 
     * Current implementation: Returns informative message explaining current
     * capabilities and planned features. Users can view attachment metadata
     * and access files via the attachment card UI.
     * 
     * Privacy: All file processing must occur on-device per docs/spec.md requirements.
     * No attachment content should be transmitted to external services.
     * 
     * Future implementation steps:
     * 1. Integrate file parsing libraries (must be compatible with extension constraints)
     * 2. Fetch document blob from attachment.downloadUrl
     * 3. Extract text content using appropriate library
     * 4. Return extracted text for AI summarization
     * 5. Generate summaries using Summarizer API
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * Reference: docs/todo.md - Implementation roadmap
     * 
     * @param {Object} attachment - Document attachment metadata
     * @returns {string} Informative message about current status and future plans
     */
    async processDocumentAttachment(attachment) {
        try {
            const typeMap = {
                'pdf': 'PDF text extraction',
                'docx': 'Word document text extraction', 
                'xlsx': 'Spreadsheet data extraction'
            };
            
            const description = typeMap[attachment.type] || 'Document processing';
            // Document parsing is planned but not yet implemented
            // Users will see this message when documents are detected
            return `${description} for ${attachment.name}\n\nStatus: Document parsing is planned but not yet available.\n\nFor now, you can:\n• View attachment metadata (name, size, type)\n• Use the attachment card to access the file\n\nFuture updates will include:\n• PDF text extraction\n• Word document parsing\n• Spreadsheet data extraction\n• AI-powered document summaries\n\nSee docs/todo.md for implementation roadmap.`;
            
        } catch (error) {
            console.error('Document processing error:', error);
            return `Error processing document: ${error.message}`;
        }
    }

    /**
     * Generate summary of attachment content using Summarizer API
     * Reference: https://developer.chrome.com/docs/ai/summarizer-api
     * @param {string} content - Extracted content from attachment
     * @param {Object} attachment - Attachment metadata
     * @returns {string} Generated summary
     */
    async generateAttachmentSummary(content, attachment) {
        try {
            if (!content || content.length < 50) {
                return `${attachment.name} - Content too short to summarize effectively`;
            }
            
            // Create summarizer session for attachment content
            // Using global Summarizer constructor - matching pattern used elsewhere in this file
            // Reference: https://developer.chrome.com/docs/ai/summarizer-api
            const summarizer = await Summarizer.create({
                type: 'tldr',
                format: 'plain-text',
                length: 'short'
            });
            
            // Generate summary with context about the file type
            const contextualContent = `File: ${attachment.name} (${attachment.type.toUpperCase()})\n\n${content}`;
            const summary = await summarizer.summarize(contextualContent);
            
            // Clean up session
            summarizer.destroy();
            
            return summary;
            
        } catch (error) {
            console.error('Attachment summary generation error:', error);
            return `${attachment.name} - Error generating summary: ${error.message}`;
        }
    }
}


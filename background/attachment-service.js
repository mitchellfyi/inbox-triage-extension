/**
 * Attachment Processing Service
 * Handles attachment processing and summarization for email attachments
 * 
 * This module encapsulates all attachment processing logic to keep service_worker.js focused
 * on orchestration and coordination.
 */

import { sanitizeErrorMessage } from '../utils/error-handler.js';
import { createSuccessResponse, createErrorResponseForService } from '../utils/response-utils.js';

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
     * For images: uses multimodal Prompt API (triggered via UI button)
     * For documents: basic text extraction attempted where possible (advanced parsing requires external libraries)
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
            // Only generate AI summary if we extracted actual text content (not informative messages)
            let summary = '';
            const hasExtractedText = processedContent && 
                                    processedContent.length > 100 && 
                                    processedContent.startsWith('Extracted text from');
            
            if (hasExtractedText && this.aiCapabilities.summarizer?.available === 'readily') {
                // Extract just the text portion (remove the "Extracted text from..." prefix)
                const textMatch = processedContent.match(/Extracted text from .+:\n\n(.+)/s);
                const textContent = textMatch ? textMatch[1] : processedContent;
                summary = await this.generateAttachmentSummary(textContent, attachment);
            } else {
                // Use processed content as summary (includes informative messages for DOCX/XLSX)
                summary = processedContent || `${attachment.name} (${attachment.type.toUpperCase()}) - Processing completed.`;
            }
            
            sendResponse(createSuccessResponse({
                attachment: {
                    ...attachment,
                    extractedContent: processedContent,
                    summary: summary,
                    processed: true
                }
            }));
            
        } catch (error) {
            console.error('Attachment processing error:', error);
            
            sendResponse(createErrorResponseForService(error, 'Attachment processing'));
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
            // For bulk processing, return a brief status message
            return `Image attachment detected: ${attachment.name}. Use the "Analyze Image" button in the attachment card for AI-powered analysis.`;
            
        } catch (error) {
            console.error('Image processing error:', error);
            return `Error analyzing image: ${error.message}`;
        }
    }

    /**
     * Process document attachment (PDF, DOCX, XLSX)
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * Reference: docs/chrome-ai-api-compliance.md - Chrome AI API patterns
     * 
     * This method fetches document files and attempts to extract text content
     * for AI summarization. Implementation uses native browser APIs where possible.
     * 
     * Processing strategy:
     * - PDF: Attempts basic text extraction using native APIs (limited success for complex PDFs)
     * - DOCX: Requires parsing library (mammoth.js) - currently documents limitation
     * - XLSX: Requires parsing library (SheetJS) - currently documents limitation
     * 
     * Privacy: All file processing occurs on-device per docs/spec.md requirements.
     * No attachment content is transmitted to external services.
     * 
     * @param {Object} attachment - Document attachment metadata with downloadUrl
     * @returns {Promise<string>} Extracted text content or informative message
     * @throws {Error} If file fetching or processing fails
     */
    async processDocumentAttachment(attachment) {
        try {
            // Validate attachment has download URL
            if (!attachment.downloadUrl) {
                throw new Error(`No download URL available for ${attachment.name}`);
            }

            // Fetch file blob
            const fileBlob = await this.fetchAttachmentFile(attachment.downloadUrl);
            
            // Process based on file type
            switch (attachment.type) {
                case 'pdf':
                    return await this.extractPDFText(fileBlob, attachment);
                    
                case 'docx':
                    return await this.extractDOCXText(fileBlob, attachment);
                    
                case 'xlsx':
                    return await this.extractXLSXText(fileBlob, attachment);
                    
                default:
                    throw new Error(`Unsupported document type: ${attachment.type}`);
            }
            
        } catch (error) {
            console.error('Document processing error:', error);
            throw new Error(`Failed to process ${attachment.name}: ${error.message}`);
        }
    }

    /**
     * Fetch attachment file from download URL
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * 
     * Fetches file blob from attachment download URL. Handles CORS and authentication
     * errors gracefully. Service worker context allows cross-origin requests.
     * 
     * @param {string} downloadUrl - URL to fetch attachment from
     * @returns {Promise<Blob>} File blob
     * @throws {Error} If fetch fails or returns non-OK status
     */
    async fetchAttachmentFile(downloadUrl) {
        try {
            // Validate URL
            if (!downloadUrl || typeof downloadUrl !== 'string') {
                throw new Error('Invalid download URL');
            }

            // Fetch file with proper headers
            const response = await fetch(downloadUrl, {
                method: 'GET',
                credentials: 'include', // Include cookies for authenticated requests
                redirect: 'follow'
            });

            // Check response status
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }

            // Get blob
            const blob = await response.blob();
            
            if (!blob || blob.size === 0) {
                throw new Error('Empty file received');
            }

            return blob;

        } catch (error) {
            console.error('File fetch error:', error);
            throw new Error(`Unable to download file: ${error.message}`);
        }
    }

    /**
     * Extract text from PDF file
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * Reference: docs/chrome-ai-api-compliance.md - Chrome AI API patterns
     * 
     * ATTEMPT: Uses native browser APIs to extract text from PDF files.
     * LIMITATION: Native text extraction has limited success with complex PDFs.
     * For full PDF support, PDF.js library would be required but conflicts with
     * project "no external dependencies" constraint.
     * 
     * Current implementation:
     * - Attempts to read PDF as text (works for text-based PDFs)
     * - Falls back to informative message for binary/complex PDFs
     * 
     * Future enhancement: Integrate PDF.js when dependency constraints allow
     * 
     * @param {Blob} fileBlob - PDF file blob
     * @param {Object} attachment - Attachment metadata
     * @returns {Promise<string>} Extracted text or informative message
     */
    async extractPDFText(fileBlob, attachment) {
        try {
            // Check file size (warn for very large files)
            const maxSize = 10 * 1024 * 1024; // 10MB limit
            if (fileBlob.size > maxSize) {
                console.warn(`PDF file ${attachment.name} exceeds size limit (${fileBlob.size} bytes)`);
                return `PDF file ${attachment.name} is too large for processing (${Math.round(fileBlob.size / 1024 / 1024)}MB). Maximum size: 10MB.`;
            }

            // Attempt to extract text using FileReader API
            // Note: This works for text-based PDFs but not binary/encoded PDFs
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    try {
                        const result = reader.result;
                        if (typeof result === 'string') {
                            // Try to extract readable text from PDF structure
                            // PDFs have text streams that may be partially readable
                            const extractedText = this.extractReadableTextFromPDF(result);
                            resolve(extractedText);
                        } else {
                            reject(new Error('Unable to read PDF as text'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = () => reject(new Error('FileReader error'));
                reader.readAsText(fileBlob, 'utf-8');
            });

            // Validate extracted text
            if (text && text.trim().length > 50) {
                // Successfully extracted meaningful text
                return `Extracted text from ${attachment.name}:\n\n${text}`;
            } else {
                // PDF is binary/encoded - native extraction didn't find readable text
                // Return a brief status message without implementation details
                return `PDF file ${attachment.name}: Text extraction attempted but file appears to be binary/encoded. Advanced parsing libraries are required for full text extraction.`;
            }

        } catch (error) {
            console.error('PDF extraction error:', error);
            return `Error extracting text from PDF ${attachment.name}: ${error.message}`;
        }
    }

    /**
     * Extract readable text from PDF data string
     * 
     * Attempts to find readable text patterns in PDF content.
     * PDFs store text in streams that may be partially readable as plain text.
     * 
     * @param {string} pdfData - PDF file content as string
     * @returns {string} Extracted readable text
     */
    extractReadableTextFromPDF(pdfData) {
        // PDF text streams are often between parentheses or marked with BT/ET
        // Try to extract readable sequences
        const textMatches = [];
        
        // Pattern 1: Text between parentheses (common PDF text encoding)
        const parenthesesPattern = /\(([^)]+)\)/g;
        let match;
        while ((match = parenthesesPattern.exec(pdfData)) !== null) {
            const text = match[1];
            // Filter out non-readable content (control chars, very short strings)
            if (text.length > 3 && /[a-zA-Z0-9]/.test(text)) {
                textMatches.push(text);
            }
        }
        
        // Pattern 2: Look for readable text sequences (3+ consecutive letters/numbers)
        const readablePattern = /[a-zA-Z0-9]{3,}/g;
        const readableMatches = pdfData.match(readablePattern);
        if (readableMatches) {
            textMatches.push(...readableMatches);
        }
        
        // Combine and deduplicate
        const uniqueText = [...new Set(textMatches)].join(' ');
        
        // Return if we found meaningful content
        if (uniqueText.length > 50) {
            return uniqueText.substring(0, 32000); // Limit to 32KB for AI processing
        }
        
        return '';
    }

    /**
     * Extract text from DOCX file
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * 
     * STATUS: Requires mammoth.js library (blocked by "no external dependencies" constraint)
     * 
     * DOCX files are ZIP archives containing XML files. Text extraction requires:
     * 1. Unzipping the DOCX file
     * 2. Parsing document.xml to extract text content
     * 3. Handling formatting and structure
     * 
     * Current implementation: Documents limitation and provides clear guidance
     * 
     * Future enhancement: Integrate mammoth.js when dependency constraints allow
     * 
     * @param {Blob} fileBlob - DOCX file blob
     * @param {Object} attachment - Attachment metadata
     * @returns {Promise<string>} Informative message about limitation
     */
    async extractDOCXText(fileBlob, attachment) {
        try {
            // Check file size
            const maxSize = 10 * 1024 * 1024; // 10MB limit
            if (fileBlob.size > maxSize) {
                return `Word document ${attachment.name} exceeds size limit (${Math.round(fileBlob.size / 1024 / 1024)}MB). Maximum size: 10MB.`;
            }

            // DOCX files are ZIP archives - would need unzip library to parse
            // Current implementation documents the limitation clearly
            return `Word document ${attachment.name}: DOCX parsing requires specialized library to extract text from ZIP archive structure. File size: ${Math.round(fileBlob.size / 1024)}KB.`;

        } catch (error) {
            console.error('DOCX extraction error:', error);
            return `Error processing Word document ${attachment.name}: ${error.message}`;
        }
    }

    /**
     * Extract data from XLSX file
     * 
     * Reference: docs/spec.md - Attachment Content Processing requirements
     * 
     * STATUS: Requires SheetJS library (blocked by "no external dependencies" constraint)
     * 
     * XLSX files are ZIP archives containing XML files. Data extraction requires:
     * 1. Unzipping the XLSX file
     * 2. Parsing sharedStrings.xml for cell values
     * 3. Parsing sheet XML files for cell references
     * 4. Handling formulas and formatting
     * 
     * Current implementation: Documents limitation and provides clear guidance
     * 
     * Future enhancement: Integrate SheetJS when dependency constraints allow
     * 
     * @param {Blob} fileBlob - XLSX file blob
     * @param {Object} attachment - Attachment metadata
     * @returns {Promise<string>} Informative message about limitation
     */
    async extractXLSXText(fileBlob, attachment) {
        try {
            // Check file size
            const maxSize = 10 * 1024 * 1024; // 10MB limit
            if (fileBlob.size > maxSize) {
                return `Spreadsheet ${attachment.name} exceeds size limit (${Math.round(fileBlob.size / 1024 / 1024)}MB). Maximum size: 10MB.`;
            }

            // XLSX files are ZIP archives - would need unzip library to parse
            // Current implementation documents the limitation clearly
            return `Spreadsheet ${attachment.name}: XLSX parsing requires specialized library to extract data from ZIP archive structure. File size: ${Math.round(fileBlob.size / 1024)}KB.`;

        } catch (error) {
            console.error('XLSX extraction error:', error);
            return `Error processing spreadsheet ${attachment.name}: ${error.message}`;
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


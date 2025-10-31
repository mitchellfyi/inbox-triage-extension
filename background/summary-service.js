/**
 * Summary Generation Service
 * Handles email thread summarization using Chrome's Summarizer API and external APIs
 * 
 * This module encapsulates all summary generation logic to keep service_worker.js focused
 * on orchestration and coordination.
 */

import { sanitizeErrorMessage } from '../utils/error-handler.js';
import { createSuccessResponse, createErrorResponseForService } from '../utils/response-utils.js';
import { broadcastOperationStatus, StatusStages } from '../utils/status-utils.js';
import { OpenAIAPI, AnthropicAPI, GoogleAIAPI } from './api-integrations.js';

/**
 * Summary Generation Service
 * Handles on-device and external API summarization
 */
export class SummaryService {
    /**
     * @param {Object} dependencies - Service dependencies
     * @param {Object} dependencies.aiCapabilities - AI capabilities object
     * @param {Function} dependencies.broadcastModelStatus - Function to broadcast status updates
     * @param {Function} dependencies.shouldUseCloudFallback - Function to check fallback decision
     */
    constructor(dependencies) {
        this.aiCapabilities = dependencies.aiCapabilities;
        this.broadcastModelStatus = dependencies.broadcastModelStatus;
        this.shouldUseCloudFallback = dependencies.shouldUseCloudFallback;
    }

    /**
     * Generate summary of email thread using Summarizer API
     * 
     * Reference: docs/spec.md - AI-Powered Summarization requirements
     * Reference: https://developer.chrome.com/docs/ai/summarizer-api
     * 
     * Generates TL;DR summary (under 100 words) and up to 5 key points.
     * Handles model availability checks, content size limits, and fallback logic.
     * 
     * @param {Object} thread - Email thread data
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings (processing mode, API key)
     */
    async generateSummary(thread, sendResponse, userSettings = null) {
        try {
            const processingMode = userSettings?.processingMode || 'device-only';
            const useApiKey = userSettings?.useApiKey || false;
            let usedFallback = false;
            
            // If user has configured a custom API key, use it
            if (useApiKey && userSettings?.apiKey) {
                return await this.generateSummaryWithExternalAPI(thread, sendResponse, userSettings);
            }
            
            // Apply hybrid fallback decision rules as documented in docs/spec.md
            const fallbackDecision = this.shouldUseCloudFallback('summarization', processingMode, thread);
            
            if (fallbackDecision.shouldFallback && processingMode === 'hybrid') {
                // Cloud fallback would be implemented here
                // For now, show privacy-preserving error message
                throw new Error(`${fallbackDecision.reason}. Cloud fallback is not implemented to maintain privacy guarantees.`);
            }
            
            // Check AI capabilities first
            if (!this.aiCapabilities.summarizer) {
                if (processingMode === 'hybrid') {
                    throw new Error('AI summarization is not available in this browser. Cloud fallback is not implemented to maintain privacy guarantees. Please use Chrome 120+ with AI features enabled.');
                } else {
                    throw new Error('AI summarization is not available in this browser. Please use Chrome 120+ with AI features enabled.');
                }
            }
            
            // Check if model is ready  
            const capabilities = this.aiCapabilities.summarizer;
            if (capabilities.available === 'after-download') {
                if (processingMode === 'hybrid') {
                    throw new Error('AI model is downloading. Cloud fallback is not implemented to maintain privacy guarantees. Please wait for download to complete.');
                } else {
                    throw new Error('AI model is downloading. This may take a few minutes. Please try again later.');
                }
            } else if (capabilities.available === 'no') {
                if (processingMode === 'hybrid') {
                    throw new Error('AI summarization is not available. Cloud fallback is not implemented to maintain privacy guarantees. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                } else {
                    throw new Error('AI summarization is not available. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                }
            }
            
            // Combine all message content and apply content size limits
            let fullText = this.combineThreadMessages(thread);
            
            // Apply content size limits as per docs/spec.md (32,000 characters max)
            if (fullText && fullText.length > 32000) {
                console.warn('Content exceeds 32,000 character limit, truncating for on-device processing');
                fullText = this.truncateContentForProcessing(fullText, 32000);
            }
            
            if (!fullText || fullText.length < 50) {
                throw new Error('Not enough content to summarize');
            }
            
            // Broadcast progress update
            broadcastOperationStatus(this.broadcastModelStatus, 'summarizing', StatusStages.GENERATING_TLDR);
            
            // Create TL;DR summarizer session - matching docs exactly
            // Reference: https://developer.chrome.com/docs/ai/summarizer-api
            // Example from docs: const summarizer = await Summarizer.create({...})
            const tldrSummarizer = await Summarizer.create({
                type: 'tldr',
                format: 'plain-text',
                length: 'short',
                monitor(m) {
                    m.addEventListener('downloadprogress', (e) => {
                        console.log(`Summarizer download progress: ${e.loaded * 100}%`);
                    });
                }
            });
            
            // Generate TL;DR summary
            const summary = await tldrSummarizer.summarize(fullText);
            tldrSummarizer.destroy();
            
            // Broadcast progress update
            broadcastOperationStatus(this.broadcastModelStatus, 'summarizing', StatusStages.GENERATING_KEY_POINTS);
            
            let keyPoints = [];
            
            // Try to use key-points summarizer if available, fallback to manual extraction
            try {
                const keyPointsSummarizer = await Summarizer.create({
                    type: 'key-points',
                    format: 'plain-text',
                    length: 'short',
                    monitor(m) {
                        m.addEventListener('downloadprogress', (e) => {
                            console.log(`Key-points summarizer download: ${e.loaded * 100}%`);
                        });
                    }
                });
                
                const keyPointsText = await keyPointsSummarizer.summarize(fullText);
                keyPointsSummarizer.destroy();
                
                // Parse the key points text into an array
                keyPoints = this.parseKeyPointsFromText(keyPointsText);
                
            } catch (keyPointsError) {
                console.warn('Key-points summarizer not available, using fallback extraction:', keyPointsError.message);
                // Fallback to manual extraction
                keyPoints = this.extractKeyPoints(fullText, 5);
            }
            
            // Broadcast completion
            broadcastOperationStatus(this.broadcastModelStatus, 'summarizing', StatusStages.COMPLETED);
            
            sendResponse(createSuccessResponse(
                { summary, keyPoints },
                { usedFallback: usedFallback }
            ));
            
        } catch (error) {
            console.error('Summary generation error:', error);
            
            // Broadcast error status
            broadcastOperationStatus(this.broadcastModelStatus, 'summarizing', StatusStages.ERROR, {
                error: sanitizeErrorMessage(error.message)
            });
            
            sendResponse(createErrorResponseForService(error, 'Summary generation'));
        }
    }

    /**
     * Generate summary using external API (OpenAI, Anthropic, Google)
     * @param {Object} thread - Email thread data
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings including API key
     */
    async generateSummaryWithExternalAPI(thread, sendResponse, userSettings) {
        try {
            const fullText = this.combineThreadMessages(thread);
            
            if (!fullText || fullText.length < 50) {
                throw new Error('Not enough content to summarize');
            }
            
            const provider = userSettings.apiProvider || 'openai';
            const apiKey = userSettings.apiKey;
            
            let summary = '';
            let keyPoints = [];
            
            // Call appropriate API based on provider
            switch (provider) {
                case 'openai':
                    const openaiResult = await OpenAIAPI.summarize(fullText, apiKey);
                    summary = openaiResult.summary;
                    keyPoints = openaiResult.keyPoints;
                    break;
                    
                case 'anthropic':
                    const claudeResult = await AnthropicAPI.summarize(fullText, apiKey);
                    summary = claudeResult.summary;
                    keyPoints = claudeResult.keyPoints;
                    break;
                    
                case 'google':
                    const geminiResult = await GoogleAIAPI.summarize(fullText, apiKey);
                    summary = geminiResult.summary;
                    keyPoints = geminiResult.keyPoints;
                    break;
                    
                default:
                    throw new Error(`Unsupported API provider: ${provider}`);
            }
            
            sendResponse(createSuccessResponse(
                { summary, keyPoints },
                { usedFallback: true } // Indicate external API was used
            ));
            
        } catch (error) {
            console.error('External API summary generation error:', error);
            sendResponse(createErrorResponseForService(error, 'External API summary generation'));
        }
    }

    /**
     * Combine all messages from a thread into a single text string
     * @param {Object} thread - Email thread data
     * @returns {string} Combined thread text
     */
    combineThreadMessages(thread) {
        if (!thread.messages || thread.messages.length === 0) {
            return '';
        }
        
        return thread.messages
            .map(msg => `From: ${msg.sender?.name || 'Unknown'}\n${msg.content}`)
            .join('\n\n---\n\n');
    }

    /**
     * Parse key points text returned by the AI into an array
     * @param {string} keyPointsText - Text containing key points from AI
     * @returns {Array<string>} Array of key points
     */
    parseKeyPointsFromText(keyPointsText) {
        if (!keyPointsText || typeof keyPointsText !== 'string') {
            return [];
        }
        
        // Split by common delimiters and clean up
        const points = keyPointsText
            .split(/[\n\r•\-\*]\s*/)
            .map(point => point.trim())
            .filter(point => point.length > 10 && !point.match(/^(\d+\.|\•|\-|\*)/))
            .slice(0, 5); // Limit to 5 key points
        
        return points.length > 0 ? points : [keyPointsText.trim()];
    }

    /**
     * Extract key points from text using simple heuristics
     * Fallback method when AI key-points summarizer is unavailable
     * @param {string} text - Text to extract key points from
     * @param {number} maxPoints - Maximum number of key points to return
     * @returns {Array<string>} Array of key points
     */
    extractKeyPoints(text, maxPoints = 5) {
        // Simple key point extraction (could be enhanced with AI)
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
        const keyPoints = [];
        
        // Look for sentences with key indicators
        const indicators = ['important', 'need', 'require', 'must', 'should', 'deadline', 'urgent'];
        
        sentences.forEach(sentence => {
            if (keyPoints.length >= maxPoints) return;
            
            const lowerSentence = sentence.toLowerCase();
            if (indicators.some(indicator => lowerSentence.includes(indicator))) {
                keyPoints.push(sentence.trim());
            }
        });
        
        // Fill remaining slots with longest sentences
        if (keyPoints.length < maxPoints) {
            const remainingSentences = sentences
                .filter(s => !keyPoints.includes(s.trim()))
                .sort((a, b) => b.length - a.length);
            
            const needed = maxPoints - keyPoints.length;
            keyPoints.push(...remainingSentences.slice(0, needed).map(s => s.trim()));
        }
        
        return keyPoints.filter(point => point.length > 0);
    }

    /**
     * Truncate content for local processing while preserving essential information
     * @param {string} content - Original content
     * @param {number} maxLength - Maximum character length  
     * @returns {string} Truncated content
     */
    truncateContentForProcessing(content, maxLength) {
        if (!content || content.length <= maxLength) return content;
        
        // Try to truncate at sentence boundaries to preserve coherence
        const sentences = content.split(/[.!?]+/);
        let truncated = '';
        let totalLength = 0;
        
        for (const sentence of sentences) {
            const sentenceWithPunct = sentence.trim() + '.';
            if (totalLength + sentenceWithPunct.length > maxLength - 100) {
                // Leave some buffer for essential information marker
                break;
            }
            truncated += sentenceWithPunct + ' ';
            totalLength += sentenceWithPunct.length + 1;
        }
        
        // Add truncation indicator
        truncated += '\n\n[Content truncated for processing...]';
        
        return truncated.trim();
    }

    /**
     * Prepare content for cloud processing (text only, no attachments)
     * This ensures only extracted text is sent, never raw files or images
     * @param {Object} thread - Email thread data
     * @returns {Object} Sanitized content for cloud processing
     */
    prepareContentForCloudProcessing(thread) {
        // Extract only text content, never attachments or images
        const textContent = this.combineThreadMessages(thread);
        
        return {
            content: textContent,
            metadata: {
                threadLength: thread.messages?.length || 0,
                subject: thread.subject || '',
                // Never include attachment content or personal identifiers
                hasAttachments: (thread.attachments?.length || 0) > 0,
                attachmentCount: thread.attachments?.length || 0
            }
        };
    }
}


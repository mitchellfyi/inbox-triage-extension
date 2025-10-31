/**
 * Draft Generation Service
 * Handles email reply draft generation using Chrome's Prompt API and external APIs
 * 
 * This module encapsulates all draft generation logic to keep service_worker.js focused
 * on orchestration and coordination.
 */

import { sanitizeErrorMessage } from '../utils/error-handler.js';
import { createSuccessResponse, createErrorResponseForService } from '../utils/response-utils.js';
import { validateDraftsSchema, validateAndFormatDrafts } from '../utils/validation.js';
import { OpenAIAPI, AnthropicAPI, GoogleAIAPI, createSystemPrompt, createReplyPrompt, extractThreadContext } from './api-integrations.js';

/**
 * Draft Generation Service
 * Handles on-device and external API draft generation
 */
export class DraftService {
    /**
     * @param {Object} dependencies - Service dependencies
     * @param {Object} dependencies.aiCapabilities - AI capabilities object
     * @param {Function} dependencies.shouldUseCloudFallback - Function to check fallback decision
     * @param {Object} dependencies.summaryService - SummaryService instance for combining thread messages
     */
    constructor(dependencies) {
        this.aiCapabilities = dependencies.aiCapabilities;
        this.shouldUseCloudFallback = dependencies.shouldUseCloudFallback;
        this.summaryService = dependencies.summaryService;
    }

    /**
     * Generate reply drafts using Prompt API with JSON schema
     * 
     * Reference: docs/spec.md - Reply Draft Generation requirements
     * Reference: https://developer.chrome.com/docs/ai/prompt-api
     * 
     * Generates exactly 3 reply drafts in selected tone:
     * 1. Short answer (quick acknowledgment)
     * 2. Medium with clarifications (detailed response)
     * 3. Polite with next steps (comprehensive response)
     * 
     * @param {Object} thread - Email thread data
     * @param {string} tone - Selected tone (neutral, friendly, assertive, formal)
     * @param {string} guidance - User-provided guidance for drafts
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings (processing mode, API key)
     */
    async generateReplyDrafts(thread, tone, guidance, sendResponse, userSettings = null) {
        try {
            const processingMode = userSettings?.processingMode || 'device-only';
            const useApiKey = userSettings?.useApiKey || false;
            let usedFallback = false;
            
            // If user has configured a custom API key, use it
            if (useApiKey && userSettings?.apiKey) {
                return await this.generateDraftsWithExternalAPI(thread, tone, guidance, sendResponse, userSettings);
            }
            
            // Apply hybrid fallback decision rules as documented in docs/spec.md  
            const fallbackDecision = this.shouldUseCloudFallback('drafting', processingMode, thread);
            
            if (fallbackDecision.shouldFallback && processingMode === 'hybrid') {
                // Cloud fallback would be implemented here
                // For now, show privacy-preserving error message
                throw new Error(`${fallbackDecision.reason}. Cloud fallback is not implemented to maintain privacy guarantees.`);
            }
            
            if (!this.aiCapabilities.promptApi) {
                if (processingMode === 'hybrid') {
                    throw new Error('Language Model API not available. Cloud fallback is not implemented to maintain privacy guarantees. Please enable AI features in Chrome.');
                } else {
                    throw new Error('Language Model API not available. Please enable AI features in Chrome.');
                }
            }
            
            // Check if model is ready
            const capabilities = this.aiCapabilities.promptApi;
            if (capabilities.available === 'after-download') {
                if (processingMode === 'hybrid') {
                    throw new Error('AI model is downloading. Cloud fallback is not implemented to maintain privacy guarantees. Please wait for download to complete.');
                } else {
                    throw new Error('AI model is downloading. This may take a few minutes. Please try again later.');
                }
            } else if (capabilities.available === 'no') {
                if (processingMode === 'hybrid') {
                    throw new Error('Language Model API is not available. Cloud fallback is not implemented to maintain privacy guarantees. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                } else {
                    throw new Error('Language Model API is not available. Please enable Chrome AI features in Settings > Privacy and security > Experimental AI.');
                }
            }
            
            const fullText = this.summaryService.combineThreadMessages(thread);
            const subject = thread.subject || 'Re: Email Thread';
            
            if (!fullText || fullText.length < 20) {
                throw new Error('Not enough content to generate meaningful replies');
            }
            
            // Extract context for better reply drafting (key points, questions, action items)
            const context = extractThreadContext(fullText);
            
            // Create language model session - matching docs pattern exactly
            // Following same pattern as Summarizer API
            // Reference: https://developer.chrome.com/docs/ai/prompt-api
            // Example: const session = await LanguageModel.create({...})
            const session = await LanguageModel.create({
                initialPrompts: [
                    { role: 'system', content: createSystemPrompt(tone) }
                ],
                temperature: 0.7,
                topK: 3
            });
            
            // Generate drafts using structured prompt with context preservation
            const prompt = createReplyPrompt(fullText, subject, tone, guidance, context);
            const response = await session.prompt(prompt);
            
            // Clean up session immediately
            session.destroy();
            
            // Parse and validate JSON response
            let drafts;
            try {
                // Clean the response - remove any non-JSON text
                const cleanedResponse = this.cleanJsonResponse(response);
                drafts = JSON.parse(cleanedResponse);
                
                // Validate against schema
                const validation = validateDraftsSchema(drafts);
                if (!validation.isValid) {
                    console.warn('Schema validation failed:', validation.errors);
                    throw new Error(`Invalid response format: ${validation.errors.join(', ')}`);
                }
                
            } catch (parseError) {
                console.warn('JSON parsing failed, using fallback:', parseError.message);
                // Enhanced fallback with original response
                drafts = this.createFallbackDrafts(response, subject, tone);
            }
            
            // Validate and format drafts
            const signature = userSettings?.signature || '';
            const formattedDrafts = validateAndFormatDrafts(drafts, subject, signature);
            
            // Ensure we always have exactly 3 drafts
            if (formattedDrafts.length !== 3) {
                console.warn(`Expected 3 drafts, got ${formattedDrafts.length}, using fallback`);
                const fallback = this.createFallbackDrafts('', subject, tone);
                const fallbackFormatted = validateAndFormatDrafts(fallback, subject, signature);
                
                sendResponse(createSuccessResponse(
                    { drafts: fallbackFormatted },
                    { 
                        warning: 'AI response was incomplete, using fallback drafts',
                        usedFallback: usedFallback
                    }
                ));
                return;
            }
            
            sendResponse(createSuccessResponse(
                { drafts: formattedDrafts },
                { usedFallback: usedFallback }
            ));
            
        } catch (error) {
            console.error('Draft generation error:', error);
            sendResponse(createErrorResponseForService(error, 'Draft generation'));
        }
    }

    /**
     * Generate drafts using external API (OpenAI, Anthropic, Google)
     * @param {Object} thread - Email thread data
     * @param {string} tone - Selected tone
     * @param {string} guidance - User guidance
     * @param {Function} sendResponse - Response callback
     * @param {Object} userSettings - User settings including API key
     */
    async generateDraftsWithExternalAPI(thread, tone, guidance, sendResponse, userSettings) {
        try {
            const fullText = this.summaryService.combineThreadMessages(thread);
            const subject = thread.subject || 'Re: Email Thread';
            
            if (!fullText || fullText.length < 20) {
                throw new Error('Not enough content to generate meaningful replies');
            }
            
            // Extract context for better reply drafting
            const context = extractThreadContext(fullText);
            
            const provider = userSettings.apiProvider || 'openai';
            const apiKey = userSettings.apiKey;
            
            let drafts = [];
            
            // Call appropriate API based on provider with context preservation
            switch (provider) {
                case 'openai':
                    drafts = await OpenAIAPI.generateDrafts(fullText, subject, tone, guidance, apiKey, context);
                    break;
                    
                case 'anthropic':
                    drafts = await AnthropicAPI.generateDrafts(fullText, subject, tone, guidance, apiKey, context);
                    break;
                    
                case 'google':
                    drafts = await GoogleAIAPI.generateDrafts(fullText, subject, tone, guidance, apiKey, context);
                    break;
                    
                default:
                    throw new Error(`Unsupported API provider: ${provider}`);
            }
            
            // Validate and format drafts with signature
            const signature = userSettings?.signature || '';
            const formattedDrafts = validateAndFormatDrafts({ drafts }, subject, signature);
            
            if (formattedDrafts.length !== 3) {
                console.warn(`Expected 3 drafts, got ${formattedDrafts.length}`);
                const fallback = this.createFallbackDrafts('', subject, tone);
                const fallbackFormatted = validateAndFormatDrafts(fallback, subject, signature);
                
                sendResponse(createSuccessResponse(
                    { drafts: fallbackFormatted },
                    { 
                        warning: 'External API response was incomplete, using fallback drafts',
                        usedFallback: true
                    }
                ));
                return;
            }
            
            sendResponse(createSuccessResponse(
                { drafts: formattedDrafts },
                { usedFallback: true } // Indicate external API was used
            ));
            
        } catch (error) {
            console.error('External API draft generation error:', error);
            sendResponse(createErrorResponseForService(error, 'External API draft generation'));
        }
    }

    /**
     * Clean JSON response by removing non-JSON text
     * @param {string} response - Raw response from AI
     * @returns {string} Cleaned JSON string
     */
    cleanJsonResponse(response) {
        // Find JSON object boundaries
        const startIndex = response.indexOf('{');
        const lastIndex = response.lastIndexOf('}');
        
        if (startIndex === -1 || lastIndex === -1) {
            throw new Error('No JSON object found in response');
        }
        
        return response.substring(startIndex, lastIndex + 1);
    }

    /**
     * Create fallback drafts if AI response parsing fails
     * @param {string} response - The failed AI response (for context)
     * @param {string} subject - The original email subject
     * @param {string} tone - The selected tone
     * @returns {Object} Fallback drafts object
     */
    createFallbackDrafts(response, subject, tone) {
        const toneAdjustments = {
            neutral: {
                quick: 'Thank you for your email. I will review this and get back to you soon.',
                medium: 'I received your email and understand your request. Let me look into this and provide you with a detailed response by end of day.',
                detailed: 'Thank you for reaching out. I will review the information you provided and schedule a follow-up meeting to discuss next steps. I will send you a meeting invite within the next 24 hours.'
            },
            friendly: {
                quick: 'Thanks so much for your email! I\'ll take a look and get back to you shortly.',
                medium: 'Hi there! I got your email and really appreciate you reaching out. Let me dive into this and I\'ll send you a thoughtful response later today.',
                detailed: 'Hi! Thanks for your message - I really appreciate you taking the time to reach out. I want to give this the attention it deserves, so I\'ll review everything carefully and set up some time for us to chat about next steps. Expect a meeting invite from me soon!'
            },
            assertive: {
                quick: 'I have received your email and will respond with the requested information shortly.',
                medium: 'I understand your request and will provide a comprehensive response. I will review the details and deliver my analysis by the end of the business day.',
                detailed: 'I have carefully noted your requirements and will address each point systematically. I will conduct a thorough review of the information provided and schedule a meeting to present my findings and recommended action items. You can expect my detailed response within 24 hours.'
            },
            formal: {
                quick: 'Thank you for your correspondence. I shall review your request and respond accordingly.',
                medium: 'I acknowledge receipt of your message and appreciate you bringing this matter to my attention. I will conduct a thorough review of the information provided and respond with a comprehensive analysis by close of business today.',
                detailed: 'Dear colleague, I am writing to acknowledge receipt of your correspondence. I appreciate you taking the time to outline your requirements in detail. I shall conduct a comprehensive review of all materials provided and prepare a thorough response addressing each of your points. I will schedule a follow-up meeting to discuss the matter further and present my recommendations. Please expect my detailed response within one business day.'
            }
        };
        
        const selectedTone = toneAdjustments[tone] || toneAdjustments.neutral;
        
        return {
            drafts: [
                {
                    type: 'Quick Response',
                    subject: `Re: ${subject}`,
                    body: selectedTone.quick
                },
                {
                    type: 'Acknowledgment',
                    subject: `Re: ${subject}`,
                    body: selectedTone.medium
                },
                {
                    type: 'Next Steps',
                    subject: `Re: ${subject}`,
                    body: selectedTone.detailed
                }
            ]
        };
    }
}


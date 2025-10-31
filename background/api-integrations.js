/**
 * External API Integrations Module
 * Handles all external AI API calls (OpenAI, Anthropic, Google AI)
 * 
 * This module encapsulates all external API integrations to keep service_worker.js focused
 * on orchestration and Chrome AI APIs.
 */

/**
 * Create system prompt with JSON schema constraints
 * 
 * Reference: docs/spec.md - Reply Draft Generation requirements (JSON schema enforcement)
 * 
 * Creates a system prompt that instructs the AI to generate exactly 3 drafts
 * in the specified tone, conforming to the JSON schema structure.
 * 
 * @param {string} tone - The tone to use for replies (neutral, friendly, assertive, formal)
 * @returns {string} System prompt with schema requirements
 */
export function createSystemPrompt(tone) {
    return `You are an AI assistant helping to draft email replies. Generate responses that are:
- ${tone} in tone
- Professional and appropriate for business communication
- Concise but complete
- Properly structured with subject and body
- Return responses as valid JSON with exactly 3 drafts

CRITICAL: You must respond with ONLY valid JSON in the exact format below. Do not include any other text or explanations:
{
  "drafts": [
    {"type": "string", "subject": "string (max 100 chars)", "body": "string (max 500 chars)"},
    {"type": "string", "subject": "string (max 100 chars)", "body": "string (max 1000 chars)"},
    {"type": "string", "subject": "string (max 100 chars)", "body": "string (max 1500 chars)"}
  ]
}

Each draft must have exactly these three fields: type, subject, body. Generate exactly 3 drafts.`;
}

/**
 * Create a structured prompt for reply generation with JSON schema specification
 * 
 * Reference: docs/spec.md - Reply Draft Generation requirements
 * 
 * @param {string} threadText - The email thread content
 * @param {string} originalSubject - The original email subject
 * @param {string} tone - The tone to use for replies
 * @param {string} guidance - Optional user guidance for customizing drafts
 * @returns {string} Structured prompt with JSON requirements
 */
export function createReplyPrompt(threadText, originalSubject, tone, guidance = '') {
    const guidanceSection = guidance ? `\nUSER GUIDANCE:\n${guidance}\n` : '';
    
    return `Based on this email thread, generate 3 different reply drafts in ${tone} tone.

THREAD:
${threadText}

ORIGINAL SUBJECT: ${originalSubject}${guidanceSection}

Generate exactly 3 reply drafts with these characteristics:
1. SHORT RESPONSE: Quick acknowledgment (1-2 sentences, max 500 chars body)
2. MEDIUM RESPONSE: Detailed with clarifications (2-3 paragraphs, max 1000 chars body) 
3. COMPREHENSIVE RESPONSE: Complete with next steps (3-4 paragraphs, max 1500 chars body)
${guidance ? '\nIncorporate the user guidance above into all three drafts where relevant.\n' : ''}
Respond with ONLY the following JSON format (no other text):
{
  "drafts": [
    {
      "type": "Quick Response",
      "subject": "Re: ${originalSubject}",
      "body": "Your short response here (max 500 chars)"
    },
    {
      "type": "Acknowledgment",
      "subject": "Re: ${originalSubject}",
      "body": "Your medium response here (max 1000 chars)"
    },
    {
      "type": "Next Steps",
      "subject": "Re: ${originalSubject}",
      "body": "Your comprehensive response here (max 1500 chars)"
    }
  ]
}`;
}

/**
 * Parse summary response to extract summary and key points
 * @param {string} content - Raw response content
 * @returns {Object} Object with summary and keyPoints array
 */
function parseSummaryResponse(content) {
    const parts = content.split(/Key [Pp]oints?:|Summary:/);
    const summary = parts[0].replace(/TL;DR:?/i, '').trim();
    const keyPointsText = parts[parts.length - 1].trim();
    const keyPoints = keyPointsText.split(/\n/)
        .filter(line => line.trim().match(/^[\-\•\*\d]/))
        .map(line => line.replace(/^[\-\•\*\d\.\)]\s*/, '').trim())
        .slice(0, 5);
    
    return { summary, keyPoints };
}

/**
 * Parse JSON response that may be wrapped in markdown code blocks
 * @param {string} content - Raw response content
 * @returns {Object} Parsed JSON object
 */
function parseJsonResponse(content) {
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(jsonContent);
}

/**
 * OpenAI API Integration
 */
export class OpenAIAPI {
    /**
     * Call OpenAI API for summarization
     * @param {string} text - Text to summarize
     * @param {string} apiKey - OpenAI API key
     * @returns {Object} Summary and key points
     */
    static async summarize(text, apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful assistant that summarizes email threads. Provide a concise TL;DR summary and extract 3-5 key points.'
                    },
                    {
                        role: 'user',
                        content: `Summarize this email thread:\n\n${text}\n\nProvide:\n1. A TL;DR summary (under 100 words)\n2. 3-5 key points as a bullet list`
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        return parseSummaryResponse(content);
    }
    
    /**
     * Call OpenAI API for draft generation
     * @param {string} text - Thread text
     * @param {string} subject - Email subject
     * @param {string} tone - Selected tone
     * @param {string} guidance - User guidance
     * @param {string} apiKey - OpenAI API key
     * @param {Object} context - Optional context object with keyPoints, questions, etc.
     * @returns {Array} Draft objects
     */
    static async generateDrafts(text, subject, tone, guidance, apiKey, context = null) {
        const prompt = createReplyPrompt(text, subject, tone, guidance, context);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: createSystemPrompt(tone)
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1500,
                response_format: { type: 'json_object' }
            })
        });
        
        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        const parsed = parseJsonResponse(content);
        return parsed.drafts || [];
    }
}

/**
 * Anthropic (Claude) API Integration
 */
export class AnthropicAPI {
    /**
     * Call Anthropic API (Claude) for summarization
     * 
     * Uses Anthropic's Messages API to generate email thread summaries
     * Reference: https://docs.anthropic.com/claude/reference/messages_post
     * 
     * Privacy: Only sends extracted email text, never attachments or personal identifiers
     * 
     * @param {string} text - Text to summarize
     * @param {string} apiKey - Anthropic API key
     * @returns {Object} Summary and key points
     * @throws {Error} If API call fails or response is invalid
     */
    static async summarize(text, apiKey) {
        if (!apiKey) {
            throw new Error('Anthropic API key is required');
        }
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 500,
                messages: [
                    {
                        role: 'user',
                        content: `Summarize this email thread:\n\n${text}\n\nProvide:\n1. A TL;DR summary (under 100 words)\n2. 3-5 key points as a bullet list`
                    }
                ],
                system: 'You are a helpful assistant that summarizes email threads. Provide a concise TL;DR summary and extract 3-5 key points.'
            })
        });
        
        if (!response.ok) {
            let errorMessage = `Anthropic API error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage += ` - ${errorData.error.message || errorData.error.type || JSON.stringify(errorData.error)}`;
                }
            } catch (parseError) {
                // If JSON parsing fails, use status text only
                console.error('Failed to parse Anthropic API error response:', parseError);
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
            throw new Error('Invalid response format from Anthropic API: missing or empty content array');
        }
        
        const content = data.content[0].text;
        if (!content || typeof content !== 'string') {
            throw new Error('Invalid response format from Anthropic API: content is not a string');
        }
        
        return parseSummaryResponse(content);
    }
    
    /**
     * Call Anthropic API (Claude) for draft generation
     * 
     * Uses Anthropic's Messages API to generate reply drafts
     * Reference: https://docs.anthropic.com/claude/reference/messages_post
     * 
     * Privacy: Only sends extracted email text, never attachments or personal identifiers
     * 
     * @param {string} text - Thread text
     * @param {string} subject - Email subject
     * @param {string} tone - Selected tone
     * @param {string} guidance - User guidance
     * @param {string} apiKey - Anthropic API key
     * @param {Object} context - Optional context object with keyPoints, questions, etc.
     * @returns {Array} Draft objects
     * @throws {Error} If API call fails or response is invalid
     */
    static async generateDrafts(text, subject, tone, guidance, apiKey, context = null) {
        if (!apiKey) {
            throw new Error('Anthropic API key is required');
        }
        
        const prompt = createReplyPrompt(text, subject, tone, guidance, context);
        const systemPrompt = createSystemPrompt(tone);
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                system: systemPrompt
            })
        });
        
        if (!response.ok) {
            let errorMessage = `Anthropic API error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage += ` - ${errorData.error.message || errorData.error.type || JSON.stringify(errorData.error)}`;
                }
            } catch (parseError) {
                // If JSON parsing fails, use status text only
                console.error('Failed to parse Anthropic API error response:', parseError);
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
            throw new Error('Invalid response format from Anthropic API: missing or empty content array');
        }
        
        const content = data.content[0].text;
        if (!content || typeof content !== 'string') {
            throw new Error('Invalid response format from Anthropic API: content is not a string');
        }
        
        const parsed = parseJsonResponse(content);
        if (!parsed || !parsed.drafts || !Array.isArray(parsed.drafts)) {
            throw new Error('Invalid JSON structure: drafts array not found');
        }
        
        return parsed.drafts;
    }
}

/**
 * Google AI (Gemini) API Integration
 */
export class GoogleAIAPI {
    /**
     * Call Google AI API (Gemini) for summarization
     * 
     * Uses Google's Generative AI API to generate email thread summaries
     * Reference: https://ai.google.dev/docs
     * 
     * Privacy: Only sends extracted email text, never attachments or personal identifiers
     * 
     * @param {string} text - Text to summarize
     * @param {string} apiKey - Google AI API key
     * @returns {Object} Summary and key points
     * @throws {Error} If API call fails or response is invalid
     */
    static async summarize(text, apiKey) {
        if (!apiKey) {
            throw new Error('Google AI API key is required');
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are a helpful assistant that summarizes email threads. Provide a concise TL;DR summary and extract 3-5 key points.\n\nSummarize this email thread:\n\n${text}\n\nProvide:\n1. A TL;DR summary (under 100 words)\n2. 3-5 key points as a bullet list`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 500
                }
            })
        });
        
        if (!response.ok) {
            let errorMessage = `Google AI API error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage += ` - ${errorData.error.message || errorData.error.status || JSON.stringify(errorData.error)}`;
                }
            } catch (parseError) {
                // If JSON parsing fails, use status text only
                console.error('Failed to parse Google AI API error response:', parseError);
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
            throw new Error('Invalid response format from Google AI API: missing or empty candidates array');
        }
        
        if (!data.candidates[0].content || !data.candidates[0].content.parts || !Array.isArray(data.candidates[0].content.parts)) {
            throw new Error('Invalid response format from Google AI API: missing or empty content parts');
        }
        
        const content = data.candidates[0].content.parts[0].text;
        if (!content || typeof content !== 'string') {
            throw new Error('Invalid response format from Google AI API: content is not a string');
        }
        
        return parseSummaryResponse(content);
    }
    
    /**
     * Call Google AI API (Gemini) for draft generation
     * 
     * Uses Google's Generative AI API to generate reply drafts
     * Reference: https://ai.google.dev/docs
     * 
     * Privacy: Only sends extracted email text, never attachments or personal identifiers
     * 
     * @param {string} text - Thread text
     * @param {string} subject - Email subject
     * @param {string} tone - Selected tone
     * @param {string} guidance - User guidance
     * @param {string} apiKey - Google AI API key
     * @param {Object} context - Optional context object with keyPoints, questions, etc.
     * @returns {Array} Draft objects
     * @throws {Error} If API call fails or response is invalid
     */
    static async generateDrafts(text, subject, tone, guidance, apiKey, context = null) {
        if (!apiKey) {
            throw new Error('Google AI API key is required');
        }
        
        const prompt = createReplyPrompt(text, subject, tone, guidance, context);
        const systemPrompt = createSystemPrompt(tone);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${systemPrompt}\n\n${prompt}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                    responseMimeType: 'application/json'
                }
            })
        });
        
        if (!response.ok) {
            let errorMessage = `Google AI API error: ${response.status} ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.error) {
                    errorMessage += ` - ${errorData.error.message || errorData.error.status || JSON.stringify(errorData.error)}`;
                }
            } catch (parseError) {
                // If JSON parsing fails, use status text only
                console.error('Failed to parse Google AI API error response:', parseError);
            }
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
            throw new Error('Invalid response format from Google AI API: missing or empty candidates array');
        }
        
        if (!data.candidates[0].content || !data.candidates[0].content.parts || !Array.isArray(data.candidates[0].content.parts)) {
            throw new Error('Invalid response format from Google AI API: missing or empty content parts');
        }
        
        const content = data.candidates[0].content.parts[0].text;
        if (!content || typeof content !== 'string') {
            throw new Error('Invalid response format from Google AI API: content is not a string');
        }
        
        const parsed = parseJsonResponse(content);
        if (!parsed || !parsed.drafts || !Array.isArray(parsed.drafts)) {
            throw new Error('Invalid JSON structure: drafts array not found');
        }
        
        return parsed.drafts;
    }
}


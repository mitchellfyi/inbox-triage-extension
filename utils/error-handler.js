/**
 * Error Handler Utility
 * Centralized error sanitization for user-friendly error messages
 * 
 * This module provides consistent error handling across the extension,
 * converting technical error messages into user-friendly, actionable messages.
 * 
 * Reference: AGENTS.md - Error Handling Strategy
 */

/**
 * Sanitize error messages to prevent technical details from reaching users
 * 
 * Converts technical error messages (stack traces, API errors, etc.) into
 * user-friendly messages that help users understand what went wrong and how
 * to fix it.
 * 
 * @param {string} errorMessage - Raw error message from exception or API
 * @returns {string} User-friendly error message suitable for display
 */
export function sanitizeErrorMessage(errorMessage) {
    if (!errorMessage || typeof errorMessage !== 'string') {
        return 'An unexpected error occurred. Please try again.';
    }
    
    // Define patterns for technical errors and their user-friendly alternatives
    // Reference: AGENTS.md - Error Handling Strategy
    const errorMappings = [
        {
            patterns: [/stack trace/i, /error.*stack/i, /at\s+\w+\s*\(/, /\n\s*at\s+/],
            message: 'An unexpected error occurred. Please try again.'
        },
        {
            patterns: [/language model.*not available/i, /prompt api.*not available/i],
            message: 'AI reply drafting is not available. Please enable Chrome AI features or try using Chrome 120+.'
        },
        {
            patterns: [/summarizer.*not available/i, /summarization.*not available/i],
            message: 'AI summarization is not available. Please enable Chrome AI features or try using Chrome 120+.'
        },
        {
            patterns: [/translator.*not available/i, /translation.*not available/i],
            message: 'Translation is not available. Please enable Chrome AI features or try using Chrome 138+.'
        },
        {
            patterns: [/downloading/i, /after.*download/i],
            message: 'AI models are still downloading. This can take several minutes. Please try again shortly.'
        },
        {
            patterns: [/session.*failed/i, /session.*error/i],
            message: 'AI processing session failed. Please try again.'
        },
        {
            patterns: [/invalid.*json/i, /json.*parse/i, /unexpected token/i],
            message: 'AI response was malformed. Please try regenerating.'
        },
        {
            patterns: [/network.*error/i, /connection.*failed/i, /timeout/i],
            message: 'Connection error occurred. Please check your internet connection and try again.'
        },
        {
            patterns: [/permission.*denied/i, /not.*authorized/i],
            message: 'Permission denied. Please ensure Chrome AI features are enabled.'
        },
        {
            patterns: [/not.*implemented/i, /coming soon/i, /placeholder/i],
            message: 'This feature is not yet available. See docs/todo.md for implementation roadmap.'
        }
    ];
    
    // Check for known error patterns
    for (const mapping of errorMappings) {
        if (mapping.patterns.some(pattern => pattern.test(errorMessage))) {
            return mapping.message;
        }
    }
    
    // For unknown errors, provide a generic message but preserve some context if it's safe
    const safeMessage = errorMessage
        .replace(/\s*at\s+.*$/gm, '') // Remove stack traces
        .split('\n')[0] // Take only first line
        .replace(/^(TypeError|Error|ReferenceError|SyntaxError|RangeError):\s*/i, '') // Remove error types
        .trim();
    
    // If the cleaned message is too short or technical, use generic message
    if (safeMessage.length < 10 || /^[A-Z_]+$/i.test(safeMessage)) {
        return 'An unexpected error occurred. Please try again.';
    }
    
    // Return the cleaned message if it seems user-friendly
    return safeMessage.charAt(0).toUpperCase() + safeMessage.slice(1);
}

/**
 * Create a user-friendly error object for API responses
 * 
 * This is a convenience function that creates standardized error responses.
 * For more control, use createErrorResponseForService from response-utils.js.
 * 
 * @param {Error|string} error - Error object or error message string
 * @param {string} context - Additional context about where the error occurred
 * @returns {Object} Error response object with sanitized message
 */
export function createErrorResponse(error, context = '') {
    const message = error instanceof Error ? error.message : String(error);
    const sanitized = sanitizeErrorMessage(message);
    
    return {
        success: false,
        error: context ? `${context}: ${sanitized}` : sanitized
    };
}

/**
 * Handle error and create standardized response for service methods
 * 
 * This is a convenience wrapper that catches errors and creates standardized
 * error responses. For more advanced error handling, use response-utils.js.
 * 
 * Reference: utils/response-utils.js - withErrorHandling for advanced patterns
 * 
 * @param {Error} error - Error object
 * @param {string} context - Context about where the error occurred
 * @param {Function} sendResponse - Optional response callback function
 * @returns {Object} Standardized error response object
 */
export function handleServiceError(error, context = '', sendResponse = null) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitized = sanitizeErrorMessage(message);
    const errorMessage = context ? `${context}: ${sanitized}` : sanitized;
    
    const response = {
        success: false,
        error: errorMessage
    };
    
    // If sendResponse callback provided, call it
    if (sendResponse && typeof sendResponse === 'function') {
        sendResponse(response);
    }
    
    return response;
}


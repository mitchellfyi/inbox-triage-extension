/**
 * Response Utilities
 * Centralized response formatting for consistent API responses across services
 * 
 * This module provides standardized response patterns to eliminate duplication
 * and ensure consistent error handling and success responses.
 * 
 * Reference: AGENTS.md - Code Quality and DRY Principles
 */

import { sanitizeErrorMessage, createErrorResponse } from './error-handler.js';

/**
 * Create a standardized success response
 * 
 * @param {*} data - Response data object
 * @param {Object} options - Additional options
 * @param {boolean} options.usedFallback - Whether cloud fallback was used
 * @param {string} options.warning - Optional warning message
 * @returns {Object} Standardized success response
 */
export function createSuccessResponse(data = {}, options = {}) {
    const response = {
        success: true,
        ...data
    };
    
    if (options.usedFallback !== undefined) {
        response.usedFallback = options.usedFallback;
    }
    
    if (options.warning) {
        response.warning = options.warning;
    }
    
    return response;
}

/**
 * Create a standardized error response
 * 
 * Uses error-handler.js for consistent error sanitization.
 * 
 * Reference: utils/error-handler.js - Error sanitization patterns
 * 
 * @param {Error|string} error - Error object or error message string
 * @param {string} context - Optional context about where the error occurred
 * @returns {Object} Standardized error response
 */
export function createErrorResponseForService(error, context = '') {
    const sanitized = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
    const errorMessage = context ? `${context}: ${sanitized}` : sanitized;
    
    return {
        success: false,
        error: errorMessage
    };
}

/**
 * Create a standardized response with error handling wrapper
 * 
 * Wraps async service functions to provide consistent error handling.
 * Automatically catches errors and returns standardized error responses.
 * 
 * @param {Function} asyncFunction - Async function to wrap
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped function that returns standardized responses
 */
export function withErrorHandling(asyncFunction, context = '') {
    return async (...args) => {
        try {
            return await asyncFunction(...args);
        } catch (error) {
            console.error(`${context} error:`, error);
            return createErrorResponseForService(error, context);
        }
    };
}

/**
 * Validate and format response before sending
 * 
 * Ensures response follows standard format and includes required fields.
 * 
 * @param {Object} response - Response object to validate
 * @returns {Object} Validated and formatted response
 */
export function validateResponse(response) {
    // Ensure success flag exists
    if (typeof response.success !== 'boolean') {
        console.warn('Response missing success flag, defaulting to false');
        return {
            success: false,
            error: 'Invalid response format'
        };
    }
    
    // If error response, ensure error message exists
    if (!response.success && !response.error) {
        console.warn('Error response missing error message');
        response.error = 'An unexpected error occurred';
    }
    
    return response;
}


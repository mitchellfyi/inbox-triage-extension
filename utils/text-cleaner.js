/**
 * Text Cleaning Utilities
 * Provides consistent text cleaning functions used across the extension
 * 
 * Reference: content/content.js - Used for cleaning extracted email content
 */

/**
 * Clean and normalize text content
 * Removes excessive whitespace, normalizes line breaks, and trims content
 * 
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
    if (!text) return '';
    
    return text
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/^\s+|\s+$/g, '') // Trim start and end
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up excessive line breaks
        .replace(/\t+/g, ' ') // Replace tabs with spaces
        .replace(/[\r\f\v]/g, '') // Remove other whitespace chars
        .trim();
}

/**
 * Extract email address from text
 * Finds the first email address pattern in the given text
 * 
 * @param {string} text - Text potentially containing an email address
 * @returns {string} Email address or empty string if not found
 */
export function extractEmailFromText(text) {
    if (!text) return '';
    
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
    const match = text.match(emailRegex);
    return match ? match[1] : '';
}

/**
 * Normalize whitespace in text while preserving structure
 * More conservative than cleanText - preserves intentional line breaks
 * 
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
export function normalizeWhitespace(text) {
    if (!text) return '';
    
    return text
        .replace(/[ \t]+/g, ' ') // Replace multiple spaces/tabs with single space
        .replace(/[ \t]*\n[ \t]*/g, '\n') // Normalize line breaks
        .replace(/^\s+|\s+$/g, '') // Trim
        .trim();
}


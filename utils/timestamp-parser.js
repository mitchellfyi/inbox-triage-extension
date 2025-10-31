/**
 * Timestamp Parsing Utilities
 * Provides timestamp parsing and normalization functions
 * 
 * Reference: content/content.js - Used for parsing email timestamps
 */

/**
 * Parse timestamp string to Date object for sorting
 * Enhanced parsing with support for various timestamp formats from Gmail and Outlook
 * Handles relative times (e.g., "2 hours ago", "Yesterday"), absolute dates, and ISO formats
 * 
 * @param {string} timestampStr - Timestamp string from email
 * @returns {number|null} Timestamp in milliseconds, or null if parsing fails
 */
export function parseTimestamp(timestampStr) {
    if (!timestampStr) return null;
    
    try {
        // Try parsing as ISO date first (most reliable)
        const isoDate = new Date(timestampStr);
        if (!isNaN(isoDate.getTime())) {
            return isoDate.getTime();
        }
        
        // Clean the timestamp string
        const cleaned = timestampStr.trim();
        
        // Try parsing common email date formats
        // Format: "Jan 15, 2024, 3:45 PM" or "15 Jan 2024 15:45"
        const parsed = Date.parse(cleaned);
        if (!isNaN(parsed)) {
            return parsed;
        }
        
        // Handle relative time formats (Gmail/Outlook common)
        // "2 hours ago", "Yesterday", "3 days ago", etc.
        const relativeTime = parseRelativeTime(cleaned);
        if (relativeTime) {
            return relativeTime;
        }
        
        // Try parsing formats with timezone info
        // "Jan 15, 2024 3:45 PM PST" or "2024-01-15T15:45:00Z"
        const withTimezone = new Date(cleaned);
        if (!isNaN(withTimezone.getTime())) {
            return withTimezone.getTime();
        }
        
        // Try extracting date from common patterns
        // Pattern: "MM/DD/YYYY HH:MM" or "DD-MM-YYYY HH:MM"
        const datePattern = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})/;
        const match = cleaned.match(datePattern);
        if (match) {
            const [, month, day, year, hour, minute] = match;
            const fullYear = year.length === 2 ? `20${year}` : year;
            const dateStr = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00`;
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate.getTime();
            }
        }
        
        return null;
    } catch (error) {
        console.warn('Error parsing timestamp:', timestampStr, error);
        return null;
    }
}

/**
 * Parse relative time strings like "2 hours ago", "Yesterday", "3 days ago"
 * 
 * @param {string} relativeStr - Relative time string
 * @returns {number|null} Timestamp in milliseconds, or null if parsing fails
 */
export function parseRelativeTime(relativeStr) {
    const now = Date.now();
    const lowerStr = relativeStr.toLowerCase();
    
    // Handle "just now" or "now"
    if (lowerStr.includes('just now') || lowerStr === 'now') {
        return now;
    }
    
    // Handle "Yesterday"
    if (lowerStr.includes('yesterday')) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.getTime();
    }
    
    // Handle "Today"
    if (lowerStr.includes('today')) {
        return now;
    }
    
    // Handle "X minutes ago", "X hours ago", "X days ago", etc.
    const relativePatterns = [
        { pattern: /(\d+)\s*(minute|min)s?\s*ago/i, unit: 'minute' },
        { pattern: /(\d+)\s*(hour|hr)s?\s*ago/i, unit: 'hour' },
        { pattern: /(\d+)\s*(day|d)s?\s*ago/i, unit: 'day' },
        { pattern: /(\d+)\s*(week|wk)s?\s*ago/i, unit: 'week' },
        { pattern: /(\d+)\s*(month|mo)s?\s*ago/i, unit: 'month' },
        { pattern: /(\d+)\s*(year|yr)s?\s*ago/i, unit: 'year' }
    ];
    
    for (const { pattern, unit } of relativePatterns) {
        const match = relativeStr.match(pattern);
        if (match) {
            const amount = parseInt(match[1], 10);
            const result = new Date(now);
            
            switch (unit) {
                case 'minute':
                    result.setMinutes(result.getMinutes() - amount);
                    break;
                case 'hour':
                    result.setHours(result.getHours() - amount);
                    break;
                case 'day':
                    result.setDate(result.getDate() - amount);
                    break;
                case 'week':
                    result.setDate(result.getDate() - (amount * 7));
                    break;
                case 'month':
                    result.setMonth(result.getMonth() - amount);
                    break;
                case 'year':
                    result.setFullYear(result.getFullYear() - amount);
                    break;
            }
            
            return result.getTime();
        }
    }
    
    return null;
}

/**
 * Normalize timestamp string to a consistent format
 * Preserves original format but ensures it's clean and parseable
 * 
 * @param {string} timestampStr - Raw timestamp string
 * @returns {string|null} Normalized timestamp string or null if invalid
 */
export function normalizeTimestamp(timestampStr) {
    if (!timestampStr) return null;
    
    // Clean whitespace and normalize
    let normalized = timestampStr.trim();
    
    // Remove common prefixes/suffixes that don't add value
    normalized = normalized.replace(/^(Sent|Received|Date):\s*/i, '');
    normalized = normalized.replace(/\s*\([^)]*\)$/g, ''); // Remove trailing parenthetical info
    
    // Normalize common date separators
    normalized = normalized.replace(/\s*-\s*/g, ' '); // Replace dashes with spaces
    
    return normalized.trim() || null;
}


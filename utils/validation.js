/**
 * Validation Utility
 * Centralized draft validation and formatting logic
 * 
 * This module provides consistent validation for AI-generated reply drafts,
 * ensuring they conform to the expected schema and are safe for display.
 * 
 * Reference: SPEC.md - Reply Draft Generation requirements
 */

/**
 * JSON Schema definition for reply drafts
 * Ensures AI responses match expected structure
 * 
 * Reference: SPEC.md - Reply Draft Generation requirements
 * 
 * @returns {Object} JSON schema object for validation
 */
export function getReplyDraftsSchema() {
    return {
        type: "object",
        required: ["drafts"],
        properties: {
            drafts: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                    type: "object",
                    required: ["type", "subject", "body"],
                    properties: {
                        type: {
                            type: "string",
                            minLength: 1,
                            maxLength: 50
                        },
                        subject: {
                            type: "string",
                            minLength: 1,
                            maxLength: 100
                        },
                        body: {
                            type: "string",
                            minLength: 10,
                            maxLength: 1500
                        }
                    },
                    additionalProperties: false
                }
            }
        },
        additionalProperties: false
    };
}

/**
 * Validate reply drafts against JSON schema
 * 
 * Ensures drafts match the expected structure with exactly 3 drafts,
 * each containing type, subject, and body fields within length limits.
 * 
 * @param {Object} drafts - The drafts object to validate
 * @returns {Object} Validation result with isValid flag and errors array
 */
export function validateDraftsSchema(drafts) {
    const schema = getReplyDraftsSchema();
    const errors = [];
    
    try {
        // Basic structure validation
        if (!drafts || typeof drafts !== 'object') {
            errors.push('Response must be a valid JSON object');
            return { isValid: false, errors };
        }
        
        if (!drafts.drafts || !Array.isArray(drafts.drafts)) {
            errors.push('Response must contain a "drafts" array');
            return { isValid: false, errors };
        }
        
        if (drafts.drafts.length !== 3) {
            errors.push(`Must contain exactly 3 drafts, found ${drafts.drafts.length}`);
            return { isValid: false, errors };
        }
        
        // Validate each draft
        drafts.drafts.forEach((draft, index) => {
            if (!draft || typeof draft !== 'object') {
                errors.push(`Draft ${index + 1} must be an object`);
                return;
            }
            
            // Check required fields
            const requiredFields = ['type', 'subject', 'body'];
            requiredFields.forEach(field => {
                if (!draft[field] || typeof draft[field] !== 'string') {
                    errors.push(`Draft ${index + 1} missing or invalid "${field}" field`);
                }
            });
            
            // Check field length constraints
            if (draft.type && draft.type.length > 50) {
                errors.push(`Draft ${index + 1} type too long (max 50 chars)`);
            }
            if (draft.subject && draft.subject.length > 100) {
                errors.push(`Draft ${index + 1} subject too long (max 100 chars)`);
            }
            if (draft.body && draft.body.length > 1500) {
                errors.push(`Draft ${index + 1} body too long (max 1500 chars)`);
            }
            if (draft.body && draft.body.length < 10) {
                errors.push(`Draft ${index + 1} body too short (min 10 chars)`);
            }
        });
        
        return { isValid: errors.length === 0, errors };
        
    } catch (error) {
        errors.push(`Validation error: ${error.message}`);
        return { isValid: false, errors };
    }
}

/**
 * Sanitize and truncate string fields
 * 
 * Removes potentially harmful content (scripts, HTML) and ensures
 * string length is within specified limits.
 * 
 * @param {*} value - The value to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} Sanitized string or null if invalid
 */
export function sanitizeString(value, maxLength) {
    if (typeof value !== 'string') {
        return null;
    }
    
    // Remove any potentially harmful content
    const sanitized = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: URLs
        .trim();
    
    if (sanitized.length === 0) {
        return null;
    }
    
    // Truncate if too long
    return sanitized.length > maxLength 
        ? sanitized.substring(0, maxLength - 3) + '...' 
        : sanitized;
}

/**
 * Validate and format drafts with enhanced error checking
 * 
 * Ensures drafts are properly formatted and sanitized, with fallback
 * values for missing or invalid fields.
 * 
 * Reference: SPEC.md - Reply Draft Generation requirements
 * 
 * @param {Object} drafts - The drafts object to validate and format
 * @param {string} originalSubject - The original email subject for fallback
 * @returns {Array} Array of validated and formatted draft objects
 */
export function validateAndFormatDrafts(drafts, originalSubject) {
    const draftArray = drafts.drafts || drafts || [];
    
    if (!Array.isArray(draftArray)) {
        console.warn('Drafts is not an array, creating empty array');
        return [];
    }
    
    return draftArray.slice(0, 3).map((draft, index) => {
        // Ensure draft is an object
        if (!draft || typeof draft !== 'object') {
            console.warn(`Draft ${index + 1} is not an object, using defaults`);
            draft = {};
        }
        
        // Sanitize and validate each field
        const type = sanitizeString(draft.type, 50) || `Draft ${index + 1}`;
        const subject = sanitizeString(draft.subject, 100) || `Re: ${originalSubject}`;
        const body = sanitizeString(draft.body, 1500) || 'No content generated.';
        
        return {
            type,
            subject,
            body
        };
    });
}


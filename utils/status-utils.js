/**
 * Status Broadcasting Utilities
 * Centralized status update patterns for consistent status communication
 * 
 * This module provides standardized status broadcasting patterns to eliminate
 * duplication across service modules and ensure consistent status updates.
 * 
 * Reference: AGENTS.md - Code Quality and DRY Principles
 * Reference: docs/spec.md - AI Model Availability Handling requirements
 */

/**
 * Create a standardized status broadcaster function
 * 
 * Returns a function that can be used to broadcast status updates consistently
 * across different services. Handles errors gracefully and ensures consistent
 * message format.
 * 
 * Reference: background/service_worker.js - broadcastModelStatus implementation
 * 
 * @param {Function} broadcastFunction - Function to call for broadcasting (e.g., chrome.runtime.sendMessage)
 * @returns {Function} Standardized status broadcaster function
 */
export function createStatusBroadcaster(broadcastFunction) {
    /**
     * Broadcast status update
     * 
     * @param {string} type - Status type (e.g., 'summarizer', 'promptApi', 'error', 'summarizing')
     * @param {Object} capabilities - Capabilities object or status data
     */
    return function broadcastStatus(type, capabilities) {
        try {
            if (typeof broadcastFunction === 'function') {
                broadcastFunction({
                    action: 'modelStatus',
                    type: type,
                    capabilities: capabilities
                }).catch(error => {
                    // Ignore errors if no listeners (side panel might not be open)
                    console.debug('No status listeners:', error.message);
                });
            } else if (broadcastFunction && typeof broadcastFunction.sendMessage === 'function') {
                // Handle chrome.runtime object directly
                broadcastFunction.sendMessage({
                    action: 'modelStatus',
                    type: type,
                    capabilities: capabilities
                }).catch(error => {
                    console.debug('No status listeners:', error.message);
                });
            }
        } catch (error) {
            console.debug('Error broadcasting status:', error);
        }
    };
}

/**
 * Create status update object for AI operations
 * 
 * Standardizes status update format for different stages of AI processing.
 * 
 * @param {string} stage - Processing stage ('generating', 'completed', 'error')
 * @param {Object} metadata - Additional metadata for the status update
 * @returns {Object} Standardized status update object
 */
export function createStatusUpdate(stage, metadata = {}) {
    return {
        stage: stage,
        timestamp: new Date().toISOString(),
        ...metadata
    };
}

/**
 * Status update stages for consistency
 * 
 * Reference: docs/spec.md - AI Model Availability Handling requirements
 */
export const StatusStages = {
    GENERATING: 'generating',
    GENERATING_TLDR: 'generating_tldr',
    GENERATING_KEY_POINTS: 'generating_key_points',
    GENERATING_DRAFTS: 'generating_drafts',
    COMPLETED: 'completed',
    ERROR: 'error',
    DOWNLOADING: 'downloading',
    ANALYZING: 'analyzing'
};

/**
 * Broadcast status for a specific operation
 * 
 * Helper function to broadcast status updates with consistent formatting.
 * 
 * @param {Function} broadcaster - Status broadcaster function
 * @param {string} operation - Operation name (e.g., 'summarizing', 'drafting')
 * @param {string} stage - Processing stage (use StatusStages constants)
 * @param {Object} metadata - Additional metadata
 */
export function broadcastOperationStatus(broadcaster, operation, stage, metadata = {}) {
    if (!broadcaster || typeof broadcaster !== 'function') {
        console.warn('Invalid broadcaster function provided');
        return;
    }
    
    const statusUpdate = createStatusUpdate(stage, metadata);
    broadcaster(operation, statusUpdate);
}


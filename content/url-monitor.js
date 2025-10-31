/**
 * URL Change Monitor Module
 * Handles SPA navigation detection for Gmail and Outlook
 * 
 * Reference: content/content.js - Used for detecting URL changes
 */

/**
 * Setup URL change monitoring for SPA navigation
 * Monitors pushState, replaceState, and popstate events
 * 
 * @param {Function} onUrlChange - Callback when URL changes
 * @returns {Function} Cleanup function to remove listeners
 */
export function setupUrlChangeMonitor(onUrlChange) {
    let lastUrl = window.location.href;
    
    // Listen for popstate events (back/forward navigation)
    const handlePopState = () => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            setTimeout(() => onUrlChange(currentUrl), 100);
        }
    };
    
    window.addEventListener('popstate', handlePopState);
    
    // Override pushState and replaceState to catch SPA navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    const wrappedPushState = function(...args) {
        originalPushState.apply(history, args);
        const newUrl = window.location.href;
        if (newUrl !== lastUrl) {
            lastUrl = newUrl;
            setTimeout(() => onUrlChange(newUrl), 100);
        }
    };
    
    const wrappedReplaceState = function(...args) {
        originalReplaceState.apply(history, args);
        const newUrl = window.location.href;
        if (newUrl !== lastUrl) {
            lastUrl = newUrl;
            setTimeout(() => onUrlChange(newUrl), 100);
        }
    };
    
    history.pushState = wrappedPushState;
    history.replaceState = wrappedReplaceState;
    
    // Return cleanup function
    return () => {
        window.removeEventListener('popstate', handlePopState);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
    };
}


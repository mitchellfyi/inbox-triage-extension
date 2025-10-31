/**
 * Mutation Observer Module
 * Handles DOM mutation observation for dynamic content updates in SPAs
 * 
 * Reference: content/content.js - Used for watching thread changes
 */

/**
 * Create a MutationObserver for email thread changes
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.selectors - Selectors object from site config
 * @param {Function} options.onUpdate - Callback when thread updates are detected
 * @param {Function} options.isPageReady - Function to check if page is ready
 * @returns {MutationObserver} Configured MutationObserver instance
 */
export function createThreadObserver({ selectors, onUpdate, isPageReady }) {
    // Find the thread container to observe
    const findThreadContainer = () => {
        return document.querySelector(selectors.threadContainer) ||
               document.querySelector(selectors.threadView) ||
               document.body; // Fallback to body if no specific container found
    };
    
    let observerTimeout = null;
    
    const observerCallback = (mutations) => {
        let shouldRecheck = false;
        
        mutations.forEach((mutation) => {
            // Check if messages were added or removed
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes);
                const removedNodes = Array.from(mutation.removedNodes);
                
                // Check if any added/removed nodes are message elements
                const hasMessageChanges = addedNodes.some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;
                    return node.matches?.(selectors.messages) || 
                           node.querySelector?.(selectors.messages) ||
                           node.closest?.(selectors.messages);
                }) || removedNodes.some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;
                    return node.matches?.(selectors.messages) || 
                           node.querySelector?.(selectors.messages) ||
                           node.closest?.(selectors.messages);
                });
                
                if (hasMessageChanges) {
                    shouldRecheck = true;
                }
            }
            
            // Check if attributes changed that might affect thread structure
            if (mutation.type === 'attributes') {
                const attributeName = mutation.attributeName;
                // Watch for changes to data attributes that indicate thread updates
                if (attributeName && (
                    attributeName.startsWith('data-') ||
                    attributeName === 'style' ||
                    attributeName === 'class'
                )) {
                    shouldRecheck = true;
                }
            }
        });
        
        // Debounce rechecks to avoid excessive processing
        if (shouldRecheck) {
            clearTimeout(observerTimeout);
            observerTimeout = setTimeout(() => {
                // Re-check if page is still ready before calling update handler
                if (isPageReady && isPageReady()) {
                    onUpdate();
                }
            }, 500); // Wait 500ms for DOM to stabilize
        }
    };
    
    // Create observer with optimized options
    const observerOptions = {
        childList: true, // Watch for added/removed children
        subtree: true, // Watch all descendants
        attributes: true, // Watch for attribute changes
        attributeFilter: ['data-thread-id', 'data-message-id', 'data-convid', 'style', 'class'], // Only watch relevant attributes
        characterData: false // Don't watch text changes (too noisy)
    };
    
    const observer = new MutationObserver(observerCallback);
    
    // Start observing once the container is available
    const startObserving = () => {
        const container = findThreadContainer();
        if (container) {
            observer.observe(container, observerOptions);
            console.log('Inbox Triage: MutationObserver started for dynamic content updates');
        } else {
            // Retry after a short delay if container not found yet
            setTimeout(startObserving, 1000);
        }
    };
    
    // Start observing immediately or after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }
    
    return observer;
}


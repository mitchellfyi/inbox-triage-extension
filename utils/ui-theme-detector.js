/**
 * UI Theme and View Detection Utilities
 * Detects Gmail and Outlook UI themes (dark mode) and view modes (compact view)
 * 
 * Reference: content/content.js - Used for adapting to different UI configurations
 */

/**
 * Detect UI theme and view mode for the current email provider
 * 
 * @param {string} provider - Email provider ('gmail' or 'outlook')
 * @returns {Object} UI configuration object with theme and viewMode
 */
export function detectUITheme(provider) {
    const config = {
        theme: 'light', // 'light' or 'dark'
        viewMode: 'comfortable', // 'comfortable', 'compact', or 'default'
        density: 'normal' // 'normal', 'compact', 'comfortable'
    };
    
    if (provider === 'gmail') {
        config.theme = detectGmailTheme();
        config.viewMode = detectGmailViewMode();
        config.density = detectGmailDensity();
    } else if (provider === 'outlook') {
        config.theme = detectOutlookTheme();
        config.viewMode = detectOutlookViewMode();
        config.density = detectOutlookDensity();
    }
    
    return config;
}

/**
 * Detect Gmail theme (light/dark mode)
 * Checks for dark mode indicators in Gmail's DOM
 * 
 * @returns {string} 'dark' or 'light'
 */
function detectGmailTheme() {
    // Check for dark mode class on body/html
    const body = document.body;
    const html = document.documentElement;
    
    // Gmail uses various indicators for dark mode
    const darkModeIndicators = [
        body.classList.contains('dark-mode'),
        body.classList.contains('dark'),
        html.classList.contains('dark-mode'),
        html.classList.contains('dark'),
        body.getAttribute('data-theme') === 'dark',
        html.getAttribute('data-theme') === 'dark'
    ];
    
    // Check computed styles for dark backgrounds
    const bodyStyle = window.getComputedStyle(body);
    const bgColor = bodyStyle.backgroundColor;
    
    // Dark mode typically has darker background colors
    if (bgColor) {
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
            if (brightness < 100) {
                return 'dark';
            }
        }
    }
    
    // Check for dark mode in localStorage (Gmail stores theme preference)
    try {
        const theme = localStorage.getItem('theme') || localStorage.getItem('gmail-theme');
        if (theme && theme.toLowerCase().includes('dark')) {
            return 'dark';
        }
    } catch (e) {
        // localStorage may be blocked in some contexts
    }
    
    return darkModeIndicators.some(indicator => indicator) ? 'dark' : 'light';
}

/**
 * Detect Gmail view mode (comfortable/compact/default)
 * 
 * @returns {string} 'comfortable', 'compact', or 'default'
 */
function detectGmailViewMode() {
    // Check for density classes
    const body = document.body;
    const density = body.getAttribute('data-density') || body.getAttribute('density');
    
    if (density) {
        if (density.includes('compact')) return 'compact';
        if (density.includes('comfortable')) return 'comfortable';
    }
    
    // Check for compact view indicators
    const compactIndicators = [
        body.classList.contains('compact'),
        body.classList.contains('density-compact'),
        document.querySelector('[data-density="compact"]'),
        document.querySelector('.density-compact')
    ];
    
    const comfortableIndicators = [
        body.classList.contains('comfortable'),
        body.classList.contains('density-comfortable'),
        document.querySelector('[data-density="comfortable"]')
    ];
    
    if (compactIndicators.some(indicator => indicator)) {
        return 'compact';
    }
    
    if (comfortableIndicators.some(indicator => indicator)) {
        return 'comfortable';
    }
    
    // Check localStorage for density preference
    try {
        const densityPref = localStorage.getItem('density') || localStorage.getItem('view-density');
        if (densityPref) {
            if (densityPref.includes('compact')) return 'compact';
            if (densityPref.includes('comfortable')) return 'comfortable';
        }
    } catch (e) {
        // localStorage may be blocked
    }
    
    return 'default';
}

/**
 * Detect Gmail density setting
 * 
 * @returns {string} 'normal', 'compact', or 'comfortable'
 */
function detectGmailDensity() {
    const viewMode = detectGmailViewMode();
    if (viewMode === 'compact') return 'compact';
    if (viewMode === 'comfortable') return 'comfortable';
    return 'normal';
}

/**
 * Detect Outlook theme (light/dark mode)
 * 
 * @returns {string} 'dark' or 'light'
 */
function detectOutlookTheme() {
    const body = document.body;
    const html = document.documentElement;
    
    // Outlook uses Fluent UI with theme attributes
    const darkModeIndicators = [
        body.classList.contains('ms-theme-dark'),
        body.classList.contains('dark'),
        html.classList.contains('ms-theme-dark'),
        html.getAttribute('data-theme') === 'dark',
        body.getAttribute('data-theme') === 'dark',
        document.querySelector('[data-theme="dark"]')
    ];
    
    // Check computed styles
    const bodyStyle = window.getComputedStyle(body);
    const bgColor = bodyStyle.backgroundColor;
    
    if (bgColor) {
        const rgb = bgColor.match(/\d+/g);
        if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
            if (brightness < 100) {
                return 'dark';
            }
        }
    }
    
    // Check for dark mode in common Outlook storage locations
    try {
        const theme = localStorage.getItem('theme') || 
                     localStorage.getItem('outlook-theme') ||
                     localStorage.getItem('ms-theme');
        if (theme && theme.toLowerCase().includes('dark')) {
            return 'dark';
        }
    } catch (e) {
        // localStorage may be blocked
    }
    
    return darkModeIndicators.some(indicator => indicator) ? 'dark' : 'light';
}

/**
 * Detect Outlook view mode
 * 
 * @returns {string} 'comfortable', 'compact', or 'default'
 */
function detectOutlookViewMode() {
    // Outlook typically uses Fluent UI density settings
    const body = document.body;
    
    const density = body.getAttribute('data-density') || 
                   body.getAttribute('density');
    
    if (density) {
        if (density.includes('compact')) return 'compact';
        if (density.includes('comfortable')) return 'comfortable';
    }
    
    // Check for compact classes
    const compactIndicators = [
        body.classList.contains('ms-density-compact'),
        body.classList.contains('compact'),
        document.querySelector('[data-density="compact"]')
    ];
    
    const comfortableIndicators = [
        body.classList.contains('ms-density-comfortable'),
        body.classList.contains('comfortable')
    ];
    
    if (compactIndicators.some(indicator => indicator)) {
        return 'compact';
    }
    
    if (comfortableIndicators.some(indicator => indicator)) {
        return 'comfortable';
    }
    
    return 'default';
}

/**
 * Detect Outlook density setting
 * 
 * @returns {string} 'normal', 'compact', or 'comfortable'
 */
function detectOutlookDensity() {
    const viewMode = detectOutlookViewMode();
    if (viewMode === 'compact') return 'compact';
    if (viewMode === 'comfortable') return 'comfortable';
    return 'normal';
}


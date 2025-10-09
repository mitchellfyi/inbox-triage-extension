# Task 009: Accessibility Excellence

**Priority**: 🟡 HIGH (Inclusive Design & Hackathon Criteria)  
**Estimated Effort**: 3-4 hours  
**Deliverable**: WCAG 2.1 AA compliant extension  
**Status**: [todo]

---

## 📋 Task Description

Enhance accessibility to meet WCAG 2.1 Level AA standards. Add comprehensive keyboard navigation, screen reader support, high contrast mode compatibility, and accessible documentation. Accessibility is often a judging criterion and demonstrates inclusive design thinking.

**Hackathon Value**: Shows thoughtful, professional development. Many submissions overlook accessibility—doing it well is a differentiator.

---

## 🎯 Acceptance Criteria

### Keyboard Navigation
- [ ] All interactive elements accessible via Tab key
- [ ] Logical tab order throughout application
- [ ] Escape key closes modals/panels
- [ ] Enter/Space activates buttons
- [ ] Arrow keys navigate between related items
- [ ] Keyboard shortcuts for common actions (optional)
- [ ] No keyboard traps
- [ ] Visible focus indicators on all elements

### Screen Reader Support
- [ ] All images have appropriate alt text
- [ ] ARIA labels for all interactive elements
- [ ] ARIA live regions for dynamic content
- [ ] Semantic HTML structure (headings, landmarks, lists)
- [ ] Form labels properly associated
- [ ] Status messages announced
- [ ] Error messages announced
- [ ] Loading states announced

### Visual Accessibility
- [ ] Color contrast ratio ≥4.5:1 for normal text
- [ ] Color contrast ratio ≥3:1 for large text
- [ ] Not relying solely on color to convey information
- [ ] High contrast mode compatible
- [ ] Supports browser zoom to 200%
- [ ] Font size respects user preferences
- [ ] Focus indicators visible in all states
- [ ] No flashing content (seizure risk)

### Cognitive Accessibility
- [ ] Clear, simple language
- [ ] Consistent navigation patterns
- [ ] Predictable interactions
- [ ] Error prevention and recovery
- [ ] Progress indicators for long operations
- [ ] Help text available where needed
- [ ] No time limits on interactions

---

## 🔧 Implementation Details

### 1. Keyboard Navigation Enhancement

```javascript
// In sidepanel.js - Add keyboard navigation manager

class KeyboardNavigationManager {
    constructor() {
        this.focusableSelectors = [
            'button:not(:disabled)',
            'a[href]',
            'input:not(:disabled)',
            'select:not(:disabled)',
            'textarea:not(:disabled)',
            '[tabindex]:not([tabindex="-1"])'
        ].join(', ');
        
        this.shortcuts = {
            'e': this.extractThread,
            's': this.generateSummary,
            'd': this.generateDrafts,
            'Escape': this.closeModal
        };
        
        this.init();
    }

    init() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Focus management for modals
        document.addEventListener('focusin', this.handleFocusIn.bind(this));
        
        // Trap focus in modals when open
        this.setupFocusTraps();
    }

    handleKeydown(event) {
        // Check for shortcuts (only when no input focused)
        if (!event.target.matches('input, textarea')) {
            const handler = this.shortcuts[event.key];
            if (handler && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                handler.call(this);
                return;
            }
        }

        // Special key handling
        switch (event.key) {
            case 'Escape':
                this.handleEscape();
                break;
            case 'ArrowDown':
                if (event.target.matches('.draft-card')) {
                    this.navigateToNextDraft(event.target);
                    event.preventDefault();
                }
                break;
            case 'ArrowUp':
                if (event.target.matches('.draft-card')) {
                    this.navigateToPreviousDraft(event.target);
                    event.preventDefault();
                }
                break;
        }
    }

    handleEscape() {
        // Close open modals/panels
        const openModal = document.querySelector('[role="dialog"][aria-hidden="false"]');
        if (openModal) {
            this.closeModal(openModal);
        }
    }

    setupFocusTraps() {
        document.querySelectorAll('[role="dialog"]').forEach(modal => {
            modal.addEventListener('keydown', (event) => {
                if (event.key === 'Tab') {
                    this.trapFocus(event, modal);
                }
            });
        });
    }

    trapFocus(event, container) {
        const focusableElements = container.querySelectorAll(this.focusableSelectors);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
            // Shift + Tab: going backwards
            if (document.activeElement === firstElement) {
                lastElement.focus();
                event.preventDefault();
            }
        } else {
            // Tab: going forwards
            if (document.activeElement === lastElement) {
                firstElement.focus();
                event.preventDefault();
            }
        }
    }

    navigateToNextDraft(currentCard) {
        const allCards = Array.from(document.querySelectorAll('.draft-card'));
        const currentIndex = allCards.indexOf(currentCard);
        const nextCard = allCards[currentIndex + 1];
        if (nextCard) {
            nextCard.focus();
        }
    }

    navigateToPreviousDraft(currentCard) {
        const allCards = Array.from(document.querySelectorAll('.draft-card'));
        const currentIndex = allCards.indexOf(currentCard);
        const prevCard = allCards[currentIndex - 1];
        if (prevCard) {
            prevCard.focus();
        }
    }

    extractThread() {
        document.getElementById('extract-thread-btn')?.click();
    }

    generateSummary() {
        document.getElementById('generate-summary-btn')?.click();
    }

    generateDrafts() {
        document.getElementById('generate-drafts-btn')?.click();
    }

    closeModal(modal) {
        if (modal) {
            modal.setAttribute('aria-hidden', 'true');
            modal.hidden = true;
            // Return focus to trigger element
            const trigger = modal.dataset.triggerElement;
            if (trigger) {
                document.querySelector(trigger)?.focus();
            }
        }
    }
}

// Initialize keyboard navigation
const keyboardNav = new KeyboardNavigationManager();
```

### 2. Screen Reader Support Enhancement

```html
<!-- Update sidepanel.html with comprehensive ARIA labels -->

<!-- Main landmark areas -->
<main role="main" aria-label="Inbox Triage Assistant">
    
    <!-- Status announcement region -->
    <div role="status" aria-live="polite" aria-atomic="true" id="status-announcer" class="sr-only">
        <!-- Status messages announced here -->
    </div>
    
    <!-- Error announcement region -->
    <div role="alert" aria-live="assertive" aria-atomic="true" id="error-announcer" class="sr-only">
        <!-- Error messages announced here -->
    </div>
    
    <!-- Thread extraction section -->
    <section aria-labelledby="extraction-heading">
        <h2 id="extraction-heading">Email Thread Extraction</h2>
        <button id="extract-thread-btn" 
                aria-describedby="extract-help"
                aria-busy="false">
            Extract Current Thread
        </button>
        <p id="extract-help" class="help-text">
            Extracts the current email thread from Gmail or Outlook for analysis.
            Keyboard shortcut: Ctrl+E
        </p>
    </section>
    
    <!-- Summary section with ARIA live region -->
    <section aria-labelledby="summary-heading">
        <h2 id="summary-heading">Summary</h2>
        <div id="summary-content" 
             role="region" 
             aria-live="polite"
             aria-busy="false"
             aria-label="Email summary content">
            <!-- Summary appears here -->
        </div>
    </section>
    
    <!-- Drafts section -->
    <section aria-labelledby="drafts-heading">
        <h2 id="drafts-heading">Reply Drafts</h2>
        
        <div class="tone-selector-group" role="group" aria-labelledby="tone-label">
            <label id="tone-label" for="tone-selector">
                Select Tone
            </label>
            <select id="tone-selector" 
                    aria-describedby="tone-help"
                    aria-label="Choose tone for reply drafts">
                <option value="neutral">Neutral</option>
                <option value="friendly">Friendly</option>
                <option value="assertive">Assertive</option>
                <option value="formal">Formal</option>
            </select>
            <p id="tone-help" class="help-text">
                Changes the writing style of generated drafts
            </p>
        </div>
        
        <!-- Draft cards with proper ARIA -->
        <article class="draft-card" 
                 tabindex="0"
                 role="article"
                 aria-labelledby="draft-short-heading">
            <h3 id="draft-short-heading">Short Answer</h3>
            <div class="draft-content" aria-label="Short answer draft content">
                <!-- Draft content -->
            </div>
            <button class="copy-btn" 
                    aria-label="Copy short answer draft to clipboard">
                Copy
            </button>
        </article>
    </section>
    
    <!-- Loading indicator -->
    <div id="loading-indicator" 
         role="progressbar" 
         aria-valuemin="0" 
         aria-valuemax="100" 
         aria-valuenow="0"
         aria-label="Processing"
         hidden>
        <div class="progress-bar"></div>
        <span class="sr-only">Processing your request, please wait...</span>
    </div>
    
</main>

<!-- Skip navigation link (first focusable element) -->
<a href="#main-content" class="skip-link">
    Skip to main content
</a>
```

### 3. Announce Status Changes

```javascript
// In sidepanel.js - Add announcer helpers

class AccessibilityAnnouncer {
    constructor() {
        this.statusAnnouncer = document.getElementById('status-announcer');
        this.errorAnnouncer = document.getElementById('error-announcer');
    }

    announceStatus(message, priority = 'polite') {
        const announcer = priority === 'assertive' ? this.errorAnnouncer : this.statusAnnouncer;
        announcer.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            announcer.textContent = '';
        }, 1000);
    }

    announceError(message) {
        this.errorAnnouncer.textContent = message;
        setTimeout(() => {
            this.errorAnnouncer.textContent = '';
        }, 3000);
    }

    announceProgress(operation, percent) {
        const message = `${operation} ${percent}% complete`;
        this.announceStatus(message);
        
        // Update progress bar
        const progressBar = document.getElementById('loading-indicator');
        if (progressBar) {
            progressBar.setAttribute('aria-valuenow', percent);
        }
    }
}

const announcer = new AccessibilityAnnouncer();

// Use in operations
async function extractThread() {
    announcer.announceStatus('Extracting email thread');
    
    try {
        // ... extraction logic ...
        announcer.announceStatus('Thread extracted successfully');
    } catch (error) {
        announcer.announceError('Failed to extract thread: ' + error.message);
    }
}

async function generateSummary() {
    const button = document.getElementById('generate-summary-btn');
    button.setAttribute('aria-busy', 'true');
    announcer.announceStatus('Generating summary');
    
    try {
        // ... summary logic ...
        button.setAttribute('aria-busy', 'false');
        announcer.announceStatus('Summary generated');
    } catch (error) {
        button.setAttribute('aria-busy', 'false');
        announcer.announceError('Failed to generate summary: ' + error.message);
    }
}
```

### 4. Visual Accessibility CSS

```css
/* Screen reader only content */
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

/* Skip link */
.skip-link {
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--accent-color);
    color: white;
    padding: 8px;
    text-decoration: none;
    z-index: 100;
}

.skip-link:focus {
    top: 0;
}

/* Enhanced focus indicators */
*:focus {
    outline: 3px solid var(--focus-color, #0066cc);
    outline-offset: 2px;
}

*:focus:not(:focus-visible) {
    outline: none;
}

*:focus-visible {
    outline: 3px solid var(--focus-color, #0066cc);
    outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
    :root {
        --text-primary: #000000;
        --bg-primary: #ffffff;
        --border-color: #000000;
        --accent-color: #0000ff;
    }
    
    button {
        border: 2px solid currentColor;
    }
    
    .draft-card {
        border: 2px solid currentColor;
    }
}

/* Reduced motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
    * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}

/* Ensure text is resizable */
body {
    font-size: 16px; /* Base size */
}

/* Support browser zoom */
@media (min-resolution: 2dppx) {
    /* Adjust for high DPI displays */
}

/* Color contrast improvements */
:root {
    --text-primary: #1a1a1a;
    --text-secondary: #4a4a4a;
    --bg-primary: #ffffff;
    --bg-secondary: #f5f5f5;
    --border-color: #d0d0d0;
    --accent-color: #0066cc;
    --accent-dark: #004499;
    --success-color: #008000;
    --error-color: #cc0000;
    --warning-color: #996600;
}

/* Dark mode with sufficient contrast */
@media (prefers-color-scheme: dark) {
    :root {
        --text-primary: #ffffff;
        --text-secondary: #cccccc;
        --bg-primary: #1a1a1a;
        --bg-secondary: #2a2a2a;
        --border-color: #404040;
        --accent-color: #4d94ff;
        --accent-dark: #3375e6;
    }
}

/* Ensure interactive elements are large enough (44x44px min) */
button, a, input, select {
    min-height: 44px;
    min-width: 44px;
    padding: 8px 16px;
}

/* Visual feedback for interactive states */
button:hover:not(:disabled) {
    background-color: var(--accent-dark);
    transform: translateY(-1px);
}

button:active:not(:disabled) {
    transform: translateY(0);
}

button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
```

### 5. Accessibility Testing Helpers

```javascript
// Add to sidepanel.js - Accessibility testing helper

class AccessibilityChecker {
    constructor() {
        this.issues = [];
    }

    async runChecks() {
        this.issues = [];
        
        this.checkFocusableElements();
        this.checkAltText();
        this.checkARIALabels();
        this.checkColorContrast();
        this.checkHeadingStructure();
        
        console.group('Accessibility Check Results');
        if (this.issues.length === 0) {
            console.log('✅ No accessibility issues found!');
        } else {
            console.warn(`⚠️ Found ${this.issues.length} potential issues:`);
            this.issues.forEach((issue, index) => {
                console.warn(`${index + 1}. ${issue}`);
            });
        }
        console.groupEnd();
        
        return this.issues;
    }

    checkFocusableElements() {
        const buttons = document.querySelectorAll('button:not(:disabled)');
        buttons.forEach(button => {
            if (!button.hasAttribute('aria-label') && !button.textContent.trim()) {
                this.issues.push(`Button without label: ${button.outerHTML.slice(0, 50)}`);
            }
        });
    }

    checkAltText() {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (!img.hasAttribute('alt')) {
                this.issues.push(`Image missing alt text: ${img.src}`);
            }
        });
    }

    checkARIALabels() {
        const interactive = document.querySelectorAll('[role="button"], [role="link"], [role="checkbox"]');
        interactive.forEach(el => {
            if (!el.hasAttribute('aria-label') && !el.hasAttribute('aria-labelledby')) {
                this.issues.push(`Interactive element missing ARIA label: ${el.outerHTML.slice(0, 50)}`);
            }
        });
    }

    checkColorContrast() {
        // Note: Actual contrast calculation would require more complex code
        // This is a simplified check for demonstration
        console.info('Color contrast should be verified with automated tools like axe DevTools');
    }

    checkHeadingStructure() {
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
        const levels = headings.map(h => parseInt(h.tagName[1]));
        
        for (let i = 1; i < levels.length; i++) {
            if (levels[i] - levels[i - 1] > 1) {
                this.issues.push(`Heading level skip: ${headings[i - 1].tagName} to ${headings[i].tagName}`);
            }
        }
    }
}

// Run in development
if (process.env.NODE_ENV === 'development') {
    const a11yChecker = new AccessibilityChecker();
    window.checkAccessibility = () => a11yChecker.runChecks();
}
```

---

## 📝 README Updates

Add accessibility section:

```markdown
## ♿ Accessibility

Inbox Triage is designed to be accessible to all users:

- **✅ WCAG 2.1 Level AA Compliant**
- **⌨️ Full Keyboard Navigation** - No mouse required
- **🔊 Screen Reader Support** - Tested with NVDA, JAWS, VoiceOver
- **🎨 High Contrast Mode** - Compatible with system high contrast settings
- **📏 Resizable Text** - Supports browser zoom up to 200%
- **🎯 Large Click Targets** - All interactive elements meet 44x44px minimum
- **🚫 No Flashing Content** - Safe for users with photosensitive conditions

### Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Extract Thread | `Ctrl+E` | `Cmd+E` |
| Generate Summary | `Ctrl+S` | `Cmd+S` |
| Generate Drafts | `Ctrl+D` | `Cmd+D` |
| Close Modal | `Escape` | `Escape` |
| Navigate Items | `Arrow Keys` | `Arrow Keys` |

Report accessibility issues: [GitHub Issues](GITHUB_URL/issues)
```

---

## 🧪 Testing Requirements

### Manual Testing
- [ ] Navigate entire extension using only keyboard
- [ ] Test with NVDA (Windows)
- [ ] Test with JAWS (Windows)
- [ ] Test with VoiceOver (macOS)
- [ ] Enable high contrast mode in OS
- [ ] Test with browser zoom at 200%
- [ ] Test with reduced motion enabled
- [ ] Test in dark mode
- [ ] Verify focus indicators visible throughout
- [ ] Test with real screen reader users if possible

### Automated Testing
- [ ] Run axe DevTools browser extension
- [ ] Run Lighthouse accessibility audit (score >90)
- [ ] Run WAVE browser extension
- [ ] Check HTML validators
- [ ] Verify ARIA usage with accessibility tree inspector

### Checklist
- [ ] All WCAG 2.1 Level A criteria met
- [ ] All WCAG 2.1 Level AA criteria met
- [ ] No keyboard traps
- [ ] All images have alt text
- [ ] All forms have labels
- [ ] Color contrast ratios pass
- [ ] Content is readable at 200% zoom
- [ ] No content is lost in high contrast mode

---

## 📚 Documentation Updates

Create `docs/accessibility.md`:

```markdown
# Accessibility Statement

Last updated: [Date]

## Our Commitment

Inbox Triage Extension is committed to ensuring digital accessibility for people with disabilities. We continually improve the user experience for everyone and apply relevant accessibility standards.

## Conformance Status

The Web Content Accessibility Guidelines (WCAG) defines requirements for designers and developers to improve accessibility for people with disabilities. It defines three levels of conformance: Level A, Level AA, and Level AAA.

**Inbox Triage Extension is fully conformant with WCAG 2.1 level AA.**

"Fully conformant" means that the content fully conforms to the accessibility standard without any exceptions.

## Technical Specifications

Accessibility of Inbox Triage Extension relies on the following technologies to work:
- HTML5
- CSS3
- JavaScript (ES2020+)
- ARIA (Accessible Rich Internet Applications)
- Chrome Extension APIs

These technologies are relied upon for conformance with the accessibility standards used.

## Feedback

We welcome your feedback on the accessibility of Inbox Triage Extension. Please let us know if you encounter accessibility barriers:
- Email: [email]
- GitHub Issues: [url]

We try to respond to feedback within 5 business days.

## Assessment Approach

[Organization Name] assessed the accessibility of Inbox Triage Extension by the following approaches:
- Self-evaluation
- External evaluation (optional)
- Automated testing tools
- Manual testing with assistive technologies

## Compatibility

Inbox Triage Extension is designed to be compatible with:
- Recent versions of Chrome (138+)
- Screen readers (NVDA, JAWS, VoiceOver)
- Keyboard-only navigation
- High contrast modes
- Browser zoom up to 200%
```

---

## 🎥 Demo Video Inclusion

Include brief segment (10-15 seconds) showing:
- Keyboard navigation through extension
- Screen reader announcing functionality
- Text overlay: "Fully accessible • WCAG 2.1 AA compliant"

---

## 🚀 Success Metrics

- [ ] Lighthouse accessibility score >90
- [ ] axe DevTools shows 0 critical issues
- [ ] All interactive elements keyboard accessible
- [ ] Screen reader can navigate entire extension
- [ ] All color contrast ratios pass WCAG AA
- [ ] No accessibility issues reported by testers
- [ ] Documented in README and separate accessibility statement

---

## 📎 References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Chrome Extension Accessibility](https://developer.chrome.com/docs/extensions/mv3/a11y/)
- [WebAIM Resources](https://webaim.org/resources/)

---

## 🔗 Related Tasks

- Task 007: README updates (add accessibility section)
- Task 006: Demo Video (show keyboard navigation)
- Task 014: System Status Panel (ensure accessible)
- Task 015: Keyboard Shortcuts (implement comprehensive shortcuts)


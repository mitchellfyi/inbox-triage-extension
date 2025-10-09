# Task 003: Rewriter API Integration

**Priority**: 🟡 HIGH (Enhances User Choice)  
**Estimated Effort**: 3-4 hours  
**Chrome API Used**: Rewriter API (Origin Trial)  
**Status**: [todo]

---

## 📋 Task Description

Integrate Chrome's Rewriter API to offer alternative phrasings for generated drafts. This gives users more options without regenerating everything and showcases another Chrome AI API.

**Hackathon Value**: Demonstrates thoughtful UX design and multiple API orchestration. Shows how APIs can work together to enhance user control.

---

## 🎯 Acceptance Criteria

### Functional Requirements
- [ ] Each draft has a "Rephrase" button
- [ ] Clicking "Rephrase" generates 2-3 alternative versions
- [ ] Alternatives maintain the same tone as original
- [ ] User can switch between original and rephrased versions
- [ ] Rewriting happens on-device
- [ ] Graceful fallback when Rewriter API unavailable
- [ ] Loading state during rephrasing

### Technical Requirements
- [ ] Use Chrome's Rewriter API following official documentation
- [ ] Check `Rewriter.availability()` before use
- [ ] Proper session lifecycle management
- [ ] Cache rephrased versions to avoid redundant API calls
- [ ] No external rewriting services

### UI Requirements
- [ ] "Rephrase" button for each draft
- [ ] Expandable panel showing alternative versions
- [ ] Radio buttons or tabs to select version
- [ ] Visual distinction between original and alternatives
- [ ] Keyboard accessible navigation
- [ ] ARIA labels for screen readers

---

## 🔧 Implementation Details

### 1. API Integration Pattern

```javascript
// In service_worker.js - Add RewriterService class

class RewriterService {
    constructor() {
        this.sessions = new Map();
        this.availability = null;
        this.cache = new Map(); // Cache rephrased content
    }

    async initialize() {
        if ('Rewriter' in self) {
            this.availability = await Rewriter.availability();
            console.log('Rewriter API availability:', this.availability);
            return this.availability === 'readily';
        }
        return false;
    }

    async rewrite(text, tone = 'neutral', numVariations = 2) {
        // Check cache first
        const cacheKey = `${text.substring(0, 50)}-${tone}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (this.availability !== 'readily') {
            await this.initialize();
        }

        const sessionKey = tone;
        if (!this.sessions.has(sessionKey)) {
            const session = await Rewriter.create({
                tone: tone,
                format: 'as-is',
                length: 'as-is'
            });
            this.sessions.set(sessionKey, session);
        }

        const session = this.sessions.get(sessionKey);
        const variations = [];

        // Generate multiple variations
        for (let i = 0; i < numVariations; i++) {
            const rewritten = await session.rewrite(text);
            if (rewritten && rewritten !== text) {
                variations.push(rewritten);
            }
        }

        // Cache results
        this.cache.set(cacheKey, variations);
        
        return variations;
    }

    clearCache() {
        this.cache.clear();
    }

    cleanup() {
        for (const session of this.sessions.values()) {
            session.destroy();
        }
        this.sessions.clear();
        this.clearCache();
    }
}

// Initialize in service worker
const rewriterService = new RewriterService();
```

### 2. Side Panel UI Updates

Add to `sidepanel/sidepanel.html`:

```html
<!-- Enhanced Draft Card with Rephrase Feature -->
<div class="draft-card" data-draft-type="short">
    <div class="draft-header">
        <h3>Short Answer</h3>
        <div class="draft-badges">
            <span class="badge proofread-badge" hidden>✓ Proofread</span>
        </div>
        <div class="draft-actions">
            <button class="rephrase-btn secondary-btn" 
                    data-draft-type="short"
                    aria-label="Rephrase this draft"
                    aria-expanded="false"
                    aria-controls="rephrase-panel-short">
                ↻ Rephrase
            </button>
            <button class="copy-btn" data-draft-type="short">Copy</button>
        </div>
    </div>
    
    <div class="draft-content-wrapper">
        <div class="draft-content" data-version="original">
            <!-- Draft content here -->
        </div>
        
        <!-- Rephrase Panel (initially hidden) -->
        <div id="rephrase-panel-short" class="rephrase-panel" hidden>
            <div class="rephrase-header">
                <h4>Alternative Versions</h4>
                <button class="close-rephrase-btn" 
                        aria-label="Close alternatives">×</button>
            </div>
            
            <div class="version-selector">
                <label class="version-option">
                    <input type="radio" 
                           name="version-short" 
                           value="original" 
                           checked>
                    <span>Original</span>
                </label>
                <label class="version-option">
                    <input type="radio" 
                           name="version-short" 
                           value="variation-1">
                    <span>Alternative 1</span>
                </label>
                <label class="version-option">
                    <input type="radio" 
                           name="version-short" 
                           value="variation-2">
                    <span>Alternative 2</span>
                </label>
            </div>
            
            <div class="version-preview">
                <!-- Previews for each version -->
            </div>
        </div>
    </div>
</div>
```

### 3. Rephrase Logic in sidepanel.js

```javascript
// Store rephrased variations
const rephrasedContent = {
    short: { original: null, variations: [] },
    medium: { original: null, variations: [] },
    detailed: { original: null, variations: [] }
};

// Handle rephrase button click
document.querySelectorAll('.rephrase-btn').forEach(button => {
    button.addEventListener('click', async (e) => {
        const draftType = e.target.dataset.draftType;
        await generateRephrasedVersions(draftType);
    });
});

async function generateRephrasedVersions(draftType) {
    const button = document.querySelector(`.rephrase-btn[data-draft-type="${draftType}"]`);
    const panel = document.getElementById(`rephrase-panel-${draftType}`);
    const draftContent = document.querySelector(`[data-draft-type="${draftType}"] .draft-content`);
    
    // Show loading state
    button.disabled = true;
    button.textContent = '⏳ Rephrasing...';
    
    try {
        // Get current draft text
        const originalText = draftContent.textContent.trim();
        
        // Store original if not already stored
        if (!rephrasedContent[draftType].original) {
            rephrasedContent[draftType].original = originalText;
        }
        
        // Check if we already have variations
        if (rephrasedContent[draftType].variations.length > 0) {
            showRephrasePanel(draftType);
            return;
        }
        
        // Request rephrased versions from service worker
        const response = await chrome.runtime.sendMessage({
            type: 'REPHRASE_TEXT',
            text: originalText,
            tone: currentTone,
            numVariations: 2
        });
        
        if (response.success && response.variations.length > 0) {
            rephrasedContent[draftType].variations = response.variations;
            showRephrasePanel(draftType);
            populateVersionSelector(draftType);
        } else {
            showWarning('Could not generate alternatives: ' + (response.error || 'No variations available'));
        }
    } catch (error) {
        showError('Rephrasing failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = '↻ Rephrase';
    }
}

function showRephrasePanel(draftType) {
    const panel = document.getElementById(`rephrase-panel-${draftType}`);
    const button = document.querySelector(`.rephrase-btn[data-draft-type="${draftType}"]`);
    
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    
    // Scroll panel into view
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function populateVersionSelector(draftType) {
    const panel = document.getElementById(`rephrase-panel-${draftType}`);
    const preview = panel.querySelector('.version-preview');
    const original = rephrasedContent[draftType].original;
    const variations = rephrasedContent[draftType].variations;
    
    preview.innerHTML = '';
    
    // Add original version
    const originalDiv = document.createElement('div');
    originalDiv.className = 'version-content';
    originalDiv.dataset.version = 'original';
    originalDiv.textContent = original;
    preview.appendChild(originalDiv);
    
    // Add variations
    variations.forEach((variation, index) => {
        const variationDiv = document.createElement('div');
        variationDiv.className = 'version-content';
        variationDiv.dataset.version = `variation-${index + 1}`;
        variationDiv.textContent = variation;
        variationDiv.hidden = true;
        preview.appendChild(variationDiv);
    });
}

// Handle version selection
document.addEventListener('change', (e) => {
    if (e.target.matches('input[name^="version-"]')) {
        const draftType = e.target.name.replace('version-', '');
        const selectedVersion = e.target.value;
        updateDraftContent(draftType, selectedVersion);
    }
});

function updateDraftContent(draftType, version) {
    const draftContent = document.querySelector(`[data-draft-type="${draftType}"] .draft-content`);
    const preview = document.querySelector(`#rephrase-panel-${draftType} .version-preview`);
    
    // Hide all version previews
    preview.querySelectorAll('.version-content').forEach(el => el.hidden = true);
    
    // Show selected version
    const selectedContent = preview.querySelector(`[data-version="${version}"]`);
    if (selectedContent) {
        selectedContent.hidden = false;
        draftContent.textContent = selectedContent.textContent;
        draftContent.dataset.currentVersion = version;
    }
}

// Handle close button
document.querySelectorAll('.close-rephrase-btn').forEach(button => {
    button.addEventListener('click', (e) => {
        const panel = e.target.closest('.rephrase-panel');
        const draftType = panel.id.replace('rephrase-panel-', '');
        const rephraseBtn = document.querySelector(`.rephrase-btn[data-draft-type="${draftType}"]`);
        
        panel.hidden = true;
        rephraseBtn.setAttribute('aria-expanded', 'false');
    });
});

// Clear rephrased content when tone changes
document.getElementById('tone-selector').addEventListener('change', () => {
    // Reset all rephrased content
    Object.keys(rephrasedContent).forEach(key => {
        rephrasedContent[key] = { original: null, variations: [] };
    });
    
    // Hide all rephrase panels
    document.querySelectorAll('.rephrase-panel').forEach(panel => {
        panel.hidden = true;
    });
});
```

### 4. Message Handler in service_worker.js

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REPHRASE_TEXT') {
        handleRephrasing(message, sendResponse);
        return true;
    }
    // ... existing handlers
});

async function handleRephrasing(message, sendResponse) {
    try {
        const { text, tone, numVariations } = message;
        
        // Check if rewriter service is available
        const isAvailable = await rewriterService.initialize();
        if (!isAvailable) {
            sendResponse({
                success: false,
                error: 'Rewriter API not available'
            });
            return;
        }
        
        // Generate variations
        const variations = await rewriterService.rewrite(
            text,
            tone || 'neutral',
            numVariations || 2
        );
        
        sendResponse({
            success: true,
            variations: variations,
            count: variations.length
        });
    } catch (error) {
        console.error('Rephrasing error:', error);
        sendResponse({
            success: false,
            error: error.message,
            variations: []
        });
    }
}
```

### 5. CSS Styling

```css
/* Rephrase Panel */
.rephrase-panel {
    margin-top: 16px;
    padding: 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.rephrase-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.rephrase-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
}

.close-rephrase-btn {
    padding: 4px 8px;
    background: transparent;
    border: none;
    font-size: 20px;
    color: var(--text-secondary);
    cursor: pointer;
    line-height: 1;
}

.close-rephrase-btn:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
    border-radius: 4px;
}

.version-selector {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
}

.version-option {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 2px solid var(--border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
}

.version-option:hover {
    border-color: var(--accent-color);
    background: var(--bg-hover);
}

.version-option:has(input:checked) {
    border-color: var(--accent-color);
    background: var(--accent-light);
}

.version-option input[type="radio"] {
    margin: 0;
    cursor: pointer;
}

.version-preview {
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    min-height: 100px;
}

.version-content {
    line-height: 1.6;
    color: var(--text-primary);
}

.rephrase-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
}

.rephrase-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}
```

---

## 📝 README Updates

### Update Value Proposition

```markdown
## Value Proposition

- **Save Time**: Get instant TL;DR summaries and key points from lengthy email threads
- **Stay Responsive**: Generate professional reply drafts with multiple alternatives
- **🆕 More Choices**: Rephrase any draft to get 2-3 alternative versions instantly
- **Grammar Perfect**: All drafts automatically proofread for grammar and spelling
- **Multilingual Support**: Translate summaries and drafts to 10+ languages
```

### Update Chrome AI APIs Section

```markdown
## 🤖 Chrome Built-in AI APIs Used

- **✅ Summarizer API** - Email thread condensation
- **✅ Prompt API** - Structured draft generation
- **✅ Translator API** - Multilingual translation
- **✅ Proofreader API** - Grammar correction
- **✅ Rewriter API** - Alternative draft phrasings
- **🔜 Writer API** - Coming soon
```

---

## 🧪 Testing Requirements

### Automated Tests

Create tests in `tests/rewriter.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { extensionTest } from './fixtures/extension';

extensionTest('Rewriter API integration', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    
    // Set up mock draft
    await page.evaluate(() => {
        const draftContent = document.querySelector('[data-draft-type="short"] .draft-content');
        draftContent.textContent = 'Thank you for your email. I will review this.';
    });
    
    // Click rephrase button
    await page.click('.rephrase-btn[data-draft-type="short"]');
    
    // Wait for rephrase panel
    await page.waitForSelector('#rephrase-panel-short:not([hidden])');
    
    // Verify alternatives are shown
    const panel = page.locator('#rephrase-panel-short');
    await expect(panel).toBeVisible();
    
    // Check for version options
    const versionOptions = panel.locator('.version-option');
    const count = await versionOptions.count();
    expect(count).toBeGreaterThanOrEqual(2); // Original + at least 1 variation
});

extensionTest('Version selection updates draft', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    
    // Mock rephrased content
    await page.evaluate(() => {
        window.rephrasedContent = {
            short: {
                original: 'Original text here',
                variations: ['Variation 1 here', 'Variation 2 here']
            }
        };
    });
    
    // Open rephrase panel
    await page.click('.rephrase-btn[data-draft-type="short"]');
    
    // Select variation
    await page.click('input[value="variation-1"]');
    
    // Verify draft content updated
    const draftContent = page.locator('[data-draft-type="short"] .draft-content');
    await expect(draftContent).toContainText('Variation 1');
});
```

### Manual Testing Checklist

- [ ] Test rephrasing for all three draft types
- [ ] Verify 2-3 variations are generated
- [ ] Test switching between original and variations
- [ ] Test with Rewriter API unavailable
- [ ] Verify variations maintain tone consistency
- [ ] Test with very short text (<10 words)
- [ ] Test with very long text (>500 words)
- [ ] Verify rephrase panel keyboard navigation
- [ ] Test closing and reopening rephrase panel
- [ ] Verify cache works (second rephrase is instant)
- [ ] Test clearing cache when tone changes
- [ ] Test screen reader accessibility

---

## 📚 Documentation Updates

### SPEC.md Addition

```markdown
### Draft Rephrasing
**Given** reply drafts have been generated  
**When** the user clicks "Rephrase" on any draft  
**Then** the Rewriter API should generate 2-3 alternative versions  
**And** alternatives should maintain the same tone as original  
**And** user can select any version via radio buttons  
**And** selected version replaces the draft content  
**And** user can return to original version at any time  
**And** rephrasing should happen on-device
```

---

## 🎥 Demo Video Inclusion

**For hackathon demo video (timestamp ~1:55-2:05):**

1. Show generated draft
2. Click "Rephrase" button
3. Show 2-3 alternatives appearing
4. Select different version with radio button
5. Show draft updating in real-time

**Voiceover script:**
> "Not satisfied with a draft? The Rewriter API instantly generates alternatives while maintaining your chosen tone. Pick the version that feels right—all without leaving the extension."

---

## 🚀 Success Metrics

- [ ] API correctly integrated
- [ ] 2-3 variations generated per rephrase request
- [ ] Rephrasing completes in <3 seconds
- [ ] Version switching is instant
- [ ] Feature highlighted in demo video
- [ ] Tests passing
- [ ] Keyboard accessible

---

## 📎 References

- [Chrome Rewriter API Documentation](https://developer.chrome.com/docs/ai/rewriter-api)
- [UX Patterns for AI-Generated Content](https://pair.withgoogle.com/guidebook/)

---

## 🔗 Related Tasks

- Task 002: Proofreader API Integration (combine with rephrasing)
- Task 004: Writer API Integration (similar patterns)
- Task 012: Demo Video Creation


# Task 001: Translator API Integration

**Priority**: 🔴 CRITICAL (High-Impact for Hackathon)  
**Estimated Effort**: 4-6 hours  
**Chrome API Used**: Translator API (Stable, Chrome 138+)  
**Status**: [done] ✅ COMPLETE

---

## 📋 Task Description

Integrate Chrome's built-in Translator API to add multilingual support for email summaries and generated drafts. This demonstrates broader API usage and provides real value for international users.

**Hackathon Value**: This API is explicitly highlighted in the Chrome Built-in AI Challenge 2025 guidelines and will showcase your ability to integrate multiple APIs.

---

## 🎯 Acceptance Criteria

### Functional Requirements
- [ ] User can select target language from dropdown in side panel settings
- [ ] Email summaries can be translated to selected language
- [ ] Generated drafts can be translated before copying
- [ ] Translation works offline after initial model download
- [ ] Clear indicators show when content is translated vs. original
- [ ] Graceful fallback when translation unavailable
- [ ] Language selection persists across sessions

### Technical Requirements
- [ ] Use Chrome's Translator API following official documentation
- [ ] Check `Translator.availability()` before use
- [ ] Proper session lifecycle management (create/destroy)
- [ ] No external translation services used
- [ ] Works in on-device-only mode

### UI Requirements
- [ ] Language selector dropdown in side panel settings
- [ ] "Translate" button for summary section
- [ ] "Translate Draft" button for each reply draft
- [ ] Visual indicator showing original language → target language
- [ ] Keyboard accessible language selection
- [ ] ARIA labels for screen readers

---

## 🔧 Implementation Details

### 1. API Integration Pattern

```javascript
// In service_worker.js - Add new TranslationService class

class TranslationService {
    constructor() {
        this.sessions = new Map();
        this.availability = null;
    }

    async initialize() {
        if ('Translator' in self) {
            this.availability = await Translator.availability();
            console.log('Translator API availability:', this.availability);
            return this.availability === 'readily';
        }
        return false;
    }

    async translate(text, sourceLanguage, targetLanguage) {
        if (this.availability !== 'readily') {
            throw new Error('Translator API not available');
        }

        const sessionKey = `${sourceLanguage}-${targetLanguage}`;
        
        if (!this.sessions.has(sessionKey)) {
            const session = await Translator.create({
                sourceLanguage,
                targetLanguage
            });
            this.sessions.set(sessionKey, session);
        }

        const session = this.sessions.get(sessionKey);
        return await session.translate(text);
    }

    cleanup() {
        for (const session of this.sessions.values()) {
            session.destroy();
        }
        this.sessions.clear();
    }
}

// Initialize in service worker
const translationService = new TranslationService();
```

### 2. Side Panel UI Updates

Add to `sidepanel/sidepanel.html`:

```html
<!-- Language Settings Section (after Processing Settings) -->
<section class="language-settings">
    <h2>Language Settings</h2>
    <div class="setting-group">
        <label for="target-language">
            <span class="label-text">Translation Language</span>
            <select id="target-language" aria-label="Select translation language">
                <option value="none">No Translation (Original)</option>
                <option value="en">English</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
                <option value="de">German (Deutsch)</option>
                <option value="zh">Chinese (中文)</option>
                <option value="ja">Japanese (日本語)</option>
                <option value="ko">Korean (한국어)</option>
                <option value="pt">Portuguese (Português)</option>
                <option value="ru">Russian (Русский)</option>
                <option value="ar">Arabic (العربية)</option>
                <option value="hi">Hindi (हिन्दी)</option>
            </select>
        </label>
        <p class="setting-description">
            Translate summaries and drafts to your preferred language.
            Translation happens on-device for privacy.
        </p>
    </div>
</section>

<!-- Update Summary Section with Translation Controls -->
<section id="summary-section">
    <div class="section-header">
        <h2>Summary</h2>
        <div class="translation-controls">
            <button id="translate-summary-btn" class="secondary-btn" aria-label="Translate summary">
                <span class="icon">🌐</span> Translate
            </button>
            <span id="translation-indicator" class="translation-indicator" hidden>
                EN → ES
            </span>
        </div>
    </div>
    <div id="summary-content"></div>
</section>

<!-- Update Draft Cards with Translation Button -->
<div class="draft-card">
    <div class="draft-header">
        <h3>Short Answer</h3>
        <div class="draft-actions">
            <button class="translate-draft-btn secondary-btn" aria-label="Translate this draft">
                🌐
            </button>
            <button class="copy-btn" aria-label="Copy short answer draft">
                Copy
            </button>
        </div>
    </div>
    <div class="draft-content"></div>
</div>
```

### 3. Translation Logic in sidepanel.js

```javascript
// Add translation state management
let currentLanguage = 'none';
let translatedContent = {
    summary: null,
    drafts: {}
};

// Load language preference
chrome.storage.local.get(['translationLanguage'], (result) => {
    currentLanguage = result.translationLanguage || 'none';
    document.getElementById('target-language').value = currentLanguage;
});

// Handle language selection change
document.getElementById('target-language').addEventListener('change', async (e) => {
    currentLanguage = e.target.value;
    await chrome.storage.local.set({ translationLanguage: currentLanguage });
    
    // Auto-translate if content already exists
    if (currentLanguage !== 'none') {
        if (document.getElementById('summary-content').textContent) {
            await translateSummary();
        }
        if (Object.keys(drafts).length > 0) {
            await translateAllDrafts();
        }
    }
});

// Translate summary
async function translateSummary() {
    if (currentLanguage === 'none') return;
    
    const summaryElement = document.getElementById('summary-content');
    const originalText = summaryElement.dataset.originalText || summaryElement.textContent;
    
    // Store original if not stored
    if (!summaryElement.dataset.originalText) {
        summaryElement.dataset.originalText = originalText;
    }
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'TRANSLATE_TEXT',
            text: originalText,
            sourceLanguage: 'en',
            targetLanguage: currentLanguage
        });
        
        if (response.success) {
            summaryElement.textContent = response.translatedText;
            showTranslationIndicator('summary', 'en', currentLanguage);
        } else {
            showError('Translation failed: ' + response.error);
        }
    } catch (error) {
        showError('Translation error: ' + error.message);
    }
}

// Translate individual draft
async function translateDraft(draftType) {
    if (currentLanguage === 'none') return;
    
    const draftCard = document.querySelector(`[data-draft-type="${draftType}"]`);
    const contentElement = draftCard.querySelector('.draft-content');
    const originalText = contentElement.dataset.originalText || contentElement.textContent;
    
    if (!contentElement.dataset.originalText) {
        contentElement.dataset.originalText = originalText;
    }
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'TRANSLATE_TEXT',
            text: originalText,
            sourceLanguage: 'en',
            targetLanguage: currentLanguage
        });
        
        if (response.success) {
            contentElement.textContent = response.translatedText;
            translatedContent.drafts[draftType] = response.translatedText;
            showTranslationIndicator(draftType, 'en', currentLanguage);
        }
    } catch (error) {
        showError(`Translation error for ${draftType}: ${error.message}`);
    }
}

// Show translation indicator
function showTranslationIndicator(elementId, sourceLang, targetLang) {
    const indicator = document.getElementById(`${elementId}-translation-indicator`);
    if (indicator) {
        indicator.textContent = `${sourceLang.toUpperCase()} → ${targetLang.toUpperCase()}`;
        indicator.hidden = false;
    }
}
```

### 4. Message Handler in service_worker.js

```javascript
// Add translation message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TRANSLATE_TEXT') {
        handleTranslation(message, sendResponse);
        return true; // Keep channel open for async response
    }
    // ... existing handlers
});

async function handleTranslation(message, sendResponse) {
    try {
        const { text, sourceLanguage, targetLanguage } = message;
        
        // Check if translation service is available
        const isAvailable = await translationService.initialize();
        if (!isAvailable) {
            sendResponse({
                success: false,
                error: 'Translator API not available'
            });
            return;
        }
        
        // Perform translation
        const translatedText = await translationService.translate(
            text,
            sourceLanguage,
            targetLanguage
        );
        
        sendResponse({
            success: true,
            translatedText
        });
    } catch (error) {
        console.error('Translation error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}
```

### 5. CSS Styling

Add to `sidepanel/sidepanel.html` `<style>` section:

```css
/* Language Settings Section */
.language-settings {
    margin: 20px 0;
    padding: 15px;
    background: var(--bg-secondary);
    border-radius: 8px;
}

.translation-controls {
    display: flex;
    align-items: center;
    gap: 10px;
}

.translate-draft-btn {
    padding: 4px 8px;
    font-size: 14px;
    background: transparent;
    border: 1px solid var(--border-color);
}

.translate-draft-btn:hover {
    background: var(--bg-hover);
}

.translation-indicator {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 12px;
    background: var(--accent-light);
    color: var(--accent-dark);
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
}

.secondary-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
}

.secondary-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent-color);
}
```

---

## 📝 README Updates

### Update Feature List

In `README.md`, update the "Value Proposition" section:

```markdown
## Value Proposition

- **Save Time**: Get instant TL;DR summaries and key points from lengthy email threads
- **Understand Attachments**: Automatically analyze PDFs, documents, spreadsheets, and images locally
- **Stay Responsive**: Generate professional reply drafts in multiple tones and lengths with custom guidance
- **Voice Input**: Use voice dictation to quickly add guidance for your reply drafts
- **🆕 Multilingual Support**: Translate summaries and drafts to 10+ languages on-device
- **Protect Privacy**: All processing happens locally—no data or files leave your device, including translations
- **Work Offline**: Fully functional once AI models are downloaded
```

### Add Chrome AI APIs Section

Add new section after "Value Proposition":

```markdown
## 🤖 Chrome Built-in AI APIs Used

This extension showcases multiple Chrome AI APIs working together:

- **✅ Summarizer API** - Email thread condensation and key points extraction
- **✅ Prompt API** - Structured draft generation with JSON schema
- **✅ Translator API** - On-device multilingual translation (10+ languages)
- **🔜 More Coming Soon** - Proofreader, Rewriter, Writer APIs

All processing happens locally on your device for complete privacy.
```

### Update Quick Start

Add language setup step:

```markdown
### First Use

1. **Go to Gmail** (`mail.google.com`) **or Outlook** (`outlook.live.com`)
2. **Open any email thread**
3. **Click extension icon** in toolbar
4. **🆕 (Optional) Select your preferred translation language**
5. **Click "Extract Current Thread"**
6. **Watch the magic happen!** ✨
```

---

## 🧪 Testing Requirements

### Automated Tests

Create `tests/translator.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { extensionTest } from './fixtures/extension';

extensionTest('Translator API integration', async ({ page, context, extensionId }) => {
    // Navigate to side panel
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    
    // Check language selector exists
    const languageSelector = page.locator('#target-language');
    await expect(languageSelector).toBeVisible();
    
    // Verify default languages available
    const options = await languageSelector.locator('option').allTextContents();
    expect(options).toContain('Spanish (Español)');
    expect(options).toContain('French (Français)');
    
    // Select Spanish
    await languageSelector.selectOption('es');
    
    // Verify selection persists
    const storage = await page.evaluate(() => {
        return chrome.storage.local.get(['translationLanguage']);
    });
    expect(storage.translationLanguage).toBe('es');
});

extensionTest('Summary translation', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    
    // Set up test summary
    await page.evaluate(() => {
        const summaryContent = document.getElementById('summary-content');
        summaryContent.textContent = 'This is a test summary.';
        summaryContent.dataset.originalText = 'This is a test summary.';
    });
    
    // Select Spanish translation
    await page.selectOption('#target-language', 'es');
    
    // Click translate button
    await page.click('#translate-summary-btn');
    
    // Wait for translation
    await page.waitForTimeout(1000);
    
    // Verify translation indicator appears
    const indicator = page.locator('#translation-indicator');
    await expect(indicator).toBeVisible();
    await expect(indicator).toContainText('EN → ES');
});
```

### Manual Testing Checklist

- [ ] Test all 10+ supported languages
- [ ] Verify translation quality for different content types
- [ ] Test with very long summaries (>1000 words)
- [ ] Test with very short summaries (<10 words)
- [ ] Verify language selection persists after browser restart
- [ ] Test translation with AI models unavailable
- [ ] Test translation indicator displays correctly
- [ ] Verify keyboard navigation for language selector
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Verify translation works offline after initial setup
- [ ] Test "translate all drafts" functionality
- [ ] Verify original text restoration when selecting "No Translation"

---

## 📚 Documentation Updates

### Files to Update

1. **SPEC.md** - Add Translator API to functional requirements
2. **TODO.md** - Mark this task as complete when done
3. **docs/chrome-ai-api-compliance.md** - Add Translator API compliance section
4. **AGENTS.md** - Add translation patterns to coding examples

### SPEC.md Updates

Add new section:

```markdown
### Multilingual Translation
**Given** a user has extracted and summarized an email thread  
**When** they select a target language from the dropdown  
**Then** the Translator API should translate the summary to the selected language  
**And** all generated drafts should be translatable  
**And** translation indicators should show source → target language  
**And** the user can return to original language at any time  
**And** language preference should persist across browser sessions
```

---

## 🎥 Demo Video Inclusion

**For hackathon demo video (timestamp ~1:30-1:45):**

1. Show language selector with 10+ languages
2. Translate summary from English to Spanish
3. Show translation indicator appearing
4. Translate a draft to French
5. Emphasize "All translations happen on-device"
6. Show offline functionality

**Voiceover script:**
> "The extension supports 10+ languages using Chrome's Translator API. Watch as we instantly translate this email summary to Spanish—all processing happens locally on your device, so your data stays private even when translating sensitive business communications."

---

## 🚀 Success Metrics

- [ ] API correctly integrated following Chrome documentation
- [ ] 10+ languages supported
- [ ] Translation happens in <2 seconds for typical summaries
- [ ] No external API calls for translation
- [ ] Feature highlighted in demo video
- [ ] README updated with translation capabilities
- [ ] Tests passing for core translation workflows
- [ ] Accessibility requirements met (keyboard + screen reader)

---

## 📎 References

- [Chrome Translator API Documentation](https://developer.chrome.com/docs/ai/translator-api)
- [Language Code Reference (BCP 47)](https://www.w3.org/International/questions/qa-choosing-language-tags)
- [Chrome Built-in AI Challenge Guidelines](https://googlechromeai2025.devpost.com/)

---

## 🔗 Related Tasks

- Task 002: Proofreader API Integration (can share UI patterns)
- Task 003: Rewriter API Integration (similar translation workflow)
- Task 012: Demo Video Creation (feature this prominently)
- Task 013: README API Showcase (document API usage)


# Task 002: Proofreader API Integration

**Priority**: 🟡 HIGH (Quick Win for Hackathon)  
**Estimated Effort**: 2-3 hours  
**Chrome API Used**: Proofreader API (Origin Trial)  
**Status**: [todo]

---

## 📋 Task Description

Integrate Chrome's Proofreader API to automatically correct grammar mistakes in generated reply drafts and user guidance text. This adds polish and demonstrates another AI API capability.

**Hackathon Value**: Shows attention to quality and demonstrates multiple API integration. Easy to implement with high visual impact.

---

## 🎯 Acceptance Criteria

### Functional Requirements
- [ ] All generated drafts are automatically proofread before display
- [ ] User can manually proofread their guidance text
- [ ] Proofreading happens on-device
- [ ] Visual indicator shows when content has been proofread
- [ ] Graceful fallback when Proofreader API unavailable
- [ ] Option to view original (unproofread) text

### Technical Requirements
- [ ] Use Chrome's Proofreader API following official documentation
- [ ] Check `Proofreader.availability()` before use
- [ ] Proper session lifecycle management
- [ ] No external grammar checking services
- [ ] Works in on-device-only mode

### UI Requirements
- [ ] "Proofread" button for guidance textarea
- [ ] Checkmark indicator when draft is proofread
- [ ] Tooltip showing corrections made (optional)
- [ ] Keyboard accessible
- [ ] ARIA labels for accessibility

---

## 🔧 Implementation Details

### 1. API Integration Pattern

```javascript
// In service_worker.js - Add ProofreaderService class

class ProofreaderService {
    constructor() {
        this.session = null;
        this.availability = null;
    }

    async initialize() {
        if ('Proofreader' in self) {
            this.availability = await Proofreader.availability();
            console.log('Proofreader API availability:', this.availability);
            
            if (this.availability === 'readily' && !this.session) {
                this.session = await Proofreader.create();
            }
            
            return this.availability === 'readily';
        }
        return false;
    }

    async proofread(text) {
        if (!this.session) {
            const isAvailable = await this.initialize();
            if (!isAvailable) {
                throw new Error('Proofreader API not available');
            }
        }

        const result = await this.session.proofread(text);
        return result;
    }

    cleanup() {
        if (this.session) {
            this.session.destroy();
            this.session = null;
        }
    }
}

// Initialize in service worker
const proofreaderService = new ProofreaderService();
```

### 2. Automatic Proofreading in Draft Generation

Update draft generation workflow:

```javascript
// In service_worker.js - Modify generateDrafts function

async function generateDrafts(threadText, tone, guidance) {
    try {
        // ... existing draft generation code ...
        
        const drafts = await languageModelService.generateDrafts(
            threadText,
            tone,
            guidance
        );
        
        // Automatically proofread all drafts
        const proofreaderAvailable = await proofreaderService.initialize();
        
        if (proofreaderAvailable) {
            for (const draft of Object.values(drafts)) {
                try {
                    // Proofread subject
                    const proofreadSubject = await proofreaderService.proofread(draft.subject);
                    draft.subject = proofreadSubject.correctedText || draft.subject;
                    draft.subjectProofread = true;
                    
                    // Proofread body
                    const proofreadBody = await proofreaderService.proofread(draft.body);
                    draft.body = proofreadBody.correctedText || draft.body;
                    draft.bodyProofread = true;
                    draft.corrections = proofreadBody.corrections?.length || 0;
                } catch (error) {
                    console.warn('Proofreading failed for draft, using original:', error);
                    draft.proofread = false;
                }
            }
        }
        
        return drafts;
    } catch (error) {
        console.error('Draft generation error:', error);
        throw error;
    }
}
```

### 3. Manual Proofreading for Guidance Text

Add to `sidepanel/sidepanel.html`:

```html
<!-- Update guidance textarea section -->
<div class="guidance-container">
    <label for="guidance-text">
        <span class="label-text">Custom Guidance (Optional)</span>
        <div class="guidance-actions">
            <button id="proofread-guidance-btn" 
                    class="icon-btn" 
                    title="Check grammar and spelling"
                    aria-label="Proofread guidance text">
                ✓ Proofread
            </button>
            <button id="voice-guidance-btn" 
                    class="icon-btn" 
                    title="Use voice input"
                    aria-label="Voice input">
                🎤
            </button>
        </div>
    </label>
    <textarea id="guidance-text" 
              rows="3" 
              placeholder="e.g., Keep it brief, mention the deadline, use a formal tone..."
              aria-describedby="guidance-help">
    </textarea>
    <div id="proofread-feedback" class="proofread-feedback" hidden>
        <span class="feedback-icon">✓</span>
        <span class="feedback-text">Made 2 corrections</span>
    </div>
    <p id="guidance-help" class="help-text">
        Provide specific instructions to personalize your drafts
    </p>
</div>

<!-- Update draft cards to show proofreading indicator -->
<div class="draft-card">
    <div class="draft-header">
        <h3>Short Answer</h3>
        <div class="draft-badges">
            <span class="badge proofread-badge" title="Grammar checked">
                ✓ Proofread
            </span>
        </div>
        <div class="draft-actions">
            <button class="copy-btn">Copy</button>
        </div>
    </div>
    <div class="draft-content"></div>
</div>
```

### 4. Proofreading Logic in sidepanel.js

```javascript
// Add proofreading handlers
document.getElementById('proofread-guidance-btn').addEventListener('click', async () => {
    const textarea = document.getElementById('guidance-text');
    const text = textarea.value.trim();
    
    if (!text) {
        showWarning('Enter some text to proofread');
        return;
    }
    
    const button = document.getElementById('proofread-guidance-btn');
    button.disabled = true;
    button.textContent = '⏳ Checking...';
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'PROOFREAD_TEXT',
            text: text
        });
        
        if (response.success) {
            textarea.value = response.correctedText;
            showProofreadFeedback(response.corrections);
        } else {
            showWarning('Proofreader not available: ' + response.error);
        }
    } catch (error) {
        showError('Proofreading failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = '✓ Proofread';
    }
});

function showProofreadFeedback(corrections) {
    const feedback = document.getElementById('proofread-feedback');
    const feedbackText = feedback.querySelector('.feedback-text');
    
    if (corrections && corrections.length > 0) {
        feedbackText.textContent = `Made ${corrections.length} correction${corrections.length > 1 ? 's' : ''}`;
        feedback.hidden = false;
        
        // Hide after 3 seconds
        setTimeout(() => {
            feedback.hidden = true;
        }, 3000);
    }
}

function displayDrafts(drafts) {
    // ... existing code ...
    
    // Show proofreading badge if draft was proofread
    Object.entries(drafts).forEach(([type, draft]) => {
        const card = document.querySelector(`[data-draft-type="${type}"]`);
        const badge = card.querySelector('.proofread-badge');
        
        if (draft.proofread && draft.corrections > 0) {
            badge.hidden = false;
            badge.title = `${draft.corrections} correction${draft.corrections > 1 ? 's' : ''} made`;
        } else if (draft.proofread) {
            badge.hidden = false;
            badge.title = 'No corrections needed';
        } else {
            badge.hidden = true;
        }
    });
}
```

### 5. Message Handler in service_worker.js

```javascript
// Add proofreading message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROOFREAD_TEXT') {
        handleProofreading(message, sendResponse);
        return true; // Keep channel open for async response
    }
    // ... existing handlers
});

async function handleProofreading(message, sendResponse) {
    try {
        const { text } = message;
        
        // Check if proofreader service is available
        const isAvailable = await proofreaderService.initialize();
        if (!isAvailable) {
            sendResponse({
                success: false,
                error: 'Proofreader API not available'
            });
            return;
        }
        
        // Perform proofreading
        const result = await proofreaderService.proofread(text);
        
        sendResponse({
            success: true,
            correctedText: result.correctedText || text,
            corrections: result.corrections || []
        });
    } catch (error) {
        console.error('Proofreading error:', error);
        sendResponse({
            success: false,
            error: error.message,
            correctedText: message.text // Return original on error
        });
    }
}
```

### 6. CSS Styling

```css
/* Proofreading UI */
.guidance-container {
    position: relative;
}

.guidance-actions {
    display: flex;
    gap: 8px;
    margin-left: auto;
}

.icon-btn {
    padding: 6px 12px;
    font-size: 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
}

.icon-btn:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--accent-color);
}

.icon-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.proofread-feedback {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 8px 12px;
    background: var(--success-light);
    border-left: 3px solid var(--success-color);
    border-radius: 4px;
    font-size: 14px;
}

.feedback-icon {
    color: var(--success-color);
    font-weight: bold;
}

.proofread-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--success-light);
    color: var(--success-dark);
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
}

.draft-badges {
    display: flex;
    gap: 6px;
    margin-left: 8px;
}
```

---

## 📝 README Updates

### Update Value Proposition

```markdown
## Value Proposition

- **Save Time**: Get instant TL;DR summaries and key points from lengthy email threads
- **Understand Attachments**: Automatically analyze PDFs, documents, spreadsheets, and images locally
- **Stay Responsive**: Generate professional reply drafts in multiple tones and lengths
- **🆕 Grammar Perfect**: All drafts automatically proofread for grammar and spelling
- **Voice Input**: Use voice dictation with automatic grammar checking
```

### Update Chrome AI APIs Section

```markdown
## 🤖 Chrome Built-in AI APIs Used

- **✅ Summarizer API** - Email thread condensation and key points extraction
- **✅ Prompt API** - Structured draft generation with JSON schema
- **✅ Translator API** - On-device multilingual translation (10+ languages)
- **✅ Proofreader API** - Automatic grammar and spelling correction
- **🔜 Rewriter API** - Coming soon
- **🔜 Writer API** - Coming soon
```

---

## 🧪 Testing Requirements

### Automated Tests

Create `tests/proofreader.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { extensionTest } from './fixtures/extension';

extensionTest('Proofreader API integration', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    
    // Enter text with intentional errors
    const guidanceText = page.locator('#guidance-text');
    await guidanceText.fill('This have some grammer mistakes in it.');
    
    // Click proofread button
    await page.click('#proofread-guidance-btn');
    
    // Wait for proofreading
    await page.waitForSelector('#proofread-feedback:not([hidden])');
    
    // Verify corrections were made
    const feedback = page.locator('#proofread-feedback');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText('correction');
    
    // Verify text was updated
    const correctedText = await guidanceText.inputValue();
    expect(correctedText).not.toBe('This have some grammer mistakes in it.');
});

extensionTest('Drafts show proofreading badges', async ({ page, extensionId }) => {
    // Mock draft generation with proofreading
    await page.evaluate(() => {
        const mockDrafts = {
            short: {
                subject: 'Re: Meeting',
                body: 'Thanks for the update.',
                proofread: true,
                corrections: 0
            }
        };
        
        // Simulate displaying drafts
        window.postMessage({ type: 'DRAFTS_GENERATED', drafts: mockDrafts }, '*');
    });
    
    // Check for proofreading badge
    const badge = page.locator('.proofread-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Proofread');
});
```

### Manual Testing Checklist

- [ ] Test proofreading with intentional grammar errors
- [ ] Test proofreading with spelling mistakes
- [ ] Test proofreading with correct text (no changes)
- [ ] Test proofreading very long text (>1000 words)
- [ ] Test proofreading very short text (<5 words)
- [ ] Verify badge appears on proofread drafts
- [ ] Test with Proofreader API unavailable
- [ ] Verify keyboard shortcut works (if implemented)
- [ ] Test with screen reader
- [ ] Verify feedback message timing (3 seconds)

---

## 📚 Documentation Updates

### SPEC.md Addition

```markdown
### Grammar and Spelling Correction
**Given** reply drafts have been generated  
**When** the Proofreader API is available  
**Then** all drafts should be automatically proofread before display  
**And** corrections should be made to improve grammar and spelling  
**And** a proofreading badge should indicate the draft was checked  
**And** users can manually proofread their guidance text  
**And** proofreading should happen on-device
```

### docs/chrome-ai-api-compliance.md Addition

```markdown
### 3. Proofreader API
**Status**: ✅ Correctly Implemented  
**Availability**: Origin Trial  
**Documentation**: https://developer.chrome.com/docs/ai/proofreader-api

#### Our Implementation:
```javascript
const proofreader = await Proofreader.create();
const result = await proofreader.proofread(text);
proofreader.destroy();
```

**Compliance Notes**:
- ✅ Uses global constructor: `Proofreader`
- ✅ Calls `.availability()` before creating sessions
- ✅ Destroys sessions after use
- ✅ Handles unavailability gracefully
```

---

## 🎥 Demo Video Inclusion

**For hackathon demo video (timestamp ~1:45-1:55):**

1. Show guidance textarea with intentional errors
2. Click "Proofread" button
3. Show corrections being made instantly
4. Generate drafts and show proofreading badge
5. Emphasize "Automatic grammar checking"

**Voiceover script:**
> "Every draft is automatically proofread using Chrome's Proofreader API. Watch as it catches grammar mistakes and improves clarity—all on your device, no cloud grammar checkers needed."

---

## 🚀 Success Metrics

- [ ] API correctly integrated following Chrome documentation
- [ ] Automatic proofreading works for all generated drafts
- [ ] Manual proofreading available for guidance text
- [ ] Feature highlighted in demo video
- [ ] README updated with proofreading capability
- [ ] Tests passing for core proofreading workflows
- [ ] No degradation in draft generation performance (<0.5s added)

---

## 📎 References

- [Chrome Proofreader API Documentation](https://developer.chrome.com/docs/ai/proofreader-api)
- [Origin Trials for Chrome Extensions](https://developer.chrome.com/docs/web-platform/origin-trials)
- [Chrome Built-in AI Challenge Guidelines](https://googlechromeai2025.devpost.com/)

---

## 🔗 Related Tasks

- Task 001: Translator API Integration
- Task 003: Rewriter API Integration
- Task 012: Demo Video Creation
- Task 013: README API Showcase


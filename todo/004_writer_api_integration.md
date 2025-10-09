# Task 004: Writer API Integration

**Priority**: 🟢 MEDIUM (Creative Differentiation)  
**Estimated Effort**: 3-4 hours  
**Chrome API Used**: Writer API (Origin Trial)  
**Status**: [todo]

---

## 📋 Task Description

Integrate Chrome's Writer API to generate original content based on email context. Add features like "Suggested Questions" and "Follow-up Ideas" that go beyond simple reply drafts.

**Hackathon Value**: Shows creative thinking and original application of AI APIs. Differentiates from basic email tools.

---

## 🎯 Acceptance Criteria

### Functional Requirements
- [ ] Generate 3-5 suggested questions based on email content
- [ ] Generate 2-3 follow-up action ideas
- [ ] Provide "Expand Point" feature for key points in summary
- [ ] Content generation happens on-device
- [ ] Graceful fallback when Writer API unavailable
- [ ] Clear distinction between AI suggestions and user drafts

### Technical Requirements
- [ ] Use Chrome's Writer API following official documentation
- [ ] Check `Writer.availability()` before use
- [ ] Proper session lifecycle management
- [ ] Different writing tasks (questions, actions, expansions)
- [ ] No external writing services

### UI Requirements
- [ ] "Suggested Questions" section in side panel
- [ ] "Follow-up Ideas" section
- [ ] Expandable cards for each suggestion
- [ ] Copy button for each suggestion
- [ ] Keyboard accessible
- [ ] ARIA labels for accessibility

---

## 🔧 Implementation Details

### 1. API Integration Pattern

```javascript
// In service_worker.js - Add WriterService class

class WriterService {
    constructor() {
        this.sessions = new Map();
        this.availability = null;
    }

    async initialize() {
        if ('Writer' in self) {
            this.availability = await Writer.availability();
            console.log('Writer API availability:', this.availability);
            return this.availability === 'readily';
        }
        return false;
    }

    async generateContent(prompt, task = 'general', length = 'medium') {
        if (this.availability !== 'readily') {
            await this.initialize();
        }

        const sessionKey = `${task}-${length}`;
        if (!this.sessions.has(sessionKey)) {
            const session = await Writer.create({
                task: task,
                length: length,
                format: 'plain-text'
            });
            this.sessions.set(sessionKey, session);
        }

        const session = this.sessions.get(sessionKey);
        return await session.write(prompt);
    }

    async generateQuestions(context, numQuestions = 5) {
        const prompt = `Based on this email thread, generate ${numQuestions} relevant follow-up questions that would help clarify or advance the discussion:\n\n${context}`;
        const response = await this.generateContent(prompt, 'questions', 'short');
        return this.parseQuestions(response);
    }

    async generateFollowUpIdeas(context, numIdeas = 3) {
        const prompt = `Based on this email thread, suggest ${numIdeas} concrete follow-up actions or next steps:\n\n${context}`;
        const response = await this.generateContent(prompt, 'actions', 'short');
        return this.parseActions(response);
    }

    async expandPoint(point, context) {
        const prompt = `Expand on this key point with additional detail and context:\n\nKey Point: ${point}\n\nContext: ${context}`;
        return await this.generateContent(prompt, 'expansion', 'medium');
    }

    parseQuestions(text) {
        // Parse numbered or bulleted questions
        const lines = text.split('\n').filter(line => line.trim());
        const questions = [];
        
        for (const line of lines) {
            const cleaned = line.replace(/^[\d\-\*\.)\s]+/, '').trim();
            if (cleaned.length > 10 && (cleaned.includes('?') || cleaned.match(/^(what|how|why|when|where|who|which|could|would|should)/i))) {
                questions.push(cleaned.endsWith('?') ? cleaned : cleaned + '?');
            }
        }
        
        return questions.slice(0, 5);
    }

    parseActions(text) {
        // Parse action items
        const lines = text.split('\n').filter(line => line.trim());
        const actions = [];
        
        for (const line of lines) {
            const cleaned = line.replace(/^[\d\-\*\.)\s]+/, '').trim();
            if (cleaned.length > 15) {
                actions.push(cleaned);
            }
        }
        
        return actions.slice(0, 3);
    }

    cleanup() {
        for (const session of this.sessions.values()) {
            session.destroy();
        }
        this.sessions.clear();
    }
}

// Initialize in service worker
const writerService = new WriterService();
```

### 2. Side Panel UI Updates

Add to `sidepanel/sidepanel.html`:

```html
<!-- Add after Summary Section -->
<section id="insights-section" class="insights-section" hidden>
    <h2>AI Insights</h2>
    
    <!-- Suggested Questions -->
    <div class="insight-subsection">
        <div class="subsection-header">
            <h3>
                <span class="icon">❓</span>
                Suggested Questions
            </h3>
            <button id="generate-questions-btn" 
                    class="secondary-btn"
                    aria-label="Generate suggested questions">
                Generate
            </button>
        </div>
        <div id="questions-container" class="suggestions-container" hidden>
            <p class="section-description">Questions to help clarify or advance the discussion</p>
            <div id="questions-list" class="suggestions-list">
                <!-- Questions will be inserted here -->
            </div>
        </div>
    </div>
    
    <!-- Follow-up Ideas -->
    <div class="insight-subsection">
        <div class="subsection-header">
            <h3>
                <span class="icon">💡</span>
                Follow-up Ideas
            </h3>
            <button id="generate-followups-btn" 
                    class="secondary-btn"
                    aria-label="Generate follow-up ideas">
                Generate
            </button>
        </div>
        <div id="followups-container" class="suggestions-container" hidden>
            <p class="section-description">Suggested next steps and actions</p>
            <div id="followups-list" class="suggestions-list">
                <!-- Follow-up ideas will be inserted here -->
            </div>
        </div>
    </div>
</section>

<!-- Suggestion Card Template -->
<template id="suggestion-card-template">
    <div class="suggestion-card">
        <div class="suggestion-content">
            <!-- Content text here -->
        </div>
        <button class="copy-suggestion-btn" aria-label="Copy to clipboard">
            <span class="icon">📋</span>
            Copy
        </button>
    </div>
</template>
```

### 3. Writer Logic in sidepanel.js

```javascript
let insightsSuggestions = {
    questions: [],
    followups: []
};

// Show insights section after summary is generated
function showInsightsSection() {
    const insightsSection = document.getElementById('insights-section');
    insightsSection.hidden = false;
}

// Generate Questions
document.getElementById('generate-questions-btn').addEventListener('click', async () => {
    const button = document.getElementById('generate-questions-btn');
    button.disabled = true;
    button.textContent = '⏳ Generating...';
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GENERATE_QUESTIONS',
            context: currentThreadText // Store this when extracting thread
        });
        
        if (response.success && response.questions.length > 0) {
            insightsSuggestions.questions = response.questions;
            displayQuestions(response.questions);
        } else {
            showWarning('Could not generate questions: ' + (response.error || 'No suggestions available'));
        }
    } catch (error) {
        showError('Question generation failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Generate';
    }
});

// Generate Follow-ups
document.getElementById('generate-followups-btn').addEventListener('click', async () => {
    const button = document.getElementById('generate-followups-btn');
    button.disabled = true;
    button.textContent = '⏳ Generating...';
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GENERATE_FOLLOWUPS',
            context: currentThreadText
        });
        
        if (response.success && response.followups.length > 0) {
            insightsSuggestions.followups = response.followups;
            displayFollowups(response.followups);
        } else {
            showWarning('Could not generate follow-ups: ' + (response.error || 'No suggestions available'));
        }
    } catch (error) {
        showError('Follow-up generation failed: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Generate';
    }
});

function displayQuestions(questions) {
    const container = document.getElementById('questions-container');
    const list = document.getElementById('questions-list');
    
    list.innerHTML = '';
    
    questions.forEach((question, index) => {
        const card = createSuggestionCard(question, `question-${index}`);
        list.appendChild(card);
    });
    
    container.hidden = false;
}

function displayFollowups(followups) {
    const container = document.getElementById('followups-container');
    const list = document.getElementById('followups-list');
    
    list.innerHTML = '';
    
    followups.forEach((followup, index) => {
        const card = createSuggestionCard(followup, `followup-${index}`);
        list.appendChild(card);
    });
    
    container.hidden = false;
}

function createSuggestionCard(text, id) {
    const template = document.getElementById('suggestion-card-template');
    const card = template.content.cloneNode(true);
    
    const cardElement = card.querySelector('.suggestion-card');
    cardElement.dataset.suggestionId = id;
    
    const content = card.querySelector('.suggestion-content');
    content.textContent = text;
    
    const copyBtn = card.querySelector('.copy-suggestion-btn');
    copyBtn.addEventListener('click', () => {
        copyToClipboard(text);
        showCopyFeedback(copyBtn);
    });
    
    return card;
}

function showCopyFeedback(button) {
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="icon">✓</span> Copied!';
    button.classList.add('copied');
    
    setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('copied');
    }, 2000);
}

// Add expand point feature for key points
document.addEventListener('click', async (e) => {
    if (e.target.matches('.expand-point-btn')) {
        const point = e.target.dataset.point;
        await expandKeyPoint(point);
    }
});

async function expandKeyPoint(point) {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'EXPAND_POINT',
            point: point,
            context: currentThreadText
        });
        
        if (response.success) {
            showExpandedPointModal(point, response.expansion);
        }
    } catch (error) {
        showError('Expansion failed: ' + error.message);
    }
}
```

### 4. Message Handlers in service_worker.js

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GENERATE_QUESTIONS') {
        handleQuestionGeneration(message, sendResponse);
        return true;
    }
    if (message.type === 'GENERATE_FOLLOWUPS') {
        handleFollowupGeneration(message, sendResponse);
        return true;
    }
    if (message.type === 'EXPAND_POINT') {
        handlePointExpansion(message, sendResponse);
        return true;
    }
    // ... existing handlers
});

async function handleQuestionGeneration(message, sendResponse) {
    try {
        const isAvailable = await writerService.initialize();
        if (!isAvailable) {
            sendResponse({
                success: false,
                error: 'Writer API not available'
            });
            return;
        }
        
        const questions = await writerService.generateQuestions(
            message.context,
            5
        );
        
        sendResponse({
            success: true,
            questions: questions
        });
    } catch (error) {
        console.error('Question generation error:', error);
        sendResponse({
            success: false,
            error: error.message,
            questions: []
        });
    }
}

async function handleFollowupGeneration(message, sendResponse) {
    try {
        const isAvailable = await writerService.initialize();
        if (!isAvailable) {
            sendResponse({
                success: false,
                error: 'Writer API not available'
            });
            return;
        }
        
        const followups = await writerService.generateFollowUpIdeas(
            message.context,
            3
        );
        
        sendResponse({
            success: true,
            followups: followups
        });
    } catch (error) {
        console.error('Follow-up generation error:', error);
        sendResponse({
            success: false,
            error: error.message,
            followups: []
        });
    }
}

async function handlePointExpansion(message, sendResponse) {
    try {
        const isAvailable = await writerService.initialize();
        if (!isAvailable) {
            sendResponse({
                success: false,
                error: 'Writer API not available'
            });
            return;
        }
        
        const expansion = await writerService.expandPoint(
            message.point,
            message.context
        );
        
        sendResponse({
            success: true,
            expansion: expansion
        });
    } catch (error) {
        console.error('Point expansion error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}
```

### 5. CSS Styling

```css
/* AI Insights Section */
.insights-section {
    margin-top: 20px;
    padding: 20px;
    background: var(--bg-secondary);
    border-radius: 8px;
}

.insight-subsection {
    margin-bottom: 24px;
}

.insight-subsection:last-child {
    margin-bottom: 0;
}

.subsection-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.subsection-header h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.subsection-header .icon {
    font-size: 20px;
}

.section-description {
    margin: 0 0 12px 0;
    font-size: 13px;
    color: var(--text-secondary);
    font-style: italic;
}

.suggestions-container {
    margin-top: 12px;
}

.suggestions-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.suggestion-card {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    transition: all 0.2s;
}

.suggestion-card:hover {
    border-color: var(--accent-color);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.suggestion-content {
    flex: 1;
    line-height: 1.5;
    color: var(--text-primary);
}

.copy-suggestion-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
}

.copy-suggestion-btn:hover {
    background: var(--accent-dark);
}

.copy-suggestion-btn.copied {
    background: var(--success-color);
}
```

---

## 📝 README Updates

```markdown
## Value Proposition

- **Save Time**: Get instant TL;DR summaries with AI-generated follow-up questions
- **Stay Organized**: AI suggests concrete next steps and action items
- **🆕 Go Deeper**: Expand any key point for additional context and detail
- **More Choices**: Generate alternative draft phrasings instantly
```

### Update Chrome AI APIs Section

```markdown
## 🤖 Chrome Built-in AI APIs Used

- **✅ Writer API** - Original content generation (questions, actions, expansions)
```

---

## 🧪 Testing Requirements

### Automated Tests

```typescript
extensionTest('Writer API generates questions', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/sidepanel/sidepanel.html`);
    
    // Click generate questions
    await page.click('#generate-questions-btn');
    
    // Wait for questions
    await page.waitForSelector('#questions-container:not([hidden])');
    
    // Verify questions displayed
    const questions = page.locator('.suggestion-card');
    const count = await questions.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
});
```

---

## 🎥 Demo Video Inclusion

**Timestamp ~2:05-2:15:**

Show:
1. Click "Generate Questions" button
2. Display 5 suggested questions
3. Click "Generate Follow-ups"
4. Show 3 action items
5. Click copy on one suggestion

---

## 📎 References

- [Chrome Writer API Documentation](https://developer.chrome.com/docs/ai/writer-api)
- [Content Generation Best Practices](https://pair.withgoogle.com/guidebook/)

---

## 🔗 Related Tasks

- Task 001-003: Other API integrations
- Task 012: Demo Video Creation


# Task 005: Multimodal Prompt API - Image Analysis

**Priority**: 🔴 CRITICAL (Showcase Feature for Hackathon)  
**Estimated Effort**: 4-5 hours  
**Chrome API Used**: Prompt API with Multimodal Capabilities  
**Status**: [done] ✅ COMPLETE

---

## 📋 Task Description

Implement image and audio analysis using the Prompt API's multimodal capabilities. This is explicitly highlighted in the Chrome Built-in AI Challenge 2025 as a key differentiator.

**Hackathon Value**: Multimodal AI is cutting-edge and will significantly differentiate your submission. Few extensions will showcase this capability.

---

## 🎯 Acceptance Criteria

### Functional Requirements
- [ ] Detect image attachments in email threads
- [ ] Analyze images using Prompt API multimodal capabilities
- [ ] Generate descriptive captions for images
- [ ] Extract text from images (OCR capability)
- [ ] Identify charts, graphs, and data visualizations
- [ ] Provide context-aware image analysis relative to email content
- [ ] All processing happens on-device
- [ ] Graceful fallback when multimodal features unavailable

### Technical Requirements
- [ ] Use Prompt API with image input support
- [ ] Check multimodal capability availability
- [ ] Convert image attachments to compatible format (base64, Blob, etc.)
- [ ] Handle multiple images per email
- [ ] Efficient memory management for image processing
- [ ] No external vision APIs

### UI Requirements
- [ ] Image preview thumbnails in attachment cards
- [ ] "Analyze Image" button for each image attachment
- [ ] Analysis results displayed in expandable section
- [ ] Loading state during analysis
- [ ] Visual indicators for analysis type (caption, OCR, chart)
- [ ] Copy button for extracted text
- [ ] Keyboard accessible

---

## 🔧 Implementation Details

### 1. API Integration Pattern

```javascript
// In service_worker.js - Extend LanguageModelService for multimodal

class MultimodalAnalysisService {
    constructor() {
        this.session = null;
        this.availability = null;
        this.supportsImages = false;
    }

    async initialize() {
        if ('LanguageModel' in self) {
            this.availability = await LanguageModel.availability();
            
            if (this.availability === 'readily') {
                // Check for multimodal capabilities
                const capabilities = await LanguageModel.capabilities();
                this.supportsImages = capabilities?.supportedInputs?.includes('image') || false;
                
                console.log('Multimodal capabilities:', {
                    available: this.availability,
                    supportsImages: this.supportsImages
                });
                
                return this.supportsImages;
            }
        }
        return false;
    }

    async analyzeImage(imageData, analysisType = 'general', context = '') {
        if (!this.supportsImages) {
            throw new Error('Multimodal image analysis not available');
        }

        // Create session if not exists
        if (!this.session) {
            this.session = await LanguageModel.create({
                initialPrompts: [
                    { role: 'system', content: this.getSystemPrompt(analysisType) }
                ],
                temperature: 0.3,
                topK: 3
            });
        }

        const prompt = this.buildPrompt(analysisType, context);
        
        // Send multimodal prompt with image
        const response = await this.session.prompt(prompt, {
            image: imageData // Image as Blob, base64, or ImageData
        });

        return this.parseResponse(response, analysisType);
    }

    getSystemPrompt(analysisType) {
        const prompts = {
            general: 'You are an AI assistant that analyzes images in email attachments. Provide clear, concise descriptions.',
            ocr: 'You are an OCR system. Extract all visible text from images accurately. Maintain formatting and structure.',
            chart: 'You are a data visualization analyst. Describe charts, graphs, and diagrams, including key data points and trends.',
            context: 'You are analyzing an image attachment in context of an email conversation. Explain how the image relates to the discussion.'
        };
        return prompts[analysisType] || prompts.general;
    }

    buildPrompt(analysisType, context) {
        const prompts = {
            general: 'Describe this image in 2-3 sentences. Focus on key elements that would be relevant in a business email context.',
            ocr: 'Extract all text visible in this image. Preserve formatting, line breaks, and structure. If no text is visible, respond with "No text detected".',
            chart: 'Analyze this chart or visualization. Describe: 1) Type of visualization, 2) Key data points, 3) Main trends or insights.',
            context: `This image was attached to an email about: ${context}\n\nDescribe the image and explain its relevance to the email discussion.`
        };
        return prompts[analysisType] || prompts.general;
    }

    parseResponse(response, analysisType) {
        return {
            type: analysisType,
            description: response.trim(),
            timestamp: Date.now()
        };
    }

    cleanup() {
        if (this.session) {
            this.session.destroy();
            this.session = null;
        }
    }
}

// Initialize service
const multimodalService = new MultimodalAnalysisService();
```

### 2. Enhanced Attachment Detection in content.js

```javascript
// Update extractAttachments function to detect images

function extractAttachments() {
    const attachments = [];
    const attachmentElements = document.querySelectorAll(
        '[role="listitem"] [data-tooltip*="Download"], .aQy .aZo, .aQy .zA9'
    );

    attachmentElements.forEach((element, index) => {
        const nameEl = element.querySelector('[dir="ltr"]') || element;
        const fileName = nameEl.textContent.trim();
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        // Check if image
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(fileExtension);
        
        // For images, try to get the image source
        let imageUrl = null;
        let imageData = null;
        
        if (isImage) {
            // Gmail often embeds images - try to find them
            const imgElement = element.closest('[role="listitem"]')?.querySelector('img');
            if (imgElement && imgElement.src) {
                imageUrl = imgElement.src;
            }
            
            // Alternative: Look for background images
            if (!imageUrl) {
                const bgImage = element.style.backgroundImage;
                if (bgImage) {
                    imageUrl = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/)?.[1];
                }
            }
        }
        
        attachments.push({
            id: `attachment-${index}`,
            fileName,
            fileExtension,
            isImage,
            imageUrl,
            size: element.dataset.size || 'Unknown',
            downloadUrl: element.href || null
        });
    });

    return attachments;
}
```

### 3. Image Download and Processing

```javascript
// In service_worker.js - Add image fetching

async function fetchImageData(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        
        // Convert to base64 for Prompt API
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error fetching image:', error);
        throw new Error('Failed to fetch image data');
    }
}

// Message handler for image analysis
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_IMAGE') {
        handleImageAnalysis(message, sendResponse);
        return true;
    }
    // ... existing handlers
});

async function handleImageAnalysis(message, sendResponse) {
    try {
        const { imageUrl, analysisType, context } = message;
        
        // Check multimodal availability
        const isAvailable = await multimodalService.initialize();
        if (!isAvailable) {
            sendResponse({
                success: false,
                error: 'Multimodal image analysis not available'
            });
            return;
        }
        
        // Fetch image data
        const imageData = await fetchImageData(imageUrl);
        
        // Analyze image
        const analysis = await multimodalService.analyzeImage(
            imageData,
            analysisType,
            context
        );
        
        sendResponse({
            success: true,
            analysis: analysis
        });
    } catch (error) {
        console.error('Image analysis error:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}
```

### 4. UI Updates in sidepanel.html

```html
<!-- Enhanced Attachment Card with Image Analysis -->
<div class="attachment-card image-attachment" data-attachment-id="attachment-0">
    <div class="attachment-icon">
        <img class="attachment-thumbnail" src="" alt="Image preview" />
    </div>
    <div class="attachment-info">
        <div class="attachment-name">screenshot.png</div>
        <div class="attachment-meta">
            <span class="attachment-size">245 KB</span>
            <span class="attachment-type-badge">Image</span>
        </div>
    </div>
    <div class="attachment-actions">
        <button class="analyze-image-btn" 
                data-attachment-id="attachment-0"
                aria-label="Analyze image content">
            <span class="icon">🔍</span>
            Analyze
        </button>
    </div>
</div>

<!-- Image Analysis Results Panel -->
<div class="image-analysis-panel" data-attachment-id="attachment-0" hidden>
    <div class="analysis-header">
        <h4>Image Analysis</h4>
        <button class="close-analysis-btn" aria-label="Close analysis">×</button>
    </div>
    
    <div class="analysis-tabs">
        <button class="analysis-tab active" data-type="general">
            Description
        </button>
        <button class="analysis-tab" data-type="ocr">
            Extract Text
        </button>
        <button class="analysis-tab" data-type="chart">
            Analyze Chart
        </button>
    </div>
    
    <div class="analysis-content">
        <div class="analysis-result" data-type="general">
            <!-- Analysis text here -->
        </div>
        <button class="copy-analysis-btn">
            Copy Analysis
        </button>
    </div>
</div>
```

### 5. Image Analysis Logic in sidepanel.js

```javascript
let imageAnalysisCache = new Map();

// Handle analyze image button
document.addEventListener('click', async (e) => {
    if (e.target.closest('.analyze-image-btn')) {
        const button = e.target.closest('.analyze-image-btn');
        const attachmentId = button.dataset.attachmentId;
        await analyzeAttachmentImage(attachmentId, 'general');
    }
    
    if (e.target.closest('.analysis-tab')) {
        const tab = e.target.closest('.analysis-tab');
        const analysisType = tab.dataset.type;
        const attachmentId = tab.closest('.image-analysis-panel').dataset.attachmentId;
        await switchAnalysisType(attachmentId, analysisType);
    }
});

async function analyzeAttachmentImage(attachmentId, analysisType) {
    // Check cache first
    const cacheKey = `${attachmentId}-${analysisType}`;
    if (imageAnalysisCache.has(cacheKey)) {
        displayImageAnalysis(attachmentId, analysisType, imageAnalysisCache.get(cacheKey));
        return;
    }
    
    // Get attachment data
    const attachment = currentAttachments.find(a => a.id === attachmentId);
    if (!attachment || !attachment.imageUrl) {
        showError('Image not available for analysis');
        return;
    }
    
    // Show loading state
    const panel = document.querySelector(`.image-analysis-panel[data-attachment-id="${attachmentId}"]`);
    const button = document.querySelector(`.analyze-image-btn[data-attachment-id="${attachmentId}"]`);
    
    button.disabled = true;
    button.innerHTML = '<span class="icon">⏳</span> Analyzing...';
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'ANALYZE_IMAGE',
            imageUrl: attachment.imageUrl,
            analysisType: analysisType,
            context: currentThreadSummary || ''
        });
        
        if (response.success) {
            imageAnalysisCache.set(cacheKey, response.analysis);
            displayImageAnalysis(attachmentId, analysisType, response.analysis);
        } else {
            showError('Image analysis failed: ' + response.error);
        }
    } catch (error) {
        showError('Image analysis error: ' + error.message);
    } finally {
        button.disabled = false;
        button.innerHTML = '<span class="icon">🔍</span> Analyze';
    }
}

function displayImageAnalysis(attachmentId, analysisType, analysis) {
    const panel = document.querySelector(`.image-analysis-panel[data-attachment-id="${attachmentId}"]`);
    
    if (!panel) {
        // Create panel dynamically
        createAnalysisPanel(attachmentId);
    }
    
    // Update active tab
    panel.querySelectorAll('.analysis-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === analysisType);
    });
    
    // Update content
    const result = panel.querySelector(`.analysis-result[data-type="${analysisType}"]`);
    result.textContent = analysis.description;
    
    // Show panel
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function switchAnalysisType(attachmentId, analysisType) {
    const cacheKey = `${attachmentId}-${analysisType}`;
    
    if (imageAnalysisCache.has(cacheKey)) {
        displayImageAnalysis(attachmentId, analysisType, imageAnalysisCache.get(cacheKey));
    } else {
        await analyzeAttachmentImage(attachmentId, analysisType);
    }
}
```

### 6. CSS Styling

```css
/* Image Attachments */
.image-attachment {
    border-left: 3px solid var(--accent-color);
}

.attachment-thumbnail {
    max-width: 48px;
    max-height: 48px;
    border-radius: 4px;
    object-fit: cover;
}

.attachment-type-badge {
    display: inline-block;
    padding: 2px 6px;
    background: var(--accent-light);
    color: var(--accent-dark);
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
}

.analyze-image-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
}

.analyze-image-btn:hover:not(:disabled) {
    background: var(--accent-dark);
}

.analyze-image-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

/* Image Analysis Panel */
.image-analysis-panel {
    margin-top: 12px;
    padding: 16px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
}

.analysis-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    border-bottom: 2px solid var(--border-color);
}

.analysis-tab {
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 500;
}

.analysis-tab:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
}

.analysis-tab.active {
    color: var(--accent-color);
    border-bottom-color: var(--accent-color);
}

.analysis-result {
    padding: 12px;
    background: var(--bg-primary);
    border-radius: 6px;
    line-height: 1.6;
    margin-bottom: 12px;
}

.copy-analysis-btn {
    width: 100%;
    padding: 8px;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}
```

---

## 📝 README Updates

### Update Value Proposition

```markdown
## Value Proposition

- **🆕 Visual Intelligence**: Analyze image attachments, extract text, and understand charts—all on-device
- **Understand Attachments**: Automatically analyze PDFs, documents, spreadsheets, and images
```

### Update Chrome AI APIs Section

```markdown
## 🤖 Chrome Built-in AI APIs Used

- **✅ Prompt API (Multimodal)** - Image analysis, OCR, chart interpretation
```

### Add Showcase Section

```markdown
## 🌟 Cutting-Edge Features

### Multimodal AI Analysis
The extension leverages Chrome's multimodal Prompt API to analyze image attachments:
- **Image Description**: Automatic captions for attached images
- **Text Extraction**: OCR capability to extract text from screenshots
- **Chart Analysis**: Understand graphs and data visualizations
- **Context-Aware**: Relates image content to email discussion

All image processing happens locally—your images never leave your device.
```

---

## 🧪 Testing Requirements

### Automated Tests

```typescript
extensionTest('Multimodal image analysis', async ({ page, extensionId }) => {
    // Test with mock image attachment
    await page.evaluate(() => {
        window.mockAttachments = [{
            id: 'img-1',
            fileName: 'chart.png',
            isImage: true,
            imageUrl: 'data:image/png;base64,...'
        }];
    });
    
    await page.click('.analyze-image-btn');
    await page.waitForSelector('.image-analysis-panel:not([hidden])');
    
    const analysisPanel = page.locator('.image-analysis-panel');
    await expect(analysisPanel).toBeVisible();
});
```

### Manual Testing Checklist

- [ ] Test with various image formats (JPG, PNG, GIF, WebP)
- [ ] Test OCR with screenshots containing text
- [ ] Test chart analysis with graphs
- [ ] Test with multiple images in one email
- [ ] Test with very large images (>5MB)
- [ ] Verify thumbnail previews display correctly
- [ ] Test switching between analysis types
- [ ] Test with multimodal API unavailable
- [ ] Verify analysis caching works
- [ ] Test copy analysis button
- [ ] Verify keyboard navigation
- [ ] Test screen reader accessibility

---

## 📚 Documentation Updates

### SPEC.md Addition

```markdown
### Multimodal Image Analysis
**Given** an email thread contains image attachments  
**When** the user clicks "Analyze" on an image  
**Then** the Prompt API should analyze the image using multimodal capabilities  
**And** provide a descriptive caption or analysis  
**And** user can switch between analysis types (description, OCR, chart)  
**And** extracted text can be copied to clipboard  
**And** all image processing happens on-device
```

---

## 🎥 Demo Video Inclusion

**For hackathon demo video (timestamp ~1:15-1:30) - CRITICAL:**

1. Show email with image attachment (use a chart or screenshot)
2. Click "Analyze Image" button
3. Show AI describing the image
4. Switch to "Extract Text" tab
5. Show OCR results
6. Emphasize "All image analysis happens locally"

**Voiceover script:**
> "The extension uses Chrome's cutting-edge multimodal Prompt API to analyze images. It can describe images, extract text like an OCR tool, and even interpret charts—all processing your images locally for complete privacy."

**This is a KEY differentiator - make it prominent!**

---

## 🚀 Success Metrics

- [ ] Successfully analyze images using multimodal Prompt API
- [ ] Three analysis types working (general, OCR, chart)
- [ ] Image analysis completes in <5 seconds
- [ ] Feature prominently shown in demo video (30+ seconds)
- [ ] README highlights multimodal capabilities
- [ ] Tests passing for core workflows
- [ ] Keyboard and screen reader accessible

---

## 📎 References

- [Chrome Prompt API - Multimodal Capabilities](https://developer.chrome.com/docs/ai/prompt-api#multimodal)
- [Image Input Best Practices](https://developer.chrome.com/docs/ai/best-practices)
- [Chrome Built-in AI Challenge Guidelines](https://googlechromeai2025.devpost.com/)

---

## 🔗 Related Tasks

- Task 010: Enhanced Attachment Intelligence (builds on this)
- Task 012: Demo Video Creation (feature this prominently!)
- Task 013: README API Showcase (highlight multimodal)

---

## ⚠️ Important Notes

**This is one of the most impactful features for the hackathon submission!** The hackathon announcement explicitly mentions "image and audio inputs" for the Prompt API as a key capability. Very few submissions will implement this, so it's a major differentiator.

Prioritize this task highly and ensure it's featured prominently in the demo video.


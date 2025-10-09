# Inbox Triage Extension

**Triage your inbox with AI-powered email summaries, attachment analysis, and reply drafts—all processed locally for complete privacy.**

This Chrome extension transforms email overwhelm into actionable insights by instantly summarizing email threads, analyzing attachments, and generating three tailored reply drafts. Built entirely on Chrome's on-device AI APIs with zero server dependencies.

## Value Proposition

- **Save Time**: Get instant TL;DR summaries and key points from lengthy email threads
- **Understand Attachments**: Automatically analyze PDFs, documents, spreadsheets, and images locally
- **Stay Responsive**: Generate professional reply drafts in multiple tones and lengths with custom guidance
- **Voice Input**: Use voice dictation to quickly add guidance for your reply drafts
- **Protect Privacy**: All processing happens locally—no data or files leave your device, including voice transcription
- **Work Offline**: Fully functional once AI models are downloaded

## Documentation Map

Start here to understand the project and contribute effectively:

- **[SPEC.md](SPEC.md)** - Complete functional and technical requirements
- **[AGENTS.md](AGENTS.md)** - Development guidelines for AI coding agents and contributors  
- **[TODO.md](TODO.md)** - Project tasks and progress tracking
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - GitHub Copilot configuration and rules

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- **Chrome 138+** (Check: `chrome://version`) - [Built-in AI APIs Documentation](https://developer.chrome.com/docs/ai/built-in)
- **22GB free storage** (for Gemini Nano AI models)
- **4GB+ GPU VRAM** (recommended for optimal performance, or use custom API key option)
- **Operating System:** Windows 10/11, macOS 13+, or Linux

### Install in 3 Steps

#### Step 1: Enable Chrome AI (2 minutes)
```bash
1. Open chrome://flags
2. Enable these 3 flags:
   • #optimization-guide-on-device-model → "Enabled BypassPerfRequirement"
   • #prompt-api-for-gemini-nano → "Enabled"
   • #summarization-api-for-gemini-nano → "Enabled"
3. Click "Relaunch" button
```

#### Step 2: Install Extension (1 minute)
```bash
1. Open chrome://extensions/
2. Toggle "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select the inbox-triage-extension folder
```

#### Step 3: Wait for AI Models (2-5 minutes)
- Models download automatically (~1.5GB)
- Status shows "AI models downloading..."
- Ready when you see "AI models ready" ✨

### First Use

1. **Go to Gmail** (`mail.google.com`) **or Outlook** (`outlook.live.com`)
2. **Open any email thread**
3. **Click extension icon** in toolbar
4. **Click "Extract Current Thread"**
5. **Watch the magic happen!** ✨

---

### 📖 Need Help?

**Detailed Setup Guide:** See **[SETUP.md](SETUP.md)** for:
- Complete system requirements
- Troubleshooting common issues  
- Custom API key setup (Google Gemini, Anthropic, OpenAI)
- Advanced configuration options
- Feature comparison table

**Quick Links:**
- **Can't enable flags?** → [SETUP.md - Troubleshooting](SETUP.md#-troubleshooting)
- **Models won't download?** → [SETUP.md - Model Download Issues](SETUP.md#problem-ai-model-is-downloading)
- **Want to use external AI services?** → [SETUP.md - Custom API Keys](SETUP.md#alternative-use-custom-api-keys)

### Alternative: Use Custom API Keys

Don't have Chrome 128+ or sufficient resources? No problem!

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey) (recommended), [Anthropic](https://console.anthropic.com/), or [OpenAI](https://platform.openai.com/api-keys)
2. Open extension → Settings (⚙️ button) → "API Settings (Optional)"
3. Check "Use custom API key"
4. Enter your API key and click "Save"

**Note:** Custom API keys work anywhere but send data to external servers. Chrome AI is private and free but requires setup.

---

## Dev Build
No build process required—this extension runs directly from source with no dependencies or compilation step.

## Testing

### Automated Tests
```bash
npm install
npm run test:e2e
```

### Manual Testing Checklist
1. Test on Gmail and Outlook
2. Test context detection (should disable on non-email pages)
3. Test AI model states (available, downloading, unavailable)  
4. Test custom API key integration
5. Test accessibility with keyboard navigation
6. Verify privacy compliance (no unexpected network calls)

## Architecture at a Glance

**Extension Surfaces:**
- **Side Panel** - Main UI for summaries and drafts (`sidepanel/`)
- **Content Scripts** - Extract email content from Gmail/Outlook (`content/`)
- **Service Worker** - AI processing and message coordination (`background/`)
- **Manifest V3** - Extension configuration and permissions

**Core Modules:**
- **Email Extraction** - DOM parsing with provider-specific selectors for threads and attachments
- **Attachment Processing** - Local file analysis (PDF, DOCX, XLSX, images) with on-device parsing
- **AI Summarization** - Chrome's Summarizer API for TL;DR, key points, and attachment content
- **Draft Generation** - Prompt API with JSON schema for structured replies  
- **Tone Controls** - User-selectable tone parameters (neutral, friendly, assertive, formal)
- **Processing Mode Settings** - User configuration for on-device vs hybrid processing with privacy controls

**Message Flow:** Content Script → Service Worker → AI APIs → Side Panel UI

*For detailed architecture, see [SPEC.md](SPEC.md).*

## Privacy Guarantees

**Primary Mode - On-Device Only:** All processing happens locally using Chrome's built-in AI APIs. No data is transmitted to external servers, APIs, or services.

**Hybrid Mode Privacy Controls:** When hybrid mode is enabled, the extension follows strict privacy rules:
- **Only extracted email text** may be sent to cloud services—never attachments, images, or files
- **Clear user indicators** show when cloud processing occurs with opt-out controls
- **Minimal data transmission** limited to essential content only when local processing fails
- **Graceful degradation** ensures functionality even if cloud services are unavailable

**Detailed Privacy Protections:**

**On-Device Only:** Email content and attachments never leave your device. AI models and file processing libraries run entirely within Chrome's sandbox.

**Voice Privacy:** Voice dictation uses the browser's built-in Web Speech API for on-device transcription. Audio is not transmitted to external servers.

**Attachment Privacy:** PDF, DOCX, XLSX, and image files are processed locally using on-device parsing libraries. No attachment content is ever uploaded or transmitted, even in hybrid mode.

**No Data Collection:** The extension does not collect, store, or transmit any user data, email content, attachment content, voice recordings, or usage analytics.

**User Control:** Processing mode is fully user-controlled with persistent settings and clear privacy notices explaining data handling.

**Open Source:** All code is transparent and auditable in this public repository.

## Contributing Flow

**For AI Agents and Human Contributors:**

1. **Read SPEC.md first** - Understand complete requirements and constraints
2. **Review AGENTS.md** - Follow development principles and workflow
3. **Check TODO.md** - Pick or create tasks, track progress  
4. **Open/assign tasks** - Create issues or assign yourself to existing ones
5. **Submit focused PRs** - Small, incremental changes with tests
6. **Update docs** - Keep TODO.md and relevant docs current

**Key Principles:**
- Privacy-first: On-device AI only, no external network calls
- Manifest V3: Modern Chrome extension architecture
- Accessibility: Keyboard navigation and screen reader support
- Minimal dependencies: Avoid third-party frameworks

*For detailed development guidelines, see [AGENTS.md](AGENTS.md).*

## Project Structure

```
inbox-triage-extension/
├── manifest.json              # Chrome extension manifest (Manifest V3)
├── assets/
│   └── icons/                # Extension icons (16px, 48px, 128px)
├── background/
│   └── service_worker.js     # Background service worker for AI processing and attachment handling
├── content/
│   ├── content.js            # Content script for email and attachment extraction
│   └── selectors.js          # CSS selectors for Gmail and Outlook (including attachments)
├── sidepanel/
│   ├── sidepanel.html        # Side panel UI with attachment display
│   └── sidepanel.js          # Side panel JavaScript with attachment processing
├── SPEC.md                   # Detailed project specifications
├── AGENTS.md                 # Development guidelines for contributors
├── TODO.md                   # Task tracking and progress
└── README.md                 # This file
```

## License

This project is part of the Chrome Built-in AI Challenge.

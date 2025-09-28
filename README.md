# Inbox Triage Extension

**Triage your inbox with AI-powered email summaries and reply drafts—all processed locally for complete privacy.**

This Chrome extension transforms email overwhelm into actionable insights by instantly summarizing email threads and generating three tailored reply drafts. Built entirely on Chrome's on-device AI APIs with zero server dependencies.

## Value Proposition

- **Save Time**: Get instant TL;DR summaries and key points from lengthy email threads
- **Stay Responsive**: Generate professional reply drafts in multiple tones and lengths
- **Protect Privacy**: All processing happens locally—no data leaves your device
- **Work Offline**: Fully functional once AI models are downloaded

## Documentation Map

Start here to understand the project and contribute effectively:

- **[SPEC.md](SPEC.md)** - Complete functional and technical requirements
- **[AGENTS.md](AGENTS.md)** - Development guidelines for AI coding agents and contributors  
- **[TODO.md](TODO.md)** - Project tasks and progress tracking
- **[.github/copilot-instructions.md](.github/copilot-instructions.md)** - GitHub Copilot configuration and rules

## Quickstart

### Prerequisites
- **Chrome 120+** with Manifest V3 support
- **Gmail or Outlook** account access in Chrome
- **Chrome AI features enabled** (flags configuration required)

### Install
1. Clone this repository:
   ```bash
   git clone https://github.com/mitchellfyi/inbox-triage-extension.git
   cd inbox-triage-extension
   ```

2. Enable Chrome AI features:
   - Navigate to `chrome://flags/`
   - Enable these flags:
     - `#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
     - `#prompt-api-for-gemini-nano` → Enabled
     - `#summarization-api-for-gemini-nano` → Enabled
   - Restart Chrome

3. Load the extension:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

### Dev Build
No build process required—this extension runs directly from source with no dependencies or compilation step.

### Run
1. Navigate to Gmail or Outlook in Chrome
2. Open an email thread
3. Click the extension icon to open the side panel
4. Click "Extract Current Thread" to analyze
5. Select tone and "Generate Drafts" for reply options

### Test
Unit and integration testing framework to be established. Currently manual testing only:
1. Test across different email formats and thread lengths
2. Test AI model states (available, downloading, unavailable)  
3. Test accessibility with keyboard navigation and screen readers
4. Verify privacy compliance (no external network calls)

AI models download automatically on first use (may take a few minutes).

## Architecture at a Glance

**Extension Surfaces:**
- **Side Panel** - Main UI for summaries and drafts (`sidepanel/`)
- **Content Scripts** - Extract email content from Gmail/Outlook (`content/`)
- **Service Worker** - AI processing and message coordination (`background/`)
- **Manifest V3** - Extension configuration and permissions

**Core Modules:**
- **Email Extraction** - DOM parsing with provider-specific selectors
- **AI Summarization** - Chrome's Summarizer API for TL;DR and key points
- **Draft Generation** - Prompt API with JSON schema for structured replies  
- **Tone Controls** - User-selectable tone parameters (neutral, friendly, assertive, formal)

**Message Flow:** Content Script → Service Worker → AI APIs → Side Panel UI

*For detailed architecture, see [SPEC.md](SPEC.md).*

## Privacy Guarantees

**Zero External Calls:** All processing happens locally using Chrome's built-in AI APIs. No data is transmitted to external servers, APIs, or services.

**On-Device Only:** Email content never leaves your device. AI models run entirely within Chrome's sandbox.

**No Data Collection:** The extension does not collect, store, or transmit any user data, email content, or usage analytics.

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
│   └── service_worker.js     # Background service worker for AI processing
├── content/
│   ├── content.js            # Content script for email extraction
│   └── selectors.js          # CSS selectors for Gmail and Outlook
├── sidepanel/
│   ├── sidepanel.html        # Side panel UI
│   └── sidepanel.js          # Side panel JavaScript logic
├── SPEC.md                   # Detailed project specifications
├── AGENTS.md                 # Development guidelines for contributors
├── TODO.md                   # Task tracking and progress
└── README.md                 # This file
```

## License

This project is part of the Chrome Built-in AI Challenge.

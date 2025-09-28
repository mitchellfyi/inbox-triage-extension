# Inbox Triage Extension

A Chrome extension that uses on-device AI to summarize email threads and generate reply drafts for Gmail and Outlook, ensuring complete privacy with zero server dependencies.

## Features

- **Email Thread Extraction**: Automatically extracts content from Gmail and Outlook email threads
- **AI-Powered Summarization**: Uses Chrome's built-in Summarizer API to generate concise TL;DR summaries and key points
- **Reply Draft Generation**: Creates three different reply options (quick, detailed, action-oriented) using the Prompt API
- **Tone Selection**: Choose from neutral, friendly, assertive, or formal tones for reply generation
- **Privacy First**: All processing happens locally on-device - no data is sent to external servers
- **Side Panel Interface**: Clean, accessible UI within Chrome's side panel

## Project Structure

```
inbox-triage-extension/
├── manifest.json              # Chrome extension manifest (Manifest V3)
├── assets/
│   └── icons/                # Extension icons (16px, 48px, 128px)
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── background/
│   └── service_worker.js     # Background service worker for AI processing
├── content/
│   ├── content.js            # Content script for email extraction
│   └── selectors.js          # CSS selectors for Gmail and Outlook
├── sidepanel/
│   ├── sidepanel.html        # Side panel UI
│   └── sidepanel.js          # Side panel JavaScript logic
├── SPEC.md                   # Detailed project specifications
└── README.md                 # This file
```

## Installation

### Development Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/mitchellfyi/inbox-triage-extension.git
   cd inbox-triage-extension
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the project directory
   - The extension should now appear in your extensions list

3. Enable Chrome AI features (required):
   - Navigate to `chrome://flags/`
   - Enable the following flags:
     - `#optimization-guide-on-device-model` → Enabled BypassPerfRequirement
     - `#prompt-api-for-gemini-nano` → Enabled
     - `#summarization-api-for-gemini-nano` → Enabled
   - Restart Chrome after enabling these flags

### Using the Extension

1. Navigate to Gmail or Outlook in Chrome
2. Open an email thread you want to analyze
3. Click the extension icon in the toolbar to open the side panel
4. Click "Extract Current Thread" to analyze the email
5. View the generated summary and key points
6. Select a tone and click "Generate Drafts" to create reply options
7. Copy any draft to your clipboard for use

## Requirements

- Chrome 120+ with AI features enabled
- Active Gmail or Outlook email thread
- On-device AI models (will be downloaded automatically when first used)

## Technical Details

- **Manifest V3**: Uses the latest Chrome extension format
- **Side Panel API**: Provides persistent UI alongside email interfaces
- **Built-in AI APIs**: Leverages Chrome's Summarizer and Prompt APIs
- **Content Scripts**: Extract email content from Gmail and Outlook DOM
- **Privacy Focused**: No external API calls or data transmission

## Development

The extension is structured with clear separation of concerns:

- `content/`: Handles email extraction from web pages
- `sidepanel/`: Manages user interface and interactions  
- `background/`: Processes AI requests and coordinates communication
- `assets/`: Static resources like icons

All AI processing happens locally using Chrome's built-in language models, ensuring user privacy and enabling offline functionality once models are downloaded.

## Contributing

Please see [SPEC.md](SPEC.md) for detailed technical specifications and requirements.

## License

This project is part of the Chrome Built-in AI Challenge.
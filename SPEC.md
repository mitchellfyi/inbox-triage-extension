# Specifications

## Project Overview

This project builds a Chrome extension for inbox triage that summarises email threads and generates reply drafts using on-device large language model capabilities. The extension will run entirely client-side using the browser's built-in AI APIs to ensure privacy and zero server dependencies.

## Objectives

- Provide a succinct TL;DR and key points for the active email thread in Gmail or Outlook.
- Generate three candidate reply drafts (short answer, medium with clarifications, and polite with next steps) using an on-device model and a JSON schema to structure the output.
- Allow the user to select tone (neutral, friendly, assertive, formal) and regenerate drafts accordingly.
- Offer a simple UI within Chrome's side panel for capturing thread text, displaying summaries, and copying drafts.

## Non-Goals and Constraints

### Non-Goals
- **Multi-provider support** - Only Gmail and Outlook web interfaces
- **Mobile app** - Chrome extension only, no mobile versions
- **Advanced scheduling** - No calendar integration or send-later features
- **Email composition** - No full email editor, only draft generation
- **Thread management** - No archiving, labeling, or organisational features

### Hard Constraints
- **Manifest V3** - Must use modern Chrome extension architecture
- **On-device AI only** - No external API calls or server dependencies  
- **Chrome's built-in AI APIs** - Summarizer API and Prompt API exclusively
- **Privacy-first** - No data collection, transmission, or storage
- **No external dependencies** - No third-party frameworks or libraries
- **Side Panel API** - UI must run in Chrome's side panel interface

## Supported Platforms

### Primary Support
- **Chrome 114+** - Required for Side Panel API support
- **Chrome 120+** - Recommended for stable AI API access
- **Gmail** - Standard web interface (mail.google.com)
- **Outlook** - Web interface (outlook.office.com, outlook.live.com)

### Browser Compatibility
- Chrome desktop (Windows, macOS, Linux)
- Chrome OS support expected but not explicitly tested
- Other Chromium browsers may work but are not officially supported

## API Boundaries and Architecture

### Content Script Layer
- **Purpose**: Extract email thread content from Gmail/Outlook DOM
- **Scope**: Read-only access to current page content
- **Communication**: Message passing to service worker via chrome.runtime
- **Constraints**: No direct AI API access, minimal DOM manipulation

### Service Worker Layer  
- **Purpose**: AI processing coordination and API orchestration
- **Scope**: AI API calls, message routing, data transformation
- **Communication**: Bidirectional messaging with content scripts and side panel
- **Constraints**: No DOM access, limited storage to extension APIs only

### Side Panel Layer
- **Purpose**: User interface and interaction handling
- **Scope**: Display results, capture user preferences, clipboard integration
- **Communication**: Message passing to service worker for AI requests
- **Constraints**: No direct email content access, relies on processed data

## Functional Requirements

### Email Thread Extraction
**Given** a user is viewing an email thread in Gmail or Outlook  
**When** they click "Extract Current Thread" in the side panel  
**Then** the extension should extract all thread content without sending data to external servers  
**And** display the extracted content count or status to the user  

### AI-Powered Summarization  
**Given** an email thread has been successfully extracted  
**When** the user requests a summary  
**Then** the Summarizer API should produce a concise TL;DR (under 100 words)  
**And** generate up to five key points highlighting important information  
**And** display both summary and key points in the side panel  

### Reply Draft Generation
**Given** an email thread has been summarized  
**When** the user selects a tone and clicks "Generate Drafts"  
**Then** the Prompt API should produce exactly three reply drafts  
**And** each draft should contain a subject line and body text  
**And** drafts should follow the pattern: short answer, medium with clarifications, detailed with next steps  
**And** all drafts should reflect the selected tone (neutral, friendly, assertive, formal)  
**And** the output should conform to a predefined JSON schema  

### Tone Selection and Regeneration  
**Given** reply drafts have been generated  
**When** the user changes the tone selector  
**Then** the extension should automatically regenerate all three drafts  
**And** the new drafts should reflect the updated tone while maintaining the same structure  

### Draft Copy Functionality
**Given** reply drafts are displayed in the side panel  
**When** the user clicks the copy button for any draft  
**Then** the full draft text (subject + body) should be copied to the clipboard  
**And** the user should receive visual confirmation of the successful copy  

### AI Model Availability Handling
**Given** the extension is loaded but AI models are not available  
**When** the user attempts to use AI features  
**Then** the extension should detect model unavailability  
**And** inform the user of the current status (downloading, unavailable, etc.)  
**And** provide clear instructions on how to enable Chrome AI features  
**And** gracefully disable AI-dependent UI elements until models are ready

## Technical Requirements

- Manifest V3 Chrome extension using the Side Panel API.
- Content scripts to extract thread text from Gmail and Outlook.
- Use built-in on-device AI tasks (Summarizer, Prompt API) exclusively for summarisation and drafting; avoid external calls.
- JSON schema enforcement to ensure predictable and parseable reply drafts.
- Basic styling and accessible UI; do not rely on third-party UI frameworks; keep file size minimal.
- Code must be well-structured with separate modules for extraction, summarisation, drafting, and UI logic.

## Evaluation Criteria

The project will be judged on:
- **Purpose**: Clarity of problem solved and usefulness for end-users.
- **Functionality**: Working features that demonstrate the capabilities of the built-in AI tasks; the extension must run offline once models are downloaded.
- **User Experience**: Clean and intuitive interface within the side panel with clear affordances and responsive behaviour.
- **Technical Execution**: Proper use of the APIs, adherence to best practices for security and privacy, code quality, and robust error handling.

A submission must include a public repository with install instructions, a short video demonstration (under three minutes), and a clear problem–solution narrative.

## Non‑Functional Requirements

- Privacy: All processing must happen locally; do not collect or transmit user data.
- Maintainability: Organise code for readability and future enhancements.
- Accessibility: Ensure UI controls are keyboard accessible and labelled.

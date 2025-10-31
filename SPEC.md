# Specifications

## Project Overview

This project builds a Chrome extension for inbox triage that summarises email threads and generates reply drafts using on-device large language model capabilities. The extension will run entirely client-side using the browser's built-in AI APIs to ensure privacy and zero server dependencies.

## Objectives

- Provide a succinct TL;DR and key points for the active email thread in Gmail or Outlook.
- Generate three candidate reply drafts (short answer, medium with clarifications, and polite with next steps) using an on-device model and a JSON schema to structure the output.
- Allow the user to select tone (neutral, friendly, assertive, formal) and regenerate drafts accordingly.
- Extract and analyse email attachments (PDF, DOCX, XLSX, images) locally using on-device AI capabilities.
- Provide attachment summaries and content analysis without transmitting files externally.
- Offer a simple UI within Chrome's side panel for capturing thread text, displaying summaries, attachment analysis, and copying drafts.

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
**Then** the draft body text should be copied to the clipboard  
**And** the user should receive visual confirmation of the successful copy  
**Note:** Subject line is not copied as it follows standard "Re: [original subject]" format

### Attachment Detection and Analysis
**Given** a user is viewing an email thread containing attachments in Gmail or Outlook  
**When** they extract the thread content  
**Then** the extension should detect and list all attachments with metadata (name, size, type)  
**And** identify which attachments can be processed locally (PDF, DOCX, XLSX, images)  
**And** display attachment cards with appropriate file type indicators  

### Attachment Content Processing  
**Given** processable attachments have been detected  
**When** the system begins attachment analysis  
**Then** image attachments should be analyzed using the Prompt API's multimodal capabilities (via user-triggered UI button)  
**And** PDF, DOCX, XLSX files should be processed entirely on-device using local parsing libraries (planned - see TODO.md)  
**And** extracted content should be summarised using the built-in Summarizer API  
**And** no attachment content should be transmitted to external servers  

### Attachment Summary Display
**Given** attachments have been successfully processed  
**When** the analysis is complete  
**Then** image attachments should display analysis results when user clicks "Analyze Image" button  
**And** document attachments (PDF, DOCX, XLSX) should show placeholder messages until parsing libraries are integrated  
**And** users should be able to click cards to view detailed extracted content (modal implementation planned)  
**And** processing errors should be clearly indicated with helpful messages  

### AI Model Availability Handling
**Given** the extension is loaded but AI models are not available  
**When** the user attempts to use AI features  
**Then** the extension should detect model unavailability  
**And** inform the user of the current status (downloading, unavailable, etc.)  
**And** provide clear instructions on how to enable Chrome AI features  
**And** gracefully disable AI-dependent UI elements until models are ready

### Processing Mode Configuration
**Given** the user opens the side panel  
**When** they view the Processing Settings section  
**Then** they should see radio buttons for "On-device only" and "Hybrid (Allow cloud fallback)" modes  
**And** "On-device only" should be selected by default  
**When** the user selects "Hybrid (Allow cloud fallback)"  
**Then** a privacy notice should appear explaining data transmission implications  
**And** the notice should clarify that cloud fallback is not currently implemented  
**And** their selection should be persisted across browser sessions  
**And** all AI operations should continue using on-device processing only

### Multilingual Translation
**Given** a user has extracted and summarized an email thread  
**When** they select a target language from the language settings dropdown  
**Then** the Translator API should translate the summary to the selected language  
**And** the Translator API should translate the key points to the selected language  
**And** all generated drafts should be translatable to the selected language  
**And** the user can return to original language by selecting "No Translation (Original)"  
**And** language preference should persist across browser sessions  
**And** translations should happen entirely on-device for privacy  
**And** translation should work offline once AI models are downloaded

### Hybrid Fallback Decision Rules
**Given** hybrid mode is enabled and on-device models are unavailable  
**When** AI processing is requested  
**Then** the system should follow these fallback criteria:
- **Model Availability**: If `Summarizer.availability()` or `LanguageModel.availability()` returns `unavailable`, consider cloud fallback
- **Content Size Limits**: If email thread text exceeds 32,000 characters, truncate to essential content before processing
- **Memory Constraints**: If local processing fails due to memory limits, retry with reduced content
- **Token Limits**: Respect on-device model context windows (~4,000 tokens for summarization, ~8,000 for drafting)
- **Attachment Limits**: Files larger than 10MB should show size warning; only text content sent to cloud, never raw files
- **Network Requirements**: Cloud fallback only triggered when local models definitively unavailable, not during download
**And** cloud processing should only send extracted text content, never attachments or raw files
**And** users should see clear indicators when cloud processing is used
**And** processing should gracefully fall back to local extraction if cloud services fail

## Technical Requirements

- Manifest V3 Chrome extension using the Side Panel API.
- Content scripts to extract thread text and attachment metadata from Gmail and Outlook.
- Use built-in on-device AI tasks (Summarizer, Prompt API) exclusively for summarisation, drafting, and attachment analysis; avoid external calls.
- Local file processing libraries (PDF.js, mammoth.js, SheetJS) for attachment content extraction (planned - see TODO.md).
- JSON schema enforcement to ensure predictable and parseable reply drafts.
- Basic styling and accessible UI; do not rely on third-party UI frameworks; keep file size minimal.
- Code must be well-structured with separate modules for extraction, summarisation, drafting, attachment processing, and UI logic.

## Evaluation Criteria

The project will be judged on:
- **Purpose**: Clarity of problem solved and usefulness for end-users.
- **Functionality**: Working features that demonstrate the capabilities of the built-in AI tasks; the extension must run offline once models are downloaded.
- **User Experience**: Clean and intuitive interface within the side panel with clear affordances and responsive behaviour.
- **Technical Execution**: Proper use of the APIs, adherence to best practices for security and privacy, code quality, and robust error handling.

A submission must include a public repository with install instructions, a short video demonstration (under three minutes), and a clear problem–solution narrative.

## Non‑Functional Requirements

- **Privacy**: All processing must happen locally; do not collect or transmit user data. Email content and attachments never leave the user's device.
- **Attachment Privacy**: File processing (PDF, DOCX, XLSX, images) must occur entirely on-device using local parsing libraries. No attachment content should be sent to external services.
- **Processing Mode Configuration**: Users can select between "On-device only" (default) and "Hybrid (Allow cloud fallback)" modes. The hybrid mode displays privacy notices but currently maintains on-device processing only to preserve privacy guarantees.
- **Hybrid Fallback Privacy**: When hybrid mode is enabled and cloud fallback occurs, only extracted email text content may be transmitted—never attachments, images, or raw files. Cloud processing is limited to text summarization and reply generation only.
- **User Control**: Users must have explicit control over hybrid mode via settings toggle and clear understanding of when cloud processing is used through in-panel indicators.
- **Maintainability**: Organise code for readability and future enhancements.
- **Accessibility**: Ensure UI controls are keyboard accessible and labelled.
- **Performance**: Attachment processing should not block the UI and should handle large files gracefully with appropriate size limits.

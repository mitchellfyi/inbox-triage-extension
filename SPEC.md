# Specifications

## Project Overview

This project builds a Chrome extension for inbox triage that summarises email threads and generates reply drafts using on-device large language model capabilities. The extension will run entirely client-side using the browser's built-in AI APIs to ensure privacy and zero server dependencies.

## Objectives

- Provide a succinct TL;DR and key points for the active email thread in Gmail or Outlook.
- Generate three candidate reply drafts (short answer, medium with clarifications, and polite with next steps) using an on-device model and a JSON schema to structure the output.
- Allow the user to select tone (neutral, friendly, assertive, formal) and regenerate drafts accordingly.
- Offer a simple UI within Chrome's side panel for capturing thread text, displaying summaries, and copying drafts.

## Functional Requirements

1. The extension must extract text content from the currently active email thread in Gmail and Outlook without sending data to a server.
2. Use the Summarizer API to produce a concise TL;DR and up to five key points from the thread.
3. Use the Prompt API's language model with a JSON schema to produce exactly three reply drafts, each containing a subject and body, within defined word limits and tone parameter.
4. Provide a tone selector in the side panel that triggers regeneration of drafts when changed.
5. Provide a copy button that copies the chosen draft into the clipboard.
6. Detect and handle cases where the on-device model is downloading or unavailable; inform the user and suggest steps to enable it.

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

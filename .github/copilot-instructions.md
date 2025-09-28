# Copilot Instructions for inbox-triage-extension

**Always read SPEC.md and AGENTS.md first before making any code changes.** These documents contain complete requirements, constraints, and development guidelines that must be followed.

## Project Overview

This is a Chrome extension for inbox triage that summarizes email threads and generates reply drafts using on-device AI capabilities. The extension runs entirely client-side with Chrome's built-in AI APIs to ensure privacy and zero server dependencies.

## Key Architecture Principles

### Privacy-First Design
- All processing happens locally using Chrome's built-in AI APIs
- Never collect, store, or transmit user data to external servers
- Use only on-device models (Summarizer API, Prompt API)

### Chrome Extension Constraints
- **Manifest V3** - Use modern extension architecture
- **Side Panel API** - UI runs in Chrome's side panel
- **Content Scripts** - Extract email content from Gmail and Outlook
- **No external dependencies** - Keep bundle size minimal, avoid third-party frameworks

## Core Features & APIs

### Email Processing
- Extract text from active email threads in Gmail and Outlook
- Use content scripts to safely access page content
- Handle different email client DOM structures

### AI Integration
- **Summarizer API**: Generate TL;DR and key points (up to 5)
- **Prompt API**: Generate 3 reply drafts with JSON schema enforcement
- **Tone Support**: neutral, friendly, assertive, formal
- **Error Handling**: Detect model availability and download status

### Reply Draft Structure
Each draft should include:
- Subject line
- Body content
- Different lengths: short answer, medium with clarifications, polite with next steps
- Respect word limits and tone parameters

## Technical Guidelines

### Code Organization
Structure code with separate modules:
- `extraction/` - Content scripts for Gmail/Outlook
- `summarization/` - Summarizer API integration
- `drafting/` - Prompt API and reply generation
- `ui/` - Side panel interface logic

### JSON Schema Usage
- Enforce predictable, parseable output from Prompt API
- Structure reply drafts consistently
- Handle schema validation errors gracefully

### Accessibility Requirements
- Ensure UI controls are keyboard accessible
- Provide proper ARIA labels
- Support screen readers
- Test with accessibility tools

### Error Handling
- Detect when on-device models are downloading or unavailable
- Provide clear user feedback and suggested actions
- Handle API rate limits and failures gracefully
- Test offline functionality

## Development Best Practices

### Privacy & Security
- Never use external APIs or services
- Validate all user inputs
- Follow Chrome extension security best practices
- Regular security audits of content scripts

### Performance
- Minimize memory usage in content scripts
- Optimize for fast email thread extraction
- Cache model responses when appropriate
- Handle large email threads efficiently

### Testing Strategy
- Test with various email formats and lengths
- Validate across Gmail and Outlook interfaces
- Test with different model availability states
- Accessibility testing required

## Common Patterns

### Model Availability Check
```javascript
// Always check model availability before use
const canSummarize = await window.ai?.summarizer?.capabilities();
if (canSummarize?.available !== 'readily') {
  // Handle download or unavailable state
}
```

### JSON Schema for Replies
```javascript
const replySchema = {
  type: "object",
  properties: {
    drafts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" },
          length: { enum: ["short", "medium", "detailed"] }
        }
      }
    }
  }
};
```

### Content Script Safety
- Use MutationObserver for DOM changes
- Implement proper cleanup on page navigation
- Handle single-page app routing in Gmail/Outlook

## File Structure Expectations

```
/
├── manifest.json           # Extension manifest (V3)
├── src/
│   ├── content/           # Content scripts
│   │   ├── gmail.js
│   │   └── outlook.js
│   ├── sidepanel/         # Side panel UI
│   │   ├── index.html
│   │   ├── script.js
│   │   └── styles.css
│   ├── background/        # Service worker
│   │   └── service-worker.js
│   └── lib/              # Shared utilities
│       ├── summarizer.js
│       ├── drafter.js
│       └── extractor.js
├── SPEC.md               # Project specifications
└── README.md             # Installation & usage
```

## When Contributing

1. **Read SPEC.md and AGENTS.md first** - Understand all requirements, constraints, and guidelines
2. **Never add network calls or new dependencies** - Extension must remain on-device only with zero external dependencies
3. **Keep TODO.md updated after each change** - Track progress and update task status inline with code changes
4. **Follow Given-When-Then acceptance criteria** - Validate changes against SPEC.md requirements
5. **Test offline functionality** - Ensure extension works without internet once AI models are downloaded
6. **Validate privacy compliance** - No external data transmission ever
7. **Check model availability gracefully** - Handle AI API unavailability with user-friendly messages
8. **Test accessibility** - Keyboard navigation and screen reader compatibility required
9. **Use proper commit messages** - Follow type(scope): summary pattern from AGENTS.md
10. **Make surgical changes** - Small, focused modifications that maintain working state

## Resources

Project documentation (use these relative links):
- [SPEC.md](../SPEC.md) - Complete requirements and acceptance criteria
- [AGENTS.md](../AGENTS.md) - Development workflow and coding standards
- [README.md](../README.md) - Overview, quickstart, and architecture
- [TODO.md](../TODO.md) - Current tasks and project progress

## Guardrails

### Privacy Requirements
- All AI processing must happen locally using Chrome's built-in APIs only
- Never collect, store, or transmit user data to external servers
- Email content must never leave the user's device
- No analytics, tracking, or usage data collection

### Performance Requirements
- Minimize memory usage in content scripts
- Keep UI responsive with loading states for AI operations
- Cache results appropriately but don't store personal data
- Handle large email threads efficiently without blocking

### Accessibility Requirements  
- Ensure all UI controls are keyboard accessible
- Provide proper ARIA labels for screen readers
- Support high contrast and font scaling
- Test with accessibility tools before submitting changes

## Common Gotchas

- Chrome AI APIs are experimental - check availability
- Content Security Policy restrictions in Manifest V3
- Side panel API requires Chrome 114+
- Gmail uses dynamic class names - use stable selectors
- Outlook has different DOM structure than Gmail
- Model download can take time - show progress indicators

# Project TODO

This file tracks project-wide tasks and their status. Keep this updated as work progresses.

## How to Use

1. **Pick a task** - Choose from the sections below, focusing on [todo] items
2. **Create branch** - Use descriptive branch names like `feature/gmail-extraction` or `fix/accessibility-labels`
3. **Work incrementally** - Make small, focused changes
4. **Update status** - Move tasks through [todo] → [doing] → [blocked] → [done] as appropriate
5. **Link issues/PRs** - Add GitHub links when available
6. **Open PR** - Submit for review when ready

## Task Status Legend

- `[todo]` - Ready to start
- `[doing]` - Currently in progress (include owner)
- `[blocked]` - Waiting on dependencies or decisions
- `[done]` - Completed

## Documentation

### Core Documentation
- `[done]` README.md overhaul - Add value prop, docs map, quickstart, architecture, privacy, contributing flow
- `[todo]` SPEC.md improvements - Acceptance criteria format, explicit API boundaries, browser support notes
- `[todo]` AGENTS.md refinements - Agent loop, coding rules, commit patterns, "Don't" list  
- `[todo]` .github/copilot-instructions.md updates - "Always read SPEC first", guardrails section
- `[done]` TODO.md creation - This file with project-wide checklist

### GitHub Templates
- `[todo]` PR template - What/Why/How/Tests/Docs sections
- `[todo]` Issue templates - Feature and bug report templates
- `[todo]` CODEOWNERS - Assign reviewers for docs and extension areas

## Extension Core

### Architecture & Configuration
- `[todo]` Manifest V3 validation - Ensure all permissions are minimal and necessary
- `[todo]` Error handling strategy - Standardize error messages and fallback behaviors
- `[done]` Model availability detection - Robust checking for AI API readiness
- `[todo]` Message passing architecture - Clean communication between components

### AI Integration
- `[done]` Summarizer API integration testing - Validate across different thread lengths
- `[done]` Prompt API JSON schema enforcement - Ensure reliable structured output
- `[done]` Tone parameter validation - Test all tone options (neutral, friendly, assertive, formal)
- `[done]` Fallback draft generation - Handle AI failures gracefully

## Gmail Extraction

### DOM Parsing
- `[todo]` Thread container detection - Reliable identification of email threads
- `[todo]` Message boundary detection - Separate individual emails in threads
- `[todo]` Sender extraction - Names and email addresses
- `[todo]` Content cleaning - Remove signatures, quoted text, formatting artifacts
- `[todo]` Subject line extraction - Original and reply subjects
- `[todo]` Timestamp parsing - Message dates and times

### Edge Cases
- `[todo]` Nested thread handling - Complex reply chains
- `[todo]` Draft message filtering - Exclude unsent drafts from analysis
- `[todo]` Dynamic content handling - MutationObserver for SPA updates
- `[todo]` Multiple conversation views - Different Gmail layouts and themes

## Outlook Extraction

### DOM Parsing
- `[todo]` Thread container detection - Outlook-specific selectors
- `[todo]` Message boundary detection - Different DOM structure than Gmail
- `[todo]` Sender extraction - Outlook name/email format
- `[todo]` Content cleaning - Outlook-specific signatures and formatting
- `[todo]` Subject line extraction - Handle Outlook subject formatting
- `[todo]` Timestamp parsing - Outlook date formats

### Edge Cases  
- `[todo]` Multiple Outlook versions - Office 365, Outlook.com variations
- `[todo]` Theme compatibility - Dark mode, high contrast themes
- `[todo]` Accessibility mode handling - Screen reader optimized views
- `[todo]` Mobile view detection - Responsive layout handling

## Reply Drafting

### Content Generation
- `[done]` Three-draft structure - Short, medium, detailed responses
- `[done]` Subject line generation - Context-aware reply subjects
- `[done]` Tone application - Consistent tone across all draft types
- `[done]` Word limit enforcement - Appropriate length for each draft type
- `[todo]` Context preservation - Reference key points from original thread

### Output Quality
- `[done]` JSON schema validation - Ensure parseable structured output
- `[done]` Content sanitization - Remove potentially harmful content
- `[done]` Professional language - Business-appropriate responses
- `[todo]` Customizable signatures - User signature integration options

## Side Panel UI

### Core Interface
- `[done]` Summary display - Clean presentation of TL;DR and key points with color-coded sections
- `[done]` Draft presentation - Professional format for three reply options with proper visual hierarchy
- `[done]` Tone selector - Enhanced dropdown with proper labeling and responsive layout
- `[done]` Copy functionality - Clipboard integration with visual feedback for draft text
- `[done]` Status indicators - Loading states, error messages, success feedback with color coding
- `[done]` Progress feedback - AI model download progress

### Accessibility
- `[done]` Keyboard navigation - Full keyboard accessibility with proper tab order
- `[done]` ARIA labels - Screen reader support with semantic HTML structure
- `[done]` Focus management - Logical tab order with visible focus indicators
- `[done]` High contrast support - Enhanced visibility in accessibility modes
- `[done]` Font size scaling - Responsive design respects browser zoom settings
- `[todo]` Screen reader testing - Validate with assistive technologies

### Responsive Design
- `[done]` Panel width adaptation - Handle different side panel sizes with CSS media queries
- `[done]` Content overflow - Scrolling for long summaries/drafts with max-height constraints
- `[done]` Button sizing - Touch-friendly interaction areas with proper hover states
- `[done]` Text wrapping - Readable text at all sizes with proper line spacing

## Quality Assurance

### Testing Strategy
- `[todo]` Manual test plan - Comprehensive testing checklist
- `[todo]` Email format testing - Various email types and lengths
- `[todo]` AI model state testing - Available, downloading, unavailable scenarios
- `[todo]` Cross-browser compatibility - Chrome versions and variants
- `[todo]` Performance testing - Memory usage, response times
- `[todo]` Privacy audit - Verify no external network calls

### Documentation Testing
- `[todo]` Installation instructions - Verify setup process works
- `[todo]` Link validation - All internal documentation links work
- `[todo]` Code examples - Ensure code snippets are accurate and current

### Release Preparation
- `[todo]` Demo video creation - 3-minute demonstration video
- `[todo]` Public repository preparation - Clean commit history, proper README
- `[todo]` Chrome Web Store submission - Prepare extension for distribution
- `[todo]` Problem-solution narrative - Clear explanation of value proposition

---

## Notes

- Keep tasks focused and granular - each should be completable in a few hours
- Update this file with every significant change or completion
- Link to related GitHub issues and PRs when available
- Add estimated effort or priority labels if helpful
- Archive completed sections to keep the file manageable
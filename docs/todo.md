# Project TODO

This file tracks project-wide tasks and their status. Keep this updated as work progresses.

**Reference**: See [AGENTS.md](../AGENTS.md) for development guidelines

## How to Use

1. **Pick a task** - Choose from the sections below, focusing on [todo] items
2. **Create branch** - Use descriptive branch names like `feature/gmail-extraction` or `fix/accessibility-labels`
3. **Write tests first** - Create failing tests for new functionality before implementing
4. **Work incrementally** - Make small, frequent commits with clear messages
5. **Update status inline** - Move tasks through [todo] → [doing] → [blocked] → [done] as appropriate
6. **Test thoroughly** - Ensure all tests pass cleanly without workarounds
7. **Update docs after features** - Revise [README.md](../README.md), [AGENTS.md](../AGENTS.md), and this file once features are complete
8. **Link issues/PRs** - Add GitHub links when available
9. **Open PR** - Submit for review when ready with comprehensive testing and documentation

## Task Status Legend

- `[todo]` - Ready to start
- `[doing]` - Currently in progress (include owner)
- `[blocked]` - Waiting on dependencies or decisions
- `[done]` - Completed

## Documentation

### Post-Feature Documentation Updates
- `[todo]` [spec.md](./spec.md) improvements - Acceptance criteria format, explicit API boundaries, browser support notes
- `[todo]` [README.md](../README.md) feature integration - Update overview and quickstart sections after each major feature completion
- `[todo]` Link validation sweep - Verify all internal documentation links work correctly
- `[todo]` Code example updates - Ensure all documentation code snippets reflect current implementation

### GitHub Templates
- `[todo]` PR template - What/Why/How/Tests/Docs sections
- `[todo]` Issue templates - Feature and bug report templates
- `[todo]` CODEOWNERS - Assign reviewers for docs and extension areas

## Extension Core

### Enhancement Opportunities
- `[todo]` Nested thread handling - Improve handling of complex reply chains
- `[todo]` Draft message filtering - Exclude unsent drafts from analysis
- `[todo]` Dynamic content handling - MutationObserver for SPA updates
- `[todo]` Multiple conversation views - Different Gmail layouts and themes (dark mode, compact view)
- `[todo]` Outlook version variations - Office 365, Outlook.com differences
- `[todo]` Timestamp parsing improvements - More consistent date/time extraction

## Attachment Processing

### File Processing (Not Yet Implemented)
- `[todo]` PDF text extraction - Integrate PDF.js or equivalent for local PDF parsing
- `[todo]` DOCX text extraction - Integrate mammoth.js or equivalent for Word document parsing
- `[todo]` XLSX data extraction - Integrate SheetJS or equivalent for spreadsheet parsing
- `[done]` ✅ Image analysis - Multimodal Prompt API for image description, OCR, and chart analysis
- `[todo]` Content validation - Ensure extracted content is suitable for AI processing

### Advanced Features
- `[todo]` Detailed view modal - Full content display and comprehensive analysis
- `[todo]` Large file handling - Size limits and progressive processing

## Reply Drafting

### Enhancement Opportunities
- `[todo]` Context preservation - Better reference to key points from original thread
- `[todo]` Customizable signatures - User signature integration options

## Side Panel UI (Complete)

### Enhancement Opportunities
- `[todo]` Screen reader testing - Validate with actual assistive technologies (NVDA, JAWS, VoiceOver)

## Quality Assurance

### Testing Gaps
- `[todo]` Content script tests - Test email extraction logic for Gmail and Outlook
- `[todo]` Cross-component tests - Test message passing and integration between extension parts
- `[todo]` Manual test plan - Comprehensive testing checklist
- `[todo]` Email format testing - Various email types and lengths
- `[todo]` AI model state testing - Available, downloading, unavailable scenarios
- `[todo]` Cross-browser compatibility - Chrome versions and variants
- `[todo]` Performance testing - Memory usage, response times
- `[todo]` Privacy audit - Verify no external network calls (except when using custom API keys)

**Reference**: See [testing.md](./testing.md) for testing guidelines

### Documentation Testing
- `[todo]` Installation instructions verification - Test setup process works from scratch
- `[todo]` Link validation - All internal documentation links work
- `[todo]` Code examples validation - Ensure code snippets are accurate and current

---

## Hackathon Submission Tasks (Chrome Built-in AI Challenge 2025)

**📁 Detailed task files**: See [`/todo`](../todo) directory for comprehensive implementation guides

### Priority Tasks for Submission

#### 🔴 CRITICAL (Must Complete for Competitive Submission)
- `[todo]` [Task 000: Hackathon Submission Checklist](../todo/000_hackathon_submission_checklist.md) - Master checklist (1-2h)
- `[todo]` [Task 006: Demo Video Creation](../todo/006_demo_video_creation.md) - Required deliverable (4-6h)
- `[todo]` [Task 007: README API Showcase](../todo/007_readme_api_showcase.md) - Documentation enhancement (2-3h)

#### 🟡 HIGH PRIORITY (Strong Differentiators)
- `[todo]` [Task 002: Proofreader API Integration](../todo/002_proofreader_api_integration.md) - Grammar checking (2-3h)
- `[todo]` [Task 003: Rewriter API Integration](../todo/003_rewriter_api_integration.md) - Alternative phrasings (3-4h)
- `[todo]` [Task 009: Accessibility Excellence](../todo/009_accessibility_excellence.md) - WCAG 2.1 AA compliance (3-4h)

#### 🟢 MEDIUM PRIORITY (Nice to Have)
- `[todo]` [Task 004: Writer API Integration](../todo/004_writer_api_integration.md) - Content generation (3-4h)
- `[todo]` [Task 008: Performance Metrics Display](../todo/008_performance_metrics_display.md) - Monitoring dashboard (2-3h)
- `[todo]` [Task 010: System Status Dashboard](../todo/010_system_status_dashboard.md) - Health indicators (2-3h)

**Total Effort**: 30-43 hours for complete implementation  
**Minimum Viable**: Tasks 000, 006, 007 = 7-11 hours (Tasks 001 ✅ and 005 ✅ completed)  
**See**: [`/todo/README.md`](../todo/README.md) for detailed timeline and prioritization

---

## Notes

- Keep tasks focused and granular - each should be completable in a few hours
- Update this file with every significant change or completion
- Link to related GitHub issues and PRs when available
- Add estimated effort or priority labels if helpful
- Archive completed sections to keep the file manageable
- **For hackathon tasks**: Follow detailed implementation guides in `/todo` directory

---

## Recently Completed

### Latest Milestones
- ✅ **Multimodal image analysis** - AI-powered image understanding and OCR text extraction using Prompt API
- ✅ **Translator API integration** - Multilingual support for 15+ languages with on-device translation
- ✅ **Modular architecture** - Split large files into focused modules (voice, settings, drafts, translation)
- ✅ Complete side panel UI with accessibility features
- ✅ Voice dictation for guidance input
- ✅ Hybrid processing mode with privacy controls
- ✅ Custom API key configuration (OpenAI, Anthropic, Google)
- ✅ Comprehensive error handling and sanitization
- ✅ Model availability detection with periodic monitoring
- ✅ Attachment detection and basic UI
- ✅ Playwright test infrastructure
- ✅ Processing mode settings with privacy notices
- ✅ Deep-link URL generation with proper encoding
- ✅ **Documentation reorganization** - All docs moved to `/docs` with consistent naming and cross-links

### Next Focus Areas
1. **Hackathon Preparation** - Create demo video and enhance documentation
2. **File Processing** - Complete attachment analysis (PDF, DOCX, XLSX)
3. **Testing Coverage** - Add content script tests and cross-component integration tests
4. **Documentation** - Polish README with API showcase and feature highlights
5. **Release Preparation** - Prepare for Chrome Web Store submission after hackathon


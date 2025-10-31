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

## Extension Core

### Enhancement Opportunities
- `[todo]` Nested thread handling - Improve handling of complex reply chains
- `[todo]` Dynamic content handling - MutationObserver for SPA updates
- `[todo]` Multiple conversation views - Different Gmail layouts and themes (dark mode, compact view)
- `[todo]` Outlook version variations - Office 365, Outlook.com differences
- `[todo]` Timestamp parsing improvements - More consistent date/time extraction

## Attachment Processing

### File Processing
- `[todo]` PDF text extraction - Basic implementation exists but limited success (full PDF.js integration blocked by "no external dependencies" constraint)
- `[todo]` DOCX text extraction - Currently returns placeholder message only; requires mammoth.js library (blocked by "no external dependencies" constraint)
- `[todo]` XLSX data extraction - Currently returns placeholder message only; requires SheetJS library (blocked by "no external dependencies" constraint)
- `[todo]` Full PDF parsing - Integrate PDF.js when dependency constraints allow (see background/attachment-service.js for implementation notes)
- `[todo]` Full DOCX parsing - Integrate mammoth.js when dependency constraints allow (see background/attachment-service.js for implementation notes)
- `[todo]` Full XLSX parsing - Integrate SheetJS when dependency constraints allow (see background/attachment-service.js for implementation notes)

**Note:** Basic PDF extraction attempts exist but DOCX/XLSX are currently placeholders only. File fetching and content validation are implemented.

### Advanced Features
- `[todo]` Large file handling - Size limits and progressive processing

## Reply Drafting

### Enhancement Opportunities
- `[todo]` Context preservation - Better reference to key points from original thread
- `[todo]` Customizable signatures - User signature integration options

## Side Panel UI (Complete)

### Enhancement Opportunities
- `[todo]` Screen reader testing - Validate with actual assistive technologies (NVDA, JAWS, VoiceOver) (ARIA labels and keyboard navigation implemented, but not tested with actual screen readers)

## Quality Assurance

### Testing Gaps
- `[todo]` Manual test plan - Comprehensive testing checklist
- `[todo]` Email format testing - Various email types and lengths
- `[todo]` AI model state testing - Available, downloading, unavailable scenarios
- `[todo]` Cross-browser compatibility - Chrome versions and variants
- `[todo]` Performance testing - Memory usage, response times
- `[todo]` Privacy audit - Verify no external network calls (except when using custom API keys)

**Reference**: See [testing.md](./testing.md) for testing guidelines

### Documentation Testing
- `[todo]` Installation instructions verification - Test setup process works from scratch
- `[todo]` Link validation sweep - Comprehensive verification of all internal documentation links (partially done - broken links fixed)
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

**See**: [`/todo/README.md`](../todo/README.md) for detailed timeline and prioritization

---

## Notes

- Keep tasks focused and granular - each should be completable in a few hours
- Update this file with every significant change or completion
- Link to related GitHub issues and PRs when available
- Add estimated effort or priority labels if helpful
- Archive completed sections to keep the file manageable
- **For hackathon tasks**: Follow detailed implementation guides in `/todo` directory

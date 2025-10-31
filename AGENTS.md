# Agent Development Guide

This document serves as a guide for AI coding agents working on the Inbox Triage Extension. Its purpose is to ensure that agents understand where to find requirements and how to approach development in a consistent, maintainable way.

**Reference**: See [README.md](./README.md) for project overview

## Where to start

**Required Reading Order:**
1. **Read [docs/spec.md](./docs/spec.md) first** - Complete functional and technical requirements, constraints, and acceptance criteria
2. **Review [README.md](./README.md)** - High-level overview, quickstart, architecture, and contributing flow
3. **Check [docs/todo.md](./docs/todo.md)** - Current tasks, priorities, and project progress tracking

**Never begin coding until you understand the complete requirement scope and constraints.**

## Agent Development Loop

**The disciplined agent follows this cycle:**

1. **READ** - Study [docs/spec.md](./docs/spec.md) requirements and existing code before making changes
2. **PLAN** - Create focused, minimal-change plan addressing specific requirements
3. **IMPLEMENT** - Make surgical code changes, following coding rules below
4. **TEST** - Validate changes work as expected and don't break existing functionality  
5. **DOCUMENT** - Update [docs/todo.md](./docs/todo.md) status, commit with proper messages, update related docs

**Key Success Factors:**
- Small, incremental PRs (not monolithic changes)
- Always validate against acceptance criteria in [docs/spec.md](./docs/spec.md)
- Maintain working state after every change
- Update documentation inline with code changes

## Commit Early and Often

**Follow these commit practices to maintain clean, reviewable history:**

### Frequency Guidelines
- **Commit after each logical unit of work** - Don't wait until a feature is completely finished
- **Commit working code daily** - Even if the feature isn't complete, commit progress that compiles and doesn't break existing functionality
- **Create checkpoint commits** - Save progress before attempting risky refactors or major changes
- **Commit before switching contexts** - Always commit current work before switching to a different task or feature

### Commit Message Quality
- **Use descriptive, specific messages** - "Fix button styling" not "Fix bug"
- **Explain the why, not just the what** - Include context for future maintainers
- **Reference issues and requirements** - Link to [docs/spec.md](./docs/spec.md) acceptance criteria when relevant
- **Follow the established patterns** - Use type(scope): format consistently

### Atomic Commits
- **One logical change per commit** - Don't mix refactoring with new features
- **Complete, working changes** - Each commit should leave the code in a working state
- **Self-contained updates** - Commits should be understandable without external context
- **Reviewable size** - Keep commits small enough for thorough code review

## Testing Requirements

**All new features and changes must include comprehensive testing:**

**Reference**: See [docs/testing.md](./docs/testing.md) for detailed testing guidelines

### End-to-End Testing with Playwright
- **Run tests locally before pushing** - Execute `npm run test:e2e` before committing changes
- **Use test:e2e before opening PRs** - Ensure all Playwright tests pass in your development environment
- **Prefer Playwright locators over brittle selectors** - Use `getByRole`, `getByLabelText`, and semantic selectors
- **When editing popup/panel markup, update tests and snapshots** - Keep tests synchronized with UI changes
- **Test extension installation and loading** - Verify extension functionality in realistic browser environment

### Unit Testing
- **Write tests first when possible** - Follow TDD practices for core functionality
- **Test all public APIs** - Cover every function, method, and interface exposed by your modules
- **Test edge cases** - Include boundary conditions, error states, and unexpected inputs
- **Maintain test coverage** - Don't reduce existing coverage with new changes

### Integration Testing
- **Test component interactions** - Verify that modules work correctly together
- **Test AI API integrations** - Mock and test Summarizer API and Prompt API usage
- **Test user workflows** - End-to-end testing of complete user scenarios
- **Test error handling** - Verify graceful degradation when dependencies fail

### Testing Standards
- **Tests must pass without workarounds** - Don't skip failing tests or use temporary fixes
- **No hacks or temporary solutions** - If tests don't pass cleanly, fix the underlying issue
- **Test in isolation** - Each test should be independent and repeatable
- **Clear test descriptions** - Test names should describe the expected behavior
- **Commit early, run tests locally before pushing** - Validate changes in development environment

### Manual Testing Requirements
- **Test across target browsers** - Chrome versions and variants as specified in [docs/spec.md](./docs/spec.md)
- **Test AI model states** - Available, downloading, and unavailable scenarios
- **Test accessibility** - Keyboard navigation and screen reader compatibility
- **Test privacy compliance** - Verify no external network calls or data leakage

## Documentation Maintenance

**Keep documentation current and accurate throughout development:**

### During Development
- **Update [docs/todo.md](./docs/todo.md) inline** - Mark progress as [doing] → [done] while working
- **Document new APIs** - Add JSDoc comments for new functions and classes
- **Update technical decisions** - Record architectural choices and rationale
- **Note known limitations** - Document temporary constraints or future improvements needed

### After Feature Completion
- **Update [README.md](./README.md)** - Reflect new capabilities in the overview and quickstart sections
- **Review [AGENTS.md](./AGENTS.md)** - Add new patterns, update coding rules, revise workflows if needed
- **Update [docs/spec.md](./docs/spec.md)** - Ensure acceptance criteria match implemented behavior
- **Revise [docs/todo.md](./docs/todo.md)** - Archive completed tasks, add follow-up work, reorganize sections

### Documentation Quality Standards
- **Accuracy first** - Ensure all code examples work and all links are valid
- **User-focused content** - Write from the perspective of someone new to the project
- **Consistent formatting** - Follow established markdown conventions and link patterns
- **Complete information** - Don't leave gaps that require external knowledge to fill

## Coding Rules

### Directory Structure and Organization
```
/
├── background/          # Service worker - AI coordination only
├── content/            # Content scripts - DOM extraction only  
├── sidepanel/          # UI layer - display and interaction only
├── assets/             # Static resources - icons, etc.
├── manifest.json       # Extension config - minimal permissions
├── AGENTS.md           # This file - development guidelines
└── docs/               # All other documentation
    ├── spec.md         # Technical specifications
    ├── todo.md         # Task tracking
    ├── setup.md        # User setup guide
    └── README.md       # Documentation index
```

### Naming Conventions
- **Files**: `kebab-case.js` (e.g., `email-extractor.js`)
- **Classes**: `PascalCase` (e.g., `InboxTriageServiceWorker`)
- **Functions**: `camelCase` (e.g., `extractEmailThread`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_SUMMARY_LENGTH`)
- **CSS classes**: `kebab-case` (e.g., `.draft-container`)

### Error Handling Strategy
- **Check AI API availability** before using (models may be downloading)
- **Provide user-friendly messages** for all error states
- **Implement graceful fallbacks** when AI features are unavailable
- **Log technical details** to console for debugging
- **Never crash silently** - always inform the user of issues

**Reference**: See `utils/error-handler.js` for centralized error sanitization

### Accessibility Requirements
- **Keyboard navigation**: All interactive elements must be keyboard accessible
- **ARIA labels**: Provide descriptive labels for screen readers  
- **Focus management**: Logical tab order and visible focus indicators
- **High contrast**: UI must work in high contrast mode
- **Font scaling**: Respect browser zoom and font size settings

### Performance Guidelines  
- **Minimize DOM queries**: Cache selectors, use event delegation
- **Avoid blocking operations**: Use async/await for API calls
- **Memory management**: Clean up event listeners and observers
- **Efficient messaging**: Batch message passing between components
- **Response times**: Keep UI responsive, show loading states with animated indicators
- **State persistence**: Use `chrome.storage.local` for saving/restoring user work (thread, summary, drafts)

## Commit Message Patterns

Use this format for all commits:
```
type(scope): summary of changes

Optional body explaining why the change was needed
and any important implementation details.

Closes #issue-number
```

**Types:**
- `feat(scope)`: New feature implementation
- `fix(scope)`: Bug fix
- `docs(scope)`: Documentation changes only  
- `refactor(scope)`: Code restructuring without functional changes
- `test(scope)`: Test additions or updates
- `chore(scope)`: Build, tooling, or maintenance tasks

**Scopes:**
- `extraction`: Content script changes for Gmail/Outlook
- `ai`: Service worker AI integration
- `ui`: Side panel interface
- `manifest`: Extension configuration  
- `docs`: Documentation updates

**Examples:**
- `feat(ai): add tone parameter support for reply drafts`
- `fix(extraction): handle nested Gmail thread structures`
- `docs(spec): add acceptance criteria for summarization feature`
- `refactor(ui): extract draft rendering into separate function`

## Development principles

- **Follow MV3 best practices**: Use Manifest V3 for extension architecture. Keep content scripts, background scripts, and UI code separate.
- **On‑device AI only**: All AI processing must happen locally via Chrome's built‑in APIs (Summarizer, Prompt, Translator, etc.). Do not introduce external API calls or server dependencies.
- **Maintainability**: Write clean, modular code. Use descriptive function and variable names. Keep side effects contained and avoid global state.
- **Performance**: Optimise DOM queries and avoid expensive operations in loops. Keep response times quick for a smooth user experience.
- **Error handling**: Always check availability of built‑in APIs. Provide user‑friendly error messages and fallback behaviour if models are unavailable or still downloading.
- **Security and privacy**: Respect user privacy by never sending data off device. Request only the minimum permissions needed in the manifest.
- **Hybrid fallback privacy**: When implementing cloud fallback features, ensure only extracted email text is transmitted—never attachments, images, or raw files. Provide clear user indicators when cloud processing occurs.
- **British English**: When generating user‑visible text (e.g., labels, descriptions), use British English.

## Hybrid Fallback Decision Rules

**When implementing cloud fallback logic, follow these documented rules from [docs/spec.md](./docs/spec.md):**

### Model Availability Checks
- Use `Summarizer.availability()` and `LanguageModel.availability()` to determine local model status
- Never fallback during model download (`after-download` state) - wait for completion
- Only consider fallback when availability is `unavailable` or `no`

### Content Size Limits
- **Email text**: Maximum 32,000 characters for on-device processing
- **Token limits**: ~4,000 tokens for summarization, ~8,000 tokens for drafting
- **Memory constraints**: Implement graceful degradation for large content

### Privacy Requirements for Cloud Fallback
- **Send only**: Extracted email text content and basic metadata
- **Never send**: Attachments, images, files, personal identifiers, or voice recordings
- **User control**: Clear indicators when cloud processing occurs, opt-out available
- **Graceful fallback**: If cloud services fail, fall back to local extraction methods

### Implementation Pattern
```javascript
// Check fallback decision using documented rules
const fallbackDecision = this.shouldUseCloudFallback(operation, processingMode, thread);
if (fallbackDecision.shouldFallback && processingMode === 'hybrid') {
    // Prepare sanitized content for cloud processing
    const cloudContent = this.prepareContentForCloudProcessing(thread);
    // Show user indicator
    this.addProcessingIndicator(operation, true);
    // Implement cloud processing here
}
```

## Recent Feature Additions

The following features have been recently added and should be tested when making changes:

### State Persistence (`sidepanel/sidepanel.js`)
- **`saveState()`**: Automatically saves thread, summary, and drafts to `chrome.storage.local`
- **`restoreState()`**: Restores saved state when returning to same thread URL
- **`urlsMatch()`**: Handles Gmail/Outlook URL variations for state matching
- **Triggered**: After thread extraction, summary generation, draft creation
- **Test**: `tests/state-persistence.spec.ts`

### Draft Creation in Email Client (`sidepanel/draft-renderer.js`, `content/content.js`)
- **`createDraftInEmailUI()`**: Creates drafts directly in Gmail/Outlook compose window
- **`createDraft` message handler**: Content script handles draft insertion
- **`createGmailDraft()` / `createOutlookDraft()`**: Provider-specific implementations
- **Test**: `tests/state-persistence.spec.ts` - "create draft button appears on each draft"

### Loading Indicators (`sidepanel/display-manager.js`, `sidepanel/sidepanel.html`)
- **`createLoadingIndicator()`**: Smart indicator selection (spinner vs dots)
- **CSS animations**: Shimmer, progress bar, spinner, pulsing dots
- **Button loading states**: Animated gradients and spinners for disabled buttons
- **Test**: `tests/state-persistence.spec.ts` - Loading indicator tests

## Critical "Don't" List

**Never do these things - they violate core project constraints:**

- ❌ **Add external dependencies** - No npm packages, CDN imports, or third-party libraries
- ❌ **Make network calls** - No fetch(), XMLHttpRequest, or external API calls of any kind (except when using custom API keys)
- ❌ **Store user data** - No localStorage or IndexedDB (use chrome.storage.local for state persistence only, per requirements)
- ❌ **Add new permissions** - Only request minimal permissions needed for current functionality
- ❌ **Create inaccessible UI** - All controls must be keyboard accessible with proper ARIA labels
- ❌ **Use global state** - Avoid shared mutable state between extension components (use instance properties)
- ❌ **Ignore error states** - Always handle AI model unavailability and provide user feedback
- ❌ **Break privacy guarantees** - Email content must never leave the user's device (default mode)
- ❌ **Skip documentation** - Update [docs/todo.md](./docs/todo.md) and relevant docs with every change
- ❌ **Submit untested code** - All features must have passing tests without workarounds
- ❌ **Make monolithic commits** - Keep commits small, focused, and logically separated
- ❌ **Leave broken builds** - Every commit should maintain a working, testable state

## Workflow

1. **Pick a task** from [docs/todo.md](./docs/todo.md) or the issue tracker, update status to `[doing]`
2. **Review requirements** in [docs/spec.md](./docs/spec.md) and study existing code patterns
3. **Create feature branch** with descriptive name following `type/brief-description` format
4. **Write tests first** for new functionality, ensuring they initially fail
5. **Implement incrementally** making small commits as you progress
6. **Run tests frequently** ensuring they pass without workarounds or hacks  
7. **Update docs inline** as you add new functionality or change behavior
8. **Test manually** across browsers, AI states, and accessibility requirements
9. **Final doc review** - Update [README.md](./README.md), [AGENTS.md](./AGENTS.md), and [docs/todo.md](./docs/todo.md) to reflect completed work
10. **Open pull request** with comprehensive description following PR template
11. **Mark task complete** in [docs/todo.md](./docs/todo.md) and link to the merged PR

**Quality Gates Before PR:**
- ✅ All tests pass cleanly without skipped or failing tests
- ✅ Manual testing completed for core user workflows  
- ✅ Documentation updated to reflect new functionality
- ✅ Code follows established patterns and style guidelines
- ✅ Accessibility requirements met (keyboard navigation, ARIA labels)
- ✅ Privacy compliance verified (no external network calls)

**Reference**: See [docs/chrome-ai-api-compliance.md](./docs/chrome-ai-api-compliance.md) for API implementation details

By adhering to this guide, agents will produce consistent, high‑quality contributions that align with the project's goals and constraints.


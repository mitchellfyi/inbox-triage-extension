# Agent Development Guide

This document serves as a guide for AI coding agents working on the Inbox Triage Extension. Its purpose is to ensure that agents understand where to find requirements and how to approach development in a consistent, maintainable way.

## Where to start

**Required Reading Order:**
1. **Read SPEC.md first** - Complete functional and technical requirements, constraints, and acceptance criteria
2. **Review README.md** - High-level overview, quickstart, architecture, and contributing flow
3. **Check TODO.md** - Current tasks, priorities, and project progress tracking

**Never begin coding until you understand the complete requirement scope and constraints.**

## Agent Development Loop

**The disciplined agent follows this cycle:**

1. **READ** - Study SPEC.md requirements and existing code before making changes
2. **PLAN** - Create focused, minimal-change plan addressing specific requirements
3. **IMPLEMENT** - Make surgical code changes, following coding rules below
4. **TEST** - Validate changes work as expected and don't break existing functionality  
5. **DOCUMENT** - Update TODO.md status, commit with proper messages, update related docs

**Key Success Factors:**
- Small, incremental PRs (not monolithic changes)
- Always validate against acceptance criteria in SPEC.md
- Maintain working state after every change
- Update documentation inline with code changes

## Coding Rules

### Directory Structure and Organization
```
/
├── background/          # Service worker - AI coordination only
├── content/            # Content scripts - DOM extraction only  
├── sidepanel/          # UI layer - display and interaction only
├── assets/             # Static resources - icons, etc.
├── manifest.json       # Extension config - minimal permissions
└── docs...            # SPEC.md, AGENTS.md, TODO.md, README.md
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
- **Response times**: Keep UI responsive, show loading states

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
- **On‑device AI only**: All AI processing must happen locally via Chrome’s built‑in APIs (Summarizer, Prompt, etc.). Do not introduce external API calls or server dependencies.
- **Maintainability**: Write clean, modular code. Use descriptive function and variable names. Keep side effects contained and avoid global state.
- **Performance**: Optimise DOM queries and avoid expensive operations in loops. Keep response times quick for a smooth user experience.
- **Error handling**: Always check availability of built‑in APIs. Provide user‑friendly error messages and fallback behaviour if models are unavailable or still downloading.
- **Security and privacy**: Respect user privacy by never sending data off device. Request only the minimum permissions needed in the manifest.
- **British English**: When generating user‑visible text (e.g., labels, descriptions), use British English.

## Critical "Don't" List

**Never do these things - they violate core project constraints:**

- ❌ **Add external dependencies** - No npm packages, CDN imports, or third-party libraries
- ❌ **Make network calls** - No fetch(), XMLHttpRequest, or external API calls of any kind
- ❌ **Store user data** - No localStorage, IndexedDB, or chrome.storage of personal information
- ❌ **Add new permissions** - Only request minimal permissions needed for current functionality
- ❌ **Create inaccessible UI** - All controls must be keyboard accessible with proper ARIA labels
- ❌ **Use global state** - Avoid shared mutable state between extension components
- ❌ **Ignore error states** - Always handle AI model unavailability and provide user feedback
- ❌ **Break privacy guarantees** - Email content must never leave the user's device
- ❌ **Skip documentation** - Update TODO.md and relevant docs with every change

## Workflow

1. Pick a task from `TODO.md` or the issue tracker.
2. Review the relevant sections in `SPEC.md` and existing code.
3. Implement the feature in a new branch, following the above principles.
4. Update `TODO.md` to reflect progress, and create or comment on issues as needed.
5. Open a pull request for review once the task is complete.

By adhering to this guide, agents will produce consistent, high‑quality contributions that align with the project’s goals and constraints.

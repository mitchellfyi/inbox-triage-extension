# Testing Guide

This guide covers both manual development testing and automated test execution for the Inbox Triage Extension.

## Manual Development Testing

### Prerequisites
- **Chrome/Chromium 138+** (Required for Chrome Built-in AI APIs)
- **Chrome flags enabled** (see SETUP.md for details)
- **Developer mode enabled** in Chrome extensions
- **22GB+ free storage** (for AI model download)

### Loading the Extension for Manual Testing

1. **Open Chrome Extensions page**
   ```
   chrome://extensions/
   ```

2. **Enable Developer mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the unpacked extension**
   - Click "Load unpacked"
   - Select the repository folder containing `manifest.json`
   - The extension should appear in your extensions list

4. **Verify installation**
   - Look for "Inbox Triage Extension" in the extensions list
   - Note the extension ID for debugging purposes
   - Ensure the extension is enabled

### Manual Testing Workflow

1. **Navigate to supported email providers**
   - Gmail: `https://mail.google.com`
   - Outlook: `https://outlook.office.com`, `https://outlook.live.com`

2. **Open an email thread**
   - Click on any email to view the thread

3. **Access the side panel**
   - Click the extension icon in the Chrome toolbar
   - The side panel should open automatically

4. **Test core functionality**
   - Verify UI elements load correctly
   - Test "Extract Current Thread" button
   - Test tone selection and "Generate Drafts"
   - Check accessibility with keyboard navigation (Tab, Enter, Space)

### Debugging Tips

- **Developer Tools**: Right-click in side panel → "Inspect" to debug UI
- **Service Worker**: Go to `chrome://extensions/` → Extension details → "Inspect views: service worker"
- **Content Scripts**: Use browser DevTools on Gmail/Outlook pages to debug extraction
- **Extension Console**: Check `chrome://extensions/` for error messages

## Automated Testing

### Setup

1. **Install dependencies** (first time only)
   ```bash
   npm install
   ```

2. **Install Playwright browsers** (first time only)
   ```bash
   npm run pw:install
   ```

### Running Tests

#### Standard Test Execution
```bash
# Run all tests headless (CI mode)
npm run test:e2e

# Run tests with browser UI (debugging mode)
npm run test:e2e:headed

# Update visual snapshots (if using visual testing)
npm run test:e2e:update
```

#### Advanced Playwright Options

```bash
# Run specific test file
npx playwright test tests/panel.spec.ts

# Run tests with trace recording
npx playwright test --trace on

# Run tests in debug mode with step-by-step execution
npx playwright test --debug

# Run tests and generate HTML report
npx playwright test && npx playwright show-report
```

### Test Structure

- **`tests/fixtures/extension.ts`** - Extension loading fixtures and helpers
  - Provides `context`, `extensionId`, `backgroundPage`, `sidePanelPage` fixtures
  - Handles extension loading in persistent browser context
  
- **`tests/panel.spec.ts`** - Side panel UI testing
  - Tests baseline UI elements and structure
  - Verifies accessibility and form controls
  - Checks initial state and visibility
  
- **`tests/service-worker.spec.ts`** - Background service worker tests
  - Tests service worker initialization
  - Verifies message passing
  - Tests AI capability checks
  - Verifies statusBroadcaster is properly scoped as instance property (prevents ReferenceError)
  
- **`tests/content-script.spec.ts`** - Content script and message passing tests
  - Tests content script loading on pages
  - Verifies message passing between components
  - Tests error handling for unknown actions
  
- **`tests/extraction-flow.spec.ts`** - Extraction flow improvements and regression tests
  - Tests service worker initialization without statusBroadcaster ReferenceError
  - Verifies extract button stays disabled during extraction
  - Tests content script connection and reload handling
  - Tests draft panel closing and scrolling after generation
  - Ensures button disabled state persists through async operations
  
- **`tests/state-persistence.spec.ts`** - State persistence and restoration tests
  - Tests state saving after thread extraction, summary generation, draft creation
  - Verifies state restoration when returning to same thread URL
  - Tests URL matching logic for Gmail/Outlook variations
  - Ensures state is not restored when URL doesn't match
  
- **`tests/deeplink.spec.ts`** - Deep-link URL generation tests
  - Tests URL generation with thread metadata
  - Verifies URL encoding and parameter handling

### Playwright Configuration

The test configuration (`playwright.config.ts`) includes:

- **Channel**: `chromium` - Uses Chromium browser with extension support
- **Context**: Persistent context to maintain extension state
- **Extension Loading**: Automatically loads unpacked extension from project root
- **Artifacts**: Screenshots, traces, and HTML reports saved in `test-results/`

### Test Artifacts and Reports

After test execution, check these locations:

- **HTML Report**: `npx playwright show-report` 
- **Screenshots**: `test-results/` (on failure)
- **Traces**: `test-results/` (when `--trace on` used)
- **Videos**: `test-results/` (if configured)

### Continuous Integration

Tests run automatically on:
- **Pull Requests** to main branch
- **Pushes** to main branch

Check the "Actions" tab in GitHub for CI results and artifacts.

## Testing Best Practices

### For Manual Testing
- Test across different email formats and thread lengths
- Test AI model states: available ("readily"), downloading ("after-download"), unavailable ("no")
- Test Translator API with different language pairs
- Verify keyboard accessibility (Tab navigation, Enter/Space activation)
- Check screen reader compatibility
- Validate privacy compliance (no external network calls when using Chrome AI)
- Test multimodal image analysis functionality
- Verify attachment processing (images, PDFs, DOCX, XLSX where applicable)
- **Test state persistence**: Navigate away and return to verify summaries/drafts are restored
- **Test draft creation**: Click "Create Draft" button and verify draft appears in Gmail/Outlook compose window
- **Test loading indicators**: Verify animated indicators appear during all operations

### For Automated Testing
- Write tests that match user workflows
- Use stable selectors (prefer `getByRole`, `getByLabelText`)
- Keep tests independent and isolated
- Mock external dependencies appropriately
- Use meaningful test descriptions and assertions

### Debugging Failed Tests
1. **Check screenshots** in `test-results/` folder
2. **Run with trace** for step-by-step debugging: `--trace on`
3. **Use headed mode** to see browser interactions: `--headed`
4. **Add console logs** in test code for debugging
5. **Check extension logs** in browser DevTools

## Common Issues

### Extension Loading Problems
- Ensure `manifest.json` is valid
- Check that all referenced files exist
- Verify Chrome version supports required APIs

### Test Failures
- **Timeout errors**: Increase timeouts or improve selectors
- **Element not found**: Check if UI changed or use different locator strategy  
- **Context issues**: Ensure proper setup and teardown in fixtures

### CI/CD Issues
- Check browser installation in CI environment
- Verify extension permissions for headless mode
- Ensure proper artifact upload configuration

## Regression Testing

The following critical fixes have automated tests to prevent regressions:

### Service Worker Initialization
- **Issue**: `ReferenceError: statusBroadcaster is not defined` during AI capability initialization
- **Fix**: Changed `statusBroadcaster` to `this.statusBroadcaster` in `initializeAI()` method
- **Test**: `tests/service-worker.spec.ts` - "statusBroadcaster is properly scoped as instance property"
- **Test**: `tests/extraction-flow.spec.ts` - "service worker initializes without statusBroadcaster ReferenceError"

### Extract Button State Management
- **Issue**: Extract button could be re-enabled during extraction, causing race conditions
- **Fix**: Added `isExtracting` flag and `ensureButtonDisabled()` helper function
- **Test**: `tests/extraction-flow.spec.ts` - "extract button stays disabled during entire extraction process"
- **Test**: `tests/extraction-flow.spec.ts` - "extract button disabled state persists through async operations"

### Content Script Connection
- **Issue**: Content script not responding, requiring manual page refresh
- **Fix**: Automatic page reload with retry logic and proper readiness checks
- **Test**: `tests/extraction-flow.spec.ts` - "content script ping responds immediately even before full initialization"

### Draft Panel Behavior
- **Issue**: Draft controls panel didn't close after draft generation
- **Fix**: Hide controls section and scroll to drafts section after generation
- **Test**: `tests/extraction-flow.spec.ts` - "draft controls panel closes and scrolls to drafts after generation"

### State Persistence
- **Feature**: Automatic state saving and restoration when navigating away
- **Implementation**: `saveState()` and `restoreState()` methods in `sidepanel.js`, using `chrome.storage.local`
- **Test**: `tests/state-persistence.spec.ts` - "saves state after thread extraction"
- **Test**: `tests/state-persistence.spec.ts` - "restores state when returning to same thread URL"
- **Test**: `tests/state-persistence.spec.ts` - "does not restore state when URL does not match"

### Draft Creation in Email Client
- **Feature**: One-click button to create drafts directly in Gmail/Outlook
- **Implementation**: `createDraftInEmailUI()` in `draft-renderer.js`, `createDraft` action handler in `content.js`
- **Test**: `tests/state-persistence.spec.ts` - "create draft button appears on each draft"
- **Test**: `tests/state-persistence.spec.ts` - "create draft button is accessible"

### Loading Indicators
- **Feature**: Animated loading indicators for all operations
- **Implementation**: `createLoadingIndicator()` in `display-manager.js`, CSS animations in `sidepanel.html`
- **Test**: `tests/state-persistence.spec.ts` - "loading status shows spinner for long operations"
- **Test**: `tests/state-persistence.spec.ts` - "loading status shows dots for short operations"
- **Test**: `tests/state-persistence.spec.ts` - "loading status has progress bar animation"
- **Test**: `tests/state-persistence.spec.ts` - "disabled buttons show loading state"

## Contributing Test Changes

When adding new features or modifying existing ones:

1. **Update tests first** - Write failing tests for new functionality
2. **Run locally** - Ensure tests pass before committing
3. **Update documentation** - Modify this guide if testing process changes
4. **Test accessibility** - Include keyboard and screen reader tests
5. **Check CI** - Verify tests pass in automated environment
6. **Add regression tests** - When fixing bugs, add tests to prevent regressions
# Testing Guide

This guide covers both manual development testing and automated test execution for the Inbox Triage Extension.

## Manual Development Testing

### Prerequisites
- **Chrome/Chromium 114+** (Chrome 120+ recommended for AI features)
- **Developer mode enabled** in Chrome extensions

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
- **`tests/panel.spec.ts`** - Side panel UI testing
- **`tests/service-worker.spec.ts`** - Background service worker tests
- **`tests/deeplink.spec.ts`** - Deep-link URL generation tests

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
- Test AI model states: available, downloading, unavailable
- Verify keyboard accessibility (Tab navigation, Enter/Space activation)
- Check screen reader compatibility
- Validate privacy compliance (no external network calls)

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

## Contributing Test Changes

When adding new features or modifying existing ones:

1. **Update tests first** - Write failing tests for new functionality
2. **Run locally** - Ensure tests pass before committing
3. **Update documentation** - Modify this guide if testing process changes
4. **Test accessibility** - Include keyboard and screen reader tests
5. **Check CI** - Verify tests pass in automated environment
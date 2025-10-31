# Quick Setup Guide - Inbox Triage Extension

Get up and running with AI-powered email triage in just a few minutes!

## 🚀 Quick Start (3 Steps)

### Step 1: Check System Requirements

**Required:**
- ✅ **Chrome 138+** (Check: `chrome://version`)
- ✅ **22GB+ free storage** (for AI models)
- ✅ **4GB+ GPU VRAM** (or decent integrated graphics)
- ✅ **Operating System:**
  - Windows 10 or 11
  - macOS 13+ (Ventura or later)
  - Linux (most distributions)

**Note:** If you have less storage/GPU, you can still use the extension with custom API keys (OpenAI GPT-4, Anthropic Claude, or Google Gemini - all fully supported)

### Step 2: Enable Chrome AI Features (2 minutes)

1. **Open Chrome Flags:**
   - Type `chrome://flags` in your address bar and press Enter

2. **Enable These 3 Flags:**
   - Search for: `#optimization-guide-on-device-model`
     - Set to: **"Enabled BypassPerfRequirement"**
   - Search for: `#prompt-api-for-gemini-nano`
     - Set to: **"Enabled"**
   - Search for: `#summarization-api-for-gemini-nano`
     - Set to: **"Enabled"**
   - Search for: `#translation-api` (Optional but recommended)
     - Set to: **"Enabled"**

3. **Restart Chrome:**
   - Click the blue **"Relaunch"** button at the bottom

### Step 3: Install the Extension

1. **Enable Developer Mode:**
   - Go to `chrome://extensions/`
   - Toggle **"Developer mode"** (top-right corner)

2. **Load the Extension:**
   - Click **"Load unpacked"**
   - Select the `inbox-triage-extension` folder
   - Extension icon should appear in your toolbar

3. **First Launch:**
   - AI models will download automatically (1-5 minutes, ~1.5GB)
   - You'll see "AI models downloading..." status
   - Extension is ready when you see "AI models ready"

## ✨ You're Done!

### Test It Out:

1. **Open Gmail or Outlook** (mail.google.com or outlook.live.com)
2. **Open any email thread**
3. **Click the extension icon** in your toolbar
4. **Click "Extract Current Thread"**
5. **Watch AI magic happen!** ✨

---

## 📋 Detailed Setup Instructions

### System Requirements (Detailed)

#### Minimum Requirements:
- **Chrome Version:** 138 or later (Stable)
- **Storage Space:** 22GB free on your Chrome profile volume
- **GPU:** 4GB+ VRAM (integrated graphics may work but slower)
- **RAM:** 8GB+ recommended
- **Internet:** Unmetered connection for initial model download

#### Supported Platforms:
| Platform | Version | Status |
|----------|---------|--------|
| Windows | 10, 11 | ✅ Fully Supported |
| macOS | 13+ (Ventura+) | ✅ Fully Supported |
| Linux | Recent distros | ✅ Supported |
| ChromeOS | Platform 16389.0.0+ | ✅ Chromebook Plus only |

### Chrome Flags Configuration (Step-by-Step)

#### Required Flags for Chrome AI:

1. **Optimization Guide On Device Model**
   - **Flag:** `#optimization-guide-on-device-model`
   - **Setting:** "Enabled BypassPerfRequirement"
   - **Purpose:** Enables on-device AI model distribution
   - **Screenshot location:** Top of chrome://flags page

2. **Prompt API for Gemini Nano**
   - **Flag:** `#prompt-api-for-gemini-nano`
   - **Setting:** "Enabled"
   - **Purpose:** Enables the Prompt API for reply drafts
   - **Required for:** Draft generation, custom prompts

3. **Summarization API for Gemini Nano**
   - **Flag:** `#summarization-api-for-gemini-nano`
   - **Setting:** "Enabled"
   - **Purpose:** Enables the Summarizer API
   - **Required for:** Email thread summaries, key points extraction

4. **Translation API** (Optional but recommended)
   - **Flag:** `#translation-api`
   - **Setting:** "Enabled"
   - **Purpose:** Enables Translator API for multilingual support

#### Optional Flags (Future Features):

These flags aren't needed now but may be useful later:

- `#language-detection-api` - For automatic language detection
- `#writer-api-for-gemini-nano` - For enhanced writing assistance
- `#rewriter-api-for-gemini-nano` - For text rewriting

### Verify AI Setup is Working

After enabling flags and restarting Chrome:

1. **Check Model Component:**
   - Go to `chrome://components/`
   - Find "Optimization Guide On Device Model"
   - Status should say: **"Up to date"**
   - If it says "Checking for updates", wait a moment and refresh

2. **Test in DevTools Console:**
   - Open any webpage
   - Press `F12` (or Cmd+Option+I on Mac)
   - Go to **Console** tab
   - Paste this command:
     ```javascript
     'LanguageModel' in self && (await LanguageModel.availability())
     ```
   - Expected result: **"readily"**, **"after-download"**, or **"no"**
   - If you get an error, models aren't ready yet

3. **Check Model Download Progress:**
   - The models download in the background
   - First download takes 2-10 minutes depending on connection
   - Total download size: ~1.5GB
   - Once complete, you'll see "readily" in the console

### Alternative: Use Custom API Keys

If you can't use Chrome AI (incompatible system, insufficient resources, etc.):

1. **Get an API Key:**
   - **OpenAI:** https://platform.openai.com/api-keys (GPT-4 - Fully Supported)
   - **Google AI Studio:** https://aistudio.google.com/app/apikey (Gemini - Fully Supported)
   - **Anthropic:** https://console.anthropic.com/ (Claude - Fully Supported)

2. **Configure in Extension:**
   - Open the extension
   - Scroll to **"API Settings (Optional)"**
   - Check **"Use custom API key"**
   - Select your provider (OpenAI, Anthropic, or Google AI)
   - Enter your API key (securely stored)
   - Click **"Save API Key"**

3. **Important Notes:**
   - Custom API keys send email content to external servers
   - You'll be charged based on API provider pricing
   - Chrome AI is free and private (all local processing)
   - Custom keys work across all platforms/browsers
   - All three providers (OpenAI, Anthropic, Google AI) are fully implemented and ready to use

---

## 🔧 Troubleshooting

### Problem: "AI features not available"

**Possible Causes:**
1. Chrome flags not enabled properly
2. Models haven't finished downloading
3. Insufficient storage space
4. Unsupported Chrome version

**Solutions:**
1. Double-check flags are **enabled**, not just "Default"
2. Wait 5-10 minutes for model download
3. Free up space (need 22GB+ available)
4. Update Chrome to version 138+
5. Check `chrome://components/` for model status

### Problem: "AI model is downloading"

**This is normal!**
- First-time setup downloads ~1.5GB
- Progress shown in extension status
- Usually takes 2-10 minutes
- Continue using Chrome normally

**If stuck downloading:**
- Check internet connection
- Ensure you have 22GB+ free space
- Try restarting Chrome
- Check `chrome://components/` and click "Check for update"

### Problem: Extension shows "Navigate to Gmail or Outlook"

**This means:**
- You're not currently on Gmail or Outlook
- Extension only works on email pages

**To fix:**
- Navigate to `mail.google.com` (Gmail)
- Or `outlook.live.com` / `outlook.office.com` (Outlook)
- Open any email thread
- Extension will automatically detect the page

### Problem: "Extract Current Thread" button is disabled

**Possible causes:**
1. Not on a supported email page
2. Email page hasn't fully loaded
3. Content script didn't initialize

**Solutions:**
1. Verify you're on Gmail or Outlook
2. Refresh the email page
3. Reload the extension (chrome://extensions/)
4. Check browser console for errors (F12)

### Problem: Models removed due to low disk space

**What happened:**
- Chrome removes models if disk space drops below 10GB
- Models will re-download when space is available

**Solution:**
1. Free up at least 22GB of space
2. Restart Chrome
3. Models will automatically re-download
4. Check `chrome://components/` to trigger update

### Problem: "Session failed" or "Model error"

**Quick fixes:**
1. Reload the email page
2. Click "Extract Current Thread" again
3. Check model status: `chrome://components/`
4. Restart Chrome if persists

**Advanced:**
- Clear Chrome cache: `chrome://settings/clearBrowserData`
- Disable and re-enable extension
- Check Chrome DevTools console for errors

### Problem: Custom API key doesn't work

**Check these:**
1. API key is valid and not expired
2. You have API credits/billing enabled
3. Correct provider selected (currently only OpenAI supported)
4. Internet connection is working
5. Check browser console for specific error

**Common API errors:**
- **401 Unauthorized:** Invalid API key
- **429 Too Many Requests:** Rate limit exceeded
- **500 Server Error:** API provider issue

---

## 📊 Feature Comparison

| Feature | Chrome AI (Default) | Custom API Key |
|---------|-------------------|----------------|
| **Privacy** | 🔒 100% Local | ⚠️ Data sent to API provider |
| **Cost** | 💰 Free | 💰 Pay per use |
| **Speed** | ⚡ Fast (local) | 🌐 Network dependent |
| **Offline** | ✅ Works offline | ❌ Requires internet |
| **Setup** | 🔧 Requires Chrome flags | 🔑 Just need API key |
| **Quality** | ✨ Good (Gemini Nano) | ✨ Excellent (GPT-4/Claude/Gemini) |
| **Platforms** | 🖥️ Chrome 138+ only | 🌍 Works anywhere |

**Recommendation:** Use Chrome AI for best privacy and cost. Use custom API keys if you need:
- Maximum quality (GPT-4, Claude, Gemini)
- Support for older Chrome versions
- Cross-browser compatibility
- Specific model preferences (OpenAI, Anthropic, or Google AI)

---

## 🎓 Usage Tips

### Getting the Best Results:

1. **Email Thread Extraction:**
   - Open complete email threads (not just individual messages)
   - Ensure all messages are expanded (not collapsed)
   - Works best with 2-10 messages per thread

2. **Summarization:**
   - Longer threads = more useful summaries
   - Key points extracted automatically
   - Summaries are ~100 words (TL;DR style)

3. **Reply Drafts:**
   - Select appropriate tone (Neutral, Friendly, Assertive, Formal)
   - Add custom guidance for specific context
   - Use voice dictation (🎤) for hands-free guidance
   - Get 3 draft options: Short, Medium, Detailed

4. **Custom Guidance:**
   - Example: "Mention the Q4 deadline"
   - Example: "Ask about project budget"
   - Example: "Decline politely, suggest alternative"

5. **Translation:**
   - Select target language from Settings dropdown
   - Supports 15+ languages
   - All translations happen on-device for privacy
   - Works offline after initial model download

### Keyboard Shortcuts:

Currently none, but you can:
- Use Tab to navigate between buttons
- Press Enter to activate focused buttons
- Use Escape to close modals

---

## 🔐 Privacy & Security

### Chrome AI (Default Mode):
- ✅ **100% Local Processing** - No data leaves your device
- ✅ **No Internet Required** - Works completely offline
- ✅ **No Data Collection** - We don't collect anything
- ✅ **No External Servers** - Everything happens in Chrome
- ✅ **Model Updates** - Chrome handles automatically

### Custom API Key Mode:
- ⚠️ **Data Sent to API Provider** - Email text transmitted
- ⚠️ **Subject to Provider's Privacy Policy** - Google/Anthropic/OpenAI
- ✅ **API Keys Stored Securely** - Encrypted by Chrome
- ✅ **No Attachments Sent** - Only extracted text
- ⚠️ **Provider May Train on Data** - Check their policies

**Our Commitment:**
- We never see your API keys
- We never track your usage
- We never collect your email content
- Open source and auditable

---

## 📚 Additional Resources

### Official Documentation:
- **Chrome Built-in AI:** https://developer.chrome.com/docs/ai/built-in
- **Prompt API Guide:** https://developer.chrome.com/docs/ai/prompt-api
- **Summarizer API Guide:** https://developer.chrome.com/docs/ai/summarizer-api
- **Translator API Guide:** https://developer.chrome.com/docs/ai/translator-api

### API Provider Documentation:
- **Google AI (Gemini):** https://ai.google.dev/docs
- **Anthropic Claude:** https://docs.anthropic.com/
- **OpenAI API:** https://platform.openai.com/docs

### Extension Documentation:
- **[spec.md](./spec.md)** - Complete feature specifications
- **[AGENTS.md](../AGENTS.md)** - Development guidelines
- **[implementation-summary.md](./implementation-summary.md)** - Implementation details
- **[README.md](../README.md)** - Project overview

### Getting Help:
- **GitHub Issues:** Report bugs or request features
- **Discussions:** Ask questions and share feedback
- **Chrome AI Community:** https://developer.chrome.com/docs/ai

---

## 🚀 Quick Command Reference

### Verify Setup:
```bash
# Check Chrome version
chrome://version

# View enabled flags
chrome://flags

# Check model components
chrome://components

# Test AI availability (in DevTools console)
'LanguageModel' in self && (await LanguageModel.availability())
```

### Extension Management:
```bash
# Extensions page
chrome://extensions

# View extension logs
Right-click extension icon → Inspect → Console

# Reload extension
chrome://extensions → Click reload button
```

### Clear Extension Data:
```bash
# Remove API keys and settings
chrome://extensions → Remove extension
chrome://settings/clearBrowserData → Cached images and files
```

---

## ✅ Ready to Go!

You're all set! Here's what to do next:

1. ✨ **Open Gmail or Outlook**
2. 📧 **Click on any email thread**
3. 🔵 **Click the extension icon**
4. 🚀 **Click "Extract Current Thread"**
5. 🎉 **Enjoy AI-powered email triage!**

**Questions?** Check the troubleshooting section above or open a GitHub issue.

**Found a bug?** Please report it so we can fix it quickly.

**Enjoying the extension?** Star the repo and share with colleagues! ⭐

---

**Last Updated:** October 2025  
**Extension Version:** 1.0.0  
**Minimum Chrome Version:** 138  
**Recommended Chrome Version:** 138+ (Stable)


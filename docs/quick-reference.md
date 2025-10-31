# 📋 Quick Reference Card - Inbox Triage Extension

Print this page or keep it handy for quick access!

---

## 🚀 Installation (One-Time Setup)

### 1. Enable Chrome Flags (2 min)
```
chrome://flags

Enable these 3 flags:
✓ #optimization-guide-on-device-model → Enabled BypassPerfRequirement  
✓ #prompt-api-for-gemini-nano → Enabled
✓ #summarization-api-for-gemini-nano → Enabled
✓ #translation-api → Enabled (optional but recommended)

Click "Relaunch"
```

### 2. Install Extension (1 min)
```
chrome://extensions/

✓ Toggle "Developer mode" (top-right)
✓ Click "Load unpacked"
✓ Select inbox-triage-extension folder
```

### 3. Wait for Models (2-5 min)
```
Models download automatically (~1.5GB)
Status: "AI models downloading..." → "AI models ready" ✨
```

---

## 💡 How to Use

### Basic Workflow
```
1. Open Gmail (mail.google.com) or Outlook (outlook.live.com)
2. Click any email thread
3. Click extension icon in toolbar
4. Click "Extract Current Thread"
5. Review AI-generated summary and key points
6. (Optional) Add guidance and generate reply drafts
```

### Generate Reply Drafts
```
1. After extracting thread:
2. Select tone: Neutral | Friendly | Assertive | Formal
3. (Optional) Add guidance text or use 🎤 voice button
4. Click "Generate Drafts"
5. Get 3 options: Short | Medium | Detailed
6. Click "Copy Draft" to copy to clipboard
```

### Translate Content
```
1. After extracting thread:
2. Open Settings (⚙️ button)
3. Select target language from dropdown
4. Summary, key points, and drafts translate automatically
5. Select "No Translation (Original)" to return to original
```

---

## 🔧 Troubleshooting Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| **"AI features not available"** | Check flags are **Enabled** not "Default"<br>Wait 5 min for models to download<br>Ensure 22GB+ free space |
| **"AI models downloading"** | Normal! Wait 2-10 minutes<br>Check: `chrome://components/` |
| **"Navigate to Gmail/Outlook"** | You're not on an email page<br>Go to mail.google.com or outlook.live.com |
| **Button disabled** | Not on supported page<br>Or page hasn't fully loaded<br>Try refreshing |
| **Models removed** | Low disk space (need 22GB+)<br>Free up space, models re-download |
| **Session failed** | Reload email page<br>Click "Extract" again<br>Restart Chrome if persists |

---

## 🔐 Privacy Modes

### Chrome AI (Default) - Recommended
✅ **100% local** - No data leaves device  
✅ **Free** - No API costs  
✅ **Fast** - Local processing  
✅ **Offline** - Works without internet  
⚠️ **Requires** - Chrome 138+, 22GB storage, 4GB+ GPU  

### Custom API Key (Optional)
✅ **High quality** - GPT-4 / Claude  
✅ **Universal** - Works on any Chrome version  
⚠️ **Privacy** - Data sent to API provider  
⚠️ **Cost** - Pay per use  
⚠️ **Internet** - Requires connection  

---

## ⚙️ Custom API Key Setup

```
1. Extension → "API Settings (Optional)"
2. Check "Use custom API key"  
3. Select provider: OpenAI | Anthropic | Google AI
4. Enter API key (get from provider's website)
5. Click "Save API Key"
```

**Get API Keys:**
- OpenAI: https://platform.openai.com/api-keys (Currently Supported)
- Anthropic: https://console.anthropic.com/ (Planned)
- Google AI: https://ai.google.dev/ (Planned)

---

## 📊 Feature Comparison

| Feature | Chrome AI | Custom API |
|---------|-----------|------------|
| Setup | Enable flags | Enter API key |
| Privacy | 🔒 Local | ⚠️ External |
| Cost | Free | $0.01-0.30/request |
| Quality | Good | Excellent |
| Offline | ✅ Yes | ❌ No |
| Platforms | Chrome 138+ | Any browser |

---

## ⌨️ Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Navigate | Tab |
| Activate button | Enter |
| Close modals | Escape |

*More shortcuts coming soon!*

---

## 🔍 Verify Setup

### Check Chrome Version
```
chrome://version
Should show: 138 or higher
```

### Check AI Models
```
chrome://components/
Find: "Optimization Guide On Device Model"
Status: Should show "Up to date"
```

### Test in Console
```
Press F12 → Console tab → Paste:
(await ai.languageModel.capabilities()).available

Result: Should show "readily"
```

---

## 📞 Getting Help

**Detailed Guide:** [setup.md](./setup.md)  
**Troubleshooting:** [setup.md](./setup.md#-troubleshooting)  
**Report Bug:** GitHub Issues  
**Questions:** GitHub Discussions  

---

## 🎯 Quick Tips

- **Best Results:** Use with threads containing 2-10 messages
- **Guidance:** Add specific requests like "Mention deadline"
- **Voice Input:** Use 🎤 button for hands-free guidance
- **Tone:** Choose appropriate tone for recipient
- **Copy:** Draft body text is copied (subject follows standard format)
- **Translation:** Supports 15+ languages, all on-device

---

## 🌟 Supported Platforms

✅ **Gmail** - mail.google.com  
✅ **Outlook** - outlook.live.com, outlook.office.com  
❌ **Yahoo Mail** - Not supported  
❌ **Apple Mail** - Not supported  
❌ **Thunderbird** - Not supported  

---

## 📱 System Requirements

### Minimum
- Chrome 138+
- 22GB free storage
- 4GB+ GPU VRAM  
- 8GB+ RAM
- Windows 10+ / macOS 13+ / Linux

### Recommended
- Chrome 138+ (Stable)
- 50GB free storage
- Dedicated GPU
- 16GB+ RAM
- Unmetered internet

---

## ⏱️ Expected Processing Times

| Task | Chrome AI | Custom API |
|------|-----------|------------|
| Extract thread | < 1 sec | < 1 sec |
| Generate summary | 2-5 sec | 1-3 sec |
| Generate drafts | 5-10 sec | 2-5 sec |
| Translate content | 1-3 sec | N/A |
| Initial model download | 2-10 min | N/A |

---

## 🔄 Update Instructions

### Update Extension
```
1. Git pull latest changes (or download new ZIP)
2. chrome://extensions/
3. Click reload button on extension card
4. Refresh email page
```

### Update AI Models
```
chrome://components/
Find: "Optimization Guide On Device Model"
Click: "Check for update"
Wait for download to complete
```

---

## ❓ Common Questions

**Q: Why is extension disabled on some pages?**  
A: Only works on Gmail and Outlook email pages.

**Q: Do I need internet after setup?**  
A: No! Chrome AI works completely offline after models download.

**Q: Can I use on multiple computers?**  
A: Yes! API keys sync via Chrome. Models need download on each device.

**Q: Is my email data safe?**  
A: Yes! Chrome AI processes everything locally. No data leaves device.

**Q: How much does it cost?**  
A: Chrome AI is free. Custom API keys have provider pricing.

**Q: Can I use with company email?**  
A: Yes, but check your company's policies on AI tools.

**Q: What languages are supported for translation?**  
A: 15+ languages including Spanish, French, German, Japanese, Chinese, and more. See Settings dropdown for full list.

---

## 📈 Version Information

**Current Version:** 1.0.0  
**Last Updated:** October 2025  
**Chrome Minimum:** 138  
**Chrome Recommended:** 138+ (Stable)

---

## 🎓 Learn More

- Chrome AI Docs: https://developer.chrome.com/docs/ai/built-in
- Extension Docs: See [README.md](../README.md) and [spec.md](./spec.md)
- Official Blog: https://developer.chrome.com/blog

---

**💡 Pro Tip:** Bookmark this page for quick access!

**⭐ Enjoying the extension?** Star the repo on GitHub!

**🐛 Found a bug?** Please report it so we can fix it quickly!

---

*Keep this reference card handy for quick troubleshooting and tips!*


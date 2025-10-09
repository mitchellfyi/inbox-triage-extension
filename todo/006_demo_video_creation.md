# Task 006: Demo Video Creation

**Priority**: 🔴 CRITICAL (Required for Submission)  
**Estimated Effort**: 4-6 hours  
**Deliverable**: 3-minute demo video  
**Status**: [todo]

---

## 📋 Task Description

Create a compelling 3-minute demonstration video showcasing the Inbox Triage Extension for the Chrome Built-in AI Challenge 2025 submission. The video must clearly communicate the problem, solution, and technical implementation.

**Hackathon Requirement**: A demo video is REQUIRED for submission to Devpost.

---

## 🎯 Acceptance Criteria

### Video Requirements
- [ ] Length: Under 3 minutes (strictly enforced by Devpost)
- [ ] Format: MP4, 1080p (1920x1080) recommended
- [ ] Audio: Clear narration with good microphone quality
- [ ] No copyrighted music or content
- [ ] Uploaded to YouTube (unlisted or public)
- [ ] Captions/subtitles included for accessibility

### Content Requirements
- [ ] Clear problem statement with relatable scenario
- [ ] Solution overview highlighting on-device AI
- [ ] Live demo of core features (not mockups)
- [ ] Technical highlights showcasing multiple Chrome AI APIs
- [ ] Privacy and performance benefits emphasized
- [ ] Call-to-action (GitHub repo, installation instructions)

### Technical Demonstration
- [ ] Show all 5+ Chrome AI APIs in action
- [ ] Demonstrate multimodal capabilities (image analysis)
- [ ] Show translation/proofreading features
- [ ] Display performance metrics
- [ ] Emphasize offline capability
- [ ] Show graceful error handling

---

## 🎬 Video Structure (3 Minutes)

### **Section 1: Hook & Problem (0:00-0:30)**
**Duration**: 30 seconds  
**Goal**: Grab attention and establish the problem

**Script**:
```
[Opening shot: Overwhelmed person at computer with 121 unread emails]

NARRATOR: "The average professional receives 121 emails per day, spending 28% of their work time managing their inbox. Critical information gets buried. Important deadlines are missed. And privacy-conscious users worry about cloud-based AI tools accessing their sensitive communications."

[Text overlay: "121 emails/day | 28% time spent | Privacy concerns"]
```

**B-Roll**:
- Gmail inbox with hundreds of unread emails
- Person scrolling through long email thread
- Clock ticking, showing time wasted
- Lock icon with "Cloud AI" crossed out

---

### **Section 2: Solution Overview (0:30-1:00)**
**Duration**: 30 seconds  
**Goal**: Introduce the solution and key differentiator

**Script**:
```
[Transition to extension icon being clicked]

NARRATOR: "Introducing Inbox Triage—a Chrome extension that transforms email overwhelm into actionable insights using Chrome's built-in AI. Every feature runs locally on your device. No data transmission. No cloud dependencies. Complete privacy."

[Show extension side panel opening]

"With support for 6 different Chrome AI APIs, it's the most comprehensive on-device email assistant available."
```

**Visuals**:
- Extension icon clicked, side panel opens
- List of APIs with checkmarks appearing
- "100% On-Device" badge
- Privacy shield icon
- GitHub repo star count

---

### **Section 3: Live Demo - Core Features (1:00-2:00)**
**Duration**: 60 seconds (most important section)  
**Goal**: Demonstrate all key features in action

#### **A. Summarization (1:00-1:15)**
**Script**: "Click Extract Current Thread, and within seconds, you get a concise TL;DR and key points—perfect for long email chains."

**Screen Recording**:
1. Show long Gmail thread (10+ messages)
2. Click "Extract Current Thread" button
3. Show loading animation (<2 seconds)
4. Display summary appearing with 5 key points
5. Highlight color-coded sections

#### **B. Multimodal Image Analysis (1:15-1:30)** 🌟 KEY FEATURE
**Script**: "Attachments are no longer a mystery. The extension uses Chrome's cutting-edge multimodal Prompt API to analyze images—describing visuals, extracting text like an OCR tool, and even interpreting charts. All image processing stays local."

**Screen Recording**:
1. Show email with chart image attached
2. Click "Analyze Image" button
3. Show AI description appearing
4. Switch to "Extract Text" tab, show OCR results
5. Show "Chart Analysis" tab with insights
6. Text overlay: "Multimodal AI • 100% On-Device"

#### **C. Multi-Language Translation (1:30-1:40)**
**Script**: "Need to work across languages? Built-in translation supports 10+ languages—all processed on your device."

**Screen Recording**:
1. Select "Spanish" from language dropdown
2. Show summary translating instantly
3. Show translation indicator: "EN → ES"
4. Click "Translate Draft" button
5. Draft appears in Spanish

#### **D. Intelligent Drafting (1:40-2:00)**
**Script**: "Generate professional replies in three lengths—short, medium, or detailed—with your choice of tone. Use voice input for custom guidance, and the Proofreader API ensures perfect grammar. Need alternatives? The Rewriter API gives you multiple options instantly."

**Screen Recording**:
1. Select "Friendly" tone
2. Use voice input for guidance (show microphone animation)
3. Click "Generate Drafts"
4. Three drafts appear with proofreading badges
5. Click "Rephrase" on one draft
6. Show 2 alternatives appearing
7. Click "Copy" button
8. Show "Copied!" confirmation

---

### **Section 4: Technical Excellence (2:00-2:30)**
**Duration**: 30 seconds  
**Goal**: Showcase technical sophistication

**Script**:
```
"Under the hood, Inbox Triage orchestrates 6 Chrome AI APIs: Summarizer for condensing content, Prompt API with multimodal support for image analysis and drafting, Translator for multilingual communication, Proofreader for grammar perfection, Rewriter for alternatives, and Writer for original content generation."

[Show API badge dashboard appearing]

"Processing happens in under 2 seconds, uses only 50MB of memory, and works completely offline once models are downloaded. Zero bytes transmitted to external servers."
```

**Visuals**:
- API usage dashboard appearing
- Performance metrics: "<2s processing | 50MB RAM | 0 bytes transmitted"
- Network tab showing no external requests
- Offline mode demonstration (disconnect wifi, still works)

---

### **Section 5: Closing & Call to Action (2:30-3:00)**
**Duration**: 30 seconds  
**Goal**: Drive action and reinforce key message

**Script**:
```
"Inbox Triage proves that on-device AI can match cloud solutions while keeping your communications completely private. Ready to take control of your inbox?"

[Show installation steps quickly]

"Get started in 5 minutes. Visit our GitHub repo for installation instructions and star the project to follow development. Your inbox deserves better. Your privacy matters more."

[End screen with GitHub URL and extension logo]
```

**Visuals**:
- Quick montage of all features
- GitHub repo appearing
- QR code for easy mobile access
- Social proof: stars, contributors
- Extension icon with tagline: "Private. Powerful. On-Device."

---

## 🛠️ Production Checklist

### Pre-Production
- [ ] Write full script with exact timings
- [ ] Create storyboard for each scene
- [ ] Prepare Gmail test account with sample emails
- [ ] Create image attachments (charts, screenshots) for demo
- [ ] Set up screen recording software (OBS, ScreenFlow, Camtasia)
- [ ] Test microphone and audio quality
- [ ] Prepare performance metrics dashboard
- [ ] Create title cards and overlays

### Recording Setup
- [ ] Use 1920x1080 resolution
- [ ] Record at 30 or 60 FPS
- [ ] Enable cursor highlighting for visibility
- [ ] Use zoom effects for important actions
- [ ] Record audio separately for better quality
- [ ] Record multiple takes for each section
- [ ] Capture B-roll footage

### Editing
- [ ] Edit to exactly 2:45-2:55 (leave buffer under 3 minutes)
- [ ] Add transitions between sections (clean, professional)
- [ ] Add text overlays for key points
- [ ] Add background music (royalty-free, subtle)
- [ ] Color grade for consistency
- [ ] Add captions/subtitles
- [ ] Add animated icons or graphics
- [ ] Include extension branding

### Post-Production
- [ ] Export in MP4 format (H.264 codec)
- [ ] Verify file size (<500MB for YouTube)
- [ ] Test playback on different devices
- [ ] Get feedback from 2-3 people
- [ ] Make revisions based on feedback
- [ ] Upload to YouTube (unlisted initially)
- [ ] Create compelling thumbnail
- [ ] Write detailed video description
- [ ] Add timestamps in description
- [ ] Make video public before submission

---

## 🎨 Visual Style Guide

### Color Palette
- **Primary**: Extension brand colors (blues, greens)
- **Accent**: Highlight important actions (yellow/orange)
- **Success**: Green for completed actions
- **Background**: Clean white or light gray

### Typography
- **Headings**: Bold, sans-serif (Montserrat, Inter, SF Pro)
- **Body Text**: Clear, readable (16-18px minimum)
- **Code**: Monospace font when showing technical details

### Animation Style
- **Fast transitions**: 0.3-0.5 seconds
- **Smooth easing**: Ease-in-out
- **Purposeful motion**: Every animation should communicate

### Music Suggestions (Royalty-Free)
- YouTube Audio Library: "Tech" category
- Epidemic Sound: "Corporate & Technology"
- Artlist: "Uplifting Tech"
- Keep volume at 20-30% behind narration

---

## 📝 Script Template

Create full script in `docs/demo-video-script.md`:

```markdown
# Inbox Triage Extension - Demo Video Script

**Target Length**: 2:50  
**Last Updated**: [Date]

## Scene 1: Hook (0:00-0:30)
**Visual**: [Describe exactly what's on screen]  
**Narration**: "[Exact words to speak]"  
**On-Screen Text**: "[Text overlays]"  
**Notes**: [Any special effects, timing notes]

[Repeat for each scene]
```

---

## 🎯 Key Messages to Emphasize

### Primary Message
"On-device AI that keeps your email private"

### Supporting Messages
1. **Privacy First**: "Zero data transmitted to external servers"
2. **Feature Rich**: "6 Chrome AI APIs working together"
3. **Cutting Edge**: "Multimodal image analysis capabilities"
4. **Performance**: "Fast, efficient, works offline"
5. **Open Source**: "Transparent, auditable code"

---

## 📊 Success Metrics

Video should demonstrate:
- [ ] All 6 AI APIs in action
- [ ] <2 second average processing time
- [ ] Multimodal image analysis (KEY differentiator)
- [ ] Offline capability
- [ ] No network requests
- [ ] Professional UI/UX
- [ ] Graceful error handling

---

## 🎤 Narration Tips

### Voice Guidelines
- **Pace**: 140-160 words per minute (moderate, clear)
- **Tone**: Professional but approachable
- **Energy**: Enthusiastic without being overhyped
- **Clarity**: Enunciate technical terms clearly

### Recording Setup
- **Microphone**: USB condenser mic or better (Blue Yeti, Audio-Technica AT2020)
- **Environment**: Quiet room with minimal echo
- **Pop Filter**: Reduce plosives (P, B, T sounds)
- **Distance**: 6-8 inches from mic
- **Multiple Takes**: Record 2-3 takes, choose best

---

## 📚 Required Assets

### Screen Recordings Needed
1. Gmail inbox with 100+ emails
2. Long email thread (10+ messages)
3. Email with image attachments (chart, screenshot)
4. Outlook email (show compatibility)
5. Extension settings panel
6. Performance metrics dashboard
7. Offline mode demonstration
8. Error handling states

### Graphics Needed
1. Extension logo (high res)
2. API badges/icons for all 6 APIs
3. "100% On-Device" badge
4. Privacy shield icon
5. Performance metrics graphics
6. Comparison table (optional)
7. GitHub social proof graphics
8. End screen with CTAs

### B-Roll Footage
1. Person overwhelmed by emails
2. Clock/time passing
3. Lock/security imagery
4. Happy person using extension
5. Laptop with extension running

---

## 🔗 Distribution Checklist

### YouTube Upload
- [ ] Title: "Inbox Triage - AI Email Assistant (100% On-Device, 6 Chrome AI APIs)"
- [ ] Description: Full feature list, links, timestamps
- [ ] Tags: chrome extension, AI, email, privacy, on-device, Gemini Nano
- [ ] Thumbnail: Eye-catching with text overlay
- [ ] Playlist: Add to project playlist
- [ ] End screen: Link to GitHub

### Video Description Template
```
Inbox Triage transforms email overwhelm into actionable insights using Chrome's built-in AI APIs—all processing happens locally for complete privacy.

🌟 KEY FEATURES:
✅ AI-powered summarization
✅ Multimodal image analysis
✅ Multi-language translation
✅ Intelligent draft generation
✅ Grammar proofreading
✅ Alternative phrasings

🔐 100% ON-DEVICE PROCESSING
No data transmission • Works offline • Complete privacy

📊 TECHNICAL HIGHLIGHTS:
• 6 Chrome AI APIs (Summarizer, Prompt, Translator, Proofreader, Rewriter, Writer)
• Multimodal capabilities (image analysis, OCR, chart interpretation)
• <2s average processing time
• 50MB memory footprint
• Manifest V3 extension

⏱️ TIMESTAMPS:
0:00 - Problem
0:30 - Solution Overview
1:00 - Core Features Demo
2:00 - Technical Excellence
2:30 - Getting Started

🔗 LINKS:
GitHub: [URL]
Documentation: [URL]
Chrome Built-in AI Challenge: https://googlechromeai2025.devpost.com/

#ChromeAI #EmailProductivity #OnDeviceAI #Privacy #ChromeExtension
```

---

## ✅ Final Checklist Before Submission

- [ ] Video is under 3 minutes
- [ ] All 6 AI APIs demonstrated
- [ ] Multimodal features highlighted (30+ seconds)
- [ ] Audio is clear and professional
- [ ] Captions are accurate
- [ ] No copyrighted content
- [ ] Uploaded to YouTube
- [ ] URL added to Devpost submission
- [ ] Video is public (not private)
- [ ] Thumbnail is professional
- [ ] Description includes all relevant links

---

## 📎 References

- [Devpost Video Guidelines](https://help.devpost.com/hc/en-us/articles/360021899171)
- [YouTube Captioning Guide](https://support.google.com/youtube/answer/2734796)
- [Screen Recording Best Practices](https://www.techsmith.com/blog/screen-recording-best-practices/)

---

## 🔗 Related Tasks

- All tasks 001-005: Features to showcase in video
- Task 013: README updates (align messaging)
- Task 008: Performance Metrics (show in video)
- Task 014: System Status Panel (demo in video)

---

## ⚠️ Critical Notes

**This video is your submission's first impression!** Judges will likely watch videos before trying the extension. Make it:
- **Professional**: Good production quality shows attention to detail
- **Compelling**: Hook viewers in first 10 seconds
- **Clear**: Non-technical viewers should understand the value
- **Complete**: Show real functionality, not mockups
- **Honest**: Don't overpromise features that don't exist

**Timeline**: Start this task early! Video production takes longer than expected. Allow 2-3 days minimum for recording, editing, feedback, and revisions.


# Task 010: System Status Dashboard

**Priority**: 🟢 MEDIUM (User Confidence & Transparency)  
**Estimated Effort**: 2-3 hours  
**Deliverable**: Visual system health indicator  
**Status**: [todo]

---

## 📋 Task Description

Create a comprehensive system status dashboard showing AI model availability, download progress, storage status, and system health. This builds user confidence and demonstrates technical transparency.

**Hackathon Value**: Shows professional polish and helps judges understand system state immediately.

---

## 🎯 Acceptance Criteria

### Functional Requirements
- [ ] Display status of all 6+ Chrome AI APIs
- [ ] Show model download progress with estimated time
- [ ] Display storage usage and requirements
- [ ] Show system capabilities (GPU, memory)
- [ ] Indicate network connectivity status
- [ ] Display extension version and update status
- [ ] Quick troubleshooting suggestions
- [ ] "Check System" button to refresh status

### Visual Requirements
- [ ] Traffic light status indicators (green/yellow/red)
- [ ] Progress bars for downloads
- [ ] Icons for each API
- [ ] Collapsible detailed view
- [ ] Loading animations
- [ ] Tooltips with explanations

### Technical Requirements
- [ ] Check API availability every 30 seconds when panel open
- [ ] Monitor chrome://components for model status
- [ ] Detect storage.estimate() for space available
- [ ] Cache status to avoid excessive checks
- [ ] Provide actionable error messages

---

## 🔧 Implementation Details

### 1. System Status Service in service_worker.js

```javascript
class SystemStatusService {
    constructor() {
        this.statusCache = {
            apis: {},
            models: {},
            system: {},
            lastChecked: null
        };
        this.checkInterval = null;
    }

    async checkAllSystems() {
        const status = {
            timestamp: Date.now(),
            apis: await this.checkAPIs(),
            models: await this.checkModels(),
            storage: await this.checkStorage(),
            system: await this.checkSystemCapabilities(),
            overall: 'unknown'
        };

        // Determine overall health
        status.overall = this.calculateOverallHealth(status);
        
        this.statusCache = status;
        return status;
    }

    async checkAPIs() {
        const apis = {
            summarizer: { name: 'Summarizer API', status: 'checking', required: true },
            prompt: { name: 'Prompt API', status: 'checking', required: true },
            translator: { name: 'Translator API', status: 'checking', required: false },
            proofreader: { name: 'Proofreader API', status: 'checking', required: false },
            rewriter: { name: 'Rewriter API', status: 'checking', required: false },
            writer: { name: 'Writer API', status: 'checking', required: false }
        };

        // Check Summarizer
        if ('Summarizer' in self) {
            try {
                const availability = await Summarizer.availability();
                apis.summarizer.status = availability;
                apis.summarizer.available = availability === 'readily';
            } catch (error) {
                apis.summarizer.status = 'error';
                apis.summarizer.error = error.message;
            }
        } else {
            apis.summarizer.status = 'unavailable';
        }

        // Check Prompt API (Language Model)
        if ('LanguageModel' in self) {
            try {
                const availability = await LanguageModel.availability();
                apis.prompt.status = availability;
                apis.prompt.available = availability === 'readily';
                
                // Check multimodal capabilities
                if (availability === 'readily') {
                    const capabilities = await LanguageModel.capabilities();
                    apis.prompt.multimodal = capabilities?.supportedInputs?.includes('image');
                }
            } catch (error) {
                apis.prompt.status = 'error';
                apis.prompt.error = error.message;
            }
        } else {
            apis.prompt.status = 'unavailable';
        }

        // Check Translator
        if ('Translator' in self) {
            try {
                const availability = await Translator.availability();
                apis.translator.status = availability;
                apis.translator.available = availability === 'readily';
            } catch (error) {
                apis.translator.status = 'error';
            }
        } else {
            apis.translator.status = 'unavailable';
        }

        // Similar checks for other APIs...

        return apis;
    }

    async checkModels() {
        // Note: Can't directly access chrome://components from extension
        // But can infer from API availability
        return {
            geminiNano: {
                name: 'Gemini Nano',
                status: this.statusCache.apis?.summarizer?.status === 'readily' ? 'downloaded' : 'downloading',
                size: '~1.5GB',
                required: true
            }
        };
    }

    async checkStorage() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage,
                available: estimate.quota,
                usedGB: (estimate.usage / 1024 / 1024 / 1024).toFixed(2),
                availableGB: (estimate.quota / 1024 / 1024 / 1024).toFixed(2),
                percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(1),
                meetsRequirements: (estimate.quota - estimate.usage) > 22 * 1024 * 1024 * 1024 // 22GB
            };
        }
        return { available: false };
    }

    async checkSystemCapabilities() {
        return {
            gpu: this.hasGPU(),
            memory: navigator.deviceMemory || 'unknown',
            cores: navigator.hardwareConcurrency || 'unknown',
            platform: navigator.platform,
            userAgent: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Other'
        };
    }

    hasGPU() {
        const canvas = new OffscreenCanvas(1, 1);
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return false;
        
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            return !renderer.toLowerCase().includes('swiftshader');
        }
        return true;
    }

    calculateOverallHealth(status) {
        const criticalAPIs = ['summarizer', 'prompt'];
        const allCriticalReady = criticalAPIs.every(
            api => status.apis[api]?.available === true
        );

        if (allCriticalReady) {
            return 'healthy';
        }

        const anyCriticalDownloading = criticalAPIs.some(
            api => status.apis[api]?.status === 'after-download'
        );

        if (anyCriticalDownloading) {
            return 'downloading';
        }

        return 'error';
    }

    startMonitoring() {
        // Check every 30 seconds when panel is open
        this.checkInterval = setInterval(() => {
            this.checkAllSystems();
        }, 30000);
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

const systemStatus = new SystemStatusService();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_SYSTEM_STATUS') {
        systemStatus.checkAllSystems().then(sendResponse);
        return true;
    }
});
```

### 2. UI Component in sidepanel.html

```html
<!-- System Status Dashboard -->
<section id="system-status-section" class="system-status-section">
    <div class="section-header">
        <h2>
            <span id="system-health-icon" class="health-icon">●</span>
            System Status
        </h2>
        <button id="check-status-btn" class="icon-btn" aria-label="Refresh system status">
            🔄
        </button>
    </div>

    <div class="status-summary">
        <div id="overall-status" class="status-card">
            <span class="status-label">Overall Health</span>
            <span id="overall-status-text" class="status-value">Checking...</span>
        </div>
    </div>

    <!-- AI APIs Status -->
    <details class="status-details" open>
        <summary>AI APIs (6)</summary>
        <div class="status-list">
            <div class="status-item" data-api="summarizer">
                <span class="status-indicator">○</span>
                <div class="status-info">
                    <span class="status-name">Summarizer API</span>
                    <span class="status-badge">Required</span>
                </div>
                <span class="status-state">Checking...</span>
            </div>
            
            <div class="status-item" data-api="prompt">
                <span class="status-indicator">○</span>
                <div class="status-info">
                    <span class="status-name">Prompt API</span>
                    <span class="status-badge">Required</span>
                    <span class="status-feature" data-feature="multimodal" hidden>
                        +Multimodal
                    </span>
                </div>
                <span class="status-state">Checking...</span>
            </div>

            <div class="status-item" data-api="translator">
                <span class="status-indicator">○</span>
                <div class="status-info">
                    <span class="status-name">Translator API</span>
                    <span class="status-badge optional">Optional</span>
                </div>
                <span class="status-state">Checking...</span>
            </div>

            <div class="status-item" data-api="proofreader">
                <span class="status-indicator">○</span>
                <div class="status-info">
                    <span class="status-name">Proofreader API</span>
                    <span class="status-badge optional">Optional</span>
                </div>
                <span class="status-state">Checking...</span>
            </div>

            <div class="status-item" data-api="rewriter">
                <span class="status-indicator">○</span>
                <div class="status-info">
                    <span class="status-name">Rewriter API</span>
                    <span class="status-badge optional">Optional</span>
                </div>
                <span class="status-state">Checking...</span>
            </div>

            <div class="status-item" data-api="writer">
                <span class="status-indicator">○</span>
                <div class="status-info">
                    <span class="status-name">Writer API</span>
                    <span class="status-badge optional">Optional</span>
                </div>
                <span class="status-state">Checking...</span>
            </div>
        </div>
    </details>

    <!-- Model Download Status -->
    <details class="status-details">
        <summary>AI Models</summary>
        <div class="model-status">
            <div class="model-item">
                <div class="model-info">
                    <span class="model-name">Gemini Nano</span>
                    <span class="model-size">~1.5GB</span>
                </div>
                <div class="model-progress">
                    <div id="model-progress-bar" class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span id="model-progress-text" class="progress-text">Ready</span>
                </div>
            </div>
        </div>
    </details>

    <!-- Storage Status -->
    <details class="status-details">
        <summary>Storage</summary>
        <div class="storage-status">
            <div class="storage-bar">
                <div class="storage-used" style="width: 0%"></div>
            </div>
            <div class="storage-info">
                <span id="storage-used">0 GB</span> / 
                <span id="storage-available">0 GB</span>
                <span id="storage-requirements" class="storage-note">
                    (22GB required for AI models)
                </span>
            </div>
        </div>
    </details>

    <!-- System Capabilities -->
    <details class="status-details">
        <summary>System Capabilities</summary>
        <div class="capabilities-grid">
            <div class="capability-item">
                <span class="capability-icon">🖥️</span>
                <span class="capability-label">GPU</span>
                <span id="capability-gpu" class="capability-value">Detecting...</span>
            </div>
            <div class="capability-item">
                <span class="capability-icon">💾</span>
                <span class="capability-label">Memory</span>
                <span id="capability-memory" class="capability-value">--</span>
            </div>
            <div class="capability-item">
                <span class="capability-icon">⚙️</span>
                <span class="capability-label">CPU Cores</span>
                <span id="capability-cores" class="capability-value">--</span>
            </div>
        </div>
    </details>

    <!-- Troubleshooting Hints -->
    <div id="troubleshooting-hints" class="troubleshooting-section" hidden>
        <h3>⚠️ Issues Detected</h3>
        <ul id="troubleshooting-list" class="hint-list">
            <!-- Hints will be inserted dynamically -->
        </ul>
        <a href="SETUP.md#troubleshooting" class="help-link">
            View Full Troubleshooting Guide →
        </a>
    </div>

    <!-- Extension Info -->
    <div class="extension-info">
        <span class="info-label">Extension Version:</span>
        <span id="extension-version">1.0.0</span>
        <span class="info-separator">•</span>
        <a href="https://github.com/[user]/[repo]/releases" target="_blank">
            Check for Updates
        </a>
    </div>
</section>
```

### 3. JavaScript Logic in sidepanel.js

```javascript
// System Status Dashboard
let statusCheckInterval = null;

async function initializeStatusDashboard() {
    await refreshSystemStatus();
    
    // Update extension version
    const manifest = chrome.runtime.getManifest();
    document.getElementById('extension-version').textContent = manifest.version;
}

document.getElementById('check-status-btn').addEventListener('click', async () => {
    const button = document.getElementById('check-status-btn');
    button.classList.add('spinning');
    await refreshSystemStatus();
    button.classList.remove('spinning');
});

async function refreshSystemStatus() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'CHECK_SYSTEM_STATUS'
        });
        
        if (response) {
            updateStatusDashboard(response);
        }
    } catch (error) {
        console.error('Failed to check system status:', error);
    }
}

function updateStatusDashboard(status) {
    // Update overall health indicator
    const healthIcon = document.getElementById('system-health-icon');
    const healthText = document.getElementById('overall-status-text');
    
    switch (status.overall) {
        case 'healthy':
            healthIcon.className = 'health-icon health-good';
            healthIcon.textContent = '●';
            healthText.textContent = 'All Systems Operational';
            healthText.className = 'status-value status-healthy';
            break;
        case 'downloading':
            healthIcon.className = 'health-icon health-warning';
            healthIcon.textContent = '◐';
            healthText.textContent = 'AI Models Downloading';
            healthText.className = 'status-value status-downloading';
            break;
        case 'error':
            healthIcon.className = 'health-icon health-error';
            healthIcon.textContent = '●';
            healthText.textContent = 'Issues Detected';
            healthText.className = 'status-value status-error';
            break;
    }
    
    // Update API statuses
    Object.entries(status.apis).forEach(([apiKey, apiStatus]) => {
        const item = document.querySelector(`[data-api="${apiKey}"]`);
        if (!item) return;
        
        const indicator = item.querySelector('.status-indicator');
        const state = item.querySelector('.status-state');
        
        switch (apiStatus.status) {
            case 'readily':
                indicator.className = 'status-indicator status-ready';
                indicator.textContent = '●';
                state.textContent = 'Ready';
                state.className = 'status-state state-ready';
                break;
            case 'after-download':
                indicator.className = 'status-indicator status-downloading';
                indicator.textContent = '◐';
                state.textContent = 'Downloading';
                state.className = 'status-state state-downloading';
                break;
            case 'unavailable':
            case 'no':
                indicator.className = 'status-indicator status-unavailable';
                indicator.textContent = '○';
                state.textContent = 'Unavailable';
                state.className = 'status-state state-unavailable';
                break;
            default:
                indicator.className = 'status-indicator status-unknown';
                indicator.textContent = '?';
                state.textContent = 'Unknown';
                state.className = 'status-state state-unknown';
        }
        
        // Show multimodal capability if available
        if (apiKey === 'prompt' && apiStatus.multimodal) {
            const multimodalBadge = item.querySelector('[data-feature="multimodal"]');
            if (multimodalBadge) {
                multimodalBadge.hidden = false;
            }
        }
    });
    
    // Update storage info
    if (status.storage) {
        document.getElementById('storage-used').textContent = status.storage.usedGB + ' GB';
        document.getElementById('storage-available').textContent = status.storage.availableGB + ' GB';
        
        const storageBar = document.querySelector('.storage-used');
        storageBar.style.width = status.storage.percentUsed + '%';
        
        if (!status.storage.meetsRequirements) {
            const requirements = document.getElementById('storage-requirements');
            requirements.className = 'storage-note storage-warning';
            requirements.textContent = '⚠️ Insufficient storage for AI models';
        }
    }
    
    // Update system capabilities
    if (status.system) {
        document.getElementById('capability-gpu').textContent = status.system.gpu ? 'Available' : 'Not Detected';
        document.getElementById('capability-memory').textContent = status.system.memory + ' GB';
        document.getElementById('capability-cores').textContent = status.system.cores;
    }
    
    // Generate troubleshooting hints
    generateTroubleshootingHints(status);
}

function generateTroubleshootingHints(status) {
    const hints = [];
    
    // Check for critical API issues
    if (status.apis.summarizer?.status !== 'readily') {
        hints.push({
            severity: 'error',
            message: 'Summarizer API not available. Enable flags in chrome://flags and restart Chrome.',
            action: 'View Setup Guide'
        });
    }
    
    if (status.apis.prompt?.status !== 'readily') {
        hints.push({
            severity: 'error',
            message: 'Prompt API not available. This is required for draft generation.',
            action: 'View Setup Guide'
        });
    }
    
    // Check storage
    if (status.storage && !status.storage.meetsRequirements) {
        hints.push({
            severity: 'warning',
            message: `Only ${status.storage.availableGB}GB available. AI models require 22GB free space.`,
            action: 'Free Up Space'
        });
    }
    
    // Check GPU
    if (status.system && !status.system.gpu) {
        hints.push({
            severity: 'info',
            message: 'GPU not detected. Performance may be slower without GPU acceleration.',
            action: 'Check GPU Settings'
        });
    }
    
    // Display hints
    const hintsSection = document.getElementById('troubleshooting-hints');
    const hintsList = document.getElementById('troubleshooting-list');
    
    if (hints.length > 0) {
        hintsSection.hidden = false;
        hintsList.innerHTML = hints.map(hint => `
            <li class="hint-item hint-${hint.severity}">
                <span class="hint-icon">${getHintIcon(hint.severity)}</span>
                <span class="hint-message">${hint.message}</span>
                <button class="hint-action">${hint.action}</button>
            </li>
        `).join('');
    } else {
        hintsSection.hidden = true;
    }
}

function getHintIcon(severity) {
    switch (severity) {
        case 'error': return '❌';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
        default: return '•';
    }
}

// Initialize on load
initializeStatusDashboard();

// Start monitoring when panel opens
startStatusMonitoring();

function startStatusMonitoring() {
    // Refresh every 30 seconds
    statusCheckInterval = setInterval(refreshSystemStatus, 30000);
}

// Clean up on unload
window.addEventListener('unload', () => {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }
});
```

### 4. CSS Styling

```css
/* System Status Dashboard */
.system-status-section {
    margin: 20px 0;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
}

.health-icon {
    font-size: 20px;
    margin-right: 8px;
}

.health-good { color: #4caf50; }
.health-warning { color: #ff9800; animation: pulse 2s infinite; }
.health-error { color: #f44336; }

.status-summary {
    margin: 16px 0;
}

.status-card {
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: var(--bg-primary);
    border-radius: 6px;
    text-align: center;
}

.status-label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    margin-bottom: 8px;
}

.status-value {
    font-size: 18px;
    font-weight: 600;
}

.status-healthy { color: #4caf50; }
.status-downloading { color: #ff9800; }
.status-error { color: #f44336; }

/* Status Lists */
.status-details {
    margin: 12px 0;
    padding: 12px;
    background: var(--bg-primary);
    border-radius: 6px;
}

.status-details summary {
    cursor: pointer;
    font-weight: 600;
    padding: 8px;
}

.status-details summary:hover {
    background: var(--bg-hover);
}

.status-list, .model-status, .storage-status {
    margin-top: 12px;
}

.status-item {
    display: flex;
    align-items: center;
    padding: 8px;
    margin: 6px 0;
    background: var(--bg-secondary);
    border-radius: 4px;
}

.status-indicator {
    font-size: 16px;
    margin-right: 12px;
    width: 20px;
    text-align: center;
}

.status-ready { color: #4caf50; }
.status-downloading { 
    color: #ff9800;
    animation: spin 2s linear infinite;
}
.status-unavailable { color: #999; }
.status-unknown { color: #666; }

.status-info {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
}

.status-badge {
    padding: 2px 8px;
    background: var(--accent-light);
    color: var(--accent-dark);
    border-radius: 10px;
    font-size: 11px;
    font-weight: 600;
}

.status-badge.optional {
    background: #e0e0e0;
    color: #666;
}

.status-feature {
    font-size: 11px;
    color: var(--accent-color);
    font-weight: 600;
}

/* Troubleshooting */
.troubleshooting-section {
    margin: 16px 0;
    padding: 16px;
    background: #fff3cd;
    border-left: 4px solid #ff9800;
    border-radius: 4px;
}

.troubleshooting-section h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
}

.hint-list {
    list-style: none;
    padding: 0;
    margin: 0 0 12px 0;
}

.hint-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    margin: 6px 0;
    background: white;
    border-radius: 4px;
}

.hint-icon {
    font-size: 18px;
}

.hint-message {
    flex: 1;
    font-size: 13px;
}

.hint-action {
    padding: 4px 12px;
    background: var(--accent-color);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
}

/* Animations */
@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.spinning {
    animation: spin 1s linear infinite;
}
```

---

## 📝 README Updates

```markdown
### System Requirements Check

Before installation, verify your system meets requirements:
- Open the extension
- View "System Status" section
- Ensure all critical APIs show "Ready"
- Check that storage meets 22GB requirement
```

---

## 🧪 Testing Requirements

- [ ] Test with AI models available
- [ ] Test during model download
- [ ] Test with insufficient storage
- [ ] Test with AI APIs unavailable
- [ ] Verify all status indicators update correctly
- [ ] Test troubleshooting hints appear appropriately
- [ ] Verify status refreshes every 30 seconds

---

## 🎥 Demo Video Inclusion

5-second clip showing:
- System Status dashboard
- All APIs showing green "Ready" status
- Text: "Complete system transparency"

---

## 🚀 Success Metrics

- [ ] All 6+ APIs monitored
- [ ] Status updates in real-time
- [ ] Troubleshooting hints are actionable
- [ ] No performance impact from monitoring

---

## 🔗 Related Tasks

- Task 008: Performance Metrics (complementary dashboard)
- Task 006: Demo Video (show status panel)
- Task 007: README (reference system status)


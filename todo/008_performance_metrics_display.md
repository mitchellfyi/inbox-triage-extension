# Task 008: Performance Metrics Display

**Priority**: 🟢 MEDIUM (Demonstrates Technical Excellence)  
**Estimated Effort**: 2-3 hours  
**Deliverable**: Real-time performance dashboard in side panel  
**Status**: [todo]

---

## 📋 Task Description

Add a performance metrics display that shows processing times, memory usage, and API availability status. This demonstrates technical sophistication and provides transparency to users while being perfect showcase material for the hackathon submission.

**Hackathon Value**: Concrete performance data differentiates from vague claims. Shows attention to detail and technical competence.

---

## 🎯 Acceptance Criteria

### Functional Requirements
- [ ] Display real-time processing times for each operation
- [ ] Show memory usage statistics
- [ ] Display API availability status for all APIs
- [ ] Show model download progress (when applicable)
- [ ] Calculate and display time saved
- [ ] Provide performance comparison vs. cloud solutions
- [ ] Collapsible "Advanced Metrics" section
- [ ] Optional "Developer Mode" with detailed stats

### Technical Requirements
- [ ] Use Performance API for accurate timing
- [ ] Monitor memory with performance.memory (where available)
- [ ] Track API call count and success rate
- [ ] Calculate averages and trends
- [ ] Store metrics in chrome.storage.local
- [ ] Export metrics as JSON
- [ ] No performance impact from monitoring (<1% overhead)

### UI Requirements
- [ ] Clean, dashboard-style layout
- [ ] Color-coded status indicators (green/yellow/red)
- [ ] Progress bars for long operations
- [ ] Expandable sections for details
- [ ] Keyboard accessible
- [ ] Screen reader friendly

---

## 🔧 Implementation Details

### 1. Performance Monitoring Service

```javascript
// In service_worker.js - Add PerformanceMonitor class

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            operations: {},
            apiCalls: {},
            sessionStats: {
                threadsProcessed: 0,
                draftsGenerated: 0,
                imagesAnalyzed: 0,
                timeSaved: 0 // in seconds
            }
        };
        this.startTime = Date.now();
    }

    async initialize() {
        // Load previous session stats
        const stored = await chrome.storage.local.get(['performanceMetrics']);
        if (stored.performanceMetrics) {
            this.metrics.sessionStats = {
                ...this.metrics.sessionStats,
                ...stored.performanceMetrics.sessionStats
            };
        }
    }

    startOperation(operationName) {
        const id = `${operationName}-${Date.now()}`;
        this.metrics.operations[id] = {
            name: operationName,
            startTime: performance.now(),
            startMemory: this.getMemoryUsage(),
            completed: false
        };
        return id;
    }

    endOperation(operationId, success = true, details = {}) {
        const operation = this.metrics.operations[operationId];
        if (!operation) return null;

        operation.endTime = performance.now();
        operation.duration = operation.endTime - operation.startTime;
        operation.endMemory = this.getMemoryUsage();
        operation.memoryDelta = operation.endMemory - operation.startMemory;
        operation.completed = true;
        operation.success = success;
        operation.details = details;

        // Update session stats
        this.updateSessionStats(operation.name, operation.duration);

        // Save to storage periodically
        this.saveMetrics();

        return {
            duration: operation.duration,
            memoryUsed: operation.memoryDelta,
            success: operation.success
        };
    }

    trackAPICall(apiName, duration, success = true) {
        if (!this.metrics.apiCalls[apiName]) {
            this.metrics.apiCalls[apiName] = {
                totalCalls: 0,
                successfulCalls: 0,
                failedCalls: 0,
                totalDuration: 0,
                averageDuration: 0,
                lastCalled: null
            };
        }

        const apiStats = this.metrics.apiCalls[apiName];
        apiStats.totalCalls++;
        if (success) {
            apiStats.successfulCalls++;
        } else {
            apiStats.failedCalls++;
        }
        apiStats.totalDuration += duration;
        apiStats.averageDuration = apiStats.totalDuration / apiStats.totalCalls;
        apiStats.lastCalled = Date.now();
    }

    updateSessionStats(operationName, duration) {
        const stats = this.metrics.sessionStats;
        
        switch (operationName) {
            case 'summarization':
                stats.threadsProcessed++;
                // Estimate 5 minutes saved per thread
                stats.timeSaved += 300;
                break;
            case 'draft-generation':
                stats.draftsGenerated++;
                // Estimate 3 minutes saved per draft set
                stats.timeSaved += 180;
                break;
            case 'image-analysis':
                stats.imagesAnalyzed++;
                // Estimate 2 minutes saved per image
                stats.timeSaved += 120;
                break;
        }
    }

    getMemoryUsage() {
        if (performance.memory) {
            return performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        return 0;
    }

    async getMetrics() {
        const recentOperations = Object.values(this.metrics.operations)
            .filter(op => op.completed)
            .sort((a, b) => b.startTime - a.startTime)
            .slice(0, 20); // Last 20 operations

        return {
            sessionStats: this.metrics.sessionStats,
            apiCalls: this.metrics.apiCalls,
            recentOperations: recentOperations,
            currentMemory: this.getMemoryUsage(),
            uptime: Date.now() - this.startTime
        };
    }

    async saveMetrics() {
        // Debounce saves
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(async () => {
            await chrome.storage.local.set({
                performanceMetrics: {
                    sessionStats: this.metrics.sessionStats,
                    lastUpdated: Date.now()
                }
            });
        }, 1000);
    }

    async exportMetrics() {
        const metrics = await this.getMetrics();
        const blob = new Blob([JSON.stringify(metrics, null, 2)], {
            type: 'application/json'
        });
        return URL.createObjectURL(blob);
    }

    reset() {
        this.metrics = {
            operations: {},
            apiCalls: {},
            sessionStats: {
                threadsProcessed: 0,
                draftsGenerated: 0,
                imagesAnalyzed: 0,
                timeSaved: 0
            }
        };
        this.saveMetrics();
    }
}

// Initialize monitor
const performanceMonitor = new PerformanceMonitor();
performanceMonitor.initialize();

// Integrate with existing operations
async function summarizeThread(threadText) {
    const opId = performanceMonitor.startOperation('summarization');
    
    try {
        const summary = await summarizerService.summarize(threadText);
        performanceMonitor.endOperation(opId, true, {
            textLength: threadText.length,
            summaryLength: summary.length
        });
        return summary;
    } catch (error) {
        performanceMonitor.endOperation(opId, false, { error: error.message });
        throw error;
    }
}

// Add message handler for metrics retrieval
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PERFORMANCE_METRICS') {
        performanceMonitor.getMetrics().then(sendResponse);
        return true;
    }
    if (message.type === 'RESET_METRICS') {
        performanceMonitor.reset();
        sendResponse({ success: true });
        return true;
    }
    if (message.type === 'EXPORT_METRICS') {
        performanceMonitor.exportMetrics().then(url => {
            sendResponse({ success: true, downloadUrl: url });
        });
        return true;
    }
});
```

### 2. UI Component in sidepanel.html

```html
<!-- Add Performance Dashboard Section -->
<section id="performance-section" class="performance-section">
    <div class="section-header">
        <h2>
            <span class="icon">⚡</span>
            Performance
        </h2>
        <button id="toggle-performance-btn" 
                class="toggle-btn"
                aria-expanded="false"
                aria-controls="performance-content">
            Show Details
        </button>
    </div>
    
    <div id="performance-content" class="performance-content" hidden>
        <!-- Quick Stats -->
        <div class="quick-stats">
            <div class="stat-card">
                <div class="stat-value" id="stat-threads">0</div>
                <div class="stat-label">Threads Processed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-drafts">0</div>
                <div class="stat-label">Drafts Generated</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-time-saved">0m</div>
                <div class="stat-label">Time Saved</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="stat-memory">0 MB</div>
                <div class="stat-label">Memory Used</div>
            </div>
        </div>

        <!-- API Status -->
        <div class="api-status-section">
            <h3>AI API Status</h3>
            <div class="api-status-list">
                <div class="api-status-item" data-api="summarizer">
                    <div class="status-indicator status-checking"></div>
                    <span class="api-name">Summarizer API</span>
                    <span class="api-stat">Checking...</span>
                </div>
                <div class="api-status-item" data-api="prompt">
                    <div class="status-indicator status-checking"></div>
                    <span class="api-name">Prompt API</span>
                    <span class="api-stat">Checking...</span>
                </div>
                <div class="api-status-item" data-api="translator">
                    <div class="status-indicator status-checking"></div>
                    <span class="api-name">Translator API</span>
                    <span class="api-stat">Checking...</span>
                </div>
                <div class="api-status-item" data-api="proofreader">
                    <div class="status-indicator status-checking"></div>
                    <span class="api-name">Proofreader API</span>
                    <span class="api-stat">Checking...</span>
                </div>
                <div class="api-status-item" data-api="rewriter">
                    <div class="status-indicator status-checking"></div>
                    <span class="api-name">Rewriter API</span>
                    <span class="api-stat">Checking...</span>
                </div>
                <div class="api-status-item" data-api="writer">
                    <div class="status-indicator status-checking"></div>
                    <span class="api-name">Writer API</span>
                    <span class="api-stat">Checking...</span>
                </div>
            </div>
        </div>

        <!-- Recent Operations -->
        <div class="recent-operations-section">
            <h3>Recent Operations</h3>
            <div id="recent-operations-list" class="operations-list">
                <!-- Operations will be inserted here -->
            </div>
        </div>

        <!-- Actions -->
        <div class="performance-actions">
            <button id="refresh-metrics-btn" class="secondary-btn">
                🔄 Refresh
            </button>
            <button id="export-metrics-btn" class="secondary-btn">
                📥 Export Data
            </button>
            <button id="reset-metrics-btn" class="secondary-btn warning">
                🗑️ Reset Stats
            </button>
        </div>

        <!-- Developer Mode (Optional) -->
        <details class="developer-mode">
            <summary>Developer Mode</summary>
            <div class="developer-content">
                <h4>API Call Statistics</h4>
                <div id="api-call-stats"></div>
                <h4>Memory Profile</h4>
                <div id="memory-profile"></div>
            </div>
        </details>
    </div>
</section>
```

### 3. JavaScript Logic in sidepanel.js

```javascript
// Performance dashboard logic
let metricsRefreshInterval = null;

document.getElementById('toggle-performance-btn').addEventListener('click', () => {
    const content = document.getElementById('performance-content');
    const button = document.getElementById('toggle-performance-btn');
    const isHidden = content.hidden;
    
    content.hidden = !isHidden;
    button.textContent = isHidden ? 'Hide Details' : 'Show Details';
    button.setAttribute('aria-expanded', isHidden.toString());
    
    if (isHidden) {
        // Start refreshing metrics
        refreshPerformanceMetrics();
        metricsRefreshInterval = setInterval(refreshPerformanceMetrics, 5000);
    } else {
        // Stop refreshing
        clearInterval(metricsRefreshInterval);
    }
});

async function refreshPerformanceMetrics() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_PERFORMANCE_METRICS'
        });
        
        if (response) {
            updatePerformanceDashboard(response);
        }
    } catch (error) {
        console.error('Failed to refresh metrics:', error);
    }
}

function updatePerformanceDashboard(metrics) {
    // Update quick stats
    document.getElementById('stat-threads').textContent = metrics.sessionStats.threadsProcessed;
    document.getElementById('stat-drafts').textContent = metrics.sessionStats.draftsGenerated;
    document.getElementById('stat-time-saved').textContent = formatTimeSaved(metrics.sessionStats.timeSaved);
    document.getElementById('stat-memory').textContent = `${metrics.currentMemory.toFixed(1)} MB`;
    
    // Update API status
    updateAPIStatus(metrics.apiCalls);
    
    // Update recent operations
    updateRecentOperations(metrics.recentOperations);
    
    // Update developer mode
    if (document.querySelector('.developer-mode[open]')) {
        updateDeveloperStats(metrics);
    }
}

function updateAPIStatus(apiCalls) {
    Object.entries(apiCalls).forEach(([apiName, stats]) => {
        const item = document.querySelector(`[data-api="${apiName}"]`);
        if (!item) return;
        
        const indicator = item.querySelector('.status-indicator');
        const statSpan = item.querySelector('.api-stat');
        
        const successRate = (stats.successfulCalls / stats.totalCalls * 100).toFixed(1);
        const avgDuration = stats.averageDuration.toFixed(0);
        
        // Set status color based on success rate
        if (successRate >= 95) {
            indicator.className = 'status-indicator status-ready';
        } else if (successRate >= 70) {
            indicator.className = 'status-indicator status-warning';
        } else {
            indicator.className = 'status-indicator status-error';
        }
        
        statSpan.textContent = `${stats.totalCalls} calls • ${avgDuration}ms avg • ${successRate}% success`;
    });
}

function updateRecentOperations(operations) {
    const list = document.getElementById('recent-operations-list');
    list.innerHTML = '';
    
    operations.slice(0, 5).forEach(op => {
        const item = document.createElement('div');
        item.className = 'operation-item';
        
        const icon = op.success ? '✓' : '✗';
        const statusClass = op.success ? 'success' : 'error';
        
        item.innerHTML = `
            <span class="operation-icon ${statusClass}">${icon}</span>
            <div class="operation-details">
                <div class="operation-name">${formatOperationName(op.name)}</div>
                <div class="operation-stats">
                    ${op.duration.toFixed(0)}ms
                    ${op.memoryDelta > 0 ? `• +${op.memoryDelta.toFixed(1)}MB` : ''}
                </div>
            </div>
            <span class="operation-time">${formatTimeAgo(op.startTime)}</span>
        `;
        
        list.appendChild(item);
    });
}

function formatTimeSaved(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

function formatOperationName(name) {
    return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}

// Export metrics
document.getElementById('export-metrics-btn').addEventListener('click', async () => {
    const response = await chrome.runtime.sendMessage({ type: 'EXPORT_METRICS' });
    if (response.success) {
        const a = document.createElement('a');
        a.href = response.downloadUrl;
        a.download = `inbox-triage-metrics-${Date.now()}.json`;
        a.click();
        showSuccess('Metrics exported successfully');
    }
});

// Reset metrics
document.getElementById('reset-metrics-btn').addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all performance statistics?')) {
        await chrome.runtime.sendMessage({ type: 'RESET_METRICS' });
        refreshPerformanceMetrics();
        showSuccess('Metrics reset successfully');
    }
});
```

### 4. CSS Styling

```css
/* Performance Dashboard */
.performance-section {
    margin: 20px 0;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 8px;
}

.quick-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
}

.stat-card {
    text-align: center;
    padding: 16px;
    background: var(--bg-primary);
    border-radius: 6px;
    border: 1px solid var(--border-color);
}

.stat-value {
    font-size: 24px;
    font-weight: bold;
    color: var(--accent-color);
    margin-bottom: 4px;
}

.stat-label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.api-status-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.api-status-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--bg-primary);
    border-radius: 4px;
}

.status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
}

.status-ready { background: #4caf50; }
.status-warning { background: #ff9800; }
.status-error { background: #f44336; }
.status-checking {
    background: #2196f3;
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
}

.api-name {
    flex: 1;
    font-weight: 500;
}

.api-stat {
    font-size: 12px;
    color: var(--text-secondary);
}

.operation-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    background: var(--bg-primary);
    border-radius: 4px;
    margin-bottom: 6px;
}

.operation-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: bold;
}

.operation-icon.success {
    background: #4caf50;
    color: white;
}

.operation-icon.error {
    background: #f44336;
    color: white;
}

.operation-details {
    flex: 1;
}

.operation-name {
    font-size: 14px;
    font-weight: 500;
}

.operation-stats {
    font-size: 12px;
    color: var(--text-secondary);
}

.operation-time {
    font-size: 11px;
    color: var(--text-tertiary);
}

.performance-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
}

.performance-actions button {
    flex: 1;
    padding: 8px;
    font-size: 13px;
}

.warning {
    background: #ff9800;
    color: white;
}

.warning:hover {
    background: #f57c00;
}
```

---

## 📝 README Updates

Add to Performance Metrics section:

```markdown
## ⚡ Real-Time Performance Monitoring

View detailed metrics in the extension:
- Processing times for each operation
- Memory usage statistics
- API availability status
- Time saved calculations
- Success rates and error tracking

Click "Show Details" in the Performance section to see your stats.
```

---

## 🧪 Testing Requirements

- [ ] Verify metrics accuracy against manual measurements
- [ ] Test with extended usage (100+ operations)
- [ ] Verify memory usage calculations
- [ ] Test export functionality
- [ ] Test reset functionality
- [ ] Verify metrics persist across browser restarts
- [ ] Test with all 6 APIs active
- [ ] Verify performance impact is minimal
- [ ] Test keyboard navigation
- [ ] Test screen reader compatibility

---

## 🎥 Demo Video Inclusion

Include 10-second segment showing:
- Quick stats dashboard
- API status indicators (all green)
- Recent operations list
- Text overlay: "Real-time performance monitoring"

---

## 🚀 Success Metrics

- [ ] All operations tracked accurately
- [ ] Performance overhead <1%
- [ ] Metrics display updates in real-time
- [ ] Export/reset functions work correctly
- [ ] Feature shown in demo video

---

## 🔗 Related Tasks

- Task 007: README API Showcase (use metrics data)
- Task 006: Demo Video (show metrics)
- Task 014: System Status Panel (complementary)


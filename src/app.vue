<template>
  <div class="container">
    <div class="controls">
      <div class="controls-group">
        <button @click="clearLogs">Clear Logs</button>
        <button @click="reconnect" :disabled="isConnecting">Reconnect</button>
        <input v-model="filterText" type="text" placeholder="Filter logs..." />
      </div>
      <div class="controls-group level-filter">
        <label
          v-for="level in logLevels"
          :key="level.value"
          :title="level.label"
        >
          <input type="checkbox" v-model="level.enabled" />
          {{ level.label }}
        </label>
      </div>
      <div class="controls-group">
        <label>
          <input type="checkbox" v-model="autoScroll" /> Auto-scroll
        </label>
        <span class="log-stats">{{ logStatsText }}</span>
      </div>
      <div class="spacer"></div>
      <div :class="connectionStatusClass">
        {{ connectionStatusText }}
      </div>
    </div>
    <div class="code-execution">
      <select class="page-select" v-model="selectedPage">
        <option value="">Select a page...</option>
        <option v-for="page in pages" :key="page" :value="page">
          {{ getPagePath(page) }}
        </option>
      </select>
      <textarea
        class="code-input"
        v-model="codeInput"
        placeholder="Enter JavaScript code to execute..."
      ></textarea>
      <div class="execution-controls">
        <button @click="executeCode" :disabled="!canExecute">
          Execute Code
        </button>
      </div>
      <pre :class="executionResultClass" v-show="executionResult">{{
        executionResult
      }}</pre>
    </div>
    <div class="log-container" ref="logContainer">
      <div
        v-for="log in filteredLogs"
        :key="log.timestamp"
        :class="['log-entry', `log-level-${log.level}`]"
      >
        <span class="timestamp">{{ formatTimestamp(log.timestamp) }}</span>
        <span class="url" v-if="selectedPage == ''">{{
          getPagePath(log.url)
        }}</span>
        <span class="content" v-html="formatLogContent(log)"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  reactive,
  computed,
  onMounted,
  onBeforeUnmount,
  watch,
  nextTick,
} from 'vue';

// 常量
const RECONNECT_INTERVAL = 3000;
const MAX_RETRY_COUNT = 5;

// 响应式状态
const ws = ref(null);
const logs = ref([]);
const pages = ref([]);
const selectedPage = ref('');
const codeInput = ref('');
const executionResult = ref('');
const isExecutionError = ref(false);
const filterText = ref('');
const autoScroll = ref(true);
const connectionStatus = ref('Disconnected');
const connectionMessage = ref('');
const retryCount = ref(0);
const reconnectTimeout = ref(null);
const logContainer = ref(null);
// 日志级别
const logLevels = reactive([
  { value: 'log', label: 'Log', enabled: true },
  { value: 'info', label: 'Info', enabled: true },
  { value: 'warn', label: 'Warn', enabled: true },
  { value: 'error', label: 'Error', enabled: true },
]);

// 计算属性
const isConnecting = computed(() => connectionStatus.value === 'Connecting');

const connectionStatusClass = computed(() => ({
  'connection-status': true,
  [connectionStatus.value.toLowerCase()]: true,
}));

const connectionStatusText = computed(() =>
  connectionMessage.value
    ? `${connectionStatus.value} (${connectionMessage.value})`
    : connectionStatus.value
);

const canExecute = computed(() => selectedPage.value && !isConnecting.value);

const executionResultClass = computed(() => ({
  'execution-result': true,
  'has-content': executionResult.value,
  error: isExecutionError.value,
}));

const filteredLogs = computed(() => {
  const enabledLevels = logLevels.filter((l) => l.enabled).map((l) => l.value);
  return logs.value
    .filter((log) =>
      selectedPage.value ? log.url === selectedPage.value : true
    )
    .filter((log) => {
      if (!enabledLevels.includes(log.level)) return false;
      if (!filterText.value) return true;
      return log.args
        .join(' ')
        .toLowerCase()
        .includes(filterText.value.toLowerCase());
    });
});

const logStatsText = computed(() => {
  const total = logs.value.length;
  const filtered = filteredLogs.value.length;
  return filtered === total ? `Logs: ${total}` : `Logs: ${filtered}/${total}`;
});

// WebSocket URL
const WS_URL = (() => {
  const query = new URLSearchParams(window.location.search);
  const host = query.get('host');
  return host
    ? `ws://${host}/ws-logger/viewer`
    : `wss://${window.location.host}/ws-logger/viewer`;
})();

// 方法
function updateConnectionStatus(status, message = '') {
  connectionStatus.value = status;
  connectionMessage.value = message;
}

function createWebSocket() {
  if (ws.value) {
    ws.value.close();
  }

  updateConnectionStatus('Connecting');
  ws.value = new WebSocket(WS_URL);

  ws.value.onopen = () => {
    updateConnectionStatus('Connected');
    retryCount.value = 0;
  };

  ws.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'pages':
          pages.value = data.pages;
          break;
        case 'result':
          showExecutionResult(data.error || data.result, !!data.error);
          break;
        case 'log':
        default:
          logs.value.push(data);
          break;
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  };

  ws.value.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('Error', 'Connection failed');
  };

  ws.value.onclose = () => {
    updateConnectionStatus('Disconnected');
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (retryCount.value >= MAX_RETRY_COUNT) {
    updateConnectionStatus('Disconnected', 'Max retries reached');
    return;
  }

  if (reconnectTimeout.value) {
    clearTimeout(reconnectTimeout.value);
  }

  reconnectTimeout.value = setTimeout(() => {
    retryCount.value++;
    updateConnectionStatus(
      'Connecting',
      `Attempt ${retryCount.value}/${MAX_RETRY_COUNT}`
    );
    createWebSocket();
  }, RECONNECT_INTERVAL);
}

function formatLogContent(log) {
  return log.args
    .map((arg) => {
      try {
        if (
          typeof arg === 'string' &&
          (arg.startsWith('{') || arg.startsWith('['))
        ) {
          const parsed = JSON.parse(arg);
          return JSON.stringify(parsed, null, 2);
        }
        if (typeof arg === 'string' && arg.includes('<')) {
          return arg.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
        return arg;
      } catch {
        return arg;
      }
    })
    .join(' ');
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function getPagePath(url) {
  return url;
}

function clearLogs() {
  logs.value = [];
}

function executeCode() {
  if (!selectedPage.value || !codeInput.value.trim()) {
    showExecutionResult('Please select a page and enter code to execute', true);
    return;
  }

  try {
    ws.value.send(
      JSON.stringify({
        type: 'execute',
        targetUrl: selectedPage.value,
        code: codeInput.value.trim(),
      })
    );
  } catch (error) {
    showExecutionResult(
      'Failed to send execution request: ' + error.message,
      true
    );
  }
}

function showExecutionResult(result, isError = false) {
  executionResult.value = result;
  isExecutionError.value = isError;
}

function reconnect() {
  retryCount.value = 0;
  if (reconnectTimeout.value) {
    clearTimeout(reconnectTimeout.value);
    reconnectTimeout.value = null;
  }
  createWebSocket();
}

// 监听器
watch(autoScroll, (newValue) => {
  if (newValue) {
    nextTick(() => {
      if (logContainer.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    });
  }
});

watch(
  filteredLogs,
  () => {
    if (autoScroll.value) {
      nextTick(() => {
        if (logContainer.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }
      });
    }
  },
  { flush: 'post' }
);

// 生命周期钩子
onMounted(() => {
  createWebSocket();
});

onBeforeUnmount(() => {
  if (ws.value) {
    ws.value.close();
  }
  if (reconnectTimeout.value) {
    clearTimeout(reconnectTimeout.value);
  }
});
</script>

<style>
/* 保持原有样式不变 */
:root {
  /* Color Variables */
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d2d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --border-color: #404040;

  /* Log Level Colors */
  --log-color: #8b949e;
  --info-color: #58a6ff;
  --warn-color: #d29922;
  --error-color: #f85149;

  /* Status Colors */
  --connected-color: #238636;
  --disconnected-color: #f85149;
  --connecting-color: #d29922;

  /* UI Elements */
  --button-bg: #2ea043;
  --button-hover-bg: #3fb950;
  --button-active-bg: #238636;
  --input-bg: #0d1117;
  --input-border: #30363d;
  --input-focus-border: #58a6ff;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  height: 100vh;
  overflow: hidden;
}

.container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  gap: 1rem;
}

.controls,
.code-execution {
  background-color: var(--bg-secondary);
  padding: 1rem;
  border-radius: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  border: 1px solid var(--border-color);
}

.code-execution {
  flex-direction: column;
  align-items: stretch;
}

.code-input {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text-primary);
  padding: 0.5rem;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  min-height: 100px;
  resize: vertical;
}

.code-input:focus {
  outline: none;
  border-color: var(--input-focus-border);
}

.execution-controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.page-select {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text-primary);
  padding: 0.5rem;
  border-radius: 4px;
  font-size: 0.9rem;
  flex-grow: 1;
}

.page-select:focus {
  outline: none;
  border-color: var(--input-focus-border);
}

.execution-result {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text-primary);
  padding: 0.5rem;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  min-height: 50px;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  display: none;
}

.execution-result.has-content {
  display: block;
}

.execution-result.error {
  color: var(--error-color);
  border-color: var(--error-color);
}

.controls-group {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

button {
  background-color: var(--button-bg);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

button:hover {
  background-color: var(--button-hover-bg);
}

button:active {
  background-color: var(--button-active-bg);
}

button:disabled {
  background-color: var(--text-secondary);
  cursor: not-allowed;
  opacity: 0.7;
}

input[type='text'] {
  background-color: var(--input-bg);
  border: 1px solid var(--input-border);
  color: var(--text-primary);
  padding: 0.5rem;
  border-radius: 4px;
  min-width: 200px;
  font-size: 0.9rem;
}

input[type='text']:focus {
  outline: none;
  border-color: var(--input-focus-border);
}

.level-filter {
  display: flex;
  gap: 1rem;
}

.level-filter label {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  user-select: none;
}

input[type='checkbox'] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.spacer {
  flex-grow: 1;
}

.connection-status {
  padding: 0.3rem 0.8rem;
  border-radius: 12px;
  font-size: 0.9rem;
  font-weight: 500;
}

.connection-status.connected {
  background-color: var(--connected-color);
}

.connection-status.disconnected {
  background-color: var(--disconnected-color);
}

.connection-status.connecting {
  background-color: var(--connecting-color);
}

.connection-status.error {
  background-color: var(--error-color);
}

.log-container {
  flex-grow: 1;
  background-color: var(--bg-secondary);
  border-radius: 6px;
  overflow-y: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  border: 1px solid var(--border-color);
}

.log-entry {
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--border-color);
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 1rem;
  align-items: start;
}

.log-entry:hover {
  background-color: var(--bg-tertiary);
}

.timestamp {
  color: var(--text-secondary);
  white-space: nowrap;
}

.url {
  color: var(--text-secondary);
  white-space: nowrap;
}

.content {
  overflow-x: auto;
  white-space: pre-wrap;
}

.log-level-log {
  color: var(--log-color);
}

.log-level-info {
  color: var(--info-color);
}

.log-level-warn {
  color: var(--warn-color);
}

.log-level-error {
  color: var(--error-color);
}

.log-stats {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

/* Responsive Design */
@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
  }

  .controls-group {
    justify-content: center;
  }

  .level-filter {
    justify-content: center;
  }

  input[type='text'] {
    width: 100%;
  }

  .log-entry {
    grid-template-columns: 1fr;
    gap: 0.3rem;
  }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--bg-primary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>

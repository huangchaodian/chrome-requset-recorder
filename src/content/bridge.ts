/**
 * Content Script - Bridge（运行在 ISOLATED world）
 *
 * 1. 监听来自 MAIN world interceptor 的 window.postMessage，转发给 background
 * 2. 从 chrome.storage 读取 Map Remote 规则，传递给 MAIN world interceptor
 * 3. 监听 storage 变化，实时更新 MAIN world 的规则
 */

const RESPONSE_BODY_EVENT = '__REQUEST_RECORDER_RESPONSE_BODY__';
const MAP_REMOTE_RULES_EVENT = '__REQUEST_RECORDER_MAP_REMOTE_RULES__';

// ========== 响应体转发 ==========
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== RESPONSE_BODY_EVENT) return;

  const { url, method, responseBody } = event.data.payload as {
    url: string;
    method: string;
    responseBody: string;
  };

  if (url.startsWith('chrome-extension://')) return;

  chrome.runtime
    .sendMessage({
      type: 'UPDATE_RESPONSE_BODY',
      payload: { url, method, responseBody },
    })
    .catch(() => {});
});

// ========== Map Remote 规则同步到 MAIN world ==========
function pushRulesToMainWorld(rules: unknown[], enabled: boolean): void {
  window.postMessage(
    {
      type: MAP_REMOTE_RULES_EVENT,
      payload: { rules: enabled ? rules : [], enabled },
    },
    '*'
  );
}

/** 从 storage 加载并推送规则 */
async function loadAndPushRules(): Promise<void> {
  const result = await chrome.storage.local.get(['map_remote_rules', 'map_remote_enabled']) as Record<string, unknown>;
  const rules = (result['map_remote_rules'] as unknown[]) || [];
  const enabled = result['map_remote_enabled'] !== false;
  pushRulesToMainWorld(rules, enabled);
}

// 启动时加载一次
loadAndPushRules();

// 监听 storage 变化，实时更新
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') {
    loadAndPushRules();
  }
});

console.log('[Request Recorder] Bridge content script loaded (ISOLATED world)');
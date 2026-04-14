/**
 * Content Script - Bridge（运行在 ISOLATED world）
 *
 * 监听来自 MAIN world interceptor 的 window.postMessage，
 * 通过 chrome.runtime.sendMessage 转发给 background service worker。
 */

const RESPONSE_BODY_EVENT = '__REQUEST_RECORDER_RESPONSE_BODY__';

window.addEventListener('message', (event) => {
  // 只处理来自同源的消息
  if (event.source !== window) return;
  if (!event.data || event.data.type !== RESPONSE_BODY_EVENT) return;

  const { url, method, responseBody } = event.data.payload as {
    url: string;
    method: string;
    responseBody: string;
  };

  // 跳过扩展自身的请求
  if (url.startsWith('chrome-extension://')) return;

  // 转发给 background
  chrome.runtime
    .sendMessage({
      type: 'UPDATE_RESPONSE_BODY',
      payload: { url, method, responseBody },
    })
    .catch(() => {
      // background 可能未就绪，忽略
    });
});

console.log('[Request Recorder] Bridge content script loaded (ISOLATED world)');
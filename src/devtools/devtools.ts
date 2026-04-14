/**
 * DevTools 注册脚本
 * 在 Chrome DevTools 中创建 "Request Recorder" 面板
 * 并监听网络请求获取响应体
 */

chrome.devtools.panels.create(
  'Request Recorder',
  '',
  'src/devtools/index.html'
);

// 在 devtools page 中监听网络请求完成事件，获取响应体
chrome.devtools.network.onRequestFinished.addListener((request) => {
  const url = request.request.url;
  if (url.startsWith('chrome-extension://')) return;

  const method = request.request.method;

  request.getContent((content, _encoding) => {
    if (!content) return;

    // 通过 runtime 消息通知 background 和 panel 更新响应体
    chrome.runtime.sendMessage({
      type: 'UPDATE_RESPONSE_BODY',
      payload: { url, method, responseBody: content },
    }).catch(() => {});
  });
});
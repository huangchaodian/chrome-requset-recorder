/**
 * DevTools 注册脚本
 * 在 Chrome DevTools 中创建 "Request Recorder" 面板
 *
 * 注意：响应体捕获已迁移到 background service worker 中使用 chrome.debugger API，
 * 不再依赖 DevTools 面板打开。
 */

chrome.devtools.panels.create(
  'Request Recorder',
  '',
  'src/devtools/index.html'
);
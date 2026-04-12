/**
 * DevTools 注册脚本
 * 在 Chrome DevTools 中创建 "Request Recorder" 面板
 */
chrome.devtools.panels.create(
  'Request Recorder',
  '',
  'src/devtools/index.html'
);
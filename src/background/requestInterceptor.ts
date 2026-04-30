import type { RequestRecord, Header } from '../shared/types';
import { requestStore } from './requestStore';

/**
 * 请求拦截器
 * 使用 chrome.webRequest API 捕获所有 HTTP/HTTPS 请求
 * 通过 requestId 关联同一请求的不同阶段数据
 */

/** 临时存储正在进行中的请求数据（尚未完成） */
interface PendingRequest {
  url: string;
  method: string;
  requestHeaders: Header[];
  requestBody: string | null;
  timestamp: number;
  tabId: number;
  type: string;
}

const pendingRequests = new Map<string, PendingRequest>();

/** 生成 UUID */
function generateId(): string {
  return crypto.randomUUID();
}

/** 获取标签页 URL */
async function getTabUrl(tabId: number): Promise<string> {
  try {
    if (tabId < 0) return '';
    const tab = await chrome.tabs.get(tabId);
    return tab.url || '';
  } catch {
    return '';
  }
}

/** 解析请求体 */
function parseRequestBody(
  details: chrome.webRequest.WebRequestBodyDetails
): string | null {
  if (!details.requestBody) return null;

  if (details.requestBody.formData) {
    try {
      return JSON.stringify(details.requestBody.formData);
    } catch {
      return '[FormData]';
    }
  }

  if (details.requestBody.raw && details.requestBody.raw.length > 0) {
    try {
      const decoder = new TextDecoder('utf-8');
      const parts = details.requestBody.raw
        .filter((part) => part.bytes)
        .map((part) => decoder.decode(part.bytes));
      return parts.join('');
    } catch {
      return '[Binary Data]';
    }
  }

  return null;
}

/** URL 过滤器 */
const URL_FILTER: chrome.webRequest.RequestFilter = {
  urls: ['<all_urls>'],
};

/** 域名过滤配置（由 messageHandler / 初始化同步更新） */
let domainFilterEnabled = false;
let recordDomains: string[] = [];

/** 更新域名过滤配置 */
export function updateDomainFilter(enabled: boolean, domains: string[]): void {
  domainFilterEnabled = enabled;
  recordDomains = (domains || [])
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** 判断 URL 主机名是否匹配配置的域名（支持 .example.com 后缀匹配） */
function matchDomain(url: string): boolean {
  if (!domainFilterEnabled) return true;
  if (recordDomains.length === 0) return false; // 启用过滤但未配置：录制为空
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return recordDomains.some((d) => {
    if (d.startsWith('.')) {
      // 后缀匹配
      return host === d.slice(1) || host.endsWith(d);
    }
    return host === d || host.endsWith('.' + d);
  });
}

/** 回调函数：onBeforeRequest - 捕获请求体和基本信息 */
function onBeforeRequest(
  details: chrome.webRequest.WebRequestBodyDetails
): void {
  // 跳过扩展自身的请求
  if (details.url.startsWith('chrome-extension://')) return;

  // 仅录制 XMLHttpRequest 和 fetch 请求
  if (details.type !== 'xmlhttprequest') return;

  // 域名过滤
  if (!matchDomain(details.url)) return;

  pendingRequests.set(details.requestId, {
    url: details.url,
    method: details.method,
    requestHeaders: [],
    requestBody: parseRequestBody(details),
    timestamp: details.timeStamp,
    tabId: details.tabId,
    type: details.type,
  });
}

/** 回调函数：onBeforeSendHeaders - 捕获最终请求头 */
function onSendHeaders(
  details: chrome.webRequest.WebRequestHeadersDetails
): void {
  const pending = pendingRequests.get(details.requestId);
  if (!pending) return;

  pending.requestHeaders = (details.requestHeaders || []).map((h) => ({
    name: h.name,
    value: h.value || '',
  }));
}

/** 回调函数：onCompleted - 捕获响应信息、组装完整记录 */
async function onCompleted(
  details: chrome.webRequest.WebResponseCacheDetails
): Promise<void> {
  const pending = pendingRequests.get(details.requestId);
  if (!pending) return;

  // 清理临时数据
  pendingRequests.delete(details.requestId);

  const tabUrl = await getTabUrl(pending.tabId);
  const duration = details.timeStamp - pending.timestamp;

  const record: RequestRecord = {
    id: generateId(),
    url: pending.url,
    method: pending.method,
    requestHeaders: pending.requestHeaders,
    requestBody: pending.requestBody,
    responseStatus: details.statusCode,
    responseHeaders: (details.responseHeaders || []).map((h) => ({
      name: h.name,
      value: h.value || '',
    })),
    responseBody: null, // webRequest API 无法获取响应体，后续可通过 debugger API 增强
    timestamp: pending.timestamp,
    duration: Math.max(0, Math.round(duration)),
    tabId: pending.tabId,
    tabUrl,
    type: 'recorded',
  };

  requestStore.add(record);

  // 通知所有 UI 页面有新请求
  broadcastNewRequest(record);
}

/** 回调函数：onErrorOccurred - 请求出错时清理临时数据 */
function onErrorOccurred(
  details: chrome.webRequest.WebResponseErrorDetails
): void {
  pendingRequests.delete(details.requestId);
}

/** 向所有打开的 UI 页面广播新请求 */
function broadcastNewRequest(record: RequestRecord): void {
  chrome.runtime.sendMessage({
    type: 'NEW_REQUEST',
    payload: record,
  }).catch(() => {
    // 没有监听者时会抛错，忽略即可
  });
}

/** 启动请求拦截器 */
export function startInterceptor(): void {
  chrome.webRequest.onBeforeRequest.addListener(
    onBeforeRequest,
    URL_FILTER,
    ['requestBody']
  );

  chrome.webRequest.onSendHeaders.addListener(
    onSendHeaders,
    URL_FILTER,
    ['requestHeaders']
  );

  chrome.webRequest.onCompleted.addListener(
    onCompleted,
    URL_FILTER,
    ['responseHeaders']
  );

  chrome.webRequest.onErrorOccurred.addListener(
    onErrorOccurred,
    URL_FILTER
  );

  console.log('[Request Recorder] Interceptor started');
}

/** 停止请求拦截器 */
export function stopInterceptor(): void {
  chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
  chrome.webRequest.onSendHeaders.removeListener(onSendHeaders);
  chrome.webRequest.onCompleted.removeListener(onCompleted);
  chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
  pendingRequests.clear();

  console.log('[Request Recorder] Interceptor stopped');
}
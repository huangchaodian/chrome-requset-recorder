import type { RequestRecord, ReplayResult, Header } from '../shared/types';
import { requestStore } from './requestStore';

/**
 * 请求重放引擎
 * 使用 Fetch API 从 Service Worker 发起请求重放
 */

/** 需要排除的请求头（浏览器自动管理，不应手动设置） */
const EXCLUDED_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'origin',
  'referer',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
]);

/** 过滤请求头，移除浏览器自动管理的头 */
function filterHeaders(headers: Header[]): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const h of headers) {
    if (!EXCLUDED_HEADERS.has(h.name.toLowerCase())) {
      filtered[h.name] = h.value;
    }
  }
  return filtered;
}

/** 不应携带请求体的方法 */
const NO_BODY_METHODS = new Set(['GET', 'HEAD']);

/**
 * 执行请求重放
 * @param record 要重放的请求记录
 * @returns 重放结果
 */
export async function replayRequest(record: RequestRecord): Promise<ReplayResult> {
  const startTime = Date.now();

  const fetchOptions: RequestInit = {
    method: record.method,
    headers: filterHeaders(record.requestHeaders),
  };

  // 仅非 GET/HEAD 方法携带请求体
  if (!NO_BODY_METHODS.has(record.method.toUpperCase()) && record.requestBody) {
    fetchOptions.body = record.requestBody;
  }

  const response = await fetch(record.url, fetchOptions);
  const duration = Date.now() - startTime;
  const responseBody = await response.text();
  const responseHeaders: Header[] = [];
  response.headers.forEach((value, name) => {
    responseHeaders.push({ name, value });
  });

  // 将重放结果作为新记录添加到请求列表
  const replayedRecord: RequestRecord = {
    id: crypto.randomUUID(),
    url: record.url,
    method: record.method,
    requestHeaders: record.requestHeaders,
    requestBody: record.requestBody,
    responseStatus: response.status,
    responseHeaders,
    responseBody,
    timestamp: startTime,
    duration: Math.round(duration),
    tabId: -1,
    tabUrl: '',
    type: 'replayed',
    parentId: record.id,
  };

  // 重放记录不受 isRecording 状态影响，直接插入
  requestStore.getAll(); // 确保 store 可用
  const currentRecording = requestStore.getRecordingStatus();
  if (!currentRecording) {
    // 临时启用以添加记录
    requestStore.setRecording(true);
    requestStore.add(replayedRecord);
    requestStore.setRecording(false);
  } else {
    requestStore.add(replayedRecord);
  }

  // 广播新请求给 UI
  chrome.runtime.sendMessage({
    type: 'NEW_REQUEST',
    payload: replayedRecord,
  }).catch(() => {
    // 无监听者时忽略
  });

  return {
    status: response.status,
    headers: responseHeaders,
    body: responseBody,
    duration: Math.round(duration),
  };
}
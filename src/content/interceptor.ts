/**
 * Content Script - 页面请求拦截器（运行在 MAIN world）
 *
 * 1. monkey patch fetch/XHR 捕获响应体
 * 2. Map Remote: 在请求发起前重写 URL（避免网络层重定向导致 CORS preflight 失败）
 */

const RESPONSE_BODY_EVENT = '__REQUEST_RECORDER_RESPONSE_BODY__';
const MAP_REMOTE_RULES_EVENT = '__REQUEST_RECORDER_MAP_REMOTE_RULES__';

// ========== Map Remote 规则 ==========
interface MapRule {
  enabled: boolean;
  fromProtocol: string;
  fromHost: string;
  fromPort: string;
  fromPath: string;
  toProtocol: string;
  toHost: string;
  toPort: string;
  toPath: string;
}

let mapRemoteRules: MapRule[] = [];

/** 监听来自 bridge 的规则更新 */
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== MAP_REMOTE_RULES_EVENT) return;
  const { rules } = event.data.payload;
  mapRemoteRules = (rules || []).filter((r: MapRule) => r.enabled && r.fromHost && r.toHost);
});

/** 对 URL 应用 Map Remote 规则，返回重写后的 URL（无匹配则返回原 URL） */
function applyMapRemote(originalUrl: string): string {
  if (mapRemoteRules.length === 0) return originalUrl;

  try {
    const u = new URL(originalUrl);

    for (const rule of mapRemoteRules) {
      // 匹配协议
      if (rule.fromProtocol !== '*' && u.protocol !== rule.fromProtocol + ':') continue;
      // 匹配主机
      if (u.hostname !== rule.fromHost) continue;
      // 匹配端口
      if (rule.fromPort && u.port !== rule.fromPort) continue;
      // 匹配路径前缀
      if (rule.fromPath && !u.pathname.startsWith('/' + rule.fromPath)) continue;

      // 命中规则 —— 构建新 URL
      u.protocol = rule.toProtocol + ':';
      u.hostname = rule.toHost;
      u.port = rule.toPort || '';

      if (rule.toPath) {
        if (rule.fromPath) {
          u.pathname = '/' + rule.toPath + u.pathname.slice(1 + rule.fromPath.length);
        } else {
          u.pathname = '/' + rule.toPath + u.pathname;
        }
      }

    

      return u.href;
    }
  } catch {
    // URL 解析失败，返回原值
  }

  return originalUrl;
}

// ========== 工具函数 ==========

function resolveUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

function safeReadBody(response: Response): Promise<string | null> {
  try {
    return response.clone().text().catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

function postResponseBody(url: string, method: string, body: string, mappedUrl?: string): void {
  try {
    window.postMessage(
      { type: RESPONSE_BODY_EVENT, payload: { url, method, responseBody: body, mappedUrl } },
      '*'
    );
  } catch { /* ignore */ }
}

// ========== Monkey Patch fetch ==========
const originalFetch = window.fetch;
window.fetch = async function patchedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let url = '';
  let method = 'GET';

  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else if (input instanceof Request) {
    url = input.url;
    method = input.method.toUpperCase();
  }

  if (init?.method) {
    method = init.method.toUpperCase();
  }

  url = resolveUrl(url);
  const mappedUrl = applyMapRemote(url);

  // 使用映射后的 URL 发起请求
  let actualInput: RequestInfo | URL = input;
  let actualInit = init;
  if (mappedUrl !== url) {
    if (input instanceof Request) {
      actualInput = new Request(mappedUrl, input);
    } else {
      actualInput = mappedUrl;
    }
    // Map Remote 映射的请求移除 credentials，避免 CORS 与 withCredentials 冲突
    if (actualInit) {
      actualInit = { ...actualInit, credentials: 'omit' };
    } else {
      actualInit = { credentials: 'omit' };
    }
  }

  const response = await originalFetch.call(this, actualInput, actualInit);

  safeReadBody(response).then((body) => {
    if (body) postResponseBody(url, method, body, mappedUrl !== url ? mappedUrl : undefined);
  });

  return response;
};

// ========== Monkey Patch XMLHttpRequest ==========
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

const xhrMeta = new WeakMap<XMLHttpRequest, { method: string; url: string; mappedUrl?: string }>();

XMLHttpRequest.prototype.open = function patchedOpen(
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null
): void {
  const resolvedUrl = resolveUrl(typeof url === 'string' ? url : url.href);
  const mappedUrl = applyMapRemote(resolvedUrl);
  const isMapped = mappedUrl !== resolvedUrl;

  xhrMeta.set(this, {
    method: method.toUpperCase(),
    url: resolvedUrl,
    mappedUrl: isMapped ? mappedUrl : undefined,
  });

  // 使用映射后的 URL 调用原始 open
  const actualUrl = isMapped ? mappedUrl : url;
  if (async !== undefined) {
    originalXHROpen.call(this, method, actualUrl, async, username ?? null, password ?? null);
  } else {
    (originalXHROpen as Function).call(this, method, actualUrl);
  }

  // Map Remote 映射的请求禁用 withCredentials，避免 CORS 冲突
  if (isMapped) {
    this.withCredentials = false;
  }
};

XMLHttpRequest.prototype.send = function patchedSend(
  body?: Document | XMLHttpRequestBodyInit | null
): void {
  const meta = xhrMeta.get(this);

  this.addEventListener('load', function onLoad() {
    if (!meta) return;
    try {
      const responseText = this.responseText;
      if (responseText) {
        postResponseBody(meta.url, meta.method, responseText, meta.mappedUrl);
      }
    } catch { /* ignore */ }
  });

  originalXHRSend.call(this, body);
};

console.log('[Request Recorder] Page interceptor injected (MAIN world)');
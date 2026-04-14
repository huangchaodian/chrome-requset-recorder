/**
 * Content Script - 页面请求拦截器（运行在 MAIN world）
 *
 * 通过 monkey patch fetch 和 XMLHttpRequest 捕获响应体，
 * 再通过 window.postMessage 发送给同页面的 bridge content script。
 */

const RESPONSE_BODY_EVENT = '__REQUEST_RECORDER_RESPONSE_BODY__';

/** 将任意 URL 解析为绝对路径（与 webRequest API 记录的 URL 保持一致） */
function resolveUrl(url: string): string {
  try {
    return new URL(url, location.href).href;
  } catch {
    return url;
  }
}

/** 安全地读取 response body */
function safeReadBody(response: Response): Promise<string | null> {
  try {
    return response.clone().text().catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}

/** 发送响应体到 bridge script */
function postResponseBody(url: string, method: string, body: string): void {
  try {
    window.postMessage(
      {
        type: RESPONSE_BODY_EVENT,
        payload: { url, method, responseBody: body },
      },
      '*'
    );
  } catch {
    // 忽略
  }
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

  // init 中的 method 优先级更高
  if (init?.method) {
    method = init.method.toUpperCase();
  }

  // 解析为绝对 URL
  url = resolveUrl(url);

  const response = await originalFetch.call(this, input, init);

  // 异步读取 body，不阻塞返回
  safeReadBody(response).then((body) => {
    if (body) {
      postResponseBody(url, method, body);
    }
  });

  return response;
};

// ========== Monkey Patch XMLHttpRequest ==========
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

const xhrMeta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();

XMLHttpRequest.prototype.open = function patchedOpen(
  method: string,
  url: string | URL,
  async?: boolean,
  username?: string | null,
  password?: string | null
): void {
  xhrMeta.set(this, {
    method: method.toUpperCase(),
    url: resolveUrl(typeof url === 'string' ? url : url.href),
  });

  if (async !== undefined) {
    originalXHROpen.call(this, method, url, async, username ?? null, password ?? null);
  } else {
    (originalXHROpen as Function).call(this, method, url);
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
        postResponseBody(meta.url, meta.method, responseText);
      }
    } catch {
      // responseText 在某些 responseType 下不可访问
    }
  });

  originalXHRSend.call(this, body);
};

console.log('[Request Recorder] Page interceptor injected (MAIN world)');
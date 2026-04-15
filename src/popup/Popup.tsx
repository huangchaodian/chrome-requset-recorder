import React, { useEffect, useState } from 'react';
import { MessageType } from '../shared/messageTypes';
import type { RequestRecord } from '../shared/types';

/** 向 Background 发送消息（带 3 秒超时） */
function sendMsg<T = unknown>(type: MessageType, payload?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), 3000);
    try {
      chrome.runtime.sendMessage({ type, payload }, (res: { success: boolean; data?: T; error?: string } | undefined) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!res) return reject(new Error('No response from background'));
        res.success ? resolve(res.data as T) : reject(new Error(res.error || 'Unknown'));
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

function getMethodColor(m: string): string {
  const c: Record<string, string> = { GET: '#1677ff', POST: '#52c41a', PUT: '#fa8c16', DELETE: '#f5222d', PATCH: '#722ed1' };
  return c[m.toUpperCase()] || '#8c8c8c';
}

function getStatusColor(s: number): string {
  if (s >= 200 && s < 300) return '#52c41a';
  if (s >= 400) return '#f5222d';
  return '#fa8c16';
}

const Popup: React.FC = () => {
  const [recording, setRecording] = useState(true);
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [reqs, status] = await Promise.all([
          sendMsg<RequestRecord[]>(MessageType.GET_REQUESTS),
          sendMsg<{ enabled: boolean }>(MessageType.GET_RECORDING_STATUS),
        ]);
        setRequests(reqs.slice(-10).reverse());
        setRecording(status.enabled);
      } catch (e) {
        console.error('[Popup] Init failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async () => {
    const next = !recording;
    await sendMsg(MessageType.TOGGLE_RECORDING, { enabled: next });
    setRecording(next);
  };

  return (
    <div style={{ width: 360, fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: 13 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Request Recorder</span>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: recording ? '#f5222d' : '#8c8c8c',
            boxShadow: recording ? '0 0 6px #f5222d' : 'none',
          }} />
        </div>
        <button
          onClick={handleToggle}
          style={{
            padding: '4px 12px', fontSize: 12, border: '1px solid #d9d9d9', borderRadius: 4,
            background: recording ? '#fff1f0' : '#f6ffed', color: recording ? '#f5222d' : '#52c41a',
            cursor: 'pointer',
          }}
        >
          {recording ? '暂停录制' : '恢复录制'}
        </button>
      </div>

      {/* 最近请求 */}
      <div style={{ padding: '8px 0' }}>
        <div style={{ padding: '0 16px 6px', fontSize: 11, color: '#999', fontWeight: 600 }}>最近请求</div>
        {loading && <div style={{ padding: '12px 16px', color: '#999' }}>加载中...</div>}
        {!loading && requests.length === 0 && (
          <div style={{ padding: '12px 16px', color: '#999' }}>暂无请求记录</div>
        )}
        {requests.map((r) => (
          <div key={r.id} onClick={() => {
            // 跳转到录制面板并定位到该请求
            chrome.tabs.create({ url: chrome.runtime.getURL(`src/devtools/index.html?requestId=${r.id}`) });
            window.close();
          }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 16px',
            borderBottom: '1px solid #fafafa', fontSize: 12, cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{
              fontWeight: 600, fontSize: 10, color: getMethodColor(r.method),
              width: 36, textAlign: 'center', flexShrink: 0,
            }}>
              {r.method}
            </span>
            <span style={{
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              fontFamily: 'monospace', fontSize: 11,
            }} title={r.url}>
              {(() => { try { const u = new URL(r.url); return u.pathname + u.search; } catch { return r.url; } })()}
            </span>
            <span style={{ color: getStatusColor(r.responseStatus), fontWeight: 500, fontSize: 11, flexShrink: 0 }}>
              {r.responseStatus}
            </span>
            <span style={{ color: '#bbb', fontSize: 10, flexShrink: 0, width: 40, textAlign: 'right' }}>
              {r.duration}ms
            </span>
          </div>
        ))}
      </div>

      {/* 底部操作 */}
      <div style={{ padding: '8px 16px 12px', borderTop: '1px solid #f0f0f0' }}>
        <button
          onClick={() => {
            // 在新标签页打开完整的 DevTools 面板页面
            chrome.tabs.create({ url: chrome.runtime.getURL('src/devtools/index.html') });
            window.close();
          }}
          style={{
            width: '100%', padding: '6px 0', fontSize: 12, border: '1px solid #1677ff',
            borderRadius: 4, background: '#1677ff', color: '#fff', cursor: 'pointer',
          }}
        >
          打开请求录制面板
        </button>
      </div>
    </div>
  );
};

export default Popup;
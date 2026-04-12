import React, { useEffect, useState } from 'react';
import { MessageType } from '../shared/messageTypes';
import type { Settings } from '../shared/types';
import { DEFAULT_MAX_RECORDS } from '../shared/constants';

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

const Options: React.FC = () => {
  const [maxRecords, setMaxRecords] = useState(DEFAULT_MAX_RECORDS);
  const [recording, setRecording] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const settings = await sendMsg<Settings>(MessageType.GET_SETTINGS);
        setMaxRecords(settings.maxRecords);
        setRecording(settings.isRecordingEnabled);
      } catch (e) {
        console.error('[Options] Load failed:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await sendMsg(MessageType.UPDATE_SETTINGS, { maxRecords, isRecordingEnabled: recording });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert('保存失败: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={containerStyle}><p style={{ color: '#999' }}>加载中...</p></div>;
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>Request Recorder 设置</h1>

      {/* 最大记录条数 */}
      <div style={fieldStyle}>
        <label style={labelStyle}>最大记录条数</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="number"
            min={100}
            max={10000}
            step={100}
            value={maxRecords}
            onChange={(e) => setMaxRecords(Math.max(100, Math.min(10000, Number(e.target.value) || 100)))}
            style={inputStyle}
          />
          <span style={{ fontSize: 12, color: '#999' }}>范围: 100 ~ 10000</span>
        </div>
        <p style={descStyle}>设置内存中保留的最大请求记录数量，超出将自动淘汰最早的记录。</p>
      </div>

      {/* 录制开关 */}
      <div style={fieldStyle}>
        <label style={labelStyle}>自动录制</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={recording}
            onChange={(e) => setRecording(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13 }}>{recording ? '已启用 - 后台自动录制所有请求' : '已暂停 - 不会录制新请求'}</span>
        </div>
      </div>

      {/* 保存按钮 */}
      <div style={{ marginTop: 24 }}>
        <button onClick={handleSave} disabled={saving} style={{
          padding: '8px 24px', fontSize: 14, border: 'none', borderRadius: 6,
          background: '#1677ff', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? '保存中...' : '保存设置'}
        </button>
        {saved && <span style={{ marginLeft: 12, color: '#52c41a', fontSize: 13 }}>已保存</span>}
      </div>
    </div>
  );
};

const containerStyle: React.CSSProperties = {
  maxWidth: 560, margin: '0 auto', padding: '32px 24px',
  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
};
const fieldStyle: React.CSSProperties = { marginBottom: 20 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  width: 120, padding: '4px 8px', fontSize: 14, border: '1px solid #d9d9d9', borderRadius: 4,
};
const descStyle: React.CSSProperties = { marginTop: 4, fontSize: 12, color: '#999' };

export default Options;
import React, { useState, useMemo } from 'react';
import { Button, Input, Select, Tabs, Space, Tag, Radio, Alert, message } from 'antd';
import {
  ArrowLeftOutlined,
  SendOutlined,
  SaveOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import HeaderEditor from './HeaderEditor';
import JsonViewer from './JsonViewer';
import { useRequestStore } from '../stores/requestStore';
import { sendMessage } from '../hooks/useMessageBridge';
import { MessageType } from '../../shared/messageTypes';
import { HTTP_METHODS } from '../../shared/constants';
import type { Header, ReplayResult } from '../../shared/types';

/** 校验 JSON 格式 */
function validateJson(text: string): { valid: boolean; error?: string } {
  if (!text || !text.trim()) return { valid: true };
  try {
    JSON.parse(text);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

/** 尝试将 Form 键值对转为 URL 编码字符串 */
function formPairsToString(pairs: Header[]): string {
  return pairs
    .filter((p) => p.name.trim())
    .map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.value)}`)
    .join('&');
}

/** 尝试将 URL 编码字符串解析为键值对 */
function stringToFormPairs(text: string): Header[] {
  if (!text || !text.trim()) return [{ name: '', value: '' }];
  try {
    const params = new URLSearchParams(text);
    const pairs: Header[] = [];
    params.forEach((value, name) => pairs.push({ name, value }));
    return pairs.length > 0 ? pairs : [{ name: '', value: '' }];
  } catch {
    return [{ name: '', value: '' }];
  }
}

/** 格式化耗时 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** 重放结果面板 */
const ReplayResultPanel: React.FC<{
  result: ReplayResult;
  showOriginal: boolean;
  onToggle: () => void;
  originalStatus?: number;
  originalBody?: string | null;
}> = ({ result, showOriginal, onToggle, originalStatus, originalBody }) => {
  const statusColor =
    result.status >= 200 && result.status < 300
      ? '#52c41a'
      : result.status >= 400
        ? '#ff4d4f'
        : '#faad14';

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Space>
          <Tag color={statusColor}>{result.status}</Tag>
          <span style={{ fontSize: 12, color: '#666' }}>{formatDuration(result.duration)}</span>
        </Space>
        {originalBody !== undefined && (
          <Button size="small" icon={<SwapOutlined />} onClick={onToggle}>
            {showOriginal ? '查看重放响应' : '查看原始响应'}
          </Button>
        )}
      </div>
      {showOriginal ? (
        <div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
            原始响应 (状态码: {originalStatus})
          </div>
          <JsonViewer data={originalBody ?? null} maxHeight={300} />
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>重放响应</div>
          <JsonViewer data={result.body} maxHeight={300} />
        </div>
      )}
    </div>
  );
};

const RequestEditor: React.FC = () => {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const addRequest = useRequestStore((s) => s.addRequest);
  const setView = useRequestStore((s) => s.setView);

  // 编辑状态
  const [method, setMethod] = useState(activeRequest?.method || 'GET');
  const [url, setUrl] = useState(activeRequest?.url || '');
  const [headers, setHeaders] = useState<Header[]>(
    activeRequest?.requestHeaders ? [...activeRequest.requestHeaders] : []
  );
  const [bodyMode, setBodyMode] = useState<'raw' | 'form'>('raw');
  const [rawBody, setRawBody] = useState(activeRequest?.requestBody || '');
  const [formPairs, setFormPairs] = useState<Header[]>(
    stringToFormPairs(activeRequest?.requestBody || '')
  );

  // 重放状态
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  // JSON 校验
  const jsonValidation = useMemo(() => validateJson(rawBody), [rawBody]);

  if (!activeRequest) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>
        未选中请求
        <br />
        <Button type="link" onClick={() => setView('list')}>返回列表</Button>
      </div>
    );
  }

  /** 获取当前编辑后的请求体 */
  const getCurrentBody = (): string | null => {
    if (bodyMode === 'form') {
      const encoded = formPairsToString(formPairs);
      return encoded || null;
    }
    return rawBody.trim() || null;
  };

  /** 构建编辑后的 RequestRecord */
  const buildEditedRecord = () => ({
    ...activeRequest,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method,
    url,
    requestHeaders: headers.filter((h) => h.name.trim()),
    requestBody: getCurrentBody(),
    timestamp: Date.now(),
    type: 'replayed' as const,
    parentId: activeRequest.id,
  });

  /** 重放 */
  const handleReplay = async () => {
    if (!url.trim()) {
      message.warning('请输入 URL');
      return;
    }
    setReplaying(true);
    setReplayResult(null);
    setShowOriginal(false);
    try {
      const edited = buildEditedRecord();
      const result = await sendMessage<ReplayResult>(MessageType.REPLAY_REQUEST, edited);
      setReplayResult(result);
      message.success(`重放完成 - 状态码: ${result.status}`);
    } catch (err: unknown) {
      message.error(`重放失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setReplaying(false);
    }
  };

  /** 保存为新记录 */
  const handleSave = () => {
    const edited = buildEditedRecord();
    addRequest(edited);
    message.success('已保存为新记录');
  };

  /** 返回详情 */
  const handleBack = () => {
    setView('detail');
  };

  /** 切换 Body 模式 */
  const handleBodyModeChange = (mode: 'raw' | 'form') => {
    if (mode === 'form' && bodyMode === 'raw') {
      setFormPairs(stringToFormPairs(rawBody));
    } else if (mode === 'raw' && bodyMode === 'form') {
      setRawBody(formPairsToString(formPairs));
    }
    setBodyMode(mode);
  };

  // Tab: 请求头编辑
  const headersTab = (
    <div style={{ padding: '8px 0' }}>
      <HeaderEditor headers={headers} onChange={setHeaders} />
    </div>
  );

  // Tab: 请求体编辑
  const bodyTab = (
    <div style={{ padding: '8px 0' }}>
      <div style={{ marginBottom: 8 }}>
        <Radio.Group
          size="small"
          value={bodyMode}
          onChange={(e) => handleBodyModeChange(e.target.value)}
        >
          <Radio.Button value="raw">Raw</Radio.Button>
          <Radio.Button value="form">Form</Radio.Button>
        </Radio.Group>
      </div>
      {bodyMode === 'raw' ? (
        <div>
          <Input.TextArea
            value={rawBody}
            onChange={(e) => setRawBody(e.target.value)}
            placeholder="请求体内容（支持 JSON、纯文本等）"
            autoSize={{ minRows: 6, maxRows: 16 }}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          {!jsonValidation.valid && rawBody.trim() && (
            <Alert
              type="warning"
              message={`JSON 格式错误: ${jsonValidation.error}`}
              style={{ marginTop: 8 }}
              showIcon
              banner
            />
          )}
        </div>
      ) : (
        <HeaderEditor
          headers={formPairs}
          onChange={setFormPairs}
        />
      )}
    </div>
  );

  // Tab: 重放结果
  const resultTab = (
    <div style={{ padding: '8px 0' }}>
      {replayResult ? (
        <ReplayResultPanel
          result={replayResult}
          showOriginal={showOriginal}
          onToggle={() => setShowOriginal(!showOriginal)}
          originalStatus={activeRequest.responseStatus}
          originalBody={activeRequest.responseBody}
        />
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c', fontSize: 13 }}>
          点击「重放」按钮发送请求后，结果将显示在此处
        </div>
      )}
    </div>
  );

  const tabItems = [
    { key: 'headers', label: `请求头 (${headers.length})`, children: headersTab },
    { key: 'body', label: '请求体', children: bodyTab },
    { key: 'result', label: replayResult ? '重放结果 ✓' : '重放结果', children: resultTab },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack} size="small" />
          <span style={{ fontSize: 13, fontWeight: 500 }}>编辑请求</span>
          <Tag color="orange" style={{ fontSize: 11 }}>编辑中</Tag>
        </div>
        <Space size={4}>
          <Button size="small" icon={<SaveOutlined />} onClick={handleSave}>
            保存为新记录
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<SendOutlined />}
            loading={replaying}
            onClick={handleReplay}
          >
            重放
          </Button>
        </Space>
      </div>

      {/* URL + 方法编辑区 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
          flexShrink: 0,
        }}
      >
        <Select
          size="small"
          value={method}
          onChange={setMethod}
          style={{ width: 110, flexShrink: 0 }}
          options={HTTP_METHODS.map((m) => ({ label: m, value: m }))}
        />
        <Input
          size="small"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="请求 URL"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          onPressEnter={handleReplay}
        />
      </div>

      {/* Tab 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
        <Tabs defaultActiveKey="headers" items={tabItems} size="small" />
      </div>
    </div>
  );
};

export default RequestEditor;
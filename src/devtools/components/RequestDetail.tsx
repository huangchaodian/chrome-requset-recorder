import React, { useState, useMemo, useEffect } from 'react';
import { Tabs, Button, Space, Descriptions, Tag, Tooltip, Input, Select, Alert, message } from 'antd';
import {
  SendOutlined,
  StarOutlined,
  StarFilled,
  SwapOutlined,
  DiffOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import JsonViewer, { JsonViewerToolbar } from './JsonViewer';
import HeaderEditor from './HeaderEditor';
import HighlightText from './HighlightText';
import { useRequestStore } from '../stores/requestStore';
import { sendMessage } from '../hooks/useMessageBridge';
import { MessageType } from '../../shared/messageTypes';
import { HTTP_METHODS } from '../../shared/constants';
import type { RequestRecord, ReplayResult, FavoriteRecord, Header } from '../../shared/types';

/** 请求头表格渲染 */
const HeadersTable: React.FC<{ headers: { name: string; value: string }[]; keyword?: string }> = ({ headers, keyword }) => {
  if (!headers || headers.length === 0) {
    return <div style={{ padding: 12, color: '#8c8c8c' }}>(无请求头)</div>;
  }
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ background: '#fafafa', textAlign: 'left' }}>
          <th style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', width: '30%' }}>名称</th>
          <th style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0' }}>值</th>
        </tr>
      </thead>
      <tbody>
        {headers.map((h, i) => (
          <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td style={{ padding: '4px 12px', fontWeight: 500, color: '#722ed1', wordBreak: 'break-all' }}>
              <HighlightText text={h.name} keyword={keyword} />
            </td>
            <td style={{ padding: '4px 12px', wordBreak: 'break-all' }}>
              <HighlightText text={h.value} keyword={keyword} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/** 状态码颜色 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#52c41a';
  if (status >= 300 && status < 400) return '#faad14';
  if (status >= 400 && status < 500) return '#ff4d4f';
  if (status >= 500) return '#ff4d4f';
  return '#999';
}

/** 格式化耗时 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** 截断 URL 简短显示 */
function truncateUrlShort(url: string, max = 30): string {
  try {
    const u = new URL(url);
    const p = u.pathname;
    return p.length > max ? p.slice(0, max) + '...' : p;
  } catch {
    return url.length > max ? url.slice(0, max) + '...' : url;
  }
}

/** 格式化时间 */
function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

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

/** 尝试格式化 JSON，非 JSON 原样返回 */
function tryFormatJson(text: string): string {
  if (!text || !text.trim()) return text;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

/** 概览 Tab */
const OverviewTab: React.FC<{ record: RequestRecord; keyword?: string }> = ({ record, keyword }) => (
  <div style={{ padding: '12px 0' }}>
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="URL">
        <HighlightText text={record.url} keyword={keyword} style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12 }} />
      </Descriptions.Item>
      <Descriptions.Item label="方法">
        <Tag color="blue">{record.method}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="状态码">
        <Tag color={getStatusColor(record.responseStatus)}>{record.responseStatus}</Tag>
      </Descriptions.Item>
      <Descriptions.Item label="耗时">{formatDuration(record.duration)}</Descriptions.Item>
      <Descriptions.Item label="发起时间">{formatTime(record.timestamp)}</Descriptions.Item>
      <Descriptions.Item label="标签页 ID">{record.tabId}</Descriptions.Item>
      <Descriptions.Item label="标签页 URL">
        <span style={{ wordBreak: 'break-all', fontSize: 12 }}>{record.tabUrl}</span>
      </Descriptions.Item>
      <Descriptions.Item label="类型">
        <Tag color={record.type === 'replayed' ? 'orange' : 'green'}>
          {record.type === 'replayed' ? '重放' : '录制'}
        </Tag>
        {record.parentId && <span style={{ marginLeft: 8, fontSize: 11, color: '#999' }}>源请求: {record.parentId.slice(0, 8)}...</span>}
      </Descriptions.Item>
    </Descriptions>
  </div>
);

const RequestDetail: React.FC = () => {
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const addRequest = useRequestStore((s) => s.addRequest);
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);
  const diffPair = useRequestStore((s) => s.diffPair);
  const setDiffLeft = useRequestStore((s) => s.setDiffLeft);
  const setDiffRight = useRequestStore((s) => s.setDiffRight);
  const keyword = useRequestStore((s) => s.filters.keyword);

  // 内联编辑状态
  const [editMethod, setEditMethod] = useState('GET');
  const [editUrl, setEditUrl] = useState('');
  const [editHeaders, setEditHeaders] = useState<Header[]>([]);
  const [editBody, setEditBody] = useState('');

  // 重放状态
  const [replaying, setReplaying] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [reqTabKey, setReqTabKey] = useState('requestBody');
  const [resTabKey, setResTabKey] = useState('responseBody');
  const [resBodyRawMode, setResBodyRawMode] = useState(false);

  // JSON 校验
  const jsonValidation = useMemo(() => validateJson(editBody), [editBody]);

  // 当 activeRequest 变化时，同步编辑状态
  useEffect(() => {
    if (!activeRequest) return;
    setEditMethod(activeRequest.method || 'GET');
    setEditUrl(activeRequest.url || '');
    setEditHeaders(activeRequest.requestHeaders ? [...activeRequest.requestHeaders] : []);
    setEditBody(tryFormatJson(activeRequest.requestBody || ''));
  }, [activeRequest?.id]);

  if (!activeRequest) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bfbfbf', fontSize: 13 }}>
        从左侧选择一条请求查看详情
      </div>
    );
  }

  const record = activeRequest;

  /** 判断是否有修改 */
  const isModified =
    editMethod !== record.method ||
    editUrl !== record.url ||
    editBody !== (record.requestBody || '');

  /** 构建发送用的请求对象 */
  const buildRequest = (): RequestRecord => ({
    ...record,
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    method: editMethod,
    url: editUrl,
    requestHeaders: editHeaders.filter((h) => h.name.trim()),
    requestBody: editBody.trim() || null,
    timestamp: Date.now(),
    type: 'replayed' as const,
    parentId: record.id,
  });

  /** 重放请求（使用编辑后的数据） */
  const handleReplay = async () => {
    setReplaying(true);
    try {
      const req = buildRequest();
      const result = await sendMessage<ReplayResult>(MessageType.REPLAY_REQUEST, req);
      message.success(`重放完成 - 状态码: ${result.status}，耗时: ${formatDuration(result.duration)}`);
      // 等待 NEW_REQUEST 广播到达后选中重放记录（最多等 2s）
      const replayedId = result.id;
      const deadline = Date.now() + 2000;
      const poll = setInterval(() => {
        const found = useRequestStore.getState().requests.find((r) => r.id === replayedId);
        if (found) {
          clearInterval(poll);
          setActiveRequest(found);
        } else if (Date.now() > deadline) {
          clearInterval(poll);
        }
      }, 50);
    } catch (err: unknown) {
      message.error(`重放失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setReplaying(false);
    }
  };

  /** 保存为新记录 */
  const handleSave = () => {
    const edited = buildRequest();
    addRequest(edited);
    message.success('已保存为新记录');
  };

  /** 收藏请求 */
  const handleFavorite = async () => {
    try {
      if (favorited) {
        await sendMessage<void>(MessageType.REMOVE_FAVORITE, { id: record.id });
        setFavorited(false);
        message.success('已取消收藏');
      } else {
        await sendMessage<FavoriteRecord>(MessageType.ADD_FAVORITE, { request: record });
        setFavorited(true);
        message.success('已收藏');
      }
    } catch (err: unknown) {
      message.error(`操作失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  // 请求体编辑 Tab
  const requestBodyTab = (
    <div style={{ paddingTop: 8 }}>
      <Input.TextArea
        value={editBody}
        onChange={(e) => setEditBody(e.target.value)}
        placeholder="请求体内容（支持 JSON、纯文本等）"
        autoSize={{ minRows: 6, maxRows: 20 }}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
      {!jsonValidation.valid && editBody.trim() && (
        <Alert
          type="warning"
          message={`JSON 格式错误: ${jsonValidation.error}`}
          style={{ marginTop: 8 }}
          showIcon
          banner
        />
      )}
    </div>
  );

  const requestTabItems = [
    {
      key: 'overview',
      label: '概览',
      children: <OverviewTab record={record} keyword={keyword} />,
    },
    {
      key: 'requestHeaders',
      label: `请求头 (${record.requestHeaders?.length || 0})`,
      children: (
        <div style={{ paddingTop: 8 }}>
          <HeaderEditor headers={editHeaders} onChange={setEditHeaders} />
        </div>
      ),
    },
    {
      key: 'requestBody',
      label: '请求体',
      children: requestBodyTab,
    },
  ];

  const responseTabItems = [
    {
      key: 'responseHeaders',
      label: `响应头 (${record.responseHeaders?.length || 0})`,
      children: <HeadersTable headers={record.responseHeaders || []} keyword={keyword} />,
    },
    {
      key: 'responseBody',
      label: '响应体',
      children: <JsonViewer data={record.responseBody} maxHeight="66vh" hideToolbar rawMode={resBodyRawMode} onRawModeChange={setResBodyRawMode} keyword={keyword} />,
    },
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
        <Space size={4} style={{ flexShrink: 0 }}>
          <Tooltip title={diffPair.left ? `Diff A 已设: ${truncateUrlShort(diffPair.left.url)}` : '标记为 Diff 基准 (A)'}>
            <Button
              size="small"
              icon={<DiffOutlined />}
              type={diffPair.left?.id === record.id ? 'primary' : 'default'}
              onClick={() => {
                setDiffLeft(record);
                message.success('已设为 Diff A（基准）');
              }}
            >
              Diff A
            </Button>
          </Tooltip>
          <Tooltip title={diffPair.left ? '设为 Diff B 并比较' : '请先标记 Diff A'}>
            <Button
              size="small"
              icon={<SwapOutlined />}
              disabled={!diffPair.left || diffPair.left.id === record.id}
              onClick={() => {
                setDiffRight(record);
              }}
            >
              Diff B
            </Button>
          </Tooltip>
          {isModified && (
            <Button size="small" icon={<SaveOutlined />} onClick={handleSave}>
              保存为新记录
            </Button>
          )}
          <Button
            size="small"
            type="primary"
            icon={<SendOutlined />}
            loading={replaying}
            onClick={handleReplay}
          >
            重放
          </Button>
          <Button
            size="small"
            icon={favorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            onClick={handleFavorite}
          >
            {favorited ? '已收藏' : '收藏'}
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
          alignItems: 'center',
        }}
      >
        <Tag color={getStatusColor(record.responseStatus)} style={{ flexShrink: 0 }}>
          {record.responseStatus}
        </Tag>
        <Select
          size="small"
          value={editMethod}
          onChange={setEditMethod}
          style={{ width: 100, flexShrink: 0 }}
          options={HTTP_METHODS.map((m) => ({ label: m, value: m }))}
        />
        <Input
          size="small"
          value={editUrl}
          onChange={(e) => setEditUrl(e.target.value)}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
          onPressEnter={handleReplay}
        />
      </div>

      {/* 上下两栏内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
        <Tabs
          activeKey={reqTabKey}
          onChange={setReqTabKey}
          items={requestTabItems}
          size="small"
        />
        <div style={{ borderTop: '1px solid #f0f0f0' }} />
        <Tabs
          activeKey={resTabKey}
          onChange={setResTabKey}
          items={responseTabItems}
          size="small"
          tabBarExtraContent={resTabKey === 'responseBody' ? (
            <JsonViewerToolbar data={record.responseBody} rawMode={resBodyRawMode} onRawModeChange={setResBodyRawMode} />
          ) : undefined}
        />
      </div>
    </div>
  );
};

export default RequestDetail;
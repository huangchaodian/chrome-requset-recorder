import React, { useState } from 'react';
import { Tabs, Button, Space, Descriptions, Tag, Tooltip, message } from 'antd';
import {
  EditOutlined,
  SendOutlined,
  StarOutlined,
  StarFilled,
  SwapOutlined,
  DiffOutlined,
} from '@ant-design/icons';
import JsonViewer from './JsonViewer';
import { useRequestStore } from '../stores/requestStore';
import { sendMessage } from '../hooks/useMessageBridge';
import { MessageType } from '../../shared/messageTypes';
import type { RequestRecord, ReplayResult, FavoriteRecord } from '../../shared/types';

/** 请求头表格渲染 */
const HeadersTable: React.FC<{ headers: { name: string; value: string }[] }> = ({ headers }) => {
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
              {h.name}
            </td>
            <td style={{ padding: '4px 12px', wordBreak: 'break-all' }}>{h.value}</td>
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

/** 概览 Tab */
const OverviewTab: React.FC<{ record: RequestRecord }> = ({ record }) => (
  <div style={{ padding: '12px 0' }}>
    <Descriptions column={1} size="small" bordered>
      <Descriptions.Item label="URL">
        <span style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12 }}>{record.url}</span>
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
  const setView = useRequestStore((s) => s.setView);
  const diffPair = useRequestStore((s) => s.diffPair);
  const setDiffLeft = useRequestStore((s) => s.setDiffLeft);
  const setDiffRight = useRequestStore((s) => s.setDiffRight);
  const [replaying, setReplaying] = useState(false);
  const [favorited, setFavorited] = useState(false);

  if (!activeRequest) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bfbfbf', fontSize: 13 }}>
        从左侧选择一条请求查看详情
      </div>
    );
  }

  const record = activeRequest;

  /** 编辑请求 */
  const handleEdit = () => {
    setView('edit');
  };

  /** 重放请求 */
  const handleReplay = async () => {
    setReplaying(true);
    try {
      const result = await sendMessage<ReplayResult>(MessageType.REPLAY_REQUEST, record);
      message.success(`重放完成 - 状态码: ${result.status}，耗时: ${formatDuration(result.duration)}`);
    } catch (err: unknown) {
      message.error(`重放失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setReplaying(false);
    }
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

  const requestTabItems = [
    {
      key: 'overview',
      label: '概览',
      children: <OverviewTab record={record} />,
    },
    {
      key: 'requestHeaders',
      label: `请求头 (${record.requestHeaders?.length || 0})`,
      children: <HeadersTable headers={record.requestHeaders || []} />,
    },
    {
      key: 'requestBody',
      label: '请求体',
      children: <JsonViewer data={record.requestBody} maxHeight={300} />,
    },
  ];

  const responseTabItems = [
    {
      key: 'responseHeaders',
      label: `响应头 (${record.responseHeaders?.length || 0})`,
      children: <HeadersTable headers={record.responseHeaders || []} />,
    },
    {
      key: 'responseBody',
      label: '响应体',
      children: <JsonViewer data={record.responseBody} maxHeight={300} />,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <Tag color="blue" style={{ flexShrink: 0 }}>{record.method}</Tag>
          <Tag color={getStatusColor(record.responseStatus)} style={{ flexShrink: 0 }}>
            {record.responseStatus}
          </Tag>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={record.url}
          >
            {record.url}
          </span>
        </div>
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
          <Button size="small" icon={<EditOutlined />} onClick={handleEdit}>
            编辑
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
          <Button
            size="small"
            icon={favorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            onClick={handleFavorite}
          >
            {favorited ? '已收藏' : '收藏'}
          </Button>
        </Space>
      </div>

      {/* 上下两栏内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
        <Tabs defaultActiveKey="requestBody" items={requestTabItems} size="small" />
        <div style={{ borderTop: '1px solid #f0f0f0' }} />
        <Tabs defaultActiveKey="responseBody" items={responseTabItems} size="small" />
      </div>
    </div>
  );
};

export default RequestDetail;
import React, { useEffect, useState } from 'react';
import { Button, Tag, Space, Input, Empty, Popconfirm, message } from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SendOutlined,
  DeleteOutlined,
  StarFilled,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useFavoriteStore } from '../stores/favoriteStore';
import { useRequestStore } from '../stores/requestStore';
import { sendMessage } from '../hooks/useMessageBridge';
import { MessageType } from '../../shared/messageTypes';
import type { FavoriteRecord, ReplayResult } from '../../shared/types';

/** 状态码颜色 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#52c41a';
  if (status >= 300 && status < 400) return '#faad14';
  if (status >= 400 && status < 500) return '#ff4d4f';
  if (status >= 500) return '#ff4d4f';
  return '#999';
}

function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red',
    PATCH: 'purple', HEAD: 'cyan', OPTIONS: 'default',
  };
  return colors[method.toUpperCase()] || 'default';
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/** 单条收藏项 */
const FavoriteItem: React.FC<{
  record: FavoriteRecord;
  onViewDetail: (r: FavoriteRecord) => void;
}> = ({ record, onViewDetail }) => {
  const removeFavorite = useFavoriteStore((s) => s.removeFavorite);
  const updateFavorite = useFavoriteStore((s) => s.updateFavorite);
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);
  const setView = useRequestStore((s) => s.setView);

  const [editing, setEditing] = useState(false);
  const [alias, setAlias] = useState(record.alias || '');
  const [note, setNote] = useState(record.note || '');
  const [replaying, setReplaying] = useState(false);

  const handleSaveEdit = async () => {
    try {
      await updateFavorite(record.id, alias, note);
      setEditing(false);
      message.success('已更新');
    } catch {
      message.error('更新失败');
    }
  };

  const handleCancelEdit = () => {
    setAlias(record.alias || '');
    setNote(record.note || '');
    setEditing(false);
  };

  const handleRemove = async () => {
    try {
      await removeFavorite(record.id);
      message.success('已取消收藏');
    } catch {
      message.error('取消收藏失败');
    }
  };

  const handleReplay = async () => {
    setReplaying(true);
    try {
      const result = await sendMessage<ReplayResult>(MessageType.REPLAY_REQUEST, record);
      message.success(`重放完成 - ${result.status}`);
    } catch {
      message.error('重放失败');
    } finally {
      setReplaying(false);
    }
  };

  const handleViewDetail = () => {
    onViewDetail(record);
  };

  const handleEdit = () => {
    setActiveRequest(record);
    setView('edit');
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* 第一行：方法 + URL + 时间 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <StarFilled style={{ color: '#faad14', fontSize: 14, flexShrink: 0 }} />
        <Tag color={getMethodColor(record.method)} style={{ margin: 0, flexShrink: 0 }}>
          {record.method}
        </Tag>
        <span
          style={{
            flex: 1, fontSize: 12, fontFamily: 'monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: 'pointer', color: '#1677ff',
          }}
          title={record.url}
          onClick={handleViewDetail}
        >
          {record.url}
        </span>
        <Tag color={getStatusColor(record.responseStatus)} style={{ margin: 0 }}>
          {record.responseStatus}
        </Tag>
        <span style={{ fontSize: 11, color: '#999', flexShrink: 0 }}>
          {formatTime(record.favoritedAt)}
        </span>
      </div>

      {/* 第二行：别名/备注 编辑 */}
      {editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Input
            size="small" placeholder="别名" value={alias}
            onChange={(e) => setAlias(e.target.value)}
            style={{ width: 150 }}
          />
          <Input
            size="small" placeholder="备注" value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{ flex: 1 }}
          />
          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleSaveEdit} />
          <Button size="small" icon={<CloseOutlined />} onClick={handleCancelEdit} />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
          {record.alias && (
            <Tag color="blue" style={{ margin: 0 }}>{record.alias}</Tag>
          )}
          {record.note && (
            <span style={{ color: '#8c8c8c', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {record.note}
            </span>
          )}
          {!record.alias && !record.note && (
            <span style={{ color: '#bbb', fontSize: 11 }}>无别名/备注</span>
          )}
        </div>
      )}

      {/* 第三行：操作按钮 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Space size={4}>
          <Button size="small" type="text" onClick={handleViewDetail}>详情</Button>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setEditing(true)}>别名</Button>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={handleEdit}>编辑</Button>
          <Button size="small" type="text" icon={<SendOutlined />} loading={replaying} onClick={handleReplay}>重放</Button>
          <Popconfirm title="确认取消收藏？" onConfirm={handleRemove} okText="确认" cancelText="取消">
            <Button size="small" type="text" danger icon={<DeleteOutlined />}>取消收藏</Button>
          </Popconfirm>
        </Space>
      </div>
    </div>
  );
};

const FavoriteList: React.FC = () => {
  const favorites = useFavoriteStore((s) => s.favorites);
  const loading = useFavoriteStore((s) => s.loading);
  const loadFavorites = useFavoriteStore((s) => s.loadFavorites);
  const setView = useRequestStore((s) => s.setView);
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const handleViewDetail = (record: FavoriteRecord) => {
    setActiveRequest(record);
    setView('detail');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', flexShrink: 0,
      }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setView('list')} size="small" />
        <StarFilled style={{ color: '#faad14' }} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>收藏夹</span>
        <Tag>{favorites.length} 条</Tag>
      </div>

      {/* 列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>加载中...</div>}
        {!loading && favorites.length === 0 && (
          <Empty description="暂无收藏" style={{ marginTop: 60 }} />
        )}
        {favorites.map((f) => (
          <FavoriteItem key={f.id} record={f} onViewDetail={handleViewDetail} />
        ))}
      </div>
    </div>
  );
};

export default FavoriteList;
import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { Checkbox, Tag, Button, Space, message } from 'antd';
import { StarOutlined, SwapOutlined, DeleteOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import { useRequestStore } from '../stores/requestStore';
import { useFavoriteStore } from '../stores/favoriteStore';
import { exportRequests, importRequests } from '../utils/export';
import type { RequestRecord } from '../../shared/types';

/** 状态码颜色映射 */
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#52c41a';
  if (status >= 300 && status < 400) return '#1677ff';
  if (status >= 400 && status < 500) return '#fa8c16';
  if (status >= 500) return '#f5222d';
  return '#8c8c8c';
}

/** 方法标签颜色映射 */
function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'blue',
    POST: 'green',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple',
    HEAD: 'cyan',
    OPTIONS: 'default',
  };
  return colors[method.toUpperCase()] || 'default';
}

/** 截断 URL 显示 */
function truncateUrl(url: string, maxLen = 80): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > maxLen ? path.slice(0, maxLen) + '...' : path;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
  }
}

/** 匹配状态码范围 */
function matchStatusRange(status: number, ranges: string[]): boolean {
  if (ranges.length === 0) return true;
  const prefix = Math.floor(status / 100) + 'xx';
  return ranges.includes(prefix);
}

const ROW_HEIGHT = 32;

const RequestList: React.FC = () => {
  const requests = useRequestStore((s) => s.requests);
  const filters = useRequestStore((s) => s.filters);
  const selectedIds = useRequestStore((s) => s.selectedIds);
  const toggleSelected = useRequestStore((s) => s.toggleSelected);
  const selectAll = useRequestStore((s) => s.selectAll);
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);
  const setView = useRequestStore((s) => s.setView);

  const removeRequests = useRequestStore((s) => s.removeRequests);
  const batchAddFavorites = useFavoriteStore((s) => s.batchAddFavorites);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // 过滤后的请求列表
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filters.keyword && !r.url.toLowerCase().includes(filters.keyword.toLowerCase())) {
        return false;
      }
      if (filters.methods.length > 0 && !filters.methods.includes(r.method.toUpperCase())) {
        return false;
      }
      if (!matchStatusRange(r.responseStatus, filters.statusRange)) {
        return false;
      }
      return true;
    });
  }, [requests, filters]);

  // 虚拟滚动计算
  const totalHeight = filteredRequests.length * ROW_HEIGHT;
  const startIndex = Math.floor(scrollTop / ROW_HEIGHT);
  const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + 2;
  const endIndex = Math.min(startIndex + visibleCount, filteredRequests.length);
  const visibleItems = filteredRequests.slice(startIndex, endIndex);
  const offsetY = startIndex * ROW_HEIGHT;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      setContainerHeight(entries[0].contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const handleRowClick = useCallback(
    (record: RequestRecord) => {
      setActiveRequest(record);
      setView('detail');
    },
    [setActiveRequest, setView]
  );

  const filteredIds = useMemo(() => filteredRequests.map((r) => r.id), [filteredRequests]);
  const allSelected = filteredIds.length > 0 && selectedIds.length === filteredIds.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* 表头 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa',
        fontSize: 12,
        fontWeight: 600,
        color: '#595959',
        flexShrink: 0,
      }}>
        <Checkbox
          checked={allSelected}
          indeterminate={selectedIds.length > 0 && !allSelected}
          onChange={() => selectAll(filteredIds)}
          style={{ marginRight: 8 }}
        />
        <span style={{ width: 60 }}>方法</span>
        <span style={{ flex: 1 }}>URL</span>
        <span style={{ width: 60, textAlign: 'center' }}>状态</span>
        <span style={{ width: 70, textAlign: 'right' }}>耗时</span>
        <span style={{ width: 40, textAlign: 'center' }}>类型</span>
      </div>

      {/* 虚拟滚动列表 */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflow: 'auto' }}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleItems.map((record) => (
              <div
                key={record.id}
                onClick={() => handleRowClick(record)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  height: ROW_HEIGHT,
                  padding: '0 8px',
                  cursor: 'pointer',
                  fontSize: 12,
                  borderBottom: '1px solid #f0f0f0',
                  background: selectedIds.includes(record.id) ? '#e6f4ff' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!selectedIds.includes(record.id)) {
                    e.currentTarget.style.background = '#fafafa';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selectedIds.includes(record.id)
                    ? '#e6f4ff'
                    : 'transparent';
                }}
              >
                <Checkbox
                  checked={selectedIds.includes(record.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelected(record.id)}
                  style={{ marginRight: 8 }}
                />
                <span style={{ width: 60 }}>
                  <Tag color={getMethodColor(record.method)} style={{ fontSize: 11, margin: 0 }}>
                    {record.method}
                  </Tag>
                </span>
                <span
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={record.url}
                >
                  {truncateUrl(record.url)}
                </span>
                <span style={{ width: 60, textAlign: 'center', color: getStatusColor(record.responseStatus), fontWeight: 500 }}>
                  {record.responseStatus || '-'}
                </span>
                <span style={{ width: 70, textAlign: 'right', color: '#8c8c8c' }}>
                  {record.duration}ms
                </span>
                <span style={{ width: 40, textAlign: 'center' }}>
                  {record.type === 'replayed' && (
                    <Tag color="purple" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>R</Tag>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 12px',
        borderTop: '1px solid #e8e8e8',
        background: '#fafafa',
        fontSize: 12,
        color: '#8c8c8c',
        flexShrink: 0,
      }}>
        <span>{filteredRequests.length} 条请求{selectedIds.length > 0 && ` / 已选 ${selectedIds.length}`}</span>
        <Space size={4}>
          {selectedIds.length === 2 && (
            <Button type="link" size="small" icon={<SwapOutlined />}
              onClick={() => setView('compare')}>
              比较
            </Button>
          )}
          {selectedIds.length > 0 && (
            <>
              <Button type="link" size="small" icon={<StarOutlined />}
                onClick={async () => {
                  const selected = requests.filter((r) => selectedIds.includes(r.id));
                  await batchAddFavorites(selected);
                  message.success(`已收藏 ${selected.length} 条`);
                }}>
                批量收藏
              </Button>
              <Button type="link" size="small" icon={<ExportOutlined />}
                onClick={() => {
                  const selected = requests.filter((r) => selectedIds.includes(r.id));
                  exportRequests(selected);
                  message.success(`已导出 ${selected.length} 条`);
                }}>
                导出
              </Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}
                onClick={() => {
                  removeRequests(selectedIds);
                  message.success(`已删除 ${selectedIds.length} 条`);
                }}>
                删除
              </Button>
            </>
          )}
          {selectedIds.length === 0 && (
            <>
              <Button type="link" size="small" icon={<ExportOutlined />}
                onClick={() => {
                  exportRequests(filteredRequests);
                  message.success(`已导出 ${filteredRequests.length} 条`);
                }}>
                全部导出
              </Button>
              <Button type="link" size="small" icon={<ImportOutlined />}
                onClick={async () => {
                  try {
                    const imported = await importRequests();
                    const setRequests = useRequestStore.getState().setRequests;
                    const current = useRequestStore.getState().requests;
                    setRequests([...current, ...imported]);
                    message.success(`已导入 ${imported.length} 条`);
                  } catch (err) {
                    message.error((err as Error).message);
                  }
                }}>
                导入
              </Button>
            </>
          )}
        </Space>
      </div>
    </div>
  );
};

export default RequestList;
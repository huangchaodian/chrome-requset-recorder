import React, { useMemo, useState, useCallback } from 'react';
import { Tooltip } from 'antd';
import { UnorderedListOutlined, ApartmentOutlined } from '@ant-design/icons';
import RequestTree from './RequestTree';
import ContextMenu from './ContextMenu';
import HighlightText from './HighlightText';
import { useRequestStore } from '../stores/requestStore';
import type { RequestRecord } from '../../shared/types';

type ViewMode = 'tree' | 'flat';

/** 匹配状态码范围 */
function matchStatusRange(status: number, ranges: string[]): boolean {
  if (ranges.length === 0) return true;
  return ranges.includes(Math.floor(status / 100) + 'xx');
}

/** 截断 URL */
function truncateUrl(url: string, max = 60): string {
  try {
    const u = new URL(url);
    const p = u.pathname + u.search;
    return p.length > max ? p.slice(0, max) + '...' : p;
  } catch {
    return url.length > max ? url.slice(0, max) + '...' : url;
  }
}

interface CtxMenuState {
  x: number;
  y: number;
  record: RequestRecord;
}

const SidePanel: React.FC = () => {
  const [mode, setMode] = useState<ViewMode>('tree');
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const requests = useRequestStore((s) => s.requests);
  const filters = useRequestStore((s) => s.filters);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);
  const diffPair = useRequestStore((s) => s.diffPair);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (filters.keyword) {
        const kw = filters.keyword.toLowerCase();
        const headersToStr = (headers: { name: string; value: string }[]) =>
          headers.map((h) => `${h.name}: ${h.value}`).join('\n').toLowerCase();
        const matchUrl = r.url.toLowerCase().includes(kw);
        const matchReqHeaders = r.requestHeaders?.length > 0 && headersToStr(r.requestHeaders).includes(kw);
        const matchReqBody = r.requestBody?.toLowerCase().includes(kw);
        const matchResHeaders = r.responseHeaders?.length > 0 && headersToStr(r.responseHeaders).includes(kw);
        const matchResBody = r.responseBody?.toLowerCase().includes(kw);
        if (!matchUrl && !matchReqHeaders && !matchReqBody && !matchResHeaders && !matchResBody) return false;
      }
      if (filters.methods.length > 0 && !filters.methods.includes(r.method.toUpperCase())) return false;
      if (!matchStatusRange(r.responseStatus, filters.statusRange)) return false;
      return true;
    });
  }, [requests, filters]);

  const handleSelect = useCallback((record: RequestRecord) => {
    setActiveRequest(record);
  }, [setActiveRequest]);

  const handleContextMenu = useCallback((e: React.MouseEvent, record: RequestRecord) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, record });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #e8e8e8' }}>
      {/* 顶部切换栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 8px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fafafa',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#8c8c8c' }}>{filteredRequests.length} 条请求</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <Tooltip title="树状视图">
            <span
              onClick={() => setMode('tree')}
              style={{
                cursor: 'pointer', padding: '2px 6px', borderRadius: 3, fontSize: 14,
                background: mode === 'tree' ? '#e6f4ff' : 'transparent',
                color: mode === 'tree' ? '#1677ff' : '#8c8c8c',
              }}
            >
              <ApartmentOutlined />
            </span>
          </Tooltip>
          <Tooltip title="列表视图">
            <span
              onClick={() => setMode('flat')}
              style={{
                cursor: 'pointer', padding: '2px 6px', borderRadius: 3, fontSize: 14,
                background: mode === 'flat' ? '#e6f4ff' : 'transparent',
                color: mode === 'flat' ? '#1677ff' : '#8c8c8c',
              }}
            >
              <UnorderedListOutlined />
            </span>
          </Tooltip>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mode === 'tree' ? (
          <RequestTree requests={filteredRequests} keyword={filters.keyword} onContextMenu={handleContextMenu} />
        ) : (
          filteredRequests.map((r) => (
            <div
              key={r.id}
              onClick={() => handleSelect(r)}
              onContextMenu={(e) => handleContextMenu(e, r)}
              style={{
                padding: '4px 8px', fontSize: 12, cursor: 'pointer', height: 28,
                display: 'flex', alignItems: 'center', gap: 6,
                borderBottom: '1px solid #f5f5f5',
                background: activeRequest?.id === r.id ? '#e6f4ff' : diffPair.left?.id === r.id ? '#fff7e6' : 'transparent',
                whiteSpace: 'nowrap', overflow: 'hidden',
              }}
              onMouseEnter={(e) => { if (activeRequest?.id !== r.id && diffPair.left?.id !== r.id) e.currentTarget.style.background = '#fafafa'; }}
              onMouseLeave={(e) => { if (activeRequest?.id !== r.id) e.currentTarget.style.background = diffPair.left?.id === r.id ? '#fff7e6' : 'transparent'; }}
              title={r.url}
            >
              {diffPair.left?.id === r.id && <span style={{ color: '#fa8c16', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>A</span>}
              <span style={{ color: '#1677ff', fontWeight: 500, fontSize: 11, width: 36, flexShrink: 0 }}>{r.method}</span>
              <span style={{ color: r.responseStatus >= 400 ? '#f5222d' : '#52c41a', width: 28, flexShrink: 0, fontSize: 11 }}>{r.responseStatus}</span>
              <HighlightText text={truncateUrl(r.url)} keyword={filters.keyword} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} />
            </div>
          ))
        )}
      </div>

      {/* 右键菜单 */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} record={ctxMenu.record} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
};

export default SidePanel;
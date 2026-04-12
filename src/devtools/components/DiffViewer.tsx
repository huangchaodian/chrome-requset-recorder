import React, { useState } from 'react';
import { Button, Tabs, Tag, Badge } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useRequestStore } from '../stores/requestStore';
import { useDiff } from '../hooks/useDiff';
import { DIFF_DIMENSIONS, type DiffDimension, type DiffSegment } from '../utils/diff';
import type { RequestRecord } from '../../shared/types';

/** 差异高亮背景色 */
const DIFF_COLORS: Record<number, { bg: string; color: string }> = {
  [-1]: { bg: '#fdd', color: '#a00' },   // 删除：红色
  [0]: { bg: 'transparent', color: 'inherit' },  // 相同
  [1]: { bg: '#dfd', color: '#080' },     // 新增：绿色
};

/** 渲染差异片段 - 左侧（只显示相同+删除） */
const LeftDiffPanel: React.FC<{ diffs: DiffSegment[]; label: string }> = ({ diffs, label }) => (
  <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #f0f0f0' }}>
    <div style={{ padding: '6px 12px', background: '#fafafa', fontWeight: 600, fontSize: 12, color: '#666', borderBottom: '1px solid #f0f0f0' }}>
      {label}
    </div>
    <pre style={preStyle}>
      {diffs.map((seg, i) => {
        if (seg.op === 1) return null; // 左侧不显示新增
        const style = DIFF_COLORS[seg.op];
        return (
          <span key={i} style={{ backgroundColor: style.bg, color: style.color }}>
            {seg.text}
          </span>
        );
      })}
    </pre>
  </div>
);

/** 渲染差异片段 - 右侧（只显示相同+新增） */
const RightDiffPanel: React.FC<{ diffs: DiffSegment[]; label: string }> = ({ diffs, label }) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{ padding: '6px 12px', background: '#fafafa', fontWeight: 600, fontSize: 12, color: '#666', borderBottom: '1px solid #f0f0f0' }}>
      {label}
    </div>
    <pre style={preStyle}>
      {diffs.map((seg, i) => {
        if (seg.op === -1) return null; // 右侧不显示删除
        const style = DIFF_COLORS[seg.op];
        return (
          <span key={i} style={{ backgroundColor: style.bg, color: style.color }}>
            {seg.text}
          </span>
        );
      })}
    </pre>
  </div>
);

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 12px',
  fontFamily: "'SF Mono', Monaco, monospace",
  fontSize: 12,
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  overflow: 'auto',
  maxHeight: 'calc(100vh - 200px)',
};

/** 单维度差异内容面板 */
const DimensionDiff: React.FC<{
  left: RequestRecord;
  right: RequestRecord;
  dimension: DiffDimension;
}> = ({ left, right, dimension }) => {
  const { diffs, hasDiff } = useDiff(left, right, dimension);

  if (!hasDiff) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#52c41a', fontSize: 13 }}>
        该维度内容完全相同
      </div>
    );
  }

  const leftLabel = `请求 A: ${left.method} ${truncateUrl(left.url)}`;
  const rightLabel = `请求 B: ${right.method} ${truncateUrl(right.url)}`;

  return (
    <div style={{ display: 'flex', border: '1px solid #f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
      <LeftDiffPanel diffs={diffs} label={leftLabel} />
      <RightDiffPanel diffs={diffs} label={rightLabel} />
    </div>
  );
};

/** 截断 URL */
function truncateUrl(url: string, maxLen = 40): string {
  try {
    const u = new URL(url);
    const path = u.pathname;
    return path.length > maxLen ? path.slice(0, maxLen) + '...' : path;
  } catch {
    return url.length > maxLen ? url.slice(0, maxLen) + '...' : url;
  }
}

const DiffViewer: React.FC = () => {
  const requests = useRequestStore((s) => s.requests);
  const selectedIds = useRequestStore((s) => s.selectedIds);
  const setView = useRequestStore((s) => s.setView);
  const [activeDim, setActiveDim] = useState<DiffDimension>('url');

  // 获取选中的两条请求
  const left = requests.find((r) => r.id === selectedIds[0]) || null;
  const right = requests.find((r) => r.id === selectedIds[1]) || null;

  if (!left || !right) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#8c8c8c' }}>
        请从列表中选中 2 条请求后再进入比较视图
        <br />
        <Button type="link" onClick={() => setView('list')}>返回列表</Button>
      </div>
    );
  }

  const tabItems = DIFF_DIMENSIONS.map((dim) => ({
    key: dim.key,
    label: (
      <DimTabLabel left={left} right={right} dimension={dim.key} label={dim.label} />
    ),
    children: <DimensionDiff left={left} right={right} dimension={dim.key} />,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 顶部工具栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
          flexShrink: 0,
        }}
      >
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setView('list')} size="small" />
        <span style={{ fontSize: 13, fontWeight: 500 }}>请求比较</span>
        <Tag color="blue">{left.method} {truncateUrl(left.url)}</Tag>
        <span style={{ color: '#999' }}>vs</span>
        <Tag color="green">{right.method} {truncateUrl(right.url)}</Tag>
      </div>

      {/* Tab 切换维度 + 内容 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 12px' }}>
        <Tabs
          activeKey={activeDim}
          onChange={(k) => setActiveDim(k as DiffDimension)}
          items={tabItems}
          size="small"
        />
      </div>
    </div>
  );
};

/** Tab 标签：有差异时显示红点 */
const DimTabLabel: React.FC<{
  left: RequestRecord;
  right: RequestRecord;
  dimension: DiffDimension;
  label: string;
}> = ({ left, right, dimension, label }) => {
  const { hasDiff } = useDiff(left, right, dimension);
  return hasDiff ? <Badge dot color="red" offset={[6, 0]}><span>{label}</span></Badge> : <span>{label}</span>;
};

export default DiffViewer;
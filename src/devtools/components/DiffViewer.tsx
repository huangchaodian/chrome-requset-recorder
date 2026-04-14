import React, { useState } from 'react';
import { Button, Tabs, Tag, Badge } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useRequestStore } from '../stores/requestStore';
import { useDiff } from '../hooks/useDiff';
import { DIFF_DIMENSIONS, type DiffDimension, type DiffSegment } from '../utils/diff';
import type { RequestRecord } from '../../shared/types';

/** 差异高亮背景色 */
const DIFF_COLORS: Record<number, { bg: string; color: string }> = {
  [-1]: { bg: '#fdd', color: '#a00' },
  [0]: { bg: 'transparent', color: 'inherit' },
  [1]: { bg: '#dfd', color: '#080' },
};

/** 渲染差异片段 - 左侧（只显示相同+删除） */
const LeftDiffPanel: React.FC<{ diffs: DiffSegment[]; label: string }> = ({ diffs, label }) => (
  <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #f0f0f0' }}>
    <div style={{ padding: '6px 12px', background: '#fafafa', fontWeight: 600, fontSize: 12, color: '#666', borderBottom: '1px solid #f0f0f0' }}>
      {label}
    </div>
    <pre style={preStyle}>
      {diffs.map((seg, i) => {
        if (seg.op === 1) return null;
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
        if (seg.op === -1) return null;
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
  maxHeight: 'calc(100vh - 220px)',
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

  const leftLabel = `A: ${left.method} ${truncateUrl(left.url)}`;
  const rightLabel = `B: ${right.method} ${truncateUrl(right.url)}`;

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
  const diffPair = useRequestStore((s) => s.diffPair);
  const clearDiff = useRequestStore((s) => s.clearDiff);
  const setView = useRequestStore((s) => s.setView);
  const [activeDim, setActiveDim] = useState<DiffDimension>('url');

  const left = diffPair.left;
  const right = diffPair.right;

  if (!left || !right) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bfbfbf', gap: 12 }}>
        <div style={{ fontSize: 13 }}>请选择两条请求进行比较</div>
        <div style={{ fontSize: 12, color: '#d9d9d9' }}>
          在左侧列表右键 → "设为 Diff A"，再右键另一条 → "设为 Diff B 并比较"
        </div>
        <div style={{ fontSize: 12, color: '#d9d9d9' }}>
          或在请求详情中点击 "Diff A" / "Diff B" 按钮
        </div>
        <Button type="link" size="small" onClick={() => setView('detail')}>返回详情</Button>
      </div>
    );
  }

  const handleClose = () => {
    clearDiff();
    setView('detail');
  };

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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', borderBottom: '1px solid #f0f0f0',
        background: '#fafafa', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>请求比较</span>
        <Tag color="blue">A: {left.method} {truncateUrl(left.url)}</Tag>
        <span style={{ color: '#999' }}>vs</span>
        <Tag color="green">B: {right.method} {truncateUrl(right.url)}</Tag>
        <span style={{ flex: 1 }} />
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleClose}>
          关闭
        </Button>
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
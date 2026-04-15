import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { RequestRecord } from '../../shared/types';
import { useRequestStore } from '../stores/requestStore';
import HighlightText from './HighlightText';

/** 树节点结构 */
interface TreeNode {
  key: string;
  label: string;
  isDomain?: boolean;
  children: TreeNode[];
  record?: RequestRecord;
}

/** 构建结果 */
interface BuildResult {
  tree: TreeNode[];
  /** recordId → 从根到叶子的所有祖先 key（不含叶子自身） */
  ancestorMap: Map<string, string[]>;
}

/** 将请求列表按 URL 路径构建树，同时生成祖先映射 */
function buildTree(requests: RequestRecord[]): BuildResult {
  const domainMap = new Map<string, Map<string, RequestRecord[]>>();

  for (const req of requests) {
    try {
      const u = new URL(req.url);
      const domain = u.host;
      const pathWithQuery = u.pathname.slice(1) + u.search;
      if (!domainMap.has(domain)) domainMap.set(domain, new Map());
      const pathMap = domainMap.get(domain)!;
      if (!pathMap.has(pathWithQuery)) pathMap.set(pathWithQuery, []);
      pathMap.get(pathWithQuery)!.push(req);
    } catch {
      // ignore
    }
  }

  const roots: TreeNode[] = [];
  const ancestorMap = new Map<string, string[]>();

  for (const [domain, pathMap] of domainMap) {
    const domainNode: TreeNode = {
      key: domain, label: domain, isDomain: true, children: [],
    };

    for (const [fullPath, records] of pathMap) {
      const segments = fullPath.split('/').filter(Boolean);
      let currentChildren = domainNode.children;
      let currentKey = domain;
      const ancestorKeys: string[] = [domain];

      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        currentKey += '/' + seg;
        let existing = currentChildren.find((n) => n.label === seg && !n.record);
        if (!existing) {
          existing = { key: currentKey, label: seg, children: [] };
          currentChildren.push(existing);
        }
        currentChildren = existing.children;
        ancestorKeys.push(currentKey);
      }

      const lastSeg = segments[segments.length - 1] || fullPath;
      if (records.length === 1) {
        currentChildren.push({
          key: records[0].id, label: lastSeg, children: [], record: records[0],
        });
        ancestorMap.set(records[0].id, [...ancestorKeys]);
      } else {
        for (const rec of records) {
          const query = new URL(rec.url).search.slice(1).slice(0, 30);
          currentChildren.push({
            key: rec.id,
            label: `${lastSeg.split('?')[0]}?${query}...`,
            children: [], record: rec,
          });
          ancestorMap.set(rec.id, [...ancestorKeys]);
        }
      }
    }

    roots.push(domainNode);
  }

  return { tree: roots, ancestorMap };
}

/** 单个树节点 */
const TreeNodeItem: React.FC<{
  node: TreeNode;
  depth: number;
  expandedKeys: Set<string>;
  toggleExpand: (key: string) => void;
  activeId: string | null;
  diffLeftId: string | null;
  keyword?: string;
  onSelect: (record: RequestRecord) => void;
  onContextMenu?: (e: React.MouseEvent, record: RequestRecord) => void;
}> = ({ node, depth, expandedKeys, toggleExpand, activeId, diffLeftId, keyword, onSelect, onContextMenu }) => {
  const isLeaf = !!node.record;
  const isExpanded = expandedKeys.has(node.key);
  const isActive = isLeaf && node.record?.id === activeId;
  const isDiffLeft = isLeaf && node.record?.id === diffLeftId;
  const hasChildren = node.children.length > 0;
  const nodeRef = useRef<HTMLDivElement>(null);

  // 选中时滚动到可视区域
  useEffect(() => {
    if (isActive && nodeRef.current) {
      nodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isActive]);

  const handleClick = () => {
    if (isLeaf && node.record) onSelect(node.record);
    else toggleExpand(node.key);
  };

  const handleCtxMenu = (e: React.MouseEvent) => {
    if (isLeaf && node.record && onContextMenu) onContextMenu(e, node.record);
  };

  const getBg = () => {
    if (isActive) return '#e6f4ff';
    if (isDiffLeft) return '#fff7e6';
    return 'transparent';
  };

  return (
    <>
      <div
        ref={nodeRef}
        onClick={handleClick}
        onContextMenu={handleCtxMenu}
        style={{
          display: 'flex', alignItems: 'center',
          paddingLeft: depth * 16 + 8, paddingRight: 8,
          height: 26, cursor: 'pointer', fontSize: 12,
          color: isLeaf ? '#333' : '#555',
          fontWeight: node.isDomain ? 600 : 'normal',
          background: getBg(),
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          borderBottom: '1px solid #f5f5f5',
        }}
        onMouseEnter={(e) => {
          if (!isActive && !isDiffLeft) e.currentTarget.style.background = '#fafafa';
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = getBg(); }}
        title={isLeaf ? node.record?.url : node.label}
      >
        {!isLeaf && hasChildren ? (
          <span style={{
            display: 'inline-block', width: 16, textAlign: 'center', flexShrink: 0,
            color: '#999', fontSize: 10, transition: 'transform 0.15s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>▶</span>
        ) : (
          <span style={{ display: 'inline-block', width: 16, flexShrink: 0 }} />
        )}

        {node.isDomain && (
          <span style={{ marginRight: 4, color: '#52c41a', fontSize: 11 }}>⊕</span>
        )}

        {isDiffLeft && (
          <span style={{ marginRight: 4, color: '#fa8c16', fontSize: 10, fontWeight: 700 }}>A</span>
        )}

        {isLeaf && isActive && (
          <span style={{ marginRight: 4, color: '#1677ff', fontSize: 10, fontWeight: 700 }}>{'>'}</span>
        )}

        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {isLeaf ? <HighlightText text={node.label} keyword={keyword} /> : node.label}
        </span>
      </div>

      {isExpanded && node.children.map((child) => (
        <TreeNodeItem
          key={child.key} node={child} depth={depth + 1}
          expandedKeys={expandedKeys} toggleExpand={toggleExpand}
          activeId={activeId} diffLeftId={diffLeftId}
          keyword={keyword}
          onSelect={onSelect} onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
};

const RequestTree: React.FC<{
  requests: RequestRecord[];
  keyword?: string;
  onContextMenu?: (e: React.MouseEvent, record: RequestRecord) => void;
}> = ({ requests, keyword, onContextMenu }) => {
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);
  const activeRequest = useRequestStore((s) => s.activeRequest);
  const diffPair = useRequestStore((s) => s.diffPair);

  const { tree, ancestorMap } = useMemo(() => buildTree(requests), [requests]);

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    tree.forEach((n) => keys.add(n.key));
    return keys;
  });

  // 当 activeRequest 变化时，自动展开其所有祖先节点
  useEffect(() => {
    if (!activeRequest) return;
    const ancestors = ancestorMap.get(activeRequest.id);
    if (!ancestors || ancestors.length === 0) return;

    setExpandedKeys((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const key of ancestors) {
        if (!next.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeRequest, ancestorMap]);

  // 树结构变化时，确保新域名默认展开
  useEffect(() => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const node of tree) {
        if (!next.has(node.key)) {
          next.add(node.key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tree]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleSelect = useCallback((record: RequestRecord) => {
    setActiveRequest(record);
  }, [setActiveRequest]);

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {tree.map((node) => (
        <TreeNodeItem
          key={node.key} node={node} depth={0}
          expandedKeys={expandedKeys} toggleExpand={toggleExpand}
          activeId={activeRequest?.id || null}
          diffLeftId={diffPair.left?.id || null}
          keyword={keyword}
          onSelect={handleSelect} onContextMenu={onContextMenu}
        />
      ))}
      {tree.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: '#bbb', fontSize: 12 }}>
          暂无请求
        </div>
      )}
    </div>
  );
};

export default RequestTree;
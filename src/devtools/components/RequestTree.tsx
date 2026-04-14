import React, { useMemo, useState, useCallback } from 'react';
import type { RequestRecord } from '../../shared/types';
import { useRequestStore } from '../stores/requestStore';

/** 树节点结构 */
interface TreeNode {
  key: string;
  label: string;
  /** 是否为域名根节点 */
  isDomain?: boolean;
  children: TreeNode[];
  /** 叶子节点关联的请求记录 */
  record?: RequestRecord;
}

/** 将请求列表按 URL 路径构建树 */
function buildTree(requests: RequestRecord[]): TreeNode[] {
  const domainMap = new Map<string, Map<string, RequestRecord[]>>();

  for (const req of requests) {
    try {
      const u = new URL(req.url);
      const domain = u.host;
      // 去掉开头的 / 再按 / 分割路径段
      const pathWithQuery = u.pathname.slice(1) + u.search;

      if (!domainMap.has(domain)) {
        domainMap.set(domain, new Map());
      }
      const pathMap = domainMap.get(domain)!;
      if (!pathMap.has(pathWithQuery)) {
        pathMap.set(pathWithQuery, []);
      }
      pathMap.get(pathWithQuery)!.push(req);
    } catch {
      // URL 解析失败，放到 "other" 域下
    }
  }

  const roots: TreeNode[] = [];

  for (const [domain, pathMap] of domainMap) {
    const domainNode: TreeNode = {
      key: domain,
      label: domain,
      isDomain: true,
      children: [],
    };

    // 为该域名下的路径构建子树
    const pathRoot: Record<string, TreeNode> = {};

    for (const [fullPath, records] of pathMap) {
      const segments = fullPath.split('/').filter(Boolean);

      let currentChildren = domainNode.children;
      let currentKey = domain;

      // 构建路径层级（除最后一段外都是中间节点）
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        currentKey += '/' + seg;

        let existing = currentChildren.find((n) => n.label === seg && !n.record);
        if (!existing) {
          existing = { key: currentKey, label: seg, children: [] };
          currentChildren.push(existing);
        }
        currentChildren = existing.children;
      }

      // 最后一段 = 叶子节点（每条请求各一个叶子）
      const lastSeg = segments[segments.length - 1] || fullPath;
      if (records.length === 1) {
        currentChildren.push({
          key: records[0].id,
          label: lastSeg,
          children: [],
          record: records[0],
        });
      } else {
        // 同路径多条请求：加一个路径文件夹，下面挂各条请求
        for (const rec of records) {
          const ts = new Date(rec.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 2,
          } as Intl.DateTimeFormatOptions);
          currentChildren.push({
            key: rec.id,
            label: `${lastSeg.split('?')[0]}?${new URL(rec.url).search.slice(1).slice(0, 30)}...`,
            children: [],
            record: rec,
          });
        }
      }
    }

    roots.push(domainNode);
  }

  return roots;
}

/** 单个树节点 */
const TreeNodeItem: React.FC<{
  node: TreeNode;
  depth: number;
  expandedKeys: Set<string>;
  toggleExpand: (key: string) => void;
  activeId: string | null;
  onSelect: (record: RequestRecord) => void;
}> = ({ node, depth, expandedKeys, toggleExpand, activeId, onSelect }) => {
  const isLeaf = !!node.record;
  const isExpanded = expandedKeys.has(node.key);
  const isActive = isLeaf && node.record?.id === activeId;
  const hasChildren = node.children.length > 0;

  const handleClick = () => {
    if (isLeaf && node.record) {
      onSelect(node.record);
    } else {
      toggleExpand(node.key);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: depth * 16 + 8,
          paddingRight: 8,
          height: 26,
          cursor: 'pointer',
          fontSize: 12,
          color: isLeaf ? '#333' : '#555',
          fontWeight: node.isDomain ? 600 : 'normal',
          background: isActive ? '#e6f4ff' : 'transparent',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          borderBottom: '1px solid #f5f5f5',
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = '#fafafa';
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = 'transparent';
        }}
        title={isLeaf ? node.record?.url : node.label}
      >
        {/* 展开/折叠图标 */}
        {!isLeaf && hasChildren ? (
          <span style={{
            display: 'inline-block',
            width: 16,
            textAlign: 'center',
            flexShrink: 0,
            color: '#999',
            fontSize: 10,
            transition: 'transform 0.15s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>
            ▶
          </span>
        ) : (
          <span style={{ display: 'inline-block', width: 16, flexShrink: 0 }} />
        )}

        {/* 域名图标 */}
        {node.isDomain && (
          <span style={{ marginRight: 4, color: '#52c41a', fontSize: 11 }}>⊕</span>
        )}

        {/* 叶子节点选中标记 */}
        {isLeaf && isActive && (
          <span style={{ marginRight: 4, color: '#1677ff', fontSize: 10, fontWeight: 700 }}>{'>'}</span>
        )}

        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.label}
        </span>
      </div>

      {/* 子节点 */}
      {isExpanded && node.children.map((child) => (
        <TreeNodeItem
          key={child.key}
          node={child}
          depth={depth + 1}
          expandedKeys={expandedKeys}
          toggleExpand={toggleExpand}
          activeId={activeId}
          onSelect={onSelect}
        />
      ))}
    </>
  );
};

const RequestTree: React.FC<{ requests: RequestRecord[] }> = ({ requests }) => {
  const setActiveRequest = useRequestStore((s) => s.setActiveRequest);
  const activeRequest = useRequestStore((s) => s.activeRequest);

  const tree = useMemo(() => buildTree(requests), [requests]);

  // 默认展开所有域名节点
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const keys = new Set<string>();
    tree.forEach((n) => keys.add(n.key));
    return keys;
  });

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
          key={node.key}
          node={node}
          depth={0}
          expandedKeys={expandedKeys}
          toggleExpand={toggleExpand}
          activeId={activeRequest?.id || null}
          onSelect={handleSelect}
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
import React, { useEffect, useRef } from 'react';
import type { RequestRecord } from '../../shared/types';
import { useRequestStore } from '../stores/requestStore';

interface ContextMenuProps {
  x: number;
  y: number;
  record: RequestRecord;
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, record, onClose }) => {
  const diffPair = useRequestStore((s) => s.diffPair);
  const setDiffLeft = useRequestStore((s) => s.setDiffLeft);
  const setDiffRight = useRequestStore((s) => s.setDiffRight);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const items = [
    {
      label: diffPair.left?.id === record.id ? 'Diff A (当前)' : '设为 Diff A（基准）',
      disabled: diffPair.left?.id === record.id,
      onClick: () => { setDiffLeft(record); onClose(); },
    },
    {
      label: '设为 Diff B 并比较',
      disabled: !diffPair.left || diffPair.left.id === record.id,
      onClick: () => { setDiffRight(record); onClose(); },
    },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9999,
        background: '#fff',
        borderRadius: 6,
        boxShadow: '0 3px 12px rgba(0,0,0,0.15)',
        border: '1px solid #e8e8e8',
        padding: '4px 0',
        minWidth: 160,
      }}
    >
      {items.map((item, i) => (
        <div
          key={i}
          onClick={item.disabled ? undefined : item.onClick}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            color: item.disabled ? '#bfbfbf' : '#333',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) e.currentTarget.style.background = '#f5f5f5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
};

export default ContextMenu;
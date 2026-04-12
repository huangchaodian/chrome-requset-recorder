import React, { useCallback } from 'react';
import { Button, Input } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Header } from '../../shared/types';

interface HeaderEditorProps {
  headers: Header[];
  onChange: (headers: Header[]) => void;
  readOnly?: boolean;
}

const HeaderEditor: React.FC<HeaderEditorProps> = ({ headers, onChange, readOnly = false }) => {
  const handleNameChange = useCallback(
    (index: number, name: string) => {
      const next = [...headers];
      next[index] = { ...next[index], name };
      onChange(next);
    },
    [headers, onChange]
  );

  const handleValueChange = useCallback(
    (index: number, value: string) => {
      const next = [...headers];
      next[index] = { ...next[index], value };
      onChange(next);
    },
    [headers, onChange]
  );

  const handleAdd = useCallback(() => {
    onChange([...headers, { name: '', value: '' }]);
  }, [headers, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      const next = headers.filter((_, i) => i !== index);
      onChange(next);
    },
    [headers, onChange]
  );

  return (
    <div style={{ width: '100%' }}>
      {/* 表头 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 0',
          borderBottom: '1px solid #f0f0f0',
          fontSize: 12,
          fontWeight: 600,
          color: '#666',
        }}
      >
        <div style={{ flex: 4 }}>名称</div>
        <div style={{ flex: 6 }}>值</div>
        {!readOnly && <div style={{ width: 32 }} />}
      </div>

      {/* 行列表 */}
      {headers.length === 0 && (
        <div style={{ padding: '12px 0', color: '#8c8c8c', fontSize: 12 }}>(无请求头)</div>
      )}
      {headers.map((header, index) => (
        <div
          key={index}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '3px 0',
            borderBottom: '1px solid #fafafa',
          }}
        >
          <div style={{ flex: 4 }}>
            <Input
              size="small"
              value={header.name}
              placeholder="Header Name"
              disabled={readOnly}
              onChange={(e) => handleNameChange(index, e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          <div style={{ flex: 6 }}>
            <Input
              size="small"
              value={header.value}
              placeholder="Header Value"
              disabled={readOnly}
              onChange={(e) => handleValueChange(index, e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
          {!readOnly && (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemove(index)}
              style={{ width: 32, flexShrink: 0 }}
            />
          )}
        </div>
      ))}

      {/* 添加按钮 */}
      {!readOnly && (
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAdd}
          style={{ marginTop: 8, width: '100%' }}
        >
          添加请求头
        </Button>
      )}
    </div>
  );
};

export default HeaderEditor;
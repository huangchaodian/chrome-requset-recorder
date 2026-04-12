import React, { useState, useMemo } from 'react';
import { Button, Space } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

interface JsonViewerProps {
  data: string | null;
  maxHeight?: number;
}

/** 尝试解析并格式化 JSON */
function tryParseJson(text: string): { parsed: unknown; isJson: boolean } {
  try {
    const parsed = JSON.parse(text);
    return { parsed, isJson: true };
  } catch {
    return { parsed: null, isJson: false };
  }
}

/** 递归渲染 JSON 节点 */
const JsonNode: React.FC<{ data: unknown; depth: number; keyName?: string }> = ({
  data,
  depth,
  keyName,
}) => {
  const [collapsed, setCollapsed] = useState(depth > 2);
  const indent = depth * 16;

  if (data === null) {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
        {keyName !== undefined && ': '}
        <span style={{ color: '#0451a5' }}>null</span>
      </div>
    );
  }

  if (typeof data === 'boolean') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
        {keyName !== undefined && ': '}
        <span style={{ color: '#0451a5' }}>{String(data)}</span>
      </div>
    );
  }

  if (typeof data === 'number') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
        {keyName !== undefined && ': '}
        <span style={{ color: '#098658' }}>{data}</span>
      </div>
    );
  }

  if (typeof data === 'string') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
        {keyName !== undefined && ': '}
        <span style={{ color: '#a31515' }}>"{data}"</span>
      </div>
    );
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return (
        <div style={{ paddingLeft: indent }}>
          {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
          {keyName !== undefined && ': '}
          <span>{'[]'}</span>
        </div>
      );
    }
    return (
      <div style={{ paddingLeft: indent }}>
        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
          {keyName !== undefined && ': '}
          <span style={{ color: '#999' }}>{collapsed ? `[...] (${data.length})` : '['}</span>
        </span>
        {!collapsed && (
          <>
            {data.map((item, i) => (
              <JsonNode key={i} data={item} depth={depth + 1} />
            ))}
            <div style={{ paddingLeft: indent }}>]</div>
          </>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <div style={{ paddingLeft: indent }}>
          {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
          {keyName !== undefined && ': '}
          <span>{'{}'}</span>
        </div>
      );
    }
    return (
      <div style={{ paddingLeft: indent }}>
        <span
          onClick={() => setCollapsed(!collapsed)}
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          {keyName !== undefined && <span style={{ color: '#a31515' }}>"{keyName}"</span>}
          {keyName !== undefined && ': '}
          <span style={{ color: '#999' }}>{collapsed ? `{...} (${entries.length})` : '{'}</span>
        </span>
        {!collapsed && (
          <>
            {entries.map(([key, value]) => (
              <JsonNode key={key} data={value} depth={depth + 1} keyName={key} />
            ))}
            <div style={{ paddingLeft: indent }}>{'}'}</div>
          </>
        )}
      </div>
    );
  }

  return <div style={{ paddingLeft: indent }}>{String(data)}</div>;
};

const JsonViewer: React.FC<JsonViewerProps> = ({ data, maxHeight = 400 }) => {
  const [rawMode, setRawMode] = useState(false);
  const [copied, setCopied] = useState(false);

  const { parsed, isJson } = useMemo(
    () => (data ? tryParseJson(data) : { parsed: null, isJson: false }),
    [data]
  );

  if (!data) {
    return <div style={{ padding: 12, color: '#8c8c8c' }}>(空)</div>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(isJson && !rawMode ? JSON.stringify(parsed, null, 2) : data);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px', gap: 4 }}>
        {isJson && (
          <Button size="small" type={rawMode ? 'default' : 'primary'} onClick={() => setRawMode(!rawMode)}>
            {rawMode ? '格式化' : '原始文本'}
          </Button>
        )}
        <Button size="small" icon={copied ? <CheckOutlined /> : <CopyOutlined />} onClick={handleCopy}>
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <div
        style={{
          maxHeight,
          overflow: 'auto',
          padding: '8px 12px',
          fontFamily: "'SF Mono', Monaco, monospace",
          fontSize: 12,
          lineHeight: 1.6,
          background: '#f6f8fa',
          borderRadius: 4,
        }}
      >
        {isJson && !rawMode ? (
          <JsonNode data={parsed} depth={0} />
        ) : (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{data}</pre>
        )}
      </div>
    </div>
  );
};

export default JsonViewer;
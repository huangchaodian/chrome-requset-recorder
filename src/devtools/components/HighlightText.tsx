import React from 'react';

/**
 * 高亮文本组件：将匹配关键字的部分标红显示
 */
const HighlightText: React.FC<{
  text: string;
  keyword?: string;
  style?: React.CSSProperties;
}> = ({ text, keyword, style }) => {
  if (!keyword || !text) {
    return <span style={style}>{text}</span>;
  }

  const lowerText = text.toLowerCase();
  const lowerKw = keyword.toLowerCase();
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerKw, lastIndex);

  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <span key={idx} style={{ color: '#ff4d4f', fontWeight: 600 }}>
        {text.slice(idx, idx + keyword.length)}
      </span>
    );
    lastIndex = idx + keyword.length;
    idx = lowerText.indexOf(lowerKw, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <span style={style}>{parts}</span>;
};

export default HighlightText;
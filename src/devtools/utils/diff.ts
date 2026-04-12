import DiffMatchPatch from 'diff-match-patch';
import type { Header, RequestRecord } from '../../shared/types';

const dmp = new DiffMatchPatch();

/** 差异片段类型：0=相同, -1=删除, 1=新增 */
export interface DiffSegment {
  op: -1 | 0 | 1;
  text: string;
}

/** 计算两段文本的差异 */
export function computeDiff(left: string, right: string): DiffSegment[] {
  const diffs = dmp.diff_main(left, right);
  dmp.diff_cleanupSemantic(diffs);
  return diffs.map(([op, text]) => ({ op: op as -1 | 0 | 1, text }));
}

/** 将 Header[] 转为可比较的文本（每行 name: value） */
export function headersToText(headers: Header[] | undefined | null): string {
  if (!headers || headers.length === 0) return '(空)';
  return headers.map((h) => `${h.name}: ${h.value}`).join('\n');
}

/** 尝试格式化 JSON；非 JSON 原样返回 */
export function formatBody(body: string | null | undefined): string {
  if (!body) return '(空)';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/** 比较维度 */
export type DiffDimension =
  | 'url'
  | 'requestHeaders'
  | 'requestBody'
  | 'responseHeaders'
  | 'responseBody';

export const DIFF_DIMENSIONS: { key: DiffDimension; label: string }[] = [
  { key: 'url', label: 'URL 与参数' },
  { key: 'requestHeaders', label: '请求头' },
  { key: 'requestBody', label: '请求体' },
  { key: 'responseHeaders', label: '响应头' },
  { key: 'responseBody', label: '响应体' },
];

/** 根据维度提取请求的可比较文本 */
export function extractText(record: RequestRecord, dim: DiffDimension): string {
  switch (dim) {
    case 'url':
      return `${record.method} ${record.url}`;
    case 'requestHeaders':
      return headersToText(record.requestHeaders);
    case 'requestBody':
      return formatBody(record.requestBody);
    case 'responseHeaders':
      return headersToText(record.responseHeaders);
    case 'responseBody':
      return formatBody(record.responseBody);
    default:
      return '';
  }
}

/** 一次性计算某维度的差异 */
export function diffDimension(
  left: RequestRecord,
  right: RequestRecord,
  dim: DiffDimension
): DiffSegment[] {
  return computeDiff(extractText(left, dim), extractText(right, dim));
}
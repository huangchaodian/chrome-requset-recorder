import type { RequestRecord } from '../../shared/types';

/** 导出格式 */
interface ExportData {
  version: 1;
  exportedAt: string;
  count: number;
  requests: RequestRecord[];
}

/** 校验导入数据格式 */
function validateImportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.version !== 1) return false;
  if (!Array.isArray(d.requests)) return false;
  // 校验每条记录的必要字段
  return d.requests.every(
    (r: unknown) =>
      r &&
      typeof r === 'object' &&
      typeof (r as Record<string, unknown>).id === 'string' &&
      typeof (r as Record<string, unknown>).url === 'string' &&
      typeof (r as Record<string, unknown>).method === 'string'
  );
}

/** 导出请求为 JSON 文件下载 */
export function exportRequests(requests: RequestRecord[], filename?: string): void {
  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: requests.length,
    requests,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `requests-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导入 JSON 文件并解析为请求列表 */
export function importRequests(): Promise<RequestRecord[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('未选择文件'));

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!validateImportData(parsed)) {
          return reject(new Error('文件格式不正确，需要有效的请求导出文件'));
        }
        resolve(parsed.requests);
      } catch (e) {
        reject(new Error(`解析失败: ${(e as Error).message}`));
      }
    };

    input.click();
  });
}
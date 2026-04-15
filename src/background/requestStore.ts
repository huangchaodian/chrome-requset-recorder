import type { RequestRecord } from '../shared/types';
import { DEFAULT_MAX_RECORDS } from '../shared/constants';

/**
 * 环形缓冲区请求数据存储
 * 支持 FIFO 淘汰策略，O(1) 添加和删除
 */

/** 缓冲的 response body（等待匹配的） */
interface PendingBody {
  url: string;
  method: string;
  responseBody: string;
  timestamp: number;
  mappedUrl?: string;
}

/** 缓冲过期时间：10 秒 */
const PENDING_BODY_TTL = 10_000;

class RequestStore {
  private records: RequestRecord[] = [];
  private maxRecords: number = DEFAULT_MAX_RECORDS;
  private isRecording: boolean = true;

  /** 等待匹配的 response body 缓冲区 */
  private pendingBodies: PendingBody[] = [];

  /** 获取所有请求记录 */
  getAll(): RequestRecord[] {
    return [...this.records];
  }

  /** 根据 ID 获取单条记录 */
  getById(id: string): RequestRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  /** 添加请求记录，超出上限时自动淘汰最早的记录 */
  add(record: RequestRecord): void {
    if (!this.isRecording) return;

    this.records.push(record);

    // FIFO 淘汰：超出上限时移除最早的记录
    while (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    // 尝试从缓冲区匹配 response body
    this.tryMatchPendingBody(record);
  }

  /** 批量添加记录（用于恢复备份数据） */
  addBatch(records: RequestRecord[]): void {
    for (const record of records) {
      this.records.push(record);
    }
    // 淘汰超出部分
    while (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  /** 根据 ID 列表删除记录 */
  remove(ids: string[]): void {
    const idSet = new Set(ids);
    this.records = this.records.filter((r) => !idSet.has(r.id));
  }

  /** 清空所有请求记录 */
  clear(): void {
    this.records = [];
  }

  /** 获取记录总数 */
  getCount(): number {
    return this.records.length;
  }

  /** 设置最大记录条数 */
  setMaxRecords(max: number): void {
    this.maxRecords = max;
    // 立即淘汰超出部分
    while (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  /** 获取最大记录条数 */
  getMaxRecords(): number {
    return this.maxRecords;
  }

  /** 获取录制状态 */
  getRecordingStatus(): boolean {
    return this.isRecording;
  }

  /** 设置录制状态 */
  setRecording(enabled: boolean): void {
    this.isRecording = enabled;
  }

  /** 通过 URL 和方法匹配更新响应体，返回匹配到的记录 ID */
  updateResponseBody(url: string, method: string, responseBody: string, mappedUrl?: string): string | null {
    // 从后往前找，匹配最近的无响应体记录
    for (let i = this.records.length - 1; i >= 0; i--) {
      const record = this.records[i];
      if (record.method === method && !record.responseBody) {
        // 匹配原始 URL 或映射后的 URL（webRequest 记录的是映射后 URL）
        if (record.url === url || (mappedUrl && record.url === mappedUrl)) {
          record.responseBody = responseBody;
          return record.id;
        }
      }
    }

    // 没找到匹配记录，先缓存起来（可能 webRequest.onCompleted 还没到）
    this.pendingBodies.push({
      url,
      method,
      responseBody,
      timestamp: Date.now(),
      mappedUrl,
    });

    // 清理过期的缓冲
    this.cleanPendingBodies();

    return null;
  }

  /** 新记录添加时，尝试从缓冲区匹配 response body */
  private tryMatchPendingBody(record: RequestRecord): void {
    if (record.responseBody) return;

    for (let i = this.pendingBodies.length - 1; i >= 0; i--) {
      const pending = this.pendingBodies[i];
      if (pending.method === record.method &&
          (pending.url === record.url || (pending.mappedUrl && pending.mappedUrl === record.url))) {
        record.responseBody = pending.responseBody;
        this.pendingBodies.splice(i, 1);

        // 广播更新
        chrome.runtime
          .sendMessage({
            type: 'RESPONSE_BODY_UPDATED',
            payload: { id: record.id, responseBody: pending.responseBody },
          })
          .catch(() => {});
        return;
      }
    }
  }

  /** 清理过期的 pending body */
  private cleanPendingBodies(): void {
    const now = Date.now();
    this.pendingBodies = this.pendingBodies.filter(
      (p) => now - p.timestamp < PENDING_BODY_TTL
    );
  }

  /** 导出所有数据（用于备份） */
  exportData(): RequestRecord[] {
    return [...this.records];
  }

  /** 导入数据（用于恢复） */
  importData(records: RequestRecord[]): void {
    this.records = records.slice(-this.maxRecords);
  }
}

/** 全局单例 */
export const requestStore = new RequestStore();
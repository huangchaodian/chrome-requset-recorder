import type { RequestRecord, FavoriteRecord, Settings } from '../shared/types';
import { STORAGE_KEYS, DEFAULT_MAX_RECORDS } from '../shared/constants';

const DB_NAME = 'RequestRecorderDB';
const DB_VERSION = 1;
const STORE_NAME = 'requestBackup';

/**
 * IndexedDB 管理：请求记录备份与恢复
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 将请求记录备份到 IndexedDB */
export async function backupRequests(records: RequestRecord[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // 清空旧数据后写入新数据
    store.clear();
    for (const record of records) {
      store.put(record);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('[Request Recorder] Backup to IndexedDB failed:', err);
  }
}

/** 从 IndexedDB 恢复请求记录 */
export async function restoreRequests(): Promise<RequestRecord[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result as RequestRecord[]);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('[Request Recorder] Restore from IndexedDB failed:', err);
    return [];
  }
}

/**
 * Chrome Storage API：收藏数据管理
 */
export async function getFavorites(): Promise<FavoriteRecord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.FAVORITES);
  return result[STORAGE_KEYS.FAVORITES] || [];
}

export async function saveFavorites(favorites: FavoriteRecord[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.FAVORITES]: favorites });
}

/** 添加收藏：将请求记录转换为收藏记录并持久化 */
export async function addFavorite(
  request: RequestRecord,
  alias?: string,
  note?: string
): Promise<FavoriteRecord> {
  const favorites = await getFavorites();

  // 检查是否已收藏（避免重复）
  const exists = favorites.find((f) => f.id === request.id);
  if (exists) return exists;

  const favorite: FavoriteRecord = {
    ...request,
    alias: alias || '',
    note: note || '',
    favoritedAt: Date.now(),
  };

  favorites.push(favorite);
  await saveFavorites(favorites);
  return favorite;
}

/** 删除收藏 */
export async function removeFavorite(id: string): Promise<void> {
  const favorites = await getFavorites();
  const filtered = favorites.filter((f) => f.id !== id);
  await saveFavorites(filtered);
}

/** 更新收藏的别名和备注 */
export async function updateFavorite(
  id: string,
  alias?: string,
  note?: string
): Promise<FavoriteRecord | null> {
  const favorites = await getFavorites();
  const target = favorites.find((f) => f.id === id);
  if (!target) return null;

  if (alias !== undefined) target.alias = alias;
  if (note !== undefined) target.note = note;

  await saveFavorites(favorites);
  return target;
}

/**
 * Chrome Storage API：用户设置管理
 */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(STORAGE_KEYS.SETTINGS);
  const stored = (result[STORAGE_KEYS.SETTINGS] || {}) as Partial<Settings>;
  return {
    maxRecords: stored.maxRecords ?? DEFAULT_MAX_RECORDS,
    isRecordingEnabled: stored.isRecordingEnabled ?? true,
    domainFilterEnabled: stored.domainFilterEnabled ?? false,
    recordDomains: Array.isArray(stored.recordDomains) ? stored.recordDomains : [],
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEYS.SETTINGS]: settings });
}

/**
 * 定时备份机制
 * Service Worker 可能随时被终止，通过 setInterval 定期备份
 */
let backupTimer: ReturnType<typeof setInterval> | null = null;

export function startPeriodicBackup(getRecords: () => RequestRecord[]): void {
  if (backupTimer) clearInterval(backupTimer);

  // 每 30 秒备份一次
  backupTimer = setInterval(() => {
    const records = getRecords();
    if (records.length > 0) {
      backupRequests(records);
    }
  }, 30_000);
}

export function stopPeriodicBackup(): void {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}
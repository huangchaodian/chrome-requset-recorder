/** 默认最大记录条数 */
export const DEFAULT_MAX_RECORDS = 1000;

/** HTTP 方法列表 */
export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

/** 状态码范围 */
export const STATUS_RANGES = ['2xx', '3xx', '4xx', '5xx'] as const;

/** 存储键名 */
export const STORAGE_KEYS = {
  FAVORITES: 'favorites',
  SETTINGS: 'settings',
  REQUEST_BACKUP: 'request_backup',
} as const;
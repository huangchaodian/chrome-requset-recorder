/** 请求头键值对 */
export interface Header {
  name: string;
  value: string;
}

/** 请求记录 */
export interface RequestRecord {
  /** 唯一标识（UUID） */
  id: string;
  /** 请求 URL */
  url: string;
  /** 请求方法 */
  method: string;
  /** 请求头 */
  requestHeaders: Header[];
  /** 请求体 */
  requestBody: string | null;
  /** 响应状态码 */
  responseStatus: number;
  /** 响应头 */
  responseHeaders: Header[];
  /** 响应体 */
  responseBody: string | null;
  /** 请求发起时间戳 */
  timestamp: number;
  /** 耗时（ms） */
  duration: number;
  /** 所属标签页 ID */
  tabId: number;
  /** 所属标签页 URL */
  tabUrl: string;
  /** 请求类型 */
  type: 'recorded' | 'replayed';
  /** 重放来源请求 ID */
  parentId?: string;
}

/** 收藏记录 */
export interface FavoriteRecord extends RequestRecord {
  /** 自定义别名 */
  alias: string;
  /** 备注 */
  note: string;
  /** 收藏时间 */
  favoritedAt: number;
}

/** 过滤选项 */
export interface FilterOptions {
  keyword: string;
  methods: string[];
  statusRange: string[];
}

/** 重放结果 */
export interface ReplayResult {
  status: number;
  headers: Header[];
  body: string;
  duration: number;
}

/** 用户设置 */
export interface Settings {
  maxRecords: number;
  isRecordingEnabled: boolean;
}
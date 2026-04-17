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
  /** 重放生成的新请求记录 ID */
  id: string;
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

/** Map Remote 规则 */
export interface MapRemoteRule {
  /** 唯一标识 */
  id: string;
  /** 是否启用 */
  enabled: boolean;
  /** 来源：协议 */
  fromProtocol: 'http' | 'https' | '*';
  /** 来源：主机 */
  fromHost: string;
  /** 来源：端口（空字符串表示默认端口） */
  fromPort: string;
  /** 来源：路径（空字符串表示匹配所有路径） */
  fromPath: string;
  /** 来源：查询字符串 */
  fromQuery: string;
  /** 目标：协议 */
  toProtocol: 'http' | 'https';
  /** 目标：主机 */
  toHost: string;
  /** 目标：端口 */
  toPort: string;
  /** 目标：路径（空字符串表示保持原路径） */
  toPath: string;
  /** 目标：查询字符串（空字符串表示保持原查询） */
  toQuery: string;
  /** 备注 */
  comment: string;
}
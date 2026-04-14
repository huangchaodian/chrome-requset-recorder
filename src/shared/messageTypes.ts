import type { RequestRecord, FavoriteRecord, ReplayResult, Settings } from './types';

/** 消息类型枚举 */
export enum MessageType {
  // 请求记录相关
  GET_REQUESTS = 'GET_REQUESTS',
  NEW_REQUEST = 'NEW_REQUEST',
  CLEAR_REQUESTS = 'CLEAR_REQUESTS',

  // 录制控制
  TOGGLE_RECORDING = 'TOGGLE_RECORDING',
  GET_RECORDING_STATUS = 'GET_RECORDING_STATUS',

  // 请求重放
  REPLAY_REQUEST = 'REPLAY_REQUEST',
  REPLAY_RESULT = 'REPLAY_RESULT',

  // 收藏相关
  GET_FAVORITES = 'GET_FAVORITES',
  ADD_FAVORITE = 'ADD_FAVORITE',
  REMOVE_FAVORITE = 'REMOVE_FAVORITE',
  UPDATE_FAVORITE = 'UPDATE_FAVORITE',

  // 响应体更新
  UPDATE_RESPONSE_BODY = 'UPDATE_RESPONSE_BODY',

  // 设置相关
  GET_SETTINGS = 'GET_SETTINGS',
  UPDATE_SETTINGS = 'UPDATE_SETTINGS',
}

/** 消息体类型定义 */
export interface MessagePayloadMap {
  [MessageType.GET_REQUESTS]: void;
  [MessageType.NEW_REQUEST]: RequestRecord;
  [MessageType.CLEAR_REQUESTS]: void;
  [MessageType.TOGGLE_RECORDING]: { enabled: boolean };
  [MessageType.GET_RECORDING_STATUS]: void;
  [MessageType.REPLAY_REQUEST]: RequestRecord;
  [MessageType.REPLAY_RESULT]: ReplayResult;
  [MessageType.GET_FAVORITES]: void;
  [MessageType.ADD_FAVORITE]: { request: RequestRecord; alias?: string; note?: string };
  [MessageType.REMOVE_FAVORITE]: { id: string };
  [MessageType.UPDATE_FAVORITE]: { id: string; alias?: string; note?: string };
  [MessageType.UPDATE_RESPONSE_BODY]: { url: string; method: string; responseBody: string };
  [MessageType.GET_SETTINGS]: void;
  [MessageType.UPDATE_SETTINGS]: Partial<Settings>;
}

/** 消息响应类型定义 */
export interface MessageResponseMap {
  [MessageType.GET_REQUESTS]: RequestRecord[];
  [MessageType.NEW_REQUEST]: void;
  [MessageType.CLEAR_REQUESTS]: void;
  [MessageType.TOGGLE_RECORDING]: { enabled: boolean };
  [MessageType.GET_RECORDING_STATUS]: { enabled: boolean };
  [MessageType.REPLAY_REQUEST]: ReplayResult;
  [MessageType.REPLAY_RESULT]: void;
  [MessageType.GET_FAVORITES]: FavoriteRecord[];
  [MessageType.ADD_FAVORITE]: FavoriteRecord;
  [MessageType.REMOVE_FAVORITE]: void;
  [MessageType.UPDATE_FAVORITE]: FavoriteRecord;
  [MessageType.UPDATE_RESPONSE_BODY]: void;
  [MessageType.GET_SETTINGS]: Settings;
  [MessageType.UPDATE_SETTINGS]: Settings;
}

/** 通用消息格式 */
export interface Message<T extends MessageType = MessageType> {
  type: T;
  payload: MessagePayloadMap[T];
}
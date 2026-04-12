import { useEffect, useCallback } from 'react';
import { MessageType } from '../../shared/messageTypes';
import type { RequestRecord } from '../../shared/types';

interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 向 Background Service Worker 发送消息并获取响应（带 5 秒超时）
 */
export function sendMessage<T = unknown>(
  type: MessageType,
  payload?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Message timeout')), 5000);
    try {
      chrome.runtime.sendMessage({ type, payload }, (response: MessageResponse<T> | undefined) => {
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('No response from background'));
          return;
        }
        if (response.success) {
          resolve(response.data as T);
        } else {
          reject(new Error(response.error || 'Unknown error'));
        }
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

/**
 * Hook：监听来自 Background 的新请求广播
 */
export function useNewRequestListener(
  onNewRequest: (record: RequestRecord) => void
): void {
  useEffect(() => {
    const handler = (message: { type: string; payload: RequestRecord }) => {
      if (message.type === MessageType.NEW_REQUEST) {
        onNewRequest(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => {
      chrome.runtime.onMessage.removeListener(handler);
    };
  }, [onNewRequest]);
}

/**
 * Hook：提供便捷的消息发送方法集合
 */
export function useMessageBridge() {
  const getRequests = useCallback(
    () => sendMessage<RequestRecord[]>(MessageType.GET_REQUESTS),
    []
  );

  const clearRequests = useCallback(
    () => sendMessage<void>(MessageType.CLEAR_REQUESTS),
    []
  );

  const toggleRecording = useCallback(
    (enabled: boolean) =>
      sendMessage<{ enabled: boolean }>(MessageType.TOGGLE_RECORDING, { enabled }),
    []
  );

  const getRecordingStatus = useCallback(
    () => sendMessage<{ enabled: boolean }>(MessageType.GET_RECORDING_STATUS),
    []
  );

  return { getRequests, clearRequests, toggleRecording, getRecordingStatus };
}
import { MessageType } from '../shared/messageTypes';
import type { RequestRecord, Settings, MapRemoteRule } from '../shared/types';
import { requestStore } from './requestStore';
import { startInterceptor, stopInterceptor } from './requestInterceptor';
import { getSettings, saveSettings, getFavorites, addFavorite, removeFavorite, updateFavorite } from './storageManager';
import { replayRequest } from './replayEngine';
import { getMapRemoteRules, saveMapRemoteRules, getMapRemoteEnabled, setMapRemoteEnabled } from './mapRemoteManager';

/**
 * 消息处理中心
 * 处理来自 UI 页面（DevTools Panel、Popup、Options）的消息
 */

interface IncomingMessage {
  type: MessageType;
  payload?: unknown;
}

export function setupMessageHandler(): void {
  chrome.runtime.onMessage.addListener(
    (
      message: IncomingMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => {
      // 使用异步处理，返回 true 表示异步发送响应
      handleMessage(message, sendResponse);
      return true;
    }
  );

  console.log('[Request Recorder] Message handler initialized');
}

async function handleMessage(
  message: IncomingMessage,
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    switch (message.type) {
      case MessageType.GET_REQUESTS: {
        const requests = requestStore.getAll();
        sendResponse({ success: true, data: requests });
        break;
      }

      case MessageType.CLEAR_REQUESTS: {
        requestStore.clear();
        sendResponse({ success: true });
        break;
      }

      case MessageType.TOGGLE_RECORDING: {
        const { enabled } = message.payload as { enabled: boolean };
        requestStore.setRecording(enabled);

        if (enabled) {
          startInterceptor();
        } else {
          stopInterceptor();
        }

        sendResponse({ success: true, data: { enabled } });
        break;
      }

      case MessageType.GET_RECORDING_STATUS: {
        const isRecording = requestStore.getRecordingStatus();
        sendResponse({ success: true, data: { enabled: isRecording } });
        break;
      }

      case MessageType.GET_SETTINGS: {
        const settings = await getSettings();
        sendResponse({ success: true, data: settings });
        break;
      }

      case MessageType.UPDATE_SETTINGS: {
        const partial = message.payload as Partial<Settings>;
        const current = await getSettings();
        const updated: Settings = { ...current, ...partial };

        if (updated.maxRecords !== current.maxRecords) {
          requestStore.setMaxRecords(updated.maxRecords);
        }

        await saveSettings(updated);
        sendResponse({ success: true, data: updated });
        break;
      }

      case MessageType.REPLAY_REQUEST: {
        const record = message.payload as RequestRecord;
        const result = await replayRequest(record);
        sendResponse({ success: true, data: result });
        break;
      }

      case MessageType.GET_FAVORITES: {
        const favorites = await getFavorites();
        sendResponse({ success: true, data: favorites });
        break;
      }

      case MessageType.ADD_FAVORITE: {
        const { request: favReq, alias, note } = message.payload as {
          request: RequestRecord;
          alias?: string;
          note?: string;
        };
        const favorite = await addFavorite(favReq, alias, note);
        sendResponse({ success: true, data: favorite });
        break;
      }

      case MessageType.REMOVE_FAVORITE: {
        const { id: removeId } = message.payload as { id: string };
        await removeFavorite(removeId);
        sendResponse({ success: true });
        break;
      }

      case MessageType.UPDATE_FAVORITE: {
        const {
          id: updateId,
          alias: updateAlias,
          note: updateNote,
        } = message.payload as { id: string; alias?: string; note?: string };
        const updated = await updateFavorite(updateId, updateAlias, updateNote);
        if (updated) {
          sendResponse({ success: true, data: updated });
        } else {
          sendResponse({ success: false, error: 'Favorite not found' });
        }
        break;
      }

      case MessageType.UPDATE_RESPONSE_BODY: {
        const { url, method, responseBody, mappedUrl } = message.payload as {
          url: string;
          method: string;
          responseBody: string;
          mappedUrl?: string;
        };
        console.log('[Request Recorder] Updating response body ', responseBody.slice(0, 100));
        const updatedId = requestStore.updateResponseBody(url, method, responseBody, mappedUrl);
        if (updatedId) {
          // 广播给 panel 更新 UI
          chrome.runtime.sendMessage({
            type: 'RESPONSE_BODY_UPDATED',
            payload: { id: updatedId, responseBody },
          }).catch(() => {});
        }
        sendResponse({ success: true });
        break;
      }

      case MessageType.GET_MAP_REMOTE_RULES: {
        const rules = await getMapRemoteRules();
        sendResponse({ success: true, data: rules });
        break;
      }

      case MessageType.SAVE_MAP_REMOTE_RULES: {
        const rules = message.payload as MapRemoteRule[];
        await saveMapRemoteRules(rules);
        sendResponse({ success: true });
        break;
      }

      case MessageType.GET_MAP_REMOTE_ENABLED: {
        const enabled = await getMapRemoteEnabled();
        sendResponse({ success: true, data: { enabled } });
        break;
      }

      case MessageType.SET_MAP_REMOTE_ENABLED: {
        const { enabled } = message.payload as { enabled: boolean };
        await setMapRemoteEnabled(enabled);
        sendResponse({ success: true, data: { enabled } });
        break;
      }

      default: {
        sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        break;
      }
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Request Recorder] Message handling error:', errMsg);
    sendResponse({ success: false, error: errMsg });
  }
}
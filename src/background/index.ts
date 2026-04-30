/**
 * Background Service Worker 入口
 * 负责请求拦截、数据管理、请求重放和消息处理
 *
 * 关键：消息监听器必须在 SW 启动的第一个事件循环内同步注册，
 * 否则 SW 被唤醒时可能丢失来自 Popup/DevTools 的消息。
 */

import { requestStore } from './requestStore';
import { startInterceptor, stopInterceptor, updateDomainFilter } from './requestInterceptor';
import { setupMessageHandler } from './messageHandler';
import {
  restoreRequests,
  getSettings,
  startPeriodicBackup,
} from './storageManager';
import { initMapRemote } from './mapRemoteManager';

// ★ 1. 最先同步注册消息处理器（不能放在 async 中）
setupMessageHandler();

// ★ 2. 同步注册拦截器（默认启动录制）
startInterceptor();

console.log('[Request Recorder] Message handler & interceptor registered synchronously');

/** 异步初始化：加载设置和恢复备份数据 */
async function initialize(): Promise<void> {
  try {
    // 加载用户设置
    const settings = await getSettings();
    requestStore.setMaxRecords(settings.maxRecords);
    requestStore.setRecording(settings.isRecordingEnabled);

    // 同步域名过滤配置到拦截器
    updateDomainFilter(settings.domainFilterEnabled, settings.recordDomains);

    // 如果用户设置为暂停，停止拦截器
    if (!settings.isRecordingEnabled) {
      stopInterceptor();
    }

    // 从 IndexedDB 恢复上次备份的请求数据
    const backupData = await restoreRequests();
    if (backupData.length > 0) {
      requestStore.importData(backupData);
      console.log(`[Request Recorder] Restored ${backupData.length} requests from backup`);
    }

    // 启动定时备份
    startPeriodicBackup(() => requestStore.exportData());

    // 初始化 Map Remote 规则
    await initMapRemote();

    console.log('[Request Recorder] Background Service Worker ready');
  } catch (err) {
    console.error('[Request Recorder] Initialization error:', err);
  }
}

initialize();
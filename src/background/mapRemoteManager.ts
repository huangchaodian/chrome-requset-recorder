import type { MapRemoteRule } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';

/**
 * Map Remote 管理器
 * - URL 重写由 content script (MAIN world) interceptor 完成
 * - CORS 头注入由 declarativeNetRequest modifyHeaders 完成
 *   为每个 initiator origin 创建精确规则（兼容 withCredentials）
 */

const CORS_RULE_ID_BASE = 10000;

// ========== 存储操作 ==========

export async function getMapRemoteRules(): Promise<MapRemoteRule[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.MAP_REMOTE_RULES) as Record<string, unknown>;
  return (result[STORAGE_KEYS.MAP_REMOTE_RULES] as MapRemoteRule[] | undefined) || [];
}

export async function getMapRemoteEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.MAP_REMOTE_ENABLED) as Record<string, unknown>;
  return result[STORAGE_KEYS.MAP_REMOTE_ENABLED] !== false;
}

export async function setMapRemoteEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.MAP_REMOTE_ENABLED]: enabled });
  await applyCorsRules();
}

export async function saveMapRemoteRules(rules: MapRemoteRule[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.MAP_REMOTE_RULES]: rules });
  await applyCorsRules();
}

// ========== CORS 规则注入 ==========

async function removeAllDynamicRules(): Promise<void> {
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const ids = existing.filter((r) => r.id >= CORS_RULE_ID_BASE).map((r) => r.id);
    if (ids.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
    }
  } catch { /* ignore */ }
}

/** 构建 CORS 响应头，Allow-Origin 使用具体 origin 值 */
function buildCorsHeaders(origin: string): chrome.declarativeNetRequest.ModifyHeaderInfo[] {
  return [
    {
      header: 'Access-Control-Allow-Origin',
      operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
      value: origin,
    },
    {
      header: 'Access-Control-Allow-Methods',
      operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
      value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
    },
    {
      header: 'Access-Control-Allow-Headers',
      operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
      value: '*',
    },
    {
      header: 'Access-Control-Allow-Credentials',
      operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
      value: 'true',
    },
    {
      header: 'Access-Control-Max-Age',
      operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
      value: '86400',
    },
  ];
}

/**
 * 只对 Map Remote 目标 host 注入 CORS 响应头
 * 不对原始 fromHost 注入，避免破坏原本正常的 CORS 头
 */
async function applyCorsRules(): Promise<void> {
  await removeAllDynamicRules();

  const enabled = await getMapRemoteEnabled();
  if (!enabled) return;

  const rules = await getMapRemoteRules();
  const activeRules = rules.filter((r) => r.enabled && r.fromHost && r.toHost);
  if (activeRules.length === 0) return;

  const dynamicRules: chrome.declarativeNetRequest.Rule[] = [];
  let ruleId = CORS_RULE_ID_BASE;

  const resourceTypes: chrome.declarativeNetRequest.ResourceType[] = [
    'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
    'other' as chrome.declarativeNetRequest.ResourceType,
  ];

  // 收集所有目标 host（去重），只对目标 host 注入 CORS
  const toHosts = new Set<string>();
  for (const r of activeRules) {
    toHosts.add(r.toHost);
  }

  for (const host of toHosts) {
    dynamicRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        responseHeaders: buildCorsHeaders('*'),
      },
      condition: {
        urlFilter: `||${host}/`,
        resourceTypes,
      },
    });
  }

  if (dynamicRules.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: dynamicRules });
      console.log(`[Map Remote] CORS rules applied for target hosts: ${[...toHosts].join(', ')}`);
    } catch (err) {
      console.error('[Map Remote] Failed to apply CORS rules:', err);
    }
  }
}

export async function initMapRemote(): Promise<void> {
  await applyCorsRules();
  const enabled = await getMapRemoteEnabled();
  const rules = await getMapRemoteRules();
  console.log(`[Map Remote] Init: enabled=${enabled}, rules=${rules.length}`);
}
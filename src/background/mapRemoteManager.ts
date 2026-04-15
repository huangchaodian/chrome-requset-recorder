import type { MapRemoteRule } from '../shared/types';
import { STORAGE_KEYS } from '../shared/constants';

/**
 * Map Remote 管理器
 * - URL 重写由 content script (MAIN world) interceptor 完成
 * - CORS 头注入由 declarativeNetRequest modifyHeaders 完成
 *   对目标 host 和源 host 都注入 CORS 头（解决 preflight 和跨域问题）
 */

const CORS_RULE_ID_BASE = 10000;

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

/** CORS 响应头配置 */
const CORS_HEADERS: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
  {
    header: 'Access-Control-Allow-Origin',
    operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
    value: '*',
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
    header: 'Access-Control-Max-Age',
    operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
    value: '86400',
  },
];

async function removeAllDynamicRules(): Promise<void> {
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const ids = existing.filter((r) => r.id >= CORS_RULE_ID_BASE).map((r) => r.id);
    if (ids.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
    }
  } catch { /* ignore */ }
}

/**
 * 为每条 Map Remote 规则的「目标 host」和「来源 host」都注入 CORS 响应头
 * 这样无论请求打到哪个 host，preflight 都能通过
 */
async function applyCorsRules(): Promise<void> {
  await removeAllDynamicRules();

  const enabled = await getMapRemoteEnabled();
  if (!enabled) return;

  const rules = await getMapRemoteRules();
  const activeRules = rules.filter((r) => r.enabled && r.toHost);
  if (activeRules.length === 0) return;

  // 收集所有涉及的 host（来源 + 目标，去重）
  const allHosts = new Set<string>();
  for (const r of activeRules) {
    if (r.fromHost) allHosts.add(r.fromHost);
    if (r.toHost) allHosts.add(r.toHost);
  }

  const dynamicRules: chrome.declarativeNetRequest.Rule[] = [];
  let ruleId = CORS_RULE_ID_BASE;

  for (const host of allHosts) {
    dynamicRules.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
        responseHeaders: CORS_HEADERS,
      },
      condition: {
        urlFilter: `||${host}/`,
        resourceTypes: [
          'xmlhttprequest' as chrome.declarativeNetRequest.ResourceType,
          'main_frame' as chrome.declarativeNetRequest.ResourceType,
          'sub_frame' as chrome.declarativeNetRequest.ResourceType,
          'other' as chrome.declarativeNetRequest.ResourceType,
        ],
      },
    });
  }

  if (dynamicRules.length > 0) {
    try {
      await chrome.declarativeNetRequest.updateDynamicRules({ addRules: dynamicRules });
      console.log(`[Map Remote] CORS headers injected for hosts: ${[...allHosts].join(', ')}`);
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
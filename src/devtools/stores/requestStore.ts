import { create } from 'zustand';
import type { RequestRecord, FilterOptions } from '../../shared/types';

interface DiffPair {
  left: RequestRecord | null;
  right: RequestRecord | null;
}

interface RequestStoreState {
  /** 当前请求记录列表 */
  requests: RequestRecord[];
  /** 选中的请求 ID 列表 */
  selectedIds: string[];
  /** 当前查看的请求详情 */
  activeRequest: RequestRecord | null;
  /** 当前视图 */
  view: 'list' | 'detail' | 'edit' | 'compare' | 'favorites' | 'settings' | 'mapRemote';
  /** 当前过滤条件 */
  filters: FilterOptions;
  /** Diff 比较对 */
  diffPair: DiffPair;

  /** 设置完整请求列表（初始加载） */
  setRequests: (requests: RequestRecord[]) => void;
  /** 添加单条请求 */
  addRequest: (req: RequestRecord) => void;
  /** 删除指定请求 */
  removeRequests: (ids: string[]) => void;
  /** 清空所有请求 */
  clearAll: () => void;
  /** 设置选中项 */
  setSelectedIds: (ids: string[]) => void;
  /** 切换选中状态 */
  toggleSelected: (id: string) => void;
  /** 全选/取消全选 */
  selectAll: (ids: string[]) => void;
  /** 设置当前查看的请求 */
  setActiveRequest: (req: RequestRecord | null) => void;
  /** 切换视图 */
  setView: (view: RequestStoreState['view']) => void;
  /** 设置过滤条件 */
  setFilters: (filters: Partial<FilterOptions>) => void;
  /** 通过 ID 更新指定请求的响应体 */
  updateResponseBody: (id: string, responseBody: string) => void;
  /** 设置 Diff 左侧（A） */
  setDiffLeft: (req: RequestRecord) => void;
  /** 设置 Diff 右侧（B），自动进入比较视图 */
  setDiffRight: (req: RequestRecord) => void;
  /** 清除 Diff 对 */
  clearDiff: () => void;
}

export const useRequestStore = create<RequestStoreState>((set) => ({
  requests: [],
  selectedIds: [],
  activeRequest: null,
  view: 'detail',
  filters: { keyword: '', methods: [], statusRange: [] },
  diffPair: { left: null, right: null },

  setRequests: (requests) => set({ requests }),

  addRequest: (req) =>
    set((state) => ({ requests: [...state.requests, req] })),

  removeRequests: (ids) =>
    set((state) => {
      const idSet = new Set(ids);
      return {
        requests: state.requests.filter((r) => !idSet.has(r.id)),
        selectedIds: state.selectedIds.filter((id) => !idSet.has(id)),
      };
    }),

  clearAll: () => set({ requests: [], selectedIds: [], activeRequest: null }),

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelected: (id) =>
    set((state) => {
      const exists = state.selectedIds.includes(id);
      return {
        selectedIds: exists
          ? state.selectedIds.filter((i) => i !== id)
          : [...state.selectedIds, id],
      };
    }),

  selectAll: (ids) =>
    set((state) =>
      state.selectedIds.length === ids.length
        ? { selectedIds: [] }
        : { selectedIds: ids }
    ),

  setActiveRequest: (req) => set({ activeRequest: req }),

  setView: (view) => set({ view }),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  updateResponseBody: (id, responseBody) =>
    set((state) => {
      const idx = state.requests.findIndex((r) => r.id === id);
      if (idx === -1) return {};
      const requests = [...state.requests];
      requests[idx] = { ...requests[idx], responseBody };
      const activeRequest =
        state.activeRequest?.id === id
          ? { ...state.activeRequest, responseBody }
          : state.activeRequest;
      return { requests, activeRequest };
    }),

  setDiffLeft: (req) =>
    set((state) => ({
      diffPair: { ...state.diffPair, left: req },
    })),

  setDiffRight: (req) =>
    set((state) => ({
      diffPair: { ...state.diffPair, right: req },
      view: 'compare',
    })),

  clearDiff: () =>
    set({ diffPair: { left: null, right: null } }),
}));
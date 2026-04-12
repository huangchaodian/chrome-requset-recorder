import { create } from 'zustand';
import { sendMessage } from '../hooks/useMessageBridge';
import { MessageType } from '../../shared/messageTypes';
import type { FavoriteRecord, RequestRecord } from '../../shared/types';

interface FavoriteStoreState {
  favorites: FavoriteRecord[];
  loading: boolean;

  /** 从 Background 加载收藏列表 */
  loadFavorites: () => Promise<void>;
  /** 添加收藏 */
  addFavorite: (request: RequestRecord, alias?: string, note?: string) => Promise<void>;
  /** 删除收藏 */
  removeFavorite: (id: string) => Promise<void>;
  /** 更新别名/备注 */
  updateFavorite: (id: string, alias?: string, note?: string) => Promise<void>;
  /** 批量收藏 */
  batchAddFavorites: (requests: RequestRecord[]) => Promise<void>;
  /** 判断是否已收藏 */
  isFavorited: (id: string) => boolean;
}

export const useFavoriteStore = create<FavoriteStoreState>((set, get) => ({
  favorites: [],
  loading: false,

  loadFavorites: async () => {
    set({ loading: true });
    try {
      const favorites = await sendMessage<FavoriteRecord[]>(MessageType.GET_FAVORITES);
      set({ favorites });
    } catch (err) {
      console.error('[FavoriteStore] Load failed:', err);
    } finally {
      set({ loading: false });
    }
  },

  addFavorite: async (request, alias, note) => {
    const record = await sendMessage<FavoriteRecord>(MessageType.ADD_FAVORITE, { request, alias, note });
    set((state) => ({ favorites: [...state.favorites, record] }));
  },

  removeFavorite: async (id) => {
    await sendMessage<void>(MessageType.REMOVE_FAVORITE, { id });
    set((state) => ({ favorites: state.favorites.filter((f) => f.id !== id) }));
  },

  updateFavorite: async (id, alias, note) => {
    const updated = await sendMessage<FavoriteRecord>(MessageType.UPDATE_FAVORITE, { id, alias, note });
    set((state) => ({
      favorites: state.favorites.map((f) => (f.id === id ? updated : f)),
    }));
  },

  batchAddFavorites: async (requests) => {
    const results = await Promise.allSettled(
      requests.map((r) => sendMessage<FavoriteRecord>(MessageType.ADD_FAVORITE, { request: r }))
    );
    const added = results
      .filter((r): r is PromiseFulfilledResult<FavoriteRecord> => r.status === 'fulfilled')
      .map((r) => r.value);
    set((state) => ({ favorites: [...state.favorites, ...added] }));
  },

  isFavorited: (id) => get().favorites.some((f) => f.id === id),
}));
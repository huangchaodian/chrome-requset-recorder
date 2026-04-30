import { create } from 'zustand';
import type { Settings } from '../../shared/types';
import { DEFAULT_MAX_RECORDS } from '../../shared/constants';

interface SettingsStoreState {
  maxRecords: number;
  isRecordingEnabled: boolean;
  domainFilterEnabled: boolean;
  recordDomains: string[];
  setSettings: (settings: Partial<Settings>) => void;
}

export const useSettingsStore = create<SettingsStoreState>((set) => ({
  maxRecords: DEFAULT_MAX_RECORDS,
  isRecordingEnabled: true,
  domainFilterEnabled: false,
  recordDomains: [],

  setSettings: (settings) => set((state) => ({ ...state, ...settings })),
}));
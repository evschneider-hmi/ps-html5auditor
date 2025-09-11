import { create } from 'zustand';
import { ZipBundle, BundleResult } from '../logic/types';
import { defaultSettings, Settings } from '../logic/profiles';

interface AppState {
  settings: Settings;
  bundles: ZipBundle[];
  results: BundleResult[];
  selectedBundleId?: string;
  setSettings: (s: Partial<Settings>) => void;
  addBundle: (b: ZipBundle) => void;
  setResults: (r: BundleResult[]) => void;
  selectBundle: (id?: string) => void;
}

export const useAppStore = create<AppState>((set: (partial: Partial<AppState> | ((state: AppState) => Partial<AppState>)) => void) => ({
  settings: loadSettings(),
  bundles: [],
  results: [],
  selectedBundleId: undefined,
  setSettings: (s: Partial<Settings>) => set((state: AppState) => {
    const merged = { ...state.settings, ...s };
    saveSettings(merged);
    return { settings: merged };
  }),
  addBundle: (b: ZipBundle) => set((state: AppState) => ({ bundles: [...state.bundles, b] })),
  setResults: (r: BundleResult[]) => set(() => ({ results: r })),
  selectBundle: (id?: string) => set(() => ({ selectedBundleId: id })),
}));

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('auditSettings');
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw);
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(s: Settings) {
  try { localStorage.setItem('auditSettings', JSON.stringify(s)); } catch {}
}

import { create } from 'zustand';
import type { ZipBundle, BundleResult, Finding, Reference } from '../../../src/logic/types';
import { defaultSettings } from '../../../src/logic/profiles';

export type InputMode = 'zip' | 'video' | 'image' | 'audio';
export type TabKey = 'zip' | 'tag' | 'vast' | 'video' | 'static';

export interface ExtBundle extends ZipBundle {
  // mode indicates how this bundle was added (zip/video/image/audio)
  mode: InputMode;
}

interface ExtState {
  settings: typeof defaultSettings;
  bundles: ExtBundle[];
  results: BundleResult[];
  selectedBundleId?: string;
  tab: TabKey;
  setTab: (t: TabKey) => void;
  // Hand-off for VAST: bytes of last uploaded ZIP from HTML5 tab so VAST can parse embedded sheets
  vastAutoPayload?: Uint8Array;
  setVastAutoPayload: (bytes?: Uint8Array) => void;
  addBundle: (b: ExtBundle) => void;
  setResults: (r: BundleResult[]) => void;
  selectBundle: (id?: string) => void;
}

export const useExtStore = create<ExtState>((set) => ({
  settings: defaultSettings,
  bundles: [],
  results: [],
  selectedBundleId: undefined,
  tab: 'zip',
  setTab: (t: TabKey) => set(() => ({ tab: t })),
  vastAutoPayload: undefined,
  setVastAutoPayload: (bytes?: Uint8Array) => set(() => ({ vastAutoPayload: bytes })),
  addBundle: (b: ExtBundle) => set((s) => ({ bundles: [...s.bundles, b] })),
  setResults: (r: BundleResult[]) => set(() => ({ results: r })),
  selectBundle: (id?: string) => set(() => ({ selectedBundleId: id })),
}));

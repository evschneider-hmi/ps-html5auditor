import { create } from 'zustand';
import type { ZipBundle, BundleResult, Finding, Reference } from '../../../src/logic/types';
import { defaultSettings } from '../../../src/logic/profiles';

export type InputMode = 'zip' | 'video' | 'image' | 'audio';
export type TabKey = 'zip' | 'tag' | 'vast' | 'video' | 'static';

export interface ExtBundle extends ZipBundle {
  mode: InputMode;
}

export interface ExtState {
  settings: typeof defaultSettings;
  bundles: ExtBundle[];
  results: BundleResult[];
  selectedBundleId?: string;
  // App-wide tab state so other components can change the active tab
  tab: TabKey;
  setTab: (t: TabKey) => void;
  // VAST tester seed and handoffs
  vastSeed?: { mode: 'url'|'xml'; value: string };
  tagSeed?: string;
  // Hand-off bytes for last uploaded ZIP (so VAST tab can parse embedded sheets without re-upload)
  vastAutoPayload?: Uint8Array;
  setVastAutoPayload: (bytes?: Uint8Array) => void;
  // Mutators
  addBundle: (b: ExtBundle) => void;
  removeBundle: (id: string) => void;
  setResults: (r: BundleResult[]) => void;
  selectBundle: (id?: string) => void;
  setVastSeed: (seed?: { mode: 'url'|'xml'; value: string }) => void;
  setTagSeed: (seed?: string) => void;
}

export const useExtStore = create<ExtState>((set) => ({
  settings: { ...defaultSettings },
  bundles: [],
  results: [],
  selectedBundleId: undefined,
  tab: 'zip',
  setTab: (t: TabKey) => set(() => ({ tab: t })),
  vastSeed: undefined,
  tagSeed: undefined,
  vastAutoPayload: undefined,
  setVastAutoPayload: (bytes?: Uint8Array) => set(() => ({ vastAutoPayload: bytes })),
  addBundle: (b: ExtBundle) => set((s) => ({ bundles: [...s.bundles, b] })),
  removeBundle: (id: string) => set((s) => {
    const bundles = s.bundles.filter((b) => b.id !== id);
    const results = s.results.filter((r) => (r as any).bundleId !== id);
    let selectedBundleId = s.selectedBundleId;
    if (selectedBundleId === id) {
      selectedBundleId = results[0]?.bundleId as any;
    }
    return { bundles, results, selectedBundleId } as any;
  }),
  setResults: (r: BundleResult[]) => set(() => ({ results: r })),
  selectBundle: (id?: string) => set(() => ({ selectedBundleId: id })),
  setVastSeed: (seed?: { mode: 'url'|'xml'; value: string }) => set(() => ({ vastSeed: seed })),
  setTagSeed: (seed?: string) => set(() => ({ tagSeed: seed })),
}));

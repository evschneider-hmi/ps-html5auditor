import { create } from 'zustand';
import type { ZipBundle, BundleResult, Finding, Reference } from '../../../src/logic/types';
import { defaultSettings } from '../../../src/logic/profiles';

export type InputMode = 'zip' | 'video' | 'image' | 'audio';
export type TabKey = 'zip' | 'tag' | 'vast' | 'video' | 'static';

export interface PreviewInfo {
  baseDir: string;
  indexPath: string;
}

export interface PreviewDiagnostics {
  baseDir: string;
  enablerSource: 'cdn' | 'shim' | 'unknown';
  dimension?: { width: number; height: number; source: string };
  networkFailures: string[];
  missingAssets: Array<{ url: string; path: string; context: string }>;
  visibilityGuardActive: boolean;
  notedAt: number;
}

export interface ExtBundle extends ZipBundle {
  mode: InputMode;
  preview?: PreviewInfo;
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
  previewDiagnostics: Record<string, PreviewDiagnostics>;
  setPreviewDiagnostics: (bundleId: string, diag: PreviewDiagnostics) => void;
  // Mutators
  addBundle: (b: ExtBundle) => void;
  removeBundle: (id: string) => void;
  setResults: (r: BundleResult[]) => void;
  selectBundle: (id?: string) => void;
  setVastSeed: (seed?: { mode: 'url'|'xml'; value: string }) => void;
  setTagSeed: (seed?: string) => void;
}

const normalizeId = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed.toLowerCase() : undefined;
};

const evaluateBundleScore = (item: BundleResult | undefined): number => {
  if (!item) return -1;
  let score = 0;
  if (item.primary?.path) score += 1_000;
  if (item.runtimeSummary) score += 250;
  if (item.runtime) score += 125;
  if (Array.isArray(item.findings)) score += Math.min(item.findings.length * 5, 250);
  if (item.summary?.status === 'FAIL') score += 40;
  else if (item.summary?.status === 'WARN') score += 20;
  if (item.totalRequests && item.totalRequests > 0) score += 10;
  if (item.totalBytes && item.totalBytes > 0) score += 5;
  return score;
};

export const useExtStore = create<ExtState>((set, get) => ({
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
  previewDiagnostics: {},
  setPreviewDiagnostics: (bundleId: string, diag: PreviewDiagnostics) =>
    set((state) => ({
      previewDiagnostics: {
        ...state.previewDiagnostics,
        [bundleId]: diag,
      },
    })),
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
  setResults: (r: BundleResult[]) =>
    set((state) => {
      const keyed = new Map<string, { item: BundleResult; score: number; index: number }>();
      const order: string[] = [];
      r.forEach((item, index) => {
        if (!item) return;
        const key = normalizeId((item as any).bundleId) ?? `__idx_${index}`;
        if (!keyed.has(key)) order.push(key);
        const score = evaluateBundleScore(item);
        const prev = keyed.get(key);
        if (!prev || score > prev.score || (score === prev.score && index > prev.index)) {
          keyed.set(key, { item, score, index });
        }
      });

      const deduped: BundleResult[] = [];
      for (const key of order) {
        const entry = keyed.get(key);
        if (entry) deduped.push(entry.item);
      }

      const currentSelected = state.selectedBundleId;
      const currentNormalized = normalizeId(currentSelected);
      const stillPresent = currentNormalized
        ? deduped.some((res) => normalizeId((res as any)?.bundleId) === currentNormalized)
        : !!currentSelected;

      let nextSelected = currentSelected;
      if (!stillPresent) {
        const firstWithId = deduped.find((res) => normalizeId((res as any)?.bundleId));
        nextSelected = firstWithId?.bundleId;
      }

      const update: Partial<ExtState> = { results: deduped } as any;
      if (nextSelected !== currentSelected) {
        update.selectedBundleId = nextSelected;
      }

      return update;
    }),
  selectBundle: (id?: string) => set(() => ({ selectedBundleId: id })),
  setVastSeed: (seed?: { mode: 'url'|'xml'; value: string }) => set(() => ({ vastSeed: seed })),
  setTagSeed: (seed?: string) => set(() => ({ tagSeed: seed })),
}));

if (typeof window !== 'undefined') {
  (window as any).__EXT_STORE__ = useExtStore;
}

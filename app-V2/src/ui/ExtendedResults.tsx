import React, { useEffect, useRef, useState } from 'react';

import { compressToEncodedURIComponent } from 'lz-string';
import { useExtStore } from '../state/useStoreExt';

import type { BundleResult, SizeSourceInfo } from '../../../src/logic/types';

import { discoverPrimary } from '../../../src/logic/discovery';

import { parsePrimary } from '../../../src/logic/parse';

import { runChecks } from '../../../src/logic/checks';

import { buildExtendedFindings } from '../logic/extendedChecks';

import { ExtendedPreview } from './ExtendedPreview';

import { buildCm360ReportJson } from '../logic/exportCm360';

import { PRIORITY_IDS, PRIORITY_ORDER } from '../logic/priority';

type XLSXModule = typeof import('xlsx/xlsx.mjs');
let xlsxModulePromise: Promise<XLSXModule> | null = null;
async function loadXLSX(): Promise<XLSXModule> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx/xlsx.mjs');
  }
  return xlsxModulePromise;
}

function formatSizeSourceLabel(
  info?: SizeSourceInfo | null,
  primaryPath?: string | null,
): string | undefined {
  if (!info) return undefined;
  const sameAsPrimary = Boolean(
    primaryPath && info.path && primaryPath.toLowerCase() === info.path.toLowerCase(),
  );
  const where = info.path && !sameAsPrimary ? ` in ${info.path}` : sameAsPrimary ? ' in primary HTML' : '';
  switch (info.method) {
    case 'meta':
      return '<meta name="ad.size"> tag';
    case 'gwd-admetadata':
      return 'GWD admetadata script';
    case 'css-media':
      return `CSS @media rule${where}`.trim();
    case 'css-rule':
      return `CSS rule${where}`.trim();
    case 'inline-style':
      return sameAsPrimary ? 'inline style attribute in primary HTML' : 'inline style attribute';
    case 'css-file':
      return info.path ? `CSS file ${info.path}` : 'CSS file';
    default:
      return undefined;
  }
}

function formatSizeDetail(
  size?: { width: number; height: number } | null,
  info?: SizeSourceInfo | null,
  primaryPath?: string | null,
): string | undefined {
  if (!size) return undefined;
  const parts: string[] = [`${size.width}x${size.height}`];
  const sourceLabel = formatSizeSourceLabel(info, primaryPath);
  if (sourceLabel) parts.push(`via ${sourceLabel}`);
  const snippet = info?.snippet?.trim();
  if (snippet) parts.push(`“${snippet}”`);
  return parts.join(' — ');
}
export const ExtendedResults: React.FC = () => {
  const {
    bundles,
    results,
    settings,
    setResults,
    selectedBundleId,
    selectBundle,
  } = useExtStore((s: any) => ({
    bundles: s.bundles,
    results: s.results,
    settings: s.settings,
    setResults: s.setResults,
    selectedBundleId: s.selectedBundleId,
    selectBundle: s.selectBundle,
  }));

  const [processing, setProcessing] = useState<boolean>(false);
  const runToken = useRef(0);

  async function process(): Promise<void> {
    const token = ++runToken.current;
    setProcessing(true);
    const list: BundleResult[] = [] as any;

    try {
      for (const b of bundles as any[]) {
        // Detect primary, ad size, and references
  let primary: any = undefined;
  let adSize: any = undefined;
  let adSizeSource: any = undefined;
        let references: any[] = [];

        try {
          if (b.mode === 'zip') {
            const d: any = discoverPrimary(b);
            primary = d?.primary;

            // Fallback: even if ad.size meta missing, choose a reasonable HTML so preview still works
            if (!primary) {
              const cands: string[] = (d && Array.isArray(d.htmlCandidates) && d.htmlCandidates.length)
                ? d.htmlCandidates
                : Object.keys(b.files || {}).filter((p) => /\.html?$/i.test(p));
              if (cands.length) {
                const chosen = chooseFallbackHTML(cands);
                primary = { path: chosen };
              }
            }

            if (primary) {
              const parsed = parsePrimary(b, primary);
              adSize = parsed.adSize;
              adSizeSource = parsed.adSizeSource;
              references = parsed.references;
              primary = {
                ...primary,
                adSize,
                sizeSource: adSizeSource,
              };
            }
          } else {
            const only = Object.keys(b.files || {})[0] || '';
            if (/\.html?$/i.test(only)) {
              primary = { path: only };
              const parsed = parsePrimary(b, primary);
              adSize = parsed.adSize;
              adSizeSource = parsed.adSizeSource;
              references = parsed.references;
              primary = {
                ...primary,
                adSize,
                sizeSource: adSizeSource,
              };
            }
          }
        } catch {}

        // Size metrics
        const totalBytes = (Object.values(b.files || {}) as Uint8Array[]).reduce(
          (a, u) => a + (u?.byteLength || 0),
          0,
        );

        const referencedPaths = new Set<string>();
        try {
          for (const r of references || [])
            if (r && r.inZip && r.normalized) referencedPaths.add(r.normalized);
        } catch {}

        try {
          const pLower = primary?.path ? String(primary.path).toLowerCase() : '';
          if (pLower) referencedPaths.add(pLower);
        } catch {}

        let initialBytes = 0;
        for (const p of referencedPaths) {
          const real = (b as any).lowerCaseIndex?.[p];
          if (real && b.files[real]) initialBytes += b.files[real].byteLength;
        }
        if (initialBytes === 0) initialBytes = totalBytes;

        const subsequentBytes = Math.max(0, totalBytes - initialBytes);
        const initialRequests = referencedPaths.size || (primary ? 1 : 0);
        const totalRequests = referencedPaths.size;

        const base: any = {
          bundleId: b.id,
          bundleName: b.name,
          primary,
          adSize,
          adSizeSource,
          references,
          totalBytes,
          initialBytes,
          subsequentBytes,
          zippedBytes: (b.bytes || new Uint8Array()).length,
          initialRequests,
          totalRequests,
          findings: [],
          summary: {
            status: 'PASS',
            totalFindings: 0,
            fails: 0,
            warns: 0,
            pass: 0,
            orphanCount: 0,
            missingAssetCount: 0,
          },
        };

        // Adjust settings to improve clickTag detection (case-insensitive variants)
        const adjustedSettings = {
          ...(settings || {}),
          clickTagPatterns: Array.from(
            new Set([
              ...(((settings as any)?.clickTagPatterns as string[]) || []),
              String(/\bclicktag\b/i),
              String(/\bwindow\.clicktag\b/i),
            ]),
          ),
        };

        // Existing checks + extended
        const builtIn = runChecks(b as any, base, adjustedSettings as any) || [];
        const ext =
          ((await buildExtendedFindings(
            b as any,
            base,
            adjustedSettings as any,
          )) as any[]) || [];

        // Remove hard-coded clickthrough URL finding and legacy duplicates
        const combinedFindings = [...builtIn, ...ext].filter((f: any) => {
          if (!f || !f.id) return false;
          if (f.id === 'hardcodedClickUrl') return false;
          if (f.id === 'clickTags') return false; // prefer extended 'clicktag'
          if (f.id === 'iabRequests') return false; // prefer 'host-requests-initial'
          if (f.id === 'packaging') return false; // covered by 'pkg-format'
          return true;
        });

        const debugFindings = combinedFindings.filter(
          (f: any) => Array.isArray(f?.tags) && f.tags.includes('debug'),
        );
        const mainFindings = combinedFindings.filter(
          (f: any) => !Array.isArray(f?.tags) || !f.tags.includes('debug'),
        );

        base.findings = mainFindings;
        base.debugFindings = debugFindings;

        // Summarize: status reflects required (Priority) checks only
        let fails = 0,
          warns = 0,
          pass = 0;
        for (const f of mainFindings) {
          const sev = (f && (f as any).severity) || 'PASS';
          if (sev === 'FAIL') fails++;
          else if (sev === 'WARN') warns++;
          else pass++;
        }

        const requiredOnly = mainFindings.filter((f: any) =>
          PRIORITY_IDS.has((f && f.id) || ''),
        );

        let status: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
        for (const f of requiredOnly) {
          if ((f as any).severity === 'FAIL') {
            status = 'FAIL';
            break;
          }
        }

        base.summary = {
          ...base.summary,
          status,
          totalFindings: mainFindings.length,
          fails,
          warns,
          pass,
        };

        list.push(base);

        if (runToken.current !== token) return; // cancel if a new run started
      }

      if (runToken.current !== token) return;
      setResults(list);

      // initialize selection if not set or stale
      try {
        const current = selectedBundleId;
        if (!current || !list.some((r) => r.bundleId === current)) {
          if (list[0]) selectBundle(list[0].bundleId);
        }
      } catch {}
    } finally {
      if (runToken.current === token) setProcessing(false);
    }
  }

  useEffect(() => {
    if (bundles.length > 0) {
      void process();
    }
    // cancel previous runs on bundles change
    return () => {
      runToken.current++;
    };
  }, [bundles.length]);

  return (
    <div>
      <style>{`
        @keyframes ext-spinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div className="toolbar" style={{ marginBottom: 8 }}>
        <ReportActions />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn"
            onClick={() =>
              openGuidelines(
                'https://support.google.com/campaignmanager/answer/6088202',
                'CM360 HTML5 Guidelines',
              )
            }
          >
            CM360 Guidelines
          </button>

          <button
            type="button"
            className="btn"
            onClick={() =>
              openGuidelines(
                'https://iabtechlab.com/standards/ad-portfolios/',
                'IAB Display Guidelines',
              )
            }
          >
            IAB Display Guidelines
          </button>
        </div>
      </div>

      {/* Removed explanatory note per request */}

      <div className="panel" style={{ marginTop: 12, overflow: 'hidden' }}>
        {processing && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 10px',
              borderRadius: 999,
              background: 'rgba(99, 102, 241, 0.18)',
              color: '#4338ca',
              boxShadow: '0 8px 18px rgba(79, 70, 229, 0.18)',
              zIndex: 5,
              fontSize: 12,
              fontWeight: 600,
            }}
            title="Processing uploaded bundle(s)"
          >
            <span
              aria-hidden="true"
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: '3px solid rgba(165, 180, 252, 0.28)',
                borderTopColor: '#7c3aed',
                borderRightColor: '#7c3aed',
                animation: 'ext-spinner 0.9s linear infinite',
              }}
            />
            <span>Processing…</span>
          </div>
        )}
        <ResultTable />
      </div>

      <SplitChecksAndPreview />
    </div>
  );
};

function openGuidelines(url: string, title: string) {
  try {
    const w = 980,
      h = 720;

    const topWin: any = window.top || window;

    const y =
      (topWin.outerHeight ? topWin.outerHeight : window.innerHeight) / 2 +
      (topWin.screenY || window.screenY || 0) -
      h / 2;

    const x =
      (topWin.outerWidth ? topWin.outerWidth : window.innerWidth) / 2 +
      (topWin.screenX || window.screenX || 0) -
      w / 2;

    window.open(
      url,
      title,
      `popup=yes,width=${w},height=${h},left=${Math.max(0, Math.floor(x))},top=${Math.max(0, Math.floor(y))},resizable=yes,scrollbars=yes`,
    );
  } catch {
    window.open(url, title);
  }
}

// User-friendly titles for checks shared by Priority and Optional lists

const TITLE_OVERRIDES: Record<string, string> = {
  // Core/built-in checks

  packaging: 'ZIP Packaging',

  primaryAsset: 'Primary File and Size',

  assetReferences: 'All Files Referenced',

  externalResources: 'Off-Domain References',

  httpsOnly: 'HTTPS Only',

  clickTags: 'Click-Through Configured',

  iabWeight: 'Weight Budgets',

  iabRequests: 'Initial Request Count',

  systemArtifacts: 'System Artifacts Removed',

  // fileTypes removed (covered by allowed-ext)

  syntaxErrors: 'Runtime Errors',

  creativeRendered: 'Rendered Successfully',

  'no-document-write': 'Avoid document.write',

  indexFile: 'Root Index File',

  // nameDimensions merged into bad-filenames

  // Extended checks

  minified: 'Minified Code',

  cssEmbedded: 'Inline CSS Usage',

  // animDuration removed (covered by animation-cap)

  dialogs: 'Blocking Dialogs',

  domContentLoaded: 'DOMContentLoaded Timing',

  timeToRender: 'Time to First Render',

  measurement: 'Tracker and Measurement Hosts',

  html5lib: 'Frameworks Detected',

  imagesOptimized: 'Image Optimization',

  hostedSize: 'Total Uncompressed Size',

  jquery: 'jQuery Usage',

  backup: 'Backup Image Present',

  iframes: 'Iframe Elements',

  networkDynamic: 'Runtime Network Calls',

  heavyAdRisk: 'Heavy Ad Risk Indicator',

  // cpuUsage removed (covered by CPU budget)

  memoryUsage: 'Peak JS Heap',

  // perfHeuristics removed (redundant)

  hostedCount: 'Hosted File Count',

  // creativeBorder removed (prefer standardized IAB border)

  // Legacy H5 validator parity

  'invalid-url-ref': 'Invalid URL References',

  'orphaned-assets': 'Orphaned Assets (Not Referenced)',

  'bad-filenames': 'Problematic Filenames',

  'invalid-markup': 'Invalid Markup (HTML/CSS/SVG)',

  'gwd-env-check': 'GWD Environment Check',

  'hardcoded-click': 'Hard-coded Clickthrough',

  // CM360 hard (extended)

  'pkg-format': 'Packaging Format',

  'entry-html': 'Single Entry HTML & References',

  'file-limits': 'File Count and Upload Size',

  'allowed-ext': 'Allowed File Extensions',

  'iframe-safe': 'Iframe Safe (No Cross-Frame DOM)',

  clicktag: 'ClickTag Present and Used',

  'no-webstorage': 'No Web Storage APIs',

  // CM360 recommended (extended)

  // 'meta-ad-size' removed (enforced via primaryAsset)

  'no-backup-in-zip': 'No Backup Image Inside ZIP',

  'relative-refs': 'Relative Paths For Packaged Assets',

  // IAB Global (extended)

  'host-requests-initial': 'Initial Host Requests',

  'cpu-budget': 'CPU Busy Budget',

  'animation-cap': 'Animation Length Cap',

  border: 'Border Present',
};

// PRIORITY_IDS now sourced from shared logic/priority

const ResultTable: React.FC = () => {
  const { results, bundles, selectedBundleId, selectBundle, removeBundle } =
    useExtStore((s: any) => ({
      results: s.results,
      bundles: s.bundles,
      selectedBundleId: s.selectedBundleId,
      selectBundle: s.selectBundle,
      removeBundle: s.removeBundle,
    }));

  const tableRef = React.useRef<HTMLTableElement | null>(null);

  type ColKey =
    | 'creative'
    | 'status'
    | 'dim'
    | 'issues'
    | 'initialkb'
    | 'totalkb'
    | 'initialreqs';

  const COLUMNS: Array<{ key: ColKey; label: string; min?: number }> = [
    { key: 'creative', label: 'Creative', min: 200 },

    { key: 'status', label: 'Status', min: 80 },

    { key: 'dim', label: 'Dimensions', min: 90 },

    { key: 'issues', label: 'Issues', min: 90 },

    { key: 'initialkb', label: 'Initial KB', min: 90 },

    { key: 'totalkb', label: 'Total KB', min: 90 },

    { key: 'initialreqs', label: 'Initial', min: 80 },
  ];

  const LS_KEY = 'ext_table_colw_v2';

  function sanitizeColMap(
    input: any,
    cols: Array<{ key: ColKey; min?: number }>,
  ): Record<string, number> {
    const out: Record<string, number> = {};

    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;

    const minLookup = new Map(
      cols.map((c) => [c.key, Math.max(c.min || 60, 40)] as const),
    );

    for (const [k, v] of Object.entries(input)) {
      const n = typeof v === 'number' && isFinite(v) ? v : NaN;

      const mk = k as ColKey;

      if (!isNaN(n) && minLookup.has(mk)) {
        const min = minLookup.get(mk)!;

        out[mk] = Math.max(n, min);
      }
    }

    return out;
  }

  const [hoveredRemoveId, setHoveredRemoveId] = React.useState<string | null>(
    null,
  );
  const [colW, setColW] = React.useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return sanitizeColMap(JSON.parse(raw), COLUMNS);
    } catch {}

    return {};
  });

  const drag = React.useRef<{
    key: ColKey;

    startX: number;

    startW: number;

    min: number;

    neighborKey: ColKey;

    neighborStartW: number;

    neighborMin: number;
  } | null>(null);

  React.useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(colW));
    } catch {}
  }, [colW]);

  // Initialize from measured widths on first mount if not saved

  React.useEffect(() => {
    if (!tableRef.current) return;

    let hasAny = false;
    try {
      hasAny = colW && typeof colW === 'object' && Object.keys(colW).length > 0;
    } catch {
      hasAny = false;
    }

    if (hasAny) return;

    const ths = tableRef.current.querySelectorAll<HTMLTableCellElement>(
      'thead th[data-colkey]',
    );

    const next: Record<string, number> = {};

    ths.forEach((th) => {
      const k = (th.getAttribute('data-colkey') || '') as ColKey;
      if (!k) return;

      const col = COLUMNS.find((c) => c.key === k);

      const min = Math.max(col?.min || 60, 40);

      next[k] = Math.max(th.getBoundingClientRect().width | 0, min);
    });

    if (Object.keys(next).length) setColW(next);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-size Creative column initially to fit the longest name (once), then allow dragging/persistence

  React.useEffect(() => {
    if (!tableRef.current) return;

    if (!results || results.length === 0) return;

    try {
      const ctx = document.createElement('canvas').getContext('2d');

      if (!ctx) return;

      const cs = getComputedStyle(tableRef.current);

      const font =
        cs.font && cs.font.trim()
          ? cs.font
          : `${cs.fontSize || '12px'} ${cs.fontFamily || 'system-ui,sans-serif'}`;

      ctx.font = font;

      let max = 0;

      for (const r of results as any[]) {
        const text = prettyBundleName(r.bundleName);

        const w = ctx.measureText(text).width;

        if (w > max) max = w;
      }

      // Add cell padding and a bit of breathing room

      const desired = Math.ceil(max + 24);

      const min = Math.max(
        COLUMNS.find((c) => c.key === 'creative')?.min || 200,
        200,
      );

      const target = Math.max(desired, min);

      setColW((prev) => {
        const existing =
          typeof prev.creative === 'number' ? prev.creative : undefined;

        if (typeof existing === 'number' && existing >= target) return prev;

        return { ...prev, creative: target };
      });
    } catch {}
  }, [results, tableRef.current]);

  React.useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag.current) return;

      e.preventDefault();

      const dx = e.clientX - drag.current.startX;

      const startW = drag.current.startW;

      const min = drag.current.min;

      const neighborStart = drag.current.neighborStartW;

      const neighborMin = drag.current.neighborMin;

      // Desired sizes with coupled neighbor adjustment to prevent overlap

      let desired = Math.max(startW + dx, min);

      let neighborDesired = neighborStart - dx; // shrink neighbor as we grow current

      if (neighborDesired < neighborMin) {
        const allowedDx = neighborStart - neighborMin; // limit growth so neighbor stays >= min

        desired = Math.max(startW + allowedDx, min);

        neighborDesired = neighborMin;
      }

      setColW((prev) => ({
        ...prev,

        [drag.current!.key]: desired,

        [drag.current!.neighborKey]: neighborDesired,
      }));
    }

    function onUp() {
      drag.current = null;
      document.body.style.cursor = '';
    }

    window.addEventListener('mousemove', onMove);

    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  if (results.length === 0) return null;

  return (
    <div style={{ marginTop: 0, overflowX: 'auto' }}>
      <style>{`
        .table tbody tr td:first-child { position: relative; padding-right: 30px; }
        .table tbody tr .creative-cell { display: inline-flex; align-items: center; gap: 10px; min-height: 26px; position: relative; }
        .table tbody tr .creative-remove {
          opacity: 0;
          transform: scale(0.88);
          width: 26px;
          height: 26px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.45);
          background: rgba(148, 163, 184, 0.18);
          color: #64748b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: opacity .12s ease, transform .12s ease, color .12s ease, border-color .12s ease, background-color .12s ease, box-shadow .12s ease;
          cursor: pointer;
        }
        .table tbody tr .creative-cell:hover .creative-remove,
        .table tbody tr .creative-remove:focus-visible {
          opacity: 1;
          transform: scale(1);
        }
        .table tbody tr .creative-remove:hover {
          background: rgba(248, 250, 252, 0.92);
          color: #1f2937;
          border-color: rgba(148, 163, 184, 0.75);
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
        }
        .table tbody tr.remove-hover td { color: #9ca3af; }
      `}</style>
      <table
        ref={tableRef}
        className="table"
        style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
      >
        <colgroup>
          {COLUMNS.map((c) => (
            <col
              key={c.key}
              style={{ width: colW[c.key] ? `${colW[c.key]}px` : undefined }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                data-colkey={col.key}
                style={{ ...th, position: 'relative' }}
                onMouseMove={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  const rect = el.getBoundingClientRect();
                  const nearEdge = rect.right - e.clientX < 6;
                  if (nearEdge) {
                    el.classList.add('near-edge');
                    el.style.cursor = 'col-resize';
                  } else {
                    el.classList.remove('near-edge');
                    el.style.cursor = '';
                  }
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.classList.remove('near-edge');
                  el.style.cursor = '';
                }}
              >
                {col.label}
                <span
                  role="separator"
                  aria-orientation="vertical"
                  title="Drag to resize"
                  onMouseDown={(e) => {
                    const parent = e.currentTarget.parentElement as HTMLElement | null;
                    const idx = COLUMNS.findIndex((c) => c.key === col.key);
                    const neighborIdx =
                      idx >= 0 && idx < COLUMNS.length - 1
                        ? idx + 1
                        : idx > 0
                          ? idx - 1
                          : -1;
                    if (neighborIdx < 0) return;
                    const neighborKey = COLUMNS[neighborIdx].key;
                    const table = tableRef.current;
                    const startW =
                      (colW && colW[col.key]) ||
                      (parent ? parent.getBoundingClientRect().width : 120) ||
                      120;
                    let neighborStartW = (colW && colW[neighborKey]) || 0;
                    if (!neighborStartW && table) {
                      const th = table.querySelector(
                        `thead th[data-colkey="${neighborKey}"]`,
                      ) as HTMLElement | null;
                      neighborStartW = th ? th.getBoundingClientRect().width || 120 : 120;
                    }
                    const min = Math.max(COLUMNS[idx]?.min || 60, 40);
                    const neighborMin = Math.max(COLUMNS[neighborIdx]?.min || 60, 40);
                    drag.current = {
                      key: col.key as any,
                      startX: e.clientX,
                      startW,
                      min,
                      neighborKey: neighborKey as any,
                      neighborStartW,
                      neighborMin,
                    };
                    document.body.style.cursor = 'col-resize';
                    e.preventDefault();
                  }}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    height: '100%',
                    width: 6,
                    cursor: 'col-resize',
                    userSelect: 'none',
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {results.map((r: any) => {
            const b = bundles.find((bb: any) => bb.id === r.bundleId);

            const selected = selectedBundleId
              ? selectedBundleId === r.bundleId
              : results[0]?.bundleId === r.bundleId;

            // Compute Priority-only issue counts

            let pf = 0,
              pw = 0;

            try {
              for (const f of r.findings || []) {
                if (!PRIORITY_IDS.has(f.id)) continue;

                if (f.severity === 'FAIL') pf++;
                else if (f.severity === 'WARN') pw++;
              }
            } catch {}

            const removeHover = hoveredRemoveId === r.bundleId;
            return (
              <tr
                key={r.bundleId}
                className={
                  [
                    selected ? 'selected' : '',
                    removeHover ? 'remove-hover' : '',
                  ]
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                onClick={() => selectBundle(r.bundleId)}
                onMouseLeave={() =>
                  setHoveredRemoveId((prev) =>
                    prev === r.bundleId ? null : prev,
                  )
                }
                style={{
                  cursor: 'pointer',
                  background: selected ? 'rgba(79,70,229,0.12)' : 'transparent',
                }}
                title="Click to view details"
              >
                <td style={{ ...td, position: 'relative', paddingRight: 30 }}>
                  <div className="creative-cell">
                    <span className="creative-label">
                      {prettyBundleName(r.bundleName)}
                    </span>
                    <button
                      type="button"
                      className="creative-remove"
                      title="Remove creative"
                      aria-label={`Remove ${prettyBundleName(r.bundleName)}`}
                      onMouseEnter={() => setHoveredRemoveId(r.bundleId)}
                      onMouseLeave={() => setHoveredRemoveId(null)}
                      onFocus={() => setHoveredRemoveId(r.bundleId)}
                      onBlur={() =>
                        setHoveredRemoveId((prev) =>
                          prev === r.bundleId ? null : prev,
                        )
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        try {
                          removeBundle(r.bundleId);
                        } catch {}
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M18.3 5.7 12 12l6.3 6.3-1.3 1.3L10.7 13.3 4.4 19.6 3.1 18.3 9.4 12 3.1 5.7 4.4 4.4 10.7 10.7 17 4.4z" />
                      </svg>
                    </button>
                  </div>
                </td>

                <td style={{ ...td }}>{badge(r.summary.status)}</td>

                <td style={td}>
                  {r.adSize ? `${r.adSize.width}x${r.adSize.height}` : '-'}
                </td>

                <td
                  style={td}
                  title={`${pf} FAIL/${pw} WARN`}
                  aria-label={`${pf} FAIL/${pw} WARN`}
                >
                  {`${pf}F / ${pw}W`}
                </td>

                <td style={td}>{fmtKB(r.initialBytes)}</td>

                <td style={td}>{fmtKB(r.totalBytes)}</td>

                <td style={td}>{r.initialRequests || 0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const SplitChecksAndPreview: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const leftContainerRef = useRef<HTMLDivElement | null>(null);

  const rightTitleRef = useRef<HTMLDivElement | null>(null);

  const rightBodyRef = useRef<HTMLDivElement | null>(null);

  const dragging = useRef(false);

  const [filterOpen, setFilterOpen] = useState<boolean>(false);

  const [severityFilter, setSeverityFilter] = useState<
    Set<'PASS' | 'WARN' | 'FAIL'>
  >(() => new Set(['FAIL', 'WARN', 'PASS']));

  const [split, setSplit] = useState<number>(() => {
    try {
      const s = localStorage.getItem('ext_split');
      if (s) {
        const v = parseFloat(s);
        if (!isNaN(v)) return Math.min(0.75, Math.max(0.25, v));
      }
    } catch {}

    return 0.5;
  });

  useEffect(() => {
    try {
      localStorage.setItem('ext_split', String(split));
    } catch {}
  }, [split]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const p = Math.min(0.75, Math.max(0.25, x / Math.max(1, rect.width)));
      setSplit(p);
      e.preventDefault();
    }

    function onUp() {
      dragging.current = false;
      document.body.style.cursor = '';
    }

    window.addEventListener('mousemove', onMove);

    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Compute available body height for the right pane content so Source/JSON can scroll within it

  const [availableRightBodyHeight, setAvailableRightBodyHeight] = useState<
    number | undefined
  >(undefined);

  useEffect(() => {
    function measure() {
      const leftH = leftContainerRef.current?.offsetHeight || 0;

      const rightTitleH = rightTitleRef.current?.offsetHeight || 0;

      let padBlock = 0;

      try {
        if (rightBodyRef.current) {
          const cs = getComputedStyle(rightBodyRef.current);

          const pt = parseFloat(cs.paddingTop || '0');

          const pb = parseFloat(cs.paddingBottom || '0');

          padBlock = (isNaN(pt) ? 0 : pt) + (isNaN(pb) ? 0 : pb);
        }
      } catch {}

      const avail = Math.max(0, leftH - rightTitleH - padBlock);

      setAvailableRightBodyHeight(
        Number.isFinite(avail) && avail > 0 ? avail : undefined,
      );
    }

    measure();

    let ro: ResizeObserver | undefined;

    try {
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(() => measure());

        if (leftContainerRef.current) ro.observe(leftContainerRef.current);
      }
    } catch {}

    window.addEventListener('resize', measure);

    return () => {
      try {
        if (ro && leftContainerRef.current)
          ro.unobserve(leftContainerRef.current);
      } catch {}

      window.removeEventListener('resize', measure);
    };
  }, []);

  // (Reverted) No split height constraint; allow content to drive height

  useEffect(() => {
    if (!filterOpen) return;

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;

      if (!target) return;

      const panel = document.getElementById('priority-filter-panel');

      const btn = document.getElementById('priority-filter-btn');

      if (panel && !panel.contains(target) && btn && !btn.contains(target)) {
        setFilterOpen(false);
      }
    };

    window.addEventListener('click', onDocClick, { capture: true });

    return () =>
      window.removeEventListener('click', onDocClick, { capture: true } as any);
  }, [filterOpen]);

  const leftW = `${Math.round(split * 1000) / 10}%`;

  const rightW = `${Math.round((1 - split) * 1000) / 10}%`;

  return (
    <div>
      {/* Top split area: Priority checks (left) and Preview (right) */}

      <div ref={containerRef} className="split" style={{ minHeight: 360 }}>
        {/* Priority Checks Pane */}

        <div
          ref={leftContainerRef}
          style={{
            width: leftW,
            minWidth: 240,
            overflowX: 'hidden',
            overflowY: 'auto',
          }}
          className="left"
        >
          <div
            className="title"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span>Priority Checks</span>

              <SectionHelp
                explanation="Checks that are necessary for the creative to function and pass common platform policies."
                why={
                  'Fixing failures here helps ensure reliable rendering and acceptance across placements.\n\nNote: WARNs here do not impact overall PASS/FAIL status.'
                }
              />
            </span>

            <span style={{ position: 'relative' }}>
              <button
                id="priority-filter-btn"
                type="button"
                aria-label="Filter priority checks"
                className="btn"
                onClick={() => setFilterOpen((o) => !o)}
                title="Filter by severity"
                style={{
                  width: 24,
                  height: 24,
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* simple funnel icon */}

                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
                </svg>
              </button>

              {filterOpen && (
                <div
                  id="priority-filter-panel"
                  role="dialog"
                  aria-label="Priority filters"
                  className="panel"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 28,
                    zIndex: 20,
                    padding: 8,
                    minWidth: 160,
                  }}
                >
                  <div
                    style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}
                  >
                    Show severities
                  </div>

                  {(
                    ['FAIL', 'WARN', 'PASS'] as Array<'FAIL' | 'WARN' | 'PASS'>
                  ).map((sv) => (
                    <label
                      key={sv}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        padding: '4px 2px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={severityFilter.has(sv)}
                        onChange={(e) => {
                          setSeverityFilter((prev) => {
                            const next = new Set(prev);

                            if (e.target.checked) next.add(sv);
                            else next.delete(sv);

                            return next;
                          });
                        }}
                      />

                      <span>{sv}</span>
                    </label>
                  ))}
                </div>
              )}
            </span>
          </div>

          <div className="body">
            <PriorityList filter={severityFilter} />
          </div>
        </div>

        {/* Divider */}

        <div
          role="separator"
          aria-orientation="vertical"
          title="Drag to resize"
          onMouseDown={(e) => {
            dragging.current = true;
            document.body.style.cursor = 'col-resize';
            e.preventDefault();
          }}
          className="separator"
        >
          <i />
        </div>

        {/* Preview Pane */}

        <div
          style={{ width: rightW, minWidth: 320, overflow: 'visible' }}
          className="right"
        >
          <div ref={rightTitleRef} className="title">
            Preview
          </div>

          <div
            ref={rightBodyRef}
            className="body"
            style={{
              height: availableRightBodyHeight,
              minHeight: availableRightBodyHeight ? undefined : 360,
              overflow: 'hidden',
            }}
          >
            <ExtendedPreview maxBodyHeight={availableRightBodyHeight} />
          </div>
        </div>
      </div>

      {/* Full-width Additional checks below the split */}

      <div style={{ marginTop: 12 }}>
        <OptionalList />
      </div>
    </div>
  );
};

const PriorityList: React.FC<{ filter?: Set<'PASS' | 'WARN' | 'FAIL'> }> = ({
  filter,
}) => {
  const { results, selectedBundleId, bundles } = useExtStore((s: any) => ({
    results: s.results,
    selectedBundleId: s.selectedBundleId,
    bundles: s.bundles,
  }));

  const res =
    results.find((r: any) => r.bundleId === selectedBundleId) || results[0];

  if (!res) return null;

  // Decide which checks are Required vs Optional (Priority set)

  // Display in fixed ad ops relevance order defined in PRIORITY_ORDER
  const priorityOrder = PRIORITY_ORDER;

  let requiredFindings = res.findings
    .filter((f: any) => PRIORITY_IDS.has(f.id))
    .sort((a: any, b: any) => {
      const ai = priorityOrder.indexOf(a.id);
      const bi = priorityOrder.indexOf(b.id);
      const ax = ai < 0 ? Number.MAX_SAFE_INTEGER : ai;
      const bx = bi < 0 ? Number.MAX_SAFE_INTEGER : bi;
      return ax - bx;
    });

  if (filter && filter.size > 0) {
    requiredFindings = requiredFindings.filter((f: any) =>
      filter.has(f.severity),
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gap: 8,
        gridTemplateColumns: '1fr',
        alignItems: 'start',
      }}
    >
      {requiredFindings.map((f: any) => (
        <div key={f.id} className="card">
          <div className="title">
            <div>{badge(f.severity)}</div>

            <div
              className="title-wrap"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <span className="title-text">
                {TITLE_OVERRIDES[f.id] || f.title}
              </span>

              <SpecBadges checkId={f.id} />
            </div>
          </div>

          <ul className="items">
            {(() => {
              const offenders = Array.isArray(f.offenders) ? f.offenders : [];
              const msgsFull = Array.isArray(f.messages)
                ? f.messages
                : f.messages
                  ? [String(f.messages)]
                  : [];
              const isPass = String(f.severity) === 'PASS';
              // For clicktag and border, suppress the offender summary on PASS; show messages only
              if (offenders.length > 0 && !(isPass && (f.id === 'clicktag' || f.id === 'border'))) {
                const summary = `${offenders.length} offender(s) found`;
                return <li>{summary}</li>;
              }
              return msgsFull.map((m: string, i: number) => <li key={i}>{m}</li>);
            })()}
          </ul>

          {(() => {
            const bundle = bundles.find((bb: any) => bb.id === res.bundleId);
            const offenders = Array.isArray(f.offenders) ? f.offenders : [];
            const hasOffenders = offenders.length > 0;
            const isPass = String(f.severity) === 'PASS';
            const title = isPass ? 'Details' : 'Offenders';

            // Special-case: Primary File and Size — when passing, show primary asset name
            if (!hasOffenders && f.id === 'primaryAsset') {
              const primaryPath = (res as any)?.primary?.path || null;
              const base = primaryPath ? (String(primaryPath).split('/').pop() || String(primaryPath)) : null;
              const size = (res as any)?.adSize;
              const sizeSource = (res as any)?.adSizeSource || (res as any)?.primary?.sizeSource;
              const items: Array<{ label: string; value: string }> = [];
              if (base) items.push({ label: 'File name', value: base });
              const sizeDetail = formatSizeDetail(size, sizeSource, primaryPath);
              if (sizeDetail) items.push({ label: 'Size', value: sizeDetail });
              if (items.length > 0) {
                return (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#4b5563' }}>
                      {`Details (${items.length})`}
                    </summary>
                    <ul className="offenders">
                      {items.map((item, idx) => (
                        <li key={idx}>
                          <span style={{ fontWeight: 600 }}>{item.label}:</span> {item.value}
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              }
            }

            // Special-case: list all files for File Count and Upload Size when no offenders
            if (!hasOffenders && f.id === 'file-limits' && bundle && bundle.files) {
              const files = Object.keys(bundle.files || {});
              if (files.length > 0) {
                return (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#4b5563' }}>
                      {`Details (${files.length})`}
                    </summary>
                    <ul className="offenders">
                      {files.map((p: string, i: number) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </details>
                );
              }
            }

            // Special-case: HTTPS Only — when passing, list all external references
            if (!hasOffenders && f.id === 'httpsOnly') {
              const externals = Array.isArray((res as any)?.references)
                ? (res as any).references.filter((r: any) => r && r.external)
                : [];
              if (externals.length > 0) {
                return (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#4b5563' }}>
                        {`Details (${externals.length})`}
                    </summary>
                    <ul className="offenders">
                      {externals.map((r: any, i: number) => (
                        <li key={i}>
                          {r.url}
                          {r.from ? ` — from ${r.from}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              }
            }

            if (f.id === 'bad-filenames') {
              const offendersList = Array.isArray(f.offenders) ? f.offenders : [];
              const messages = Array.isArray(f.messages)
                ? f.messages
                : f.messages
                  ? [String(f.messages)]
                  : [];
              const bundleName = typeof (res as any)?.bundleName === 'string'
                ? String((res as any).bundleName)
                : bundle?.name
                  ? String(bundle.name)
                  : '';

              const escapeHtml = (value: string) => esc(value || '');
              const emphasize = (value: string, { specials }: { specials: boolean }) => {
                let out = escapeHtml(value);
                if (specials) {
                  out = out.replace(/(%|#|\?|;|\\|:|\*|"|\|)/g, '<strong>$1</strong>');
                }
                out = out.replace(/(\d{2,4}\s*[xX]\s*\d{2,4})/g, '<strong>$1</strong>');
                return out;
              };

              const entries: string[] = [];

              for (const msg of messages) {
                if (/^No disallowed characters$/i.test(msg)) continue;
                entries.push(emphasize(msg, { specials: false }));
              }

              if (offendersList.length > 0) {
                for (const off of offendersList) {
                  const pathHtml = emphasize(off?.path || '', { specials: true });
                  const detailRaw = off?.detail ? String(off.detail) : '';
                  const detailHtml = detailRaw ? emphasize(detailRaw, { specials: true }) : '';
                  const combined = detailHtml ? `${pathHtml} — ${detailHtml}` : pathHtml;
                  entries.push(combined);
                }
              } else if (bundleName) {
                entries.push(emphasize(bundleName, { specials: false }));
              }

              if (entries.length > 0) {
                return (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#4b5563' }}>
                      {`Details (${entries.length})`}
                    </summary>
                    <ul className="offenders">
                      {entries.map((html, idx) => (
                        <li key={idx} dangerouslySetInnerHTML={{ __html: html }} />
                      ))}
                    </ul>
                  </details>
                );
              }
            }

            // Special-case: Initial Host Requests — list each initial request (primary + in-zip referenced assets)
            if (!hasOffenders && f.id === 'host-requests-initial' && bundle && bundle.files) {
              const normSet = new Set<string>();
              try {
                for (const r of (res as any).references || []) {
                  if (r && r.inZip && r.normalized) normSet.add(String(r.normalized).toLowerCase());
                }
              } catch {}
              try {
                const p = (res as any)?.primary?.path;
                if (p) normSet.add(String(p).toLowerCase());
              } catch {}
              const list: Array<{ path: string; size: number }> = [];
              const lci = (bundle as any).lowerCaseIndex || {};
              for (const low of Array.from(normSet)) {
                const real = lci[low] || low;
                const bytes = (bundle.files as any)[real]?.byteLength || 0;
                list.push({ path: real, size: bytes });
              }
              list.sort((a, b) => a.path.localeCompare(b.path));
              const fmt = (n: number) => (Math.round((n / 1024) * 10) / 10).toFixed(1) + ' KB';
              if (list.length > 0) {
                return (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#4b5563' }}>
                        {`Details (${list.length})`}
                    </summary>
                    <ul className="offenders">
                      {list.map((it, i) => (
                        <li key={i}>
                          {it.path} — {fmt(it.size)}
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              }
            }

            // PASS-side Details for clicktag and border: show captured lines
            if (!hasOffenders && (f.id === 'clicktag' || f.id === 'border')) {
              const raw = Array.isArray(f.offenders) ? f.offenders : [];
              if (raw.length > 0) {
                const evid = [...raw];
                // For clicktag, push anchor-based evidence to the end
                if (f.id === 'clicktag') {
                  evid.sort((a: any, b: any) => {
                    const rank = (x: any) => {
                      if (!x) return 0;
                      if (x.kind === 'ahref') return 2; // ensure <a href=...> appears last
                      if (x.kind === 'aonclick') return 1; // then anchor onclick
                      return 0; // others first
                    };
                    return rank(a) - rank(b);
                  });
                }
                const hi = (s: string) => {
                  try {
                    const re = /(window\.)?clicktag\d*|clickTag\d*/gi;
                    return s.replace(re, (m) => `<mark class="ct-hi">${m}</mark>`);
                  } catch {
                    return s;
                  }
                };
                return (
                  <details style={{ marginTop: 6 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 12, color: '#4b5563' }}>
                      {`Details (${evid.length})`}
                    </summary>
                    <style>{`.ct-hi{ background: transparent; color: #7c3aed; font-weight: 700; }`}</style>
                    <ul className="offenders">
                      {evid.map((o: any, i: number) => (
                        <li key={i}>
                          {o.path}
                          {o.line ? `:${o.line}` : ''}
                          {o.detail ? (
                            <span dangerouslySetInnerHTML={{ __html: ' — ' + (f.id === 'clicktag' ? hi(String(o.detail)) : String(o.detail)) }} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              }
            }

            if (hasOffenders) {
              return (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: '#4b5563' }}>
                    {`${title} (${offenders.length})`}
                  </summary>
                  <ul className="offenders">
                    {offenders.map((o: any, i: number) => (
                      <li key={i}>
                        {o.path}
                        {o.detail ? ` \u2014 ${o.detail}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              );
            }
            // No offenders and no special list: do not render Details
            return null;
          })()}

          <div className="help">
            <HelpIcon checkId={f.id} group="priority" />
          </div>
        </div>
      ))}
    </div>
  );
};

const OptionalList: React.FC = () => {
  const { results, selectedBundleId, bundles } = useExtStore((s: any) => ({
    results: s.results,
    selectedBundleId: s.selectedBundleId,
    bundles: s.bundles,
  }));

  const [open, setOpen] = React.useState<boolean>(false);

  const res =
    results.find((r: any) => r.bundleId === selectedBundleId) || results[0];

  if (!res) return null;

  const REQUIRED_IDS = PRIORITY_IDS;

  // Present IDs for duplicate suppression logic

  const presentIds = new Set<string>(res.findings.map((f: any) => f.id));

  function shouldHideOptional(id: string, present: Set<string>): boolean {
    switch (id) {
      // Prefer extended CM360 clicktag over legacy clickTags

      case 'clickTags':
        return present.has('clicktag');

      // Prefer IAB host-requests-initial (≤10) over older iabRequests (≤15)

      case 'iabRequests':
        return present.has('host-requests-initial');

      // Prefer CM360 allowed-ext over generic fileTypes

      case 'fileTypes':
        return present.has('allowed-ext');

      // Prefer IAB border over heuristic creativeBorder

      case 'creativeBorder':
        return present.has('border');

      // Prefer extended no-document-write over legacy docWrite

      case 'docWrite':
        return present.has('no-document-write');

      // Prefer extended GWD env check naming over legacy

      case 'gwdEnvironment':
        return present.has('gwd-env-check');

      // Prefer explicit orphaned-assets over legacy orphanAssets

      case 'orphanAssets':
        return present.has('orphaned-assets');

      // Prefer extended CPU/IAB budgets over raw long-tasks heuristic if budget present

      case 'cpuUsage':
        return present.has('cpu-budget');

      // 'indexFile' is logically covered by CM360 'entry-html' check
      case 'indexFile':
        return present.has('entry-html');

      default:
        return false;
    }
  }

  const optionalFindings = res.findings

    .filter((f: any) => !PRIORITY_IDS.has(f.id))

    .filter((f: any) => !shouldHideOptional(f.id, presentIds))

    .sort((a: any, b: any) => {
      const rank = (s: string) => (s === 'FAIL' ? 0 : s === 'WARN' ? 1 : 2);

      const r = rank(a.severity) - rank(b.severity);

      if (r !== 0) return r;

      // Secondary sort by spec source: CM360 first, then H5, then IAB/other
      const specRank = (id: string) => {
        try {
          const srcs = sourcesFor(id);
          if (srcs.includes('CM360')) return 0;
          if (srcs.includes('H5')) return 1;
          if (srcs.includes('IAB')) return 2;
        } catch {}
        return 3;
      };

      const sr = specRank(a.id) - specRank(b.id);
      if (sr !== 0) return sr;

      const at = (TITLE_OVERRIDES as any)?.[a.id] || a.title || '';

      const bt = (TITLE_OVERRIDES as any)?.[b.id] || b.title || '';

      return String(at).localeCompare(String(bt));
    });

  return (
    <div className="panel" style={{ padding: 12 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid var(--border)',

          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>Additional Checks {open ? '\u25be' : '\u25b8'}</span>

          <span style={{ fontWeight: 400, color: '#6b7280' }}>
            ({optionalFindings.length})
          </span>

          <SectionHelp
            stopClickPropagation
            explanation="Checks that are advised for optimal quality, performance, and maintainability."
            why={
              'Addressing these can improve reliability and user experience, though needs vary by placement.\n\nNote: These checks do not impact overall PASS/FAIL status.'
            }
          />
        </span>
      </button>

      {open && (
        <div
          style={{
            display: 'grid',

            gap: 8,

            marginTop: 8,

            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          {optionalFindings.map((f: any) => (
            <div key={f.id} className="card small" style={{ minHeight: 0 }}>
              <div className="title" style={{ gap: 6 }}>
                <div>{badge(f.severity)}</div>

                <div
                  className="title-wrap"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <span className="title-text">
                    {(TITLE_OVERRIDES as any)?.[f.id] || f.title}
                  </span>

                  <SpecBadges checkId={f.id} />
                </div>
              </div>

              <ul className="items" style={{ marginTop: 4, fontSize: 11 }}>
                {(() => {
                  const offenders = Array.isArray(f.offenders) ? f.offenders : [];
                  const msgsFull = Array.isArray(f.messages)
                    ? f.messages
                    : f.messages
                      ? [String(f.messages)]
                      : [];
                  const isPass = String(f.severity) === 'PASS';
                  if (offenders.length > 0 && !(isPass && (f.id === 'clicktag' || f.id === 'border'))) {
                    const summary = `${offenders.length} offender(s) found`;
                    return <li>{summary}</li>;
                  }
                  return msgsFull.map((m: string, i: number) => <li key={i}>{m}</li>);
                })()}
              </ul>

              {(() => {
                const bundle = bundles.find((bb: any) => bb.id === res.bundleId);
                const offenders = Array.isArray(f.offenders) ? f.offenders : [];
                const hasOffenders = offenders.length > 0;
                const isPass = String(f.severity) === 'PASS';
                const title = isPass ? 'Details' : 'Offenders';

                if (!hasOffenders && f.id === 'file-limits' && bundle && bundle.files) {
                  const files = Object.keys(bundle.files || {});
                  if (files.length > 0) {
                    return (
                      <details style={{ marginTop: 4 }}>
                        <summary
                          style={{ cursor: 'pointer', fontSize: 11, color: '#4b5563' }}
                        >
                          {`Details (${files.length})`}
                        </summary>
                        <ul className="offenders" style={{ fontSize: 10, maxHeight: 160 }}>
                          {files.map((p: string, i: number) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </details>
                    );
                  }
                }

                // Special-case: Primary File and Size — when passing, show primary asset name
                if (!hasOffenders && f.id === 'primaryAsset') {
                  const p = (res as any)?.primary?.path;
                  const base = p ? String(p).split('/').pop() || String(p) : null;
                  if (base) {
                    return (
                      <details style={{ marginTop: 4 }}>
                        <summary
                          style={{ cursor: 'pointer', fontSize: 11, color: '#4b5563' }}
                        >
                          {`Details (1)`}
                        </summary>
                        <ul className="offenders" style={{ fontSize: 10, maxHeight: 160 }}>
                          <li>{base}</li>
                        </ul>
                      </details>
                    );
                  }
                }

                // HTTPS Only: list external references when passing
                if (!hasOffenders && f.id === 'httpsOnly') {
                  const externals = Array.isArray((res as any)?.references)
                    ? (res as any).references.filter((r: any) => r && r.external)
                    : [];
                  if (externals.length > 0) {
                    return (
                      <details style={{ marginTop: 4 }}>
                        <summary
                          style={{ cursor: 'pointer', fontSize: 11, color: '#4b5563' }}
                        >
                          {`Details (${externals.length})`}
                        </summary>
                        <ul className="offenders" style={{ fontSize: 10, maxHeight: 160 }}>
                          {externals.map((r: any, i: number) => (
                            <li key={i}>
                              {r.url}
                              {r.from ? ` — from ${r.from}` : ''}
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  }
                }

                // Initial Host Requests: list each initial request path and size
                if (!hasOffenders && f.id === 'host-requests-initial' && bundle && bundle.files) {
                  const normSet = new Set<string>();
                  try {
                    for (const r of (res as any).references || []) {
                      if (r && r.inZip && r.normalized) normSet.add(String(r.normalized).toLowerCase());
                    }
                  } catch {}
                  try {
                    const p = (res as any)?.primary?.path;
                    if (p) normSet.add(String(p).toLowerCase());
                  } catch {}
                  const list: Array<{ path: string; size: number }> = [];
                  const lci = (bundle as any).lowerCaseIndex || {};
                  for (const low of Array.from(normSet)) {
                    const real = lci[low] || low;
                    const bytes = (bundle.files as any)[real]?.byteLength || 0;
                    list.push({ path: real, size: bytes });
                  }
                  list.sort((a, b) => a.path.localeCompare(b.path));
                  const fmt = (n: number) => (Math.round((n / 1024) * 10) / 10).toFixed(1) + ' KB';
                  if (list.length > 0) {
                    return (
                      <details style={{ marginTop: 4 }}>
                        <summary
                          style={{ cursor: 'pointer', fontSize: 11, color: '#4b5563' }}
                        >
                          {`Details (${list.length})`}
                        </summary>
                        <ul className="offenders" style={{ fontSize: 10, maxHeight: 160 }}>
                          {list.map((it, i) => (
                            <li key={i}>
                              {it.path} — {fmt(it.size)}
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  }
                }

                // PASS-side Details for clicktag and border: show evidence lines
                if (!hasOffenders && (f.id === 'clicktag' || f.id === 'border')) {
                  const raw = Array.isArray(f.offenders) ? f.offenders : [];
                  if (raw.length > 0) {
                    const evid = [...raw];
                    if (f.id === 'clicktag') {
                      evid.sort((a: any, b: any) => {
                        const rank = (x: any) => {
                          if (!x || !x.kind) return 0;
                          if (x.kind === 'aonclick') return 1; // anchor onclick near end
                          if (x.kind === 'ahref') return 2; // ensure <a href=...> appears last
                          return 0; // other evidence first
                        };
                        return rank(a) - rank(b);
                      });
                    }
                    const hi = (s: string) => {
                      try {
                        const re = /(window\.)?clicktag\d*|clickTag\d*/gi;
                        return s.replace(re, (m) => `<mark class="ct-hi">${m}</mark>`);
                      } catch {
                        return s;
                      }
                    };
                    return (
                      <details style={{ marginTop: 4 }}>
                        <summary
                          style={{ cursor: 'pointer', fontSize: 11, color: '#4b5563' }}
                        >
                          {`Details (${evid.length})`}
                        </summary>
                        <style>{`.ct-hi{ background: transparent; color: #7c3aed; font-weight: 700; }`}</style>
                        <ul className="offenders" style={{ fontSize: 10, maxHeight: 160 }}>
                          {evid.map((o: any, i: number) => (
                            <li key={i}>
                              {o.path}
                              {o.line ? `:${o.line}` : ''}
                              {o.detail ? (
                                <span dangerouslySetInnerHTML={{ __html: ' — ' + (f.id === 'clicktag' ? hi(String(o.detail)) : String(o.detail)) }} />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    );
                  }
                }

                if (hasOffenders) {
                  return (
                    <details style={{ marginTop: 4 }}>
                      <summary
                        style={{ cursor: 'pointer', fontSize: 11, color: '#4b5563' }}
                      >
                        {`${title} (${offenders.length})`}
                      </summary>
                      <ul className="offenders" style={{ fontSize: 10, maxHeight: 160 }}>
                        {offenders.map((o: any, i: number) => (
                          <li key={i}>
                            {o.path}
                            {o.detail ? ` \u2014 ${o.detail}` : ''}
                          </li>
                        ))}
                      </ul>
                    </details>
                  );
                }
                // No offenders and no special list: do not render Details
                return null;
              })()}

              <div className="help" style={{ right: 6, top: 6 }}>
                <HelpIcon checkId={f.id} group="optional" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 8,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const td: React.CSSProperties = {
  padding: 8,
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function badge(s: 'PASS' | 'WARN' | 'FAIL' | string) {
  const cls =
    s === 'FAIL' ? 'badge fail' : s === 'WARN' ? 'badge warn' : 'badge pass';

  return <span className={cls}>{s}</span>;
}

function fmtKB(n: number) {
  return (Math.round((n / 1024) * 10) / 10).toFixed(1) + ' KB';
}

// Display helper: remove trailing .zip for cleaner creative names
function prettyBundleName(name?: string | null): string {
  const s = String(name || '');
  return s.replace(/\.zip$/i, '');
}

const ReportActions: React.FC = () => {
  const { results } = useExtStore((s: any) => ({ results: s.results }));
  if (results.length === 0) return null;

  function buildWorkbook(scope: 'all' | 'failwarn', xlsx: XLSXModule): any {
    const wb = xlsx.utils.book_new();

    // Table tab: include ONLY Priority checks for all bundles in scope
    const rows: any[] = [];
    for (const r of results as any[]) {
      // determine if bundle is included based on scope (fail/warn within Priority only)
      const priority = (r.findings || []).filter((f: any) =>
        PRIORITY_IDS.has(f.id),
      );
      const hasFw = priority.some(
        (f: any) => f.severity === 'FAIL' || f.severity === 'WARN',
      );
      if (scope === 'failwarn' && !hasFw) continue;
      for (const f of priority) {
        const base = {
          Bundle: prettyBundleName(r.bundleName),
          Status: r.summary?.status || '',
          CheckID: f.id,
          Check: f.title,
          Severity: f.severity,
          Messages: (f.messages || []).join(' | '),
        };
        if (!f.offenders || f.offenders.length === 0) {
          rows.push({ ...base, OffenderPath: '', Detail: '' });
        } else {
          for (const o of f.offenders) {
            rows.push({
              ...base,
              OffenderPath: o.path || '',
              Detail: o.detail || '',
            });
          }
        }
      }
    }

    if (rows.length === 0)
      rows.push({
        Bundle: '—',
        Status: 'PASS',
        CheckID: '—',
        Check: 'No Priority Issues',
        Severity: 'PASS',
        Messages: 'No issues in scope',
        OffenderPath: '',
        Detail: '',
      });

    const tableSheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(wb, tableSheet, 'Table');

    // Guidelines tab: exact CM360 + IAB guidelines (pull from SPEC_TEXT)
    const guideRows: any[] = [];
    const uniq = new Set<string>();
    for (const id of Array.from(PRIORITY_IDS)) {
      const text = (SPEC_TEXT as any)[id] || '';
      const srcs = sourcesFor(id);
      // Only include items that are CM360 or IAB per request
      if (!srcs.includes('CM360') && !srcs.includes('IAB')) continue;
      if (uniq.has(id)) continue;
      uniq.add(id);
      guideRows.push({
        ID: id,
        Check: (TITLE_OVERRIDES as any)?.[id] || id,
        Source: srcs.join(', '),
        Guideline: text,
      });
    }
    const guideSheet = xlsx.utils.json_to_sheet(guideRows);
    xlsx.utils.book_append_sheet(wb, guideSheet, 'Guidelines');

    return wb;
  }

  async function download(scope: 'all' | 'failwarn') {
    const xlsx = await loadXLSX();
    const wb = buildWorkbook(scope, xlsx);
    const name = scope === 'all' ? 'audits_all.xlsx' : 'audits_fail_warn.xlsx';
    xlsx.writeFile(wb, name);
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => void download('all')} className="btn">
        Download All Audits
      </button>
      <button onClick={() => void download('failwarn')} className="btn primary">
        Download FAIL/WARN Audits
      </button>
    </div>
  );
};

function buildPrintableHTML(res: any): string {
  const rows = res.findings
    .map((f: any) => {
      const msgs = Array.isArray(f.messages)
        ? f.messages
        : f.messages
          ? [String(f.messages)]
          : [];
      return `<tr><td>${esc(f.title)}</td><td>${esc(f.severity)}</td><td>${esc(msgs.join(' | '))}</td></tr>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset='utf-8'><title>Audit Report</title>

	<style> body{font-family:system-ui,sans-serif; padding:16px;} h1{font-size:18px} table{width:100%;border-collapse:collapse;font-size:12px} th,td{padding:6px;border-top:1px solid #e5e7eb;text-align:left} th{background:#f3f4f6}</style>

	</head><body>

	<h1>Audit Report</h1>

  <div style='margin-bottom:8px; font-size:12px'>Bundle: ${esc(prettyBundleName(res.bundleName))} \u2022 Status: ${esc(res.summary.status)}</div>

	<table><thead><tr><th>Check</th><th>Severity</th><th>Messages</th></tr></thead><tbody>${rows}</tbody></table>

	<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>

	</body></html>`;
}

function esc(s: string) {
  return String(s || '').replace(/[&<>]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;',
  );
}

function chooseFallbackHTML(paths: string[]): string {
  // Prefer index.html/htm at shallowest depth, else fewest path segments, else shortest length

  const byDepth = (p: string) => p.split('/').length;

  const isIndex = (p: string) => /\/(index\.html?)$/i.test('/' + p);

  const indexCands = paths.filter(isIndex);

  if (indexCands.length) {
    indexCands.sort((a, b) => byDepth(a) - byDepth(b) || a.length - b.length);

    return indexCands[0];
  }

  const sorted = [...paths].sort(
    (a, b) => byDepth(a) - byDepth(b) || a.length - b.length,
  );

  return sorted[0];
}

const DESCRIPTIONS: Record<string, string> = {
  // Core checks (from main app)

  packaging:
    'Validates ZIP packaging: no nested archives or disallowed file types.\n\nWhy it matters: mispackaged zips are rejected by ad servers and creatives never leave trafficking.',

  primaryAsset:
    'Detects main HTML file & required ad.size meta width/height.\n\nWhy it matters: without a primary file and declared size, ad servers cannot determine slot fit and will reject the creative.',

  assetReferences:
    'Ensures all HTML/CSS referenced assets exist in the bundle.\n\nWhy it matters: missing assets render blanks that fail QA and waste impressions.',

  orphanAssets:
    'Lists files not referenced by primary asset dependency graph.\n\nWhy it matters: unused assets inflate weight and can breach contractual caps.',

  externalResources:
    'Flags external network references outside allowlist.\n\nWhy it matters: off-domain calls violate publisher policies and get placements denied.',

  httpsOnly:
    'Requires all external references to use HTTPS.\n\nWhy it matters: insecure HTTP requests are blocked in secure frames, leaving the ad non-functional.',

  // Priority: CM360 packaging/ingestion specifics

  'pkg-format':
    'ZIP packaging format: upload is a .zip/.adz with a normal folder structure and no nested archives.\n\nWhy it matters: nested zips and wrapper folders are rejected by CM360 and most exchanges, blocking ingestion.',

  'entry-html':
    'Entry HTML: exactly one top-level HTML file acts as the creative’s start file; all other files are referenced from it.\n\nWhy it matters: multiple or missing entry files confuse ad servers and can cause blank or rejected uploads.',

  'allowed-ext':
    'Allowed file types: only typical creative extensions (html, htm, js, css, json, images, fonts, svg) are included.\n\nWhy it matters: unusual or executable types trip security scanners and get uploads quarantined or denied.',

  'file-limits':
    'File count and ZIP size: keep total files ≤ 100 and compressed ZIP ≤ 10 MB (CM360 defaults).\n\nWhy it matters: exceeding intake caps slows QA and often blocks upload or serving.',

  clickTags:
    'Detects clickTag variables / exit APIs and hard-coded navigations.\n\nWhy it matters: broken exit plumbing stops click tracking and campaign billing.',

  // Priority: explicit CM360 click plumbing id
  clicktag:
    'Clickthrough plumbing: a global clickTag is defined and used for navigation (e.g., window.open(clickTag)).\n\nWhy it matters: without clickTag, exits can’t be tracked or trafficked correctly and creatives are rejected.',

  gwdEnvironment:
    'Identifies Google Web Designer runtime artifacts.\n\nWhy it matters: leftover runtime can conflict with host pages and bloat load times.',

  iabWeight:
    'Compares initial/polite & compressed weights to the standard IAB display budgets.\n\nWhy it matters: overweight assets violate buyer contracts and get paused by ad servers.',

  iabRequests:
    'Counts initial load asset requests vs the configured cap.\n\nWhy it matters: excessive requests drag render performance and fail certification.',

  systemArtifacts:
    'OS metadata (Thumbs.db, .DS_Store) / __MACOSX entries.\n\nWhy it matters: scanning tools flag these as contamination and block uploads.',

  hardcodedClickUrl:
    'Hard-coded absolute clickthrough URL(s) in code/markup.\n\nWhy it matters: bypassing macros removes tracking and causes trafficking rejections.',

  // Extended checks (parity)

  animDuration:
    'Heuristic scan of CSS animation/transition durations.\n\nWhy it matters: overly long motion breaks brand rules and triggers QA escalations.',

  cssEmbedded:
    'Inline CSS usage (style tags/attributes).\n\nWhy it matters: heavy inline styling inflates HTML size and complicates dynamic QA edits.',

  minified:
    'Heuristic detection of minified JS/CSS files.\n\nWhy it matters: unminified code increases payload and can push creatives over weight limits.',

  dialogs:
    'alert/confirm/prompt usage inside creative.\n\nWhy it matters: disruptive dialogs violate platform policies and will be blocked.',

  cookies:
    'document.cookie writes detected in runtime.\n\nWhy it matters: unmanaged cookies can violate privacy policies and trigger compliance holds.',

  localStorage:
    'localStorage writes detected in runtime.\n\nWhy it matters: storage usage may be disallowed by partners and requires disclosure.',

  // Priority: Web Storage prohibition (explicit CM360 id)
  'no-webstorage':
    'No Web Storage/DB APIs: avoid localStorage, sessionStorage, IndexedDB, or WebSQL (openDatabase).\n\nWhy it matters: storage access is commonly disallowed and can trigger policy violations or rejections.',

  timing:
    'DOMContentLoaded, time to render, frames observed.\n\nWhy it matters: slow render metrics predict viewability issues and heavy-ad interventions.',

  timeToRender:
    'Time to first visible render of the ad; < 500 ms is recommended.\n\nWhy it matters: delayed first paint hurts viewability guarantees.',

  measurement:
    'Known analytics/measurement host references.\n\nWhy it matters: stacking trackers raises privacy concerns and can be blocked by supply partners.',

  domContentLoaded:
    'DOMContentLoaded budget.\n\nWhy it matters: exceeding ~1s signals heavy creatives that partners can reject.',

  html5lib:
    'Common creative libraries detected (CreateJS, GSAP, Pixi, jQuery).\n\nWhy it matters: knowing libraries helps validate licensing and optimization plans.',

  video:
    'Video asset(s) in bundle.\n\nWhy it matters: video placements enforce extra specs, so trafficking must attach the correct serving settings.',

  iframes:
    'Iframe tags in markup.\n\nWhy it matters: creatives are served inside secure iframes/SafeFrame; nested frames are often disallowed and can break integrations.',

  // Priority: CM360 security/sandboxing specifics
  'iframe-safe':
    'Iframe-safe behavior: no attempts to access parent/top windows or document.domain at runtime.\n\nWhy it matters: cross-frame access is blocked in secure placements and will break or be flagged by CM360.',

  imagesOptimized:
    'Potentially large images to optimize (heuristic).\n\nWhy it matters: oversized imagery drives weight over limits and slows load times.',

  indexFile:
    'index.html presence at root.\n\nWhy it matters: This is the de facto standard entry point for HTML5 creatives. CM360 typically expects index.html for ZIP ingestion. The Trade Desk lets you choose a primary file, but index.html is recommended for automation. IAB specs do not strictly mandate index.html, but most ad servers and workflows assume it.',

  // nameDimensions merged into bad-filenames

  hostedSize:
    'Total uncompressed size of files.\n\nWhy it matters: large payloads exceed ad server caps and may be auto-throttled.',

  cpuUsage:
    'Long tasks total (first 3s) budget.\n\nWhy it matters: high CPU usage triggers heavy-ad rules and throttles delivery.',

  memoryUsage:
    'Peak JS heap usage budget.\n\nWhy it matters: memory spikes crash host pages and get creatives blacklisted.',

  perfHeuristics:
    'Advisory signal from preview-only measurements (CPU jitter, JS heap).\n\nWhy it matters: sustained main\u2011thread blocking or memory spikes can trigger heavy\u2011ad throttling and hurt viewability. Treat as a hint; confirm on standardized hardware if gating.',

  syntaxErrors:
    'Uncaught runtime errors during preview.\n\nWhy it matters: crashing scripts show blanks and result in automatic takedowns.',

  docWrite:
    'document.write calls used.\n\nWhy it matters: document.write is blocked in most modern ad slots, preventing any render.',

  jquery:
    'jQuery presence detected.\n\nWhy it matters: heavy frameworks inflate payloads and are banned in many lightweight placements.',

  backup:
    'Backup image presence (heuristic).\n\nWhy it matters: without a backup image, fallback delivery fails and impressions are lost.',

  hostedCount:
    'Count of files in bundle.\n\nWhy it matters: excessive files complicate QA and can push weight budgets over limits.',

  fileTypes:
    'File types outside a conservative allowlist.\n\nWhy it matters: unusual file types trip security scans and block approvals.',

  creativeBorder:
    'Presence of border styles (heuristic).\n\nWhy it matters: missing borders violate spec requirements for publisher separation.',

  creativeRendered:
    'Render activity observed during preview.\n\nWhy it matters: confirming render ensures the creative will not serve blank in production.',

  networkDynamic:
    'Runtime fetch/XHR requests detected.\n\nWhy it matters: unexpected calls breach data policies and raise monitoring alerts.',

  heavyAdRisk:
    'Risk indicator from initial size/CPU jitter.\n\nWhy it matters: creatives flagged heavy are throttled or unloaded by Chrome and major DSPs.',

  imageMeta:
    'Image metadata (dimensions/size).\n\nWhy it matters: quick audit confirms assets meet spec prior to trafficking.',

  videoMeta:
    'Video metadata (dimensions/duration/size).\n\nWhy it matters: ensures motion assets align with placement length and resolution requirements.',

  audioMeta:
    'Audio metadata (duration/size).\n\nWhy it matters: audio assets must meet rich-media specs to avoid rejection.',

  // IAB Global

  'host-requests-initial':
    'Initial Host Requests is the number of files the ad loads immediately from the entry HTML (HTML, CSS, JS, images, fonts, etc.). The IAB guideline is to keep this count at 10 or fewer.\n\nWhy it matters: While an ad with more than 10 calls can still run, many exchanges and publishers enforce this guideline through QA tools and policies. Exceeding it often leads to slower initial load and a higher risk of warnings or rejection.',

  'cpu-budget':
    'Keep main-thread busy time ≤ 30% in the first 3s (via Long Tasks) per IAB guidance.\n\nWhy it matters: excessive main-thread blocking triggers heavy-ad throttling.',

  'animation-cap':
    'Animation must be ≤ 15s total or ≤ 3 loops under the IAB display standard.\n\nWhy it matters: long/looping motion violates common IAB/publisher specs.',

  border:
    'A visible 1px border/keyline must be present per IAB display guidance.\n\nWhy it matters: borders visually separate ads from page content per spec.',

  // Legacy H5 validator–style checks

  'invalid-url-ref':
    'Broken or invalid URL references (including absolute non-packaged paths).\n\nWhy it matters: missing or malformed URLs break loads and cause blanks.',

  'orphaned-assets':
    'Files in the ZIP that are not referenced by the entry HTML.\n\nWhy it matters: unused files inflate weight and complicate QA.',

  'bad-filenames':
    'Filenames and naming: avoid disallowed characters and ensure the ZIP file name includes the creative dimensions (e.g., 300x250).\n\nWhy it matters: problematic names break ad servers and missing size tokens in the ZIP make trafficking harder.',

  'invalid-markup':
    'Heuristic HTML/CSS/SVG syntax validation.\n\nWhy it matters: invalid markup can render inconsistently or be blocked by sanitizers.',

  'gwd-env-check':
    'Detects Google Web Designer environment artifacts.\n\nWhy it matters: leftover environment code can conflict with host pages.',

  'hardcoded-click':
    'Hard-coded clickthrough detected (bypasses clickTag).\n\nWhy it matters: breaks exit tracking and trafficking rules.',
};

const HelpIcon: React.FC<{
  checkId: string;
  group?: 'priority' | 'optional';
}> = ({ checkId, group = 'optional' }) => {
  const [open, setOpen] = React.useState(false);

  const base = DESCRIPTIONS[checkId] || '';

  function soften(text: string): string {
    // Light-touch language softening for optional advisories

    return text

      .replace(/\bmust\b/gi, 'should')

      .replace(/\bis required\b/gi, 'is typically expected')

      .replace(/\brequires\b/gi, 'typically requires')

      .replace(/\bwill be\b/gi, 'can be')

      .replace(/\bwill\b/gi, 'can')

      .replace(/\bare rejected\b/gi, 'may be rejected')

      .replace(/\bare blocked\b/gi, 'may be blocked')

      .replace(/\bare disallowed\b/gi, 'may not be allowed')

      .replace(/\bviolates\b/gi, 'may violate')

      .replace(/\bresults in\b/gi, 'can result in');
  }

  // Extract two parts from DESCRIPTIONS: explanation and why it matters

  const marker = 'why it matters:';

  let explanation = base;

  let why = '';

  if (base) {
    const loc = base.toLowerCase().indexOf(marker);

    if (loc >= 0) {
      explanation = base.slice(0, loc).trim();

      why = base.slice(loc + marker.length).trim();
    }
  }

  if (!explanation) {
    // Fallback to SPEC text (sans prefix) or the id

    const spec = SPEC_TEXT[checkId];

    explanation = spec
      ? spec.replace(/^.*?:\s*/, '')
      : (TITLE_OVERRIDES as any)?.[checkId] || checkId;
  }

  // Ensure we always have a Why paragraph

  if (!why) {
    why =
      group === 'optional'
        ? 'Improving this can enhance reliability or performance and reduce the chance of policy friction.'
        : 'Issues here can cause delivery problems or lead to platform rejections.';
  }

  if (group === 'optional' && why) {
    why = soften(why);
  }

  const desc = [explanation, `Why it matters: ${why}`]
    .filter(Boolean)
    .join('\n\n');

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Help for ${checkId}`}
        onClick={() => setOpen((o) => !o)}
        className="btn"
        style={{ width: 20, height: 20, borderRadius: 999, padding: 0 }}
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          className="tip"
          style={{
            position: 'absolute',
            top: '50%',
            right: '110%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            pointerEvents: 'auto',
            whiteSpace: 'pre-wrap',
            maxWidth: 420,
          }}
        >
          {desc}
        </div>
      )}
    </span>
  );
};

// Source badges and exact spec text per check

type SourceKind = 'IAB' | 'CM360' | 'H5';

// UI classification sets (copied from exporter and extended)

const CM360_IDS_UI = new Set<string>([
  'bad-filenames',
  'clicktag',
  'entry-html',
  'file-limits',
  'host-requests-initial',
  'no-backup-in-zip',
  'relative-refs',
  'pkg-format',
  'animation-cap',
  'cpu-budget',
  'border',
  'gwd-env-check',
  'invalid-url-ref',
  'orphaned-assets',
  'invalid-markup',
  'hardcoded-click',
  'minified',
  'packaging',
  'primaryAsset',
  'assetReferences',
  'externalResources',
  'httpsOnly',
  'iabWeight',
  'iabRequests',
  'systemArtifacts',
  'syntaxErrors',
  'creativeRendered',
  'no-document-write',
  'indexFile',
  'dialogs',
  'domContentLoaded',
  'timeToRender',
  'measurement',
  'html5lib',
  'imagesOptimized',
  'hostedSize',
  'jquery',
  'backup',
  'iframes',
  'networkDynamic',
  'heavyAdRisk',
  'memoryUsage',
  'hostedCount',
  'packaging',
  'primaryAsset',
  'assetReferences',
  'externalResources',
  'httpsOnly',
  'clickTags',
  'systemArtifacts',
  'indexFile',
  'creativeRendered',
  'docWrite',
  'syntaxErrors',

  'pkg-format',
  'entry-html',
  'file-limits',
  'allowed-ext',
  'iframe-safe',
  'clicktag',
  'no-webstorage',

  // 'meta-ad-size' removed
  'no-backup-in-zip',
  'relative-refs',
  'no-document-write',
  // CM360 filename restriction: no percent sign in names
  'bad-filenames',
]);

const IAB_IDS_UI = new Set<string>([
  'iabWeight',
  'iabRequests',

  'host-requests-initial',
  'cpu-budget',
  'animation-cap',
  'border',
]);

function sourcesFor(id: string): SourceKind[] {
  const isIab = IAB_IDS_UI.has(id);
  const isCm = CM360_IDS_UI.has(id);
  if (isIab && isCm) return ['IAB', 'CM360']; // order: IAB first, CM360 second
  if (isIab) return ['IAB'];
  if (isCm) return ['CM360'];
  return ['H5'];
}

// Exact spec text per check id

const SPEC_TEXT: Record<string, string> = {
  // IAB

  iabWeight:
    'IAB: Ad weight budgets (initial/polite/zip) per configured settings. Exceeding caps fails.',

  // iabRequests legacy text removed (superseded by host-requests-initial)

  'host-requests-initial': 'IAB: Initial host requests ≤ 10.',

  'cpu-budget':
    'IAB: Main-thread busy ≤ 30% in first 3 seconds (Long Tasks ≤ 900ms).',

  'animation-cap':
    'IAB: Animation length ≤ 15s or ≤ 3 loops (infinite loops not allowed).',

  border: 'IAB: A visible 1px border or keyline is required.',

  // CM360 (hard + recommended)

  packaging: 'CM360: ZIP packaging, no nested archives or OS artifacts.',

  primaryAsset: 'CM360: One primary HTML with declared size (ad.size meta).',

  assetReferences: 'CM360: All referenced files must exist in the ZIP.',

  externalResources: 'CM360: No disallowed off-domain references.',

  httpsOnly: 'CM360: All external requests must use HTTPS.',

  clickTags:
    'CM360: Click-through configured via clickTag/exit API; no hard-coded destinations.',

  systemArtifacts: 'CM360: No OS/system artifacts in ZIP.',

  indexFile:
    'CM360: Root entry HTML present (name is flexible; one entry required).',

  // nameDimensions merged into bad-filenames

  creativeRendered: 'CM360: Creative must render successfully.',

  docWrite: 'CM360: Do not use document.write in runtime.',

  syntaxErrors: 'CM360: No uncaught runtime errors during load.',

  'pkg-format': 'CM360: Upload is ZIP/ADZ; no nested .zip/.adz.',

  'entry-html':
    'CM360: Exactly one root entry HTML; all other files referenced by it.',

  'file-limits': 'CM360: ≤ 100 files and ≤ 10 MB upload (compressed).',

  'allowed-ext':
    'CM360: Only typical creative extensions allowed (html, js, css, images, fonts, etc.).',

  'iframe-safe':
    'CM360: No cross-frame DOM access (parent/top/document.domain).',

  clicktag:
    'CM360: Global clickTag present and used via window.open(clickTag).',

  'no-webstorage':
    'CM360: Do not reference Web Storage APIs (localStorage/sessionStorage), IndexedDB, or WebSQL (openDatabase).',

  // meta-ad-size advisory removed (primaryAsset enforces presence)

  'no-backup-in-zip':
    'CM360 (recommended): Do not include backup image in the ZIP.',

  'relative-refs':
    'CM360 (recommended): Use relative paths for packaged assets.',

  'no-document-write': 'CM360 (recommended): Avoid document.write usage.',

  // Legacy H5 validator parity

  'invalid-url-ref':
    'H5: Broken/invalid references and absolute non-packaged paths are disallowed.',

  'orphaned-assets':
    'H5: Files not referenced by the entry file should be removed.',

  'bad-filenames':
    'CM360: Filenames should avoid disallowed characters, and the ZIP filename must include the creative dimensions (e.g., 300x250).',

  'invalid-markup':
    'H5: HTML/SVG must parse without errors; CSS braces should be balanced.',

  'gwd-env-check':
    'H5: Google Web Designer environment artifacts may cause conflicts.',

  'hardcoded-click':
    'H5: Hard-coded clickthroughs bypass tracking; use clickTag.',

  // Heuristic/diagnostic H5 checks

  minified: 'H5: JS/CSS should be minified in production.',

  cssEmbedded:
    'H5: Inline CSS is allowed but keep minimal; prefer external CSS.',

  // animDuration removed

  dialogs: 'H5: Avoid alert/confirm/prompt in creatives.',

  domContentLoaded: 'H5: DOMContentLoaded target < 1000ms.',

  timeToRender: 'H5: Time to first render < 500ms is recommended.',

  measurement: 'H5: Minimize tracker/measurement hosts.',

  html5lib:
    'H5: Library use (CreateJS/GSAP/jQuery/etc.) flagged for awareness.',

  imagesOptimized:
    'H5: Optimize large images (PNG → JPEG/WebP where reasonable).',

  hostedSize: 'H5: Total uncompressed size should meet partner limits.',

  jquery: 'H5: Consider avoiding jQuery in lightweight placements.',

  iframes: 'H5: Avoid nested iframes in creatives.',

  networkDynamic: 'H5: Avoid unexpected runtime network calls.',

  heavyAdRisk:
    'H5: Large initial size or CPU jitter may trigger heavy-ad intervention.',

  // cpuUsage removed

  memoryUsage: 'H5: Peak JS heap < 10 MB on test hardware.',

  // perfHeuristics removed

  hostedCount: 'H5: Keep file count practical for QA and packaging.',

  video: 'H5: Video assets require appropriate spec handling.',

  timing: 'H5: Reported timing metrics from preview.',

  imageMeta: 'H5: Image metadata diagnostics (dimensions/size).',

  videoMeta: 'H5: Video metadata diagnostics.',

  audioMeta: 'H5: Audio metadata diagnostics.',

  // creativeBorder removed
};

const SpecBadges: React.FC<{ checkId: string }> = ({ checkId }) => {
  const sources = sourcesFor(checkId);
  const baseText = SPEC_TEXT[checkId] || 'No spec text available.';
  const isIab = IAB_IDS_UI.has(checkId);
  const isCm = CM360_IDS_UI.has(checkId);

  const stripIabPrefix = (text: string): string =>
    text.replace(/^IAB(?:\s*\([^)]*\))?:\s*/i, '');

  function tooltipFor(source: SourceKind): string {
    if (source === 'CM360') {
      if (isIab) {
        // CM360 badge should not include the literal 'IAB:' prefix; show alignment and the IAB text without the prefix
        const iabText = stripIabPrefix(baseText);
        return `CM360: Aligns with IAB for this check.\n\n${iabText}`;
      }
      // CM360-only: prefer CM360 text; if base is prefixed with IAB, strip it
      const clean = stripIabPrefix(baseText);
      return clean.startsWith('CM360:') ? clean : `CM360: ${clean}`;
    }
    if (source === 'IAB') {
      // For IAB badge, keep IAB text if present; else prefix as IAB
      return /^IAB(?:\s*\([^)]*\))?:\s*/i.test(baseText) ? baseText : `IAB: ${baseText}`;
    }
    // H5 badge
    return baseText;
  }

  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    border: '1px solid var(--border)',
    color: '#6b7280',
    background: 'rgba(255,255,255,0.02)',
  };

  const gap: React.CSSProperties = {
    display: 'inline-flex',
    gap: 6,
    alignItems: 'center',
  };

  const colorFor = (s: SourceKind) =>
    s === 'IAB' ? '#0ea5e9' : s === 'CM360' ? '#22c55e' : '#a855f7';

  return (
    <span style={gap}>
      {sources.map((s, i) => (
        <span
          key={i}
          className="spec-badge"
          title={tooltipFor(s)}
          style={{ ...base, borderColor: colorFor(s), color: colorFor(s) }}
        >
          {s}
        </span>
      ))}
    </span>
  );
};

// Legacy H5 validator–style checks

// (Removed stray entries; content merged into DESCRIPTIONS)

// Small info tooltip for section headers (two paragraphs)

const SectionHelp: React.FC<{
  explanation: string;
  why: string;
  stopClickPropagation?: boolean;
}> = ({ explanation, why, stopClickPropagation }) => {
  const [open, setOpen] = React.useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="Section info"
        className="btn"
        onClick={(e) => {
          if (stopClickPropagation) {
            e.stopPropagation();
          }
          setOpen((o) => !o);
        }}
        style={{ width: 20, height: 20, borderRadius: 999, padding: 0 }}
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          className="tip"
          style={{
            position: 'absolute',

            top: 'calc(100% + 8px)',

            left: '110%',

            transform: 'none',

            zIndex: 100,

            pointerEvents: 'auto',

            width: 260,

            background: 'var(--panel-2)',

            color: 'var(--text)',

            padding: 10,

            borderRadius: 10,

            fontSize: 11,

            boxShadow: 'var(--shadow)',

            whiteSpace: 'pre-line',

            border: '1px solid var(--border)',
          }}
        >
          {explanation}

          {'\n\n'}

          {`Why it matters: ${why}`}
        </div>
      )}
    </span>
  );
};

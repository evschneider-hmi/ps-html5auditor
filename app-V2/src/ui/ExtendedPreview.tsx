import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mergePriorityFindings } from '../logic/priority';
import { useExtStore } from '../state/useStoreExt';
import {
  buildInstrumentedPreview,
  type ProbeEvent,
  type ProbeSummary,
} from '../logic/runtimeProbe';
import {
  ENVIRONMENT_OPTIONS,
  type AdTagEnvironment,
  type EnvironmentOption,
} from '../logic/environment';

type TabKey = 'preview' | 'source' | 'assets' | 'json';

export interface ExtendedPreviewProps {
  maxBodyHeight?: number;
}

export const ExtendedPreview: React.FC<ExtendedPreviewProps> = ({
  maxBodyHeight,
}) => {
  const { results, selectedBundleId } = useExtStore((s: any) => ({
    results: s.results,
    selectedBundleId: s.selectedBundleId,
  }));
  const bundleRes: any =
    results.find((r: any) => r.bundleId === selectedBundleId) || results[0];
  const bundle = useExtStore((s: any) =>
    s.bundles.find((b: any) => b.id === bundleRes?.bundleId),
  );
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [tab, setTab] = useState<TabKey>('preview');
  const [html, setHtml] = useState('');
  const [original, setOriginal] = useState('');
  const [blobMap, setBlobMap] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<ProbeSummary | null>(null);
  const [events, setEvents] = useState<ProbeEvent[]>([]);
  const [height, setHeight] = useState(800);
  const [showModal, setShowModal] = useState(false);
  const [clickUrl, setClickUrl] = useState<string>('');
  const [clickPresent, setClickPresent] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [environment, setEnvironment] = useState<AdTagEnvironment>('web');
  // Bump to force iframe re-mount on reload
  const [reloadTick, setReloadTick] = useState(0);
  const lastSizeRef = useRef<string>('');
  // Search queries + navigation state for Source and JSON tabs
  const [sourceQuery, setSourceQuery] = useState('');
  const [jsonQuery, setJsonQuery] = useState('');
  const [sourceIndex, setSourceIndex] = useState(0);
  const [jsonIndex, setJsonIndex] = useState(0);
  const sourceContainerRef = useRef<HTMLDivElement | null>(null);
  const jsonContainerRef = useRef<HTMLDivElement | null>(null);
  const debugFindings = bundleRes?.debugFindings ?? [];
  const hasDebugInsights = debugFindings.length > 0;

  useEffect(() => {
    if (!bundleRes || !bundleRes.primary || !bundle) return;
    let cancelled = false;
    (async () => {
      const built = await buildInstrumentedPreview(
        bundle as any,
        (bundleRes as any).primary.path,
        { environment },
      );
      if (cancelled) return;
      setHtml(built.html);
      setOriginal(built.originalHtml);
      setBlobMap(built.blobMap);
    })();
    return () => {
      cancelled = true;
    };
  }, [bundleRes?.bundleId, bundleRes?.primary?.path, bundle, reloadTick, environment]);

  useEffect(() => {
    function handler(ev: MessageEvent) {
      const d = ev?.data as any;
      if (!d) return;
      if (d.__audit_event) {
        const pe = d as ProbeEvent;
        setEvents((prev) => [pe, ...prev].slice(0, 200));
        if (pe.type === 'summary') {
          setSummary(pe.summary);
          try {
            // Persist latest summary for extended checks to read if needed
            (window as any).__audit_last_summary = pe.summary;
            // Update the corresponding finding in results so Time to Render reflects runtime data
            const ttr = pe.summary?.visualStart;
            if (typeof ttr === 'number' && isFinite(ttr)) {
              const st = (useExtStore as any).getState?.();
              if (st && st.results && Array.isArray(st.results)) {
                const bundleId = bundleRes?.bundleId;
                const idx = st.results.findIndex(
                  (r: any) => r.bundleId === bundleId,
                );
                if (idx >= 0) {
                  const updated = st.results.map((r: any, i: number) => {
                    if (i !== idx) return r;
                    const findings = Array.isArray(r.findings)
                      ? [...r.findings]
                      : [];
                    const fi = findings.findIndex(
                      (f: any) => f.id === 'timeToRender',
                    );
                    const sev = ttr > 500 ? 'WARN' : 'PASS';
                    const msg = `Render start ~${Math.round(ttr)} ms`;
                    if (fi >= 0) {
                      findings[fi] = {
                        ...findings[fi],
                        severity: sev,
                        messages: [msg, 'Target: < 500 ms'],
                      };
                    } else {
                      findings.push({
                        id: 'timeToRender',
                        title: 'Time to Render',
                        severity: sev,
                        messages: [msg, 'Target: < 500 ms'],
                        offenders: [],
                      });
                    }
                    // recompute summary counts (counts include all findings) and Status (required only)
                    let fails = 0,
                      warns = 0,
                      pass = 0;
                    for (const f of findings) {
                      if (f.severity === 'FAIL') fails++;
                      else if (f.severity === 'WARN') warns++;
                      else pass++;
                    }
                    // Gate overall status strictly by Priority (required) set: FAIL only if any Priority check FAILs
                    const requiredOnly = mergePriorityFindings(findings || []);
                    const status: 'PASS' | 'WARN' | 'FAIL' = requiredOnly.some(
                      (f: any) => f.severity === 'FAIL',
                    )
                      ? 'FAIL'
                      : 'PASS';
                    const summary = {
                      ...r.summary,
                      totalFindings: findings.length,
                      fails,
                      warns,
                      pass,
                      status,
                    };
                    return { ...r, findings, summary };
                  });
                  st.setResults(updated);
                }
              }
            }
          } catch {}
        }
      } else if (d.type === 'creative-click') {
        const url = typeof d.url === 'string' ? d.url : '';
        const present = !!(d.meta && (d.meta.present || d.meta.source));
        setClickPresent((prev) => prev || present || !!url);
        setSummary((prev) => ({ ...(prev || {}), clickUrl: url }) as any);
        setClickUrl(url);
        // If runtime already opened a window (Enabler hook), we still show the modal
        setShowModal(true);
      }
    }
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    setShowInsights(false);
  }, [bundleRes?.bundleId]);
  useEffect(() => {
    if (tab !== 'preview') setShowInsights(false);
  }, [tab]);
  useEffect(() => {
    if (!hasDebugInsights) setShowInsights(false);
  }, [hasDebugInsights]);

  const handleEnvironmentChange = (mode: AdTagEnvironment) => {
    if (mode === environment) return;
    setEnvironment(mode);
    setReloadTick((t) => t + 1);
    setSummary(null);
    setEvents([]);
    setClickUrl('');
    setClickPresent(false);
    setShowModal(false);
    setHeight(800);
  };

  // Compute primary path and entry base early so downstream hooks can safely run every render
  const primaryPath: string = bundleRes?.primary?.path || '';
  const entryBase: string = primaryPath
    ? primaryPath.split('/')?.pop() || primaryPath
    : '';

  // Infer fixed viewport size to satisfy strict @media(width/height) creatives
  const inferredSize = useMemo(() => {
    // 1) Prefer parsed adSize from discovery/parse
    const fromAdSize = (() => {
      try {
        const as: any = (bundleRes as any)?.adSize;
        const w = Number(as?.width);
        const h = Number(as?.height);
        if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
      } catch {}
      return null as { width: number; height: number } | null;
    })();
    if (fromAdSize) return fromAdSize;

    const src = String(original || '');

    // 2) <meta name="ad.size" content="width=160,height=600">
    try {
      const m = src.match(/<meta[^>]+name=["']ad\.size["'][^>]+content=["'][^"']*width\s*=\s*(\d+)\s*,\s*height\s*=\s*(\d+)[^"']*["'][^>]*>/i);
      if (m) {
        const w = Number(m[1]);
        const h = Number(m[2]);
        if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
      }
    } catch {}

    // 3) Strict CSS media query: @media (height: 600px) and (width: 160px) or reversed
    try {
      const mq1 = src.match(/@media[^\{]*\(\s*height\s*:\s*(\d+)px\s*\)[^\{]*\(\s*width\s*:\s*(\d+)px\s*\)/i);
      if (mq1) {
        const h = Number(mq1[1]);
        const w = Number(mq1[2]);
        if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
      }
      const mq2 = src.match(/@media[^\{]*\(\s*width\s*:\s*(\d+)px\s*\)[^\{]*\(\s*height\s*:\s*(\d+)px\s*\)/i);
      if (mq2) {
        const w = Number(mq2[1]);
        const h = Number(mq2[2]);
        if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
      }
    } catch {}

    // 4) Token in filename like 160x600
    try {
      const t = (entryBase || (bundleRes as any)?.bundleName || '').match(/(\d{2,4})\s*[xX]\s*(\d{2,4})/);
      if (t) {
        const w = Number(t[1]);
        const h = Number(t[2]);
        if (isFinite(w) && isFinite(h) && w > 0 && h > 0 && w <= 4000 && h <= 4000)
          return { width: w, height: h };
      }
    } catch {}

    // 5) First <img> width/height as last resort (often matches ad size in simple creatives)
    try {
      const im = src.match(/<img[^>]*width=["']?(\d{2,4})["']?[^>]*height=["']?(\d{2,4})["']?[^>]*>/i);
      if (im) {
        const w = Number(im[1]);
        const h = Number(im[2]);
        if (isFinite(w) && isFinite(h) && w > 0 && h > 0) return { width: w, height: h };
      }
    } catch {}

    return null;
  }, [bundleRes?.adSize, original, entryBase]);

  // If we discover a fixed size after initial load, force a remount so @media queries re-evaluate on exact viewport
  useEffect(() => {
    const key = inferredSize ? `${inferredSize.width}x${inferredSize.height}` : '';
    if (key && key !== lastSizeRef.current) {
      lastSizeRef.current = key;
      setReloadTick((t) => t + 1);
    }
  }, [inferredSize?.width, inferredSize?.height]);

  const assetEntries = useMemo(
    () =>
      Object.entries(blobMap).sort(
        ([a]: [string, string], [b]: [string, string]) => a.localeCompare(b),
      ),
    [blobMap],
  );

  const selectedEnvironment = useMemo<EnvironmentOption>(() => {
    const found = ENVIRONMENT_OPTIONS.find((opt) => opt.value === environment);
    return found || ENVIRONMENT_OPTIONS[0];
  }, [environment]);

  // Auto-scroll active match into view near top (Source)
  useEffect(() => {
    if (tab !== 'source') return;
    const root = sourceContainerRef.current;
    if (!root) return;
    const el = root.querySelector(
      `mark[data-match-index="${sourceIndex}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    try {
      // Compute element position relative to the scroll container
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta = elRect.top - rootRect.top; // element's top within the visible area
      const margin = Math.max(60, Math.round(root.clientHeight * 0.25));
      const desiredTop = Math.max(root.scrollTop + delta - margin, 0);
      root.scrollTo({ top: desiredTop, behavior: 'smooth' });
    } catch {}
  }, [tab, sourceIndex, sourceQuery]);

  // Auto-scroll active match into view near top (JSON)
  useEffect(() => {
    if (tab !== 'json') return;
    const root = jsonContainerRef.current;
    if (!root) return;
    const el = root.querySelector(
      `mark[data-match-index="${jsonIndex}"]`,
    ) as HTMLElement | null;
    if (!el) return;
    try {
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta = elRect.top - rootRect.top;
      const margin = Math.max(60, Math.round(root.clientHeight * 0.25));
      const desiredTop = Math.max(root.scrollTop + delta - margin, 0);
      root.scrollTo({ top: desiredTop, behavior: 'smooth' });
    } catch {}
  }, [tab, jsonIndex, jsonQuery]);
  if (!bundleRes)
    return (
      <div style={{ fontSize: 12, color: '#555' }}>No bundle selected.</div>
    );
  if (!bundleRes.primary)
    return (
      <div style={{ fontSize: 12, color: '#555' }}>
        No primary HTML detected.
      </div>
    );
  

  return (
    <div
      className="ext-preview"
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* local styles for active match highlight */}
      <style>{`
        mark.active-match { background: #fde68a; outline: 1px solid #f59e0b; }
      `}</style>
      <nav
        className="tabs"
        style={{
          borderBottom: '1px solid var(--border)',
          paddingBottom: 6,
          marginBottom: 6,
        }}
      >
        {(['preview', 'source', 'assets', 'json'] as TabKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`tab ${tab === k ? 'active' : ''}`}
          >
            {label(k)}
          </button>
        ))}
      </nav>
      <div style={{ padding: 8, fontSize: 12 }}>
        {tab === 'preview' && (
          <div
            style={{
              minHeight: maxBodyHeight ? maxBodyHeight : undefined,
              maxHeight: maxBodyHeight ? maxBodyHeight : undefined,
              // Ensure the asset exists freely without scrollbars at this wrapper level
              overflow: 'visible',
            }}
          >
            <div style={{ position: 'relative' }}>
              {/* Header controls above the preview */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Left-aligned reload button */}
                  <button
                    type="button"
                    aria-label="Reload preview"
                    title="Reload preview"
                    onClick={() => {
                      setReloadTick((t) => t + 1);
                      setHeight(800);
                      setEvents([]);
                      setSummary(null as any);
                      setClickUrl('');
                      setClickPresent(false);
                      setShowModal(false);
                    }}
                    className="btn"
                    style={{
                      fontSize: 11,
                      padding: '4px 6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      color: '#6b7280',
                    }}
                  >
                    {/* circular arrow icon */}
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
                      <path d="M21 2v6h-6" />
                      <path d="M21 13a9 9 0 1 1-3-7l3 3" />
                    </svg>
                    <span style={{ fontWeight: 600, color: '#6b7280' }}>
                      Reload
                    </span>
                  </button>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        letterSpacing: 0.6,
                        textTransform: 'uppercase',
                        color: '#6b7280',
                        fontWeight: 600,
                      }}
                    >
                      Environment
                    </span>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      {ENVIRONMENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`btn ${environment === opt.value ? 'primary' : ''}`}
                          onClick={() => handleEnvironmentChange(opt.value)}
                          title={opt.hint}
                          style={{ fontSize: 10, padding: '3px 8px' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {hasDebugInsights && (
                    <button
                      type="button"
                      onClick={() => setShowInsights((v) => !v)}
                      className={`btn ${showInsights ? 'primary' : ''}`}
                      style={{ fontSize: 11, padding: '4px 8px' }}
                    >
                      {showInsights ? 'Hide Metadata' : 'Metadata'}
                    </button>
                  )}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  marginBottom: 6,
                }}
              >
                {selectedEnvironment.hint}
              </div>

              <iframe
                ref={iframeRef}
                title="Creative Preview"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals"
                srcDoc={html}
                key={`${reloadTick}-${environment}-${inferredSize ? `${inferredSize.width}x${inferredSize.height}` : 'auto'}`}
                style={{
                  width: inferredSize ? `${inferredSize.width}px` : '100%',
                  height: inferredSize ? inferredSize.height : height,
                  border: 'none',
                }}
                onLoad={() => {
                  try {
                    const doc = iframeRef.current?.contentDocument;
                    if (!doc) return;
                    if (inferredSize) {
                      // Fixed viewport: don't auto-resize, but ensure our state reflects the fixed height
                      setHeight(inferredSize.height);
                      return;
                    }
                    const body = doc.body;
                    const resize = () => {
                      const h = Math.min(
                        Math.max(body.scrollHeight, 600),
                        1400,
                      );
                      setHeight(h);
                    };
                    resize();
                    new MutationObserver(() => resize()).observe(
                      doc.documentElement,
                      {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        characterData: true,
                      },
                    );
                  } catch {}
                }}
              />
              {/* Removed overlay guide to eliminate any visible bounding box */}
              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="btn primary"
                style={{
                  position: 'absolute',
                  right: 8,
                  bottom: 8,
                  fontSize: 11,
                  padding: '2px 6px',
                }}
              >
                CTURL Status
              </button>
              {showInsights && hasDebugInsights && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: 16,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'flex-start',
                    pointerEvents: 'none',
                  }}
                >
                  <div
                    style={{
                      marginTop: 40,
                      width: 'min(420px, 100%)',
                      maxHeight: 'calc(100% - 40px)',
                      background: 'var(--panel-2)',
                      color: 'var(--text)',
                      borderRadius: 12,
                      padding: 16,
                      overflowY: 'auto',
                      pointerEvents: 'auto',
                      boxShadow: 'var(--shadow)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 0.3,
                        }}
                      >
                        Preview Metadata
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 12 }}>
                      {debugFindings.map((f: any) => (
                        <div
                          key={f.id}
                          style={{
                            background: 'rgba(148,163,184,0.12)',
                            borderRadius: 10,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              marginBottom: 6,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {f.title}
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingLeft: 18,
                              fontSize: 11,
                              lineHeight: 1.5,
                              listStyle: 'disc',
                            }}
                          >
                            {(Array.isArray(f.messages)
                              ? f.messages
                              : f.messages
                                ? [String(f.messages)]
                                : [])
                              .map((m: any, i: number) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                          {Array.isArray(f.offenders) && f.offenders.length ? (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 10,
                                fontFamily: 'monospace',
                                opacity: 0.85,
                              }}
                            >
                              {f.offenders
                                .slice(0, 5)
                                .map((o: any, i: number) => (
                                  <div key={i} style={{ marginBottom: 2 }}>
                                    <span>{o.path}</span>
                                    {primaryPath && (
                                      <span style={{ opacity: 0.9 }}>
                                        {' '}
                                        - {o.detail}
                                      </span>
                                    )}
                                    {typeof o.line === 'number' && (
                                      <span style={{ marginLeft: 4 }}>
                                        #L{o.line}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              {f.offenders.length > 5 && (
                                <div>
                                  +{f.offenders.length - 5} more...
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === 'source' && (
          <div
            ref={sourceContainerRef}
            style={{
              position: 'relative',
              minHeight: maxBodyHeight ? maxBodyHeight : undefined,
              maxHeight: maxBodyHeight ? maxBodyHeight : undefined,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'var(--surface)',
                padding: '6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid var(--border)'
              }}
            >
              <input
                value={sourceQuery}
                onChange={(e) => {
                  setSourceQuery(e.target.value);
                  setSourceIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const n = countMatches(original, sourceQuery);
                    if (n > 0) {
                      if (e.shiftKey) {
                        setSourceIndex((i) => (i - 1 + n) % n);
                      } else {
                        setSourceIndex((i) => (i + 1) % n);
                      }
                    }
                  }
                }}
                placeholder="Search source..."
                style={{
                  flex: '0 0 240px',
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
              <SearchNav
                total={countMatches(original, sourceQuery)}
                index={sourceIndex}
                onPrev={() => {
                  const n = countMatches(original, sourceQuery);
                  if (n <= 0) return;
                  setSourceIndex((i) => (i - 1 + n) % n);
                }}
                onNext={() => {
                  const n = countMatches(original, sourceQuery);
                  if (n <= 0) return;
                  setSourceIndex((i) => (i + 1) % n);
                }}
              />
              <div style={{ marginLeft: 'auto' }}>
                <CopyButton
                  inline
                  onCopy={async () => {
                    try {
                      await navigator.clipboard.writeText(original);
                    } catch {}
                  }}
                />
              </div>
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.3,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 8,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {renderHighlightedWithActive(
                original,
                sourceQuery,
                sourceIndex,
              )}
            </pre>
          </div>
        )}
        {tab === 'assets' && (
          <div
            style={{
              position: 'relative',
              paddingTop: 36,
              minHeight: maxBodyHeight ? maxBodyHeight : undefined,
              maxHeight: maxBodyHeight ? maxBodyHeight : undefined,
              overflow: 'auto',
            }}
          >
            <CopyButton
              onCopy={async () => {
                const text = assetEntries
                  .map(([p, u]) => `${p}\t${u}`)
                  .join('\n');
                try {
                  await navigator.clipboard.writeText(text);
                } catch {}
              }}
            />
            {primaryPath && (
              <div
                style={{
                  position: 'absolute',
                  left: 6,
                  top: 6,
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
                title={
                  'The entry file is the single HTML file your ad loads first (its starting point). All other files should be referenced from this file.'
                }
              >
                Entry file identified as: {primaryPath}
              </div>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {assetEntries.map(([path, url]) => {
                const isEntry =
                  path === primaryPath || path.split('/').pop() === entryBase;
                const title = isEntry
                  ? 'The entry file is the single HTML file your ad loads first (its starting point). All other files should be referenced from this file.'
                  : 'Open asset in a new tab';
                return (
                  <div
                    key={path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title={title}
                      style={{
                        fontFamily: 'monospace',
                        color: isEntry ? 'var(--accent)' : 'var(--text)',
                        fontWeight: isEntry ? 700 : undefined,
                        textDecoration: 'underline',
                      }}
                    >
                      {path}
                    </a>
                  </div>
                );
              })}
              {assetEntries.length === 0 && (
                <div style={{ color: '#666' }}>No assets</div>
              )}
            </div>
          </div>
        )}
        {tab === 'json' && (
          <div
            ref={jsonContainerRef}
            style={{
              position: 'relative',
              minHeight: maxBodyHeight ? maxBodyHeight : undefined,
              maxHeight: maxBodyHeight ? maxBodyHeight : undefined,
              overflow: 'auto',
            }}
          >
            <div
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'var(--surface)',
                padding: '6px 0',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid var(--border)'
              }}
            >
              <input
                value={jsonQuery}
                onChange={(e) => {
                  setJsonQuery(e.target.value);
                  setJsonIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const text = JSON.stringify(bundleRes, null, 2);
                    const n = countMatches(text, jsonQuery);
                    if (n > 0) {
                      if (e.shiftKey) {
                        setJsonIndex((i) => (i - 1 + n) % n);
                      } else {
                        setJsonIndex((i) => (i + 1) % n);
                      }
                    }
                  }
                }}
                placeholder="Search JSON..."
                style={{
                  flex: '0 0 240px',
                  padding: '4px 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  fontSize: 12,
                  background: 'var(--surface)',
                  color: 'var(--text)',
                }}
              />
              <SearchNav
                total={countMatches(
                  JSON.stringify(bundleRes, null, 2),
                  jsonQuery,
                )}
                index={jsonIndex}
                onPrev={() => {
                  const n = countMatches(
                    JSON.stringify(bundleRes, null, 2),
                    jsonQuery,
                  );
                  if (n <= 0) return;
                  setJsonIndex((i) => (i - 1 + n) % n);
                }}
                onNext={() => {
                  const n = countMatches(
                    JSON.stringify(bundleRes, null, 2),
                    jsonQuery,
                  );
                  if (n <= 0) return;
                  setJsonIndex((i) => (i + 1) % n);
                }}
              />
              <div style={{ marginLeft: 'auto' }}>
                <CopyButton
                  inline
                  onCopy={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        JSON.stringify(bundleRes, null, 2),
                      );
                    } catch {}
                  }}
                />
              </div>
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontFamily: 'monospace',
                fontSize: 11,
                lineHeight: 1.3,
                background: 'var(--surface-2)',
                color: 'var(--text)',
                padding: 8,
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              {renderHighlightedWithActive(
                JSON.stringify(bundleRes, null, 2),
                jsonQuery,
                jsonIndex,
              )}
            </pre>
          </div>
        )}
      </div>
      {/* Legacy probe log removed to reduce noise; insights overlay summarizes key signals. */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div
            className="panel"
            style={{ padding: 12, width: 'min(520px, 92vw)' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                Clickthrough Status
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="btn"
                style={{ fontSize: 12, padding: '2px 6px' }}
              >
                Close
              </button>
            </div>
            {(summary?.clickUrl || clickUrl) && (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  padding: 8,
                  borderRadius: 6,
                  wordBreak: 'break-all',
                  border: '1px solid var(--border)',
                }}
              >
                {summary?.clickUrl || clickUrl}
              </div>
            )}
            {!summary?.clickUrl && !clickUrl && (
              <div
                style={{
                  fontSize: 12,
                  background: 'rgba(245,158,11,0.12)',
                  color: 'var(--text)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  padding: 8,
                  borderRadius: 6,
                }}
              >
                {clickPresent
                  ? 'Clickthrough present but not set (blank opened).'
                  : "No clickthrough URL captured. Creative may rely on ad-server macros or hasn't set clickTag."}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                marginTop: 10,
              }}
            >
              {clickPresent && (
                <>
                  <a
                    href={summary?.clickUrl || clickUrl || 'about:blank'}
                    target="_blank"
                    rel="noreferrer"
                    className="btn primary"
                    style={{
                      fontSize: 12,
                      padding: '6px 10px',
                      textDecoration: 'none',
                    }}
                  >
                    Open{!summary?.clickUrl && !clickUrl ? ' Blank' : ''}
                  </a>
                  {(summary?.clickUrl || clickUrl) && (
                    <button
                      onClick={() => {
                        const v = summary?.clickUrl || clickUrl || '';
                        if (v) navigator.clipboard.writeText(v).catch(() => {});
                      }}
                      className="btn"
                      style={{ fontSize: 12, padding: '6px 10px' }}
                    >
                      Copy
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function label(k: TabKey) {
  return k === 'preview'
    ? 'Preview'
    : k === 'source'
      ? 'Source'
      : k === 'assets'
        ? 'Assets'
        : 'JSON';
}
function ms(n?: number) {
  return typeof n === 'number' && isFinite(n) ? `${Math.round(n)} ms` : 'n/a';
}
// fmt removed with legacy probe log

function countMatches(text: string, q: string): number {
  try {
    const s = String(q || '').trim();
    if (!s) return 0;
    const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return (String(text || '').match(re) || []).length;
  } catch {
    return 0;
  }
}

function renderHighlighted(text: string, q: string): React.ReactNode {
  try {
    const src = String(text || '');
    const s = String(q || '').trim();
    if (!s) return src;
    const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const i = m.index;
      if (i > lastIndex) parts.push(src.slice(lastIndex, i));
      parts.push(<mark key={i}>{m[0]}</mark>);
      lastIndex = i + m[0].length;
    }
    if (lastIndex < src.length) parts.push(src.slice(lastIndex));
    return parts;
  } catch {
    return text;
  }
}

// Enhanced highlighter that marks the active match with a special class
function renderHighlightedWithActive(
  text: string,
  q: string,
  activeIndex: number,
): React.ReactNode {
  try {
    const src = String(text || '');
    const s = String(q || '').trim();
    if (!s) return src;
    const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let idx = 0;
    while ((m = re.exec(src)) !== null) {
      const i = m.index;
      if (i > lastIndex) parts.push(src.slice(lastIndex, i));
      const isActive = idx === activeIndex;
      parts.push(
        <mark
          key={i}
          className={isActive ? 'active-match' : undefined}
          data-match-index={idx}
        >
          {m[0]}
        </mark>,
      );
      lastIndex = i + m[0].length;
      idx++;
    }
    if (lastIndex < src.length) parts.push(src.slice(lastIndex));
    return parts;
  } catch {
    return text;
  }
}

const SearchNav: React.FC<{
  total: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
}> = ({ total, index, onPrev, onNext }) => {
  const disabled = total <= 1;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        className="btn"
        title="Previous match"
        aria-label="Previous match"
          disabled={disabled}
        onClick={onPrev}
        style={{ fontSize: 11, padding: '2px 6px' }}
      >
        ←
      </button>
      <span style={{ fontSize: 11, opacity: 0.8 }}>
        {total ? `${index + 1} of ${total}` : '0 matches'}
      </span>
      <button
        className="btn"
        title="Next match"
        aria-label="Next match"
          disabled={disabled}
        onClick={onNext}
        style={{ fontSize: 11, padding: '2px 6px' }}
      >
        →
      </button>
    </div>
  );
};


const CopyButton: React.FC<{
  onCopy: () => void | Promise<void>;
  inline?: boolean;
}> = ({ onCopy, inline }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label="Copy"
      title={copied ? 'Copied!' : 'Copy'}
      onClick={async () => {
        try {
          await onCopy();
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }}
      className="btn"
      style={{
        position: inline ? 'static' : 'absolute',
        right: inline ? undefined : 6,
        top: inline ? undefined : 6,
        borderRadius: 6,
        fontSize: 11,
        padding: '4px 8px',
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

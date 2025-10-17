import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useExtStore,
  type PreviewDiagnostics,
  type PreviewInfo,
} from '../state/useStoreExt';
import { buildPreviewHtml } from '../preview/buildIframeHtml';
import { inferMimeType } from '../utils/mime';

const buildErrorDoc = (message: string): string => `<!doctype html>
<html><head><meta charset="utf-8" />
<style>body{margin:0;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;}div{padding:28px;border-radius:16px;background:rgba(15,23,42,0.85);max-width:520px;box-shadow:0 24px 48px rgba(2,6,23,0.45);}h1{margin:0 0 12px;font-size:18px;}p{margin:0;font-size:14px;line-height:1.5;white-space:pre-wrap;}</style>
</head><body><div><h1>Preview unavailable</h1><p>${message
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')}</p></div></body></html>`;

const decodeHtml = (bytes?: Uint8Array): string => {
  if (!bytes) return '';
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return '';
  }
};

const cleanupObjectUrls = (map: Record<string, string>): void => {
  for (const value of Object.values(map)) {
    try {
      URL.revokeObjectURL(value);
    } catch {}
  }
};

const derivePreviewInfo = (candidate?: string): PreviewInfo | undefined => {
  if (!candidate) return undefined;
  const normalized = candidate.replace(/^\/+/, '');
  const parts = normalized.split('/');
  if (parts.length <= 1) return { baseDir: '', indexPath: normalized };
  parts.pop();
  return { baseDir: `${parts.join('/')}/`, indexPath: normalized };
};

const formatBaseDir = (info?: PreviewInfo): string => {
  if (!info) return '—';
  const raw = `/${info.baseDir || ''}`;
  return raw.replace(/\\/g, '/').replace(/\/+/g, '/');
};

type TabKey = 'preview' | 'source' | 'assets' | 'json';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'preview', label: 'Preview' },
  { key: 'source', label: 'Source' },
  { key: 'assets', label: 'Assets' },
  { key: 'json', label: 'JSON' },
];

export const ExtendedPreview: React.FC<{ maxBodyHeight?: number }> = ({
  maxBodyHeight,
}) => {
  const {
    results,
    bundles,
    selectedBundleId,
    previewDiagnostics,
    setPreviewDiagnostics,
  } = useExtStore((state) => ({
    results: state.results,
    bundles: state.bundles,
    selectedBundleId: state.selectedBundleId,
    previewDiagnostics: state.previewDiagnostics,
    setPreviewDiagnostics: state.setPreviewDiagnostics,
  }));

  const bundleRes = useMemo(() => {
    if (!results?.length) return undefined;
    return (
      results.find((entry: any) => entry.bundleId === selectedBundleId) ||
      results[0]
    );
  }, [results, selectedBundleId]);

  const bundle = useMemo(() => {
    if (!bundleRes) return undefined;
    return bundles.find((item: any) => item.id === bundleRes.bundleId);
  }, [bundleRes, bundles]);

  const previewInfo = useMemo<PreviewInfo | undefined>(() => {
    if (!bundle) return undefined;
    if (bundle.preview) return bundle.preview;
    return derivePreviewInfo((bundleRes as any)?.primary?.path);
  }, [bundle, bundleRes]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const assetsRef = useRef<Record<string, string>>({});

  const baselineHeight = useMemo(
    () => Math.min(Math.max(maxBodyHeight ?? 720, 360), 960),
    [maxBodyHeight],
  );

  const [tab, setTab] = useState<TabKey>('preview');
  const [html, setHtml] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [original, setOriginal] = useState('');
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [height, setHeight] = useState(baselineHeight);
  const [clickUrl, setClickUrl] = useState('');
  const [clickPresent, setClickPresent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [localDiag, setLocalDiag] = useState<PreviewDiagnostics | undefined>();
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const debugFindings = (bundleRes as any)?.debugFindings ?? [];
  const hasDebugInsights = debugFindings.length > 0;

  useEffect(() => () => cleanupObjectUrls(assetsRef.current), []);

  useEffect(() => {
    setHeight(baselineHeight);
    setShowInsights(false);
    setClickUrl('');
    setClickPresent(false);
    setShowModal(false);
    setLocalDiag(undefined);
    setDebugLog([]);
  }, [bundle?.id, baselineHeight]);

  useEffect(() => {
    setHeight(baselineHeight);
  }, [baselineHeight]);

  useEffect(() => {
    if (!bundle?.id) {
      setLocalDiag(undefined);
      return;
    }
    const existing = previewDiagnostics[bundle.id];
    setLocalDiag(existing);
  }, [bundle?.id, previewDiagnostics]);

  useEffect(() => {
    cleanupObjectUrls(assetsRef.current);
    assetsRef.current = {};
    setAssetUrls({});

    if (!bundle || !previewInfo) {
      setHtml(
        buildErrorDoc(
          'Upload a creative bundle with an index.html to render the CM360 preview.',
        ),
      );
      setOriginal('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setHtml(
      buildPreviewHtml({
        bundleId: bundle.id,
        baseDir: previewInfo.baseDir,
        indexPath: previewInfo.indexPath,
      }),
    );
    setIframeKey((prev) => prev + 1);

    const lowerPath = previewInfo.indexPath.toLowerCase();
    const canonicalIndex =
      bundle.lowerCaseIndex?.[lowerPath] ?? previewInfo.indexPath;
    setOriginal(decodeHtml(bundle.files?.[canonicalIndex]));

    const next: Record<string, string> = {};
    for (const [path, bytes] of Object.entries(bundle.files ?? {})) {
      try {
        const view =
          bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBufferLike);
        const copy = new Uint8Array(view.byteLength);
        copy.set(view);
        const blob = new Blob([copy.buffer], { type: inferMimeType(path) });
        next[path] = URL.createObjectURL(blob);
      } catch {}
    }
    assetsRef.current = next;
    setAssetUrls(next);
  }, [bundle, previewInfo]);

  const sendEntries = useCallback(() => {
    if (!bundle || !previewInfo) return;
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    const entries = Object.entries(bundle.files || {}).map(([path, bytes]) => {
      const arr =
        bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as any);
      const buffer = arr.buffer.slice(
        arr.byteOffset,
        arr.byteOffset + arr.byteLength,
      );
      return {
        path,
        buffer,
        contentType: inferMimeType(path),
      };
    });
    target.postMessage(
      {
        type: 'CM360_BUNDLE_ENTRIES',
        bundleId: bundle.id,
        baseDir: previewInfo.baseDir,
        indexPath: previewInfo.indexPath,
        entries,
      },
      '*',
      entries.map((entry) => entry.buffer),
    );
  }, [bundle, previewInfo]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as any;
      if (!data || typeof data !== 'object') return;
      if (bundle && data.bundleId && data.bundleId !== bundle.id) return;

      if (data.type === 'CM360_DEBUG') {
        const message = data.stage
          ? `${new Date().toISOString()} — ${data.stage} ${data.payload ? JSON.stringify(data.payload) : ''}`
          : `${new Date().toISOString()} — ${JSON.stringify(data)}`;
        setDebugLog((prev) => [...prev.slice(-50), message]);
        return;
      }

      if (data.type === 'CM360_REQUEST_ENTRIES') {
        sendEntries();
        return;
      }

      if (data.type === 'CM360_DIAGNOSTICS' && bundle) {
        const diag = data.diagnostics as PreviewDiagnostics;
        if (diag) {
          setLocalDiag(diag);
          setPreviewDiagnostics(bundle.id, diag);
          if (diag.dimension?.height) {
            setHeight(
              Math.min(
                Math.max(diag.dimension.height + 60, 320),
                maxBodyHeight ?? 960,
              ),
            );
          }
          setLoading(false);
        }
        return;
      }

      if (data.type === 'creative-click') {
        const url = typeof data.url === 'string' ? data.url : '';
        setClickUrl(url);
        setClickPresent((prev) => prev || !!url || !!data.meta?.present);
        setShowModal(true);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [bundle, sendEntries, setPreviewDiagnostics, maxBodyHeight]);

  const diagnostics = useMemo(() => {
    if (!bundle?.id) return undefined;
    return localDiag || previewDiagnostics[bundle.id];
  }, [bundle?.id, localDiag, previewDiagnostics]);

  const dimension = diagnostics?.dimension;
  const networkFailures = diagnostics?.networkFailures ?? [];
  const uniqueFailures = Array.from(new Set(networkFailures));

  const assetEntries = useMemo(
    () => Object.entries(assetUrls).sort(([pathA], [pathB]) => pathA.localeCompare(pathB)),
    [assetUrls],
  );

  if (!bundleRes) {
    return (
      <div style={{ fontSize: 12, color: '#64748b' }}>
        Upload a bundle to view the preview.
      </div>
    );
  }

  const dimensionLabel = dimension
    ? `${dimension.width}×${dimension.height} (${dimension.source})`
    : 'auto';

  const iframeWidth = dimension?.width ? `${dimension.width}px` : '100%';
  const iframeHeight = Math.min(
    Math.max(dimension?.height ?? height, 320),
    maxBodyHeight ?? 900,
  );
  const showDiagnosticsBanner =
    diagnostics?.visibilityGuardActive || uniqueFailures.length > 0;

  return (
    <div
      className="ext-preview"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <nav
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          paddingBottom: 8,
        }}
      >
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`tab ${tab === key ? 'active' : ''}`}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 999,
              border: '1px solid transparent',
              background: tab === key ? 'var(--accent)' : 'transparent',
              color: tab === key ? '#ffffff' : 'var(--text)',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'preview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong style={{ fontSize: 14 }}>CM360 Preview Simulation</strong>
              <span style={{ fontSize: 12, opacity: 0.72 }}>
                Base dir: {formatBaseDir(previewInfo)}
              </span>
              <span style={{ fontSize: 12, opacity: 0.72 }}>
                Dimensions: {dimensionLabel}
              </span>
              <span style={{ fontSize: 12, opacity: 0.72 }}>
                Enabler: {diagnostics?.enablerSource ?? 'unknown'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (!bundle || !previewInfo) return;
                  setLoading(true);
                  setHtml(
                    buildPreviewHtml({
                      bundleId: bundle.id,
                      baseDir: previewInfo.baseDir,
                      indexPath: previewInfo.indexPath,
                    }),
                  );
                  setIframeKey((prev) => prev + 1);
                  window.setTimeout(sendEntries, 80);
                }}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.45)',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                }}
              >
                Reload preview
              </button>
              {hasDebugInsights && (
                <button
                  type="button"
                  onClick={() => setShowInsights((v) => !v)}
                  style={{
                    fontSize: 12,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,0.45)',
                    background: showInsights
                      ? 'var(--accent)'
                      : 'var(--surface-2)',
                    color: showInsights ? '#ffffff' : 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  {showInsights ? 'Hide metadata' : 'Metadata'}
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              border: '1px solid rgba(148,163,184,0.2)',
              background: '#ffffff',
              width: iframeWidth,
              height: iframeHeight,
            }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              title="Creative Preview"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
              srcDoc={html}
              onLoad={sendEntries}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: 'block',
                background: '#ffffff',
              }}
            />
            {loading && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(15,23,42,0.7)',
                  color: '#bfdbfe',
                  fontSize: 12,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Loading…
              </div>
            )}
          </div>

          {showDiagnosticsBanner && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(59,130,246,0.35)',
                background: 'rgba(59,130,246,0.08)',
                fontSize: 12,
              }}
            >
              {diagnostics?.visibilityGuardActive && (
                <div>
                  Visibility guard active — the preview forced the creative to
                  stay visible for inspection.
                </div>
              )}
              {uniqueFailures.length > 0 && (
                <div>
                  <strong>Network misses:</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
                    {uniqueFailures.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {showInsights && hasDebugInsights && (
            <div
              style={{
                display: 'grid',
                gap: 12,
                fontSize: 12,
                background: 'var(--surface-2)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              {debugFindings.map((finding: any) => (
                <div
                  key={finding.id}
                  style={{
                    borderRadius: 10,
                    border: '1px solid rgba(148,163,184,0.28)',
                    padding: 12,
                    background: 'rgba(148,163,184,0.08)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    {finding.title}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(Array.isArray(finding.messages)
                      ? finding.messages
                      : [finding.messages]
                    ).map((msg: any, idx: number) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {debugLog.length > 0 && (
                <div
                  style={{
                    borderRadius: 10,
                    border: '1px dashed rgba(148,163,184,0.38)',
                    padding: 12,
                    background: 'rgba(14,165,233,0.08)',
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>
                    Preview runtime debug
                  </div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      maxHeight: 180,
                      overflow: 'auto',
                      fontFamily: 'monospace',
                    }}
                  >
                    {debugLog.map((entry, idx) => (
                      <li key={idx}>{entry}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              style={{
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                background: 'var(--accent)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              CTURL status
            </button>
          </div>
        </div>
      )}

      {tab === 'source' && (
        <div
          style={{
            position: 'relative',
            maxHeight: maxBodyHeight ?? 720,
            overflow: 'auto',
            border: '1px solid rgba(148,163,184,0.28)',
            borderRadius: 12,
          }}
        >
          <button
            type="button"
            onClick={() => {
              try {
                void navigator.clipboard.writeText(original);
              } catch {}
            }}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(148,163,184,0.4)',
              background: 'var(--surface-2)',
              cursor: 'pointer',
            }}
          >
            Copy source
          </button>
          <pre
            style={{
              margin: 0,
              padding: '48px 16px 16px',
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            {original || 'No index.html content available.'}
          </pre>
        </div>
      )}

      {tab === 'assets' && (
        <div
          style={{
            position: 'relative',
            maxHeight: maxBodyHeight ?? 720,
            overflow: 'auto',
            border: '1px solid rgba(148,163,184,0.28)',
            borderRadius: 12,
            padding: 16,
            display: 'grid',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => {
              const rows = assetEntries
                .map(([path, url]) => `${path}\t${url}`)
                .join('\n');
              try {
                void navigator.clipboard.writeText(rows);
              } catch {}
            }}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(148,163,184,0.4)',
              background: 'var(--surface-2)',
              cursor: 'pointer',
            }}
          >
            Copy table
          </button>
          {assetEntries.length === 0 && (
            <div style={{ fontSize: 12, color: '#64748b' }}>No assets.</div>
          )}
          {assetEntries.map(([path, url]) => (
            <div
              key={path}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{path}</span>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)' }}
              >
                open
              </a>
            </div>
          ))}
        </div>
      )}

      {tab === 'json' && (
        <div
          style={{
            position: 'relative',
            maxHeight: maxBodyHeight ?? 720,
            overflow: 'auto',
            border: '1px solid rgba(148,163,184,0.28)',
            borderRadius: 12,
          }}
        >
          <button
            type="button"
            onClick={() => {
              try {
                void navigator.clipboard.writeText(
                  JSON.stringify(bundleRes, null, 2),
                );
              } catch {}
            }}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              fontSize: 12,
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid rgba(148,163,184,0.4)',
              background: 'var(--surface-2)',
              cursor: 'pointer',
            }}
          >
            Copy JSON
          </button>
          <pre
            style={{
              margin: 0,
              padding: '48px 16px 16px',
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: 'var(--surface)',
              color: 'var(--text)',
            }}
          >
            {JSON.stringify(bundleRes, null, 2)}
          </pre>
        </div>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              color: 'var(--text)',
              padding: 18,
              borderRadius: 12,
              width: 'min(420px, 92vw)',
              display: 'grid',
              gap: 12,
              boxShadow: '0 20px 55px rgba(15,23,42,0.45)',
            }}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ fontSize: 14 }}>Clickthrough status</strong>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid rgba(148,163,184,0.4)',
                  background: 'var(--surface-2)',
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </header>
            {clickUrl ? (
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  background: 'var(--surface-2)',
                  padding: 12,
                  borderRadius: 8,
                  wordBreak: 'break-word',
                  border: '1px solid rgba(148,163,184,0.35)',
                }}
              >
                {clickUrl}
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  background: 'rgba(245,158,11,0.12)',
                  border: '1px solid rgba(245,158,11,0.32)',
                  color: '#facc15',
                  padding: 12,
                  borderRadius: 8,
                }}
              >
                {clickPresent
                  ? 'Click handler detected but URL was blank.'
                  : 'No clickthrough detected yet.'}
              </div>
            )}
            <footer
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  if (!clickUrl) return;
                  try {
                    void navigator.clipboard.writeText(clickUrl);
                  } catch {}
                }}
                disabled={!clickUrl}
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.4)',
                  background: clickUrl ? 'var(--surface-2)' : '#1e293b',
                  color: clickUrl ? 'var(--text)' : '#94a3b8',
                  cursor: clickUrl ? 'pointer' : 'not-allowed',
                }}
              >
                Copy URL
              </button>
              <a
                href={clickUrl || 'about:blank'}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#ffffff',
                  textDecoration: 'none',
                  pointerEvents: clickUrl ? 'auto' : 'none',
                  opacity: clickUrl ? 1 : 0.5,
                }}
              >
                Open
              </a>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};


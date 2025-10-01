import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useExtStore } from '../state/useStoreExt';
import { parseBulkInput, HIGHLIGHT_PARAM_PRIORITY } from '../logic/bulk';
import { buildAdTagDocument } from '../logic/tagPreview';
import { ENVIRONMENT_OPTIONS, type AdTagEnvironment, type EnvironmentOption } from '../logic/environment';

const MAX_HIGHLIGHT_COLUMNS = 5;

const textareaStyle: React.CSSProperties = {
  minHeight: 120,
  fontFamily: 'monospace',
  fontSize: 12,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 8,
};

const listBoxStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 11,
  minHeight: 80,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: 6,
  borderRadius: 6,
  border: '1px solid var(--border)',
};

const networkBoxStyle: React.CSSProperties = {
  ...listBoxStyle,
  minHeight: 160,
  maxHeight: 220,
  overflowY: 'auto',
  paddingRight: 10,
};

const frameStyle: React.CSSProperties = {
  width: '100%',
  height: 300,
  border: '1px solid var(--border)',
  borderRadius: 6,
};

type NetworkEvent = {
  id: number;
  event: string;
  url: string;
  meta?: Record<string, unknown> | null;
  ts: number;
};

export const TagTester: React.FC = () => {
  const [tag, setTag] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string[]>([]);
  const [networkEvents, setNetworkEvents] = useState<NetworkEvent[]>([]);
  const [environment, setEnvironment] = useState<AdTagEnvironment>('web');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const eventCounterRef = useRef(0);
  const setVastSeed = useExtStore((s) => (s as any).setVastSeed);
  const tagSeed = useExtStore((s) => (s as any).tagSeed);
  const setTagSeed = useExtStore((s) => (s as any).setTagSeed);

  useEffect(() => {
    try {
      const seed = tagSeed as any;
      if (seed && typeof seed === 'string') {
        setTag(seed);
        setTagSeed(undefined);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setErrors([]);
    setInfo([]);
    setNetworkEvents([]);
  }, [tag]);

  const bulkEntries = useMemo(() => parseBulkInput(tag), [tag]);
  const multi = bulkEntries.length > 1;
  const highlightColumns = useMemo(() => {
    const active: string[] = [];
    for (const key of HIGHLIGHT_PARAM_PRIORITY) {
      if (bulkEntries.some((entry) => entry.params[key])) {
        active.push(key);
      }
    }
    return active.slice(0, MAX_HIGHLIGHT_COLUMNS);
  }, [bulkEntries]);

  const selectedEnvironment = useMemo(
    () => ENVIRONMENT_OPTIONS.find((opt) => opt.value === environment) ?? ENVIRONMENT_OPTIONS[0],
    [environment]
  );

  const formatNetworkMeta = (meta: Record<string, unknown> | null | undefined) => {
    if (!meta || typeof meta !== 'object') return '';
    const entries = Object.entries(meta).filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    );
    if (!entries.length) return '';
    return entries
      .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
      .join(', ');
  };

  const formatNetworkRow = (entry: NetworkEvent) => {
    const time = new Date(entry.ts).toLocaleTimeString(undefined, { hour12: false });
    const summary = `${entry.event.toUpperCase()} → ${entry.url || '(blank)'}`;
    const meta = formatNetworkMeta(entry.meta);
    return `${time} • ${summary}${meta ? ` (${meta})` : ''}`;
  };

  const copyNetworkToClipboard = async () => {
    if (!networkEvents.length) return;
    try {
      const payload = networkEvents.map((entry) => formatNetworkRow(entry)).join('\n');
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(payload);
      }
    } catch (err) {
      setErrors((prev) => [
        ...prev,
        `Copy failed: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }
  };

  function run() {
    setErrors([]);
    setInfo([]);
    setNetworkEvents([]);
    if (multi) return;

    const t = (tag || '').trim();
    const looksXml = t.startsWith('<');
    const looksVastRoot = /<\s*VAST[\s>]/i.test(t);
    const looksVastUrl =
      /^https?:\/\/[^\s]+\.(xml)(\?|#|$)/i.test(t) ||
      (/^https?:\/\//i.test(t) && /vast|adtag|adtaguri/i.test(t));
    if ((looksXml && looksVastRoot) || looksVastUrl) {
      try {
        setVastSeed(looksXml ? { mode: 'xml', value: t } : { mode: 'url', value: t });
      } catch {}
      try {
        const btn = Array.from(document.querySelectorAll('.tabs .tab')).find(
          (el) => el.textContent?.trim() === 'VAST'
        ) as HTMLButtonElement | undefined;
        btn?.click();
      } catch {}
      return;
    }

    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = buildAdTagDocument(t, { environment });
  }

  const handleEnvironmentChange = (mode: AdTagEnvironment) => {
    if (mode === environment) return;
    setEnvironment(mode);
    setErrors([]);
    setInfo([]);
    setNetworkEvents([]);
    const iframe = iframeRef.current;
    if (!iframe) return;
    const trimmed = (tag || '').trim();
    if (!multi && trimmed) {
      iframe.srcdoc = buildAdTagDocument(trimmed, { environment: mode });
    } else {
      iframe.srcdoc = buildAdTagDocument('', { environment: mode });
    }
  };

  function openRow(r: ReturnType<typeof parseBulkInput>[number]) {
    if (r.type === 'VAST XML' || r.type === 'VAST URL') {
      try {
        setVastSeed(r.type === 'VAST XML' ? { mode: 'xml', value: r.raw } : { mode: 'url', value: r.raw });
      } catch {}
      try {
        const btn = Array.from(document.querySelectorAll('.tabs .tab')).find(
          (el) => el.textContent?.trim() === 'VAST'
        ) as HTMLButtonElement | undefined;
        btn?.click();
      } catch {}
    } else if (r.type === 'Ad Tag') {
      setTag(r.raw);
      setTimeout(() => run(), 0);
    }
  }

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      const d = (ev as any).data;
      if (!d) return;
      if (d.__tag_test) {
        if (d.kind === 'error') setErrors((prev) => [...prev, d.text]);
        if (d.kind === 'info') setInfo((prev) => [...prev, d.text]);
        if (d.kind === 'network') {
          const id = eventCounterRef.current++;
          const event: NetworkEvent = {
            id,
            event: typeof d.event === 'string' ? d.event : 'request',
            url: typeof d.url === 'string' ? d.url : '',
            meta: d.meta || null,
            ts: typeof d.ts === 'number' ? d.ts : Date.now(),
          };
          setNetworkEvents((prev) => {
            const next = [...prev, event];
            if (next.length > 200) next.shift();
            return next;
          });
        }
      }
    }
    window.addEventListener('message', onMsg as any);
    return () => window.removeEventListener('message', onMsg as any);
  }, []);

  return (
    <div>
      <div style={{ display: 'grid', gap: 6 }}>
        <textarea
          data-testid="tag-input"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData?.getData('text') || '';
            const t = pasted.trim();
            if (!t) return;
            const looksXml = t.startsWith('<');
            const looksVastRoot = /<\s*VAST[\s>]/i.test(t);
            const looksVastUrl =
              /^https?:\/\/[^\s]+\.(xml)(\?|#|$)/i.test(t) ||
              (/^https?:\/\//i.test(t) && /vast|adtag|adtaguri/i.test(t));
            if ((looksXml && looksVastRoot) || looksVastUrl) {
              e.preventDefault();
              try {
                setVastSeed(looksXml ? { mode: 'xml', value: t } : { mode: 'url', value: t });
              } catch {}
              try {
                const btn = Array.from(document.querySelectorAll('.tabs .tab')).find(
                  (el) => el.textContent?.trim() === 'VAST'
                ) as HTMLButtonElement | undefined;
                btn?.click();
              } catch {}
              return;
            }
          }}
          placeholder="Paste your ad tag here (single or multiple lines)"
          style={textareaStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={run} className="btn primary" data-testid="tag-run">
            {multi ? 'Parse List' : 'Run Tag'}
          </button>
        </div>

        <div className="panel" style={{ padding: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Preview Environment</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ENVIRONMENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`btn ${environment === opt.value ? 'primary' : ''}`}
                onClick={() => handleEnvironmentChange(opt.value)}
                data-testid={`env-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>{selectedEnvironment.hint}</div>
        </div>

        {multi && (
          <div className="panel" style={{ padding: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Detected {bulkEntries.length} tags
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Type</th>
                    <th>Vendor</th>
                    <th>Host</th>
                    {highlightColumns.map((col) => (
                      <th key={col}>{col.toUpperCase()}</th>
                    ))}
                    <th>Other Params</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkEntries.map((r) => (
                    <tr
                      key={r.i}
                      role="button"
                      tabIndex={0}
                      onClick={() => openRow(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openRow(r);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>{r.i}</td>
                      <td>{r.type}</td>
                      <td>{r.vendor}</td>
                      <td>{r.host || '-'}</td>
                      {highlightColumns.map((col) => (
                        <td key={col}>{r.params[col] || '-'}</td>
                      ))}
                      <td
                        style={{
                          maxWidth: 520,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {(() => {
                          const rest = Object.entries(r.params)
                            .filter(([k]) => !highlightColumns.includes(k))
                            .slice(0, 6)
                            .map(([k, v]) => `${k}=${v}`);
                          return rest.length ? rest.join('  ') : '-';
                        })()}
                      </td>
                    </tr>
                  ))}
                  {bulkEntries.length === 0 && (
                    <tr>
                      <td
                        colSpan={5 + highlightColumns.length}
                        style={{ fontStyle: 'italic', color: '#6b7280' }}
                      >
                        No entries parsed
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Errors</div>
            <ul style={listBoxStyle} aria-label="Error messages" data-testid="error-list">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {!errors.length && <li style={{ color: '#6b7280' }}>No errors yet</li>}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Info</div>
            <ul style={listBoxStyle} aria-label="Info messages" data-testid="info-list">
              {info.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {!info.length && <li style={{ color: '#6b7280' }}>No info yet</li>}
            </ul>
          </div>
        </div>

        <div className="panel" style={{ padding: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              Network Activity ({networkEvents.length})
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                className="btn"
                onClick={() => setNetworkEvents([])}
                disabled={!networkEvents.length}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn"
                onClick={copyNetworkToClipboard}
                title="Copy network log to clipboard"
                disabled={!networkEvents.length}
              >
                Copy
              </button>
            </div>
          </div>
          <ul style={networkBoxStyle} aria-label="Network activity" data-testid="network-list">
            {networkEvents.map((entry) => (
              <li key={entry.id} style={{ marginBottom: 4 }}>
                {formatNetworkRow(entry)}
              </li>
            ))}
            {!networkEvents.length && (
              <li style={{ color: '#6b7280' }}>Run a tag to see pixel calls and requests.</li>
            )}
          </ul>
        </div>

        {!multi && (
          <iframe
            ref={iframeRef}
            title="Tag Preview"
            sandbox="allow-scripts allow-same-origin allow-popups"
            srcDoc={buildAdTagDocument('', { environment })}
            style={frameStyle}
          />
        )}
      </div>
    </div>
  );
};



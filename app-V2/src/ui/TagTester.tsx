import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useExtStore } from '../state/useStoreExt';
import { parseBulkInput, HIGHLIGHT_PARAM_PRIORITY } from '../logic/bulk';

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

const frameStyle: React.CSSProperties = {
  width: '100%',
  height: 300,
  border: '1px solid var(--border)',
  borderRadius: 6,
};

export const TagTester: React.FC = () => {
  const [tag, setTag] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
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

  function run() {
    setErrors([]);
    setInfo([]);
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

    const doc = `<html><head><meta charset='utf-8'><title>Tag</title></head><body>${t}</body></html>`;
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = doc;
  }

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
      }
    }
    window.addEventListener('message', onMsg as any);
    return () => window.removeEventListener('message', onMsg as any);
  }, []);

  const probe = `(()=>{ try{ const p=(m)=>parent.postMessage({__tag_test:1, ...m}, '*');
    const origErr = window.onerror; window.onerror=(msg)=>{ p({kind:'error', text:String(msg)}); if(origErr) try{origErr.apply(this, arguments);}catch{} };
    setTimeout(()=>{ try{ const hasCT = (typeof (window as any).clickTag==='string') || (typeof (window as any).clickTAG==='string'); p({kind:'info', text: 'clickTag present: '+hasCT}); }catch(e){} }, 50);
  }catch(e){ parent.postMessage({__tag_test:1, kind:'error', text:String(e)}, '*'); } })();`;

  return (
    <div>
      <div style={{ display: 'grid', gap: 6 }}>
        <textarea
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
          <button onClick={run} className="btn primary">
            {multi ? 'Parse List' : 'Run Tag'}
          </button>
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
            <ul style={listBoxStyle}>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Info</div>
            <ul style={listBoxStyle}>
              {info.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>

        {!multi && (
          <iframe
            ref={iframeRef}
            title="Tag Preview"
            sandbox="allow-scripts allow-same-origin allow-popups"
            srcDoc={`<html><body><script>${probe}<\/script></body></html>`}
            style={frameStyle}
          />
        )}
      </div>
    </div>
  );
};



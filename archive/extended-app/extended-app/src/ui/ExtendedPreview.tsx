import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useExtStore } from '../state/useStoreExt';
import { buildInstrumentedPreview, type ProbeEvent, type ProbeSummary } from '../logic/runtimeProbe';

type TabKey = 'preview'|'source'|'assets'|'json';

export const ExtendedPreview: React.FC = () => {
  const { results, selectedBundleId } = useExtStore((s:any)=>({ results: s.results, selectedBundleId: s.selectedBundleId }));
  const bundleRes: any = results.find((r:any)=>r.bundleId===selectedBundleId) || results[0];
  const bundle = useExtStore((s:any) => (s.bundles.find((b:any)=>b.id===bundleRes?.bundleId)));
  const iframeRef = useRef<HTMLIFrameElement|null>(null);
  const [tab, setTab] = useState<TabKey>('preview');
  const [html, setHtml] = useState('');
  const [original, setOriginal] = useState('');
  const [blobMap, setBlobMap] = useState<Record<string,string>>({});
  const [summary, setSummary] = useState<ProbeSummary|null>(null);
  const [events, setEvents] = useState<ProbeEvent[]>([]);
  const [height, setHeight] = useState(800);
  const [showModal, setShowModal] = useState(false);
  const [clickUrl, setClickUrl] = useState<string>('');
  const [clickPresent, setClickPresent] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const debugFindings = bundleRes?.debugFindings ?? [];
  const hasDebugInsights = debugFindings.length > 0;

  useEffect(()=>{
    if (!bundleRes || !bundleRes.primary || !bundle) return;
    let cancelled = false;
    (async()=>{
  const built = await buildInstrumentedPreview(bundle as any, (bundleRes as any).primary.path);
      if (cancelled) return;
      setHtml(built.html);
      setOriginal(built.originalHtml);
      setBlobMap(built.blobMap);
    })();
    return ()=>{ cancelled = true; };
  }, [bundleRes?.bundleId, bundleRes?.primary?.path, bundle]);

  useEffect(()=>{
    function handler(ev: MessageEvent){
      const d = ev?.data as any; if (!d) return;
      if (d.__audit_event) {
        const pe = d as ProbeEvent;
        setEvents(prev => [pe, ...prev].slice(0,200));
        if (pe.type==='summary') {
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
                const idx = st.results.findIndex((r: any) => r.bundleId === bundleId);
                if (idx >= 0) {
                  const updated = st.results.map((r: any, i: number) => {
                    if (i !== idx) return r;
                    const findings = Array.isArray(r.findings) ? [...r.findings] : [];
                    const fi = findings.findIndex((f: any) => f.id === 'timeToRender');
                    const sev = ttr > 500 ? 'WARN' : 'PASS';
                    const msg = `Render start ~${Math.round(ttr)} ms`;
                    if (fi >= 0) {
                      findings[fi] = { ...findings[fi], severity: sev, messages: [msg, 'Target: < 500 ms'] };
                    } else {
                      findings.push({ id:'timeToRender', title:'Time to Render', severity: sev, messages:[msg, 'Target: < 500 ms'], offenders: [] });
                    }
                    // recompute summary counts (counts include all findings) and Status (required only)
                    let fails=0, warns=0, pass=0;
                    for (const f of findings) {
                      if (f.severity==='FAIL') fails++;
                      else if (f.severity==='WARN') warns++;
                      else pass++;
                    }
                    // Required set must mirror ExtendedResults/FindingList
                    const REQUIRED_IDS = new Set<string>([
                      'packaging','primaryAsset','assetReferences','externalResources','httpsOnly','clickTags','iabWeight','iabRequests','systemArtifacts','fileTypes','syntaxErrors','creativeRendered','docWrite','indexFile','nameDimensions'
                    ]);
                    const requiredOnly = findings.filter((f:any)=>REQUIRED_IDS.has(f.id));
                    let status: 'PASS'|'WARN'|'FAIL' = 'PASS';
                    for (const f of requiredOnly) {
                      if (f.severity==='FAIL') { status = 'FAIL'; break; }
                      if (f.severity==='WARN') status = (status==='PASS' ? 'WARN' : status);
                    }
                    const summary = { ...r.summary, totalFindings: findings.length, fails, warns, pass, status };
                    return { ...r, findings, summary };
                  });
                  st.setResults(updated);
                }
              }
            }
          } catch {}
        }
      } else if (d.type==='creative-click') {
        const url = (typeof d.url === 'string') ? d.url : '';
        const present = !!(d.meta && (d.meta.present || d.meta.source));
        setClickPresent(prev => prev || present || !!url);
        setSummary(prev => ({ ...(prev||{}), clickUrl: url } as any));
        setClickUrl(url);
        // If runtime already opened a window (Enabler hook), we still show the modal
        setShowModal(true);
      }
    }
    window.addEventListener('message', handler);
    return ()=> window.removeEventListener('message', handler);
  }, []);

  useEffect(()=>{ setShowInsights(false); }, [bundleRes?.bundleId]);
  useEffect(()=>{ if (tab !== 'preview') setShowInsights(false); }, [tab]);
  useEffect(()=>{ if (!hasDebugInsights) setShowInsights(false); }, [hasDebugInsights]);

  const assetEntries = useMemo(()=> Object.entries(blobMap).sort(([a]:[string,string],[b]:[string,string])=> a.localeCompare(b)), [blobMap]);
  if (!bundleRes) return <div style={{fontSize:12,color:'#555'}}>No bundle selected.</div>;
  if (!bundleRes.primary) return <div style={{fontSize:12,color:'#555'}}>No primary HTML detected.</div>;

  return (
    <div className="ext-preview" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <nav className="tabs" style={{ borderBottom:'1px solid var(--border)', paddingBottom:6, marginBottom:6 }}>
        {(['preview','source','assets','json'] as TabKey[]).map(k => (
          <button key={k} onClick={()=>setTab(k)} className={`tab ${tab===k? 'active':''}`}>{label(k)}</button>
        ))}
      </nav>
      <div style={{ padding:8, fontSize:12 }}>
        {tab==='preview' && (
          <div style={{ position:'relative' }}>
            {/* Header controls above the preview */}
            <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:6, marginBottom:6 }}>
              {hasDebugInsights && (
                <button
                  type='button'
                  onClick={()=>setShowInsights(v => !v)}
                  className={`btn ${showInsights ? 'primary' : ''}`}
                  style={{ fontSize:11, padding:'4px 8px' }}
                >
                  {showInsights ? 'Hide Metadata' : 'Metadata'}
                </button>
              )}
            </div>

            <iframe
              ref={iframeRef}
              title='Creative Preview'
              sandbox='allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-modals'
              srcDoc={html}
              style={{ width:'100%', height, border:'1px solid var(--border)' }}
              onLoad={()=>{
                try {
                  const doc = iframeRef.current?.contentDocument; if (!doc) return;
                  const body = doc.body; const resize = ()=>{ const h = Math.min(Math.max(body.scrollHeight, 600), 1400); setHeight(h); };
                  resize(); new MutationObserver(()=>resize()).observe(doc.documentElement, { childList:true, subtree:true, attributes:true, characterData:true });
                } catch {}
              }}
            />
            <button type='button' onClick={()=>setShowModal(true)} className='btn primary' style={{ position:'absolute', right:8, bottom:8, fontSize:11, padding:'2px 6px' }}>CTURL Status</button>
            {showInsights && hasDebugInsights && (
              <div style={{ position:'absolute', inset:0, padding:16, display:'flex', justifyContent:'flex-end', alignItems:'flex-start', pointerEvents:'none' }}>
                <div style={{ marginTop:40, width:'min(420px, 100%)', maxHeight:'calc(100% - 40px)', background:'var(--panel-2)', color:'var(--text)', borderRadius:12, padding:16, overflowY:'auto', pointerEvents:'auto', boxShadow:'var(--shadow)', border:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', justifyContent:'flex-start', alignItems:'center', marginBottom:12 }}>
                    <div style={{ fontSize:12, fontWeight:700, letterSpacing:0.3 }}>Preview Metadata</div>
                  </div>
                  <div style={{ display:'grid', gap:12 }}>
                    {debugFindings.map((f: any) => (
                      <div key={f.id} style={{ background:'rgba(148,163,184,0.12)', borderRadius:10, padding:12 }}>
                        <div style={{ marginBottom:6, fontSize:12, fontWeight:600 }}>{f.title}</div>
                        <ul style={{ margin:0, paddingLeft:18, fontSize:11, lineHeight:1.5, listStyle:'disc' }}>
                          {f.messages.map((m: any, i: number) => <li key={i}>{m}</li>)}
                        </ul>
                        {f.offenders?.length ? (
                          <div style={{ marginTop:8, fontSize:10, fontFamily:'monospace', opacity:0.85 }}>
                            {f.offenders.slice(0,5).map((o: any, i: number) => (
                              <div key={i} style={{ marginBottom:2 }}>
                                <span>{o.path}</span>
                                {o.detail && <span style={{ opacity:0.9 }}> - {o.detail}</span>}
                                {typeof o.line === 'number' && <span style={{ marginLeft:4 }}>#L{o.line}</span>}
                              </div>
                            ))}
                            {f.offenders.length > 5 && (
                              <div style={{ marginTop:4, opacity:0.6 }}>+{f.offenders.length - 5} more...</div>
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
  )}
        {tab==='source' && (
          <div style={{ position:'relative', paddingTop:36 }}>
            <CopyButton onCopy={async()=>{ try { await navigator.clipboard.writeText(original); } catch { /* ignore */ } }} />
            <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-all', fontFamily:'monospace', fontSize:11, lineHeight:1.3 }}>{original}</pre>
          </div>
        )}
        {tab==='assets' && (
          <div style={{ position:'relative', paddingTop:36 }}>
            <CopyButton onCopy={async()=>{ const text = assetEntries.map(([p,u])=>`${p}\t${u}`).join('\n'); try { await navigator.clipboard.writeText(text); } catch {} }} />
            <div style={{ display:'grid', gap:6 }}>
              {assetEntries.map(([path, url]) => (
                <div key={path} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <span style={{ fontFamily:'monospace' }}>{path}</span>
                  <a href={url} target="_blank" rel="noreferrer" style={{ color:'#2563eb', textDecoration:'underline' }}>open</a>
                </div>
              ))}
              {assetEntries.length===0 && <div style={{ color:'#666' }}>No assets</div>}
            </div>
          </div>
        )}
        {tab==='json' && (
          <div style={{ position:'relative', paddingTop:36 }}>
            <CopyButton onCopy={async()=>{ try { await navigator.clipboard.writeText(JSON.stringify(bundleRes, null, 2)); } catch {} }} />
            <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-all', fontFamily:'monospace', fontSize:11, lineHeight:1.3 }}>{JSON.stringify(bundleRes, null, 2)}</pre>
          </div>
        )}
      </div>
      {/* Legacy probe log removed to reduce noise; insights overlay summarizes key signals. */}
      {showModal && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }} onClick={(e)=>{ if(e.target===e.currentTarget) setShowModal(false); }}>
          <div className='panel' style={{ padding:12, width:'min(520px, 92vw)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:700 }}>Clickthrough Status</div>
              <button onClick={()=>setShowModal(false)} className='btn' style={{ fontSize:12, padding:'2px 6px' }}>Close</button>
            </div>
            {(summary?.clickUrl || clickUrl) && (
              <div style={{ fontFamily:'monospace', fontSize:12, background:'var(--surface-2)', color:'var(--text)', padding:8, borderRadius:6, wordBreak:'break-all', border:'1px solid var(--border)' }}>{summary?.clickUrl || clickUrl}</div>
            )}
            {(!summary?.clickUrl && !clickUrl) && (
              <div style={{ fontSize:12, background:'rgba(245,158,11,0.12)', color:'#fde68a', border:'1px solid rgba(245,158,11,0.3)', padding:8, borderRadius:6 }}>
                {clickPresent ? 'Clickthrough present but not set (blank opened).' : 'No clickthrough URL captured. Creative may rely on ad-server macros or hasn\'t set clickTag.'}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:10 }}>
              {clickPresent && (
                <>
                  <a href={(summary?.clickUrl || clickUrl) || 'about:blank'} target="_blank" rel="noreferrer" className='btn primary' style={{ fontSize:12, padding:'6px 10px', textDecoration:'none' }}>Open{!summary?.clickUrl && !clickUrl ? ' Blank' : ''}</a>
                  {(summary?.clickUrl || clickUrl) && (
                    <button onClick={()=>{ const v = summary?.clickUrl || clickUrl || ''; if (v) navigator.clipboard.writeText(v).catch(()=>{}); }} className='btn' style={{ fontSize:12, padding:'6px 10px' }}>Copy</button>
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

function label(k: TabKey){ return k==='preview'?'Preview': k==='source'?'Source': k==='assets'?'Assets':'JSON'; }
function ms(n?: number){ return (typeof n==='number' && isFinite(n)) ? `${Math.round(n)} ms` : 'n/a'; }
// fmt removed with legacy probe log

const CopyButton: React.FC<{ onCopy: () => void | Promise<void> }> = ({ onCopy }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      aria-label="Copy"
      title={copied? 'Copied!' : 'Copy'}
      onClick={async()=>{ try { await onCopy(); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {} }}
      className='btn'
      style={{ position:'absolute', right:6, top:6, borderRadius:6, fontSize:11, padding:'4px 8px' }}
    >{copied? 'Copied' : 'Copy'}</button>
  );
};

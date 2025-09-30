import React, { useEffect, useRef, useState } from 'react';
import { compressToEncodedURIComponent } from 'lz-string';
import { useExtStore } from '../state/useStoreExt';
import type { BundleResult } from '../../../src/logic/types';
import { discoverPrimary } from '../../../src/logic/discovery';
import { parsePrimary } from '../../../src/logic/parse';
import { runChecks } from '../../../src/logic/checks';
import { buildExtendedFindings } from '../logic/extendedChecks';
import { ExtendedPreview } from './ExtendedPreview';

export const ExtendedResults: React.FC = () => {
  const { bundles, results, settings, setResults, selectedBundleId, selectBundle } = useExtStore((s:any)=>({ bundles: s.bundles, results: s.results, settings: s.settings, setResults: s.setResults, selectedBundleId: s.selectedBundleId, selectBundle: s.selectBundle }));

  async function process(): Promise<void> {
    const list: BundleResult[] = [] as any;
    for (const b of bundles) {
      // Primary detection for zips only; for single-file wrap we treat it as primary if HTML
      let primary: any;
      let adSize: any; let references: any[] = [];
      if (b.mode === 'zip') {
        const d: any = discoverPrimary(b);
        primary = d.primary;
        // Fallback: even if ad.size meta is missing or ambiguous, choose a reasonable HTML so preview still works
        if (!primary) {
          const cands: string[] = (d && Array.isArray(d.htmlCandidates) && d.htmlCandidates.length)
            ? d.htmlCandidates
            : Object.keys(b.files).filter(p=>/\.html?$/i.test(p));
          if (cands.length) {
            const chosen = chooseFallbackHTML(cands);
            primary = { path: chosen };
          }
        }
        if (primary) {
          const parsed = parsePrimary(b, primary);
          adSize = parsed.adSize;
          references = parsed.references;
        }
      } else {
        const only = Object.keys(b.files)[0] || '';
        if (/\.html?$/i.test(only)) {
          primary = { path: only };
          const parsed = parsePrimary(b, primary);
          adSize = parsed.adSize;
          references = parsed.references;
        }
      }
      const totalBytes = (Object.values(b.files) as Uint8Array[]).reduce((a,u)=>a+u.byteLength,0);
      // Initial set heuristic
      const referencedPaths = new Set<string>();
      for (const r of references) if (r.inZip && r.normalized) referencedPaths.add(r.normalized);
      const pLower = primary?.path?.toLowerCase(); if (pLower) referencedPaths.add(pLower);
      let initialBytes = 0; for (const p of referencedPaths) { const real = (b as any).lowerCaseIndex[p]; if (real && b.files[real]) initialBytes += b.files[real].byteLength; }
      if (initialBytes === 0) initialBytes = totalBytes;
      const subsequentBytes = Math.max(0, totalBytes - initialBytes);
      const initialRequests = referencedPaths.size || (primary ? 1 : 0);
      const totalRequests = referencedPaths.size;

      const base: any = {
        bundleId: b.id, bundleName: b.name, primary, adSize, references,
        totalBytes, initialBytes, subsequentBytes, zippedBytes: b.bytes.length,
        initialRequests, totalRequests, findings: [],
        summary: { status: 'PASS', totalFindings: 0, fails: 0, warns: 0, pass: 0, orphanCount: 0, missingAssetCount: 0 }
      };

      // Adjust settings to improve clickTag detection (case-insensitive variants)
      const adjustedSettings = {
        ...settings,
        clickTagPatterns: Array.from(new Set([
          ...settings.clickTagPatterns,
          String(/\bclicktag\b/i),
          String(/\bwindow\.clicktag\b/i),
        ]))
      };
      // Existing checks + extended
      const builtIn = runChecks(b as any, base, adjustedSettings as any);
      const ext = await buildExtendedFindings(b as any, base, adjustedSettings as any);
      // Remove hard-coded clickthrough URL finding per request
  const combinedFindings = [...builtIn, ...ext].filter(f => f.id !== 'hardcodedClickUrl');
  const debugFindings = combinedFindings.filter((f:any) => Array.isArray(f.tags) && f.tags.includes('debug'));
  const mainFindings = combinedFindings.filter((f:any) => !Array.isArray(f.tags) || !f.tags.includes('debug'));
      base.findings = mainFindings;
      base.debugFindings = debugFindings;
      // summarize: status should only reflect REQUIRED checks; counts include all main findings
      let fails = 0, warns = 0, pass = 0;
      for (const f of mainFindings) { if (f.severity === 'FAIL') fails++; else if (f.severity === 'WARN') warns++; else pass++; }
      // Required set must mirror FindingList grouping
      const REQUIRED_IDS = new Set<string>([
        'packaging','primaryAsset','assetReferences','externalResources','httpsOnly','clickTags','iabWeight','iabRequests','systemArtifacts','fileTypes','syntaxErrors','creativeRendered','docWrite','indexFile','nameDimensions'
      ]);
      const requiredOnly = mainFindings.filter((f:any)=>REQUIRED_IDS.has(f.id));
      let status: 'PASS'|'WARN'|'FAIL' = 'PASS';
      for (const f of requiredOnly) { if (f.severity === 'FAIL') { status = 'FAIL'; break; } if (f.severity === 'WARN') status = (status==='PASS' ? 'WARN' : status); }
      base.summary = { ...base.summary, status, totalFindings: mainFindings.length, fails, warns, pass };
      list.push(base);
    }
    setResults(list);
    // initialize selection if not set or stale
    try {
      const current = selectedBundleId;
      if (!current || !list.some(r=>r.bundleId===current)) {
        if (list[0]) selectBundle(list[0].bundleId);
      }
    } catch {}
  }

  useEffect(()=>{ if (bundles.length>0) { void process(); } }, [bundles.length]);

  return (
    <div>
      <div className="toolbar" style={{ marginBottom:8 }}>
        <button onClick={()=>void (async()=>process())()} className="btn primary">Run Validation</button>
        <ReportActions />
      </div>
      <div className="note" style={{ marginTop: 4 }}>
        Note: Most placements run creatives inside a secure iframe or SafeFrame. This preview uses an iframe context and flags nested iframes that can break integrations.
      </div>
      <div className="panel" style={{ marginTop:12, overflow:'hidden' }}>
        <ResultTable />
      </div>
      <SplitChecksAndPreview />
    </div>
  );
};

const ResultTable: React.FC = () => {
  const { results, bundles, selectedBundleId, selectBundle } = useExtStore((s:any)=>({ results: s.results, bundles: s.bundles, selectedBundleId: s.selectedBundleId, selectBundle: s.selectBundle }));
  if (results.length===0) return null;
  return (
    <div style={{ marginTop: 0, overflowX: 'auto' }}>
      <table className="table">
        <thead>
          <tr>
            <th style={th}>Bundle</th>
            <th style={th}>Status</th>
            <th style={th}>Mode</th>
            <th style={th}>Primary</th>
            <th style={th}>Dimensions</th>
            <th style={th}>Total KB</th>
            <th style={th}>Initial KB</th>
            <th style={th}>Requests</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r:any)=>{
            const b = bundles.find((bb:any)=>bb.id===r.bundleId);
            const selected = selectedBundleId ? selectedBundleId===r.bundleId : results[0]?.bundleId===r.bundleId;
            return (
              <tr key={r.bundleId} onClick={()=>selectBundle(r.bundleId)} style={{ cursor:'pointer', background: selected? 'rgba(79,70,229,0.12)':'transparent' }} title="Click to view details">
                <td style={td}>{r.bundleName}</td>
                <td style={{...td}}>{badge(r.summary.status)}</td>
                <td style={td}>{b?.mode||'-'}</td>
                <td style={td}>{r.primary?.path || '-'}</td>
                <td style={td}>{r.adSize ? `${r.adSize.width}x${r.adSize.height}` : '-'}</td>
                <td style={td}>{fmtKB(r.totalBytes)}</td>
                <td style={td}>{fmtKB(r.initialBytes)}</td>
                <td style={td}>{r.totalRequests||0}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const SplitChecksAndPreview: React.FC = () => {
  const containerRef = useRef<HTMLDivElement|null>(null);
  const dragging = useRef(false);
  const [split, setSplit] = useState<number>(()=>{
    try { const s = localStorage.getItem('ext_split'); if (s) { const v = parseFloat(s); if (!isNaN(v)) return Math.min(0.75, Math.max(0.25, v)); } } catch {}
    return 0.5;
  });
  useEffect(()=>{ try { localStorage.setItem('ext_split', String(split)); } catch {} }, [split]);
  useEffect(()=>{
    function onMove(e: MouseEvent){ if (!dragging.current) return; const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return; const x = e.clientX - rect.left; const p = Math.min(0.75, Math.max(0.25, x / Math.max(1, rect.width))); setSplit(p); e.preventDefault(); }
    function onUp(){ dragging.current = false; document.body.style.cursor = ''; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const leftW = `${Math.round(split*1000)/10}%`;
  const rightW = `${Math.round((1-split)*1000)/10}%`;

  return (
  <div ref={containerRef} className="split">
      {/* Checks Pane */}
      <div style={{ width:leftW, minWidth:240, overflow:'auto' }} className="left">
        <div className="title">Checks</div>
        <div className="body">
          <FindingList />
        </div>
      </div>
      {/* Divider */}
      <div role="separator" aria-orientation="vertical" title="Drag to resize" onMouseDown={(e)=>{ dragging.current = true; document.body.style.cursor = 'col-resize'; e.preventDefault(); }} className="separator">
        <i />
      </div>
      {/* Preview Pane */}
      <div style={{ width:rightW, minWidth:320, overflow:'auto' }} className="right">
        <div className="title">Preview</div>
        <div className="body">
          <ExtendedPreview />
        </div>
      </div>
    </div>
  );
};

  const FindingList: React.FC = () => {
  const { results, selectedBundleId } = useExtStore((s:any)=>({ results: s.results, selectedBundleId: s.selectedBundleId }));
  // IMPORTANT: Hooks must run unconditionally each render. Keep hooks above any early returns.
  const [optOpen, setOptOpen] = React.useState<boolean>(false);
  const res = results.find((r:any)=>r.bundleId===selectedBundleId) || results[0];
    if (!res) return null;
    // Better, user-friendly names
    const TITLE_OVERRIDES: Record<string,string> = {
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
      fileTypes: 'Allowed File Types',
      syntaxErrors: 'Runtime Errors',
      creativeRendered: 'Rendered Successfully',
  docWrite: 'No Document Write',
  indexFile: 'Root Index File',
      nameDimensions: 'Filename Has Correct Size',
      // Extended checks
      minified: 'Minified Code',
      cssEmbedded: 'Inline CSS Usage',
      animDuration: 'Animation and Transition Durations',
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
      cpuUsage: 'Long Tasks (CPU)',
      memoryUsage: 'Peak JS Heap',
      perfHeuristics: 'CPU/Memory Heuristics',
      hostedCount: 'Hosted File Count',
      creativeBorder: 'Creative Border',
    };

    // Decide which checks are Required vs Optional
    const REQUIRED_IDS = new Set<string>([
      'packaging',
      'primaryAsset',
      'assetReferences',
      'externalResources',
      'httpsOnly',
      'clickTags',
      'iabWeight',
      'iabRequests',
      'systemArtifacts',
      'fileTypes',
      'syntaxErrors',
      'creativeRendered',
      'docWrite',
      'indexFile',
      'nameDimensions',
    ]);

  const requiredFindings = res.findings.filter((f:any)=>REQUIRED_IDS.has(f.id));
  const optionalFindings = res.findings.filter((f:any)=>!REQUIRED_IDS.has(f.id));
    return (
      <div style={{ display:'grid', gap: 8 }}>
        {/* Priority Section */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Priority Checks</div>
          <div style={{ display:'grid', gap:8 }}>
            {requiredFindings.map((f:any)=> (
              <div key={f.id} className="card">
                <div className="title">
                  <div>{badge(f.severity)}</div>
                  <div>{TITLE_OVERRIDES[f.id] || f.title}</div>
                </div>
                <ul className="items">
                  {f.messages.map((m:string, i:number)=>(<li key={i}>{m}</li>))}
                </ul>
                {f.offenders?.length>0 && (
                  <details style={{ marginTop:6 }}>
                    <summary style={{ cursor:'pointer', fontSize:12, color:'#4b5563' }}>{f.severity==='PASS' ? 'Details' : 'Offenders'} ({f.offenders.length})</summary>
                      <ul className="offenders">
                        {f.offenders.map((o:any,i:number)=>(<li key={i}>{o.path}{o.detail?` — ${o.detail}`:''}{typeof o.line==='number'?` (line ${o.line})`:''}</li>))}
                      </ul>
                    </details>
                )}
                <div className="help">
                  <HelpIcon checkId={f.id} />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Optional Section */}
        <div>
          <button
            type="button"
            onClick={()=>setOptOpen(o=>!o)}
            aria-expanded={optOpen}
            style={{
              width:'100%',
              textAlign:'left',
              background:'rgba(255,255,255,0.02)',
              border:'1px solid var(--border)',
              borderRadius:8,
              padding:'6px 8px',
              fontSize:12,
              fontWeight:700
            }}
          >
            Optional checks {optOpen ? '▾' : '▸'} <span style={{ fontWeight:400, color:'#6b7280' }}>({optionalFindings.length})</span>
          </button>
          {optOpen && (
            <div style={{ display:'grid', gap:6, marginTop:6 }}>
              {optionalFindings.map((f:any)=> (
                <div key={f.id} className="card small">
                  <div className="title" style={{ gap:6 }}>
                    <div>{badge(f.severity)}</div>
                    <div style={{ fontSize:12 }}>{TITLE_OVERRIDES[f.id] || f.title}</div>
                  </div>
                  <ul className="items" style={{ marginTop:4, fontSize:11 }}>
                    {f.messages.map((m:string, i:number)=>(<li key={i}>{m}</li>))}
                  </ul>
                  {f.offenders?.length>0 && (
                    <details style={{ marginTop:4 }}>
                      <summary style={{ cursor:'pointer', fontSize:11, color:'#4b5563' }}>{f.severity==='PASS' ? 'Details' : 'Offenders'} ({f.offenders.length})</summary>
                      <ul className="offenders" style={{ fontSize:10, maxHeight:120 }}>
                        {f.offenders.map((o:any,i:number)=>(<li key={i}>{o.path}{o.detail?` — ${o.detail}`:''}{typeof o.line==='number'?` (line ${o.line})`:''}</li>))}
                      </ul>
                    </details>
                  )}
                  <div className="help" style={{ right:6, top:6 }}>
                    <HelpIcon checkId={f.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

const th: React.CSSProperties = { textAlign:'left', padding: 8, whiteSpace:'nowrap' };
const td: React.CSSProperties = { padding: 8, verticalAlign:'top' };

function badge(s: 'PASS'|'WARN'|'FAIL'|string){
  const cls = s==='FAIL'?'badge fail': s==='WARN'? 'badge warn' : 'badge pass';
  return <span className={cls}>{s}</span>;
}

function fmtKB(n:number){ return (Math.round((n/1024)*10)/10).toFixed(1)+' KB'; }

const ReportActions: React.FC = () => {
  const { results, bundles } = useExtStore((s:any)=>({ results: s.results, bundles: s.bundles }));
  if (results.length===0) return null;
  function downloadOriginal() {
    const b = bundles[0]; if (!b) return;
    const blob = new Blob([b.bytes.buffer.slice(b.bytes.byteOffset, b.bytes.byteOffset + b.bytes.byteLength)], { type: 'application/zip' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = b.name; a.click(); URL.revokeObjectURL(a.href);
  }
  function openPrintable() {
    const r = results[0];
    const html = buildPrintableHTML(r);
    const w = window.open('about:blank','_blank'); if (!w) return;
    w.document.write(html); w.document.close(); w.focus();
  }
  function shareLink() {
    const r = results[0];
    const data = compressToEncodedURIComponent(JSON.stringify(r));
    const url = `${location.origin}${location.pathname}#data=${data}`;
    navigator.clipboard?.writeText(url).catch(()=>{});
    alert('Share link copied to clipboard');
  }
  return (
    <div style={{ display:'flex', gap:8 }}>
      <button onClick={downloadOriginal} className="btn">Download Original</button>
      <button onClick={openPrintable} className="btn">Open Printable Report</button>
      <button onClick={shareLink} className="btn">Copy Share Link</button>
    </div>
  );
};

function buildPrintableHTML(res: any): string {
  const rows = res.findings.map((f:any)=> `<tr><td>${esc(f.title)}</td><td>${esc(f.severity)}</td><td>${esc(f.messages.join(' | '))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset='utf-8'><title>Audit Report</title>
  <style> body{font-family:system-ui,sans-serif; padding:16px;} h1{font-size:18px} table{width:100%;border-collapse:collapse;font-size:12px} th,td{padding:6px;border-top:1px solid #e5e7eb;text-align:left} th{background:#f3f4f6}</style>
  </head><body>
  <h1>Audit Report</h1>
  <div style='margin-bottom:8px; font-size:12px'>Bundle: ${esc(res.bundleName)} • Status: ${esc(res.summary.status)}</div>
  <table><thead><tr><th>Check</th><th>Severity</th><th>Messages</th></tr></thead><tbody>${rows}</tbody></table>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
  </body></html>`;
}

function esc(s:string){ return String(s||'').replace(/[&<>]/g, c => c==='&'?'&amp;':c==='<'?'&lt;':'&gt;'); }

function chooseFallbackHTML(paths: string[]): string {
  // Prefer index.html/htm at shallowest depth, else fewest path segments, else shortest length
  const byDepth = (p:string) => p.split('/').length;
  const isIndex = (p:string) => /\/(index\.html?)$/i.test('/'+p);
  const indexCands = paths.filter(isIndex);
  if (indexCands.length) {
    indexCands.sort((a,b)=> byDepth(a)-byDepth(b) || a.length-b.length);
    return indexCands[0];
  }
  const sorted = [...paths].sort((a,b)=> byDepth(a)-byDepth(b) || a.length-b.length);
  return sorted[0];
}

const DESCRIPTIONS: Record<string, string> = {
  // Core checks (from main app)
  packaging: 'Validates ZIP packaging: no nested archives or disallowed file types.\n\nWhy it matters: mispackaged zips are rejected by ad servers and creatives never leave trafficking.',
  primaryAsset: 'Detects main HTML file & required ad.size meta width/height.\n\nWhy it matters: without a primary file and declared size, ad servers cannot determine slot fit and will reject the creative.',
  assetReferences: 'Ensures all HTML/CSS referenced assets exist in the bundle.\n\nWhy it matters: missing assets render blanks that fail QA and waste impressions.',
  orphanAssets: 'Lists files not referenced by primary asset dependency graph.\n\nWhy it matters: unused assets inflate weight and can breach contractual caps.',
  externalResources: 'Flags external network references outside allowlist.\n\nWhy it matters: off-domain calls violate publisher policies and get placements denied.',
  httpsOnly: 'Requires all external references to use HTTPS.\n\nWhy it matters: insecure HTTP requests are blocked in secure frames, leaving the ad non-functional.',
  clickTags: 'Detects clickTag variables / exit APIs and hard-coded navigations.\n\nWhy it matters: broken exit plumbing stops click tracking and campaign billing.',
  gwdEnvironment: 'Identifies Google Web Designer runtime artifacts.\n\nWhy it matters: leftover runtime can conflict with host pages and bloat load times.',
  iabWeight: 'Compares initial/polite & compressed weights to default budgets configured in this tool.\n\nWhy it matters: overweight assets violate buyer contracts and get paused by ad servers.',
  iabRequests: 'Counts initial load asset requests vs the configured cap.\n\nWhy it matters: excessive requests drag render performance and fail certification.',
  systemArtifacts: 'OS metadata (Thumbs.db, .DS_Store) / __MACOSX entries.\n\nWhy it matters: scanning tools flag these as contamination and block uploads.',
  hardcodedClickUrl: 'Hard-coded absolute clickthrough URL(s) in code/markup.\n\nWhy it matters: bypassing macros removes tracking and causes trafficking rejections.',
  // Extended checks (parity)
  animDuration: 'Heuristic scan of CSS animation/transition durations.\n\nWhy it matters: overly long motion breaks brand rules and triggers QA escalations.',
  cssEmbedded: 'Inline CSS usage (style tags/attributes).\n\nWhy it matters: heavy inline styling inflates HTML size and complicates dynamic QA edits.',
  minified: 'Heuristic detection of minified JS/CSS files.\n\nWhy it matters: unminified code increases payload and can push creatives over weight limits.',
  dialogs: 'alert/confirm/prompt usage inside creative.\n\nWhy it matters: disruptive dialogs violate platform policies and will be blocked.',
  cookies: 'document.cookie writes detected in runtime.\n\nWhy it matters: unmanaged cookies can violate privacy policies and trigger compliance holds.',
  localStorage: 'localStorage writes detected in runtime.\n\nWhy it matters: storage usage may be disallowed by partners and requires disclosure.',
  timing: 'DOMContentLoaded, time to render, frames observed.\n\nWhy it matters: slow render metrics predict viewability issues and heavy-ad interventions.',
  timeToRender: 'Time to first visible render of the ad; < 500 ms is recommended.\n\nWhy it matters: delayed first paint hurts viewability guarantees.',
  measurement: 'Known analytics/measurement host references.\n\nWhy it matters: stacking trackers raises privacy concerns and can be blocked by supply partners.',
  domContentLoaded: 'DOMContentLoaded budget.\n\nWhy it matters: exceeding ~1s signals heavy creatives that partners can reject.',
  html5lib: 'Common creative libraries detected (CreateJS, GSAP, Pixi, jQuery).\n\nWhy it matters: knowing libraries helps validate licensing and optimization plans.',
  video: 'Video asset(s) in bundle.\n\nWhy it matters: video placements enforce extra specs, so trafficking must attach the correct profile.',
  iframes: 'Iframe tags in markup.\n\nWhy it matters: creatives are served inside secure iframes/SafeFrame; nested frames are often disallowed and can break integrations.',
  imagesOptimized: 'Potentially large images to optimize (heuristic).\n\nWhy it matters: oversized imagery drives weight over limits and slows load times.',
  indexFile: 'index.html presence at root.\n\nWhy it matters: This is the de facto standard entry point for HTML5 creatives. CM360 typically expects index.html for ZIP ingestion. The Trade Desk lets you choose a primary file, but index.html is recommended for automation. IAB specs do not strictly mandate index.html, but most ad servers and workflows assume it.',
  nameDimensions: 'Checks that the bundle/primary filename includes the creative size (e.g., 300x250 or 300 X 250).\n\nWhy it matters: consistent naming speeds trafficking and QA, preventing mismatches between booked size and asset size.',
  hostedSize: 'Total uncompressed size of files.\n\nWhy it matters: large payloads exceed ad server caps and may be auto-throttled.',
  cpuUsage: 'Long tasks total (first 3s) budget.\n\nWhy it matters: high CPU usage triggers heavy-ad rules and throttles delivery.',
  memoryUsage: 'Peak JS heap usage budget.\n\nWhy it matters: memory spikes crash host pages and get creatives blacklisted.',
  perfHeuristics: 'Advisory signal from preview-only measurements (CPU jitter, JS heap).\n\nWhy it matters: sustained main‑thread blocking or memory spikes can trigger heavy‑ad throttling and hurt viewability. Treat as a hint; confirm on standardized hardware if gating.',
  syntaxErrors: 'Uncaught runtime errors during preview.\n\nWhy it matters: crashing scripts show blanks and result in automatic takedowns.',
  docWrite: 'document.write calls used.\n\nWhy it matters: document.write is blocked in most modern ad slots, preventing any render.',
  jquery: 'jQuery presence detected.\n\nWhy it matters: heavy frameworks inflate payloads and are banned in many lightweight placements.',
  backup: 'Backup image presence (heuristic).\n\nWhy it matters: without a backup image, fallback delivery fails and impressions are lost.',
  hostedCount: 'Count of files in bundle.\n\nWhy it matters: excessive files complicate QA and can push weight budgets over limits.',
  fileTypes: 'File types outside a conservative allowlist.\n\nWhy it matters: unusual file types trip security scans and block approvals.',
  creativeBorder: 'Presence of border styles (heuristic).\n\nWhy it matters: missing borders violate spec requirements for publisher separation.',
  creativeRendered: 'Render activity observed during preview.\n\nWhy it matters: confirming render ensures the creative will not serve blank in production.',
  networkDynamic: 'Runtime fetch/XHR requests detected.\n\nWhy it matters: unexpected calls breach data policies and raise monitoring alerts.',
  heavyAdRisk: 'Risk indicator from initial size/CPU jitter.\n\nWhy it matters: creatives flagged heavy are throttled or unloaded by Chrome and major DSPs.',
  imageMeta: 'Image metadata (dimensions/size).\n\nWhy it matters: quick audit confirms assets meet spec prior to trafficking.',
  videoMeta: 'Video metadata (dimensions/duration/size).\n\nWhy it matters: ensures motion assets align with placement length and resolution requirements.',
  audioMeta: 'Audio metadata (duration/size).\n\nWhy it matters: audio assets must meet rich-media specs to avoid rejection.'
};

const HelpIcon: React.FC<{ checkId: string }> = ({ checkId }) => {
  const [open, setOpen] = React.useState(false);
  const desc = DESCRIPTIONS[checkId] || 'No description available.';
  return (
    <span
      style={{ position:'relative', display:'inline-block' }}
      onMouseEnter={()=>setOpen(true)}
      onMouseLeave={()=>setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Help for ${checkId}`}
        onClick={()=>setOpen(o=>!o)}
        className="btn"
        style={{ width:20, height:20, borderRadius:999, padding:0 }}
      >?</button>
      {open && (
        <div role="tooltip" className="tip" style={{ pointerEvents:'auto' }}>
          {desc}
        </div>
      )}
    </span>
  );
}






import React, { useEffect } from 'react';
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
      // summarize
      let fails = 0, warns = 0, pass = 0;
      let status: 'PASS'|'WARN'|'FAIL' = 'PASS';
      for (const f of mainFindings) {
        if (f.severity === 'FAIL') {
          fails += 1;
          status = 'FAIL';
        } else if (f.severity === 'WARN') {
          warns += 1;
          if (status !== 'FAIL') status = 'WARN';
        } else {
          pass += 1;
        }
      }
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
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={()=>void (async()=>process())()} style={{ padding: '6px 10px', borderRadius: 6, background:'#111', color:'#fff', fontSize: 12, fontWeight: 600 }}>Run Validation</button>
        <ReportActions />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: '#4b5563' }}>
        Note: Most placements run creatives inside a secure iframe or SafeFrame. This preview uses an iframe context and flags nested iframes that can break integrations.
      </div>
      <ResultTable />
      <div style={{ display:'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Checks</h3>
          <FindingList />
        </div>
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Preview</h3>
          <ExtendedPreview />
        </div>
      </div>
    </div>
  );
};

const ResultTable: React.FC = () => {
  const { results, bundles, selectedBundleId, selectBundle } = useExtStore((s:any)=>({ results: s.results, bundles: s.bundles, selectedBundleId: s.selectedBundleId, selectBundle: s.selectBundle }));
  if (results.length===0) return null;
  return (
    <div style={{ marginTop: 12, overflowX: 'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background:'#f3f4f6' }}>
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
              <tr key={r.bundleId} onClick={()=>selectBundle(r.bundleId)} style={{ borderTop: '1px solid #e5e7eb', cursor:'pointer', background: selected? '#eef2ff':'transparent' }} title="Click to view details">
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

  const FindingList: React.FC = () => {
  const { results, selectedBundleId } = useExtStore((s:any)=>({ results: s.results, selectedBundleId: s.selectedBundleId }));
  const res = results.find((r:any)=>r.bundleId===selectedBundleId) || results[0];
    if (!res) return null;
    const TITLE_OVERRIDES: Record<string,string> = {
      iabWeight: 'Weight Budgets',
      iabRequests: 'Initial Requests',
    };
    return (
      <div style={{ display:'grid', gap: 8 }}>
      {res.findings.map((f:any)=> (
        <div key={f.id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:8, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div>{badge(f.severity)}</div>
            <div style={{ fontWeight:600 }}>{TITLE_OVERRIDES[f.id] || f.title}</div>
          </div>
          <ul style={{ margin:'6px 0 0 18px', fontSize:12 }}>
            {f.messages.map((m:string, i:number)=>(<li key={i}>{m}</li>))}
          </ul>
          {f.offenders?.length>0 && (
            <details style={{ marginTop:6 }}>
              <summary style={{ cursor:'pointer', fontSize:12, color:'#4b5563' }}>{f.severity==='PASS' ? 'Details' : 'Offenders'} ({f.offenders.length})</summary>
                <ul style={{ fontFamily:'monospace', fontSize:11, marginTop:6, background:'#f9fafb', padding:6, borderRadius:6, maxHeight:160, overflow:'auto' }}>
                  {f.offenders.map((o:any,i:number)=>(<li key={i}>{o.path}{o.detail?` â€” ${o.detail}`:''}{typeof o.line==='number'?` (line ${o.line})`:''}</li>))}
                </ul>
              </details>
          )}
          <div style={{ position:'absolute', right:8, top:8 }}>
            <HelpIcon checkId={f.id} />
          </div>
        </div>
      ))}
      </div>
    );
  };

const th: React.CSSProperties = { textAlign:'left', padding: 8, whiteSpace:'nowrap' };
const td: React.CSSProperties = { padding: 8, verticalAlign:'top' };

function badge(s: 'PASS'|'WARN'|'FAIL'|string){
  const bg = s==='FAIL'?'#dc2626': s==='WARN'? '#d97706' : '#16a34a';
  return <span style={{ display:'inline-block', padding:'2px 8px', borderRadius:999, color:'#fff', background:bg, fontSize:11, fontWeight:700 }}>{s}</span>;
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
      <button onClick={downloadOriginal} style={{ padding:'6px 10px', borderRadius:6, background:'#e5e7eb', fontSize:12, fontWeight:600 }}>Download Original</button>
      <button onClick={openPrintable} style={{ padding:'6px 10px', borderRadius:6, background:'#e5e7eb', fontSize:12, fontWeight:600 }}>Open Printable Report</button>
      <button onClick={shareLink} style={{ padding:'6px 10px', borderRadius:6, background:'#e5e7eb', fontSize:12, fontWeight:600 }}>Copy Share Link</button>
    </div>
  );
};

function buildPrintableHTML(res: any): string {
  const rows = res.findings.map((f:any)=> `<tr><td>${esc(f.title)}</td><td>${esc(f.severity)}</td><td>${esc(f.messages.join(' | '))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset='utf-8'><title>Audit Report</title>
  <style> body{font-family:system-ui,sans-serif; padding:16px;} h1{font-size:18px} table{width:100%;border-collapse:collapse;font-size:12px} th,td{padding:6px;border-top:1px solid #e5e7eb;text-align:left} th{background:#f3f4f6}</style>
  </head><body>
  <h1>Audit Report</h1>
  <div style='margin-bottom:8px; font-size:12px'>Bundle: ${esc(res.bundleName)} â€¢ Status: ${esc(res.summary.status)}</div>
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
  indexFile: 'index.html presence at root.\n\nWhy it matters: many ad servers require index.html; missing it blocks ingestion.',
  hostedSize: 'Total uncompressed size of files.\n\nWhy it matters: large payloads exceed ad server caps and may be auto-throttled.',
  cpuUsage: 'Long tasks total (first 3s) budget.\n\nWhy it matters: high CPU usage triggers heavy-ad rules and throttles delivery.',
  memoryUsage: 'Peak JS heap usage budget.\n\nWhy it matters: memory spikes crash host pages and get creatives blacklisted.',
  perfHeuristics: 'CPU jitter and heap usage heuristic.\n\nWhy it matters: unstable performance leads to partner rejections and restarts.',
  syntaxErrors: 'Uncaught runtime errors during preview.\n\nWhy it matters: crashing scripts show blanks and result in automatic takedowns.',
  docWrite: 'document.write calls used.\n\nWhy it matters: document.write is blocked in most modern ad slots, preventing any render.',
  jquery: 'jQuery presence detected.\n\nWhy it matters: heavy frameworks inflate payloads and are banned in many lightweight placements.',
  backup: 'Backup image presence (heuristic).\n\nWhy it matters: without a backup image, fallback delivery fails and impressions are lost.',
  hostedCount: 'Count of files in bundle.\n\nWhy it matters: excessive files complicate QA and can push weight budgets over limits.',
  fileTypes: 'File types outside a conservative allowlist.\n\nWhy it matters: unusual file types trip security scans and block approvals.',
  creativeBorder: 'Presence of border styles (heuristic).\n\nWhy it matters: missing borders violate spec requirements for publisher separation.',
  creativeRendered: 'Render activity observed by probe.\n\nWhy it matters: confirming render ensures the creative will not serve blank in production.',
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
    <span style={{ position:'relative', display:'inline-block' }}>
      <button
        type="button"
        aria-label={`Help for ${checkId}`}
        onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)} onClick={()=>setOpen(o=>!o)}
        style={{
          width:20,
          height:20,
          borderRadius:999,
          background:'#f8fafc',
          color:'#334155',
          fontSize:12,
          fontWeight:800,
          display:'inline-flex',
          alignItems:'center',
          justifyContent:'center',
          border:'1px solid #cbd5e1',
          boxShadow:'0 1px 2px rgba(0,0,0,0.06)'
        }}
      >?</button>
      {open && (
        <div role="tooltip" style={{ position:'absolute', zIndex:10, right:0, top:20, width:240, background:'#111827', color:'#fff', padding:8, borderRadius:6, fontSize:11, boxShadow:'0 4px 12px rgba(0,0,0,0.15)', whiteSpace:'pre-line' }}>
          {desc}
        </div>
      )}
    </span>
  );
};






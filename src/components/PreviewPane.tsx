import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAppStore } from '../state/useStore';
import { buildPreview } from '../logic/preview';

interface TabDef { key: string; label: string; }
const tabs: TabDef[] = [
  { key: 'preview', label: 'Preview' },
  { key: 'source', label: 'Source' },
  { key: 'assets', label: 'Assets' },
  { key: 'json', label: 'JSON' },
];

export const PreviewPane: React.FC = () => {
  const { results, selectedBundleId } = useAppStore(s => ({ results: s.results, selectedBundleId: s.selectedBundleId }));
  const bundleResult = results.find(r => r.bundleId === selectedBundleId) || results[0];
  const [tab, setTab] = useState<string>('preview');
  const [html, setHtml] = useState<string>('');
  const [blobMap, setBlobMap] = useState<Record<string,string>>({});
  const [original, setOriginal] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
   const [clickUrl, setClickUrl] = useState<string | null>(null); 
  const [debug, setDebug] = useState<string[]>([]); 
  const [handshake, setHandshake] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false); // Only user actions should open
  const [lastMeta, setLastMeta] = useState<any>(null);
  const [iframeHeight, setIframeHeight] = useState<number>(800); // start taller
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const bundle = useAppStore(s => s.bundles.find(b => b.id === bundleResult?.bundleId));

  // Build preview when bundle or primary changes
  useEffect(() => {
  if (!bundleResult || !bundleResult.primary || !bundle) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
  if (!bundleResult.primary) return;
  const built = await buildPreview(bundle, bundleResult.primary.path);
        if (cancelled) return;
        setHtml(built.html);
        setOriginal(built.originalHtml);
        setBlobMap(built.blobMap);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to build preview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; /* TODO: revoke blob URLs if needed */ };
  }, [bundleResult?.bundleId, bundleResult?.primary?.path, bundle]);

  // Listen for postMessage from iframe
  useEffect(() => {
     function handler(ev: MessageEvent) { 
       const d = ev?.data; 
       if (!d) return; 
       if (d.type === 'creative-click') { 
         if (d.meta?.handshake) { 
           setHandshake(true); 
           const meta = d.meta || {}; 
           setDebug(prev => [ `handshake: clickTagPresent=${meta.clickTagPresent} length=${meta.clickTagLength}`, ...prev ].slice(0,20)); 
           if (d.url) { 
             // Capture url silently (don't open modal automatically) 
             setClickUrl(d.url); 
           } 
           return; 
         } 
         // Capture subsequent programmatic reports silently; only user clicks (handled in DOM listener) open modal
         setClickUrl(d.url || ''); 
         setLastMeta(d.meta || {}); 
         setDebug(prev => [`async capture: ${d.url || '(empty)'} source=${d.meta?.source} empty=${d.meta?.empty}`, ...prev].slice(0,20)); 
       } else if (d.type === 'creative-click-debug') { 
         setDebug(prev => [`debug: ${d.error}`, ...prev].slice(0,20)); 
       } 
     } 
     window.addEventListener('message', handler); 
     return () => window.removeEventListener('message', handler); 
  }, []);

  const assetEntries = useMemo(() => Object.entries(blobMap).sort(), [blobMap]);
  if (!bundleResult) return <div className="text-xs text-gray-500">No bundle selected.</div>;
  if (!bundleResult.primary) return <div className="text-xs text-gray-500">No primary HTML detected.</div>;

  return (
    <div className="flex flex-col h-full border rounded bg-white">
      <div className="flex border-b text-xs">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 font-medium focus-ring transition ${tab === t.key ? 'bg-gray-100 border-b-2 border-blue-600' : 'hover:bg-gray-50'}`}>{t.label}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-3 text-xs">
        {loading && <div>Building preview…</div>}
        {error && <div className="text-red-600">{error}</div>}
        {!loading && !error && tab === 'preview' && (
          <div className="relative">
            <iframe
              ref={iframeRef}
              title="Creative Preview"
              sandbox="allow-scripts allow-same-origin allow-popups"
              className="w-full border"
              style={{ height: iframeHeight }}
              srcDoc={html}
              onLoad={() => {
                try {
                  const iframe = iframeRef.current;
                  if (!iframe) return;
                  const win = iframe.contentWindow;
                  const doc = win?.document;
                  if (!doc) return;
                  setDebug(prev => ['iframe load listener attached', ...prev].slice(0,20));
                  // Auto-size function
                  const resize = () => {
                    try {
                      const body = doc.body;
                      const newH = Math.min(Math.max(body.scrollHeight, 800), 1400); // clamp 800-1400
                      setIframeHeight(h => (Math.abs(h - newH) > 10 ? newH : h));
                    } catch {}
                  };
                  resize();
                  // Observe mutations to adjust height dynamically
                  const mo = new MutationObserver(() => { requestAnimationFrame(resize); });
                  mo.observe(doc.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
                  // Also poll a few times for late assets/animations
                  let resizePolls = 0;
                  const resizeInterval = setInterval(() => { resizePolls++; resize(); if (resizePolls > 10) clearInterval(resizeInterval); }, 500);
                  // Cleanup when iframe reloads
                  iframe.addEventListener('load', () => { try { mo.disconnect(); clearInterval(resizeInterval); } catch {} });
          function extractClick(e: Event): string | null {
                    try {
            if (!doc) return null;
            let target = e.target as HTMLElement | null;
            while (target && target !== doc.body) {
                        if (target instanceof HTMLAnchorElement && target.href) {
                          return target.getAttribute('href') || target.href;
                        }
                        target = target.parentElement;
                      }
                      const g: any = win;
                      if (g.clickTag && typeof g.clickTag === 'string') return g.clickTag;
                      if (g.clickTAG && typeof g.clickTAG === 'string') return g.clickTAG;
                      return null;
                    } catch { return null; }
                  }
                  doc.addEventListener('click', ev => {
                    const url = extractClick(ev);
                    ev.preventDefault();
                    if (url) {
                      setClickUrl(url);
                      setDebug(prev => [`user click captured: ${url}`, ...prev].slice(0,20));
                      setShowModal(true); // explicit user click triggers modal
                    } else {
                      setDebug(prev => ['user click with no identifiable URL (modal suppressed)', ...prev].slice(0,20));
                    }
                  }, true);
                  // Hook window.open to catch programmatic opens
                  try {
                    const originalOpen = (win as any).open;
                    (win as any).open = function(url: any, ...rest: any[]) {
                      if (typeof url === 'string') {
                        setClickUrl(url); // silent capture
                        setDebug(prev => [`window.open intercepted (silent): ${url}`, ...prev].slice(0,20));
                      }
                      return originalOpen && originalOpen.apply(this, [url, ...rest]);
                    };
                    setDebug(prev => ['window.open hook installed', ...prev].slice(0,20));
                  } catch {}
                  // Poll for clickTag presence for debugging
                  let polls = 0;
                  const poll = setInterval(() => {
                    polls++;
                    try {
                      const g: any = win;
                      if (g && (typeof g.clickTag === 'string' || typeof g.clickTAG === 'string')) {
                        setDebug(prev => [`clickTag detected (poll #${polls})`, ...prev].slice(0,20));
                        if (polls > 5) clearInterval(poll);
                      }
                      if (polls > 50) clearInterval(poll);
                    } catch {}
                  }, 200);
                } catch (e:any) {
                  setDebug(prev => [`iframe onLoad error: ${e.message}`,...prev].slice(0,20));
                }
              }}
            />
            <div className="absolute top-1 right-2 text-[10px] text-gray-700 bg-white/80 backdrop-blur px-2 py-0.5 rounded shadow">
              {handshake ? (clickUrl ? 'Clickthrough captured' : 'Clickthrough: not captured yet') : 'Initializing capture…'}
            </div>
            {(!handshake) && (
              <div className="absolute bottom-1 left-1 text-[10px] text-orange-600 bg-white/80 px-2 py-0.5 rounded shadow">If this stays, injection failed</div>
            )}
            <button
              type="button"
              onClick={() => { setShowModal(true); }}
              className="absolute bottom-1 right-1 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded hover:bg-blue-700"
            >CTURL Status</button>
          </div>
        )}
        {!loading && !error && tab === 'source' && (
            <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-snug">{original}</pre>
        )}
        {!loading && !error && tab === 'assets' && (
          <div className="space-y-1">
            {assetEntries.map(([path, url]) => (
              <div key={path} className="flex items-center justify-between gap-2 group">
                <span className="font-mono break-all">{path}</span>
                <a href={url} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 text-blue-600 hover:underline">open</a>
              </div>
            ))}
            {assetEntries.length === 0 && <div className="text-gray-500">No assets</div>}
          </div>
        )}
        {!loading && !error && tab === 'json' && (
          <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-snug">{JSON.stringify(bundleResult, null, 2)}</pre>
        )}
      </div>
      <div className="border-t bg-gray-50 px-3 py-2 flex items-center justify-between text-[10px] text-gray-600">
        <span>Primary: {bundleResult.primary.path}</span>
        <span>{assetEntries.length} asset blobs</span>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded shadow-lg max-w-md w-full p-4 space-y-3">
            <h3 className="text-sm font-semibold">Clickthrough Status</h3>
            {clickUrl ? (
              <>
                <div className="text-xs break-all font-mono bg-gray-100 p-2 rounded">{clickUrl}</div>
              </>
            ) : (
              <div className="text-xs bg-yellow-50 border border-yellow-300 text-yellow-800 p-2 rounded">
                No clickthrough URL captured. Creative either hasn’t set clickTag yet or uses a runtime macro.
              </div>
            )}
            {lastMeta && (
              <div className="text-[10px] text-gray-500">Source: {lastMeta.source || 'n/a'} {lastMeta.empty ? '(empty capture)' : ''}</div>
            )}
            <div className="flex gap-2 justify-end">
              {clickUrl && <a href={clickUrl} target="_blank" rel="noreferrer" className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">Open</a>}
              {clickUrl && <button onClick={() => { navigator.clipboard.writeText(clickUrl).catch(()=>{}); }} className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300">Copy</button>}
              <button onClick={() => { setShowModal(false); }} className="px-3 py-1 text-xs rounded bg-gray-200 hover:bg-gray-300">Close</button>
            </div>
             {debug.length > 0 && ( 
               <details className="text-[10px]"> 
                 <summary className="cursor-pointer text-gray-500">Debug Log ({debug.length})</summary> 
                 <ul className="mt-1 max-h-32 overflow-auto space-y-0.5"> 
                   {debug.map((l,i) => <li key={i} className="font-mono">{l}</li>)} 
                 </ul> 
               </details> 
             )} 
          </div>
        </div>
      )}
    </div>
  );
};

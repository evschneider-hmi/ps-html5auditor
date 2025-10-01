// copied from extended-app with no changes
import React, { Suspense, useEffect, useMemo, useState } from 'react';
// Lazy-load heavy UI modules so top-level module code doesn't execute until needed
const ExtendedDropZone = React.lazy(() =>
  import('../ui/ExtendedDropZone.tsx').then((m) => ({ default: m.ExtendedDropZone }))
);
const ExtendedResults = React.lazy(() =>
  import('../ui/ExtendedResults.tsx').then((m) => ({ default: m.ExtendedResults }))
);
const TagTester = React.lazy(() =>
  import('../ui/TagTester.tsx').then((m) => ({ default: m.TagTester }))
);
const VastTester = React.lazy(() =>
  import('../ui/VastTester.tsx').then((m) => ({ default: m.VastTester }))
);
const StaticCM360 = React.lazy(() =>
  import('../ui/StaticCM360.tsx').then((m) => ({ default: m.StaticCM360 }))
);
import { useExtStore, type TabKey } from '../state/useStoreExt.ts';
import { decompressFromEncodedURIComponent } from 'lz-string';

export function ExtendedHome() {
  const stripLevel = useMemo(() => {
    try {
      const v = new URLSearchParams(location.search).get('strip');
      return v ? String(v) : '';
    } catch {
      return '';
    }
  }, []);
  const tab = useExtStore(s => (s as any).tab as TabKey);
  const setTab = useExtStore(s => (s as any).setTab as (t: TabKey) => void);
  const [dark, setDark] = useState<boolean>(()=>{
    try { return localStorage.getItem('ext_theme') === 'dark'; } catch { return false; }
  });
  const bundles = useExtStore((s: any) => s.bundles);
  const setResults = useExtStore((s: any) => s.setResults);

  useEffect(()=>{
    // Load shared data from URL hash if available
    try {
      const m = location.hash.match(/#data=([^&]+)/);
      if (m && m[1]) {
        const json = decompressFromEncodedURIComponent(m[1]);
        if (json) {
          const parsed = JSON.parse(json);
          if (parsed && parsed.findings) setResults([parsed]);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(()=>{
    try { localStorage.setItem('ext_theme', dark ? 'dark':'light'); } catch {}
    try {
      const cls = document.body.classList; if (!cls) return;
      if (dark) cls.add('theme-dark'); else cls.remove('theme-dark');
    } catch {}
  }, [dark]);

  // Redirect away from disabled tabs (static, video) if currently selected
  useEffect(()=>{
    if (tab === 'static' || tab === 'video') {
      try { setTab('zip'); } catch {}
    }
  }, [tab, setTab]);

  // Strip level 2: render only the header and theme switch to confirm shell mounts
  if (stripLevel === '2') {
    return (
      <ErrorBoundary>
        <div>
          <header className="header">
            <div className="brand">
              <div className="brand-logo" />
              <div>
                <div className="brand-title">Creative Suite Auditor</div>
                <div className="brand-sub">From Horizon Media’s Platform Solutions team</div>
              </div>
            </div>
            <div className="toolbar">
              <button className="btn primary" onClick={()=>location.reload()}>Restart</button>
              <ThemeSwitch dark={dark} onToggle={()=>setDark(v=>!v)} />
            </div>
          </header>
          <div style={{ padding: 12, fontSize: 12 }}>Shell OK (strip=2). Remove strip or set strip=3 to progressively load UI.</div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        <header className="header">
          <div className="brand">
            <div className="brand-logo" />
            <div>
              <div className="brand-title">Creative Suite Auditor</div>
              <div className="brand-sub">From Horizon Media’s Platform Solutions team</div>
            </div>
          </div>
          <div className="toolbar">
            <button className="btn primary" onClick={()=>location.reload()}>Restart</button>
            <ThemeSwitch dark={dark} onToggle={()=>setDark(v=>!v)} />
          </div>
        </header>

        <nav className="tabs">
          <TabBtn active={tab==='zip'} onClick={() => setTab('zip')}>HTML5</TabBtn>
          <TabBtn active={tab==='vast'} onClick={() => setTab('vast')}>VAST</TabBtn>
          <TabBtn active={tab==='tag'} onClick={() => setTab('tag')}>Ad Tag</TabBtn>
          <TabBtn active={tab==='static'} onClick={() => setTab('static')} disabled>Static</TabBtn>
          <TabBtn active={tab==='video'} onClick={() => setTab('video')} disabled>Video</TabBtn>
        </nav>

        <Suspense fallback={<div style={{ padding: 12, fontSize: 12 }}>Loading module…</div>}>
          {tab === 'zip' && (<ExtendedDropZone mode="zip" />)}
          {tab === 'vast' && (<VastTester />)}
          {tab === 'tag' && (<TagTester />)}
          {tab === 'static' && (<StaticCM360 />)}
          {tab === 'video' && (<ExtendedDropZone mode="video" />)}
        </Suspense>

        {bundles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Suspense fallback={<div style={{ padding: 12, fontSize: 12 }}>Loading results…</div>}>
              <ExtendedResults />
            </Suspense>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

const TabBtn: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ active, onClick, children, disabled }) => (
  <button
    onClick={disabled ? undefined : onClick}
    className={`tab ${active ? 'active' : ''}`}
    disabled={!!disabled}
    aria-disabled={!!disabled}
    style={{ position:'relative', opacity: disabled ? 0.7 : 1, cursor: disabled ? 'not-allowed' : 'pointer', overflow:'hidden' }}
    title={disabled ? undefined : undefined}
  >
    {children}
    {disabled && (
      <span
        aria-hidden
        style={{
          position:'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-20deg)',
          width: '140%',
          height: 10,
          background: 'var(--accent)',
          opacity: 0.18,
          pointerEvents: 'none',
          borderRadius: 2
        }}
      />
    )}
  </button>
);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; err?: any }>{
  constructor(props: any){
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any){ return { hasError: true, err }; }
  componentDidCatch(err: any){ try { console.error('V2 app error:', err); } catch {}
  }
  render(){
    if (this.state.hasError) {
      return (
        <div className="panel" style={{ padding:12 }}>
          <h1 style={{ fontSize:16, fontWeight:700, marginBottom:8 }}>Something went wrong</h1>
          <div style={{ fontSize:12, color:'#fbbf24' }}>
            The UI hit an unexpected error while rendering. Try refreshing or re-uploading the asset.
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

const ThemeSwitch: React.FC<{ dark: boolean; onToggle: () => void }> = ({ dark, onToggle }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light Mode' : 'Dark Mode'}
      className={`switch ${dark ? 'on' : ''}`}
      onClick={onToggle}
    >
      <span className="knob" />
    </button>
  );
};

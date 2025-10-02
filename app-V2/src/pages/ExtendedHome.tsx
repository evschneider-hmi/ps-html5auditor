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
  const betaTooltipId = 'open-beta-tooltip';
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

  // Redirect away from disabled tabs (static, video, tag) if currently selected
  useEffect(()=>{
    if (tab === 'static' || tab === 'video' || tab === 'tag') {
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

        <div className="beta-banner" role="status" aria-describedby={betaTooltipId}>
          <span className="beta-label">OPEN BETA</span>
          <span className="beta-message">Logic is still being tuned. Please review insights with care before sharing or acting on them.</span>
          <button
            type="button"
            className="beta-tooltip"
            aria-describedby={betaTooltipId}
            aria-label="What does open beta mean?"
          >
            <span className="sr-only">Open beta details</span>
            <span className="beta-icon" aria-hidden>ℹ</span>
            <span className="beta-tooltip-text" role="tooltip" id={betaTooltipId}>
              We’re actively fine-tuning the audit logic. Treat every flagged insight as guidance, not a final verdict, and double-check anything critical.
            </span>
          </button>
        </div>

        <nav className="tabs">
          <TabBtn active={tab==='zip'} onClick={() => setTab('zip')}>HTML5</TabBtn>
          <TabBtn active={tab==='vast'} onClick={() => setTab('vast')}>VAST</TabBtn>
          <TabBtn active={tab==='tag'} onClick={() => setTab('tag')} disabled strike>Ad Tag</TabBtn>
          <TabBtn active={tab==='static'} onClick={() => setTab('static')} disabled strike>Static</TabBtn>
          <TabBtn active={tab==='video'} onClick={() => setTab('video')} disabled strike>Video</TabBtn>
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

const TabBtn: React.FC<{
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  strike?: boolean;
}> = ({ active, onClick, children, disabled, strike }) => {
  const showSlash = !!strike || !!disabled;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={`tab ${active ? 'active' : ''}`}
      disabled={!!disabled}
      aria-disabled={!!disabled}
      style={{
        position: 'relative',
        opacity: disabled ? 0.7 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        overflow: 'hidden'
      }}
      title={disabled ? 'Coming soon' : undefined}
    >
      {children}
      {showSlash && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-18deg)',
            width: '150%',
            height: 11,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            opacity: 0.32,
            pointerEvents: 'none',
            borderRadius: 4
          }}
        />
      )}
    </button>
  );
};

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

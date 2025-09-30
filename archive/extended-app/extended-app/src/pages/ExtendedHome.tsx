import React, { useEffect, useState } from 'react';
import { ExtendedDropZone } from '../ui/ExtendedDropZone';
import { ExtendedResults } from '../ui/ExtendedResults';
import { TagTester } from '../ui/TagTester';
import { VastTester } from '../ui/VastTester';
import { useExtStore } from '../state/useStoreExt';
import { decompressFromEncodedURIComponent } from 'lz-string';

import type { TabKey } from '../state/useStoreExt';

export function ExtendedHome() {
  const tab = useExtStore(s => s.tab);
  const setTab = useExtStore(s => s.setTab);
  const [dark, setDark] = useState<boolean>(()=>{
    try { return localStorage.getItem('ext_theme') === 'dark'; } catch { return false; }
  });
  const bundles = useExtStore(s => s.bundles);
  const setResults = useExtStore(s=>s.setResults);

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

  return (
    <ErrorBoundary>
      <div>
        <header className="header">
          <div className="brand">
            <div className="brand-logo" />
            <div>
              <div className="brand-title">HTML5 Creative Auditor — Extended</div>
              <div className="brand-sub">From Horizon Media’s Platform Solutions team</div>
            </div>
          </div>
          <div className="toolbar">
            <button className="btn primary" onClick={()=>location.reload()}>Restart</button>
            <ThemeSwitch dark={dark} onToggle={()=>setDark(v=>!v)} />
          </div>
        </header>

        <nav className="tabs">
          <TabBtn active={tab==='zip'} onClick={() => setTab('zip')}>HTML5 Zip</TabBtn>
          <TabBtn active={tab==='tag'} onClick={() => setTab('tag')}>Ad Tag</TabBtn>
          <TabBtn active={tab==='vast'} onClick={() => setTab('vast')}>VAST</TabBtn>
          <TabBtn active={tab==='video'} onClick={() => setTab('video')}>Video</TabBtn>
          <TabBtn active={tab==='static'} onClick={() => setTab('static')}>Static</TabBtn>
        </nav>

        {tab === 'zip' && (<ExtendedDropZone mode="zip" />)}
        {tab === 'video' && (<ExtendedDropZone mode="video" />)}
  {tab === 'static' && (<ExtendedDropZone mode="image" />)}
        {tab === 'tag' && (<TagTester />)}
        {tab === 'vast' && (<VastTester />)}

        {bundles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <ExtendedResults />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

const TabBtn: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} className={`tab ${active ? 'active' : ''}`}>
    {children}
  </button>
);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; err?: any }>{
  constructor(props: any){
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(err: any){ return { hasError: true, err }; }
  componentDidCatch(err: any){ try { console.error('Extended app error:', err); } catch {}
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
      <span className="icon" aria-hidden="true">{dark ? '🌙' : '☀️'}</span>
      <span className="knob" />
    </button>
  );
};

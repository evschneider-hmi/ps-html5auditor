import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';

function Boot() {
  const [Comp, setComp] = useState<React.ComponentType | null>(null);
  const [err, setErr] = useState<any>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const strip = params.get('strip');
      if (strip === '1') {
        // Diagnostic strip mode: render a minimal shell without importing the full app
        setComp(() => () => (
          <div style={{ padding: 16, fontFamily: 'ui-sans-serif, system-ui' }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Minimal shell loaded</h1>
            <div style={{ fontSize: 12 }}>Add <code>?strip=0</code> (or remove) to load the full app.</div>
          </div>
        ));
        return;
      }
    } catch {}

    // Dynamically import the app so any top-level module errors surface here
    import('./pages/ExtendedHome.tsx')
      .then((m) => {
        setComp(() => m.ExtendedHome);
      })
      .catch((e) => {
        // Surface boot error visibly
        console.error('Failed to load ExtendedHome:', e);
        setErr(e);
      });
  }, []);

  if (err) {
    return (
      <div className="panel" style={{ padding: 12 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Boot error</h1>
        <div style={{ fontSize: 12, color: '#fbbf24' }}>{String(err?.message || err)}</div>
      </div>
    );
  }
  if (!Comp) {
    return (
      <div className="panel" style={{ padding: 12 }}>
        <div style={{ fontSize: 12 }}>Loading app…</div>
      </div>
    );
  }
  const App = Comp as any;
  return (
    <React.StrictMode>
      <div className="app">
        <App />
      </div>
    </React.StrictMode>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<Boot />);

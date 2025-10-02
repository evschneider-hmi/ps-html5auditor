import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import screenshotUrl from './assets/migration-app-preview.png';

function Boot() {
  const [Comp, setComp] = useState<React.ComponentType | null>(null);
  const [err, setErr] = useState<any>(null);
  const overlaySetting = import.meta.env.VITE_SHOW_MIGRATION_OVERLAY;
  const overlayForced = overlaySetting === 'always' || overlaySetting === 'true';
  const overlayBlocked = overlaySetting === 'never' || overlaySetting === 'false';
  const showOverlay = useMemo(() => {
    try {
      if (overlayForced) return true;
      if (overlayBlocked) return false;
      const { hostname, pathname } = window.location;
      const host = hostname.toLowerCase();
      if (host !== 'evschneider-hmi.github.io') return false;
      const normalizedPath = pathname.replace(/\/+$/, '') || '/';
      return normalizedPath === '/' || normalizedPath.startsWith('/ps-html5auditor');
    } catch {
      return false;
    }
  }, [overlayBlocked, overlayForced, overlaySetting]);

  useEffect(() => {
    if (!showOverlay) {
      try {
        document.body.classList.remove('migration-locked');
      } catch {}
      return;
    }
    try {
      document.body.classList.add('migration-locked');
    } catch {}
    return () => {
      try {
        document.body.classList.remove('migration-locked');
      } catch {}
    };
  }, [showOverlay]);

  useEffect(() => {
    if (!showOverlay) return;
    try {
      const { hostname, search } = window.location;
      const host = (hostname || '').toLowerCase();
      if (host !== 'evschneider-hmi.github.io') return;
      const params = new URLSearchParams(search);
      if (params.get('stay') === '1') return;
      window.location.replace('https://creative.hmi-platformsolutions.com/');
    } catch {}
  }, [showOverlay]);

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

    if (overlayForced || showOverlay) {
      setComp(() => null);
      setErr(null);
      return;
    }

    let cancelled = false;
    // Dynamically import the app so any top-level module errors surface here
    import('./pages/ExtendedHome.tsx')
      .then((m) => {
        if (!cancelled) setComp(() => m.ExtendedHome);
      })
      .catch((e) => {
        if (cancelled) return;
        // Surface boot error visibly
        console.error('Failed to load ExtendedHome:', e);
        setErr(e);
      });

    return () => {
      cancelled = true;
    };
  }, [overlayForced, showOverlay]);

  let shell: React.ReactNode;

  if (err) {
    shell = (
      <div className="panel" style={{ padding: 12 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Boot error</h1>
        <div style={{ fontSize: 12, color: '#fbbf24' }}>{String(err?.message || err)}</div>
      </div>
    );
  } else if (!Comp) {
    shell = (
      <div className="panel" style={{ padding: 12 }}>
        <div style={{ fontSize: 12 }}>Loading app…</div>
      </div>
    );
  } else {
    const App = Comp as any;
    shell = <App />;
  }

  return (
    <React.StrictMode>
      <div className="app" data-overlay={showOverlay ? 'true' : undefined} aria-hidden={showOverlay ? 'true' : undefined}>
        {showOverlay ? <MigrationBackdrop /> : shell}
      </div>
      {showOverlay && <MigrationOverlay />}
    </React.StrictMode>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(<Boot />);

function MigrationOverlay() {
  return (
    <div
      className="migration-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="migration-title"
      aria-describedby="migration-message"
    >
      <div className="migration-overlay__panel">
        <div id="migration-title" className="migration-overlay__title">
          We’ve moved!
        </div>
        <div id="migration-message" className="migration-overlay__message">
          This tool now lives at our new home. All auditing logic has shifted with it, so please update your
          bookmarks.
        </div>
        <a
          className="migration-overlay__link"
          href="https://creative.hmi-platformsolutions.com/"
          rel="noopener"
          target="_blank"
        >
          Visit creative.hmi-platformsolutions.com
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z"></path>
            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z"></path>
          </svg>
        </a>
      </div>
    </div>
  );
}

function MigrationBackdrop() {
  return (
    <div className="migration-backdrop">
      <img
        src={screenshotUrl}
        alt="Screenshot of the HTML5 Audit Tool interface."
        className="migration-backdrop__image"
      />
      <div className="migration-backdrop__scrim" aria-hidden="true" />
    </div>
  );
}

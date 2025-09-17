import React, { useEffect, useState } from 'react';
import { ExtendedDropZone } from '../ui/ExtendedDropZone';
import { ExtendedResults } from '../ui/ExtendedResults';
import { TagTester } from '../ui/TagTester';
import { VastTester } from '../ui/VastTester';
import { useExtStore } from '../state/useStoreExt';
import { decompressFromEncodedURIComponent } from 'lz-string';

type TabKey = 'zip' | 'tag' | 'vast' | 'video' | 'image' | 'audio';

export function ExtendedHome() {
  const [tab, setTab] = useState<TabKey>('zip');
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

  return (
    <div style={{ padding: 12, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>HTML5 Creative Auditor — Extended</h1>
      <p style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>Experimental parity build — client-only heuristics.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <TabBtn active={tab==='zip'} onClick={() => setTab('zip')}>HTML5 Zip</TabBtn>
        <TabBtn active={tab==='tag'} onClick={() => setTab('tag')}>Ad Tag</TabBtn>
        <TabBtn active={tab==='vast'} onClick={() => setTab('vast')}>VAST</TabBtn>
        <TabBtn active={tab==='video'} onClick={() => setTab('video')}>Video</TabBtn>
        <TabBtn active={tab==='image'} onClick={() => setTab('image')}>Image</TabBtn>
        <TabBtn active={tab==='audio'} onClick={() => setTab('audio')}>Audio</TabBtn>
      </div>

      {tab === 'zip' && (<ExtendedDropZone mode="zip" />)}
      {tab === 'video' && (<ExtendedDropZone mode="video" />)}
      {tab === 'image' && (<ExtendedDropZone mode="image" />)}
      {tab === 'audio' && (<ExtendedDropZone mode="audio" />)}
      {tab === 'tag' && (<TagTester />)}
      {tab === 'vast' && (<VastTester />)}

      {bundles.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <ExtendedResults />
        </div>
      )}
    </div>
  );
}

const TabBtn: React.FC<{ active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button onClick={onClick} style={{ padding: '6px 10px', borderRadius: 6, background: active ? '#111' : '#e5e7eb', color: active ? '#fff' : '#333', fontSize: 12, fontWeight: 600 }}>
    {children}
  </button>
);

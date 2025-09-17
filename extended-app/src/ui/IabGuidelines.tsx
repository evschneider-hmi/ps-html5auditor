// @ts-nocheck
import React, { useMemo } from 'react';
import { useExtStore } from '../state/useStoreExt';
import specMap from '../iab/specs.json';

export const IabGuidelines: React.FC = () => {
  const { results, selectedBundleId } = useExtStore((s:any)=>({ results: s.results, selectedBundleId: s.selectedBundleId }));
  const current = useMemo(()=> results.find((r:any)=>r.bundleId===selectedBundleId) || results[0], [results, selectedBundleId]);
  const checks = useMemo(()=> (current?.findings||[]).map((f:any)=>({ id: f.id, title: f.title })), [current]);

  return (
    <div style={{ marginTop: 12 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>IAB Guidelines</h3>
      <div style={{ marginTop: 8, display:'grid', gap:6 }}>
        {checks.map(c => {
          const spec = (specMap as any)[c.id] as string | null | undefined;
          return (
            <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, borderBottom:'1px dashed #e5e7eb', paddingBottom:4 }}>
              <div style={{ fontSize:12 }}>
                <span style={{ fontWeight:600 }}>{c.title}</span>
                <span style={{ marginLeft:6, color:'#6b7280' }}>({c.id})</span>
              </div>
              <div style={{ fontSize:12, maxWidth: '60%' }}>
                {spec ? spec : <span style={{ color:'#9ca3af' }}>Not found in PDF</span>}
              </div>
            </div>
          );
        })}
        {checks.length===0 && <div style={{ fontSize:12, color:'#6b7280' }}>No findings to map yet.</div>}
      </div>
    </div>
  );
};

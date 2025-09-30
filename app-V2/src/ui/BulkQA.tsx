import React, { useMemo, useState } from 'react';
import { useExtStore } from '../state/useStoreExt';

// Minimal vendor classifier for table hints
function host(url: string){ try{ return new URL(url).host; }catch{return '';}}
function classify(u: string){ const h = host(u).toLowerCase(); if (!h) return 'Other';
  if (h.includes('doubleclick.net') || h.includes('googlesyndication.com')) return 'CM360';
  if (h.includes('innovid.com') || h.includes('rtr.innovid.com') || h.includes('dvrtr.innovid.com')) return 'Innovid';
  if (h.includes('doubleverify') || h.includes('dv.tech')) return 'DoubleVerify';
  return h.split('.').slice(-2).join('.'); }

function isUrlLine(s: string){ return /^https?:\/\//i.test(s.trim()); }
function looksVastUrl(s: string){ const t = s.trim(); return /^https?:\/\/.+\.(xml)(\?|#|$)/i.test(t) || (/^https?:\/\//i.test(t) && /vast|adtag|adtaguri/i.test(t)); }
function looksVastXml(s: string){ const t = s.trim(); return t.startsWith('<') && /<\s*VAST[\s>]/i.test(t); }

export const BulkQA: React.FC = () => {
  const [bulk, setBulk] = useState('');
  const setVastSeed = useExtStore(s => (s as any).setVastSeed);
  const setTagSeed = useExtStore(s => (s as any).setTagSeed);

  const lines = useMemo(()=> bulk.split(/\r?\n/).map(s=>s.trim()).filter(Boolean), [bulk]);
  const entries = useMemo(()=>{
    return lines.map((raw, idx) => {
      const type = looksVastXml(raw) ? 'VAST XML' : looksVastUrl(raw) ? 'VAST URL' : isUrlLine(raw) ? 'Ad Tag' : 'Other';
      const h = host(raw);
      const vendor = classify(raw);
      const params: Record<string,string> = {};
      try{ const u = new URL(raw); u.searchParams.forEach((v,k)=>{ params[k]=v; }); }catch{}
      return { i: idx+1, type, raw, host: h, vendor, params };
    });
  }, [lines]);

  function openRow(e: any){
    const row = e as any; if (!row) return;
    if (row.type === 'VAST XML' || row.type === 'VAST URL') {
      try { setVastSeed(row.type==='VAST XML' ? { mode:'xml', value: row.raw } : { mode:'url', value: row.raw }); } catch {}
      try { const btn = Array.from(document.querySelectorAll('.tabs .tab')).find(el=> el.textContent?.trim()==='VAST') as HTMLButtonElement|undefined; btn?.click(); } catch {}
    } else if (row.type === 'Ad Tag') {
      try { setTagSeed(row.raw); } catch {}
      try { const btn = Array.from(document.querySelectorAll('.tabs .tab')).find(el=> el.textContent?.trim()==='Ad Tag') as HTMLButtonElement|undefined; btn?.click(); } catch {}
    }
  }

  return (
    <div>
      <div className="panel" style={{ padding:12, marginBottom:12 }}>
        <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Paste VAST URLs/XML and Ad Tags (one per line)</div>
        <textarea value={bulk} onChange={e=>setBulk(e.target.value)} placeholder="Paste one tag per line" style={{ width:'100%', minHeight:120, fontFamily:'monospace', fontSize:12 }} />
      </div>
      <div className="panel" style={{ padding:12 }}>
        <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Parsed Entries ({entries.length})</div>
        <div style={{ overflowX:'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Vendor</th>
                <th>Host</th>
                <th>Key Params</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((r)=> (
                <tr key={r.i}>
                  <td>{r.i}</td>
                  <td>{r.type}</td>
                  <td>{r.vendor}</td>
                  <td>{r.host||'-'}</td>
                  <td style={{ maxWidth:520, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {Object.entries(r.params).slice(0,8).map(([k,v])=> `${k}=${v}`).join('  ')||'-'}
                  </td>
                  <td>
                    <button className="btn" onClick={()=>openRow(r)}>{r.type.startsWith('VAST')? 'Open in VAST' : r.type==='Ad Tag'? 'Open in Ad Tag' : 'Open'}</button>
                  </td>
                </tr>
              ))}
              {entries.length===0 && (
                <tr><td colSpan={6} style={{ fontStyle:'italic', color:'#6b7280' }}>No entries parsed yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

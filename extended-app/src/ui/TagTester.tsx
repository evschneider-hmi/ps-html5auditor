import React, { useEffect, useRef, useState } from 'react';

export const TagTester: React.FC = () => {
  const [tag, setTag] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string[]>([]);
  const iframeRef = useRef<HTMLIFrameElement|null>(null);

  useEffect(()=>{ setErrors([]); setInfo([]); }, [tag]);

  function run() {
    setErrors([]); setInfo([]);
    const doc = `<html><head><meta charset='utf-8'><title>Tag</title></head><body>${tag}</body></html>`;
    const iframe = iframeRef.current; if (!iframe) return;
    iframe.srcdoc = doc;
  }

  useEffect(()=>{
    function onMsg(ev: MessageEvent){
      const d = ev.data; if (!d) return;
      if (d.__tag_test) {
        if (d.kind==='error') setErrors(prev => [...prev, d.text]);
        if (d.kind==='info') setInfo(prev => [...prev, d.text]);
      }
    }
    window.addEventListener('message', onMsg);
    return ()=> window.removeEventListener('message', onMsg);
  }, []);

  const probe = `(()=>{ try{ const p=(m)=>parent.postMessage({__tag_test:1, ...m}, '*');
      const origErr = window.onerror; window.onerror=(msg)=>{ p({kind:'error', text:String(msg)}); if(origErr) try{origErr.apply(this, arguments);}catch{} };
      setTimeout(()=>{ try{ const hasCT = (typeof (window as any).clickTag==='string') || (typeof (window as any).clickTAG==='string'); p({kind:'info', text: 'clickTag present: '+hasCT}); }catch(e){} }, 50);
    }catch(e){ parent.postMessage({__tag_test:1, kind:'error', text:String(e)}, '*'); } })();`;

  return (
    <div>
      <div style={{ display:'grid', gap:6 }}>
        <textarea value={tag} onChange={e=>setTag(e.target.value)} placeholder="Paste your ad tag here" style={{ minHeight:120, fontFamily:'monospace', fontSize:12 }} />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={run} style={{ padding:'6px 10px', borderRadius:6, background:'#111', color:'#fff', fontSize:12, fontWeight:600 }}>Run Tag</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Errors</div>
            <ul style={{ fontFamily:'monospace', fontSize:11, minHeight:80, background:'#f9fafb', padding:6, borderRadius:6 }}>{errors.map((e,i)=>(<li key={i}>{e}</li>))}</ul>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Info</div>
            <ul style={{ fontFamily:'monospace', fontSize:11, minHeight:80, background:'#f9fafb', padding:6, borderRadius:6 }}>{info.map((e,i)=>(<li key={i}>{e}</li>))}</ul>
          </div>
        </div>
        <iframe ref={iframeRef} title="Tag Preview" sandbox="allow-scripts allow-same-origin allow-popups" srcDoc={`<html><body><script>${probe}<\/script></body></html>`} style={{ width:'100%', height:300, border:'1px solid #e5e7eb' }} />
      </div>
    </div>
  );
};


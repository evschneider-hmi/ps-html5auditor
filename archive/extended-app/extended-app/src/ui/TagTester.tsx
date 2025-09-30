import React, { useEffect, useRef, useState } from 'react';

const textareaStyle: React.CSSProperties = {
  minHeight: 120,
  fontFamily: 'monospace',
  fontSize: 12,
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: 8,
};

const listBoxStyle: React.CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 11,
  minHeight: 80,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  padding: 6,
  borderRadius: 6,
  border: '1px solid var(--border)',
};

const frameStyle: React.CSSProperties = {
  width: '100%',
  height: 300,
  border: '1px solid var(--border)',
  borderRadius: 6,
};

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
        <textarea value={tag} onChange={e=>setTag(e.target.value)} placeholder="Paste your ad tag here" style={textareaStyle} />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={run} className="btn primary">Run Tag</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Errors</div>
            <ul style={listBoxStyle}>{errors.map((e,i)=>(<li key={i}>{e}</li>))}</ul>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700 }}>Info</div>
            <ul style={listBoxStyle}>{info.map((e,i)=>(<li key={i}>{e}</li>))}</ul>
          </div>
        </div>
        <iframe ref={iframeRef} title="Tag Preview" sandbox="allow-scripts allow-same-origin allow-popups" srcDoc={`<html><body><script>${probe}<\/script></body></html>`} style={frameStyle} />
      </div>
    </div>
  );
};


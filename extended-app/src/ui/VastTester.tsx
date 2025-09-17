// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from 'react';

type EventRow = { time: string; label: string };

export const VastTester: React.FC = () => {
  const [mode, setMode] = useState<'url'|'xml'>('url');
  const [tagUrl, setTagUrl] = useState<string>('');
  const [xml, setXml] = useState<string>('');
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string[]>([]);
  const [rawXml, setRawXml] = useState<string>('');
  const [trackers, setTrackers] = useState<Record<string, { url: string; firedAt?: string; status?: 'requested'|'ok'|'error' }[]>>({});

  // Preview state
  const videoRef = useRef<HTMLVideoElement|null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [clickThrough, setClickThrough] = useState<string>('');
  const [duration, setDuration] = useState<number|undefined>(undefined);
  const [quartilesDone, setQuartilesDone] = useState<{q25:boolean;q50:boolean;q75:boolean;complete:boolean}>({q25:false,q50:false,q75:false,complete:false});
  const [timeline, setTimeline] = useState<EventRow[]>([]);
  const [requestStart, setRequestStart] = useState<number|undefined>(undefined);
  const [impressionTime, setImpressionTime] = useState<number|undefined>(undefined);
  const [started, setStarted] = useState<boolean>(false);
  const [paused, setPaused] = useState<boolean>(false);
  const [clicked, setClicked] = useState<boolean>(false);

  function log(label: string) {
    const now = new Date();
    const s = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}:${pad3(now.getMilliseconds())}`;
    setTimeline(prev => [...prev, { time: s, label }]);
  }

  function pad2(n:number){ return n<10? `0${n}`: String(n); }
  function pad3(n:number){ return n.toString().padStart(3,'0'); }

  async function loadTag() {
    setErrors([]); setInfo([]); setTimeline([]); setQuartilesDone({q25:false,q50:false,q75:false,complete:false}); setStarted(false); setPaused(false); setClicked(false);
    setMediaUrl(''); setClickThrough(''); setDuration(undefined); setImpressionTime(undefined); setRawXml(''); setTrackers({});
    let xmlText = xml.trim();
    if (mode==='url') {
      if (!/^https?:\/\//i.test(tagUrl.trim())) { setErrors(['Please enter a valid http(s) URL']); return; }
      try {
        setRequestStart(performance.now());
        log('request');
        const resp = await fetch(tagUrl.trim(), { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        xmlText = await resp.text();
        setRawXml(xmlText);
      } catch (e:any) {
        setErrors([`Failed to fetch VAST: ${e.message||String(e)} (CORS may block some tags)`]);
        return;
      }
    }
    if (!xmlText.startsWith('<')) {
      // likely pasted URL in XML box; try fetching
      if (/^https?:\/\//i.test(xmlText)) {
        try {
          setRequestStart(performance.now());
          log('request');
          const resp = await fetch(xmlText, { mode: 'cors' });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          xmlText = await resp.text();
          setRawXml(xmlText);
        } catch (e:any) {
          setErrors([`Failed to fetch VAST: ${e.message||String(e)} (CORS may block some tags)`]);
          return;
        }
      } else {
        setErrors([`Input does not look like XML. Start tag '<' not found.`]);
        return;
      }
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      const perr = doc.querySelector('parsererror');
      if (perr) {
        setErrors([perr.textContent || 'XML parse error']);
        return;
      }
      const root = doc.documentElement.nodeName.toLowerCase();
      if (root !== 'vast') info.push(`Root <${root}>`);
      // Handle Wrapper (one level)
      const wrapperUri = doc.querySelector('VASTAdTagURI, AdTagURI')?.textContent?.trim();
      if (wrapperUri && /^https?:\/\//i.test(wrapperUri)) {
        try {
          log('request');
          const resp = await fetch(wrapperUri, { mode: 'cors' });
          if (resp.ok) {
            const txt = await resp.text();
            setRawXml(txt);
            const wrapped = parser.parseFromString(txt, 'application/xml');
            const werr = wrapped.querySelector('parsererror');
            if (!werr) {
              extract(wrapped);
            } else {
              extract(doc);
            }
          } else {
            extract(doc);
          }
        } catch {
          extract(doc);
        }
      } else {
        extract(doc);
      }
      setInfo([...info]);
    } catch (e:any) {
      setErrors([e.message||'Failed to parse']);
    }
  }

  function extract(doc: Document) {
    // Impression
    const imp = Array.from(doc.querySelectorAll('Impression'));
    info.push(`Impressions: ${imp.length}`);
    // Trackers
    const t: Record<string, { url: string }[]> = {};
    function add(ev: string, url?: string|null) {
      if (!url) return; const u = url.trim(); if (!u) return;
      if (!t[ev]) t[ev] = [];
      if (!t[ev].some(x=>x.url===u)) t[ev].push({ url: u });
    }
    // Impression (also creativeView often mirrors impression)
    Array.from(doc.querySelectorAll('Impression')).forEach(n=> add('impression', n.textContent));
    // Click tracking
    Array.from(doc.querySelectorAll('Linear > VideoClicks > ClickTracking')).forEach(n=> add('click', n.textContent));
    // Tracking events
    Array.from(doc.querySelectorAll('Linear > TrackingEvents > Tracking')).forEach((n:any)=>{
      const ev = (n.getAttribute('event')||'').trim(); add(ev, n.textContent);
    });
    // Normalize common aliases
    if (t['firstQuartile'] && !t['25%']) t['25%'] = t['firstQuartile'];
    if (t['midpoint'] && !t['50%']) t['50%'] = t['midpoint'];
    if (t['thirdQuartile'] && !t['75%']) t['75%'] = t['thirdQuartile'];
    // Save trackers
    const primed: Record<string, { url: string; firedAt?: string; status?: 'requested'|'ok'|'error' }[]> = {};
    Object.keys(t).forEach(k=> { primed[k] = t[k].map(x=>({ url: x.url })); });
    setTrackers(primed);

    // Select first linear media file (prefer mp4)
    const mediaFiles = Array.from(doc.querySelectorAll('Linear MediaFile')) as Element[];
    let chosen: string | undefined;
    let typePref = 0;
    for (const mf of mediaFiles) {
      const url = (mf.textContent||'').trim();
      const type = (mf.getAttribute('type')||'').toLowerCase();
      const score = type.includes('mp4')? 2 : type.includes('webm')? 1 : 0;
      if (url && (chosen===undefined || score>typePref)) { chosen = url; typePref = score; }
    }
    if (!chosen && mediaFiles.length>0) chosen = (mediaFiles[0].textContent||'').trim();
    if (chosen) setMediaUrl(chosen);
    info.push(`MediaFiles: ${mediaFiles.length}${chosen? ' (selected)':''}`);
    // Duration
    const dur = doc.querySelector('Linear > Duration')?.textContent || '';
    const sec = parseDuration(dur);
    if (isFinite(sec)) setDuration(sec);
    // ClickThrough
    const ct = doc.querySelector('Linear > VideoClicks > ClickThrough')?.textContent?.trim() || '';
    setClickThrough(ct);
  }

  useEffect(()=>{
    const v = videoRef.current; if (!v) return;
    let q25=false,q50=false,q75=false,comp=false;
    function onPlay(){ if (!started) { setStarted(true); log('started'); fireEvent('start'); } }
    function onPlaying(){ if (!impressionTime && requestStart!==undefined) { setImpressionTime(performance.now()); log('impression'); fireEvent('impression'); fireEvent('creativeView'); } }
    function onPause(){ setPaused(true); log('pause'); fireEvent('pause'); }
    function onEnded(){ comp=true; setQuartilesDone(s=>({...s, complete:true})); log('complete'); fireEvent('complete'); }
    function onTime(){ try {
      const d = duration || v.duration || 0;
      const t = v.currentTime;
      if (!q25 && d>0 && t >= d*0.25) { q25=true; setQuartilesDone(s=>({...s, q25:true})); log('25%'); fireEvent('firstQuartile'); fireEvent('25%'); }
      if (!q50 && d>0 && t >= d*0.50) { q50=true; setQuartilesDone(s=>({...s, q50:true})); log('50%'); fireEvent('midpoint'); fireEvent('50%'); }
      if (!q75 && d>0 && t >= d*0.75) { q75=true; setQuartilesDone(s=>({...s, q75:true})); log('75%'); fireEvent('thirdQuartile'); fireEvent('75%'); }
    } catch {} }
    v.addEventListener('play', onPlay);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    v.addEventListener('timeupdate', onTime);
    return ()=>{
      v.removeEventListener('play', onPlay);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      v.removeEventListener('timeupdate', onTime);
    };
  }, [duration, started, impressionTime, requestStart]);

  const responseMs = useMemo(()=> (requestStart!==undefined && impressionTime!==undefined) ? Math.round(impressionTime - requestStart) : undefined, [requestStart, impressionTime]);

  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        <button onClick={()=>setMode('url')} style={tabBtn(mode==='url')}>Tag URL</button>
        <button onClick={()=>setMode('xml')} style={tabBtn(mode==='xml')}>VAST XML</button>
      </div>
      {mode==='url' ? (
        <input value={tagUrl} onChange={e=>setTagUrl(e.target.value)} placeholder="https://example.com/path/to/vast.xml" style={{ width:'100%', padding:8, border:'1px solid #e5e7eb', borderRadius:6, fontFamily:'monospace', fontSize:12 }} />
      ) : (
        <textarea value={xml} onChange={e=>setXml(e.target.value)} placeholder="Paste VAST XML or an https URL here" style={{ minHeight:160, width:'100%', fontFamily:'monospace', fontSize:12 }} />
      )}
      <div style={{ marginTop:8 }}><button onClick={loadTag} style={{ padding:'6px 10px', borderRadius:6, background:'#111', color:'#fff', fontSize:12, fontWeight:600 }}>Load</button></div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700 }}>Errors</div>
          <ul style={{ fontFamily:'monospace', fontSize:11, minHeight:80, background:'#f9fafb', padding:6, borderRadius:6 }}>{errors.map((e,i)=>(<li key={i}>{e}</li>))}</ul>
        </div>
        <div>
          <div style={{ fontSize:12, fontWeight:700 }}>Info</div>
          <ul style={{ fontFamily:'monospace', fontSize:11, minHeight:80, background:'#f9fafb', padding:6, borderRadius:6 }}>{info.map((e,i)=>(<li key={i}>{e}</li>))}</ul>
        </div>
      </div>

      {/* Preview */}
      {mediaUrl && (
        <div style={{ marginTop:16 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div>
              <video ref={videoRef} src={mediaUrl} controls muted playsInline style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:6 }} onCanPlay={()=>{ /* allow auto play */ try{ videoRef.current?.play().catch(()=>{});}catch{} }} />
              {clickThrough && (
                <div style={{ marginTop:6 }}>
                  <button onClick={()=>{ setClicked(true); log('click'); fireEvent('click'); window.open(clickThrough, '_blank', 'noopener'); }} style={{ padding:'6px 10px', borderRadius:6, background:'#2563eb', color:'#fff', fontSize:12, fontWeight:600 }}>Open ClickThrough</button>
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, marginBottom:6 }}>Progression</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:6 }}>
                <Step label="request" done={requestStart!==undefined} />
                <Step label="impression" done={impressionTime!==undefined} hint={responseMs? `${responseMs} ms`: undefined} />
                <Step label="started" done={started} />
                <Step label="25%" done={quartilesDone.q25} />
                <Step label="50%" done={quartilesDone.q50} />
                <Step label="75%" done={quartilesDone.q75} />
                <Step label="complete" done={quartilesDone.complete} />
                <Step label="pause" done={paused} />
                <Step label="click" done={clicked} />
              </div>
              <div style={{ fontSize:12, fontWeight:700, marginTop:12 }}>Events</div>
              <div style={{ maxHeight:200, overflow:'auto', border:'1px solid #e5e7eb', borderRadius:6 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'#f3f4f6' }}><th style={th}>Time</th><th style={th}>Event</th></tr></thead>
                  <tbody>
                    {timeline.map((row, i)=>(<tr key={i} style={{ borderTop:'1px solid #e5e7eb' }}><td style={td}>{row.time}</td><td style={td}>{row.label}</td></tr>))}
                    {timeline.length===0 && (<tr><td style={td} colSpan={2}>(no events yet)</td></tr>)}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize:12, fontWeight:700, marginTop:12 }}>Trackers</div>
              <div style={{ maxHeight:220, overflow:'auto', border:'1px solid #e5e7eb', borderRadius:6 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead><tr style={{ background:'#f3f4f6' }}><th style={th}>Event</th><th style={th}>URL</th><th style={th}>Fired At</th><th style={th}>Status</th></tr></thead>
                  <tbody>
                    {Object.keys(trackers).length===0 && (<tr><td style={td} colSpan={4}>(no trackers)</td></tr>)}
                    {Object.entries(trackers).flatMap(([ev, arr])=> arr.map((it,i)=> (
                      <tr key={ev+'-'+i} style={{ borderTop:'1px solid #e5e7eb' }}>
                        <td style={td}>{ev}</td>
                        <td style={{...td, wordBreak:'break-all'}}>{it.url}</td>
                        <td style={td}>{it.firedAt||''}</td>
                        <td style={td}>{it.status||''}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Raw XML */}
      {rawXml && (
        <div style={{ marginTop:16 }}>
          <details open>
            <summary style={{ cursor:'pointer', fontWeight:700, fontSize:12 }}>XML Source (Final)</summary>
            <pre style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'monospace', fontSize:11, lineHeight:1.3, background:'#f9fafb', padding:8, borderRadius:6, border:'1px solid #e5e7eb' }}>{rawXml}</pre>
          </details>
        </div>
      )}
    </div>
  );
};

function parseDuration(hms: string): number {
  const m = hms.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!m) return NaN;
  const hh = parseInt(m[1],10), mm = parseInt(m[2],10), ss = parseInt(m[3],10), ms = m[4]? parseInt(m[4].padEnd(3,'0'),10) : 0;
  return hh*3600 + mm*60 + ss + ms/1000;
}

const th: React.CSSProperties = { textAlign:'left', padding:6, whiteSpace:'nowrap' };
const td: React.CSSProperties = { padding:6, verticalAlign:'top' };
function tabBtn(active:boolean): React.CSSProperties { return { padding:'6px 10px', borderRadius:6, background: active? '#111':'#e5e7eb', color: active? '#fff':'#111', fontSize:12, fontWeight:600 }; }

const Step: React.FC<{ label:string; done?: boolean; hint?: string }> = ({ label, done, hint }) => (
  <div title={hint} style={{ padding:'6px 8px', borderRadius:6, background: done? '#16a34a':'#e5e7eb', color: done? '#fff':'#111', textAlign:'center', fontSize:12, fontWeight:700 }}>{label}</div>
);

function timeNow(): string {
  const now = new Date();
  const s = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}:${String(now.getMilliseconds()).padStart(3,'0')}`;
  return s;
}

function fireUrls(urls: string[]){ urls.forEach(u=>{ try { const img = new Image(); img.onload=()=>{}; img.onerror=()=>{}; img.src = appendCb(u); } catch {} }); }

function appendCb(u: string): string { try { const x = new URL(u); x.searchParams.set('cb', String(Date.now())); return x.toString(); } catch { return u + (u.includes('?')?'&':'?') + 'cb=' + Date.now(); } }

function hostOf(u: string){ try { return new URL(u).host; } catch { return ''; } }

function fireTrackersUpdate(state: Record<string, { url: string; firedAt?: string; status?: 'requested'|'ok'|'error' }[]>, ev: string): Record<string, { url: string; firedAt?: string; status?: 'requested'|'ok'|'error' }[]> {
  const copy: typeof state = JSON.parse(JSON.stringify(state||{}));
  if (!copy[ev]) return copy;
  const ts = timeNow();
  copy[ev] = copy[ev].map(it => it.firedAt ? it : { ...it, firedAt: ts, status: 'requested' });
  return copy;
}

function fireEvent(ev: string){
  // update UI
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  setTrackers(s=>{ const updated = fireTrackersUpdate(s, ev); try { const urls = (updated[ev]||[]).filter(x=>x.status==='requested').map(x=>x.url); fireUrls(urls); } catch {} return updated; });
}

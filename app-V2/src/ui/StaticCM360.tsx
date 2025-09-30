// @ts-nocheck
import React, { useRef, useState } from 'react';

type ImgItem = {
  id: string;
  file: File;
  name: string;
  sizeBytes: number;
  type: string; // mime subtype like 'jpeg','png','gif','webp'
  width?: number;
  height?: number;
  animated?: boolean;
  alerts?: string[];
  url?: string; // object URL
};

const KB = 1024;

function sniffType(bytes: Uint8Array): string {
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg';
  // PNG
  if (bytes.length > 8 && bytes[0]===0x89 && bytes[1]===0x50 && bytes[2]===0x4E && bytes[3]===0x47) return 'png';
  // GIF
  if (bytes.length > 6 && bytes[0]===0x47 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x38 && (bytes[4]===0x39 || bytes[4]===0x37) && bytes[5]===0x61) return 'gif';
  // WebP (RIFF....WEBP)
  if (bytes.length > 12 && bytes[0]===0x52 && bytes[1]===0x49 && bytes[2]===0x46 && bytes[3]===0x46 && bytes[8]===0x57 && bytes[9]===0x45 && bytes[10]===0x42 && bytes[11]===0x50) return 'webp';
  return 'unknown';
}

function detectGifAnimated(bytes: Uint8Array): boolean {
  // Count image separator blocks 0x2C
  let frames = 0;
  for (let i=0; i<bytes.length; i++) {
    if (bytes[i] === 0x2C) { frames++; if (frames>1) return true; }
  }
  return false;
}

function detectPngAnimated(bytes: Uint8Array): boolean {
  // APNG has 'acTL' chunk
  // PNG signature is 8 bytes; then chunks
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = (bytes[p]<<24) | (bytes[p+1]<<16) | (bytes[p+2]<<8) | bytes[p+3];
    const t0 = String.fromCharCode(bytes[p+4], bytes[p+5], bytes[p+6], bytes[p+7]);
    if (t0 === 'acTL') return true;
    p += 12 + Math.max(0, len); // 4 len + 4 type + len data + 4 crc
  }
  return false;
}

function detectWebpAnimated(bytes: Uint8Array): boolean {
  // Look for 'ANIM' chunk
  // RIFF header at 0; chunks follow after 12 bytes
  if (bytes.length < 16) return false;
  let p = 12;
  while (p + 8 <= bytes.length) {
    const fourCC = String.fromCharCode(bytes[p], bytes[p+1], bytes[p+2], bytes[p+3]);
    const size = bytes[p+4] | (bytes[p+5]<<8) | (bytes[p+6]<<16) | (bytes[p+7]<<24);
    if (fourCC === 'ANIM') return true;
    p += 8 + size + (size % 2); // chunks are padded to even
  }
  return false;
}

async function getImageDimensions(file: File): Promise<{width:number;height:number}> {
  return new Promise((resolve, reject) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { try { URL.revokeObjectURL(url); } catch {} ; resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }); };
      img.onerror = () => { try { URL.revokeObjectURL(url); } catch {}; reject(new Error('Failed to decode image')); };
      img.src = url;
    } catch (e) { reject(e); }
  });
}

export const StaticCM360: React.FC = () => {
  const [items, setItems] = useState<ImgItem[]>([]);
  const inputRef = useRef<HTMLInputElement|null>(null);

  async function onFiles(files: FileList|null){
    if (!files || !files.length) return;
    const arr = Array.from(files).filter(f=> /\.(jpe?g|png|gif|webp)$/i.test(f.name));
    const results: ImgItem[] = [];
    for (const f of arr) {
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        const type = sniffType(buf);
        const animated = type==='gif' ? detectGifAnimated(buf) : type==='png' ? detectPngAnimated(buf) : type==='webp' ? detectWebpAnimated(buf) : false;
        const { width, height } = await getImageDimensions(f);
        const url = URL.createObjectURL(f);
  const it: ImgItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, name: f.name, sizeBytes: f.size, type, width, height, animated, url };
  it.alerts = evaluateAlerts(it);
        results.push(it);
      } catch (e:any) {
        const it: ImgItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, file: f, name: f.name, sizeBytes: f.size, type: 'unknown', alerts:[`Failed to analyze: ${e.message||String(e)}`] };
        results.push(it);
      }
    }
    setItems(prev => [...prev, ...results]);
  }

  function evaluateAlerts(it: ImgItem): string[] {
    const alerts: string[] = [];
    // CM360-aligned generic guidance for static display
    if (it.type === 'unknown') alerts.push('Unsupported or unrecognized image format (use JPG, PNG, or non-animated GIF)');
    if (it.type === 'gif' && it.animated) alerts.push('GIF appears animated — use a static JPG/PNG or non-animated GIF for static placements');
    if (['webp'].includes(it.type)) alerts.push('WebP may be unsupported in some ad servers — prefer JPG or PNG for static creatives');
    // Dimensions
    if (it.width && it.height) {
      // filename contains size?
      const m = it.name.match(/(\d{2,4})[xX](\d{2,4})/);
      if (m) {
        const fnW = parseInt(m[1],10), fnH = parseInt(m[2],10);
        if (fnW !== it.width || fnH !== it.height) alerts.push(`Filename size ${fnW}x${fnH} does not match actual ${it.width}x${it.height}`);
      }
    } else {
      alerts.push('Could not determine image dimensions');
    }
    return alerts;
  }

  function removeItem(id: string){
    setItems(prev => prev.filter(x=>x.id!==id));
  }

  function clearAll(){ setItems([]); }

  const recomputed = items.map(it => ({...it, alerts: evaluateAlerts(it)}));

  return (
    <div>
      {/* Drop box style, consistent with VAST/HTML5 tabs */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload Static images"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); void onFiles(e.dataTransfer.files); }}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 12,
          padding: 32,
          minHeight: 320,
          background: 'var(--surface)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 120ms ease, border-color 120ms ease',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Drop images or click anywhere to choose files</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Accept: .jpg, .jpeg, .png, .gif, .webp (multiple allowed)</div>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp,image/*" multiple onChange={e=>void onFiles(e.target.files)} style={{ display:'none' }} />
        </div>
      </div>
      {/* Only show table/actions after files are uploaded; keep initial screen minimal */}
      {recomputed.length > 0 && (
        <div className="panel" style={{ padding:12, marginBottom:12 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <div style={{ fontSize:12, color:'var(--text-2)' }}>
              Guidance: Use JPG or PNG for static creatives. GIF is allowed only if non-animated.
            </div>
            <div style={{ flex:1 }} />
            <div><button className="btn" onClick={clearAll}>Clear</button></div>
          </div>
        </div>
      )}

      {recomputed.length > 0 && (
      <div style={{ overflowX:'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>File</th>
              <th>Format</th>
              <th>Dimensions</th>
              <th>Size</th>
              <th>Animated</th>
              <th>Alerts</th>
              <th>Preview</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recomputed.map(it => (
              <tr key={it.id}>
                <td title={it.name} style={{ maxWidth:260, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{it.name}</td>
                <td>{it.type.toUpperCase()}</td>
                <td>{it.width && it.height ? `${it.width}x${it.height}` : '-'}</td>
                <td>{Math.round((it.sizeBytes||0)/KB)} KB</td>
                <td>{it.animated? 'Yes':'No'}</td>
                <td>
                  {it.alerts && it.alerts.length>0 ? (
                    <details>
                      <summary style={{ cursor:'pointer' }}>{it.alerts.length} issue{it.alerts.length>1?'s':''}</summary>
                      <ul style={{ margin:0, paddingLeft:18 }}>
                        {it.alerts.map((a,i)=>(<li key={i} style={{ color:'#b91c1c' }}>{a}</li>))}
                      </ul>
                    </details>
                  ) : (
                    <span style={{ color:'var(--ok)' }}>OK</span>
                  )}
                </td>
                <td>{it.url ? <img src={it.url} alt="preview" style={{ maxHeight:60, border:'1px solid var(--border)', borderRadius:4 }} /> : '-'}</td>
                <td><button className="btn" onClick={()=>removeItem(it.id)}>Remove</button></td>
              </tr>
            ))}
            
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default StaticCM360;

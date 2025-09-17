import type { ZipBundle, BundleResult, Finding } from '../../../src/logic/types';
type FindingEx = Finding & { tags?: string[] };

// Heuristic host list for measurement pixels
const MEASUREMENT_HOSTS = [
  'doubleclick.net','googletagmanager.com','google-analytics.com','adsrvr.org','everesttech.net','crwdcntrl.net','impactradius','moatads.com','adroll.com','adnxs.com','demdex.net','omtrdc.net'
];

export async function buildExtendedFindings(bundle: ZipBundle, partial: BundleResult, settings: any): Promise<Finding[]> {
  // Use a flexible local array to allow optional debug-only fields, then cast on return
  const out: FindingEx[] = [];
  const files = Object.keys(bundle.files);
  const primary = partial.primary?.path;
  const htmlText = primary ? new TextDecoder().decode(bundle.files[primary]) : '';

  // Dedicated CPU/Memory budgets
  {
    const meta = ((window as any).__audit_last_summary as any) || {};
    if (typeof meta.longTasksMs === 'number') {
      const longMs = Math.round(meta.longTasksMs);
      out.push({
        id: 'cpuUsage',
        title: 'CPU Usage',
        severity: longMs < 500 ? 'PASS' : 'FAIL',
        messages: [`Long tasks in first 3s: ${longMs} ms`, 'Target: < 500 ms'],
        offenders: [],
      });
    }
    if (typeof meta.memoryMB === 'number') {
      const memoryMb = meta.memoryMB;
      const memoryDisplay = Math.round(memoryMb * 10) / 10;
      out.push({
        id: 'memoryUsage',
        title: 'Memory Usage',
        severity: memoryMb < 10 ? 'PASS' : 'FAIL',
        messages: [`Peak JS heap ~${memoryDisplay} MB`, 'Target: < 10 MB'],
        offenders: [],
      });
    }
  }

  // Single-file validators: image / video / audio metadata
  if (files.length === 1) {
    const only = files[0];
    if (/\.(png|jpe?g|gif|webp)$/i.test(only)) {
      try {
  const src = bundle.files[only];
  const copy = new Uint8Array(src.byteLength);
  copy.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
  const blob = new Blob([copy.buffer], { type: guessMime(only) });
        const url = URL.createObjectURL(blob); const img = new Image();
        await new Promise<void>((resolve,reject)=>{ img.onload=()=>resolve(); img.onerror=()=>reject(new Error('img load')); img.src=url; });
        out.push({
          id:'imageMeta',
          title:'Image Metadata',
          severity:'PASS',
          messages:[`Dimensions ${img.naturalWidth}x${img.naturalHeight}`, `Size ${(Math.round((bundle.files[only].byteLength/1024)*10)/10)} KB`],
          offenders: [],
          tags:['debug'],
        });
        URL.revokeObjectURL(url);
      } catch {}
    }
    if (/\.(mp4|webm|ogg|mov)$/i.test(only)) {
      try {
  const src = bundle.files[only];
  const copy = new Uint8Array(src.byteLength);
  copy.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
  const blob = new Blob([copy.buffer], { type: guessMime(only) });
        const url = URL.createObjectURL(blob); const v = document.createElement('video'); v.preload = 'metadata'; v.src = url;
        await new Promise<void>((resolve)=>{ v.onloadedmetadata = ()=>resolve(); setTimeout(()=>resolve(), 3000); });
        out.push({
          id:'videoMeta',
          title:'Video Metadata',
          severity:'PASS',
          messages:[`Dimensions ${v.videoWidth}x${v.videoHeight}`, `Duration ${isFinite(v.duration)?v.duration.toFixed(2):'n/a'}s`, `Size ${(Math.round((bundle.files[only].byteLength/1024)*10)/10)} KB`],
          offenders: [],
          tags:['debug'],
        });
        URL.revokeObjectURL(url);
      } catch {}
    }
    if (/\.(mp3|wav|ogg|m4a)$/i.test(only)) {
      try {
  const src = bundle.files[only];
  const copy = new Uint8Array(src.byteLength);
  copy.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength));
  const blob = new Blob([copy.buffer], { type: guessMime(only) });
        const url = URL.createObjectURL(blob); const a = new Audio(); a.preload='metadata'; a.src=url;
        await new Promise<void>((resolve)=>{ a.onloadedmetadata=()=>resolve(); setTimeout(()=>resolve(), 3000); });
        out.push({
          id:'audioMeta',
          title:'Audio Metadata',
          severity:'PASS',
          messages:[`Duration ${isFinite((a as any).duration)?(a as any).duration.toFixed(2):'n/a'}s`, `Size ${(Math.round((bundle.files[only].byteLength/1024)*10)/10)} KB`],
          offenders: [],
          tags:['debug'],
        });
        URL.revokeObjectURL(url);
      } catch {}
    }
  }

  // Animation Duration (heuristic): scan CSS animation/transition durations
  {
    const offenders: any[] = [];
    const re = /animation-duration\s*:\s*([\d.]+)s|transition-duration\s*:\s*([\d.]+)s/gi;
    let max = 0; let m: RegExpExecArray|null;
    for (const p of files) if (/\.css$/i.test(p) || /\.html?$/i.test(p)) {
      const t = new TextDecoder().decode(bundle.files[p]);
      re.lastIndex = 0; while ((m = re.exec(t))) { const v = parseFloat(m[1]||m[2]||'0'); if (isFinite(v)) { max = Math.max(max, v*1000); offenders.push({ path: p, detail: `duration=${v}s` }); } }
    }
    out.push({ id:'animDuration', title:'Animation Duration', severity:'PASS', messages:[`Max duration ~${Math.round(max)} ms`], offenders });
  }

  // CSS Embedded
  {
    const hasStyleTag = /<style[\s>]/i.test(htmlText);
    const inlineStyles = (htmlText.match(/ style=/gi)||[]).length;
    const severity = (hasStyleTag || inlineStyles>0) ? 'PASS' : 'FAIL';
    out.push({ id:'cssEmbedded', title:'CSS Embedded', severity, messages:[hasStyleTag? 'Style tags present':'', inlineStyles? `${inlineStyles} inline style attributes`:''].filter(Boolean), offenders: []});
  }

    // CSS/JS Minified (heuristic): must be minified (except clickTag snippet)
  {
    let jsMinified=0, cssMinified=0, jsFiles=0, cssFiles=0; const offs:any[]=[];
    for (const p of files) if (/\.(js|css)$/i.test(p)) {
      const t = new TextDecoder().decode(bundle.files[p]);
      const lines = t.split(/\r?\n/);
      const longLines = lines.filter(l => l.length>2000);
      const dense = lines.filter(l => l.length>200 && (l.replace(/\s+/g,'').length/l.length) > 0.98);
      const isMin = longLines.length>0 || dense.length>20;
      if (/\.js$/i.test(p)) jsFiles++; else cssFiles++;
      if (isMin) { (/\.js$/i.test(p)? jsMinified++ : cssMinified++); } else { offs.push({ path:p, detail:'not minified (heuristic)' }); }
    }
    const jsNot = Math.max(0, jsFiles - jsMinified);
    const cssNot = Math.max(0, cssFiles - cssMinified);
    const severity = (jsNot+cssNot)===0 ? 'PASS' : 'FAIL';
    out.push({ id:'minified', title:'CSS/JS Minified', severity, messages:[`JS minified: ${jsMinified}/${jsFiles}`, `CSS minified: ${cssMinified}/${cssFiles}`], offenders: offs });
  }

  // Hosted File Count// Hosted File Count
  {
    const count = files.length; const totalKB = Math.round((partial.totalBytes||0)/102.4)/10;
            out.push({
      id:'hostedCount',
      title:'Hosted File Count',
      severity:'PASS',
      messages:[`Files: ${count}`],
      offenders: [],
      tags:['debug'],
    });
  }
  // Hosted File Size (uncompressed total)
  {
    const totalKB = Math.round((partial.totalBytes||0)/1024);
    const severityHS = totalKB <= 2500 ? 'PASS' : 'FAIL';
    out.push({ id:'hostedSize', title:'Hosted File Size', severity: severityHS as any, messages:[`Uncompressed ${totalKB} KB`, 'Target: <= 2500 KB'], offenders: []});
  }

  // NOTE: Uncompressed/Compressed file size are already reported within the IAB Weight check; omit duplicates here.


  // Dialogs and Modals (alert/confirm/prompt usage)
  {
    const meta = (window as any).__audit_last_summary as any;
    const dcount = meta?.dialogs||0;
        out.push({
      id:'dialogs',
      title:'Dialogs and Modals',
      severity: dcount>0?'FAIL':'PASS',
      messages:[`Count: ${dcount}`],
      offenders: [],
      tags:['debug'],
    });
  }

  // Cookies Dropped & Local Storage
  {
    const meta = (window as any).__audit_last_summary as any;
    const cookieSet = meta?.cookies||0; const ls = meta?.localStorage||0;
        out.push({
      id:'cookies',
      title:'Cookies Dropped',
      severity: cookieSet>0?'FAIL':'PASS',
      messages:[`Cookie sets: ${cookieSet}`],
      offenders: [],
      tags:['debug'],
    });
        out.push({
      id:'localStorage',
      title:'Local Storage',
      severity: ls>0?'FAIL':'PASS',
      messages:[`setItem calls: ${ls}`],
      offenders: [],
      tags:['debug'],
    });
  }

  // DOMContentLoaded & Visual Start timing (probe)
  {
    const meta = (window as any).__audit_last_summary as any;
    const dcl = meta?.domContentLoaded; const visual = meta?.visualStart; const frames = meta?.frames;
    out.push({ id:'timing', title:'Timing Metrics', severity:'PASS', messages:[`DOMContentLoaded ${Math.round(dcl||0)} ms`, `Time to Render ~${Math.round(visual||0)} ms`, `Frames observed ${frames||0}`], offenders: []});
    // Ad Start metric (first visible part appears)
    {
      const has = typeof visual === 'number' && isFinite(visual);
      const sev = has && visual < 500 ? 'PASS' : 'WARN';
      const msg = has ? `Render start ~${Math.round(visual)} ms` : 'Not captured';
      out.push({ id:'timeToRender', title:'Time to Render', severity: sev as any, messages:[msg, 'Target: < 500 ms'], offenders: []});
    }
    if (typeof dcl === 'number') {
      out.push({ id:'domContentLoaded', title:'DOMContentLoaded', severity: dcl<1000? 'PASS':'FAIL', messages:[`DCL ${Math.round(dcl)} ms`, 'Target: < 1000 ms'], offenders: []});
    }
    // Preview diagnostics appended for easier debugging
    const diags: string[] = [];
    if (typeof meta?.rewrites==='number') diags.push(`rewrites=${meta.rewrites}`);
    if (typeof meta?.imgRewrites==='number') diags.push(`img=${meta.imgRewrites}`);
    if (typeof meta?.mediaRewrites==='number') diags.push(`media=${meta.mediaRewrites}`);
    if (typeof meta?.scriptRewrites==='number') diags.push(`script=${meta.scriptRewrites}`);
    if (typeof meta?.linkRewrites==='number') diags.push(`link=${meta.linkRewrites}`);
    if (typeof meta?.setAttrRewrites==='number') diags.push(`attr=${meta.setAttrRewrites}`);
    if (typeof meta?.styleUrlRewrites==='number') diags.push(`style=${meta.styleUrlRewrites}`);
    if (typeof meta?.domImages==='number') diags.push(`domImgs=${meta.domImages}`);
    if (typeof meta?.domBgUrls==='number') diags.push(`domBg=${meta.domBgUrls}`);
    if (typeof meta?.enablerStub==='boolean') diags.push(`enablerStub=${meta.enablerStub}`);
        if (diags.length) {
      out.push({
        id:'previewDiag',
        title:'Preview Diagnostics',
        severity:'PASS',
        messages:[diags.join(' • ')],
        offenders: [],
        tags:['debug'],
      });
    }

  }
  // Measurement Pixels (hosts)
  {
    const offenders: any[] = [];
    for (const r of partial.references||[]) {
      if (r.external) {
        try { const u = new URL(r.url, 'https://x'); if (MEASUREMENT_HOSTS.some(h => u.hostname.toLowerCase().includes(h))) offenders.push({ path: r.from, detail: r.url }); } catch {}
      }
    }
    const count = offenders.length;
    const severityM = count >= 5 ? 'FAIL' : count > 0 ? 'WARN' : 'PASS';
        out.push({
      id:'measurement',
      title:'Measurement Pixels',
      severity: severityM as any,
      messages:[`${count} known tracking references`, 'Target: < 5'],
      offenders,
      tags:['debug'],
    });
  }

  // HTML5 Library Detection (simple signatures)
  {
    const libs: string[] = [];
    const text = files.filter(p=>/\.(js|html?)$/i.test(p)).map(p=> new TextDecoder().decode(bundle.files[p])).join('\n');
    if (/createjs\./i.test(text)) libs.push('CreateJS');
    if (/gsap\(|TweenMax|TweenLite/i.test(text)) libs.push('GSAP');
    if (/pixi\.js/i.test(text)) libs.push('PixiJS');
    if (/jquery|\$\(/i.test(text)) libs.push('jQuery');
    out.push({ id:'html5lib', title:'HTML5 Library', severity: libs.length? 'FAIL':'PASS', messages:[ libs.length? libs.join(', ') : 'None detected' ], offenders: []});
  }

  // Has Video / Iframe Count / Images Optimized (heuristic by extension and size)
  {
    const exts = (p:string)=> p.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]||'';
    const videos = files.filter(p=>/(\.mp4|\.webm|\.ogg|\.mov)$/i.test(p));
    const iframes = (htmlText.match(/<iframe\b/gi)||[]).length;
    const images = files.filter(p=>/(\.png|\.jpe?g|\.gif|\.webp)$/i.test(p));
    const offenders: any[] = [];
    for (const p of images) {
      const size = bundle.files[p].byteLength;
      if (size > 300*1024 && /\.png$/i.test(p)) offenders.push({ path:p, detail:`PNG ${Math.round(size/1024)} KB â€” consider JPEG/WebP` });
    }
        out.push({
      id:'video',
      title:'Has Video',
      severity:'PASS',
      messages:[videos.length ? `${videos.length} video file(s)` : 'No'],
      offenders: videos.map(v => ({ path: v })),
      tags:['debug'],
    });
    out.push({ id:'iframes', title:'Iframe Count', severity: iframes>0?'FAIL':'PASS', messages:[`iframes: ${iframes}`], offenders: []});
        out.push({
      id:'imagesOptimized',
      title:'Images Optimized',
      severity: offenders.length ? 'FAIL' : 'PASS',
      messages:[offenders.length ? `${offenders.length} image(s) could be optimized` : 'OK'],
      offenders,
      tags:['debug'],
    });
  }

  // Index File Check
  if (bundle && bundle.files) {
    const hasIndex = Object.keys(bundle.files).some(p => /^index\.html?$/i.test(p.split('/').pop()||''));
    out.push({ id:'indexFile', title:'Index File Check', severity: hasIndex? 'PASS':'FAIL', messages:[ hasIndex? 'index.html present':'index.html not found at root' ], offenders: []});
  }

  // NOTE: Click Tag presence is covered by the built-in 'clickTags' check; omit duplicate static scan here.

  // Memory / CPU Heuristics
  {
    const meta = (window as any).__audit_last_summary as any;
    const mem = meta?.memoryMB; const cpu = meta?.cpuScore;
    const memMsg = (typeof mem==='number')? `Heap ~${mem.toFixed(1)} MB` : 'Heap n/a';
    const cpuMsg = (typeof cpu==='number')? `CPU jitter score ${cpu.toFixed(2)}` : 'CPU n/a';
    const sev = (mem>128 || cpu>0.5) ? 'PASS' : 'FAIL';
    out.push({ id:'perfHeuristics', title:'CPU/Memory Heuristics', severity: sev as any, messages: [memMsg, cpuMsg], offenders: [] });
  }

  // Syntax Errors â€” from probe
  {
    const meta = (window as any).__audit_last_summary as any;
    const errors = meta?.errors || 0;
    out.push({ id:'syntaxErrors', title:'Syntax Errors', severity: errors>0?'FAIL':'PASS', messages:[`Uncaught errors: ${errors}`], offenders: []});
  }

  // document.write & jQuery usage
  {
    const meta = (window as any).__audit_last_summary as any;
    const docw = meta?.documentWrites||0; const jq = meta?.jquery||false;
    out.push({ id:'docWrite', title:'Uses document.write()', severity: docw>0?'FAIL':'PASS', messages:[`Calls: ${docw}`], offenders: []});
    out.push({ id:'jquery', title:'Uses jQuery', severity: jq?'WARN':'PASS', messages:[jq?'Detected':'Not detected'], offenders: []});
  }

  // Backup Ad Found â€” heuristic: presence of single image file or a file named backup.*
  {
    const img = Object.keys(bundle.files).filter(p=>/(^|\/)backup\.(png|jpe?g|gif)$/i.test(p) || /\.(png|jpe?g|gif)$/i.test(p));
    const severity = img.length? 'PASS':'WARN';
    out.push({ id:'backup', title:'Backup Ad Found', severity, messages:[ img.length? `${img[0]}` : 'No obvious backup image found' ], offenders: img.slice(0,5).map(p=>({ path:p }))});
  }

  // File Types Allowed â€” conservative allow-list
  {
    const ALLOW = new Set(['.html','.htm','.js','.css','.json','.png','.jpg','.jpeg','.gif','.webp','.svg','.woff','.woff2','.ttf','.otf','.eot','.mp4','.webm','.ogg','.mp3','.wav','.m4a','.txt']);
    const offenders:any[] = [];
    for (const p of files) {
      const ext = (p.toLowerCase().match(/\.[a-z0-9]+$/)?.[0])||'';
      if (ext && !ALLOW.has(ext)) offenders.push({ path:p, detail:`ext=${ext}` });
    }
    out.push({ id:'fileTypes', title:'File Types Allowed', severity: offenders.length? 'WARN':'PASS', messages:[ offenders.length? `${offenders.length} non-typical file type(s)` : 'OK' ], offenders });
  }

  // Creative Border â€” detect CSS border: ... or four 1px edge lines (common in GWD)
  {
    let hasBorder = /\bborder\s*:\s*\d+px\s+(solid|dashed|double)\b/i.test(htmlText);
    let messages: string[] = [];
    const offenders: any[] = [];
    if (hasBorder) messages.push('Detected via CSS border');
    // Detect absolute 1px div lines at top/bottom/left/right edges
    try {
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const nodes = Array.from(doc.querySelectorAll('[style]')) as HTMLElement[];
      function parseStyle(s: string): Record<string, string> {
        const map: Record<string, string> = {};
        s.split(';').forEach(part => {
          const [k, v] = part.split(':');
          if (!k || !v) return;
          map[k.trim().toLowerCase()] = v.trim().toLowerCase();
        });
        return map;
      }
      function isZero(val?: string){ if(!val) return false; return /^0(px|)$/.test(val) || val === '0'; }
      function isPx1(val?: string){ if(!val) return false; return /^1(px)?$/.test(val); }
      function isFull(val?: string){ if(!val) return false; return /^100%$/.test(val); }
      function isVisibleColor(val?: string){ if(!val) return false; return !/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(val); }
      let top=false,bottom=false,left=false,right=false;
      for (const el of nodes) {
        const st = parseStyle(el.getAttribute('style') || '');
        const bg = st['background-color'] || st['background'] || '';
        const pos = st['position'] || '';
        if (pos !== 'absolute') continue;
        // top line
        if (isZero(st['top']) && isZero(st['left']) && isFull(st['width']) && isPx1(st['height']) && isVisibleColor(bg)) { top = true; offenders.push({ path: '(inline)', detail: 'top line via absolute 1px div' }); continue; }
        // bottom line
        if (isZero(st['bottom']) && isZero(st['left']) && isFull(st['width']) && isPx1(st['height']) && isVisibleColor(bg)) { bottom = true; offenders.push({ path: '(inline)', detail: 'bottom line via absolute 1px div' }); continue; }
        // left line
        if (isZero(st['left']) && isZero(st['top']) && isFull(st['height']) && isPx1(st['width']) && isVisibleColor(bg)) { left = true; offenders.push({ path: '(inline)', detail: 'left line via absolute 1px div' }); continue; }
        // right line
        if (isZero(st['right']) && isZero(st['top']) && isFull(st['height']) && isPx1(st['width']) && isVisibleColor(bg)) { right = true; offenders.push({ path: '(inline)', detail: 'right line via absolute 1px div' }); continue; }
      }
      const count = [top,bottom,left,right].filter(Boolean).length;
      if (count >= 3) { hasBorder = true; messages.push(`Detected via ${count} edge lines`); }
    } catch {}
    const severity = hasBorder ? 'PASS' : 'FAIL';
    out.push({ id:'creativeBorder', title:'Creative Border', severity: severity as any, messages: messages.length? messages : ['Not detected (heuristic)'], offenders: severity==='PASS' ? [] : offenders });
  }

  // Creative Rendered â€” heuristic using probe frames/mutations + static fallback
  {
    const meta = (window as any).__audit_last_summary as any;
    const okProbe = (meta?.frames||0) > 0 || (typeof meta?.visualStart === 'number');
    const okStatic = !!(htmlText && /<body[\s>]/i.test(htmlText));
    const ok = okProbe || okStatic;
    const messages: string[] = [];
    if (okProbe) messages.push('Rendered (probe)');
    else if (okStatic) messages.push('Rendered (static HTML)');
    else messages.push('No render signal captured');
    out.push({ id:'creativeRendered', title:'Creative Rendered', severity: ok? 'PASS':'FAIL', messages, offenders: []});
  }

  // Network Requests (dynamic at runtime, fetch/xhr)
  {
    const meta = (window as any).__audit_last_summary as any;
    const dyn = meta?.network||0;
        out.push({
      id:'networkDynamic',
      title:'Network Requests (Dynamic)',
      severity: dyn>0 ? 'WARN' : 'PASS',
      messages:[`Runtime requests: ${dyn}`],
      offenders: [],
      tags:['debug'],
    });
  }

  // Heavy Ad Intervention (Risk) â€” simple heuristic
  {
    const initialKB = (partial.initialBytes||0)/1024; const cpu = (window as any).__audit_last_summary?.cpuScore||0;
    const risky = initialKB>4000 || cpu>0.5;
        out.push({
      id:'heavyAdRisk',
      title:'Heavy Ad Intervention (Risk)',
      severity: risky ? 'WARN' : 'PASS',
      messages:[`InitialKB ${initialKB.toFixed(1)}, CPU ${cpu.toFixed?cpu.toFixed(2):cpu}`],
      offenders: [],
      tags:['debug'],
    });
  }


  return out as Finding[];
}

function buildPatterns(arr: any): RegExp[] {
  const out: RegExp[] = [];
  if (!Array.isArray(arr)) return out;
  for (const s of arr) {
    if (typeof s !== 'string') continue;
    try {
      if (s.startsWith('/') && s.lastIndexOf('/') > 0) {
        const body = s.slice(1, s.lastIndexOf('/'));
        const flags = s.slice(s.lastIndexOf('/') + 1);
        out.push(new RegExp(body, flags));
      } else {
        out.push(new RegExp(s, 'i'));
      }
    } catch { /* ignore bad patterns */ }
  }
  return out;
}

function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg')||n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.mp4')) return 'video/mp4';
  if (n.endsWith('.webm')) return 'video/webm';
  if (n.endsWith('.ogg')) return 'video/ogg';
  if (n.endsWith('.mov')) return 'video/quicktime';
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.m4a')) return 'audio/mp4';
  return 'application/octet-stream';
}










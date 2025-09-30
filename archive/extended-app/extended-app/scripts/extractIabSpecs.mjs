import fs from 'fs';
import path from 'path';
import https from 'https';
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const PDF_URL = 'https://iabtechlab.com/wp-content/uploads/2016/04/HTML5forDigitalAdvertising2.0.pdf';

const CHECKS = [
  'iabWeight', 'iabRequests', 'creativeBorder', 'httpsOnly', 'externalResources',
  'video', 'iframes', 'clickTags', 'fileTypes', 'backup',
];

const KEYSETS = {
  iabWeight: [ ['initial', 'load'], ['polite'], ['zip', 'compressed'], ['kb'] ],
  iabRequests: [ ['http', 'requests'], ['file', 'requests'], ['request', 'cap'] ],
  creativeBorder: [ ['border'], ['1px'], ['keyline'] ],
  httpsOnly: [ ['https'], ['secure', 'ssl'], ['tls'] ],
  externalResources: [ ['third', 'party'], ['external', 'resource'] ],
  video: [ ['video'], ['host', 'initiated'], ['polite', 'load'] ],
  iframes: [ ['iframe'] ],
  clickTags: [ ['clicktag'], ['click', 'through'] ],
  fileTypes: [ ['file', 'type'], ['mime'] ],
  backup: [ ['backup', 'image'], ['fallback'] ],
};

function download(url){
  return new Promise((resolve, reject)=>{
    https.get(url, (res)=>{
      if (res.statusCode !== 200) { reject(new Error('HTTP '+res.statusCode)); return; }
      const chunks=[]; res.on('data', d=>chunks.push(d)); res.on('end', ()=>resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function lines(text){
  return String(text||'').replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
}

function findSpecs(text){
  const ls = lines(text.toLowerCase());
  const out = {};
  for (const id of CHECKS) {
    const keysets = KEYSETS[id] || [];
    let foundIdx = -1;
    for (let i=0;i<ls.length;i++){
      const L = ls[i];
      const hit = keysets.some(keys => keys.every(k => L.includes(k)));
      if (hit) { foundIdx = i; break; }
    }
    if (foundIdx >= 0) {
      // Capture a small window around the line as the exact spec text (up to ~2 lines)
      const raw = lines(text);
      const start = Math.max(0, foundIdx-1);
      const end = Math.min(raw.length-1, foundIdx+1);
      const snippet = raw.slice(start, end+1).join(' ').replace(/\s+/g,' ').trim();
      out[id] = snippet;
    } else {
      out[id] = null;
    }
  }
  return out;
}

async function main(){
  const buf = await download(PDF_URL);
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
  const pdf = await loadingTask.promise;
  let full = '';
  for (let i=1;i<=pdf.numPages;i++){
    try { const page = await pdf.getPage(i); const tc = await page.getTextContent(); full += '\n' + (tc.items||[]).map(it=>it.str||'').join(' '); } catch {}
  }
  const specs = findSpecs(full||'');
  const target = path.resolve(process.cwd(), 'src', 'iab', 'specs.json');
  const dir = path.dirname(target);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(target, JSON.stringify(specs, null, 2));
  console.log('Wrote', target);
}

main().catch(e=>{ console.error(e); process.exit(1); });


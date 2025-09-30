import React, { useRef, useState } from 'react';
import JSZip from 'jszip';
import { useExtStore, type InputMode } from '../state/useStoreExt';
import type { ZipBundle } from '../../../src/logic/types';

export const ExtendedDropZone: React.FC<{ mode: InputMode }>= ({ mode }) => {
  const addBundle = useExtStore(s => s.addBundle);
  const setTab = useExtStore(s => s.setTab);
  const setVastAutoPayload = useExtStore(s => s.setVastAutoPayload);
  const inputRef = useRef<HTMLInputElement|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');

  const accept = mode === 'zip' ? '.zip' : mode === 'video' ? 'video/*' : mode === 'image' ? 'image/*' : 'audio/*';

  async function handleFiles(files: FileList|null) {
    if (!files || !files.length) return;
    setBusy(true); setError('');
    try {
      const list = Array.from(files);
      for (const f of list) {
        if (mode === 'zip') {
          if (!/\.zip$/i.test(f.name)) { setError(prev => prev? prev+"\n"+`${f.name} is not a .zip` : `${f.name} is not a .zip`); continue; }
          const bytes = new Uint8Array(await f.arrayBuffer());
          const zip = await JSZip.loadAsync(bytes);
          const filesRec: Record<string, Uint8Array> = {};
          const lower: Record<string, string> = {};
          const entries = Object.keys(zip.files);
          let hasSheet = false;
          for (const path of entries) {
            const entry = zip.file(path);
            if (!entry || entry.dir) continue;
            const arr = new Uint8Array(await entry.async('uint8array'));
            const norm = path.replace(/^\/+/, '');
            filesRec[norm] = arr;
            lower[norm.toLowerCase()] = norm;
            if (/\.(xlsx|xlsm|xlsb|xls|csv)$/i.test(norm)) hasSheet = true;
          }
          const bundle: ZipBundle = { id: String(Date.now())+Math.random().toString(36).slice(2), name: f.name, bytes, files: filesRec, lowerCaseIndex: lower };
          addBundle({ ...(bundle as any), mode });
          // If this ZIP contains spreadsheet(s), auto-switch to VAST and hand off bytes for parsing there
          if (hasSheet) {
            try { setVastAutoPayload(bytes); } catch {}
            try { setTab('vast'); } catch {}
          }
        } else {
          // non-zip: wrap single file as a pseudo-bundle
          const bytes = new Uint8Array(await f.arrayBuffer());
          const name = f.name;
          const filesMap: Record<string, Uint8Array> = { [name]: bytes };
          const lower: Record<string, string> = { [name.toLowerCase()]: name };
          const bundle: ZipBundle = { id: String(Date.now())+Math.random().toString(36).slice(2), name: f.name, bytes, files: filesMap, lowerCaseIndex: lower };
          addBundle({ ...(bundle as any), mode });
        }
      }
    } catch (e:any) {
      setError(e.message||'Failed to read file');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ border: '1px dashed #999', padding: 12, borderRadius: 8 }} onClick={() => inputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>Drop {mode.toUpperCase()} here or click to browse</div>
      <div style={{ fontSize: 12, color: '#666' }}>Accept: {accept}</div>
      <input ref={inputRef} type="file" accept={accept} multiple={mode==='zip'} onChange={e => void handleFiles(e.target.files)} style={{ display: 'none' }} />
      {busy && <div style={{ fontSize: 12, color: '#333', marginTop: 6 }}>Reading…</div>}
      {error && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>{error}</div>}
    </div>
  );
};

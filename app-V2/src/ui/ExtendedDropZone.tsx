import React, { useId, useRef, useState } from 'react';
import { useExtStore, type InputMode } from '../state/useStoreExt';
import type { ZipBundle } from '../../../src/logic/types';
import { listEntries, findFirstIndexHtml } from '../utils/zip';

export const ExtendedDropZone: React.FC<{ mode: InputMode }> = ({ mode }) => {
  const addBundle = useExtStore((s) => s.addBundle);
  const setTab = useExtStore((s) => (s as any).setTab as (t: any) => void);
  const setVastAutoPayload = useExtStore(
    (s) => (s as any).setVastAutoPayload as (bytes?: Uint8Array) => void,
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputUid = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  const accept =
    mode === 'zip'
      ? '.zip'
      : mode === 'video'
        ? 'video/*'
        : mode === 'image'
          ? 'image/*'
          : 'audio/*';

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    setError('');
    try {
      const list = Array.from(files);
      for (const f of list) {
        if (mode === 'zip') {
          if (!/\.zip$/i.test(f.name)) {
            setError((prev) =>
              prev
                ? prev + '\n' + `${f.name} is not a .zip`
                : `${f.name} is not a .zip`,
            );
            continue;
          }
          const bytes = new Uint8Array(await f.arrayBuffer());
          const entries = await listEntries(f);
          const filesRec: Record<string, Uint8Array> = {};
          const lower: Record<string, string> = {};
          let hasSheet = false;
          for (const entry of entries) {
            if (entry.dir) continue;
            const norm = entry.path.replace(/^\/+/, '');
            const arr = await entry.getData();
            filesRec[norm] = arr;
            lower[norm.toLowerCase()] = norm;
            if (/(\.xlsx|\.xlsm|\.xlsb|\.xls|\.csv)$/i.test(norm)) hasSheet = true;
          }
          const firstIndex = findFirstIndexHtml(entries);
          const bundle: ZipBundle = {
            id: String(Date.now()) + Math.random().toString(36).slice(2),
            name: f.name,
            bytes,
            files: filesRec,
            lowerCaseIndex: lower,
          };
          const preview = firstIndex
            ? { baseDir: firstIndex.baseDir, indexPath: firstIndex.indexPath }
            : undefined;
          addBundle({ ...(bundle as any), mode, preview });
          if (hasSheet) {
            try {
              setVastAutoPayload(bytes);
            } catch {}
            try {
              setTab('vast');
            } catch {}
          }
        } else {
          // non-zip: wrap single file as a pseudo-bundle
          const bytes = new Uint8Array(await f.arrayBuffer());
          const name = f.name;
          const filesMap: Record<string, Uint8Array> = { [name]: bytes };
          const lower: Record<string, string> = { [name.toLowerCase()]: name };
          const bundle: ZipBundle = {
            id: String(Date.now()) + Math.random().toString(36).slice(2),
            name: f.name,
            bytes,
            files: filesMap,
            lowerCaseIndex: lower,
          };
          addBundle({ ...(bundle as any), mode });
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to read file');
    } finally {
      setBusy(false);
    }
  }

  function openFileDialog() {
    if (!inputRef.current) return;
    try {
      inputRef.current.value = '';
    } catch {}
    inputRef.current.click();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Upload ${mode.toUpperCase()} files`}
      data-testid="dropzone"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openFileDialog();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        // Clear input to ensure subsequent same-file selections trigger change
        if (inputRef.current) {
          try { inputRef.current.value = ''; } catch {}
        }
        void handleFiles(e.dataTransfer.files);
      }}
      style={{
        border: '2px dashed var(--border)',
        borderRadius: 12,
        padding: mode === 'zip' ? 32 : 20,
        minHeight: mode === 'zip' ? 320 : 180,
        background: dragOver ? 'var(--surface-2)' : 'var(--surface)',
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        position: 'relative',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background 120ms ease, border-color 120ms ease',
        userSelect: 'none',
      }}
  >
      <style>{`
        @keyframes ext-spinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      {busy && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute',
            top: mode === 'zip' ? 18 : 12,
            right: mode === 'zip' ? 18 : 12,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 999,
            background: 'rgba(99, 102, 241, 0.18)',
            color: '#4338ca',
            boxShadow: '0 8px 18px rgba(79, 70, 229, 0.18)',
            pointerEvents: 'none',
            zIndex: 5,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              border: '3px solid rgba(165, 180, 252, 0.28)',
              borderTopColor: '#7c3aed',
              borderRightColor: '#7c3aed',
              animation: 'ext-spinner 0.9s linear infinite',
            }}
            aria-hidden="true"
          />
          <span>Uploading...</span>
        </div>
      )}
      <div>
        <div
          style={{
            fontSize: mode === 'zip' ? 16 : 14,
            fontWeight: 700,
            marginBottom: 6,
          }}
        >
          Drop {mode.toUpperCase()} here or click anywhere to choose files
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Accept: {accept}
          {mode === 'zip' ? ' (multiple allowed)' : ''}
        </div>
        <div style={{ marginTop: 10 }}>
          <div
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: 'white',
              fontSize: 12,
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            Upload ZIP files
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          id={inputUid}
          data-testid="file-input"
          accept={accept}
          multiple={mode === 'zip'}
          onClick={(e) => {
            try { e.currentTarget.value = ''; } catch {}
          }}
          onChange={(e) => void handleFiles(e.target.files)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            try { e.currentTarget.value = ''; } catch {}
            void handleFiles(e.dataTransfer?.files ?? null);
          }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 5,
          }}
        />
        {error && (
          <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../state/useStore';
import { readZip } from '../logic/zipReader';

export const DropZone: React.FC = () => {
  const addBundle = useAppStore(s => s.addBundle);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const localErrors: string[] = [];
    const added: string[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        const msg = `${file.name} is not a ZIP`;
        localErrors.push(msg);
        continue; // we also show aggregated errors below
      }
      try {
        const bundle = await readZip(file);
        addBundle(bundle);
        added.push(file.name);
      } catch (e: any) {
        localErrors.push(`Failed to read ${file.name}: ${e.message}`);
      }
    }
    if (localErrors.length) alert(localErrors.join('\n'));
    setErrors(localErrors);
    if (added.length) setRecent(prev => [...added, ...prev].slice(0, 5));
  }, [addBundle]);

  const onBrowseClick = () => {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.click();
    }
  };

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded p-8 text-center transition cursor-pointer select-none ${dragOver ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300'}`}
        onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); }}
        onDrop={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={onBrowseClick}
        role="button"
        aria-label="Upload ZIP files"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBrowseClick(); } }}
      >
        <p className="text-sm font-medium mb-2">Drop ZIP files here</p>
        <p className="text-xs text-gray-600">or</p>
        <button
          type="button"
            className="mt-2 inline-flex items-center px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium shadow hover:bg-blue-700 focus-ring"
          onClick={(e) => { e.stopPropagation(); onBrowseClick(); }}
        >Browse Files</button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
          aria-hidden="true"
        />
      </div>
      {(recent.length > 0 || errors.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          {recent.length > 0 && (
            <div>
              <div className="font-semibold mb-1">Recent:</div>
              <ul className="space-y-0.5 max-w-xs">
                {recent.map(r => <li key={r} className="truncate" title={r}>{r}</li>)}
              </ul>
            </div>
          )}
          {errors.length > 0 && (
            <div className="text-fail">
              <div className="font-semibold mb-1">Errors:</div>
              <ul className="space-y-0.5 max-w-xs">
                {errors.map((er,i) => <li key={i} className="truncate" title={er}>{er}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
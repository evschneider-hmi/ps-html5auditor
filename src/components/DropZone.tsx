import React, { useCallback, useState } from 'react';
import { useAppStore } from '../state/useStore';
import { readZip } from '../logic/zipReader';

export const DropZone: React.FC = () => {
  const addBundle = useAppStore(s => s.addBundle);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [recent, setRecent] = useState<string[]>([]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;
    const localErrors: string[] = [];
    const added: string[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        const msg = `${file.name} is not a ZIP`;
        localErrors.push(msg);
        alert(msg);
        continue;
      }
      try {
        const bundle = await readZip(file);
        addBundle(bundle);
        added.push(file.name);
      } catch (e: any) {
        localErrors.push(`Failed to read ${file.name}: ${e.message}`);
      }
    }
    setErrors(localErrors);
    if (added.length) setRecent(prev => [...added, ...prev].slice(0, 5));
  }, [addBundle]);

  return (
    <div className={`border-2 border-dashed rounded p-8 text-center transition ${dragOver ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300'}`}
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); }}
      onDrop={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <div className="text-sm">Drop ZIP files here</div>
    </div>
  );
};
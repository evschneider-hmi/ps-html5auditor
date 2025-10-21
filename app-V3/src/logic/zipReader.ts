import JSZip, { JSZipObject } from 'jszip';
import { ZipBundle } from './types';

export async function readZip(file: File): Promise<ZipBundle> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer, { createFolders: false });
  const files: Record<string, Uint8Array> = {};
  const lowerCaseIndex: Record<string, string> = {};
  const entries = Object.entries(zip.files);
  for (const [path, entryUnknown] of entries) {
    const entry = entryUnknown as JSZipObject;
    if (entry.dir) continue; // skip directories
    const normalized = path.replace(/\\/g, '/');
    const bytes = new Uint8Array(await entry.async('uint8array'));
    files[normalized] = bytes;
    lowerCaseIndex[normalized.toLowerCase()] = normalized;
  }
  return {
    id: crypto.randomUUID(),
    name: file.name,
    bytes: new Uint8Array(arrayBuffer),
    files,
    lowerCaseIndex,
  };
}

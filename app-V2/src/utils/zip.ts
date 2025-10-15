import JSZip from 'jszip';

export interface ZipEntry {
  path: string;
  dir: boolean;
  size: number;
  getData: () => Promise<Uint8Array>;
}

const normalizePath = (value: string): string => value.replace(/^\/+/, '');

export async function listEntries(zipFile: File): Promise<ZipEntry[]> {
  const buffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const cache = new Map<string, Promise<Uint8Array>>();

  return Object.keys(zip.files).map((rawPath) => {
    const entry = zip.files[rawPath];
    const path = normalizePath(rawPath);

    if (!entry) {
      return {
        path,
        dir: false,
        size: 0,
        getData: async () => new Uint8Array(),
      } satisfies ZipEntry;
    }

    const getData = () => {
      if (entry.dir) return Promise.resolve(new Uint8Array());
      if (!cache.has(path)) {
        cache.set(
          path,
          entry.async('uint8array').then((value) => new Uint8Array(value)),
        );
      }
      return cache.get(path)!;
    };

    const size = (() => {
      const raw = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
      return typeof raw?.uncompressedSize === 'number' ? raw.uncompressedSize : 0;
    })();

    return {
      path,
      dir: entry.dir,
      size,
      getData,
    } satisfies ZipEntry;
  });
}

export function findFirstIndexHtml(entries: ZipEntry[]):
  | { indexPath: string; baseDir: string }
  | null {
  for (const entry of entries) {
    if (entry.dir) continue;
    if (!/index\.html$/i.test(entry.path)) continue;
    const normalized = normalizePath(entry.path);
    const segments = normalized.split('/');
    segments.pop();
    const baseDir = segments.length ? `${segments.join('/')}/` : '';
    return { indexPath: normalized, baseDir };
  }
  return null;
}

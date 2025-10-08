import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - pako doesn't ship type definitions in this project
import pako from 'pako';

import { discoverPrimary } from '../../../src/logic/discovery.js';
import { parsePrimary } from '../../../src/logic/parse.js';
import type { Reference, ZipBundle } from '../../../src/logic/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '../../..');
export const SAMPLE_ZIPS_ROOT = path.resolve(repoRoot, 'SampleZips');

type BundleWithMode = ZipBundle & { mode?: string };

let domReady = false;
function ensureDomParser(): void {
  if (domReady) return;
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    pretendToBeVisual: true,
  });
  if (typeof global.DOMParser === 'undefined') {
    global.DOMParser = dom.window.DOMParser;
  }
  domReady = true;
}

function fmtKB(bytes?: number | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—';
  const value = Math.round((bytes / 1024) * 10) / 10;
  return value.toFixed(1) + ' KB';
}

async function collectZipFiles(dir: string, acc: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectZipFiles(full, acc);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.zip')) {
      acc.push(full);
    }
  }
  return acc;
}

export async function collectSampleZipPaths(): Promise<string[]> {
  const zips = await collectZipFiles(SAMPLE_ZIPS_ROOT);
  zips.sort((a, b) => a.localeCompare(b));
  return zips;
}

interface LoadedBundle extends BundleWithMode {
  displayName: string;
}

async function loadBundleFromZip(zipPath: string): Promise<LoadedBundle> {
  ensureDomParser();
  const bytes = new Uint8Array(await fs.readFile(zipPath));
  const zip = await JSZip.loadAsync(bytes);

  const files: Record<string, Uint8Array> = {};
  const lowerCaseIndex: Record<string, string> = {};

  for (const entryName of Object.keys(zip.files)) {
    const entry = zip.file(entryName);
    if (!entry || entry.dir) continue;
    const norm = entryName.replace(/^\/+/, '');
    const data = new Uint8Array(await entry.async('uint8array'));
    files[norm] = data;
    lowerCaseIndex[norm.toLowerCase()] = norm;
  }

  const name = path.basename(zipPath);
  const displayName = name.replace(/\.zip$/i, '');

  return {
    id: displayName,
    name,
    bytes,
    files,
    lowerCaseIndex,
    mode: 'zip',
    displayName,
  };
}

function chooseFallbackHTML(paths: string[]): string {
  const byDepth = (p: string) => p.split('/').length;
  const isIndex = (p: string) => /\/(index\.html?)$/i.test('/' + p);
  const indexCands = paths.filter(isIndex);
  if (indexCands.length) {
    indexCands.sort((a, b) => byDepth(a) - byDepth(b) || a.length - b.length);
    return indexCands[0];
  }
  const sorted = [...paths].sort((a, b) => byDepth(a) - byDepth(b) || a.length - b.length);
  return sorted[0];
}

function gatherReferencedPaths(references: Reference[] | undefined, primaryPath?: string): Set<string> {
  const referenced = new Set<string>();
  if (Array.isArray(references)) {
    for (const ref of references) {
      if (ref && ref.inZip && ref.normalized) {
        referenced.add(ref.normalized);
      }
    }
  }
  if (primaryPath) {
    referenced.add(primaryPath.toLowerCase());
  }
  return referenced;
}

function computeBundleMetrics(bundle: LoadedBundle): {
  zippedBytes: number;
  initialBytes: number;
  subloadBytes: number;
  userBytes: number;
  totalBytes: number;
} {
  let primary: { path: string } | undefined;
  let references: Reference[] = [];

  try {
    if (bundle.mode === 'zip') {
      const discovery = discoverPrimary(bundle);
      primary = discovery?.primary;
      if (!primary) {
        const candidates = discovery?.htmlCandidates?.length
          ? discovery.htmlCandidates
          : Object.keys(bundle.files).filter((p) => /\.html?$/i.test(p));
        if (candidates.length) {
          primary = { path: chooseFallbackHTML(candidates) };
        }
      }
      if (primary) {
        const parsed = parsePrimary(bundle, primary);
        references = parsed.references || [];
      }
    }
  } catch {}

  const fileEntries = Object.entries(bundle.files);
  const totalBytes = fileEntries.reduce((acc, [, bytes]) => acc + (bytes?.byteLength || 0), 0);

  const gzipCache = new Map<string, number>();
  const computeGzipSize = (pathKey: string, bytes?: Uint8Array): number => {
    if (!bytes) return 0;
    const key = pathKey ? pathKey.toLowerCase() : '';
    if (gzipCache.has(key)) return gzipCache.get(key)!;
    let size = bytes.byteLength;
    try {
      size = pako.gzip(bytes).length;
    } catch {}
    gzipCache.set(key, size);
    return size;
  };

  const totalGzipBytes = fileEntries.reduce(
    (acc, [pathKey, bytes]) => acc + computeGzipSize(pathKey, bytes),
    0,
  );

  const referencedPaths = gatherReferencedPaths(references, primary?.path);

  let initialRawBytes = 0;
  let initialGzipBytes = 0;
  for (const refPath of referencedPaths) {
    const lookup = bundle.lowerCaseIndex?.[refPath] || refPath;
    const bytes = bundle.files?.[lookup];
    if (bytes) {
      initialRawBytes += bytes.byteLength;
      initialGzipBytes += computeGzipSize(lookup, bytes);
    }
  }

  if (initialRawBytes === 0) {
    initialRawBytes = totalBytes;
    initialGzipBytes = totalGzipBytes;
  }

  const uncompressedSubload = Math.max(0, totalBytes - initialRawBytes);
  const subsequentGzipBytes = Math.max(0, totalGzipBytes - initialGzipBytes);

  return {
    zippedBytes: bundle.bytes?.length || 0,
    initialBytes: initialGzipBytes,
    subloadBytes: subsequentGzipBytes,
    userBytes: 0,
    totalBytes,
  };
}

export interface SampleZipExpectation {
  path: string;
  bundleName: string;
  displayName: string;
  zippedBytes: number;
  initialBytes: number;
  subloadBytes: number;
  userBytes: number;
  zippedDisplay: string;
  initialDisplay: string;
  subloadDisplay: string;
  userDisplay: string;
}

export async function buildSampleZipExpectations(): Promise<SampleZipExpectation[]> {
  ensureDomParser();
  const paths = await collectSampleZipPaths();
  const expectations: SampleZipExpectation[] = [];

  for (const zipPath of paths) {
    const bundle = await loadBundleFromZip(zipPath);
    const metrics = computeBundleMetrics(bundle);
    expectations.push({
      path: zipPath,
      bundleName: bundle.name,
      displayName: bundle.displayName,
      zippedBytes: metrics.zippedBytes,
      initialBytes: metrics.initialBytes,
      subloadBytes: metrics.subloadBytes,
      userBytes: metrics.userBytes,
      zippedDisplay: fmtKB(metrics.zippedBytes),
      initialDisplay: fmtKB(metrics.initialBytes),
      subloadDisplay: fmtKB(metrics.subloadBytes),
      userDisplay: fmtKB(metrics.userBytes),
    });
  }

  expectations.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return expectations;
}

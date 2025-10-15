import { readFileSync } from 'fs';
import JSZip from 'jszip';
import { JSDOM } from 'jsdom';
import { discoverPrimary } from '../src/logic/discovery.js';
import { parsePrimary } from '../src/logic/parse.js';

const dom = new JSDOM('');
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = dom.window.DOMParser;
}

async function inspect(zipPath) {
  const data = readFileSync(zipPath);
  const zip = await JSZip.loadAsync(data);
  const files = {};
  const lower = {};
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const norm = name.replace(/^\/+/g, '');
    const bytes = new Uint8Array(await entry.async('uint8array'));
    files[norm] = bytes;
    lower[norm.toLowerCase()] = norm;
  }
  const bundle = {
    id: 'debug',
    name: zipPath,
    bytes: new Uint8Array(data),
    files,
    lowerCaseIndex: lower,
  };

  const discovery = discoverPrimary(bundle);
  console.log('discovery.primary', discovery.primary);
  const primaryPath = discovery.primary?.path;
  if (!primaryPath) {
    console.log('No primary HTML detected.');
    return;
  }
  const parsed = parsePrimary(bundle, { path: primaryPath });
  console.log('parsed.adSize', parsed.adSize);
  console.log('parsed.adSizeSource', parsed.adSizeSource);
}

const target = process.argv[2] ?? './SampleZips/H5.zip';
inspect(target).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
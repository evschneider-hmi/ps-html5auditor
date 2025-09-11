import { ZipBundle, Reference, ReferenceType, PrimaryAsset } from './types';

export interface ParseResult {
  adSize?: { width: number; height: number };
  references: Reference[];
}

const textDecoder = new TextDecoder();

function parseAdSize(doc: Document): { width: number; height: number } | undefined {
  const meta = doc.querySelector('meta[name="ad.size"]');
  if (!meta) return undefined;
  const content = meta.getAttribute('content') || '';
  const m = /width\s*=\s*(\d+)\s*,\s*height\s*=\s*(\d+)/i.exec(content);
  if (!m) return undefined;
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

function collectHtmlReferences(doc: Document, path: string): Reference[] {
  const refs: Reference[] = [];
  function push(el: Element, url: string | null, type: ReferenceType) {
    if (!url) return;
    refs.push({ from: path, type, url, inZip: false, external: /^https?:\/\//i.test(url), secure: /^https:\/\//i.test(url) });
  }
  doc.querySelectorAll('img[src]').forEach(el => push(el, el.getAttribute('src'), 'img'));
  doc.querySelectorAll('video[src]').forEach(el => push(el, el.getAttribute('src'), 'media'));
  doc.querySelectorAll('audio[src]').forEach(el => push(el, el.getAttribute('src'), 'media'));
  doc.querySelectorAll('source[src]').forEach(el => push(el, el.getAttribute('src'), 'media'));
  doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(el => push(el, el.getAttribute('href'), 'css'));
  doc.querySelectorAll('script[src]').forEach(el => push(el, el.getAttribute('src'), 'js'));
  doc.querySelectorAll('a[href]').forEach(el => push(el, el.getAttribute('href'), 'anchor'));
  return refs;
}

function collectCssReferences(cssText: string, from: string): Reference[] {
  const refs: Reference[] = [];
  const urlRegex = /url\(([^)]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = urlRegex.exec(cssText))) {
    let raw = m[1].trim().replace(/^['"]|['"]$/g, '');
    if (!raw) continue;
    refs.push({ from, type: 'font', url: raw, inZip: false, external: /^https?:\/\//i.test(raw), secure: /^https:\/\//i.test(raw) });
  }
  return refs;
}

export function parsePrimary(bundle: ZipBundle, primary: PrimaryAsset): ParseResult {
  const bytes = bundle.files[primary.path];
  const html = textDecoder.decode(bytes);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const adSize = parseAdSize(doc);
  const references: Reference[] = collectHtmlReferences(doc, primary.path);
  // inline styles
  doc.querySelectorAll('style').forEach(style => {
    references.push(...collectCssReferences(style.textContent || '', primary.path));
  });
  // linked CSS content
  for (const ref of [...references]) {
    if (ref.type === 'css' && !ref.external) {
      const target = resolveLocal(bundle, primary.path, ref.url);
      if (target && bundle.files[target]) {
        const cssText = textDecoder.decode(bundle.files[target]);
        references.push(...collectCssReferences(cssText, target));
      }
    }
  }
  // Normalize and mark inZip
  for (const r of references) {
    if (r.external) continue;
    const resolved = resolveLocal(bundle, primary.path, r.url);
    if (resolved) {
      r.normalized = stripQuery(resolved);
      const key = bundle.lowerCaseIndex[r.normalized.toLowerCase()];
      if (key) r.inZip = true;
    }
  }
  return { adSize, references };
}

function stripQuery(s: string): string {
  return s.replace(/[?#].*$/, '');
}

function resolveLocal(bundle: ZipBundle, from: string, url: string): string | undefined {
  if (/^https?:/i.test(url) || /^data:/i.test(url) || url.startsWith('javascript:')) return undefined;
  if (url.startsWith('/')) return url.slice(1); // root relative treat as top-level
  if (url.startsWith('./')) url = url.slice(2);
  const fromDir = from.split('/').slice(0, -1).join('/');
  const combined = fromDir ? fromDir + '/' + url : url;
  const norm = combined.split('/').filter(p => p && p !== '.').reduce<string[]>((acc, part) => {
    if (part === '..') acc.pop(); else acc.push(part);
    return acc;
  }, []).join('/');
  return norm;
}

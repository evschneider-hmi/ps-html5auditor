import { ZipBundle, Reference, ReferenceType, PrimaryAsset, SizeSourceInfo } from './types';

export interface ParseResult {
  adSize?: { width: number; height: number };
  adSizeSource?: SizeSourceInfo;
  references: Reference[];
}

interface DetectedSize {
  size: { width: number; height: number };
  source: SizeSourceInfo;
}

const textDecoder = new TextDecoder();

function normalizeSnippet(text: string | undefined, max = 160): string | undefined {
  if (!text) return undefined;
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  return collapsed.length > max ? collapsed.slice(0, max) + '…' : collapsed;
}

type CssContextType = 'inline-style' | 'css-rule' | 'css-file';

function parseCssAdSize(
  cssText: string,
  context: { type: CssContextType; path?: string },
): DetectedSize | undefined {
  if (!cssText) return undefined;

  function considerCandidate(
    source: string,
    method: SizeSourceInfo['method'],
    snippetSource?: string,
  ): DetectedSize | undefined {
    const widthMatch = /width\s*:\s*(\d{2,4})px/i.exec(source);
    const heightMatch = /height\s*:\s*(\d{2,4})px/i.exec(source);
    if (!widthMatch || !heightMatch) return undefined;
    const width = parseInt(widthMatch[1], 10);
    const height = parseInt(heightMatch[1], 10);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
    if (width < 10 || height < 10) return undefined;
    return {
      size: { width, height },
      source: {
        method,
        snippet: normalizeSnippet(snippetSource ?? source),
        path: context.path,
      },
    };
  }

  let best: DetectedSize | undefined;
  let bestArea = 0;

  const updateBest = (candidate?: DetectedSize) => {
    if (!candidate) return;
    const area = candidate.size.width * candidate.size.height;
    if (area > bestArea) {
      best = candidate;
      bestArea = area;
    }
  };

  const mediaRegex = /@media[^{}]*\{[^}]*\}/gi;
  let mediaMatch: RegExpExecArray | null;
  while ((mediaMatch = mediaRegex.exec(cssText))) {
    updateBest(considerCandidate(mediaMatch[0], 'css-media'));
  }

  const blockRegex = /\{[^{}]*\}/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = blockRegex.exec(cssText))) {
    const method = context.type === 'css-file' ? 'css-file' : 'css-rule';
    updateBest(considerCandidate(blockMatch[0], method));
  }

  if (!best) {
    const method: SizeSourceInfo['method'] =
      context.type === 'inline-style'
        ? 'inline-style'
        : context.type === 'css-file'
        ? 'css-file'
        : 'css-rule';
    updateBest(considerCandidate(cssText, method));
  }

  return best;
}

function parseAdSize(doc: Document, path: string): DetectedSize | undefined {
  // 1) Standard meta tag
  const meta = doc.querySelector('meta[name="ad.size"]');
  if (meta) {
    const content = meta.getAttribute('content') || '';
    const m = /width\s*=\s*(\d+)\s*,\s*height\s*=\s*(\d+)/i.exec(content);
    if (m) {
      return {
        size: { width: parseInt(m[1], 10), height: parseInt(m[2], 10) },
        source: {
          method: 'meta',
          snippet: normalizeSnippet(meta.outerHTML || content),
          path,
        },
      };
    }
  }
  
  // 1b) Teresa format: <meta name="300x250" content="width=300, height=250, ...">
  const allMeta = doc.querySelectorAll('meta[name]');
  for (const metaEl of allMeta) {
    const name = metaEl.getAttribute('name') || '';
    const dimensionMatch = /^(\d{2,4})\s*x\s*(\d{2,4})$/i.exec(name);
    if (dimensionMatch) {
      const width = parseInt(dimensionMatch[1], 10);
      const height = parseInt(dimensionMatch[2], 10);
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return {
          size: { width, height },
          source: {
            method: 'meta',
            snippet: normalizeSnippet(metaEl.outerHTML),
            path,
          },
        };
      }
    }
  }
  // 2) GWD admetadata fallback: <script type="text/gwd-admetadata">{..."creativeProperties":{"minWidth":970,"minHeight":250,...}}</script>
  try {
    const node = doc.querySelector('script[type="text/gwd-admetadata"]');
    if (node && node.textContent) {
      const raw = node.textContent.trim();
      if (raw) {
        const data = JSON.parse(raw);
        const cp = (data && data.creativeProperties) || {};
        const w = Number(cp.maxWidth ?? cp.minWidth);
        const h = Number(cp.maxHeight ?? cp.minHeight);
        if (isFinite(w) && isFinite(h) && w > 0 && h > 0) {
          return {
            size: { width: Math.round(w), height: Math.round(h) },
            source: {
              method: 'gwd-admetadata',
              snippet: normalizeSnippet(raw),
              path,
            },
          };
        }
      }
    }
  } catch {}
  return undefined;
}

function collectHtmlReferences(doc: Document, path: string): Reference[] {
  const refs: Reference[] = [];
  function push(el: Element, url: string | null, type: ReferenceType) {
    if (!url) return;
    refs.push({ from: path, type, url, inZip: false, external: /^https?:\/\//i.test(url), secure: /^https:\/\//i.test(url) });
  }
  doc.querySelectorAll('img[src]').forEach(el => push(el, el.getAttribute('src'), 'img'));
  // GWD: <gwd-image source="..."> emits an image reference used by runtime
  doc.querySelectorAll('gwd-image[source]').forEach(el => push(el, el.getAttribute('source'), 'img'));
  doc.querySelectorAll('video[src]').forEach(el => push(el, el.getAttribute('src'), 'media'));
  doc.querySelectorAll('audio[src]').forEach(el => push(el, el.getAttribute('src'), 'media'));
  doc.querySelectorAll('source[src]').forEach(el => push(el, el.getAttribute('src'), 'media'));
  doc.querySelectorAll('link[rel="stylesheet"][href]').forEach(el => push(el, el.getAttribute('href'), 'css'));
  doc.querySelectorAll('script[src]').forEach(el => push(el, el.getAttribute('src'), 'js'));
  doc.querySelectorAll('a[href]').forEach(el => push(el, el.getAttribute('href'), 'anchor'));
  // Inline style url(...) references (background images, etc.)
  doc.querySelectorAll('[style]').forEach(el => {
    const styleText = el.getAttribute('style') || '';
    for (const r of collectCssReferences(styleText, path)) refs.push(r);
  });
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
  let detected = parseAdSize(doc, primary.path);
  let adSize = detected?.size;
  let adSizeSource = detected?.source;
  const references: Reference[] = collectHtmlReferences(doc, primary.path);
  const cssSnippets: Array<{ text: string; context: { type: CssContextType; path?: string } }> = [];
  // inline styles
  doc.querySelectorAll('style').forEach(style => {
    const css = style.textContent || '';
    if (css) {
      const context = { type: 'css-rule' as const, path: primary.path };
      cssSnippets.push({ text: css, context });
      references.push(...collectCssReferences(css, primary.path));
    }
  });
  doc.querySelectorAll('[style]').forEach(el => {
    const css = el.getAttribute('style') || '';
    if (css) cssSnippets.push({ text: css, context: { type: 'inline-style', path: primary.path } });
  });
  // linked CSS content
  for (const ref of [...references]) {
    if (ref.type === 'css' && !ref.external) {
      const target = resolveLocal(bundle, primary.path, ref.url);
      if (target && bundle.files[target]) {
        const cssText = textDecoder.decode(bundle.files[target]);
        references.push(...collectCssReferences(cssText, target));
        const context = { type: 'css-file' as const, path: target };
        cssSnippets.push({ text: cssText, context });
      }
    }
  }
  if (!adSize) {
    let bestCandidate: DetectedSize | undefined;
    let bestArea = 0;
    for (const snippet of cssSnippets) {
      const candidate = parseCssAdSize(snippet.text, snippet.context);
      if (!candidate) continue;
      const area = candidate.size.width * candidate.size.height;
      if (area > bestArea) {
        bestCandidate = candidate;
        bestArea = area;
      }
    }
    if (bestCandidate) {
      adSize = bestCandidate.size;
      adSizeSource = bestCandidate.source;
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
  return { adSize, adSizeSource, references };
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

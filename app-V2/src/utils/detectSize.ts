export interface AdSize {
  width: number;
  height: number;
  source: 'meta' | 'folder' | 'computed';
}

const parseIntStrict = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

export function detectSizeFromDoc(doc: Document): AdSize | null {
  const meta = doc.querySelector('meta[name="ad.size"]');
  if (meta) {
    const content = meta.getAttribute('content') || '';
    const match = /width\s*=\s*(\d+)\s*,?\s*height\s*=\s*(\d+)/i.exec(content);
    if (match) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        return { width, height, source: 'meta' };
      }
    }
  }

  const baseUri = doc.baseURI || doc.URL || '';
  const folderMatch = /(?:\/|^)(\d{2,4})\s*x\s*(\d{2,4})(?:\/|$)/i.exec(baseUri);
  if (folderMatch) {
    const width = parseInt(folderMatch[1], 10);
    const height = parseInt(folderMatch[2], 10);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height, source: 'folder' };
    }
  }

  const candidates = ['#container', '#animate-section', '#bg', 'body', 'html'];
  for (const selector of candidates) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (!el) continue;
    const style = doc.defaultView?.getComputedStyle(el) || null;
    const width = parseIntStrict(style?.width) ?? el.offsetWidth;
    const height = parseIntStrict(style?.height) ?? el.offsetHeight;
    if (width && height) {
      return { width, height, source: 'computed' };
    }
  }

  return null;
}

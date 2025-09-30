// Shared bulk parsing for multi-tag detection within TagTester and VastTester
// Parses freeform text that may contain multiple lines of URLs or XML snippets

export const HIGHLIGHT_PARAM_PRIORITY = ['plc','cmp','sid','ctx','advid','adsrv','campaign','placement','lineitem','lineitemid','bundle','creative','unit','pid','tagid'];


export type BulkEntry = {
  i: number; // 1-based index
  type: 'VAST XML' | 'VAST URL' | 'Ad Tag' | 'Other';
  raw: string;
  host: string;
  vendor: string;
  params: Record<string, string>;
};

function isUrlLine(s: string) {
  return /^https?:\/\//i.test(s.trim());
}

function looksVastUrl(s: string) {
  const t = s.trim();
  return /^https?:\/\/.+\.(xml)(\?|#|$)/i.test(t) || (/^https?:\/\//i.test(t) && /vast|adtag|adtaguri/i.test(t));
}

function looksVastXml(s: string) {
  const t = s.trim();
  return t.startsWith('<') && /<\s*VAST[\s>]/i.test(t);
}

function host(url: string) {
  try { return new URL(url).host; } catch { return ''; }
}

function classify(url: string) {
  const h = host(url).toLowerCase(); if (!h) return 'Other';
  if (h.includes('doubleclick.net') || h.includes('googlesyndication.com')) return 'CM360';
  if (h.includes('innovid.com') || h.includes('rtr.innovid.com') || h.includes('dvrtr.innovid.com')) return 'Innovid';
  if (h.includes('doubleverify') || h.includes('dv.tech')) return 'DoubleVerify';
  return h.split('.').slice(-2).join('.');
}

export function parseBulkInput(text: string): BulkEntry[] {
  const source = String(text || '').replace(/\r/g, '');
  let parts = source
    .split(/\n/)
    .map(s => s.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    const urlMatches = source.match(/https?:\/\/[^\s]+/gi) || [];
    if (urlMatches.length > 1) {
      parts = urlMatches.map(s => s.trim());
    } else if (!parts.length && urlMatches.length === 1) {
      parts = [urlMatches[0].trim()];
    }
  }
  if (parts.length <= 1) {
    const vastMatches = source.match(/<\s*VAST[\s\S]*?<\s*\/\s*VAST\s*>/gi) || [];
    if (vastMatches.length > 1) {
      parts = vastMatches.map(s => s.trim());
    } else if (!parts.length && vastMatches.length === 1) {
      parts = [vastMatches[0].trim()];
    }
  }
  return parts.map((raw, idx) => {
    const type: BulkEntry['type'] = looksVastXml(raw)
      ? 'VAST XML'
      : looksVastUrl(raw)
      ? 'VAST URL'
      : isUrlLine(raw)
      ? 'Ad Tag'
      : 'Other';
    const h = host(raw);
    const vendor = classify(raw);
    const params: Record<string, string> = {};
    try {
      const u = new URL(raw);
      u.searchParams.forEach((v, k) => (params[k] = v));
    } catch {}
    return { i: idx + 1, type, raw, host: h, vendor, params };
  });
}










// Simple domain -> vendor classifier for VAST tracker grouping
// Extend this map over time as needed.

export type VendorMatch = {
  vendor: string;
  host: string;
};

const VENDOR_PATTERNS: { vendor: string; test: (host: string) => boolean }[] = [
  { vendor: 'Innovid', test: (h) => /(^|\.)innovid\.com$/i.test(h) },
  { vendor: 'CM360', test: (h) => /(^|\.)doubleclick\.net$/i.test(h) },
  { vendor: 'DoubleVerify', test: (h) => /(^|\.)doubleverify\.com$/i.test(h) || /(^|\.)dv\.tech$/i.test(h) },
  { vendor: 'DISQO', test: (h) => /(^|\.)activemetering\.com$/i.test(h) },
];

// Extract nested destination URL from common redirector params (e.g., click=https%3A%2F%2Fad.doubleclick.net/...) 
export function extractNestedUrl(rawUrl: string): string | undefined {
  try {
    const u = new URL(rawUrl);
    for (const [k, v] of u.searchParams.entries()) {
      // decode once (URLSearchParams is already decoded), then probe for http(s) within
      const val = v;
      const m = val.match(/https?:\/\/[^\s'"<>]+/i);
      if (m) return m[0];
      // Sometimes double-encoded
      try {
        const dec = decodeURIComponent(val);
        const m2 = dec.match(/https?:\/\/[^\s'"<>]+/i);
        if (m2) return m2[0];
      } catch {}
    }
  } catch {}
  // Fallback: naive pattern for click=...
  try {
    const m = String(rawUrl).match(/(?:click|url|dest|el)=([^&]+)/i);
    if (m && m[1]) {
      try {
        const dec = decodeURIComponent(m[1]);
        const m2 = dec.match(/https?:\/\/[^\s'"<>]+/i);
        if (m2) return m2[0];
      } catch {}
    }
  } catch {}
  return undefined;
}

export function classifyPrimaryVendor(url: string): VendorMatch {
  const host = extractHost(url);
  if (!host) return { vendor: 'Other', host: '' };
  const lower = host.toLowerCase();
  for (const p of VENDOR_PATTERNS) {
    try { if (p.test(lower)) return { vendor: p.vendor, host: lower }; } catch {}
  }
  return { vendor: 'Other', host: lower };
}

export function classifyVendor(url: string): VendorMatch {
  const primary = classifyPrimaryVendor(url);
  // If primary is Innovid or Other, try to classify by nested destination
  if (primary.vendor === 'Innovid' || primary.vendor === 'Other') {
    const nested = extractNestedUrl(url);
    if (nested) {
      const nestedPrimary = classifyPrimaryVendor(nested);
      if (nestedPrimary.vendor !== 'Other') return nestedPrimary;
    }
  }
  return primary;
}

export function extractHost(url: string): string | '' {
  try {
    // Handle macro-wrapped and protocol-relative URLs
    const m = String(url).match(/https?:\/\/([^\s'"<>/]+)/i);
    if (m && m[1]) return m[1];
    if (/^\/\//.test(url)) {
      const u = new URL((location.protocol === 'https:' ? 'https:' : 'http:') + url);
      return u.host;
    }
    const u = new URL(url);
    return u.host;
  } catch {
    return '';
  }
}

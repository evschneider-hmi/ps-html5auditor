import { ZipBundle, Finding } from '../types';
import { Settings } from '../profiles';

// Detect any explicit hard-coded clickthrough destinations which should be ad-server provided.
// This is distinct from general navigation detection (handled in clickTags) and is always a FAIL.
export function checkHardcodedClickUrl(bundle: ZipBundle, _settings: Settings): Finding {
  const offenders: { path: string; detail?: string; line?: number }[] = [];
  const urlLiteral = /https?:\/\//i;
  const patterns: { id: string; regex: RegExp }[] = [
    { id: 'window.open', regex: /window\.open\s*\(\s*['"]https?:\/\//i },
    { id: 'location.assign', regex: /location\.(href|replace)\s*=\s*['"]https?:\/\//i },
    { id: 'top.location', regex: /top\.location(?:\.href)?\s*=\s*['"]https?:\/\//i },
    { id: 'parent.location', regex: /parent\.location(?:\.href)?\s*=\s*['"]https?:\/\//i },
    { id: 'clickTag assign', regex: /\bclickTAG?\s*=\s*['"]https?:\/\//i },
  ];
  const anchorRegex = /<a[^>]+href=["']https?:\/\/[^"]+["'][^>]*>/gi;

  for (const path of Object.keys(bundle.files)) {
    if (!/\.(html?|js)$/i.test(path)) continue;
    const text = new TextDecoder().decode(bundle.files[path]);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const p of patterns) {
        if (p.regex.test(line)) {
          const m = line.match(urlLiteral);
          offenders.push({ path, line: i + 1, detail: `${p.id} -> ${m ? m[0] : 'URL'}` });
          break; // avoid multiple tags on same line
        }
      }
    });
    if (/\.html?$/i.test(path) && anchorRegex.test(text)) {
      let m: RegExpExecArray | null;
      anchorRegex.lastIndex = 0;
      while ((m = anchorRegex.exec(text))) {
        const pre = text.slice(0, m.index).split(/\r?\n/).length;
        offenders.push({ path, line: pre, detail: `anchor -> ${m[0].slice(0,120)}` });
      }
    }
  }

  if (offenders.length === 0) {
    return {
      id: 'hardcodedClickUrl',
      title: 'Hard-Coded Clickthrough URL',
      severity: 'PASS',
      messages: ['No hard-coded absolute clickthrough destinations found'],
      offenders: []
    };
  }
  return {
    id: 'hardcodedClickUrl',
    title: 'Hard-Coded Clickthrough URL',
    severity: 'FAIL',
    messages: [
      `${offenders.length} hard-coded clickthrough destination${offenders.length>1?'s':''} detected (must be ad server provided)`
    ],
    offenders
  };
}

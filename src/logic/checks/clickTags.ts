import { ZipBundle, BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

interface ScanResult {
  hasClickTag: boolean;
  hardNavs: { path: string; line: number; snippet: string }[];
  clickTagLines: { path: string; line: number; snippet: string }[];
}

export function checkClickTags(bundle: ZipBundle, result: BundleResult, settings: Settings): Finding {
  const messages: string[] = [];
  const offenders: { path: string; detail?: string; line?: number }[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  const scan = scanBundle(bundle, settings);
  if (!scan.hasClickTag) {
    severity = 'FAIL';
    messages.push('No recognized clickTag / exit API detected');
  } else {
    messages.push('Click exit mechanism detected');
  }
  if (scan.hardNavs.length) {
    messages.push(`${scan.hardNavs.length} hard-coded navigation(s)`);
    const sev = settings.hardcodedNavSeverity;
    if (sev === 'FAIL' && severity !== 'FAIL') severity = 'FAIL';
    else if (sev === 'WARN' && severity === 'PASS') severity = 'WARN';
    for (const h of scan.hardNavs) offenders.push({ path: h.path, line: h.line, detail: 'Hard nav: ' + h.snippet.trim() });
  }
  for (const c of scan.clickTagLines) offenders.push({ path: c.path, line: c.line, detail: 'ClickTag: ' + c.snippet.trim() });
  return { id: 'clickTags', title: 'Click Tags / Exit', severity, messages, offenders };
}

function scanBundle(bundle: ZipBundle, settings: Settings): ScanResult {
  const patterns = settings.clickTagPatterns.map(r => new RegExp(r.slice(1, r.lastIndexOf('/')), r.split('/').pop() || '')); // simplistic parse if user enters /.../flags
  const hardNav = /\blocation\.href\s*=\s*['"]https?:\/\//i;
  const anchorHard = /<a[^>]+href=["']https?:\/\/[^"']+["']/i;
  let hasClickTag = false;
  const hardNavs: ScanResult['hardNavs'] = [];
  const clickTagLines: ScanResult['clickTagLines'] = [];
  for (const path of Object.keys(bundle.files)) {
    if (!/\.(html?|js)$/i.test(path)) continue;
    const text = new TextDecoder().decode(bundle.files[path]);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const pat of patterns) {
        if (pat.test(line)) {
          hasClickTag = true;
          clickTagLines.push({ path, line: i + 1, snippet: line.slice(0, 200) });
        }
      }
      if (hardNav.test(line)) {
        hardNavs.push({ path, line: i + 1, snippet: line.slice(0, 200) });
      }
    });
    if (/\.html?$/i.test(path) && anchorHard.test(text)) {
      // find each anchor snippet
      const anchorRegex = /<a[^>]+href=["']https?:\/\/[^"']+["'][^>]*>/gi;
      let m: RegExpExecArray | null;
      while ((m = anchorRegex.exec(text))) {
        const before = text.slice(0, m.index).split(/\r?\n/).length;
        hardNavs.push({ path, line: before, snippet: m[0] });
      }
    }
  }
  return { hasClickTag, hardNavs, clickTagLines };
}

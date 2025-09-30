import { BundleResult, Finding, SizeSourceInfo } from '../types';
import { Settings } from '../profiles';

function describeSizeSource(info?: SizeSourceInfo | null): string {
  if (!info) return 'detected heuristics';
  const pathSuffix = info.path ? ` in ${info.path}` : '';
  switch (info.method) {
    case 'meta':
      return '<meta name="ad.size"> tag';
    case 'gwd-admetadata':
      return 'GWD admetadata script';
    case 'css-media':
      return `CSS @media rule${pathSuffix}`.trim();
    case 'css-rule':
      return `CSS rule${pathSuffix}`.trim();
    case 'inline-style':
      return 'inline style attribute';
    case 'css-file':
      return `CSS file${pathSuffix}`.trim();
    default:
      return 'detected heuristics';
  }
}

export function checkPrimaryAsset(result: BundleResult, settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  if (!result.primary) {
    severity = 'FAIL';
    messages.push('Missing primary HTML asset');
    offenders.push({ path: '(bundle root)', detail: 'No primary HTML selected' });
  } else {
    const base = (() => {
      try { return result.primary.path.split('/').pop() || result.primary.path; } catch { return result.primary.path; }
    })();
    const size = result.adSize;
    const sizeSource = result.adSizeSource || result.primary.sizeSource;
    const sizeSourceLabel = describeSizeSource(sizeSource);

    // Extract size token from primary filename (e.g., 160x600)
    const m = String(base || '').match(/(?<!\d)(\d{2,4})\s*[xX]\s*(\d{2,4})(?!\d)/);
    if (size && m) {
      const fnW = parseInt(m[1], 10);
      const fnH = parseInt(m[2], 10);
      const matches = fnW === size.width && fnH === size.height;
      if (matches) {
        severity = 'PASS';
        messages.push('Primary file detected');
        messages.push(`Size detected from ${sizeSourceLabel}`);
      } else {
        severity = 'FAIL';
        messages.push('Primary file detected; size token does not match actual dimensions');
        offenders.push({ path: base, detail: `Filename ${fnW}x${fnH} vs actual ${size.width}x${size.height}` });
        if (sizeSource) messages.push(`Size detected from ${sizeSourceLabel}`);
      }
    } else if (size && !m) {
      // Size known but filename lacks token — PASS, keep bullet minimal
      severity = 'PASS';
      messages.push('Primary file detected');
      messages.push(`Size detected from ${sizeSourceLabel}`);
    } else if (!size && m) {
      // No ad.size detected, but filename has a token — warn, per legacy behavior
      severity = 'WARN';
      messages.push(`Primary file detected; ad.size missing (filename has ${m[1]}x${m[2]})`);
      offenders.push({ path: base, detail: 'No <meta name="ad.size"> found' });
    } else {
      // Neither ad.size nor size token — fail to force explicit dimensions
      severity = 'FAIL';
      messages.push('Primary file detected; no ad.size and no size token in filename');
      offenders.push({ path: base, detail: 'Missing dimensions' });
    }
  }
  return { id: 'primaryAsset', title: 'Primary HTML Asset', severity, messages, offenders };
}

import { BundleResult, Finding, ZipBundle } from '../types';
import { Settings } from '../profiles';

export function checkIabWeight(bundle: ZipBundle, partial: BundleResult, settings: Settings): Finding {
  const initialCap = settings.iabInitialLoadKB || 150; // compressed guideline but we approximate with uncompressed
  const politeCap = settings.iabSubsequentLoadKB || 1000;
  const zippedCap = settings.iabMaxZippedKB || 200;
  const totalBytes = partial.totalBytes ?? Object.values(bundle.files).reduce((a, u) => a + u.byteLength, 0);
  const initialBytes = partial.initialBytes ?? totalBytes; // fallback if not computed
  const subsequentBytes = partial.subsequentBytes ?? Math.max(0, totalBytes - initialBytes);
  const totalKB = totalBytes / 1024;
  const initialKB = initialBytes / 1024;
  const subsequentKB = subsequentBytes / 1024;
  const zippedKB = (partial.zippedBytes || bundle.bytes.length) / 1024;
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  if (initialKB > initialCap) {
    severity = 'FAIL';
    messages.push(`Initial load ${initialKB.toFixed(1)}KB exceeds cap ${initialCap}KB`);
  } else {
    messages.push(`Initial load ${initialKB.toFixed(1)}KB within cap ${initialCap}KB`);
  }
  if (subsequentKB > politeCap) {
    severity = 'FAIL';
    messages.push(`Subsequent (polite) load ${subsequentKB.toFixed(1)}KB exceeds cap ${politeCap}KB`);
  } else {
    messages.push(`Subsequent (polite) load ${subsequentKB.toFixed(1)}KB within cap ${politeCap}KB`);
  }
  if (zippedKB > zippedCap) {
    // escalate but not override FAIL if already
    if (severity !== 'FAIL') severity = 'WARN';
    messages.push(`Compressed creative size ${zippedKB.toFixed(1)}KB exceeds recommended max ${zippedCap}KB`);
  } else {
    messages.push(`Compressed creative size ${zippedKB.toFixed(1)}KB within recommended max ${zippedCap}KB`);
  }
  messages.push(`Total uncompressed ${totalKB.toFixed(1)}KB (initial + subsequent)`);
  return {
    id: 'iabWeight',
    title: 'IAB Weight',
    severity,
    messages,
    offenders: []
  };
}
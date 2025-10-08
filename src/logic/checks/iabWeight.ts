import { BundleResult, Finding, ZipBundle } from '../types';
import { Settings } from '../profiles';

export function checkIabWeight(bundle: ZipBundle, partial: BundleResult, settings: Settings): Finding {
  const initialCap = settings.iabInitialLoadKB || 150; // compressed guideline but we approximate with uncompressed
  const politeCap = settings.iabSubsequentLoadKB || 1000;
  const zippedCap = settings.iabMaxZippedKB || 200;
  const toNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && isFinite(value) ? Number(value) : undefined;
  const runtimeSummary = (partial.runtimeSummary as any) || {};
  const runtimeInitial = partial.runtime?.initialBytes ?? toNumber(runtimeSummary.initialBytes);
  const runtimeSubload = partial.runtime?.subloadBytes ?? toNumber(runtimeSummary.subloadBytes);
  const runtimeTotal = partial.runtime?.totalBytes ?? toNumber(runtimeSummary.totalBytes);
  const fallbackTotal = Object.values(bundle.files).reduce((a, u) => a + u.byteLength, 0);
  const initialBytes = runtimeInitial ?? partial.initialBytes ?? fallbackTotal; // fallback if not computed
  const subsequentBytes = runtimeSubload ?? partial.subsequentBytes ?? Math.max(0, (runtimeTotal ?? partial.totalBytes ?? fallbackTotal) - initialBytes);
  const totalBytes = runtimeTotal ?? partial.totalBytes ?? (initialBytes + subsequentBytes);
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
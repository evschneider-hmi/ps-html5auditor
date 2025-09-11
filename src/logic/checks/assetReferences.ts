import { BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

export function checkAssetReferences(result: BundleResult, settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  const missing: string[] = [];
  for (const ref of result.references) {
    if (!ref.external && !ref.inZip) {
      const detail = `${ref.url} referenced from ${ref.from}`;
      offenders.push({ path: ref.from, detail });
      missing.push(ref.url);
    }
  }
  if (missing.length) {
    severity = settings.missingAssetSeverity;
    messages.push(`${missing.length} missing asset(s)`);
  } else {
    messages.push('All referenced in-bundle assets found');
  }
  return { id: 'assetReferences', title: 'Referenced Assets Present', severity, messages, offenders };
}

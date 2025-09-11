import { BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

export function checkPrimaryAsset(result: BundleResult, settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  if (!result.primary) {
    severity = 'FAIL';
    messages.push('Missing primary HTML asset');
    offenders.push({ path: '(bundle root)', detail: 'No primary HTML selected' });
  } else {
    if (!result.adSize) {
      severity = 'FAIL';
      messages.push('Primary HTML missing ad.size meta tag');
      offenders.push({ path: result.primary.path, detail: 'No <meta name="ad.size"> found' });
    } else {
      messages.push(`Primary asset ${result.primary.path} with dimensions ${result.adSize.width}x${result.adSize.height}`);
    }
  }
  return { id: 'primaryAsset', title: 'Primary HTML Asset', severity, messages, offenders };
}

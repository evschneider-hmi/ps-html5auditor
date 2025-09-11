import { ZipBundle, BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

export function checkGwdEnvironment(bundle: ZipBundle, result: BundleResult, settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  let detected = false;
  for (const path of Object.keys(bundle.files)) {
    if (!path.toLowerCase().endsWith('.html')) continue;
    const text = new TextDecoder().decode(bundle.files[path]);
    if (/gwd-page-wrapper|GWD_preventAutoplay|gwd-google/i.test(text)) {
      detected = true;
      offenders.push({ path, detail: 'GWD signature found' });
    }
  }
  if (!detected) {
    messages.push('No Google Web Designer signatures detected');
  } else {
    messages.push('Google Web Designer export detected');
    if (settings.profile !== 'CM360') {
      severity = 'WARN';
      messages.push('Profile mismatch: verify environment configuration for CM360.');
    } else {
      severity = 'WARN';
    }
  }
  return { id: 'gwdEnvironment', title: 'GWD Environment', severity, messages, offenders };
}

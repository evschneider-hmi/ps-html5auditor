import { BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

export function checkHttpsOnly(result: BundleResult, settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  let insecure = 0;
  for (const ref of result.references) {
    if (ref.external && /^http:\/\//i.test(ref.url)) {
      insecure++;
      offenders.push({ path: ref.from, detail: ref.url });
    }
  }
  if (insecure === 0) messages.push('All external references use HTTPS');
  else {
    messages.push(`${insecure} HTTP (non-secure) external reference(s)`);
    severity = settings.httpSeverity;
  }
  return { id: 'httpsOnly', title: 'HTTPS Only', severity, messages, offenders };
}

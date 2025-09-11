import { ZipBundle, Finding } from '../types';
import { Settings } from '../profiles';

export function checkPackaging(bundle: ZipBundle, settings: Settings): Finding {
  const messages: string[] = [];
  const offenders: { path: string; detail?: string }[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  const fileNames = Object.keys(bundle.files);
  // nested zips
  if (settings.disallowNestedZips) {
    for (const f of fileNames) {
      if (f.toLowerCase().endsWith('.zip')) {
        severity = 'FAIL';
        offenders.push({ path: f, detail: 'Nested ZIP not allowed' });
      }
    }
  }
  // dangerous extensions
  const dangerSet = new Set(settings.dangerousExtensions.map(e => e.toLowerCase()));
  for (const f of fileNames) {
    const lower = f.toLowerCase();
    for (const ext of dangerSet) {
      if (lower.endsWith(ext)) {
        severity = 'FAIL';
        offenders.push({ path: f, detail: 'Dangerous extension ' + ext });
      }
    }
  }
  if (offenders.length === 0) messages.push('Packaging structure OK');
  else messages.push('Detected packaging issues');
  return { id: 'packaging', title: 'Packaging Structure', severity, messages, offenders };
}

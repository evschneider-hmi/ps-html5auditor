import { ZipBundle, BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

export function checkOrphanAssets(bundle: ZipBundle, result: BundleResult, settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  const referenced = new Set(result.references.filter(r => r.inZip && !r.external && r.normalized).map(r => r.normalized!.toLowerCase()));
  const orphans: string[] = [];
  for (const path of Object.keys(bundle.files)) {
    if (path.toLowerCase().endsWith('.html') && result.primary && path === result.primary.path) continue;
    if (!referenced.has(path.toLowerCase())) {
      orphans.push(path);
      offenders.push({ path, detail: 'Not referenced by primary asset graph' });
    }
  }
  if (orphans.length) {
    severity = settings.orphanSeverity;
    messages.push(`${orphans.length} orphaned asset(s)`);
  } else {
    messages.push('No orphaned assets');
  }
  return { id: 'orphanAssets', title: 'Orphaned Assets', severity, messages, offenders };
}

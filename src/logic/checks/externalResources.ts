import { BundleResult, Finding } from '../types';
import { Settings } from '../profiles';
import { buildAllowlists } from '../allowlists';

export function checkExternalResources(result: BundleResult, settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  const messages: string[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  const allow = buildAllowlists(settings.externalHostAllowlist, settings.externalFiletypeAllowlist);
  let externalTotal = 0;
  let disallowed = 0;
  for (const ref of result.references) {
    if (!ref.external) continue;
    externalTotal++;
    try {
      const u = new URL(ref.url, 'https://placeholder.local'); // base for protocol-relative or relative (shouldn't happen)
      const host = u.host.toLowerCase();
      const ext = (u.pathname.match(/\.[A-Za-z0-9]+$/)?.[0] || '').toLowerCase();
      const hostOk = allow.hosts.has(host);
      const fileOk = ext && allow.filetypes.has(ext);
      if (!hostOk && !fileOk) {
        disallowed++;
        offenders.push({ path: ref.from, detail: `External: ${ref.url}` });
      }
    } catch {
      // ignore invalid URL parse
      offenders.push({ path: ref.from, detail: `Unparseable external URL: ${ref.url}` });
      disallowed++;
    }
  }
  if (externalTotal === 0) {
    messages.push('No external resources referenced');
  } else {
    messages.push(`${externalTotal} external reference(s), ${disallowed} outside allowlist`);
  }
  if (disallowed > 0) severity = settings.externalResourceSeverity;
  return { id: 'externalResources', title: 'External Resource Policy', severity, messages, offenders };
}

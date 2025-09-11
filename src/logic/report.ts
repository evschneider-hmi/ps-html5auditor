import { BundleResult, Report } from './types';

export function buildReport(results: BundleResult[], settings: any): Report {
  return {
    profile: settings.profile,
    settings,
    results,
    generatedAt: new Date().toISOString(),
    version: '0.1.0'
  };
}

export function reportToJSON(report: Report): string {
  return JSON.stringify(report, null, 2);
}

export function findingsToCSV(report: Report): string {
  const rows: string[] = [];
  rows.push(['bundle','checkId','severity','message','offenderPath','offenderDetail'].join(','));
  for (const r of report.results) {
    for (const f of r.findings) {
      for (const off of f.offenders.length ? f.offenders : [{ path: '', detail: '' }]) {
        const base = [quote(r.bundleName), f.id, f.severity, quote(f.messages.join('; ')), quote(off.path), quote(off.detail||'')].join(',');
        rows.push(base);
      }
    }
  }
  return rows.join('\n');
}

function quote(s: string) { return '"' + (s||'').replace(/"/g, '""') + '"'; }

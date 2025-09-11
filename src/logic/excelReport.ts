// @ts-ignore - xlsx types may not be installed; runtime import still works
import * as XLSX from 'xlsx';
import { BundleResult } from './types';

interface RefDefinition {
  id: string;
  title: string;
  description: string;
  notes?: string;
}

// Basic reference metadata; can be extended.
const REF_DATA: RefDefinition[] = [
  { id: 'packaging', title: 'Packaging Structure', description: 'Validates ZIP does not contain nested archives or disallowed file types.' },
  { id: 'primaryAsset', title: 'Primary HTML Asset', description: 'Detects the main HTML file and required ad.size meta dimensions.' },
  { id: 'assetReferences', title: 'Referenced Assets Present', description: 'All assets referenced by HTML/CSS/JS exist within the bundle.' },
  { id: 'orphanAssets', title: 'Orphaned Assets', description: 'Assets in the ZIP not referenced by the primary asset graph.' },
  { id: 'externalResources', title: 'External Resource Policy', description: 'Flags external network references and whether they are allow‑listed.' },
  { id: 'httpsOnly', title: 'HTTPS Only', description: 'Ensures all external references use secure HTTPS protocols.' },
  { id: 'clickTags', title: 'Click Tags / Exit', description: 'Detection of clickTag variables, window.open usage, or exit calls.' },
  { id: 'gwdEnvironment', title: 'GWD Environment', description: 'Detects Google Web Designer specific runtime artifacts.' },
  { id: 'iabWeight', title: 'IAB Weight', description: 'Initial vs polite/subsequent byte budgets and compressed creative size versus 2025 thresholds.' },
  { id: 'iabRequests', title: 'IAB Initial Requests', description: 'Number of initial load asset requests compared to guideline cap (heuristic).' },
  { id: 'systemArtifacts', title: 'System Artifacts', description: 'Flags OS metadata files (Thumbs.db, .DS_Store) or __MACOSX resource fork entries.' },
  { id: 'hardcodedClickUrl', title: 'Hard-Coded Clickthrough URL', description: 'Absolute clickthrough destinations embedded in code/markup; must be provided by ad server macros.' },
];

export function buildWorkbook(results: BundleResult[], scope: 'all' | 'failed'): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Flatten issues
  const rows: any[] = [];
  results.forEach(r => {
    const bundleFailsOrWarns = r.findings.filter(f => f.severity === 'FAIL' || f.severity === 'WARN');
    const include = scope === 'all' ? true : bundleFailsOrWarns.length > 0;
    if (!include) return;
    r.findings.forEach(f => {
      if (scope === 'failed' && f.severity === 'PASS') return;
      const base = {
        Bundle: r.bundleName,
        Status: r.summary.status,
        CheckID: f.id,
        Check: f.title,
        Severity: f.severity,
        Messages: f.messages.join(' | '),
      };
      if (f.offenders.length === 0) {
        rows.push({ ...base, OffenderPath: '', Detail: '' });
      } else {
        f.offenders.forEach(o => {
          rows.push({ ...base, OffenderPath: o.path, Detail: o.detail || '' });
        });
      }
    });
  });

  if (rows.length === 0) rows.push({ Bundle: '—', Status: 'PASS', CheckID: '—', Check: 'No Issues', Severity: 'PASS', Messages: 'No issues in scope', OffenderPath: '', Detail: '' });

  const issueSheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, issueSheet, scope === 'all' ? 'All Issues' : 'Failed Issues');

  // Summary sheet
  const summaryRows = results.map(r => ({
    Bundle: r.bundleName,
    Status: r.summary.status,
    Fails: r.findings.filter(f => f.severity === 'FAIL').length,
    Warnings: r.findings.filter(f => f.severity === 'WARN').length,
    PassChecks: r.findings.filter(f => f.severity === 'PASS').length,
    TotalChecks: r.findings.length,
    Primary: r.primary?.path || '',
    Dimensions: r.adSize ? `${r.adSize.width}x${r.adSize.height}` : '',
    TotalKB: r.totalBytes ? (r.totalBytes / 1024).toFixed(1) : '',
    InitialKB: r.initialBytes ? (r.initialBytes / 1024).toFixed(1) : '',
    SubsequentKB: r.subsequentBytes ? (r.subsequentBytes / 1024).toFixed(1) : '',
    ZippedKB: r.zippedBytes ? (r.zippedBytes / 1024).toFixed(1) : '',
    InitialRequests: r.initialRequests ?? '',
    TotalRequests: r.totalRequests ?? '',
  }));
  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Reference sheet
  const refSheet = XLSX.utils.json_to_sheet(REF_DATA.map(r => ({ ID: r.id, Title: r.title, Description: r.description, Notes: r.notes || '' })));
  XLSX.utils.book_append_sheet(wb, refSheet, 'Reference');

  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}
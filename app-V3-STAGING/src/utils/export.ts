import type { Upload } from '../types';
import type { Finding } from '../logic/types';

/**
 * Export utilities for V3
 * Supports JSON and CSV export with filtering
 */

interface ExportOptions {
  filterByStatus?: ('FAIL' | 'WARN')[]; // Only include findings with these severities
  includeMetadata?: boolean; // Include bundle metadata in export
}

/**
 * Generate filename with timestamp
 */
function generateFilename(baseName: string, extension: string): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
  return `${baseName}-${dateStr}.${extension}`;
}

/**
 * Export a single upload as JSON
 */
export function exportUploadAsJson(upload: Upload, options: ExportOptions = {}): string {
  const { filterByStatus, includeMetadata = true } = options;

  // Filter findings if requested
  let findings = upload.findings;
  if (filterByStatus && filterByStatus.length > 0) {
    findings = findings.filter(f => filterByStatus.includes(f.severity as any));
  }

  const exportData: any = {
    name: upload.bundle.name,
    timestamp: new Date(upload.timestamp).toISOString(),
    type: upload.type,
    subtype: upload.subtype,
    findings: findings.map(f => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      messages: f.messages,
      offenders: f.offenders,
      profiles: f.profiles,
      description: f.description,
    })),
  };

  if (includeMetadata) {
    exportData.metadata = {
      dimensions: upload.bundleResult.adSize,
      fileSize: upload.bundle.bytes.length,
      fileCount: Object.keys(upload.bundle.files).length,
      initialBytes: upload.bundleResult.initialBytes,
      subsequentBytes: upload.bundleResult.subsequentBytes,
      initialRequests: upload.bundleResult.initialRequests,
      totalRequests: upload.bundleResult.totalRequests,
    };
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export multiple uploads as JSON array
 */
export function exportAllUploadsAsJson(uploads: Upload[], options: ExportOptions = {}): string {
  const exportArray = uploads.map(u => JSON.parse(exportUploadAsJson(u, options)));
  return JSON.stringify(exportArray, null, 2);
}

/**
 * Convert findings to CSV format
 */
export function exportUploadAsCsv(upload: Upload, options: ExportOptions = {}): string {
  const { filterByStatus } = options;

  // Filter findings if requested
  let findings = upload.findings;
  if (filterByStatus && filterByStatus.length > 0) {
    findings = findings.filter(f => filterByStatus.includes(f.severity as any));
  }

  // CSV header
  const headers = [
    'Creative Name',
    'Check ID',
    'Check Title',
    'Severity',
    'Profile',
    'Message',
    'Offender Path',
    'Offender Line',
  ];

  // CSV rows
  const rows: string[][] = [];

  for (const finding of findings) {
    const profile = finding.profiles ? finding.profiles.join('+') : 'N/A';

    // If no messages or offenders, create one row for the finding
    if ((!finding.messages || finding.messages.length === 0) && 
        (!finding.offenders || finding.offenders.length === 0)) {
      rows.push([
        upload.bundle.name,
        finding.id,
        finding.title,
        finding.severity,
        profile,
        'No additional details',
        '',
        '',
      ]);
      continue;
    }

    // Create rows for each message/offender combination
    const messages = finding.messages && finding.messages.length > 0 
      ? finding.messages 
      : [''];
    const offenders = finding.offenders && finding.offenders.length > 0
      ? finding.offenders
      : [{ path: '', line: undefined, detail: '' }];

    for (const message of messages) {
      for (const offender of offenders) {
        rows.push([
          upload.bundle.name,
          finding.id,
          finding.title,
          finding.severity,
          profile,
          message || offender.detail || '',
          offender.path || '',
          offender.line ? String(offender.line) : '',
        ]);
      }
    }
  }

  // Escape CSV values (handle quotes and commas)
  const escapeCsv = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Build CSV string
  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(row => row.map(escapeCsv).join(',')),
  ];

  return csvLines.join('\n');
}

/**
 * Export multiple uploads as CSV
 */
export function exportAllUploadsAsCsv(uploads: Upload[], options: ExportOptions = {}): string {
  // Combine all CSV data (share header, concat rows)
  const csvParts = uploads.map(u => exportUploadAsCsv(u, options));
  
  if (csvParts.length === 0) return '';
  
  // Take header from first CSV, then all rows from all CSVs
  const allLines = csvParts.flatMap(csv => csv.split('\n'));
  const header = allLines[0];
  const dataRows = allLines.slice(1).filter(line => line && line !== header);
  
  return [header, ...dataRows].join('\n');
}

/**
 * Download a file in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download single upload as JSON
 */
export function downloadUploadJson(upload: Upload, options: ExportOptions = {}): void {
  const content = exportUploadAsJson(upload, options);
  const filename = generateFilename(upload.bundle.name.replace(/\.zip$/i, ''), 'json');
  downloadFile(content, filename, 'application/json');
}

/**
 * Download all uploads as JSON
 */
export function downloadAllUploadsJson(uploads: Upload[], options: ExportOptions = {}): void {
  const content = exportAllUploadsAsJson(uploads, options);
  const filename = generateFilename('all-audits', 'json');
  downloadFile(content, filename, 'application/json');
}

/**
 * Download single upload as CSV
 */
export function downloadUploadCsv(upload: Upload, options: ExportOptions = {}): void {
  const content = exportUploadAsCsv(upload, options);
  const filename = generateFilename(upload.bundle.name.replace(/\.zip$/i, ''), 'csv');
  downloadFile(content, filename, 'text/csv');
}

/**
 * Download all uploads as CSV
 */
export function downloadAllUploadsCsv(uploads: Upload[], options: ExportOptions = {}): void {
  const content = exportAllUploadsAsCsv(uploads, options);
  const filename = generateFilename('all-audits', 'csv');
  downloadFile(content, filename, 'text/csv');
}

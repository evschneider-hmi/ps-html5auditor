/**
 * Excel Export Utility
 * Generates multi-sheet Excel workbooks using xlsx (SheetJS)
 */

import * as XLSX from 'xlsx';
import type { Upload } from '../types';
import type { ExportProfile } from './exportProfiles';
import type { Finding } from '../logic/types';
import {
  generateExportFilename,
  logExportOperation,
  calculateExportStatistics,
  getCountsBySeverity,
} from './exportCommon';

/**
 * Export uploads to Excel workbook
 */
export async function exportToExcel(
  uploads: Upload[],
  profile: ExportProfile
): Promise<void> {
  logExportOperation('Excel', 'start', `Generating Excel with ${uploads.length} creatives`);
  
  const workbook = XLSX.utils.book_new();
  
  // Sheet 1: Summary
  if (profile.includeSummary) {
    const summarySheet = createSummarySheet(uploads, profile);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }
  
  // Sheet 2: Creatives Table
  const creativesSheet = createCreativesSheet(uploads, profile);
  XLSX.utils.book_append_sheet(workbook, creativesSheet, 'Creatives');
  
  // Sheet 3: All Checks/Findings
  if (profile.includeChecks) {
    const checksSheet = createChecksSheet(uploads, profile);
    XLSX.utils.book_append_sheet(workbook, checksSheet, 'Checks');
  }
  
  // Sheet 4: Failed Checks Only
  const failedFindings = uploads.flatMap(u =>
    u.findings.filter(f => f.severity === 'FAIL')
  );
  if (failedFindings.length > 0) {
    const failedSheet = createFailedChecksSheet(uploads, profile);
    XLSX.utils.book_append_sheet(workbook, failedSheet, 'Failed Checks');
  }
  
  // Apply options
  if (profile.excelOptions?.freezeHeader) {
    // Freeze first row in all sheets
    Object.keys(workbook.Sheets).forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      sheet['!freeze'] = { xSplit: 0, ySplit: 1 };
    });
  }
  
  // Generate filename using shared utility
  const filename = generateExportFilename('creative-audit-report', 'xlsx');
  
  // Write the file
  XLSX.writeFile(workbook, filename, {
    bookType: 'xlsx',
    compression: true,
  });
  
  logExportOperation('Excel', 'complete', `Excel saved: ${filename}`);
}

/**
 * Create summary sheet with statistics
 */
function createSummarySheet(
  uploads: Upload[],
  profile: ExportProfile
): XLSX.WorkSheet {
  const data: any[][] = [];
  
  // Calculate statistics using shared utility
  const statistics = calculateExportStatistics(uploads);
  
  // Title
  data.push(['Creative Audit Report - Summary']);
  data.push(['Generated:', statistics.generatedDate]);
  data.push(['Profile:', profile.name]);
  data.push([]); // Empty row
  
  // Statistics
  data.push(['Metric', 'Value']);
  data.push(['Total Creatives', statistics.totalCreatives]);
  data.push(['Total Checks Run', statistics.totalChecks]);
  data.push(['Failed Checks', statistics.failCount]);
  data.push(['Warning Checks', statistics.warnCount]);
  data.push(['Passed Checks', statistics.passCount]);
  data.push([]); // Empty row
  
  // Performance metrics
  data.push(['Performance Metrics', '']);
  
  const avgZippedKB =
    uploads.reduce((sum, u) => sum + (u.bundleResult.zippedBytes || 0), 0) /
    uploads.length /
    1024;
  const avgInitialKB =
    uploads.reduce((sum, u) => sum + (u.bundleResult.initialBytes || 0), 0) /
    uploads.length /
    1024;
  const avgPoliteKB =
    uploads.reduce((sum, u) => sum + (u.bundleResult.subsequentBytes || 0), 0) /
    uploads.length /
    1024;
  const avgRequests =
    uploads.reduce((sum, u) => sum + (u.bundleResult.totalRequests || 0), 0) /
    uploads.length;
  
  data.push(['Average ZIP Size (KB)', avgZippedKB.toFixed(2)]);
  data.push(['Average Initial Load (KB)', avgInitialKB.toFixed(2)]);
  data.push(['Average Polite Load (KB)', avgPoliteKB.toFixed(2)]);
  data.push(['Average Total Requests', avgRequests.toFixed(0)]);
  
  const sheet = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  sheet['!cols'] = [{ wch: 25 }, { wch: 20 }];
  
  return sheet;
}

/**
 * Create creatives sheet with all upload data
 */
function createCreativesSheet(
  uploads: Upload[],
  profile: ExportProfile
): XLSX.WorkSheet {
  const headers: string[] = [];
  
  if (profile.includeColumns.name) headers.push('Creative Name');
  if (profile.includeColumns.status) headers.push('Status');
  if (profile.includeColumns.dimensions) headers.push('Dimensions');
  if (profile.includeColumns.issues) headers.push('Issues');
  if (profile.includeColumns.fileSize) headers.push('File Size (KB)');
  if (profile.includeColumns.initialKB) headers.push('Initial Load (KB)');
  if (profile.includeColumns.politeKB) headers.push('Polite Load (KB)');
  if (profile.includeColumns.requests) headers.push('Total Requests');
  if (profile.includeColumns.metadata) {
    headers.push('Brand');
    headers.push('Creative Set');
    headers.push('Variant');
  }
  
  const rows: any[][] = [headers];
  
  uploads.forEach(upload => {
    const row: any[] = [];
    
    if (profile.includeColumns.name) {
      row.push(upload.creativeMetadata?.creativeName || upload.bundle.name);
    }
    
    if (profile.includeColumns.status) {
      const failCount = upload.findings.filter(f => f.severity === 'FAIL').length;
      const warnCount = upload.findings.filter(f => f.severity === 'WARN').length;
      row.push(failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS');
    }
    
    if (profile.includeColumns.dimensions) {
      const size = upload.bundleResult.adSize;
      row.push(size ? `${size.width}x${size.height}` : '');
    }
    
    if (profile.includeColumns.issues) {
      const failCount = upload.findings.filter(f => f.severity === 'FAIL').length;
      const warnCount = upload.findings.filter(f => f.severity === 'WARN').length;
      row.push(`${failCount} fail, ${warnCount} warn`);
    }
    
    if (profile.includeColumns.fileSize) {
      row.push(
        upload.bundleResult.zippedBytes
          ? (upload.bundleResult.zippedBytes / 1024).toFixed(2)
          : ''
      );
    }
    
    if (profile.includeColumns.initialKB) {
      row.push(
        upload.bundleResult.initialBytes
          ? (upload.bundleResult.initialBytes / 1024).toFixed(2)
          : ''
      );
    }
    
    if (profile.includeColumns.politeKB) {
      row.push(
        upload.bundleResult.subsequentBytes
          ? (upload.bundleResult.subsequentBytes / 1024).toFixed(2)
          : ''
      );
    }
    
    if (profile.includeColumns.requests) {
      row.push(upload.bundleResult.totalRequests || 0);
    }
    
    if (profile.includeColumns.metadata) {
      row.push(upload.creativeMetadata?.brand || '');
      row.push(upload.creativeMetadata?.creativeName || '');
      row.push(upload.creativeMetadata?.variant || '');
    }
    
    rows.push(row);
  });
  
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  
  // Auto-size columns
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.slice(1).map(row => String(row[i] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 40) };
  });
  sheet['!cols'] = colWidths;
  
  // Add autofilter if enabled
  if (profile.excelOptions?.autoFilter) {
    sheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length - 1, c: headers.length - 1 },
      }),
    };
  }
  
  return sheet;
}

/**
 * Create checks sheet with all findings
 */
function createChecksSheet(
  uploads: Upload[],
  profile: ExportProfile
): XLSX.WorkSheet {
  const headers = [
    'Creative',
    'Check Title',
    'Severity',
    'Messages',
    'Offenders',
    'Profile',
  ];
  
  const rows: any[][] = [headers];
  
  uploads.forEach(upload => {
    const creativeName = upload.creativeMetadata?.creativeName || upload.bundle.name;
    
    let findings = upload.findings;
    if (profile.statusFilter && profile.statusFilter !== 'ALL') {
      findings = findings.filter(f => f.severity === profile.statusFilter);
    }
    
    findings.forEach(finding => {
      rows.push([
        creativeName,
        finding.title,
        finding.severity,
        finding.messages.join(' | '),
        finding.offenders
          .map(o => o.path || o.detail || '')
          .filter(Boolean)
          .join(', '),
        finding.profiles?.join(', ') || '',
      ]);
    });
  });
  
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  
  // Set column widths
  sheet['!cols'] = [
    { wch: 25 }, // Creative
    { wch: 30 }, // Check Title
    { wch: 10 }, // Severity
    { wch: 50 }, // Messages
    { wch: 40 }, // Offenders
    { wch: 15 }, // Profile
  ];
  
  // Add autofilter
  if (profile.excelOptions?.autoFilter) {
    sheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length - 1, c: headers.length - 1 },
      }),
    };
  }
  
  return sheet;
}

/**
 * Create failed checks sheet (issues only)
 */
function createFailedChecksSheet(
  uploads: Upload[],
  profile: ExportProfile
): XLSX.WorkSheet {
  const headers = [
    'Creative',
    'Check Title',
    'Messages',
    'Offenders',
    'Profile',
  ];
  
  const rows: any[][] = [headers];
  
  uploads.forEach(upload => {
    const creativeName = upload.creativeMetadata?.creativeName || upload.bundle.name;
    
    const failedFindings = upload.findings.filter(f => f.severity === 'FAIL');
    
    failedFindings.forEach(finding => {
      rows.push([
        creativeName,
        finding.title,
        finding.messages.join(' | '),
        finding.offenders
          .map(o => o.path || o.detail || '')
          .filter(Boolean)
          .join(', '),
        finding.profiles?.join(', ') || '',
      ]);
    });
  });
  
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  
  // Set column widths
  sheet['!cols'] = [
    { wch: 25 }, // Creative
    { wch: 30 }, // Check Title
    { wch: 50 }, // Messages
    { wch: 40 }, // Offenders
    { wch: 15 }, // Profile
  ];
  
  // Add autofilter
  if (profile.excelOptions?.autoFilter) {
    sheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length - 1, c: headers.length - 1 },
      }),
    };
  }
  
  return sheet;
}

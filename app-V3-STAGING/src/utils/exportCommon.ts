/**
 * Shared Export Utilities
 * Common functions used across all export formats (PDF, Excel, HTML)
 * 
 * Created as part of Phase 5.4: Performance Optimization
 * Consolidates duplicate code across export modules
 */

import type { Upload } from '../types';
import type { Finding } from '../logic/types';

/**
 * Statistics type for all exports
 */
export interface ExportStatistics {
  totalCreatives: number;
  totalChecks: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  avgChecksPerCreative: number;
  generatedDate: string;
}

/**
 * Generate timestamped filename for exports
 * 
 * @param baseFilename Base name for the file (default: 'creative-audit-report')
 * @param extension File extension without dot (e.g., 'pdf', 'xlsx', 'html')
 * @returns Formatted filename with timestamp
 * 
 * @example
 * generateExportFilename('creative-audit-report', 'pdf')
 * // Returns: 'creative-audit-report-2025-01-20.pdf'
 */
export function generateExportFilename(
  baseFilename: string = 'creative-audit-report',
  extension: string
): string {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${baseFilename}-${timestamp}.${extension}`;
}

/**
 * Calculate comprehensive export statistics
 * Used for summary sections in all export formats
 * 
 * @param uploads Array of Upload objects to analyze
 * @returns ExportStatistics object with all calculated metrics
 */
export function calculateExportStatistics(uploads: Upload[]): ExportStatistics {
  const totalCreatives = uploads.length;
  const totalChecks = uploads.reduce((sum, u) => sum + u.findings.length, 0);
  
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  
  uploads.forEach(upload => {
    upload.findings.forEach(finding => {
      if (finding.severity === 'PASS') passCount++;
      else if (finding.severity === 'WARN') warnCount++;
      else if (finding.severity === 'FAIL') failCount++;
    });
  });
  
  return {
    totalCreatives,
    totalChecks,
    passCount,
    warnCount,
    failCount,
    avgChecksPerCreative: totalChecks > 0 ? totalChecks / totalCreatives : 0,
    generatedDate: new Date().toLocaleString(),
  };
}

/**
 * Standardized export logger
 * Provides consistent logging across all export modules
 * 
 * @param format Export format type
 * @param stage Operation stage ('start' or 'complete')
 * @param message Log message
 */
export function logExportOperation(
  format: 'PDF' | 'Excel' | 'HTML',
  stage: 'start' | 'complete',
  message: string
): void {
  const prefix = `[${format}Export]`;
  console.log(`${prefix} ${message}`);
}

/**
 * Get counts by severity from uploads
 * Helper function for statistics calculations
 * 
 * @param uploads Array of Upload objects
 * @returns Object with pass, warn, and fail counts
 */
export function getCountsBySeverity(uploads: Upload[]): {
  passCount: number;
  warnCount: number;
  failCount: number;
} {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;
  
  uploads.forEach(upload => {
    upload.findings.forEach(finding => {
      if (finding.severity === 'PASS') passCount++;
      else if (finding.severity === 'WARN') warnCount++;
      else if (finding.severity === 'FAIL') failCount++;
    });
  });
  
  return { passCount, warnCount, failCount };
}

/**
 * Format file size for display
 * Converts bytes to human-readable format
 * 
 * @param bytes Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get severity color for visual displays
 * Returns consistent colors across all export formats
 * 
 * @param severity Finding severity level
 * @returns RGB color array [r, g, b] for PDF or hex color string for HTML/Excel
 */
export function getSeverityColor(
  severity: 'PASS' | 'WARN' | 'FAIL',
  format: 'rgb' | 'hex' = 'rgb'
): [number, number, number] | string {
  const colors = {
    PASS: { rgb: [76, 175, 80] as [number, number, number], hex: '#4caf50' },
    WARN: { rgb: [255, 152, 0] as [number, number, number], hex: '#ff9800' },
    FAIL: { rgb: [244, 67, 54] as [number, number, number], hex: '#f44336' },
  };
  
  return format === 'rgb' ? colors[severity].rgb : colors[severity].hex;
}

/**
 * Calculate pass rate percentage
 * 
 * @param uploads Array of Upload objects
 * @returns Pass rate as percentage (0-100)
 */
export function calculatePassRate(uploads: Upload[]): number {
  const { passCount, warnCount, failCount } = getCountsBySeverity(uploads);
  const total = passCount + warnCount + failCount;
  
  if (total === 0) return 0;
  
  return Math.round((passCount / total) * 100);
}

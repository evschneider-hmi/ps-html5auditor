/**
 * PDF Export Utility
 * Generates formatted PDF reports using jsPDF
 */

import { jsPDF } from 'jspdf';
import type { Upload } from '../types';
import type { ExportProfile } from './exportProfiles';
import {
  generateExportFilename,
  logExportOperation,
  calculateExportStatistics,
  getCountsBySeverity,
} from './exportCommon';

// Page dimensions
const PAGE_WIDTH = 210; // A4 width in mm
const PAGE_HEIGHT = 297; // A4 height in mm
const MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

// Colors
const COLORS = {
  primary: [33, 150, 243] as [number, number, number], // Blue
  success: [76, 175, 80] as [number, number, number], // Green
  warning: [255, 152, 0] as [number, number, number], // Orange
  error: [244, 67, 54] as [number, number, number], // Red
  text: [33, 33, 33] as [number, number, number],
  lightGray: [240, 240, 240] as [number, number, number],
  darkGray: [158, 158, 158] as [number, number, number],
};

/**
 * Export uploads to PDF
 */
export async function exportToPDF(
  uploads: Upload[],
  profile: ExportProfile
): Promise<void> {
  logExportOperation('PDF', 'start', `Generating PDF with ${uploads.length} creatives`);
  
  const doc = new jsPDF({
    orientation: profile.pdfOptions?.orientation || 'portrait',
    unit: 'mm',
    format: profile.pdfOptions?.pageSize || 'a4',
  });
  
  let yPos = MARGIN;
  
  // Add title page
  yPos = addTitlePage(doc, uploads.length, profile);
  
  // Add summary if requested
  if (profile.includeSummary) {
    doc.addPage();
    yPos = MARGIN;
    yPos = addSummary(doc, uploads, yPos, profile);
  }
  
  // Add individual creative reports
  for (let i = 0; i < uploads.length; i++) {
    const upload = uploads[i];
    
    // Start each creative on a new page
    doc.addPage();
    yPos = MARGIN;
    
    yPos = addCreativeHeader(doc, upload, i + 1, uploads.length, yPos, profile);
    yPos = addCreativeDetails(doc, upload, yPos, profile);
    
    if (profile.includeChecks) {
      yPos = addChecksSection(doc, upload, yPos, profile);
    }
  }
  
  // Add page numbers if requested
  if (profile.pdfOptions?.includePageNumbers) {
    addPageNumbers(doc);
  }
  
  // Generate filename using shared utility
  const filename = generateExportFilename('creative-audit-report', 'pdf');
  
  // Save the PDF
  doc.save(filename);
  logExportOperation('PDF', 'complete', `PDF saved: ${filename}`);
}

/**
 * Add title page
 */
function addTitlePage(
  doc: jsPDF,
  creativeCount: number,
  profile: ExportProfile
): number {
  let yPos = 80;
  
  // Title
  doc.setFontSize(32);
  doc.setTextColor(...COLORS.primary);
  doc.text('Creative Suite Auditor', PAGE_WIDTH / 2, yPos, { align: 'center' });
  
  yPos += 15;
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.text);
  doc.text('Audit Report', PAGE_WIDTH / 2, yPos, { align: 'center' });
  
  // Report info
  yPos += 30;
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.darkGray);
  
  const reportInfo = [
    `Generated: ${new Date().toLocaleString()}`,
    `Creatives Analyzed: ${creativeCount}`,
    `Profile: ${profile.name}`,
  ];
  
  reportInfo.forEach(line => {
    doc.text(line, PAGE_WIDTH / 2, yPos, { align: 'center' });
    yPos += 7;
  });
  
  // Footer
  yPos = PAGE_HEIGHT - 30;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkGray);
  doc.text(
    'Powered by Creative Suite Auditor V3',
    PAGE_WIDTH / 2,
    yPos,
    { align: 'center' }
  );
  
  return yPos;
}

/**
 * Add summary page
 */
function addSummary(
  doc: jsPDF,
  uploads: Upload[],
  yPos: number,
  profile: ExportProfile
): number {
  // Section title
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.primary);
  doc.text('Executive Summary', MARGIN, yPos);
  yPos += 10;
  
  // Calculate statistics using shared utility
  const statistics = calculateExportStatistics(uploads);
  
  const avgFileSize =
    uploads.reduce((sum, u) => sum + (u.bundleResult.zippedBytes || 0), 0) / uploads.length / 1024;
  const avgInitialKB =
    uploads.reduce((sum, u) => sum + (u.bundleResult.initialBytes || 0), 0) /
    uploads.length / 1024;
  const avgPoliteKB =
    uploads.reduce((sum, u) => sum + (u.bundleResult.subsequentBytes || 0), 0) /
    uploads.length / 1024;
  
  // Stats boxes
  const stats = [
    { label: 'Total Creatives', value: statistics.totalCreatives.toString(), color: COLORS.primary },
    { label: 'Checks Run', value: statistics.totalChecks.toString(), color: COLORS.primary },
    { label: 'Failed', value: statistics.failCount.toString(), color: COLORS.error },
    { label: 'Warnings', value: statistics.warnCount.toString(), color: COLORS.warning },
    { label: 'Passed', value: statistics.passCount.toString(), color: COLORS.success },
  ];
  
  const boxWidth = (CONTENT_WIDTH - 10) / stats.length;
  let xPos = MARGIN;
  
  stats.forEach(stat => {
    // Box background
    doc.setFillColor(...COLORS.lightGray);
    doc.rect(xPos, yPos, boxWidth, 25, 'F');
    
    // Value
    doc.setFontSize(16);
    doc.setTextColor(...stat.color);
    doc.text(stat.value, xPos + boxWidth / 2, yPos + 10, { align: 'center' });
    
    // Label
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.text(stat.label, xPos + boxWidth / 2, yPos + 18, { align: 'center' });
    
    xPos += boxWidth + 2;
  });
  
  yPos += 35;
  
  // Performance metrics
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.text);
  doc.text('Performance Metrics', MARGIN, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  const metrics = [
    `Average File Size: ${avgFileSize.toFixed(1)} KB`,
    `Average Initial Load: ${avgInitialKB.toFixed(1)} KB`,
    `Average Polite Load: ${avgPoliteKB.toFixed(1)} KB`,
  ];
  
  metrics.forEach(metric => {
    doc.text(`• ${metric}`, MARGIN + 5, yPos);
    yPos += 6;
  });
  
  return yPos;
}

/**
 * Add creative header
 */
function addCreativeHeader(
  doc: jsPDF,
  upload: Upload,
  index: number,
  total: number,
  yPos: number,
  profile: ExportProfile
): number {
  // Creative number
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkGray);
  doc.text(`Creative ${index} of ${total}`, MARGIN, yPos);
  yPos += 8;
  
  // Creative name
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.primary);
  const creativeName = upload.creativeMetadata?.creativeName || upload.bundle.name;
  doc.text(creativeName, MARGIN, yPos);
  yPos += 10;
  
  // Status badge
  const failCount = upload.findings.filter(f => f.severity === 'FAIL').length;
  const warnCount = upload.findings.filter(f => f.severity === 'WARN').length;
  
  let status = 'PASS';
  let statusColor = COLORS.success;
  
  if (failCount > 0) {
    status = 'FAIL';
    statusColor = COLORS.error;
  } else if (warnCount > 0) {
    status = 'WARN';
    statusColor = COLORS.warning;
  }
  
  doc.setFillColor(...statusColor);
  doc.roundedRect(MARGIN, yPos, 20, 8, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(status, MARGIN + 10, yPos + 5.5, { align: 'center' });
  
  // Issues count
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(10);
  doc.text(
    `${failCount} Issues, ${warnCount} Warnings`,
    MARGIN + 25,
    yPos + 5.5
  );
  
  yPos += 12;
  
  return yPos;
}

/**
 * Add creative details
 */
function addCreativeDetails(
  doc: jsPDF,
  upload: Upload,
  yPos: number,
  profile: ExportProfile
): number {
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text('Details', MARGIN, yPos);
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.darkGray);
  
  const details: string[] = [];
  
  if (profile.includeColumns.dimensions && upload.bundleResult.adSize) {
    details.push(
      `Dimensions: ${upload.bundleResult.adSize.width}x${upload.bundleResult.adSize.height}`
    );
  }
  if (profile.includeColumns.fileSize && upload.bundleResult.zippedBytes) {
    details.push(`File Size: ${(upload.bundleResult.zippedBytes / 1024).toFixed(1)} KB`);
  }
  if (profile.includeColumns.initialKB && upload.bundleResult.initialBytes) {
    details.push(
      `Initial Load: ${(upload.bundleResult.initialBytes / 1024).toFixed(1)} KB`
    );
  }
  if (profile.includeColumns.politeKB && upload.bundleResult.subsequentBytes) {
    details.push(
      `Polite Load: ${(upload.bundleResult.subsequentBytes / 1024).toFixed(1)} KB`
    );
  }
  if (profile.includeColumns.requests && upload.bundleResult.totalRequests) {
    details.push(`Requests: ${upload.bundleResult.totalRequests}`);
  }
  
  // Metadata
  if (profile.includeColumns.metadata && upload.creativeMetadata) {
    const meta = upload.creativeMetadata;
    if (meta.brand) details.push(`Brand: ${meta.brand}`);
    if (meta.creativeName) details.push(`Creative: ${meta.creativeName}`);
    if (meta.variant) details.push(`Variant: ${meta.variant}`);
  }
  
  // Layout details in two columns
  const columnWidth = CONTENT_WIDTH / 2;
  let column = 0;
  
  details.forEach((detail, i) => {
    const xPos = MARGIN + (column * columnWidth);
    doc.text(`• ${detail}`, xPos, yPos);
    
    column = (column + 1) % 2;
    if (column === 0) {
      yPos += 5;
    }
  });
  
  if (column !== 0) {
    yPos += 5;
  }
  
  yPos += 5;
  
  return yPos;
}

/**
 * Add checks section
 */
function addChecksSection(
  doc: jsPDF,
  upload: Upload,
  yPos: number,
  profile: ExportProfile
): number {
  // Filter findings based on profile
  let findings = upload.findings;
  if (profile.statusFilter && profile.statusFilter !== 'ALL') {
    findings = findings.filter(f => f.severity === profile.statusFilter);
  }
  
  if (findings.length === 0) {
    return yPos;
  }
  
  // Section title
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text('Check Results', MARGIN, yPos);
  yPos += 8;
  
  // Add each finding
  for (const finding of findings) {
    // Check if we need a new page
    if (yPos > PAGE_HEIGHT - 40) {
      doc.addPage();
      yPos = MARGIN;
    }
    
    // Status icon
    let statusColor = COLORS.success;
    let statusSymbol = 'P';
    
    if (finding.severity === 'FAIL') {
      statusColor = COLORS.error;
      statusSymbol = 'F';
    } else if (finding.severity === 'WARN') {
      statusColor = COLORS.warning;
      statusSymbol = 'W';
    }
    
    doc.setFontSize(10);
    doc.setTextColor(...statusColor);
    doc.text(statusSymbol, MARGIN, yPos);
    
    // Finding title
    doc.setTextColor(...COLORS.text);
    doc.text(finding.title, MARGIN + 5, yPos);
    yPos += 5;
    
    // Finding messages
    if (finding.messages.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.darkGray);
      const messageText = finding.messages.join(' ');
      const lines = doc.splitTextToSize(messageText, CONTENT_WIDTH - 10);
      doc.text(lines, MARGIN + 5, yPos);
      yPos += lines.length * 4;
    }
    
    // Offenders
    if (profile.includeOffenders && finding.offenders.length > 0) {
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.darkGray);
      
      const offenderPaths = finding.offenders.map(o => o.path || o.detail || '').filter(Boolean);
      const offenderText = offenderPaths.slice(0, 3).join(', ');
      if (offenderPaths.length > 3) {
        doc.text(
          `Offenders: ${offenderText}... (+${offenderPaths.length - 3} more)`,
          MARGIN + 10,
          yPos
        );
      } else if (offenderText) {
        doc.text(`Offenders: ${offenderText}`, MARGIN + 10, yPos);
      }
      yPos += 4;
    }
    
    yPos += 3;
  }
  
  return yPos;
}

/**
 * Add page numbers to all pages
 */
function addPageNumbers(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.darkGray);
    doc.text(
      `Page ${i} of ${pageCount}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 10,
      { align: 'center' }
    );
  }
}

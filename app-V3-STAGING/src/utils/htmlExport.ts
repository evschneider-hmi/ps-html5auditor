/**
 * HTML Export Utility
 * Generates standalone HTML reports with embedded CSS
 */

import type { Upload } from '../types';
import type { ExportProfile } from './exportProfiles';
import {
  generateExportFilename,
  logExportOperation,
  calculateExportStatistics,
} from './exportCommon';

/**
 * Export uploads to standalone HTML file
 */
export async function exportToHTML(
  uploads: Upload[],
  profile: ExportProfile
): Promise<void> {
  logExportOperation('HTML', 'start', `Generating HTML with ${uploads.length} creatives`);
  
  const html = generateHTMLReport(uploads, profile);
  
  // Create blob and download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  // Generate filename using shared utility
  const filename = generateExportFilename('creative-audit-report', 'html');
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  logExportOperation('HTML', 'complete', `HTML saved: ${filename}`);
}

/**
 * Generate complete HTML document
 */
function generateHTMLReport(
  uploads: Upload[],
  profile: ExportProfile
): string {
  const isDark = profile.htmlOptions?.darkMode || false;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Creative Audit Report - ${new Date().toLocaleDateString()}</title>
  ${profile.htmlOptions?.includeCSS !== false ? generateCSS(isDark) : ''}
</head>
<body class="${isDark ? 'dark-mode' : ''}">
  <div class="container">
    ${generateHeader(uploads, profile)}
    ${profile.includeSummary ? generateSummary(uploads, profile) : ''}
    ${generateCreativesList(uploads, profile)}
    ${generateFooter()}
  </div>
  ${profile.htmlOptions?.responsive !== false ? generateResponsiveScript() : ''}
</body>
</html>`;
}

/**
 * Generate embedded CSS
 */
function generateCSS(isDark: boolean): string {
  const colors = isDark
    ? {
        bg: '#1a1a1a',
        surface: '#2d2d2d',
        text: '#e0e0e0',
        textSecondary: '#a0a0a0',
        border: '#404040',
        primary: '#64b5f6',
        success: '#81c784',
        warning: '#ffb74d',
        error: '#e57373',
      }
    : {
        bg: '#f5f5f5',
        surface: '#ffffff',
        text: '#212121',
        textSecondary: '#757575',
        border: '#e0e0e0',
        primary: '#2196f3',
        success: '#4caf50',
        warning: '#ff9800',
        error: '#f44336',
      };
  
  return `<style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: ${colors.bg};
      color: ${colors.text};
      line-height: 1.6;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    .header {
      text-align: center;
      padding: 40px 0;
      border-bottom: 2px solid ${colors.primary};
      margin-bottom: 40px;
    }
    
    .header h1 {
      font-size: 2.5rem;
      color: ${colors.primary};
      margin-bottom: 10px;
    }
    
    .header .subtitle {
      font-size: 1.2rem;
      color: ${colors.textSecondary};
    }
    
    .metadata {
      display: flex;
      justify-content: center;
      gap: 30px;
      margin-top: 20px;
      font-size: 0.9rem;
      color: ${colors.textSecondary};
    }
    
    .section {
      background: ${colors.surface};
      border-radius: 8px;
      padding: 30px;
      margin-bottom: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .section-title {
      font-size: 1.8rem;
      margin-bottom: 20px;
      color: ${colors.text};
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: ${colors.bg};
      border-radius: 6px;
      padding: 20px;
      text-align: center;
      border: 1px solid ${colors.border};
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .stat-label {
      font-size: 0.9rem;
      color: ${colors.textSecondary};
    }
    
    .stat-card.primary .stat-value { color: ${colors.primary}; }
    .stat-card.success .stat-value { color: ${colors.success}; }
    .stat-card.warning .stat-value { color: ${colors.warning}; }
    .stat-card.error .stat-value { color: ${colors.error}; }
    
    .creative-card {
      background: ${colors.bg};
      border-radius: 6px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid ${colors.border};
    }
    
    .creative-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      border-bottom: 1px solid ${colors.border};
      padding-bottom: 15px;
    }
    
    .creative-name {
      font-size: 1.3rem;
      font-weight: 600;
      color: ${colors.text};
    }
    
    .status-badge {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    
    .status-badge.pass {
      background: ${colors.success};
      color: white;
    }
    
    .status-badge.warn {
      background: ${colors.warning};
      color: white;
    }
    
    .status-badge.fail {
      background: ${colors.error};
      color: white;
    }
    
    .creative-details {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin-bottom: 15px;
    }
    
    .detail-item {
      font-size: 0.9rem;
    }
    
    .detail-label {
      color: ${colors.textSecondary};
      font-size: 0.8rem;
    }
    
    .detail-value {
      font-weight: 600;
      color: ${colors.text};
    }
    
    .checks-section {
      margin-top: 15px;
    }
    
    .check-item {
      padding: 10px;
      margin-bottom: 10px;
      border-radius: 4px;
      border-left: 4px solid ${colors.border};
    }
    
    .check-item.fail { border-left-color: ${colors.error}; background: rgba(244, 67, 54, 0.05); }
    .check-item.warn { border-left-color: ${colors.warning}; background: rgba(255, 152, 0, 0.05); }
    .check-item.pass { border-left-color: ${colors.success}; background: rgba(76, 175, 80, 0.05); }
    
    .check-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 5px;
    }
    
    .check-icon {
      font-size: 1.2rem;
    }
    
    .check-title {
      font-weight: 600;
      flex: 1;
    }
    
    .check-severity {
      font-size: 0.75rem;
      padding: 2px 6px;
      border-radius: 3px;
      font-weight: 600;
    }
    
    .check-severity.fail { background: ${colors.error}; color: white; }
    .check-severity.warn { background: ${colors.warning}; color: white; }
    .check-severity.pass { background: ${colors.success}; color: white; }
    
    .check-messages {
      font-size: 0.85rem;
      color: ${colors.textSecondary};
      margin-left: 30px;
    }
    
    .check-offenders {
      font-size: 0.8rem;
      color: ${colors.textSecondary};
      margin-left: 30px;
      margin-top: 5px;
      font-family: 'Courier New', monospace;
    }
    
    .footer {
      text-align: center;
      padding: 40px 0;
      color: ${colors.textSecondary};
      font-size: 0.9rem;
    }
    
    @media (max-width: 768px) {
      .header h1 { font-size: 2rem; }
      .stats-grid { grid-template-columns: 1fr; }
      .creative-details { grid-template-columns: 1fr; }
      .metadata { flex-direction: column; gap: 10px; }
    }
    
    @media print {
      body { background: white; }
      .section { break-inside: avoid; }
      .creative-card { break-inside: avoid; }
    }
  </style>`;
}

/**
 * Generate header section
 */
function generateHeader(uploads: Upload[], profile: ExportProfile): string {
  return `<div class="header">
    <h1>Creative Suite Auditor</h1>
    <div class="subtitle">Audit Report</div>
    <div class="metadata">
      <div>Generated: ${new Date().toLocaleString()}</div>
      <div>Creatives: ${uploads.length}</div>
      <div>Profile: ${profile.name}</div>
    </div>
  </div>`;
}

/**
 * Generate summary section
 */
function generateSummary(uploads: Upload[], profile: ExportProfile): string {
  // Calculate statistics using shared utility
  const statistics = calculateExportStatistics(uploads);
  
  const avgZippedKB =
    uploads.reduce((sum, u) => sum + (u.bundleResult.zippedBytes || 0), 0) /
    uploads.length /
    1024;
  const avgInitialKB =
    uploads.reduce((sum, u) => sum + (u.bundleResult.initialBytes || 0), 0) /
    uploads.length /
    1024;
  
  return `<div class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="stats-grid">
      <div class="stat-card primary">
        <div class="stat-value">${statistics.totalCreatives}</div>
        <div class="stat-label">Total Creatives</div>
      </div>
      <div class="stat-card primary">
        <div class="stat-value">${statistics.totalChecks}</div>
        <div class="stat-label">Checks Run</div>
      </div>
      <div class="stat-card error">
        <div class="stat-value">${statistics.failCount}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${statistics.warnCount}</div>
        <div class="stat-label">Warnings</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${statistics.passCount}</div>
        <div class="stat-label">Passed</div>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${avgZippedKB.toFixed(1)}</div>
        <div class="stat-label">Avg ZIP Size (KB)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgInitialKB.toFixed(1)}</div>
        <div class="stat-label">Avg Initial Load (KB)</div>
      </div>
    </div>
  </div>`;
}

/**
 * Generate creatives list
 */
function generateCreativesList(
  uploads: Upload[],
  profile: ExportProfile
): string {
  const creativesHTML = uploads.map(upload => generateCreativeCard(upload, profile)).join('');
  
  return `<div class="section">
    <h2 class="section-title">Creatives</h2>
    ${creativesHTML}
  </div>`;
}

/**
 * Generate single creative card
 */
function generateCreativeCard(upload: Upload, profile: ExportProfile): string {
  const creativeName = upload.creativeMetadata?.creativeName || upload.bundle.name;
  
  const failCount = upload.findings.filter(f => f.severity === 'FAIL').length;
  const warnCount = upload.findings.filter(f => f.severity === 'WARN').length;
  
  const status = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';
  const statusText = status.toUpperCase();
  
  let findings = upload.findings;
  if (profile.statusFilter && profile.statusFilter !== 'ALL') {
    findings = findings.filter(f => f.severity === profile.statusFilter);
  }
  
  return `<div class="creative-card">
    <div class="creative-header">
      <div class="creative-name">${escapeHTML(creativeName)}</div>
      <div class="status-badge ${status}">${statusText}</div>
    </div>
    
    <div class="creative-details">
      ${generateDetailsSection(upload, profile)}
    </div>
    
    ${profile.includeChecks && findings.length > 0 ? generateChecksHTML(findings, profile) : ''}
  </div>`;
}

/**
 * Generate details section for a creative
 */
function generateDetailsSection(upload: Upload, profile: ExportProfile): string {
  const details: string[] = [];
  
  if (profile.includeColumns.dimensions && upload.bundleResult.adSize) {
    details.push(
      `<div class="detail-item">
        <div class="detail-label">Dimensions</div>
        <div class="detail-value">${upload.bundleResult.adSize.width}x${upload.bundleResult.adSize.height}</div>
      </div>`
    );
  }
  
  if (profile.includeColumns.fileSize && upload.bundleResult.zippedBytes) {
    details.push(
      `<div class="detail-item">
        <div class="detail-label">File Size</div>
        <div class="detail-value">${(upload.bundleResult.zippedBytes / 1024).toFixed(1)} KB</div>
      </div>`
    );
  }
  
  if (profile.includeColumns.initialKB && upload.bundleResult.initialBytes) {
    details.push(
      `<div class="detail-item">
        <div class="detail-label">Initial Load</div>
        <div class="detail-value">${(upload.bundleResult.initialBytes / 1024).toFixed(1)} KB</div>
      </div>`
    );
  }
  
  if (profile.includeColumns.politeKB && upload.bundleResult.subsequentBytes) {
    details.push(
      `<div class="detail-item">
        <div class="detail-label">Polite Load</div>
        <div class="detail-value">${(upload.bundleResult.subsequentBytes / 1024).toFixed(1)} KB</div>
      </div>`
    );
  }
  
  if (profile.includeColumns.requests && upload.bundleResult.totalRequests) {
    details.push(
      `<div class="detail-item">
        <div class="detail-label">Requests</div>
        <div class="detail-value">${upload.bundleResult.totalRequests}</div>
      </div>`
    );
  }
  
  if (profile.includeColumns.metadata && upload.creativeMetadata) {
    if (upload.creativeMetadata.brand) {
      details.push(
        `<div class="detail-item">
          <div class="detail-label">Brand</div>
          <div class="detail-value">${escapeHTML(upload.creativeMetadata.brand)}</div>
        </div>`
      );
    }
  }
  
  return details.join('');
}

/**
 * Generate checks HTML for a creative
 */
function generateChecksHTML(findings: any[], profile: ExportProfile): string {
  const checksHTML = findings
    .map(finding => {
      const icon =
        finding.severity === 'FAIL' ? 'F' : finding.severity === 'WARN' ? 'W' : 'P';
      const severity = finding.severity.toLowerCase();
      
      const offendersHTML =
        profile.includeOffenders && finding.offenders.length > 0
          ? `<div class="check-offenders">
              Offenders: ${finding.offenders
                .map((o: any) => escapeHTML(o.path || o.detail || ''))
                .filter(Boolean)
                .slice(0, 5)
                .join(', ')}
              ${finding.offenders.length > 5 ? '...' : ''}
            </div>`
          : '';
      
      return `<div class="check-item ${severity}">
        <div class="check-header">
          <span class="check-icon">${icon}</span>
          <span class="check-title">${escapeHTML(finding.title)}</span>
          <span class="check-severity ${severity}">${finding.severity}</span>
        </div>
        ${
          finding.messages.length > 0
            ? `<div class="check-messages">${escapeHTML(
                finding.messages.join(' ')
              )}</div>`
            : ''
        }
        ${offendersHTML}
      </div>`;
    })
    .join('');
  
  return `<div class="checks-section">
    <h3 style="margin-bottom: 10px;">Check Results</h3>
    ${checksHTML}
  </div>`;
}

/**
 * Generate footer
 */
function generateFooter(): string {
  return `<div class="footer">
    <div>Powered by Creative Suite Auditor V3</div>
    <div>Generated on ${new Date().toLocaleString()}</div>
  </div>`;
}

/**
 * Generate responsive script
 */
function generateResponsiveScript(): string {
  return `<script>
    // Simple print optimization
    window.addEventListener('beforeprint', () => {
      document.body.classList.add('printing');
    });
    
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing');
    });
  </script>`;
}

/**
 * Escape HTML special characters
 */
function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

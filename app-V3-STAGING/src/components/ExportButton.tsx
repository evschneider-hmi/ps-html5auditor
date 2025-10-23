/**
 * Export Button Component
 * Dropdown menu for exporting to PDF, Excel, or HTML
 * 
 * Phase 5.4 Optimization: Uses dynamic imports to lazy-load export libraries
 * This reduces initial bundle size by ~300 KB gzipped
 */

import { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import type { Upload } from '../types';
import { getDefaultProfile, markProfileUsed, type ExportFormat } from '../utils/exportProfiles';
import './ExportButton.css';

interface ExportButtonProps {
  uploads: Upload[];
  disabled?: boolean;
}

export function ExportButton({ uploads, disabled = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);
  
  const handleExport = async (format: ExportFormat) => {
    if (uploads.length === 0 || isExporting) return;
    
    setIsOpen(false);
    setIsExporting(true);
    
    try {
      console.log(`[ExportButton] Starting ${format.toUpperCase()} export`);
      
      const profile = getDefaultProfile(format);
      markProfileUsed(profile.id);
      
      // Dynamic imports - load export libraries only when needed
      // This reduces initial bundle size significantly
      switch (format) {
        case 'pdf': {
          const { exportToPDF } = await import('../utils/pdfExport');
          await exportToPDF(uploads, profile);
          break;
        }
        case 'excel': {
          const { exportToExcel } = await import('../utils/excelExport');
          await exportToExcel(uploads, profile);
          break;
        }
        case 'html': {
          const { exportToHTML } = await import('../utils/htmlExport');
          await exportToHTML(uploads, profile);
          break;
        }
      }
      
      console.log(`[ExportButton] ${format.toUpperCase()} export complete`);
    } catch (error) {
      console.error(`[ExportButton] Export failed:`, error);
      alert(`Failed to export ${format.toUpperCase()}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };
  
  const isDisabled = disabled || uploads.length === 0 || isExporting;
  
  return (
    <div className="export-button-container" ref={dropdownRef}>
      <button
        className={`export-button ${isDisabled ? 'disabled' : ''}`}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        title={uploads.length === 0 ? 'No creatives to export' : 'Export results'}
      >
        {isExporting ? (
          <>
            <Icon name="spinner" className="export-icon spinning" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Icon name="download" className="export-icon" />
            <span>Export</span>
            <Icon name="chevron-down" className="dropdown-icon" />
          </>
        )}
      </button>
      
      {isOpen && !isDisabled && (
        <div className="export-dropdown">
          <button
            className="export-option"
            onClick={() => handleExport('pdf')}
            title="Export as PDF with formatted report"
          >
            <Icon name="file" className="option-icon" />
            <div className="option-content">
              <div className="option-title">PDF Report</div>
              <div className="option-description">Formatted PDF with summary & checks</div>
            </div>
          </button>
          
          <button
            className="export-option"
            onClick={() => handleExport('excel')}
            title="Export as Excel with multiple sheets"
          >
            <Icon name="file" className="option-icon" />
            <div className="option-content">
              <div className="option-title">Excel Workbook</div>
              <div className="option-description">Multi-sheet Excel with data tables</div>
            </div>
          </button>
          
          <button
            className="export-option"
            onClick={() => handleExport('html')}
            title="Export as standalone HTML file"
          >
            <Icon name="file" className="option-icon" />
            <div className="option-content">
              <div className="option-title">HTML Report</div>
              <div className="option-description">Self-contained HTML with embedded CSS</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

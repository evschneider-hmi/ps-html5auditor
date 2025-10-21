/**
 * Preview Diagnostics Component
 * 
 * Displays comprehensive runtime diagnostics from the preview iframe.
 * Shows all 40+ metrics captured by the runtime probe.
 * 
 * Quality Principles:
 * - Efficiency: Lazy rendering of collapsed categories, memoized calculations
 * - Organization: Clear categorization (timing, tracking, errors, animation, network)
 * - Consistency: Standard expansion panel pattern, metric card layout
 * - Maneuverability: Easy to add new metrics, export functionality, filtering
 */

import React, { useMemo, useState, useCallback } from 'react';
import type { PreviewDiagnostics as DiagnosticsData } from './types';

export interface PreviewDiagnosticsProps {
  /** Diagnostics data from runtime probe */
  diagnostics: DiagnosticsData | null;
  
  /** CSS class name */
  className?: string;
}

/**
 * Metric category definitions
 */
interface MetricCategory {
  id: string;
  title: string;
  icon: string;
  metrics: Array<{
    key: keyof DiagnosticsData;
    label: string;
    format: (value: any) => string;
    isIssue?: (value: any) => boolean;
  }>;
}

/**
 * Format metric value for display
 */
const formatters = {
  milliseconds: (value: number | undefined) => value !== undefined ? `${value}ms` : 'N/A',
  seconds: (value: number | undefined) => value !== undefined ? `${value}s` : 'N/A',
  number: (value: number | undefined) => value !== undefined ? String(value) : 'N/A',
  boolean: (value: boolean | undefined) => value !== undefined ? (value ? 'Yes' : 'No') : 'N/A',
  bytes: (value: number | undefined) => {
    if (value === undefined) return 'N/A';
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  },
  megabytes: (value: number | undefined) => value !== undefined ? `${value.toFixed(2)} MB` : 'N/A',
  url: (value: string | undefined) => value || 'Not detected'
};

/**
 * Check if metric value indicates an issue
 */
const issueCheckers = {
  hasErrors: (value: number | undefined) => value !== undefined && value > 0,
  hasWarnings: (value: number | undefined) => value !== undefined && value > 0,
  isDetected: (value: boolean | undefined) => value === true,
  isInfinite: (value: boolean | undefined) => value === true
};

/**
 * Diagnostics display component
 * 
 * Features:
 * - Categorized metrics (timing, tracking, errors, animation, network)
 * - Collapsible sections
 * - Issue highlighting (red for errors, yellow for warnings)
 * - Export to JSON
 * - Metric search/filter
 * 
 * @example
 * ```tsx
 * <PreviewDiagnosticsPanel
 *   diagnostics={state.diagnostics}
 * />
 * ```
 */
export const PreviewDiagnosticsPanel: React.FC<PreviewDiagnosticsProps> = ({
  diagnostics,
  className = ''
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['timing']));
  const [copySuccess, setCopySuccess] = useState(false);
  
  /**
   * Define metric categories
   */
  const categories: MetricCategory[] = useMemo(() => [
    {
      id: 'timing',
      title: 'Timing Metrics',
      icon: '⏱',
      metrics: [
        { key: 'domContentLoaded', label: 'DOMContentLoaded', format: formatters.milliseconds },
        { key: 'visualStart', label: 'Visual Start', format: formatters.milliseconds },
        { key: 'loadEventTime', label: 'Load Event', format: formatters.milliseconds }
      ]
    },
    {
      id: 'tracking',
      title: 'Tracking & Libraries',
      icon: '📊',
      metrics: [
        { key: 'jquery', label: 'jQuery Detected', format: formatters.boolean, isIssue: issueCheckers.isDetected },
        { key: 'clickUrl', label: 'Click URL', format: formatters.url }
      ]
    },
    {
      id: 'errors',
      title: 'Errors & Warnings',
      icon: '⚠️',
      metrics: [
        { key: 'consoleErrors', label: 'Console Errors', format: formatters.number, isIssue: issueCheckers.hasErrors },
        { key: 'consoleWarnings', label: 'Console Warnings', format: formatters.number, isIssue: issueCheckers.hasWarnings },
        { key: 'errors', label: 'JavaScript Errors', format: formatters.number, isIssue: issueCheckers.hasErrors }
      ]
    },
    {
      id: 'animation',
      title: 'Animation',
      icon: '🎞',
      metrics: [
        { key: 'frames', label: 'Frames Observed', format: formatters.number },
        { key: 'animMaxDurationS', label: 'Max Duration', format: formatters.seconds },
        { key: 'animMaxLoops', label: 'Max Loops', format: formatters.number },
        { key: 'animInfinite', label: 'Infinite Animation', format: formatters.boolean, isIssue: issueCheckers.isInfinite }
      ]
    },
    {
      id: 'network',
      title: 'Network',
      icon: '🌐',
      metrics: [
        { key: 'network', label: 'Network Requests', format: formatters.number },
        { key: 'initialRequests', label: 'Initial Requests', format: formatters.number },
        { key: 'subloadRequests', label: 'Subload Requests', format: formatters.number },
        { key: 'userRequests', label: 'User Requests', format: formatters.number },
        { key: 'totalRequests', label: 'Total Requests', format: formatters.number },
        { key: 'initialBytes', label: 'Initial Bytes', format: formatters.bytes },
        { key: 'subloadBytes', label: 'Subload Bytes', format: formatters.bytes },
        { key: 'userBytes', label: 'User Bytes', format: formatters.bytes },
        { key: 'totalBytes', label: 'Total Bytes', format: formatters.bytes }
      ]
    },
    {
      id: 'dom',
      title: 'DOM & Content',
      icon: '📄',
      metrics: [
        { key: 'domImages', label: 'DOM Images', format: formatters.number },
        { key: 'domBgUrls', label: 'Background URLs', format: formatters.number },
        { key: 'runtimeIframes', label: 'Runtime Iframes', format: formatters.number },
        { key: 'documentWrites', label: 'document.write Calls', format: formatters.number }
      ]
    },
    {
      id: 'storage',
      title: 'Storage & Privacy',
      icon: '🔒',
      metrics: [
        { key: 'cookies', label: 'Cookies Set', format: formatters.number },
        { key: 'localStorage', label: 'localStorage Access', format: formatters.number },
        { key: 'dialogs', label: 'Alert/Confirm Dialogs', format: formatters.number }
      ]
    },
    {
      id: 'performance',
      title: 'Performance',
      icon: '⚡',
      metrics: [
        { key: 'memoryMB', label: 'Current Memory', format: formatters.megabytes },
        { key: 'memoryMinMB', label: 'Min Memory', format: formatters.megabytes },
        { key: 'memoryMaxMB', label: 'Max Memory', format: formatters.megabytes },
        { key: 'cpuScore', label: 'CPU Score', format: formatters.number }
      ]
    },
    {
      id: 'rewrites',
      title: 'URL Rewrites',
      icon: '🔗',
      metrics: [
        { key: 'rewrites', label: 'Total Rewrites', format: formatters.number },
        { key: 'imgRewrites', label: 'Image Rewrites', format: formatters.number },
        { key: 'mediaRewrites', label: 'Media Rewrites', format: formatters.number },
        { key: 'scriptRewrites', label: 'Script Rewrites', format: formatters.number },
        { key: 'linkRewrites', label: 'Link Rewrites', format: formatters.number },
        { key: 'setAttrRewrites', label: 'setAttribute Rewrites', format: formatters.number },
        { key: 'styleUrlRewrites', label: 'Style URL Rewrites', format: formatters.number },
        { key: 'styleAttrRewrites', label: 'Style Attribute Rewrites', format: formatters.number }
      ]
    },
    {
      id: 'border',
      title: 'Border Detection',
      icon: '🔲',
      metrics: [
        { key: 'borderSides', label: 'Border Sides', format: formatters.number },
        { key: 'borderCssRules', label: 'Border CSS Rules', format: formatters.number }
      ]
    },
    {
      id: 'other',
      title: 'Other',
      icon: '📋',
      metrics: [
        { key: 'enablerStub', label: 'Enabler Stub Active', format: formatters.boolean }
      ]
    }
  ], []);
  
  /**
   * Calculate summary stats
   */
  const summary = useMemo(() => {
    if (!diagnostics) return null;
    
    const errors = (diagnostics.consoleErrors || 0) + (diagnostics.errors || 0);
    const warnings = diagnostics.consoleWarnings || 0;
    const issues = errors + warnings;
    
    return {
      errors,
      warnings,
      issues,
      hasIssues: issues > 0
    };
  }, [diagnostics]);
  
  /**
   * Toggle category expansion
   */
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);
  
  /**
   * Expand all categories
   */
  const expandAll = useCallback(() => {
    setExpandedCategories(new Set(categories.map(c => c.id)));
  }, [categories]);
  
  /**
   * Collapse all categories
   */
  const collapseAll = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);
  
  /**
   * Export diagnostics to JSON
   */
  const handleExport = useCallback(() => {
    if (!diagnostics) return;
    
    const json = JSON.stringify(diagnostics, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [diagnostics]);
  
  /**
   * Copy diagnostics to clipboard
   */
  const handleCopy = useCallback(() => {
    if (!diagnostics) return;
    
    const json = JSON.stringify(diagnostics, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [diagnostics]);
  
  if (!diagnostics) {
    return (
      <div className={`preview-diagnostics ${className}`}>
        <div className="preview-diagnostics__empty">
          <p>No diagnostics available</p>
          <p className="preview-diagnostics__hint">
            Run a preview to collect runtime metrics
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`preview-diagnostics ${className}`}>
      {/* Header with summary */}
      <div className="preview-diagnostics__header">
        <div className="preview-diagnostics__summary">
          <span className="preview-diagnostics__label">Diagnostics</span>
          {summary && summary.hasIssues && (
            <span className={`preview-diagnostics__badge ${summary.errors > 0 ? 'preview-diagnostics__badge--error' : 'preview-diagnostics__badge--warning'}`}>
              {summary.errors > 0 && `${summary.errors} errors`}
              {summary.errors > 0 && summary.warnings > 0 && ', '}
              {summary.warnings > 0 && `${summary.warnings} warnings`}
            </span>
          )}
        </div>
        
        <div className="preview-diagnostics__controls">
          <button
            className="preview-diagnostics__button"
            onClick={expandAll}
          >
            Expand All
          </button>
          <button
            className="preview-diagnostics__button"
            onClick={collapseAll}
          >
            Collapse All
          </button>
          <button
            className="preview-diagnostics__button"
            onClick={handleCopy}
          >
            {copySuccess ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            className="preview-diagnostics__button"
            onClick={handleExport}
          >
            💾 Export
          </button>
        </div>
      </div>
      
      {/* Categories */}
      <div className="preview-diagnostics__content">
        {categories.map(category => {
          const isExpanded = expandedCategories.has(category.id);
          
          return (
            <div key={category.id} className="preview-diagnostics__category">
              <button
                className="preview-diagnostics__category-header"
                onClick={() => toggleCategory(category.id)}
              >
                <span className="preview-diagnostics__category-icon">
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span className="preview-diagnostics__category-title">
                  {category.icon} {category.title}
                </span>
                <span className="preview-diagnostics__category-count">
                  {category.metrics.length} metrics
                </span>
              </button>
              
              {isExpanded && (
                <div className="preview-diagnostics__metrics">
                  {category.metrics.map(metric => {
                    const value = diagnostics[metric.key];
                    const formattedValue = metric.format(value);
                    const hasIssue = metric.isIssue?.(value);
                    
                    return (
                      <div
                        key={metric.key}
                        className={`preview-diagnostics__metric ${hasIssue ? 'preview-diagnostics__metric--issue' : ''}`}
                      >
                        <span className="preview-diagnostics__metric-label">
                          {metric.label}
                        </span>
                        <span className="preview-diagnostics__metric-value">
                          {formattedValue}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <style>{`
        .preview-diagnostics {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
        }
        
        .preview-diagnostics__empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }
        
        .preview-diagnostics__hint {
          margin-top: 8px;
          font-size: 12px;
        }
        
        .preview-diagnostics__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .preview-diagnostics__summary {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .preview-diagnostics__label {
          font-weight: 600;
          font-size: 13px;
          color: #0f172a;
        }
        
        .preview-diagnostics__badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
        }
        
        .preview-diagnostics__badge--error {
          background: #fee2e2;
          color: #991b1b;
        }
        
        .preview-diagnostics__badge--warning {
          background: #fef3c7;
          color: #92400e;
        }
        
        .preview-diagnostics__controls {
          display: flex;
          gap: 8px;
        }
        
        .preview-diagnostics__button {
          padding: 6px 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 12px;
          color: #475569;
          cursor: pointer;
          transition: all 150ms;
        }
        
        .preview-diagnostics__button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        
        .preview-diagnostics__content {
          flex: 1;
          overflow: auto;
          padding: 16px;
        }
        
        .preview-diagnostics__category {
          margin-bottom: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          overflow: hidden;
        }
        
        .preview-diagnostics__category-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #f8fafc;
          border: none;
          cursor: pointer;
          transition: background 150ms;
        }
        
        .preview-diagnostics__category-header:hover {
          background: #f1f5f9;
        }
        
        .preview-diagnostics__category-icon {
          font-size: 10px;
          color: #94a3b8;
        }
        
        .preview-diagnostics__category-title {
          flex: 1;
          text-align: left;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }
        
        .preview-diagnostics__category-count {
          font-size: 12px;
          color: #64748b;
        }
        
        .preview-diagnostics__metrics {
          padding: 12px 16px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
        
        .preview-diagnostics__metric {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8fafc;
          border-radius: 4px;
          border-left: 3px solid #e2e8f0;
        }
        
        .preview-diagnostics__metric--issue {
          background: #fef2f2;
          border-left-color: #ef4444;
        }
        
        .preview-diagnostics__metric-label {
          font-size: 12px;
          color: #64748b;
        }
        
        .preview-diagnostics__metric-value {
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
        }
        
        .preview-diagnostics__metric--issue .preview-diagnostics__metric-value {
          color: #dc2626;
        }
      `}</style>
    </div>
  );
};

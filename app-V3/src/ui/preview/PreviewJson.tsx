/**
 * Preview JSON Component
 * 
 * Displays bundle metadata as formatted, collapsible JSON.
 * 
 * Quality Principles:
 * - Efficiency: Lazy rendering of collapsed nodes, memoized formatting
 * - Organization: Clear hierarchy with indentation and colors
 * - Consistency: Standard JSON viewer patterns
 * - Maneuverability: Easy to add search, filtering, export
 */

import React, { useMemo, useState, useCallback } from 'react';
import type { PreviewInfo } from './types';

export interface PreviewJsonProps {
  /** Bundle metadata */
  previewInfo: PreviewInfo;
  
  /** CSS class name */
  className?: string;
}

/**
 * JSON node type
 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Collapsible JSON node component
 */
const JsonNode: React.FC<{
  name?: string;
  value: JsonValue;
  level: number;
  defaultExpanded?: boolean;
}> = ({ name, value, level, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const isExpandable = typeof value === 'object' && value !== null;
  const isArray = Array.isArray(value);
  const isEmpty = isExpandable && (isArray ? value.length === 0 : Object.keys(value).length === 0);
  
  const indent = level * 20;
  
  if (!isExpandable) {
    // Primitive value
    let displayValue = String(value);
    let valueClass = 'preview-json__value--';
    
    if (typeof value === 'string') {
      displayValue = `"${value}"`;
      valueClass += 'string';
    } else if (typeof value === 'number') {
      valueClass += 'number';
    } else if (typeof value === 'boolean') {
      valueClass += 'boolean';
    } else if (value === null) {
      valueClass += 'null';
    }
    
    return (
      <div className="preview-json__line" style={{ paddingLeft: `${indent}px` }}>
        {name && <span className="preview-json__key">{name}: </span>}
        <span className={`preview-json__value ${valueClass}`}>{displayValue}</span>
      </div>
    );
  }
  
  // Object or array
  const children = isArray ? value : Object.entries(value);
  const childCount = isArray ? value.length : Object.keys(value).length;
  
  return (
    <div className="preview-json__node">
      <div
        className="preview-json__line preview-json__line--expandable"
        style={{ paddingLeft: `${indent}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="preview-json__toggle">
          {isExpandable && !isEmpty ? (expanded ? '▼' : '▶') : ' '}
        </span>
        {name && <span className="preview-json__key">{name}: </span>}
        <span className="preview-json__bracket">
          {isArray ? '[' : '{'}
        </span>
        {!expanded && !isEmpty && (
          <span className="preview-json__summary">
            {childCount} {isArray ? 'items' : 'keys'}
          </span>
        )}
        {!expanded && (
          <span className="preview-json__bracket">
            {isArray ? ']' : '}'}
          </span>
        )}
      </div>
      
      {expanded && !isEmpty && (
        <>
          {isArray ? (
            <>
              {(value as JsonValue[]).map((item, index) => (
                <JsonNode
                  key={index}
                  value={item}
                  level={level + 1}
                />
              ))}
            </>
          ) : (
            <>
              {Object.entries(value as Record<string, JsonValue>).map(([key, val]) => (
                <JsonNode
                  key={key}
                  name={key}
                  value={val}
                  level={level + 1}
                />
              ))}
            </>
          )}
          <div className="preview-json__line" style={{ paddingLeft: `${indent}px` }}>
            <span className="preview-json__bracket">
              {isArray ? ']' : '}'}
            </span>
          </div>
        </>
      )}
      
      {isEmpty && expanded && (
        <div className="preview-json__line" style={{ paddingLeft: `${indent}px` }}>
          <span className="preview-json__bracket">
            {isArray ? ']' : '}'}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * JSON metadata viewer component
 * 
 * Features:
 * - Collapsible tree structure
 * - Syntax highlighting
 * - Copy to clipboard
 * - Expand/collapse all
 * 
 * @example
 * ```tsx
 * <PreviewJson
 *   previewInfo={bundleInfo}
 * />
 * ```
 */
export const PreviewJson: React.FC<PreviewJsonProps> = ({
  previewInfo,
  className = ''
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  
  /**
   * Format metadata as JSON string
   */
  const jsonString = useMemo(() => {
    return JSON.stringify(previewInfo, null, 2);
  }, [previewInfo]);
  
  /**
   * Handle copy to clipboard
   */
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }, [jsonString]);
  
  /**
   * Calculate JSON size
   */
  const jsonSize = useMemo(() => {
    const bytes = new TextEncoder().encode(jsonString).length;
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  }, [jsonString]);
  
  return (
    <div className={`preview-json ${className}`}>
      {/* Header */}
      <div className="preview-json__header">
        <div className="preview-json__info">
          <span className="preview-json__label">Bundle Metadata</span>
          <span className="preview-json__stats">{jsonSize}</span>
        </div>
        
        <div className="preview-json__controls">
          <button
            className="preview-json__button"
            onClick={() => setExpandAll(!expandAll)}
          >
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            className="preview-json__button"
            onClick={handleCopy}
          >
            {copySuccess ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>
      
      {/* JSON tree */}
      <div className="preview-json__content">
        <JsonNode value={previewInfo as unknown as JsonValue} level={0} defaultExpanded={expandAll} />
      </div>
      
      <style>{`
        .preview-json {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
        }
        
        .preview-json__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .preview-json__info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .preview-json__label {
          font-weight: 600;
          font-size: 13px;
          color: #0f172a;
        }
        
        .preview-json__stats {
          font-size: 12px;
          color: #64748b;
        }
        
        .preview-json__controls {
          display: flex;
          gap: 8px;
        }
        
        .preview-json__button {
          padding: 6px 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 12px;
          color: #475569;
          cursor: pointer;
          transition: all 150ms;
        }
        
        .preview-json__button:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        
        .preview-json__content {
          flex: 1;
          overflow: auto;
          padding: 16px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          line-height: 1.6;
        }
        
        .preview-json__line {
          padding: 2px 0;
          cursor: default;
        }
        
        .preview-json__line--expandable {
          cursor: pointer;
        }
        
        .preview-json__line--expandable:hover {
          background: #f8fafc;
        }
        
        .preview-json__toggle {
          display: inline-block;
          width: 16px;
          color: #94a3b8;
          font-size: 10px;
          user-select: none;
        }
        
        .preview-json__key {
          color: #7c3aed;
          font-weight: 500;
        }
        
        .preview-json__bracket {
          color: #64748b;
        }
        
        .preview-json__summary {
          margin-left: 8px;
          color: #94a3b8;
          font-size: 12px;
          font-style: italic;
        }
        
        .preview-json__value {
          color: #0f172a;
        }
        
        .preview-json__value--string {
          color: #16a34a;
        }
        
        .preview-json__value--number {
          color: #ea580c;
        }
        
        .preview-json__value--boolean {
          color: #0ea5e9;
        }
        
        .preview-json__value--null {
          color: #94a3b8;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

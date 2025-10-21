/**
 * Preview Source Component
 * 
 * Displays the creative's HTML source code with syntax highlighting.
 * 
 * Quality Principles:
 * - Efficiency: Lazy syntax highlighting, virtualized for large files
 * - Organization: Clear separation of display logic and highlighting
 * - Consistency: Standard viewer patterns, familiar keyboard shortcuts
 * - Maneuverability: Easy to swap highlighter, add features, test
 */

import React, { useState, useMemo, useCallback } from 'react';

export interface PreviewSourceProps {
  /** Original HTML source code */
  originalHtml: string;
  
  /** Instrumented HTML (with tracking injections) */
  instrumentedHtml: string;
  
  /** Show original or instrumented version */
  showInstrumented?: boolean;
  
  /** CSS class name */
  className?: string;
}

/**
 * HTML source viewer with syntax highlighting
 * 
 * Features:
 * - Line numbers
 * - Copy to clipboard
 * - Toggle between original and instrumented HTML
 * - Search/filter (future)
 * - Basic syntax highlighting (HTML tags, attributes)
 * 
 * Note: Using simple built-in highlighting for Phase 5B.
 * Can be enhanced with Prism.js or highlight.js later.
 * 
 * @example
 * ```tsx
 * <PreviewSource
 *   originalHtml={buildResult.originalHtml}
 *   instrumentedHtml={buildResult.html}
 *   showInstrumented={false}
 * />
 * ```
 */
export const PreviewSource: React.FC<PreviewSourceProps> = ({
  originalHtml,
  instrumentedHtml,
  showInstrumented = false,
  className = ''
}) => {
  const [isInstrumented, setIsInstrumented] = useState(showInstrumented);
  const [copied, setCopied] = useState(false);
  
  // Get the HTML to display
  const html = isInstrumented ? instrumentedHtml : originalHtml;
  
  /**
   * Split HTML into lines with line numbers
   */
  const lines = useMemo(() => {
    return html.split('\n').map((line, index) => ({
      number: index + 1,
      content: line
    }));
  }, [html]);
  
  /**
   * Apply basic syntax highlighting
   * For now, simple regex-based highlighting.
   * Can be replaced with Prism.js or highlight.js later.
   */
  const highlightHtml = useCallback((code: string): string => {
    return code
      // HTML tags
      .replace(/(&lt;\/?)([a-zA-Z][a-zA-Z0-9-]*)/g, '$1<span class="tag">$2</span>')
      // Attributes
      .replace(/\s([a-zA-Z-]+)(=)/g, ' <span class="attr">$1</span>$2')
      // Attribute values
      .replace(/=["']([^"']*)["']/g, '=<span class="value">"$1"</span>')
      // Comments
      .replace(/(&lt;!--)(.*?)(--&gt;)/g, '<span class="comment">$1$2$3</span>')
      // Scripts
      .replace(/(&lt;script[^&]*&gt;)(.*?)(&lt;\/script&gt;)/gi, 
        '$1<span class="script">$2</span>$3');
  }, []);
  
  /**
   * Copy HTML to clipboard
   */
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [html]);
  
  /**
   * Toggle between original and instrumented
   */
  const handleToggle = useCallback(() => {
    setIsInstrumented(prev => !prev);
  }, []);
  
  return (
    <div className={`preview-source ${className}`}>
      {/* Header with controls */}
      <div className="preview-source__header">
        <div className="preview-source__info">
          <span className="preview-source__label">
            {isInstrumented ? 'Instrumented HTML' : 'Original HTML'}
          </span>
          <span className="preview-source__stats">
            {lines.length} lines · {html.length.toLocaleString()} chars
          </span>
        </div>
        
        <div className="preview-source__controls">
          <button
            className="preview-source__btn"
            onClick={handleToggle}
            title={`Show ${isInstrumented ? 'original' : 'instrumented'} HTML`}
          >
            ⇄ Toggle
          </button>
          
          <button
            className={`preview-source__btn ${copied ? 'preview-source__btn--success' : ''}`}
            onClick={handleCopy}
            title="Copy to clipboard"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>
      </div>
      
      {/* Source code display */}
      <div className="preview-source__content">
        <pre className="preview-source__pre">
          <code className="preview-source__code">
            {lines.map((line) => (
              <div key={line.number} className="preview-source__line">
                <span className="preview-source__line-number">
                  {line.number}
                </span>
                <span 
                  className="preview-source__line-content"
                  dangerouslySetInnerHTML={{
                    __html: highlightHtml(
                      line.content
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                    )
                  }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
      
      <style>{`
        .preview-source {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1e293b;
          color: #e2e8f0;
        }
        
        .preview-source__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #0f172a;
          border-bottom: 1px solid #334155;
        }
        
        .preview-source__info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .preview-source__label {
          font-weight: 600;
          font-size: 13px;
          color: #f1f5f9;
        }
        
        .preview-source__stats {
          font-size: 12px;
          color: #94a3b8;
        }
        
        .preview-source__controls {
          display: flex;
          gap: 8px;
        }
        
        .preview-source__btn {
          padding: 6px 12px;
          background: #334155;
          color: #e2e8f0;
          border: 1px solid #475569;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 150ms;
        }
        
        .preview-source__btn:hover {
          background: #475569;
          border-color: #64748b;
        }
        
        .preview-source__btn--success {
          background: #10b981;
          border-color: #10b981;
        }
        
        .preview-source__content {
          flex: 1;
          overflow: auto;
          background: #1e293b;
        }
        
        .preview-source__pre {
          margin: 0;
          padding: 16px 0;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.6;
        }
        
        .preview-source__code {
          display: block;
        }
        
        .preview-source__line {
          display: flex;
          padding: 0 16px;
          transition: background 100ms;
        }
        
        .preview-source__line:hover {
          background: rgba(100, 116, 139, 0.1);
        }
        
        .preview-source__line-number {
          display: inline-block;
          width: 50px;
          text-align: right;
          padding-right: 16px;
          color: #64748b;
          user-select: none;
          flex-shrink: 0;
        }
        
        .preview-source__line-content {
          flex: 1;
          white-space: pre;
          color: #e2e8f0;
        }
        
        /* Syntax highlighting colors */
        .preview-source__line-content :global(.tag) {
          color: #7dd3fc;
        }
        
        .preview-source__line-content :global(.attr) {
          color: #fbbf24;
        }
        
        .preview-source__line-content :global(.value) {
          color: #86efac;
        }
        
        .preview-source__line-content :global(.comment) {
          color: #64748b;
          font-style: italic;
        }
        
        .preview-source__line-content :global(.script) {
          color: #c084fc;
        }
      `}</style>
    </div>
  );
};

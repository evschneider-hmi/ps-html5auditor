/**
 * Preview Controls Component
 * 
 * Provides interactive controls for the preview system.
 * 
 * Quality Principles:
 * - Efficiency: Debounced resize inputs, memoized handlers
 * - Organization: Grouped controls (actions, settings, export)
 * - Consistency: Standard button/input patterns
 * - Maneuverability: Easy to add new controls, keyboard shortcuts
 */

import React, { useState, useCallback, useEffect } from 'react';

export interface PreviewControlsProps {
  /** Current preview dimensions */
  dimensions: { width: number; height: number } | null;
  
  /** Whether preview is ready */
  ready: boolean;
  
  /** Whether debug mode is enabled */
  debug: boolean;
  
  /** Current HTML content */
  html?: string;
  
  /** Reload callback */
  onReload: () => void;
  
  /** Resize callback */
  onResize: (width: number, height: number) => void;
  
  /** Debug toggle callback */
  onDebugToggle: (enabled: boolean) => void;
  
  /** CSS class name */
  className?: string;
}

/**
 * Preview controls component
 * 
 * Features:
 * - Reload button
 * - Resize controls (width/height inputs)
 * - Debug mode toggle
 * - Export preview HTML
 * - Keyboard shortcuts (R for reload, D for debug)
 * 
 * @example
 * ```tsx
 * <PreviewControls
 *   dimensions={{ width: 300, height: 250 }}
 *   ready={true}
 *   debug={false}
 *   html={previewHtml}
 *   onReload={() => reload()}
 *   onResize={(w, h) => resize(w, h)}
 *   onDebugToggle={(enabled) => setDebug(enabled)}
 * />
 * ```
 */
export const PreviewControls: React.FC<PreviewControlsProps> = ({
  dimensions,
  ready,
  debug,
  html,
  onReload,
  onResize,
  onDebugToggle,
  className = ''
}) => {
  const [width, setWidth] = useState(dimensions?.width || 300);
  const [height, setHeight] = useState(dimensions?.height || 250);
  const [resizeMode, setResizeMode] = useState(false);
  
  /**
   * Update local dimensions when prop changes
   */
  useEffect(() => {
    if (dimensions) {
      setWidth(dimensions.width);
      setHeight(dimensions.height);
    }
  }, [dimensions]);
  
  /**
   * Handle reload
   */
  const handleReload = useCallback(() => {
    onReload();
  }, [onReload]);
  
  /**
   * Handle resize apply
   */
  const handleApplyResize = useCallback(() => {
    if (width > 0 && height > 0) {
      onResize(width, height);
      setResizeMode(false);
    }
  }, [width, height, onResize]);
  
  /**
   * Handle resize cancel
   */
  const handleCancelResize = useCallback(() => {
    if (dimensions) {
      setWidth(dimensions.width);
      setHeight(dimensions.height);
    }
    setResizeMode(false);
  }, [dimensions]);
  
  /**
   * Handle debug toggle
   */
  const handleDebugToggle = useCallback(() => {
    onDebugToggle(!debug);
  }, [debug, onDebugToggle]);
  
  /**
   * Handle export HTML
   */
  const handleExport = useCallback(() => {
    if (!html) return;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [html]);
  
  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // R = Reload
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (ready) handleReload();
      }
      
      // D = Debug
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleDebugToggle();
      }
      
      // E = Export
      if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (ready && html) handleExport();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ready, html, handleReload, handleDebugToggle, handleExport]);
  
  return (
    <div className={`preview-controls ${className}`}>
      {/* Action buttons */}
      <div className="preview-controls__group">
        <button
          className="preview-controls__button preview-controls__button--primary"
          onClick={handleReload}
          disabled={!ready}
          title="Reload preview (R)"
        >
          ↻ Reload
        </button>
        
        <button
          className="preview-controls__button"
          onClick={() => setResizeMode(!resizeMode)}
          disabled={!ready}
          title="Resize preview"
        >
          Resize
        </button>
        
        <button
          className={`preview-controls__button ${debug ? 'preview-controls__button--active' : ''}`}
          onClick={handleDebugToggle}
          title="Toggle debug mode (D)"
        >
          Debug
        </button>
        
        <button
          className="preview-controls__button"
          onClick={handleExport}
          disabled={!ready || !html}
          title="Export preview HTML (E)"
        >
          Export
        </button>
      </div>
      
      {/* Resize controls */}
      {resizeMode && (
        <div className="preview-controls__resize">
          <div className="preview-controls__resize-inputs">
            <label className="preview-controls__label">
              Width
              <input
                type="number"
                className="preview-controls__input"
                value={width}
                onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
                min="1"
                max="2000"
              />
            </label>
            
            <span className="preview-controls__separator">×</span>
            
            <label className="preview-controls__label">
              Height
              <input
                type="number"
                className="preview-controls__input"
                value={height}
                onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
                min="1"
                max="2000"
              />
            </label>
          </div>
          
          <div className="preview-controls__resize-actions">
            <button
              className="preview-controls__button preview-controls__button--small preview-controls__button--primary"
              onClick={handleApplyResize}
            >
              Apply
            </button>
            <button
              className="preview-controls__button preview-controls__button--small"
              onClick={handleCancelResize}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
      {/* Keyboard shortcuts hint */}
      <div className="preview-controls__hint">
        Shortcuts: R (reload), D (debug), E (export)
      </div>
      
      <style>{`
        .preview-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .preview-controls__group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .preview-controls__button {
          padding: 8px 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #475569;
          cursor: pointer;
          transition: all 150ms;
        }
        
        .preview-controls__button:hover:not(:disabled) {
          background: #f8fafc;
          border-color: #cbd5e1;
        }
        
        .preview-controls__button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .preview-controls__button--primary {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #ffffff;
        }
        
        .preview-controls__button--primary:hover:not(:disabled) {
          background: #2563eb;
          border-color: #2563eb;
        }
        
        .preview-controls__button--active {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #3b82f6;
        }
        
        .preview-controls__button--small {
          padding: 6px 12px;
          font-size: 12px;
        }
        
        .preview-controls__resize {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        
        .preview-controls__resize-inputs {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .preview-controls__label {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 11px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
        }
        
        .preview-controls__input {
          padding: 6px 8px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 13px;
          color: #0f172a;
          width: 80px;
        }
        
        .preview-controls__input:focus {
          outline: none;
          border-color: #3b82f6;
        }
        
        .preview-controls__separator {
          font-size: 16px;
          color: #94a3b8;
          margin-top: 18px;
        }
        
        .preview-controls__resize-actions {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }
        
        .preview-controls__hint {
          font-size: 11px;
          color: #94a3b8;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

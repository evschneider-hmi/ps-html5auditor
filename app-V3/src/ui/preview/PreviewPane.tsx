/**
 * Preview Pane Component
 * 
 * Main orchestrator for the preview system. Coordinates all preview
 * functionality including loading, error handling, tabs, and iframe display.
 * 
 * Quality Principles:
 * - Efficiency: Lazy loads tabs, memoizes expensive operations
 * - Organization: Clear component hierarchy, single responsibility
 * - Consistency: Follows V3 component patterns, standard props
 * - Maneuverability: Easy to test, swap implementations, add features
 */

import React, { useState } from 'react';
import { usePreviewManager } from './hooks/usePreviewManager';
import { PreviewIframe } from './PreviewIframe';
import { PreviewTabs } from './PreviewTabs';
import { PreviewSource } from './PreviewSource';
import { PreviewAssets } from './PreviewAssets';
import { PreviewJson } from './PreviewJson';
import { PreviewDiagnosticsPanel } from './PreviewDiagnosticsPanel';
import { PreviewControls } from './PreviewControls';
import type { PreviewInfo, PreviewTab, PreviewBuildOptions } from './types';

export interface PreviewPaneProps {
  /** Unique identifier for this preview */
  bundleId: string;
  
  /** Preview configuration */
  previewInfo: PreviewInfo;
  
  /** Bundle files (path -> bytes) */
  files: Record<string, Uint8Array>;
  
  /** Build options */
  buildOptions?: PreviewBuildOptions;
  
  /** Enable debug mode */
  debug?: boolean;
  
  /** CSS class name */
  className?: string;
}

/**
 * Main preview pane component
 * 
 * Manages the entire preview experience including:
 * - Loading states with spinner
 * - Error display with retry
 * - Tab navigation
 * - Live preview iframe
 * - Future: Source, Assets, JSON tabs
 * 
 * @example
 * ```tsx
 * <PreviewPane
 *   bundleId="my-creative"
 *   previewInfo={{ baseDir: '300x250/', indexPath: 'index.html' }}
 *   files={bundleFiles}
 *   debug={true}
 * />
 * ```
 */
export const PreviewPane: React.FC<PreviewPaneProps> = ({
  bundleId,
  previewInfo,
  files,
  buildOptions,
  debug = false,
  className = ''
}) => {
  // State
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  
  // Preview management
  const { state, actions, iframeRef } = usePreviewManager({
    bundleId,
    previewInfo,
    files,
    buildOptions,
    debug
  });
  
  /**
   * Handles tab change
   */
  const handleTabChange = (tab: PreviewTab) => {
    setActiveTab(tab);
  };
  
  /**
   * Handles reload button click
   */
  const handleReload = () => {
    actions.reload();
  };
  
  return (
    <div className={`preview-pane ${className}`} data-bundle-id={bundleId}>
      {/* Header with tabs */}
      <div className="preview-pane__header">
        <PreviewTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabs={['preview', 'source', 'assets', 'json', 'diagnostics']} // All tabs enabled
        />
      </div>
      
      {/* Controls */}
      <PreviewControls
        dimensions={state.dimensions}
        ready={state.ready}
        debug={debug}
        html={state.buildResult?.html}
        onReload={actions.reload}
        onResize={actions.resize}
        onDebugToggle={(enabled) => {
          // Debug toggle can be handled via parent component
          console.log('Debug toggled:', enabled);
        }}
      />
      
      {/* Content area */}
      <div className="preview-pane__content">
        {/* Loading state */}
        {state.loading && (
          <div className="preview-pane__loading">
            <div className="preview-pane__spinner" />
            <p>Building preview...</p>
          </div>
        )}
        
        {/* Error state */}
        {state.error && !state.loading && (
          <div className="preview-pane__error">
            <div className="preview-pane__error-icon">△</div>
            <h3>Preview Failed</h3>
            <p>{state.error}</p>
            <button
              className="preview-pane__retry-btn"
              onClick={handleReload}
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Preview iframe */}
        {state.ready && !state.loading && activeTab === 'preview' && (
          <PreviewIframe
            ref={iframeRef}
            html={state.buildResult?.html || ''}
            bundleId={bundleId}
            dimensions={state.dimensions}
            debug={debug}
          />
        )}
        
        {/* Source tab */}
        {state.ready && !state.loading && activeTab === 'source' && state.buildResult && (
          <PreviewSource
            originalHtml={state.buildResult.originalHtml}
            instrumentedHtml={state.buildResult.html}
          />
        )}
        
        {/* Assets tab */}
        {state.ready && !state.loading && activeTab === 'assets' && (
          <PreviewAssets
            files={files}
            blobUrls={state.blobUrls}
          />
        )}
        
        {/* JSON tab */}
        {state.ready && !state.loading && activeTab === 'json' && (
          <PreviewJson
            previewInfo={previewInfo}
          />
        )}
        
        {/* Diagnostics tab */}
        {activeTab === 'diagnostics' && (
          <PreviewDiagnosticsPanel
            diagnostics={state.diagnostics}
          />
        )}
      </div>
      
      {/* Diagnostics bar (compact, bottom) */}
      {state.diagnostics && (
        <div className="preview-pane__diagnostics">
          {state.diagnostics.domContentLoaded && (
            <span title="DOMContentLoaded">
              T {state.diagnostics.domContentLoaded}ms
            </span>
          )}
          {state.diagnostics.frames !== undefined && (
            <span title="Frames observed">
              {state.diagnostics.frames} frames
            </span>
          )}
          {state.diagnostics.consoleErrors !== undefined && state.diagnostics.consoleErrors > 0 && (
            <span title="Console errors" className="preview-pane__diagnostic--error">
              ✕ {state.diagnostics.consoleErrors} errors
            </span>
          )}
          {state.dimensions && (
            <span title="Creative dimensions">
              {state.dimensions.width}x{state.dimensions.height}
            </span>
          )}
        </div>
      )}
      
      <style>{`
        .preview-pane {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .preview-pane__header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .preview-pane__controls {
          display: flex;
          gap: 8px;
        }
        
        .preview-pane__reload-btn,
        .preview-pane__retry-btn {
          padding: 6px 12px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 150ms;
        }
        
        .preview-pane__reload-btn:hover,
        .preview-pane__retry-btn:hover {
          background: #2563eb;
        }
        
        .preview-pane__content {
          flex: 1;
          position: relative;
          overflow: auto;
          background: #f8fafc;
        }
        
        .preview-pane__loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 16px;
          color: #64748b;
        }
        
        .preview-pane__spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: preview-spin 800ms linear infinite;
        }
        
        @keyframes preview-spin {
          to { transform: rotate(360deg); }
        }
        
        .preview-pane__error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          padding: 24px;
          text-align: center;
          color: #64748b;
        }
        
        .preview-pane__error-icon {
          font-size: 48px;
        }
        
        .preview-pane__error h3 {
          margin: 0;
          color: #dc2626;
          font-size: 18px;
        }
        
        .preview-pane__error p {
          margin: 0;
          font-size: 14px;
          max-width: 400px;
        }
        
        .preview-pane__placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #64748b;
          font-size: 14px;
        }
        
        .preview-pane__diagnostics {
          display: flex;
          gap: 16px;
          padding: 8px 16px;
          background: #f1f5f9;
          border-top: 1px solid #e2e8f0;
          font-size: 12px;
          color: #475569;
        }
        
        .preview-pane__diagnostics span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .preview-pane__diagnostic--error {
          color: #dc2626;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

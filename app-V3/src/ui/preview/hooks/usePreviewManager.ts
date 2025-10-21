/**
 * Preview Manager Hook
 * 
 * Orchestrates the entire preview system:
 * - Creates blob URLs for bundle files
 * - Builds instrumented HTML
 * - Manages iframe lifecycle
 * - Handles message communication
 * - Tracks diagnostics
 * - Provides preview control interface
 * 
 * This hook is the main entry point for preview functionality,
 * coordinating all other preview hooks and utilities.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useBlobUrls } from './useBlobUrls';
import { useIframeMessaging } from './useIframeMessaging';
import { buildPreviewHtml } from '../utils/buildPreviewHtml';
import type { 
  PreviewInfo, 
  PreviewDiagnostics, 
  PreviewBuildOptions,
  PreviewBuildResult 
} from '../types';

export interface PreviewManagerOptions {
  /** Unique identifier for this preview instance */
  bundleId: string;
  
  /** Preview configuration */
  previewInfo: PreviewInfo;
  
  /** Bundle files (path -> bytes) */
  files: Record<string, Uint8Array>;
  
  /** Build options */
  buildOptions?: PreviewBuildOptions;
  
  /** Enable debug logging */
  debug?: boolean;
}

export interface PreviewManagerState {
  /** Whether preview is currently loading */
  loading: boolean;
  
  /** Current error if any */
  error: string | null;
  
  /** Whether preview is ready to display */
  ready: boolean;
  
  /** Built HTML result */
  buildResult: PreviewBuildResult | null;
  
  /** Current diagnostics data */
  diagnostics: PreviewDiagnostics | null;
  
  /** Detected creative dimensions */
  dimensions: { width: number; height: number } | null;
  
  /** Blob URLs for all files */
  blobUrls: Record<string, string>;
}

export interface PreviewManagerActions {
  /** Reload the preview */
  reload: () => void;
  
  /** Resize the preview */
  resize: (width: number, height: number) => void;
  
  /** Clear current preview */
  clear: () => void;
}

/**
 * Main preview orchestration hook
 * 
 * @example
 * ```tsx
 * const { state, actions, iframeRef } = usePreviewManager({
 *   bundleId: 'my-creative',
 *   previewInfo: { baseDir: '300x250/', indexPath: 'index.html' },
 *   files: bundleFiles,
 *   debug: true
 * });
 * 
 * return (
 *   <div>
 *     {state.loading && <Spinner />}
 *     {state.error && <Error message={state.error} />}
 *     {state.ready && (
 *       <iframe ref={iframeRef} srcDoc={state.buildResult.html} />
 *     )}
 *   </div>
 * );
 * ```
 */
export const usePreviewManager = ({
  bundleId,
  previewInfo,
  files,
  buildOptions = {},
  debug = false
}: PreviewManagerOptions) => {
  // State
  const [state, setState] = useState<PreviewManagerState>({
    loading: false,
    error: null,
    ready: false,
    buildResult: null,
    diagnostics: null,
    dimensions: null,
    blobUrls: {}
  });
  
  // Refs
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadingRef = useRef(false);
  
  // Hooks
  const { blobUrls, createBlobUrls, cleanup: cleanupBlobUrls } = useBlobUrls();
  const { sendMessage, addListener, removeListener } = useIframeMessaging(iframeRef, {
    bundleId,
    debug
  });
  
  /**
   * Builds the preview HTML with blob URLs
   */
  const buildPreview = useCallback(async () => {
    if (loadingRef.current) {
      if (debug) console.log('[PreviewManager] Already loading, skipping');
      return;
    }
    
    loadingRef.current = true;
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      if (debug) console.log('[PreviewManager] Creating blob URLs for', Object.keys(files).length, 'files');
      
      // Create blob URLs for all files
      const blobUrlMap = createBlobUrls(files);
      
      // Convert to Map for buildPreviewHtml
      const blobMap = new Map<string, string>();
      for (const [key, value] of Object.entries(blobUrlMap)) {
        blobMap.set(key, value);
      }
      
      if (debug) console.log('[PreviewManager] Building preview HTML');
      
      // Build instrumented HTML
      const buildResult = await buildPreviewHtml({
        bundleId,
        baseDir: previewInfo.baseDir,
        indexPath: previewInfo.indexPath,
        files,
        blobMap,
        options: buildOptions
      });
      
      if (debug) {
        console.log('[PreviewManager] Preview built successfully');
        if (buildResult.missingAssets && buildResult.missingAssets.length > 0) {
          console.warn('[PreviewManager] Missing assets:', buildResult.missingAssets);
        }
      }
      
      setState(prev => ({
        ...prev,
        loading: false,
        ready: true,
        buildResult,
        blobUrls: blobUrlMap,
        error: null
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[PreviewManager] Build failed:', errorMessage);
      
      setState(prev => ({
        ...prev,
        loading: false,
        ready: false,
        error: errorMessage
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [bundleId, previewInfo, files, buildOptions, debug, createBlobUrls]);
  
  /**
   * Handles tracking updates from the iframe
   */
  const handleTrackingUpdate = useCallback((data: any) => {
    if (debug) console.log('[PreviewManager] Tracking update:', data);
    
    setState(prev => ({
      ...prev,
      diagnostics: {
        ...prev.diagnostics,
        ...data
      }
    }));
  }, [debug]);
  
  /**
   * Handles dimension detection from iframe
   */
  const handleDimensionDetected = useCallback((data: any) => {
    if (data.width && data.height) {
      if (debug) console.log('[PreviewManager] Dimensions detected:', data.width, 'x', data.height);
      
      setState(prev => ({
        ...prev,
        dimensions: { width: data.width, height: data.height }
      }));
    }
  }, [debug]);
  
  /**
   * Handles errors from the iframe
   */
  const handleError = useCallback((data: any) => {
    console.error('[PreviewManager] iframe error:', data);
    
    setState(prev => ({
      ...prev,
      error: data.message || 'Unknown error occurred in preview'
    }));
  }, []);
  
  /**
   * Reloads the preview
   */
  const reload = useCallback(() => {
    if (debug) console.log('[PreviewManager] Reloading preview');
    
    // Clear current state
    setState(prev => ({
      ...prev,
      loading: false,
      ready: false,
      buildResult: null,
      diagnostics: null,
      dimensions: null,
      error: null
    }));
    
    // Cleanup blob URLs
    cleanupBlobUrls();
    
    // Rebuild
    buildPreview();
  }, [debug, cleanupBlobUrls, buildPreview]);
  
  /**
   * Resizes the preview (sends message to iframe)
   */
  const resize = useCallback((width: number, height: number) => {
    if (debug) console.log('[PreviewManager] Resizing to', width, 'x', height);
    
    sendMessage('resize', { width, height });
    
    setState(prev => ({
      ...prev,
      dimensions: { width, height }
    }));
  }, [debug, sendMessage]);
  
  /**
   * Clears the preview
   */
  const clear = useCallback(() => {
    if (debug) console.log('[PreviewManager] Clearing preview');
    
    setState({
      loading: false,
      error: null,
      ready: false,
      buildResult: null,
      diagnostics: null,
      dimensions: null,
      blobUrls: {}
    });
    
    cleanupBlobUrls();
  }, [debug, cleanupBlobUrls]);
  
  // Set up message listeners
  useEffect(() => {
    addListener('tracking-update', handleTrackingUpdate);
    addListener('dimension-detected', handleDimensionDetected);
    addListener('error', handleError);
    
    return () => {
      removeListener('tracking-update', handleTrackingUpdate);
      removeListener('dimension-detected', handleDimensionDetected);
      removeListener('error', handleError);
    };
  }, [addListener, removeListener, handleTrackingUpdate, handleDimensionDetected, handleError]);
  
  // Build preview on mount or when dependencies change
  useEffect(() => {
    buildPreview();
  }, [buildPreview]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupBlobUrls();
    };
  }, [cleanupBlobUrls]);
  
  const actions: PreviewManagerActions = {
    reload,
    resize,
    clear
  };
  
  return {
    state,
    actions,
    iframeRef
  };
};

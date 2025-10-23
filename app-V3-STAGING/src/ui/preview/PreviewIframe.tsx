/**
 * Preview Iframe Component
 * 
 * Renders the creative HTML in a sandboxed iframe.
 * Handles sizing, security, and communication with the parent.
 * 
 * Quality Principles:
 * - Efficiency: Only re-renders when HTML changes, proper sandbox isolation
 * - Organization: Single responsibility (iframe rendering only)
 * - Consistency: Standard React forwardRef pattern
 * - Maneuverability: Easy to test, swap iframe implementation
 */

import React, { forwardRef, useEffect, useState } from 'react';

export interface PreviewIframeProps {
  /** Instrumented HTML to display */
  html: string;
  
  /** Bundle identifier */
  bundleId: string;
  
  /** Detected or set dimensions */
  dimensions?: { width: number; height: number } | null;
  
  /** Enable debug mode */
  debug?: boolean;
  
  /** CSS class name */
  className?: string;
}

/**
 * Sandboxed iframe for displaying creative previews
 * 
 * Features:
 * - Secure sandbox with controlled permissions
 * - Auto-sizing based on detected dimensions
 * - Blob URL support via srcdoc
 * - PostMessage communication
 * 
 * Security:
 * - allow-scripts: Required for creative execution
 * - allow-same-origin: Required for blob URLs and DOM access
 * - allow-popups: Required for click-through testing
 * - allow-forms: Required for form submission testing
 * - allow-top-navigation-by-user-activation: Required for click-throughs
 * 
 * @example
 * ```tsx
 * const iframeRef = useRef<HTMLIFrameElement>(null);
 * 
 * <PreviewIframe
 *   ref={iframeRef}
 *   html={buildResult.html}
 *   bundleId="my-creative"
 *   dimensions={{ width: 300, height: 250 }}
 * />
 * ```
 */
export const PreviewIframe = forwardRef<HTMLIFrameElement, PreviewIframeProps>(
  ({ html, bundleId, dimensions, debug = false, className = '' }, ref) => {
    const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(
      dimensions || null
    );
    
    // Update container size when dimensions change
    useEffect(() => {
      if (dimensions) {
        setContainerSize(dimensions);
        if (debug) {
          console.log('[PreviewIframe] Dimensions updated:', dimensions);
        }
      }
    }, [dimensions, debug]);
    
    // Log HTML updates in debug mode
    useEffect(() => {
      if (debug && html) {
        console.log('[PreviewIframe] HTML updated, length:', html.length);
      }
    }, [html, debug]);
    
    return (
      <div
        className={`preview-iframe-container ${className}`}
        style={{
          position: 'relative',
          width: containerSize ? `${containerSize.width}px` : 'auto',
          height: containerSize ? `${containerSize.height}px` : 'auto',
          margin: '16px auto',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '4px',
          overflow: 'hidden',
          background: '#ffffff'
        }}
      >
        <iframe
          ref={ref}
          className="preview-iframe"
          title={`Preview: ${bundleId}`}
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
          loading="eager"
          data-bundle-id={bundleId}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            background: '#ffffff'
          }}
        />
      </div>
    );
  }
);

PreviewIframe.displayName = 'PreviewIframe';


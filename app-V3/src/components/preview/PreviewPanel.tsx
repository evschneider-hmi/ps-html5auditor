import React, { useRef, useState, useEffect, useCallback } from 'react';
import type { ZipBundle, BundleResult, Finding } from '../../logic/types';
import { TabNavigation, type PreviewTab } from './TabNavigation';
import { SourceView } from './SourceView';
import { AssetsView } from './AssetsView';
import { JsonView } from './JsonView';
import { MetadataButton } from './MetadataButton';
import enablerShimSource from './enablerShim.js?raw';
import { getEnhancedProbeScript } from '../../ui/preview/utils/enhancedProbe';

export interface PreviewPanelProps {
  bundle: ZipBundle;
  bundleResult: BundleResult;
  findings: Finding[];
  creativeName: string;
}

// Track active blob URLs for cleanup
const activeBlobUrls = new Set<string>();

const cleanupBlobUrls = () => {
  activeBlobUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('[V3 Preview] Failed to revoke blob URL:', e);
    }
  });
  activeBlobUrls.clear();
};

/**
 * Generate preview HTML using blob URLs + blob map injection (V2 approach)
 */
const generatePreviewHtml = (
  files: Record<string, Uint8Array>,
  indexPath: string,
  baseDir: string
): string => {
  try {
    console.log('[V3 Preview] Using Blob URL approach (no service worker)');
    
    // Create blob map
    const blobMap = new Map<string, string>();
    const bufferMap = new Map<string, Uint8Array>();
    
    // Create blob URLs for all files
    Object.entries(files).forEach(([path, bytes]) => {
      const normalized = path.replace(/\\/g, '/').replace(/^\/+/, '');
      bufferMap.set(normalized, bytes);
      
      // Skip CSS files for now - we'll inline them
      if (normalized.endsWith('.css')) {
        console.log('[V3 Preview] Deferring CSS file:', normalized);
        return;
      }
      
      // Create blob URL for other files
      const mimeType = getMimeType(normalized);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blob = new Blob([bytes as any], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      activeBlobUrls.add(blobUrl);
      blobMap.set(normalized, blobUrl);
      console.log('[V3 Preview] Created Blob URL for:', normalized);
    });
    
    // Process CSS files - rewrite url() references before creating blob URLs
    Array.from(bufferMap.keys())
      .filter(path => path.endsWith('.css'))
      .forEach((cssPath) => {
        const cssBuffer = bufferMap.get(cssPath);
        if (!cssBuffer) return;
        
        try {
          console.log('[V3 Preview] Processing CSS file:', cssPath);
          const decoder = new TextDecoder('utf-8');
          let cssContent = decoder.decode(cssBuffer);
          
          // Rewrite url() references
          let rewriteCount = 0;
          cssContent = cssContent.replace(
            /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
            (match, quote, url) => {
              if (/^(https?:|data:|blob:|\/\/)/.test(url)) return match;
              if (url.startsWith('#')) return match;
              
              const normalized = url.replace(/\\/g, '/').replace(/^\.\//, '');
              const withBase = (baseDir + normalized).replace(/\/\//g, '/').replace(/^\//, '');
              
              let blobUrl = blobMap.get(normalized) || blobMap.get(withBase);
              
              // Try searching by filename
              if (!blobUrl) {
                const filename = normalized.split('/').pop();
                for (const [key, value] of blobMap.entries()) {
                  if (key.endsWith('/' + filename) || key === filename) {
                    blobUrl = value;
                    break;
                  }
                }
              }
              
              if (blobUrl) {
                rewriteCount++;
                console.log('[V3 Preview] CSS: Rewrote url():', url, '→', blobUrl.substring(0, 50) + '...');
                return 'url(' + quote + blobUrl + quote + ')';
              }
              
              return match;
            }
          );
          
          console.log('[V3 Preview] CSS file', cssPath, 'rewrote', rewriteCount, 'url() references');
          
          // Create blob URL for processed CSS
          const cssBlob = new Blob([cssContent], { type: 'text/css; charset=utf-8' });
          const cssBlobUrl = URL.createObjectURL(cssBlob);
          activeBlobUrls.add(cssBlobUrl);
          blobMap.set(cssPath, cssBlobUrl);
          console.log('[V3 Preview] Created Blob URL for CSS:', cssPath);
        } catch (error) {
          console.error('[V3 Preview] Failed to process CSS:', cssPath, error);
        }
      });
    
    console.log('[V3 Preview] Blob URLs ready, total:', blobMap.size);
    
    // Find index.html
    const indexCandidates = [
      indexPath,
      baseDir + indexPath,
      baseDir + 'index.html',
      'index.html',
    ];
    
    let htmlBuffer: Uint8Array | undefined;
    for (const candidate of indexCandidates) {
      const normalized = candidate.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/\//g, '/');
      htmlBuffer = bufferMap.get(normalized);
      if (htmlBuffer) {
        console.log('[V3 Preview] Found index at:', normalized);
        break;
      }
    }
    
    if (!htmlBuffer) {
      console.error('[V3 Preview] Could not find index.html in bundle');
      return '';
    }
    
    // Decode HTML
    const decoder = new TextDecoder('utf-8');
    let html = decoder.decode(htmlBuffer);
    
    // Teresa fix: Strip inline positioning styles that position elements offscreen
    // GSAP animations should move them into view, but if animations fail they stay offscreen
    // Remove inline `left:` styles so CSS positioning (fixed to left: 0px) takes effect
    const beforeTeresaFix = html;
    
    // DEBUG: Check if we have any style="..." with left: in it
    const hasStyleLeft = html.match(/style=["'][^"']*left:/gi);
    console.log('[V3 Preview] Found style attributes with left:', hasStyleLeft ? hasStyleLeft.length : 0);
    if (hasStyleLeft && hasStyleLeft.length > 0) {
      console.log('[V3 Preview] First match:', hasStyleLeft[0]);
    }
    
    html = html.replace(
      /(<[^>]+\s)style=["']([^"']*?)\bleft:\s*-?\d+px;?\s*([^"']*)["']/gi,
      (_match, tagStart, styleBefore, styleAfter) => {
        const remainingStyle = (styleBefore + ' ' + styleAfter).trim();
        if (remainingStyle) {
          return `${tagStart}style="${remainingStyle}"`;
        } else {
          return tagStart.trimEnd();  // Remove empty style attribute
        }
      }
    );
    if (html !== beforeTeresaFix) {
      console.log('[V3 Preview] Teresa inline positioning styles stripped for visibility');
    } else {
      console.log('[V3 Preview] No Teresa inline positioning styles found to strip');
    }
    
    // CRITICAL: Rewrite all img src attributes to use blob URLs
    // This is necessary for static <img> tags that load before JavaScript runs
    // (e.g., Google Web Designer creatives with hardcoded images)
    html = html.replace(
      /<img([^>]+)src\s*=\s*(['"])([^'"]+)\2/gi,
      (match, attrs, quote, src) => {
        // Skip already resolved blob URLs and external URLs
        if (src.startsWith('blob:') || src.startsWith('data:') || src.startsWith('http:') || src.startsWith('https:')) {
          return match;
        }
        
        // Normalize the path
        const normalized = src.replace(/\\/g, '/').replace(/^\.\//, '');
        const withBase = (baseDir + '/' + normalized).replace(/\/\//g, '/').replace(/^\//, '');
        
        // Try to resolve from blob map
        let blobUrl = blobMap.get(normalized) || blobMap.get(withBase);
        
        // Try filename-only match if no direct match found
        if (!blobUrl) {
          const filename = normalized.split('/').pop();
          if (filename) {
            for (const [key, value] of blobMap.entries()) {
              if (key.endsWith('/' + filename) || key === filename) {
                blobUrl = value;
                break;
              }
            }
          }
        }
        
        if (blobUrl) {
          console.log('[V3 Preview] Rewrote <img src>:', src, '→', blobUrl.substring(0, 60) + '...');
          return '<img' + attrs + 'src=' + quote + blobUrl + quote;
        }
        
        console.warn('[V3 Preview] Failed to resolve <img src>:', src);
        return match;
      }
    );
    
    // Inline CSS files
    Array.from(blobMap.keys())
      .filter(path => path.endsWith('.css'))
      .forEach((cssPath) => {
        const cssBuffer = bufferMap.get(cssPath);
        if (!cssBuffer) return;
        
        try {
          const decoder = new TextDecoder('utf-8');
          let cssContent = decoder.decode(cssBuffer);
          
          // Rewrite url() references again for inlined CSS
          cssContent = cssContent.replace(
            /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
            (match, quote, url) => {
              if (/^(https?:|data:|blob:|\/\/)/.test(url)) return match;
              if (url.startsWith('#')) return match;
              
              const normalized = url.replace(/\\/g, '/').replace(/^\.\//, '');
              const withBase = (baseDir + normalized).replace(/\/\//g, '/').replace(/^\//, '');
              
              let blobUrl = blobMap.get(normalized) || blobMap.get(withBase);
              
              if (!blobUrl) {
                const filename = normalized.split('/').pop();
                for (const [key, value] of blobMap.entries()) {
                  if (key.endsWith('/' + filename) || key === filename) {
                    blobUrl = value;
                    break;
                  }
                }
              }
              
              if (blobUrl) {
                console.log('[V3 Preview] Inlined CSS: Rewrote url():', url, '→', blobUrl.substring(0, 50) + '...');
                return 'url(' + quote + blobUrl + quote + ')';
              }
              
              return match;
            }
          );
          
          // FIX: Don't modify CSS positioning - let GSAP animations work naturally
          // Combined.js now executes properly after window.load with GSAP loaded from CDN
          
          const styleTag = '<style data-v3-inlined="' + cssPath + '">\n' + cssContent + '\n</style>';
          html = html.replace('</head>', styleTag + '\n</head>');
          console.log('[V3 Preview] Inlined CSS file:', cssPath, '(' + cssContent.length + ' bytes)');
        } catch (error) {
          console.error('[V3 Preview] Failed to inline CSS:', cssPath, error);
        }
      });
    
    // Inline JavaScript files
    // NOTE: Teresa creatives load combined.js dynamically via Enabler.getUrl() in enablerInitHandler
    // We should NOT inline combined.js, ISI_Expander.js, or PauseButton.js - let them load via blob URLs
    // This matches V2's successful approach and avoids race conditions with window.onload
    Array.from(bufferMap.entries())
      .filter(([jsPath]) => 
        jsPath.endsWith('.js') && 
        !jsPath.includes('Enabler') &&
        !jsPath.includes('ISI_Expander') &&
        !jsPath.includes('PauseButton') &&
        !jsPath.includes('combined.js')  // Don't inline combined.js - let it load dynamically
      )
      .forEach(([jsPath, jsBuffer]) => {
        try {
          const decoder = new TextDecoder('utf-8');
          let jsContent = decoder.decode(jsBuffer);
          
          // Escape script tags
          jsContent = jsContent
            .replace(/<\/script>/gi, '<\\/script>')
            .replace(/<script/gi, '<\\script')
            .replace(/<!--/g, '<\\!--')
            .replace(/-->/g, '--\\>');
          
          // CRITICAL: Wait for both DOM and external GSAP/CDN scripts to load
          // Teresa creatives load GSAP from CDN, and combined.js depends on it
          // We need to wait for window.load (all resources) not just DOMContentLoaded
          const wrappedJS = '(function() {\n' +
            '  function executeInlinedScript() {\n' +
            '    console.log("[V3 Preview] Executing inlined script: ' + jsPath + '");\n' +
            jsContent + '\n' +
            '  }\n' +
            '  // Wait for window.load to ensure GSAP and other CDN resources are ready\n' +
            '  if (document.readyState === "complete") {\n' +
            '    executeInlinedScript();\n' +
            '  } else {\n' +
            '    window.addEventListener("load", executeInlinedScript);\n' +
            '  }\n' +
            '})();';
          
          const scriptTag = '<script data-v3-inlined="' + jsPath + '">\n' + wrappedJS + '\n</' + 'script>';
          if (html.includes('</body>')) {
            html = html.replace('</body>', scriptTag + '\n</body>');
          } else {
            html = html.replace('</head>', scriptTag + '\n</head>');
          }
          console.log('[V3 Preview] Inlined JavaScript file:', jsPath, '(' + jsContent.length + ' bytes)');
        } catch (error) {
          console.error('[V3 Preview] Failed to inline JavaScript:', jsPath, error);
        }
      });
    
    // Don't remove dynamic loading - combined.js should load via Enabler.getUrl()
    // The blob URL will be resolved by our Enabler shim
    // html = html.replace(...) - REMOVED
    
    // CRITICAL: Inject CSS to remove scrollbars and ensure clean preview
    // NOTE: Don't override width/height as some creatives use media queries that depend on exact dimensions
    const previewStyleTag = '<style data-v3-preview-styles>\n' +
      'html, body {\n' +
      '  margin: 0 !important;\n' +
      '  padding: 0 !important;\n' +
      '  overflow: hidden !important;\n' +
      '}\n' +
      '/* DEBUG: Force Teresa container visible */\n' +
      '#container {\n' +
      '  opacity: 1 !important;\n' +
      '}\n' +
      '</' + 'style>';
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', previewStyleTag + '\n</head>');
    } else if (html.includes('<body')) {
      html = html.replace('<body', previewStyleTag + '\n<body');
    } else {
      html = previewStyleTag + '\n' + html;
    }
    
    // CRITICAL: Inject blob map FIRST, before any other scripts
    // This ensures the enabler shim can access it when hijacking Image constructor
    const blobMapJson = JSON.stringify(Array.from(blobMap.entries()));
    const blobMapScript = '<script data-v3-blob-map-injection>\n' +
      '(function() {\n' +
      '  window.__CM360_BASE_DIR__ = ' + JSON.stringify(baseDir) + ';\n' +
      '  window.__CM360_BLOB_MAP__ = new Map(' + blobMapJson + ');\n' +
      '  console.log("[V3 Preview] Blob map injected, size:", window.__CM360_BLOB_MAP__.size);\n' +
      '})();\n' +
      '</' + 'script>';
    
    if (html.includes('</head>')) {
      html = html.replace('</head>', blobMapScript + '\n</head>');
    } else {
      html = blobMapScript + '\n' + html;
    }
    
    // Inject Enabler shim AFTER blob map is available
    const enablerShimTag = '<script data-v3-enabler-shim>\n' + enablerShimSource + '\n</' + 'script>';
    if (html.includes('</head>')) {
      html = html.replace('</head>', enablerShimTag + '\n</head>');
    } else if (html.includes('<body')) {
      html = html.replace('<body', enablerShimTag + '\n<body');
    } else {
      html = enablerShimTag + '\n' + html;
    }
    
    // CRITICAL: Remove external Enabler.js script to prevent it from overwriting our shim
    // Teresa and other CM360 creatives load Enabler from CDN, but we need our shim with blob URL support
    html = html.replace(
      /<script[^>]+src=["']https?:\/\/[^"']*\/Enabler\.js["'][^>]*>[\s\S]*?<\/script>/gi,
      '<!-- V3 Preview: External Enabler script removed, using shim instead -->'
    );
    
    // Inject Enhanced Probe for animation tracking and diagnostics
    const probeScript = getEnhancedProbeScript();
    const probeTag = '<script data-v3-enhanced-probe>\n' + probeScript + '\n</' + 'script>';
    if (html.includes('</head>')) {
      html = html.replace('</head>', probeTag + '\n</head>');
    } else if (html.includes('<body')) {
      html = html.replace('<body', probeTag + '\n<body');
    } else {
      html = probeTag + '\n' + html;
    }
    
    return html;
  } catch (error) {
    console.error('[V3 Preview] Failed to generate preview HTML:', error);
    return '';
  }
};

/**
 * Get MIME type for file extension
 */
const getMimeType = (path: string): string => {
  if (path.endsWith('.html')) return 'text/html; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.ttf')) return 'font/ttf';
  return 'application/octet-stream';
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  bundle,
  bundleResult,
  findings,
  creativeName,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [iframeKey, setIframeKey] = useState(0);
  const [activeTab, setActiveTab] = useState<PreviewTab>('preview');
  const [assetLoadErrors, setAssetLoadErrors] = useState<string[]>([]);

  // Load/save active tab from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('previewActiveTab');
    if (saved && ['preview', 'source', 'assets', 'json'].includes(saved)) {
      setActiveTab(saved as PreviewTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('previewActiveTab', activeTab);
  }, [activeTab]);

  // Generate preview HTML when bundle changes
  useEffect(() => {
    if (!bundle || !bundleResult.primary) {
      setPreviewHtml('');
      return;
    }
    
    const primary = bundleResult.primary;
    const indexPath = primary.path || 'index.html';
    const baseDir = indexPath.includes('/') 
      ? indexPath.substring(0, indexPath.lastIndexOf('/') + 1)
      : '';
    
    console.log('[V3 Preview] Generating preview HTML');
    console.log('[V3 Preview] Index path:', indexPath);
    console.log('[V3 Preview] Base dir:', baseDir);
    console.log('[V3 Preview] Total files:', Object.keys(bundle.files).length);
    
    const html = generatePreviewHtml(bundle.files, indexPath, baseDir);
    
    if (html) {
      setPreviewHtml(html);
      console.log('[V3 Preview] Preview HTML generated successfully');
    } else {
      setPreviewHtml('');
      console.error('[V3 Preview] Failed to generate preview HTML');
    }
  }, [bundle, bundleResult]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      cleanupBlobUrls();
    };
  }, []);

  // Monitor asset loading errors in iframe
  useEffect(() => {
    if (!iframeRef.current || !previewHtml) return;

    const iframe = iframeRef.current;
    const errors: string[] = [];

    const checkAssetLoading = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;

        // Check for failed images
        const images = iframeDoc.querySelectorAll('img');
        console.log('[V3 Preview] Checking image loading, found:', images.length, 'images');
        
        images.forEach((img) => {
          const imgSrc = img.src.split('/').pop() || 'unknown';
          console.log('[V3 Preview] Image check:', imgSrc, '- complete:', img.complete, 'naturalHeight:', img.naturalHeight);
          
          if (!img.complete || img.naturalHeight === 0) {
            errors.push(`Image: ${imgSrc}`);
            console.error('[V3 Preview] ✗ Image failed to load:', img.src);
          }
        });

        // NOTE: Script and stylesheet checks disabled because:
        // 1. We inline combined.js and combined.css directly into HTML
        // 2. Dynamic scripts loaded via Enabler.getUrl() use blob map (not src attributes)
        // 3. These checks were causing false positive warnings

        if (errors.length > 0) {
          console.warn('[V3 Preview] Asset loading errors detected:', errors);
          setAssetLoadErrors(errors);
        } else {
          console.log('[V3 Preview] ✓ All images loaded successfully');
          setAssetLoadErrors([]);
        }
      } catch (e) {
        console.warn('[V3 Preview] Could not check asset loading:', e);
      }
    };

    // Check after iframe loads and after a short delay for dynamic loading
    iframe.addEventListener('load', () => {
      setTimeout(checkAssetLoading, 1000);
    });

    return () => {
      iframe.removeEventListener('load', checkAssetLoading);
    };
  }, [previewHtml, iframeKey]);

  // Listen for diagnostics messages from enhanced probe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      try {
        if (!event.data || typeof event.data !== 'object') return;
        
        if (event.data.type === 'tracking-update') {
          console.log('[V3 Preview] Diagnostics update received:', event.data.data);
          // TODO: Store diagnostics in state and pass to DiagnosticsPanel
          // For now, just log to verify probe is working
        }
      } catch (error) {
        console.error('[V3 Preview] Error handling message:', error);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleReload = useCallback(() => {
    setIframeKey(prev => prev + 1);
  }, []);

  const renderTabContent = () => {
    // Get creative dimensions for proper sizing
    const creativeWidth = bundleResult.adSize?.width;
    const creativeHeight = bundleResult.adSize?.height;
    
    switch (activeTab) {
      case 'preview':
        return (
          <div style={{ 
            width: '100%', 
            height: '100%', 
            background: '#f5f5f5', 
            display: 'flex', 
            alignItems: 'flex-start', 
            justifyContent: 'flex-start',
            padding: '20px',
            boxSizing: 'border-box',
            overflow: 'auto'
          }}>
            {previewHtml ? (
              <iframe
                key={iframeKey}
                ref={iframeRef}
                srcDoc={previewHtml}
                title="Creative Preview"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
                style={{
                  width: creativeWidth ? `${creativeWidth}px` : '100%',
                  height: creativeHeight ? `${creativeHeight}px` : '100%',
                  border: 'none',
                  display: 'block',
                  background: 'white',
                  flexShrink: 0,
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
              />
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                  Preview Unavailable
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  Unable to load creative preview
                </div>
              </div>
            )}
          </div>
        );
      case 'source':
        return <SourceView bundle={bundle} />;
      case 'assets':
        return <AssetsView bundle={bundle} />;
      case 'json':
        return <JsonView findings={findings} creativeName={creativeName} />;
      default:
        return null;
    }
  };

  const dimensions = bundleResult.adSize || { width: 300, height: 250 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>Preview</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: '#666' }}>
            {dimensions.width} × {dimensions.height}
          </div>
          <MetadataButton bundle={bundle} bundleResult={bundleResult} />
          <button
            onClick={handleReload}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px 8px',
            }}
            title="Refresh preview"
          >
            ⟳
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Asset Loading Warning Banner */}
      {activeTab === 'preview' && assetLoadErrors.length > 0 && (
        <div style={{
          background: '#dc3545',
          color: 'white',
          padding: '12px 16px',
          fontSize: '13px',
          fontWeight: 500,
          borderBottom: '1px solid #bd2130',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>
              Warning: Some assets failed to load ({assetLoadErrors.length})
            </div>
            <div style={{ fontSize: '12px', opacity: 0.9 }}>
              The creative may not display correctly. Missing: {assetLoadErrors.slice(0, 3).join(', ')}
              {assetLoadErrors.length > 3 && ` and ${assetLoadErrors.length - 3} more`}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

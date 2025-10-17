import swUrl from './sw.js?url';
import enablerShimSource from './enablerShim.js?raw';

export interface PreviewHtmlOptions {
  bundleId: string;
  baseDir: string;
  indexPath: string;
}

const deriveScopePrefix = (url: string): string => {
  try {
    const parsed = new URL(url, 'https://preview.local');
    const segments = parsed.pathname.split('/');
    segments.pop();
    const base = segments.join('/') || '/';
    const normalized = base.endsWith('/') ? base : `${base}/`;
    return `${normalized}__cm360/`;
  } catch {
    return '/__cm360/';
  }
};

export const PREVIEW_SCOPE_PREFIX = deriveScopePrefix(swUrl);

const sanitizeBundleId = (value: string): string => {
  const trimmed = value?.trim?.() ?? '';
  return encodeURIComponent(trimmed || 'bundle');
};

export const buildPreviewHtml = ({
  bundleId,
  baseDir,
  indexPath,
}: PreviewHtmlOptions): string => {
  const safeBundleId = sanitizeBundleId(bundleId);
  const scopePath = `${PREVIEW_SCOPE_PREFIX}${safeBundleId}/`;
  const config = {
    bundleId,
    baseDir,
    indexPath,
    scopePath,
  };

  const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CM360 Preview</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      body {
        margin: 0;
        background: #ffffff;
        color: #1e293b;
        box-sizing: border-box;
      }
      #cm360-shell {
        position: relative;
        width: 100%;
        height: 100%;
      }
      #frame-wrapper {
        position: relative;
        width: 100%;
        height: 100%;
      }
      iframe#creativeFrame {
        width: 100%;
        height: 100%;
        border: none;
        background: #ffffff;
        display: block;
      }
      #overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 14px;
        font-weight: 600;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        background: rgba(15, 23, 42, 0.68);
        color: #bfdbfe;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease, transform 220ms ease;
      }
      #overlay[data-busy="true"] {
        opacity: 1;
        transform: scale(0.995);
        pointer-events: auto;
      }
      #overlay span {
        display: flex;
        align-items: center;
        gap: 14px;
        font-size: 13px;
      }
      #overlay span::before {
        content: '';
        width: 18px;
        height: 18px;
        border-radius: 999px;
        border: 3px solid rgba(191, 219, 254, 0.28);
        border-top-color: #facc15;
        animation: cm360-spin 900ms linear infinite;
      }
      @keyframes cm360-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  </head>
  <body>
    <div id="cm360-shell">
      <div id="frame-wrapper">
        <iframe
          id="creativeFrame"
          title="CM360 Creative"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
          srcdoc=""
        ></iframe>
        <div id="overlay" data-busy="true"><span>Preparing CM360 simulation…</span></div>
      </div>
    </div>
    <script>
      (() => {
        const CONFIG = ${JSON.stringify(config)};
  const SW_URL = ${JSON.stringify(swUrl)};
        const ENABLER_SOURCE = ${JSON.stringify(enablerShimSource)};

  console.debug('[CM360 DEBUG] bootstrap start');

        const creativeFrame = document.getElementById('creativeFrame');
        const overlay = document.getElementById('overlay');

        const postToTop = (type, payload) => {
          try {
            parent.postMessage(Object.assign({ type, bundleId: CONFIG.bundleId }, payload || {}), '*');
          } catch (error) {
            console.warn('CM360 preview postMessage failed', error);
            try {
              const globalLog = (window.__CM360_DEBUG__ = Array.isArray(window.__CM360_DEBUG__)
                ? window.__CM360_DEBUG__
                : []);
              globalLog.push({
                ts: Date.now(),
                stage: 'post-top-error',
                payload: { message: String(error) },
              });
            } catch (logError) {
              console.warn('CM360 debug fallback failed', logError);
            }
          }
        };

        const debug = (stage, payload) => {
          try {
            const globalLog = (window.__CM360_DEBUG__ = Array.isArray(window.__CM360_DEBUG__)
              ? window.__CM360_DEBUG__
              : []);
            globalLog.push({ ts: Date.now(), stage, payload: payload || null });
          } catch (error) {
            console.warn('CM360 debug log failed', error);
          }
          try {
            console.debug('[CM360 DEBUG]', stage, payload || null);
          } catch {}
          postToTop('CM360_DEBUG', { stage, payload: payload || null });
        };

        const resolveBaseOrigin = () => {
          try {
            if (document.referrer) {
              const origin = new URL(document.referrer).origin;
              debug('resolve-origin:referrer', { origin });
              return origin;
            }
          } catch (error) {
            console.warn('CM360 preview referrer parse failed', error);
            debug('resolve-origin:referrer-error', { message: String(error) });
          }
          try {
            const topOrigin = window.top?.location?.origin;
            if (topOrigin && topOrigin !== 'null') {
              debug('resolve-origin:top', { origin: topOrigin });
              return topOrigin;
            }
          } catch (error) {
            console.warn('CM360 preview top origin unavailable', error);
            debug('resolve-origin:top-error', { message: String(error) });
          }
          const selfOrigin = window.location.origin;
          if (selfOrigin && selfOrigin !== 'null') {
            debug('resolve-origin:self', { origin: selfOrigin });
            return selfOrigin;
          }
          debug('resolve-origin:fallback', {});
          return 'https://localhost';
        };

        const baseOrigin = resolveBaseOrigin();
        debug('resolved-origin', { baseOrigin, scopePath: CONFIG.scopePath });
        const scopeUrl = new URL(CONFIG.scopePath, baseOrigin);
        debug('scope-url', { scopeHref: scopeUrl.href });

        const state = {
          blobMap: null,
          bufferMap: null,
          ready: false,
          primed: false,
          networkFailures: [],
          enablerSource: 'unknown',
          visibilityGuardActive: false,
          dimension: null,
          observer: null,
        };

        const setOverlay = (busy, message) => {
          if (!overlay) return;
          overlay.setAttribute('data-busy', busy ? 'true' : 'false');
          if (typeof message === 'string') {
            const span = overlay.querySelector('span') || document.createElement('span');
            span.textContent = message;
            if (!span.parentElement) overlay.appendChild(span);
          }
        };

        const parseIntStrict = (value) => {
          if (value == null) return undefined;
          const n = parseInt(value, 10);
          return Number.isFinite(n) && n > 0 ? n : undefined;
        };

        const detectSize = (doc) => {
          if (!doc) return null;
          try {
            // Try standard CM360 format: <meta name="ad.size" content="width=300, height=250">
            const metaAdSize = doc.querySelector('meta[name="ad.size"]');
            if (metaAdSize) {
              const content = metaAdSize.getAttribute('content') || '';
              const match = /width\s*=\s*(\d+)\s*,?\s*height\s*=\s*(\d+)/i.exec(content);
              if (match) {
                const width = parseInt(match[1], 10);
                const height = parseInt(match[2], 10);
                if (width > 0 && height > 0) return { width, height, source: 'meta:ad.size' };
              }
            }

            // Try Teresa format: <meta name="300x250" content="width=300, height=250, ...">
            const allMeta = doc.querySelectorAll('meta[name]');
            for (const meta of allMeta) {
              const name = meta.getAttribute('name') || '';
              const dimensionMatch = /^(\d{2,4})\s*x\s*(\d{2,4})$/i.exec(name);
              if (dimensionMatch) {
                const width = parseInt(dimensionMatch[1], 10);
                const height = parseInt(dimensionMatch[2], 10);
                if (width > 0 && height > 0) return { width, height, source: 'meta:name' };
              }
              
              // Also check content attribute for dimensions
              const content = meta.getAttribute('content') || '';
              const contentMatch = /width\s*=\s*(\d+)\s*,?\s*height\s*=\s*(\d+)/i.exec(content);
              if (contentMatch) {
                const width = parseInt(contentMatch[1], 10);
                const height = parseInt(contentMatch[2], 10);
                if (width > 0 && height > 0) return { width, height, source: 'meta:content' };
              }
            }

            const baseUri = doc.baseURI || doc.URL || '';
            const folderMatch = /(?:\/|^)(\d{2,4})\s*x\s*(\d{2,4})(?:\/|$)/i.exec(baseUri);
            if (folderMatch) {
              const width = parseInt(folderMatch[1], 10);
              const height = parseInt(folderMatch[2], 10);
              if (width > 0 && height > 0) return { width, height, source: 'folder' };
            }

            const candidates = ['#container', '#animate-section', '#bg', 'body', 'html'];
            for (const selector of candidates) {
              const el = doc.querySelector(selector);
              if (!el) continue;
              const style = doc.defaultView?.getComputedStyle?.(el) || null;
              const width = parseIntStrict(style?.width) ?? el.offsetWidth;
              const height = parseIntStrict(style?.height) ?? el.offsetHeight;
              if (width && height) {
                return { width, height, source: 'computed' };
              }
            }
          } catch (error) {
            console.warn('CM360 detectSize error', error);
          }
          return null;
        };

        const applyVisibilityGuard = (win, doc) => {
          let changed = false;
          try {
            const elements = [doc.documentElement, doc.body];
            for (const el of elements) {
              if (!el || !el.style) continue;
              const ensure = (prop, value) => {
                try {
                  const current = el.style.getPropertyValue(prop);
                  if (current !== value) {
                    el.style.setProperty(prop, value, 'important');
                    changed = true;
                  }
                } catch {}
              };
              ensure('opacity', '1');
              ensure('visibility', 'visible');
              ensure('pointer-events', 'auto');
              if (el === doc.body) {
                ensure('display', 'block');
              }
            }
            if (!state.observer && doc.documentElement) {
              state.observer = new MutationObserver(() => applyVisibilityGuard(win, doc));
              state.observer.observe(doc.documentElement, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                subtree: true,
              });
            }
          } catch (error) {
            console.warn('CM360 visibility guard failed', error);
          }
          if (changed) state.visibilityGuardActive = true;
        };

        const resizeWrapper = (dimension) => {
          if (!dimension || !dimension.width || !dimension.height) return;
          try {
            const shell = document.getElementById('cm360-shell');
            const wrapper = document.getElementById('frame-wrapper');
            if (shell) {
              shell.style.width = dimension.width + 'px';
              shell.style.height = dimension.height + 'px';
            }
            if (wrapper) {
              wrapper.style.width = dimension.width + 'px';
              wrapper.style.height = dimension.height + 'px';
            }
            console.log('[CM360] Resized wrapper to:', dimension.width + 'x' + dimension.height);
          } catch (error) {
            console.warn('[CM360] Failed to resize wrapper:', error);
          }
        };

        const emitDiagnostics = () => {
          postToTop('CM360_DIAGNOSTICS', {
            diagnostics: {
              baseDir: CONFIG.baseDir,
              enablerSource: state.enablerSource,
              dimension: state.dimension,
              networkFailures: Array.from(new Set(state.networkFailures)),
              visibilityGuardActive: !!state.visibilityGuardActive,
              notedAt: Date.now(),
            },
          });
          debug('emit-diagnostics', {
            enablerSource: state.enablerSource,
            dimension: state.dimension,
            networkFailures: state.networkFailures,
            visibilityGuardActive: state.visibilityGuardActive,
          });
        };

        const flushEntries = () => {
          if (!state.ready || !state.entries) return;
          try {
            console.log('[CM360] flushEntries start - posting to controller, entries:', state.entries.length);
            const payload = {
              type: 'CM360_BUNDLE_ENTRIES',
              bundleId: CONFIG.bundleId,
              baseDir: CONFIG.baseDir,
              indexPath: CONFIG.indexPath,
              entries: state.entries,
            };
            const transfer = state.entries
              .filter((entry) => entry && entry.buffer)
              .map((entry) => entry.buffer);
            
            // Use navigator.serviceWorker.controller to send to the active service worker
            if (navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage(payload, transfer);
              console.log('[CM360] Posted to controller successfully');
            } else {
              console.error('[CM360] No service worker controller!');
            }
            
            state.entries = null;
            state.primed = true;
            console.log('[CM360] flushEntries done - waiting for SW acknowledgment');
            debug('entries-flushed', { waiting: 'SW acknowledgment' });
            // Don't call loadCreative() yet - wait for SW to confirm receipt
          } catch (error) {
            console.error('CM360 flushEntries failed', error);
            debug('flush-error', { message: String(error) });
          }
        };

        const loadCreative = () => {
          if (!state.ready || !state.primed || !creativeFrame || !state.blobMap || !state.bufferMap) return;
          try {
            console.log('[CM360] loadCreative - Injecting HTML with Blob URLs');
            
            // Find the index.html in the blob map
            const indexCandidates = [
              CONFIG.indexPath,
              CONFIG.baseDir + CONFIG.indexPath,
              CONFIG.baseDir + 'index.html',
              'index.html',
            ];
            
            let indexPath = null;
            let indexBuffer = null;
            for (const candidate of indexCandidates) {
              const normalized = candidate.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/\//g, '/');
              if (state.bufferMap.has(normalized)) {
                indexPath = normalized;
                indexBuffer = state.bufferMap.get(normalized);
                break;
              }
            }
            
            if (!indexBuffer) {
              console.error('[CM360] Could not find index.html in bundle');
              setOverlay(false, 'index.html not found in bundle');
              return;
            }
            
            console.log('[CM360] Found index at:', indexPath);
            
            // Decode the HTML
            const decoder = new TextDecoder('utf-8');
            let html = decoder.decode(indexBuffer);
            
            // DON'T inject blob map as inline script - we'll inject it via postMessage after load
            // This avoids any string escaping issues with blob URLs in HTML/JS context
            
            // CRITICAL: Inline CSS files directly into HTML to avoid dynamic loading issues
            // Teresa creatives load combined.css via Enabler.getUrl(), but dynamic <link> tags
            // don't work reliably in srcdoc iframes. We need to inline the CSS content.
            const cssFilesToInline = Array.from(state.blobMap.keys()).filter(path => path.endsWith('.css'));
            for (const cssPath of cssFilesToInline) {
              const cssBuffer = state.bufferMap.get(cssPath);
              if (cssBuffer) {
                try {
                  const cssDecoder = new TextDecoder('utf-8');
                  let cssContent = cssDecoder.decode(cssBuffer);
                  
                  // Rewrite url() references in CSS before inlining
                  cssContent = cssContent.replace(
                    /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
                    (match, quote, url) => {
                      if (/^(https?:|data:|blob:|\/\/)/.test(url)) return match;
                      if (url.startsWith('#')) return match;
                      
                      const normalized = url.replace(/\\/g, '/').replace(/^\.\//, '');
                      const withBase = (CONFIG.baseDir + normalized).replace(/\/\//g, '/').replace(/^\//, '');
                      const blobUrl = state.blobMap.get(normalized) || state.blobMap.get(withBase);
                      
                      if (blobUrl) {
                        console.log('[CM360] Inlined CSS: Rewrote url():', url, '→', blobUrl.substring(0, 50) + '...');
                        return 'url(' + quote + blobUrl + quote + ')';
                      }
                      return match;
                    }
                  );
                  
                  // Inject inlined CSS into <head>
                  const styleTag = '<style data-cm360-inlined="' + cssPath + '">\n' + cssContent + '\n</style>';
                  html = html.replace('</head>', styleTag + '\n</head>');
                  console.log('[CM360] Inlined CSS file:', cssPath, '(' + cssContent.length + ' bytes)');
                } catch (error) {
                  console.error('[CM360] Failed to inline CSS:', cssPath, error);
                }
              }
            }
            
            // CRITICAL: Remove external Enabler script to prevent it from overwriting our shim
            // Teresa creatives load Enabler from CDN, but we need to use our shim with blob URL support
            html = html.replace(
              /<script[^>]+src=["']https?:\/\/[^"']*\/Enabler\.js["'][^>]*>[\s\S]*?<\/script>/gi,
              '<!-- CM360: External Enabler script removed, using shim instead -->'
            );
            
            // Remove dynamic CSS loading via Enabler.getUrl() since we've inlined the CSS
            // Look for the pattern where combined.css is loaded dynamically
            html = html.replace(
              /extCSS\s*=\s*document\.createElement\(['"]link['"]\);[\s\S]*?extCSS\.setAttribute\(['"]href['"],\s*Enabler\.getUrl\(['"]combined\.css['"]\)\);[\s\S]*?document\.getElementsByTagName\(['"]head['"]\)\[0\]\.appendChild\(extCSS\);/gi,
              '// CM360: CSS inlined, dynamic loading removed'
            );
            
            // CRITICAL: Rewrite CreateJS manifest loads to use blob URLs
            // ACC_NEW creatives use CreateJS LoadQueue with manifest that references images like "images/2024_Evergreen_HTML_MY25_Accord_LX.png"
            // We need to intercept the manifest and rewrite those paths to blob URLs
            html = html.replace(
              /(manifest\s*:\s*\[[\s\S]*?\{[^}]*src\s*:\s*)([^,}\s]+)/gi,
              (match, prefix, src) => {
                // src might be a variable like ansiraObj.vehicle_image or a string literal
                // We'll inject a runtime rewriter instead of trying to replace at HTML level
                return match; // Keep original - we'll handle this with runtime interception
              }
            );
            
            // Rewrite URLs in the HTML to use Blob URLs
            // This is a simple regex-based approach - replace src/href attributes
            html = html.replace(
              /((?:src|href)\s*=\s*["'])([^"']+)(["'])/gi,
              (match, prefix, url, suffix) => {
                // Skip absolute URLs, data URLs, blob URLs
                if (/^(https?:|data:|blob:|\/\/)/.test(url)) return match;
                if (url.startsWith('#') || url.startsWith('?')) return match;
                
                // Normalize the URL path
                const normalized = url.replace(/\\/g, '/').replace(/^\.\//, '');
                const withBase = (CONFIG.baseDir + normalized).replace(/\/\//g, '/').replace(/^\//, '');
                
                // Try to find in blob map
                const blobUrl = state.blobMap.get(normalized) || state.blobMap.get(withBase);
                if (blobUrl) {
                  console.log('[CM360] Rewrote URL:', url, '→', blobUrl.substring(0, 50) + '...');
                  return prefix + blobUrl + suffix;
                }
                
                // Fallback - return original
                console.warn('[CM360] Could not find blob URL for:', url);
                return match;
              }
            );
            
            // Inject via srcdoc
            creativeFrame.srcdoc = html;
            console.log('[CM360] Injected HTML via srcdoc');
            setOverlay(true, 'Loading creative…');
            debug('creative-injected', { indexPath });
          } catch (error) {
            console.error('CM360 loadCreative failed', error);
            debug('load-creative-error', { message: String(error) });
            setOverlay(false, 'Failed to load creative');
          }
        };

        const handleEntries = (payload) => {
          if (!payload || !Array.isArray(payload.entries)) return;
          CONFIG.baseDir = payload.baseDir || CONFIG.baseDir;
          CONFIG.indexPath = payload.indexPath || CONFIG.indexPath;
          
          console.log('[CM360] handleEntries - Using Blob URL approach (no service worker)');
          
          // First pass: Create Blob URLs for all non-CSS files
          const blobMap = new Map(); // path -> blob URL
          const bufferMap = new Map(); // path -> ArrayBuffer (for cloning)
          const cssFiles = []; // Track CSS files for second pass
          
          for (const entry of payload.entries) {
            if (!entry || (!entry.path && !entry.relativePath)) continue;
            const rawPath = entry.path || entry.relativePath || '';
            const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
            const buffer = entry.buffer || entry.data;
            if (!buffer) continue;
            
            // Store buffer for later use
            bufferMap.set(normalized, buffer.slice ? buffer.slice(0) : buffer);
            
            // Check if this is a CSS file
            const isCss = normalized.endsWith('.css') || (entry.contentType && entry.contentType.includes('css'));
            
            if (isCss) {
              // Defer CSS processing until all other blob URLs are created
              cssFiles.push({ normalized, buffer, contentType: entry.contentType });
              console.log('[CM360] Deferring CSS file:', normalized);
            } else {
              // Create Blob immediately for non-CSS files
              const blob = new Blob([buffer], {
                type: entry.contentType || 'application/octet-stream',
              });
              const blobUrl = URL.createObjectURL(blob);
              blobMap.set(normalized, blobUrl);
              console.log('[CM360] Created Blob URL for:', normalized);
            }
          }
          
          // Second pass: Process CSS files and rewrite url() references
          for (const cssFile of cssFiles) {
            try {
              // Decode CSS content
              const decoder = new TextDecoder('utf-8');
              let cssContent = decoder.decode(cssFile.buffer);
              
              console.log('[CM360] Processing CSS file:', cssFile.normalized);
              let rewriteCount = 0;
              
              // Rewrite url() references in CSS
              cssContent = cssContent.replace(
                /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
                (match, quote, url) => {
                  // Skip absolute URLs, data URLs, blob URLs
                  if (/^(https?:|data:|blob:|\/\/)/.test(url)) return match;
                  if (url.startsWith('#')) return match;
                  
                  // Normalize the URL path
                  const normalized = url.replace(/\\/g, '/').replace(/^\.\//, '');
                  const withBase = (CONFIG.baseDir + normalized).replace(/\/\//g, '/').replace(/^\//, '');
                  
                  // Try to find in blob map
                  const blobUrl = blobMap.get(normalized) || blobMap.get(withBase);
                  if (blobUrl) {
                    rewriteCount++;
                    console.log('[CM360] CSS: Rewrote url():', url, '→', blobUrl.substring(0, 50) + '...');
                    return 'url(' + quote + blobUrl + quote + ')';
                  }
                  
                  // Fallback - return original
                  console.warn('[CM360] CSS: Could not find blob URL for:', url);
                  return match;
                }
              );
              
              console.log('[CM360] CSS file', cssFile.normalized, 'rewrote', rewriteCount, 'url() references');
              
              // Create Blob for modified CSS
              const cssBlob = new Blob([cssContent], {
                type: cssFile.contentType || 'text/css',
              });
              const cssBlobUrl = URL.createObjectURL(cssBlob);
              blobMap.set(cssFile.normalized, cssBlobUrl);
              console.log('[CM360] Created Blob URL for CSS:', cssFile.normalized);
            } catch (error) {
              console.error('[CM360] Failed to process CSS file:', cssFile.normalized, error);
              // Fallback: create blob from original buffer
              const blob = new Blob([cssFile.buffer], {
                type: cssFile.contentType || 'text/css',
              });
              const blobUrl = URL.createObjectURL(blob);
              blobMap.set(cssFile.normalized, blobUrl);
            }
          }
          
          // Store blob URLs in state
          state.blobMap = blobMap;
          state.bufferMap = bufferMap;
          state.ready = true;
          state.primed = true;
          
          console.log('[CM360] Blob URLs ready, total:', blobMap.size);
          debug('blob-urls-ready', { count: blobMap.size });
          
          // Immediately load the creative
          loadCreative();
        };

        const registerServiceWorker = () => {
          if (!('serviceWorker' in navigator)) {
            console.error('[CM360] Service Worker API not available!');
            debug('sw-unavailable', {});
            setOverlay(false, 'Service Worker not supported - preview unavailable');
            return;
          }
          
          // Resolve SW_URL to absolute URL using baseOrigin
          // In srcdoc iframes, SW_URL (e.g., "/assets/sw-hash.js") needs to be resolved against the parent origin
          const absoluteSwUrl = new URL(SW_URL, baseOrigin).href;
          const absoluteScopeUrl = scopeUrl.href;
          console.log('[CM360] Registering service worker at:', absoluteSwUrl);
          console.log('[CM360] Base origin:', baseOrigin);
          console.log('[CM360] Scope (absolute):', absoluteScopeUrl);
          navigator.serviceWorker
            .register(absoluteSwUrl, {
              scope: absoluteScopeUrl,
              updateViaCache: 'none',
            })
            .then((registration) => {
              console.log('[CM360] SW registered successfully! Scope:', registration.scope);
              console.log('[CM360] SW state - installing:', !!registration.installing, 'waiting:', !!registration.waiting, 'active:', !!registration.active);
              debug('sw-registered', { scope: registration.scope });
              
              // Listen for the SW to take control
              navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[CM360] ★★★ CONTROLLER CHANGED! Now controlled by SW ★★★');
                if (navigator.serviceWorker.controller) {
                  state.ready = true;
                  state.worker = navigator.serviceWorker.controller;
                  
                  // Restore and flush entries
                  try {
                    const storageKey = 'cm360_entries_' + CONFIG.bundleId;
                    const stored = sessionStorage.getItem(storageKey);
                    if (stored) {
                      const parsed = JSON.parse(stored);
                      CONFIG.baseDir = parsed.baseDir;
                      CONFIG.indexPath = parsed.indexPath;
                      // Convert base64 back to ArrayBuffer
                      state.entries = parsed.entries.map((e) => {
                        const binaryString = atob(e.bufferBase64);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                          bytes[i] = binaryString.charCodeAt(i);
                        }
                        return {
                          ...e,
                          buffer: bytes.buffer,
                        };
                      });
                      console.log('[CM360] ✓ Restored', state.entries.length, 'entries, flushing to SW');
                      flushEntries();
                    }
                  } catch (error) {
                    console.error('[CM360] Failed to restore entries after controller change:', error);
                  }
                }
              });
            })
            .catch((error) => {
              console.error('[CM360] ✗ SW registration FAILED:', error);
              console.error('[CM360] Error details:', error.message, error.stack);
              debug('sw-register-error', { message: String(error) });
              setOverlay(false, 'Service worker registration failed');
              state.ready = false;
              state.worker = null;
            });
        };

        creativeFrame?.addEventListener('load', () => {
          try {
            const win = creativeFrame.contentWindow;
            const doc = creativeFrame.contentDocument;
            if (!win || !doc) return;
            
            // CRITICAL: Inject blob map FIRST before any scripts execute
            // Only inject if blob map exists (not all creatives need it)
            if (state.blobMap && state.blobMap.size > 0) {
              console.log('[CM360] Injecting blob map into creative iframe, size:', state.blobMap.size);
              win.__CM360_CONTEXT__ = { bundleId: CONFIG.bundleId };
              win.__CM360_BASE_DIR__ = CONFIG.baseDir;
              win.__CM360_BLOB_MAP__ = state.blobMap; // Pass the Map object directly
              console.log('[CM360] Blob map injected successfully');
              
              // CRITICAL: Intercept CreateJS LoadQueue to rewrite manifest paths to blob URLs
              // ACC_NEW creatives use CreateJS with manifest entries like {src: "images/car.png"}
              // We need to intercept these and rewrite to blob URLs before loading
              const createJSInterceptor = doc.createElement('script');
              createJSInterceptor.type = 'text/javascript';
              // Use string concatenation to avoid escape sequence issues in template literal
              createJSInterceptor.textContent = [
                '(function() {',
                '  console.log("[CM360] Installing CreateJS manifest interceptor");',
                '  var checkCreateJS = setInterval(function() {',
                '    if (typeof createjs !== "undefined" && createjs.LoadQueue) {',
                '      clearInterval(checkCreateJS);',
                '      console.log("[CM360] CreateJS detected, wrapping LoadQueue.loadManifest");',
                '      var originalLoadManifest = createjs.LoadQueue.prototype.loadManifest;',
                '      createjs.LoadQueue.prototype.loadManifest = function(manifest) {',
                '        console.log("[CM360] Intercepting loadManifest, original manifest:", manifest);',
                '        if (Array.isArray(manifest)) {',
                '          manifest = manifest.map(function(item) {',
                '            if (typeof item === "object" && item.src) {',
                '              var src = item.src;',
                '              if (typeof src === "string") {',
                '                var normalized = src.replace(/\\\\/g, "/").replace(/^\\.\\//, "");',
                '                var withBase = (window.__CM360_BASE_DIR__ + normalized).replace(/\\/\\//g, "/").replace(/^\\//, "");',
                '                var blobUrl = window.__CM360_BLOB_MAP__.get(normalized) || window.__CM360_BLOB_MAP__.get(withBase);',
                '                if (blobUrl) {',
                '                  console.log("[CM360] CreateJS: Rewrote manifest src:", src, "→", blobUrl.substring(0, 50) + "...");',
                '                  return Object.assign({}, item, { src: blobUrl });',
                '                } else {',
                '                  console.warn("[CM360] CreateJS: Could not find blob URL for manifest src:", src);',
                '                }',
                '              }',
                '            }',
                '            return item;',
                '          });',
                '        }',
                '        console.log("[CM360] Calling original loadManifest with rewritten manifest:", manifest);',
                '        return originalLoadManifest.call(this, manifest);',
                '      };',
                '      console.log("[CM360] CreateJS manifest interceptor installed successfully");',
                '    }',
                '  }, 50);',
                '  setTimeout(function() { clearInterval(checkCreateJS); }, 5000);',
                '})();',
              ].join('\n');
              doc.documentElement?.insertBefore(createJSInterceptor, doc.documentElement.firstChild);
              console.log('[CM360] CreateJS interceptor script injected');
            }
            
            // Inject the Enabler shim
            const shimScript = doc.createElement('script');
            shimScript.type = 'text/javascript';
            shimScript.textContent = ENABLER_SOURCE;
            doc.documentElement?.appendChild(shimScript);
            applyVisibilityGuard(win, doc);
            const size = detectSize(doc);
            if (size) {
              state.dimension = size;
              resizeWrapper(size);
            }
            setOverlay(false, '');
            emitDiagnostics();
            debug('creative-loaded', { size: state.dimension });
          } catch (error) {
            console.error('CM360 iframe load error', error);
            setOverlay(false, 'Creative loaded with injector error');
            debug('creative-load-error', { message: String(error) });
          }
        });

        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || typeof data !== 'object') return;
          if (data.bundleId && data.bundleId !== CONFIG.bundleId) return;
          if (data.type === 'CM360_BUNDLE_ENTRIES') {
            handleEntries(data);
            debug('received-entries', { count: Array.isArray(data.entries) ? data.entries.length : 0 });
          } else if (data.type === 'creative-click') {
            postToTop('creative-click', data);
          } else if (data.type === 'CM360_ENABLER_STATUS') {
            state.enablerSource = data.source || 'unknown';
            emitDiagnostics();
            debug('enabler-status', { source: state.enablerSource });
          }
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          const data = event.data;
          console.log('[CM360] Received SW message:', data?.type);
          if (!data || typeof data !== 'object') return;
          
          if (data.type === 'CM360_ENTRIES_STORED') {
            console.log('[CM360] Got CM360_ENTRIES_STORED, calling loadCreative(), count:', data.count);
            debug('sw-entries-stored', { count: data.count });
            loadCreative(); // NOW we can load - SW has the entries
          }
          
          if (data.type === 'CM360_SW_FETCH_MISS' && data.url) {
            state.networkFailures.push(data.url);
            emitDiagnostics();
            debug('sw-fetch-miss', { url: data.url });
          }
        });

        postToTop('CM360_REQUEST_ENTRIES', {});
        debug('request-entries', {});
        // registerServiceWorker(); // NOT NEEDED - using Blob URL approach instead
        emitDiagnostics();
        debug('init-complete', {});
      })();
    </script>
  </body>
</html>`;

  return html;
};

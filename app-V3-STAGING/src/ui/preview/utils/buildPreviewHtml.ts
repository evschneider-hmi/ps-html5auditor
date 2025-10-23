/**
 * Build Preview HTML
 * 
 * Constructs the preview shell HTML that wraps the creative content.
 * This HTML handles:
 * - Blob URL injection for assets
 * - Enabler shim injection for CM360 compatibility
 * - Animation tracking for GSAP/Anime.js
 * - CSS/JS inlining to avoid dynamic loading issues
 * - CreateJS LoadQueue interception
 * - URL rewriting for asset references
 * 
 * The preview shell communicates with the parent window via postMessage
 * to report diagnostics and respond to control commands.
 */

import type { PreviewBuildOptions, PreviewBuildResult } from '../types';

export interface BuildPreviewHtmlOptions {
  bundleId: string;
  baseDir: string;
  indexPath: string;
  files: Record<string, Uint8Array>; // V3 bundle files structure
  blobMap: Map<string, string>;
  options?: PreviewBuildOptions;
}

/**
 * Infers MIME type from file path extension
 */
const inferMimeType = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase();
  
  // Images
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'ico') return 'image/x-icon';
  
  // Video
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'ogv') return 'video/ogg';
  
  // Audio
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'ogg') return 'audio/ogg';
  if (ext === 'wav') return 'audio/wav';
  
  // Text/Code
  if (ext === 'html') return 'text/html';
  if (ext === 'css') return 'text/css';
  if (ext === 'js') return 'application/javascript';
  if (ext === 'json') return 'application/json';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'xml') return 'application/xml';
  
  // Fonts
  if (ext === 'woff') return 'font/woff';
  if (ext === 'woff2') return 'font/woff2';
  if (ext === 'ttf') return 'font/ttf';
  if (ext === 'otf') return 'font/otf';
  if (ext === 'eot') return 'application/vnd.ms-fontobject';
  
  return 'application/octet-stream';
};

/**
 * Normalizes file path for consistent lookup
 */
const normalizePath = (path: string): string => {
  return path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/\//g, '/');
};

/**
 * Rewrites URLs in CSS content to use blob URLs
 */
const rewriteCssUrls = (
  cssContent: string,
  cssPath: string,
  baseDir: string,
  blobMap: Map<string, string>,
  missingAssets: Array<{ url: string; path: string; context: string }>
): string => {
  return cssContent.replace(
    /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (match, quote, url) => {
      // Skip absolute URLs, data URLs, blob URLs, anchors
      if (/^(https?:|data:|blob:|\/\/)/.test(url)) return match;
      if (url.startsWith('#')) return match;
      
      // Normalize the URL path
      const normalized = normalizePath(url);
      const withBase = normalizePath(baseDir + normalized);
      
      // Try multiple path variations
      let blobUrl = blobMap.get(normalized) || blobMap.get(withBase);
      
      // Try filename match
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
        return `url(${quote}${blobUrl}${quote})`;
      }
      
      // Track missing asset
      const existsInBundle = Array.from(blobMap.keys()).some(
        key => key.endsWith('/' + url) || key === url || 
               key.endsWith('/' + normalized) || key === normalized
      );
      
      if (!existsInBundle) {
        missingAssets.push({
          url,
          path: normalized,
          context: `CSS url() in ${cssPath}`
        });
      }
      
      return match;
    }
  );
};

/**
 * Rewrites URLs in HTML attributes to use blob URLs
 */
const rewriteHtmlUrls = (
  html: string,
  baseDir: string,
  blobMap: Map<string, string>,
  missingAssets: Array<{ url: string; path: string; context: string }>
): string => {
  return html.replace(
    /((?:src|href)\s*=\s*["'])([^"']+)(["'])/gi,
    (match, prefix, url, suffix, offset) => {
      // Skip if inside HTML comment
      const beforeMatch = html.substring(0, offset);
      const lastCommentStart = beforeMatch.lastIndexOf('<!--');
      const lastCommentEnd = beforeMatch.lastIndexOf('-->');
      if (lastCommentStart > lastCommentEnd) {
        return match;
      }
      
      // Skip absolute URLs, data URLs, blob URLs, anchors
      if (/^(https?:|data:|blob:|\/\/)/.test(url)) return match;
      if (url.startsWith('#') || url.startsWith('?')) return match;
      
      // Normalize the URL path
      const normalized = normalizePath(url);
      const withBase = normalizePath(baseDir + normalized);
      
      // Try multiple path variations
      let blobUrl = blobMap.get(normalized) || blobMap.get(withBase);
      
      // Try filename match
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
        return prefix + blobUrl + suffix;
      }
      
      // Track missing asset
      const existsInBundle = Array.from(blobMap.keys()).some(
        key => key.endsWith('/' + url) || key === url || 
               key.endsWith('/' + normalized) || key === normalized
      );
      
      if (!existsInBundle) {
        const attrName = prefix.replace(/\s*=\s*["']$/, '');
        missingAssets.push({
          url,
          path: normalized,
          context: `HTML ${attrName}`
        });
      }
      
      return match;
    }
  );
};

import { getEnhancedProbeScript } from './enhancedProbe';

/**
 * Generates CreateJS interceptor script
 * Intercepts CreateJS LoadQueue to rewrite manifest paths to blob URLs
 */
const getCreateJSInterceptorScript = (baseDir: string): string => {
  return `
(function() {
  console.log("[Preview] Installing CreateJS interceptors");
  var checkCreateJS = setInterval(function() {
    if (typeof createjs !== "undefined" && createjs.LoadQueue) {
      clearInterval(checkCreateJS);
      console.log("[Preview] CreateJS detected, wrapping LoadQueue");
      
      var originalLoadManifest = createjs.LoadQueue.prototype.loadManifest;
      createjs.LoadQueue.prototype.loadManifest = function(manifest) {
        if (Array.isArray(manifest)) {
          manifest = manifest.map(function(item) {
            if (typeof item === "object" && item.src && typeof item.src === "string") {
              var src = item.src;
              var normalized = src.replace(/\\\\/g, "/").replace(/^\\.\\//, "");
              var withBase = ("${baseDir}" + normalized).replace(/\\/\\//g, "/").replace(/^\\//, "");
              var blobUrl = window.__PREVIEW_BLOB_MAP__.get(normalized) || 
                           window.__PREVIEW_BLOB_MAP__.get(withBase);
              
              if (blobUrl) {
                console.log("[Preview] CreateJS: Rewrote src:", src, "→", blobUrl.substring(0, 60));
                return Object.assign({}, item, { src: blobUrl });
              }
            }
            return item;
          });
        }
        return originalLoadManifest.call(this, manifest);
      };
      
      // Auto-trigger init() if it exists
      setTimeout(function() {
        if (typeof window.init === "function" && typeof window.lib === "undefined") {
          console.log("[Preview] Auto-triggering init()");
          window.init();
        }
      }, 100);
    }
  }, 50);
  setTimeout(function() { clearInterval(checkCreateJS); }, 5000);
})();
`;
};

/**
 * Builds the preview HTML with all instrumentation and asset injection
 */
export const buildPreviewHtml = async ({
  bundleId,
  baseDir,
  indexPath,
  files,
  blobMap,
  options = {}
}: BuildPreviewHtmlOptions): Promise<PreviewBuildResult> => {
  const missingAssets: Array<{ url: string; path: string; context: string }> = [];
  
  // Find index.html in the files Record
  const indexCandidates = [
    indexPath,
    baseDir + indexPath,
    baseDir + 'index.html',
    'index.html'
  ];
  
  let indexBytes: Uint8Array | null = null;
  for (const candidate of indexCandidates) {
    const normalized = normalizePath(candidate);
    if (files[normalized]) {
      indexBytes = files[normalized];
      break;
    }
  }
  
  if (!indexBytes) {
    throw new Error('Could not find index.html in bundle');
  }
  
  // Decode HTML
  const decoder = new TextDecoder('utf-8');
  const originalHtml = decoder.decode(indexBytes);
  let html = originalHtml;
  
  // Process CSS files: rewrite url() references and inline them
  const cssFilePaths = Object.keys(files).filter(path => path.endsWith('.css'));
  for (const cssPath of cssFilePaths) {
    try {
      let cssContent = decoder.decode(files[cssPath]);
      cssContent = rewriteCssUrls(cssContent, cssPath, baseDir, blobMap, missingAssets);
      
      // Inline CSS into <head>
      const styleTag = `<style data-preview-inlined="${cssPath}">\n${cssContent}\n</style>`;
      html = html.replace('</head>', styleTag + '\n</head>');
    } catch (error) {
      console.error('Failed to inline CSS:', cssPath, error);
    }
  }
  
  // Inline JavaScript files (except Enabler)
  // NOTE: ISI_Expander and PauseButton MUST be inlined for Teresa creatives
  const jsFilePaths = Object.keys(files).filter(path =>
    path.endsWith('.js') && 
    !path.includes('Enabler')
  );
  
  for (const jsPath of jsFilePaths) {
    try {
      let jsContent = decoder.decode(files[jsPath]);
      
      // Escape script tags to prevent breaking out
      jsContent = jsContent
        .replace(/<\/script>/gi, '<\\/script>')
        .replace(/<script/gi, '<\\script>')
        .replace(/<!--/g, '<\\!--')
        .replace(/-->/g, '--\\>');
      
      // Wrap in DOMContentLoaded to ensure proper execution order
      const wrappedJS = `(function() {
  function executeInlinedScript() {
    console.log("[Preview] Executing: ${jsPath}");
${jsContent}
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", executeInlinedScript);
  } else {
    executeInlinedScript();
  }
})();`;
      
      const scriptTag = `<script data-preview-inlined="${jsPath}">\n${wrappedJS}\n</script>`;
      if (html.includes('</body>')) {
        html = html.replace('</body>', scriptTag + '\n</body>');
      } else {
        html = html.replace('</head>', scriptTag + '\n</head>');
      }
    } catch (error) {
      console.error('Failed to inline JS:', jsPath, error);
    }
  }
  
  // Inject enhanced animation tracker BEFORE inlined scripts
  const animTrackerTag = `<script data-preview-animation-tracker>\n${getEnhancedProbeScript()}\n</script>`;
  if (html.includes('</head>')) {
    html = html.replace('</head>', animTrackerTag + '\n</head>');
  } else if (html.includes('<body')) {
    html = html.replace('<body', animTrackerTag + '\n<body');
  } else {
    html = animTrackerTag + '\n' + html;
  }
  
  // Inject CreateJS interceptor
  const createJSTag = `<script data-preview-createjs>\n${getCreateJSInterceptorScript(baseDir)}\n</script>`;
  if (html.includes('</head>')) {
    html = html.replace('</head>', createJSTag + '\n</head>');
  } else if (html.includes('<body')) {
    html = html.replace('<body', createJSTag + '\n<body');
  } else {
    html = createJSTag + '\n' + html;
  }
  
  // Remove external Enabler script (we'll inject our own shim)
  html = html.replace(
    /<script[^>]+src=["']https?:\/\/[^"']*\/Enabler\.js["'][^>]*>[\s\S]*?<\/script>/gi,
    '<!-- Preview: External Enabler removed, using shim -->'
  );
  
  // Remove dynamic CSS/JS loading
  html = html.replace(
    /extCSS\s*=\s*document\.createElement\(['"]link['"]\);[\s\S]*?extCSS\.setAttribute\(['"]href['"],\s*Enabler\.getUrl\(['"]combined\.css['"]\)\);[\s\S]*?appendChild\(extCSS\);/gi,
    '// Preview: CSS inlined, dynamic loading removed'
  );
  
  html = html.replace(
    /(var\s+)?extJavascript\s*=\s*document\.createElement\(['"]script['"]\);[\s\S]*?extJavascript\.setAttribute\(['"]src['"],\s*Enabler\.getUrl\(['"]combined\.js['"]\)\);[\s\S]*?appendChild\(extJavascript\);/gi,
    '// Preview: JavaScript inlined, dynamic loading removed'
  );
  
  // Remove dynamic loading for Teresa-specific files (ISI_Expander.js, PauseButton.js)
  html = html.replace(
    /extJavascript\s*=\s*document\.createElement\(['"]script['"]\);[\s\S]*?extJavascript\.setAttribute\(['"]src['"],\s*Enabler\.getUrl\(['"]ISI_Expander\.js['"]\)\);[\s\S]*?appendChild\(extJavascript\);/gi,
    '// Preview: ISI_Expander.js inlined, dynamic loading removed'
  );
  
  html = html.replace(
    /extJavascript\s*=\s*document\.createElement\(['"]script['"]\);[\s\S]*?extJavascript\.setAttribute\(['"]src['"],\s*Enabler\.getUrl\(['"]PauseButton\.js['"]\)\);[\s\S]*?appendChild\(extJavascript\);/gi,
    '// Preview: PauseButton.js inlined, dynamic loading removed'
  );
  
  // Rewrite HTML URLs to use blob URLs
  html = rewriteHtmlUrls(html, baseDir, blobMap, missingAssets);
  
  // Convert blob map to plain object for serialization
  const blobMapObj: Record<string, string> = {};
  for (const [key, value] of blobMap.entries()) {
    blobMapObj[key] = value;
  }
  
  return {
    html,
    blobMap: blobMapObj,
    originalHtml,
    missingAssets
  };
};

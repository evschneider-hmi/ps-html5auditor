/**
 * Load Phase Categorization and Metrics Calculation
 * 
 * Categorizes assets into initial vs. subload (polite) phases and calculates:
 * - File sizes (initial, polite, total) using gzip compression
 * - Request counts (initial, polite, total)
 * - Host counts (for IAB host request limits)
 * 
 * SIZE CALCULATION METHODOLOGY:
 * - Uses gzip compression for accurate HTTP transfer sizes (matches CM360)
 * - IAB spec requires compressed sizes (what actually transfers over network)
 * - Matches V2's test suite approach using pako.gzip()
 * - Cached per file to avoid redundant compression
 * 
 * V2 COMPATIBILITY:
 * - V2 test suite uses pako.gzip() for expected metrics
 * - V3-STAGING uses same approach for static analysis
 * - Runtime probe (when implemented) will override with actual network metrics
 */

import pako from 'pako';
import type { Reference, ZipBundle, BundleResult } from './types';

export interface LoadPhaseMetrics {
  // File sizes (in bytes, gzip compressed - matches CM360/IAB)
  initialBytes: number;
  subloadBytes: number;
  totalBytes: number; // uncompressed total for reference
  
  // Request counts
  initialRequests: number;
  subloadRequests: number;
  totalRequests: number;
  
  // Host counts
  initialHosts: number;
  totalHosts: number;
}

/**
 * Compute gzip-compressed size of a file
 * Cached to avoid redundant compression
 */
const gzipCache = new Map<string, number>();

function computeGzipSize(path: string, bytes: Uint8Array): number {
  const key = path.toLowerCase();
  
  if (gzipCache.has(key)) {
    return gzipCache.get(key)!;
  }
  
  let size = bytes.length;
  try {
    size = pako.gzip(bytes).length;
  } catch (err) {
    // Fallback to raw size if gzip fails
    console.warn(`[loadPhaseMetrics] Gzip failed for ${path}, using raw size:`, err);
  }
  
  gzipCache.set(key, size);
  return size;
}

/**
 * Categorize asset as 'initial' or 'subload' based on reference path
 * 
 * Initial load assets:
 * - Primary HTML (index.html)
 * - Direct CSS links in <head>
 * - Direct JS <script> tags in <head> or early <body>
 * - CSS @import from initial stylesheets
 * - Images/fonts referenced in initial CSS
 * 
 * Subload (polite) assets:
 * - Lazy-loaded images
 * - Deferred scripts (async, defer, or bottom of body)
 * - Assets loaded via JavaScript
 * - Secondary images not in initial CSS
 */
function categorizeAssetPhase(ref: Reference, primaryPath: string): 'initial' | 'subload' {
  // Primary HTML is always initial
  if (ref.from === primaryPath) {
    // Direct references from primary HTML
    if (ref.type === 'css') return 'initial';
    if (ref.type === 'js') return 'initial'; // Assume scripts in HTML are initial (conservative)
    if (ref.type === 'img') return 'subload'; // Images are typically polite load
    if (ref.type === 'font') return 'initial'; // Fonts block render
  }
  
  // References from CSS files
  if (ref.from.match(/\.css\$/i)) {
    // CSS @imports and url() references
    if (ref.type === 'css') return 'initial'; // @import cascades
    if (ref.type === 'img') return 'subload'; // Background images are polite
    if (ref.type === 'font') return 'initial'; // Fonts in CSS block render
  }
  
  // References from JS files are subload (loaded after initial parse)
  if (ref.from.match(/\.js\$/i)) {
    return 'subload';
  }
  
  // Default: subload (conservative for IAB compliance)
  return 'subload';
}

/**
 * Calculate load phase metrics from references and bundle
 * Uses gzip compression for accurate HTTP transfer sizes (matches CM360)
 */
export function calculateLoadPhaseMetrics(
  refs: Reference[],
  bundle: ZipBundle,
  primaryPath: string
): LoadPhaseMetrics {
  const initialAssets = new Set<string>();
  const subloadAssets = new Set<string>();
  const initialHosts = new Set<string>();
  const totalHosts = new Set<string>();
  
  // Always include primary in initial
  initialAssets.add(primaryPath);
  
  // Categorize each reference
  for (const ref of refs) {
    if (!ref.inZip) {
      // External asset - track host
      if (ref.external) {
        try {
          totalHosts.add(new URL(ref.url).hostname);
          const phase = categorizeAssetPhase(ref, primaryPath);
          if (phase === 'initial') {
            initialHosts.add(new URL(ref.url).hostname);
          }
        } catch {
          // Invalid URL, skip
        }
      }
      continue; // Don't count size for external assets
    }
    
    // Internal asset
    const assetPath = ref.normalized || ref.url;
    const phase = categorizeAssetPhase(ref, primaryPath);
    
    if (phase === 'initial') {
      initialAssets.add(assetPath);
    } else {
      subloadAssets.add(assetPath);
    }
  }
  
  // Calculate gzip-compressed sizes (matches CM360/V2 test suite)
  let initialBytes = 0;
  let subloadBytes = 0;
  
  for (const path of initialAssets) {
    const fileBytes = bundle.files[path];
    if (fileBytes) {
      initialBytes += computeGzipSize(path, fileBytes);
    }
  }
  
  for (const path of subloadAssets) {
    const fileBytes = bundle.files[path];
    if (fileBytes) {
      subloadBytes += computeGzipSize(path, fileBytes);
    }
  }
  
  // Total bytes: uncompressed size of all files (for reference)
  const totalBytes = Object.values(bundle.files).reduce(
    (sum, bytes) => sum + bytes.length,
    0
  );
  
  return {
    initialBytes,
    subloadBytes,
    totalBytes,
    initialRequests: initialAssets.size,
    subloadRequests: subloadAssets.size,
    totalRequests: initialAssets.size + subloadAssets.size,
    initialHosts: initialHosts.size,
    totalHosts: totalHosts.size,
  };
}

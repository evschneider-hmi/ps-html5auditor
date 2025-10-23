/**
 * Load Phase Categorization and Metrics Calculation
 * 
 * Categorizes assets into initial vs. subload and calculates:
 * - File sizes (initial, polite/subload, total) using gzip compression
 * - Request counts (initial, polite/subload, total)
 * - Host counts (for IAB host request limits)
 * 
 * IMPORTANT - CM360/IAB INTERPRETATION (Matches V2):
 * - "Initial load" = ALL assets referenced by the creative (what it uses)
 * - "Subload" = Unreferenced (orphaned) files in the ZIP
 * 
 * This matches CM360's interpretation where "initial load" budget includes
 * all assets the creative needs (HTML, CSS, JS, images, fonts), regardless
 * of whether they block render. "Subload" represents files that exist in
 * the ZIP but are never used.
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
 * - Categorization logic matches V2: referenced = initial, unreferenced = subload
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
 * Categorize asset as 'initial' or 'subload'
 * 
 * IMPORTANT: CM360/IAB interpretation (matches V2):
 * - Initial load = ALL assets referenced by the creative
 * - Subload = Only unreferenced (orphaned) files in the ZIP
 * 
 * This differs from semantic "render-blocking" categorization.
 * CM360's "initial load" budget includes all assets the creative needs,
 * including images, even though images don't block render.
 * 
 * "Subload" in CM360 context means files that exist in the ZIP
 * but are never used by the creative (orphaned assets).
 */
function categorizeAssetPhase(ref: Reference, primaryPath: string): 'initial' | 'subload' {
  // ALL referenced assets are "initial" in CM360/IAB terms
  // This matches V2's logic and CM360's interpretation
  return 'initial';
}

/**
 * Calculate load phase metrics from references and bundle
 * Uses gzip compression for accurate HTTP transfer sizes (matches CM360)
 * 
 * MATCHES V2 LOGIC:
 * - Initial = all referenced files (what the creative uses)
 * - Subload = unreferenced files (orphaned files in ZIP)
 */
export function calculateLoadPhaseMetrics(
  refs: Reference[],
  bundle: ZipBundle,
  primaryPath: string
): LoadPhaseMetrics {
  const referencedAssets = new Set<string>();
  const initialHosts = new Set<string>();
  const totalHosts = new Set<string>();
  
  // Always include primary in referenced
  referencedAssets.add(primaryPath.toLowerCase());
  
  // Collect all referenced assets
  for (const ref of refs) {
    if (!ref.inZip) {
      // External asset - track host
      if (ref.external) {
        try {
          const host = new URL(ref.url).hostname;
          totalHosts.add(host);
          // All external refs counted as initial (they're referenced)
          initialHosts.add(host);
        } catch {
          // Invalid URL, skip
        }
      }
      continue; // Don't count size for external assets
    }
    
    // Internal asset - all referenced assets are "initial"
    const assetPath = (ref.normalized || ref.url).toLowerCase();
    referencedAssets.add(assetPath);
  }
  
  // Find unreferenced (orphaned) files for subload
  const allFilePaths = Object.keys(bundle.files).map(p => p.toLowerCase());
  const unreferencedAssets = new Set<string>();
  
  for (const path of allFilePaths) {
    if (!referencedAssets.has(path)) {
      unreferencedAssets.add(path);
    }
  }
  
  // Calculate gzip-compressed sizes (matches CM360/V2 test suite)
  let initialBytes = 0;
  let subloadBytes = 0;
  
  // Initial = all referenced assets (need case-insensitive lookup)
  for (const path of referencedAssets) {
    // Find actual file path (case-sensitive) from bundle
    const actualPath = Object.keys(bundle.files).find(
      p => p.toLowerCase() === path
    );
    if (actualPath) {
      const fileBytes = bundle.files[actualPath];
      if (fileBytes) {
        initialBytes += computeGzipSize(actualPath, fileBytes);
      }
    }
  }
  
  // Subload = unreferenced (orphaned) assets
  for (const path of unreferencedAssets) {
    // Find actual file path (case-sensitive) from bundle
    const actualPath = Object.keys(bundle.files).find(
      p => p.toLowerCase() === path
    );
    if (actualPath) {
      const fileBytes = bundle.files[actualPath];
      if (fileBytes) {
        subloadBytes += computeGzipSize(actualPath, fileBytes);
      }
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
    initialRequests: referencedAssets.size,
    subloadRequests: unreferencedAssets.size,
    totalRequests: referencedAssets.size + unreferencedAssets.size,
    initialHosts: initialHosts.size,
    totalHosts: totalHosts.size,
  };
}

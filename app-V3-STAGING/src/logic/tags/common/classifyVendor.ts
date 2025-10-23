/**
 * VAST Tag System - Vendor Classification
 * 
 * Classifies VAST URLs by vendor (CM360, Innovid, DoubleVerify, etc.).
 * Extracted from V2 bulk.ts for V3 modular architecture.
 * 
 * @module vast/classifyVendor
 */

import { extractHost, lastHostSegments } from './utils';
import type { VendorClassification } from '../types';

/**
 * Vendor domain patterns for classification
 * 
 * Maps domain patterns to vendor names.
 * Checked in order - first match wins.
 */
const VENDOR_PATTERNS: Array<{ patterns: string[]; vendor: string }> = [
  {
    patterns: ['doubleclick.net', 'googlesyndication.com', 'google.com'],
    vendor: 'CM360',
  },
  {
    patterns: ['innovid.com', 'rtr.innovid.com', 'dvrtr.innovid.com'],
    vendor: 'Innovid',
  },
  {
    patterns: ['doubleverify', 'dv.tech'],
    vendor: 'DoubleVerify',
  },
  {
    patterns: ['ias.net', 'iasds.net', 'integralads.com'],
    vendor: 'IAS',
  },
  {
    patterns: ['moatads.com', 'moat.com'],
    vendor: 'MOAT',
  },
  {
    patterns: ['sizmek.com', 'serving-sys.com'],
    vendor: 'Sizmek',
  },
  {
    patterns: ['flashtalking.com', 'ftcdn.net'],
    vendor: 'Flashtalking',
  },
  {
    patterns: ['adform.net', 'adform.com'],
    vendor: 'AdForm',
  },
  {
    patterns: ['celtra.com', 'celtracdn.com'],
    vendor: 'Celtra',
  },
  {
    patterns: ['bannerflow.com', 'bfcdn.com'],
    vendor: 'Bannerflow',
  },
  {
    patterns: ['smartclip.tv', 'smartclip.net'],
    vendor: 'SmartClip',
  },
  {
    patterns: ['videoplaza.com', 'videoplaza.tv'],
    vendor: 'Videoplaza',
  },
  {
    patterns: ['teads.tv', 'teads.com'],
    vendor: 'Teads',
  },
  {
    patterns: ['spotxchange.com', 'spotx.tv'],
    vendor: 'SpotX',
  },
  {
    patterns: ['freewheel.tv', 'fwmrm.net'],
    vendor: 'Freewheel',
  },
];

/**
 * Classify VAST URL by vendor
 * 
 * Analyzes URL hostname to determine the ad vendor.
 * Falls back to last 2 hostname segments if no pattern matches.
 * 
 * @param url - VAST URL to classify
 * @returns Vendor classification with hostname
 * 
 * @example
 * ```typescript
 * classifyVendor('https://ad.doubleclick.net/vast?id=123')
 * // => { vendor: 'CM360', host: 'ad.doubleclick.net', isRecognized: true }
 * 
 * classifyVendor('https://rtr.innovid.com/r1.xml')
 * // => { vendor: 'Innovid', host: 'rtr.innovid.com', isRecognized: true }
 * 
 * classifyVendor('https://unknown.example.com/vast.xml')
 * // => { vendor: 'example.com', host: 'unknown.example.com', isRecognized: false }
 * ```
 */
export function classifyVendor(url: string): VendorClassification {
  const host = extractHost(url);
  
  if (!host) {
    return { vendor: 'Unknown', host: '', isRecognized: false };
  }

  // Check known vendor patterns
  for (const { patterns, vendor } of VENDOR_PATTERNS) {
    for (const pattern of patterns) {
      if (host.includes(pattern)) {
        return { vendor, host, isRecognized: true };
      }
    }
  }

  // Fallback: use last 2 hostname segments
  const fallbackVendor = lastHostSegments(host, 2);
  return { vendor: fallbackVendor, host, isRecognized: false };
}

/**
 * Classify URL vendor (legacy alias)
 * 
 * @deprecated Use classifyVendor instead
 * @param url - URL to classify
 * @returns Vendor name only
 */
export function classify(url: string): string {
  return classifyVendor(url).vendor;
}

/**
 * Extract hostname from URL (legacy alias)
 * 
 * @deprecated Use extractHost from utils instead
 * @param url - URL to parse
 * @returns Hostname
 */
export function host(url: string): string {
  return extractHost(url);
}

/**
 * Batch classify multiple URLs
 * 
 * @param urls - Array of URLs to classify
 * @returns Array of classifications
 * 
 * @example
 * ```typescript
 * const urls = [
 *   'https://ad.doubleclick.net/vast',
 *   'https://rtr.innovid.com/vast',
 * ];
 * const results = classifyBatch(urls);
 * // => [
 * //   { vendor: 'CM360', host: 'ad.doubleclick.net', isRecognized: true },
 * //   { vendor: 'Innovid', host: 'rtr.innovid.com', isRecognized: true }
 * // ]
 * ```
 */
export function classifyBatch(urls: string[]): VendorClassification[] {
  return urls.map(classifyVendor);
}

/**
 * Get vendor statistics from URL list
 * 
 * @param urls - Array of URLs to analyze
 * @returns Map of vendor names to counts
 * 
 * @example
 * ```typescript
 * const urls = [
 *   'https://ad.doubleclick.net/vast1',
 *   'https://ad.doubleclick.net/vast2',
 *   'https://rtr.innovid.com/vast',
 * ];
 * const stats = getVendorStats(urls);
 * // => { 'CM360': 2, 'Innovid': 1 }
 * ```
 */
export function getVendorStats(urls: string[]): Record<string, number> {
  const stats: Record<string, number> = {};
  
  for (const url of urls) {
    const { vendor } = classifyVendor(url);
    stats[vendor] = (stats[vendor] || 0) + 1;
  }
  
  return stats;
}

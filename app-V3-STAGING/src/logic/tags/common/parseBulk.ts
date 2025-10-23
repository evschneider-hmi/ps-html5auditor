/**
 * VAST Tag System - Bulk Input Parser
 * 
 * Parses multi-line text input containing VAST URLs, XML, and ad tags.
 * Extracted from V2 bulk.ts for V3 modular architecture.
 * 
 * @module vast/parseBulk
 */

import { isUrlLine, looksVastUrl, looksVastXml, extractHost, extractParams } from './utils';
import { classifyVendor } from './classifyVendor';
import type { VastEntry, VastEntryType } from '../types';

/**
 * Parse bulk text input into classified VAST entries
 * 
 * Handles multiple input formats:
 * - Multi-line text with one URL/tag per line
 * - Single line with multiple URLs (regex extraction)
 * - Inline VAST XML (single or multiple tags)
 * - Mixed URLs and XML
 * 
 * @param text - Raw text input (newline-separated)
 * @returns Array of classified VAST entries
 * 
 * @example
 * ```typescript
 * // Multi-line URLs
 * const input = `
 *   https://ad.doubleclick.net/vast?id=123
 *   https://rtr.innovid.com/r1.xml
 * `;
 * const entries = parseBulkInput(input);
 * // => [
 * //   { i: 1, type: 'VAST URL', raw: 'https://ad.doubleclick.net/...', ... },
 * //   { i: 2, type: 'VAST URL', raw: 'https://rtr.innovid.com/...', ... }
 * // ]
 * 
 * // Single line with URL regex extraction
 * const input2 = 'Check out https://ad.doubleclick.net/vast and test it';
 * const entries2 = parseBulkInput(input2);
 * // => [{ i: 1, type: 'VAST URL', raw: 'https://ad.doubleclick.net/vast', ... }]
 * 
 * // VAST XML
 * const input3 = '<VAST version="3.0"><Ad>...</Ad></VAST>';
 * const entries3 = parseBulkInput(input3);
 * // => [{ i: 1, type: 'VAST XML', raw: '<VAST ...', vendor: '', host: '', ... }]
 * ```
 */
export function parseBulkInput(text: string): VastEntry[] {
  if (!text || !text.trim()) {
    return [];
  }

  // Split by newlines and filter empty
  let parts = text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  // If single line or looks like embedded URLs, try regex extraction
  if (parts.length <= 1) {
    const urlMatches = text.match(/https?:\/\/[^\s]+/gi);
    if (urlMatches && urlMatches.length > 0) {
      parts = urlMatches;
    } else {
      // Try VAST XML regex extraction
      const xmlMatches = text.match(/<\s*VAST[\s\S]*?<\s*\/\s*VAST\s*>/gi);
      if (xmlMatches && xmlMatches.length > 0) {
        parts = xmlMatches;
      }
    }
  }

  // Classify each part
  return parts.map((raw, idx) => classifyEntry(raw, idx + 1));
}

/**
 * Classify a single entry (URL or XML)
 * 
 * @param raw - Raw string to classify
 * @param index - 1-based index
 * @returns Classified VAST entry
 */
function classifyEntry(raw: string, index: number): VastEntry {
  const trimmed = raw.trim();

  // Determine type
  let type: VastEntryType = 'Other';
  if (looksVastXml(trimmed)) {
    type = 'VAST XML';
  } else if (isUrlLine(trimmed)) {
    if (looksVastUrl(trimmed)) {
      type = 'VAST URL';
    } else {
      type = 'Ad Tag';
    }
  }

  // Extract host and vendor (only for URLs)
  let host = '';
  let vendor = '';
  let params: Record<string, string> = {};

  if (type === 'VAST URL' || type === 'Ad Tag') {
    host = extractHost(trimmed);
    const classification = classifyVendor(trimmed);
    vendor = classification.vendor;
    params = extractParams(trimmed);
  }

  return {
    i: index,
    type,
    raw: trimmed,
    host,
    vendor,
    params,
  };
}

/**
 * Parse single VAST tag (convenience wrapper)
 * 
 * @param tag - Single VAST URL or XML
 * @returns Classified entry
 * 
 * @example
 * ```typescript
 * const entry = parseSingleTag('https://ad.doubleclick.net/vast?id=123');
 * // => { i: 1, type: 'VAST URL', raw: '...', vendor: 'CM360', ... }
 * ```
 */
export function parseSingleTag(tag: string): VastEntry {
  const results = parseBulkInput(tag);
  return results[0] || {
    i: 1,
    type: 'Other',
    raw: tag,
    host: '',
    vendor: '',
    params: {},
  };
}

/**
 * Filter entries by type
 * 
 * @param entries - Array of entries
 * @param type - Type to filter by
 * @returns Filtered entries
 * 
 * @example
 * ```typescript
 * const entries = parseBulkInput(text);
 * const vastUrls = filterByType(entries, 'VAST URL');
 * const vastXml = filterByType(entries, 'VAST XML');
 * ```
 */
export function filterByType(
  entries: VastEntry[],
  type: VastEntryType,
): VastEntry[] {
  return entries.filter((e) => e.type === type);
}

/**
 * Filter entries by vendor
 * 
 * @param entries - Array of entries
 * @param vendor - Vendor name to filter by
 * @returns Filtered entries
 * 
 * @example
 * ```typescript
 * const entries = parseBulkInput(text);
 * const cm360Tags = filterByVendor(entries, 'CM360');
 * const innovidTags = filterByVendor(entries, 'Innovid');
 * ```
 */
export function filterByVendor(
  entries: VastEntry[],
  vendor: string,
): VastEntry[] {
  return entries.filter((e) => e.vendor === vendor);
}

/**
 * Group entries by vendor
 * 
 * @param entries - Array of entries
 * @returns Map of vendor names to entry arrays
 * 
 * @example
 * ```typescript
 * const entries = parseBulkInput(text);
 * const grouped = groupByVendor(entries);
 * // => {
 * //   'CM360': [entry1, entry2],
 * //   'Innovid': [entry3],
 * //   'DoubleVerify': [entry4, entry5, entry6]
 * // }
 * ```
 */
export function groupByVendor(entries: VastEntry[]): Record<string, VastEntry[]> {
  const groups: Record<string, VastEntry[]> = {};
  
  for (const entry of entries) {
    const vendor = entry.vendor || 'Unknown';
    if (!groups[vendor]) {
      groups[vendor] = [];
    }
    groups[vendor].push(entry);
  }
  
  return groups;
}

/**
 * Get summary statistics for bulk parse results
 * 
 * @param entries - Array of entries
 * @returns Summary object with counts
 * 
 * @example
 * ```typescript
 * const entries = parseBulkInput(text);
 * const summary = getSummary(entries);
 * // => {
 * //   total: 10,
 * //   vastXml: 2,
 * //   vastUrl: 7,
 * //   adTag: 1,
 * //   other: 0,
 * //   vendors: { 'CM360': 5, 'Innovid': 3, 'DoubleVerify': 2 }
 * // }
 * ```
 */
export function getSummary(entries: VastEntry[]) {
  const summary = {
    total: entries.length,
    vastXml: 0,
    vastUrl: 0,
    adTag: 0,
    other: 0,
    vendors: {} as Record<string, number>,
  };

  for (const entry of entries) {
    // Count by type
    switch (entry.type) {
      case 'VAST XML':
        summary.vastXml++;
        break;
      case 'VAST URL':
        summary.vastUrl++;
        break;
      case 'Ad Tag':
        summary.adTag++;
        break;
      default:
        summary.other++;
    }

    // Count by vendor
    if (entry.vendor) {
      summary.vendors[entry.vendor] = (summary.vendors[entry.vendor] || 0) + 1;
    }
  }

  return summary;
}

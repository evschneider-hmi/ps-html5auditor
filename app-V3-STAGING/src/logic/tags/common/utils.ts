/**
 * VAST Tag System - Utility Functions
 * 
 * Shared helper functions for VAST parsing, text normalization, and XLSX loading.
 * Extracted from V2 for V3 modular architecture.
 * 
 * @module vast/utils
 */

/**
 * Cached promise for dynamic XLSX module import
 */
let xlsxModulePromise: Promise<any> | null = null;

/**
 * Dynamically import XLSX library with caching
 * 
 * Loads xlsx only when needed (lazy loading).
 * Subsequent calls return cached promise for efficiency.
 * 
 * @returns Promise resolving to XLSX module
 * 
 * @example
 * ```typescript
 * const xlsx = await loadXLSX();
 * const workbook = xlsx.read(data, { type: 'array' });
 * ```
 */
export async function loadXLSX(): Promise<any> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }
  return xlsxModulePromise;
}

/**
 * Normalize any value to trimmed string
 * 
 * Handles undefined/null by returning empty string.
 * Converts all other values to string and trims whitespace.
 * 
 * @param value - Any value to normalize
 * @returns Normalized string
 * 
 * @example
 * ```typescript
 * normalizeText(undefined)  // => ''
 * normalizeText(null)       // => ''
 * normalizeText('  foo  ')  // => 'foo'
 * normalizeText(123)        // => '123'
 * ```
 */
export function normalizeText(value: any): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

/**
 * Normalize header text for consistent matching
 * 
 * Collapses multiple spaces, trims, and lowercases.
 * Used for flexible column header matching in tag sheets.
 * 
 * @param value - Header string to normalize
 * @returns Normalized header
 * 
 * @example
 * ```typescript
 * normalizeHeader('Placement  ID')  // => 'placement id'
 * normalizeHeader('VAST URL')       // => 'vast url'
 * normalizeHeader('  Tag  ')        // => 'tag'
 * ```
 */
export function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Check if string is a valid HTTP/HTTPS URL
 * 
 * @param s - String to test
 * @returns True if string starts with http:// or https://
 * 
 * @example
 * ```typescript
 * isUrlLine('https://example.com')  // => true
 * isUrlLine('http://example.com')   // => true
 * isUrlLine('ftp://example.com')    // => false
 * isUrlLine('not a url')            // => false
 * ```
 */
export function isUrlLine(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

/**
 * Check if string looks like a VAST URL
 * 
 * Detects URLs with .xml extension or containing 'vast' or 'adtag' keywords.
 * 
 * @param s - String to test
 * @returns True if string appears to be a VAST URL
 * 
 * @example
 * ```typescript
 * looksVastUrl('https://ad.doubleclick.net/vast')      // => true
 * looksVastUrl('https://example.com/tag.xml')          // => true
 * looksVastUrl('https://example.com/adtag?id=123')     // => true
 * looksVastUrl('https://example.com/banner.jpg')       // => false
 * ```
 */
export function looksVastUrl(s: string): boolean {
  const lower = s.toLowerCase();
  return lower.includes('.xml') || /\b(vast|adtag)\b/i.test(s);
}

/**
 * Check if string looks like VAST XML content
 * 
 * Detects strings starting with < and containing <VAST> tag.
 * 
 * @param s - String to test
 * @returns True if string appears to be VAST XML
 * 
 * @example
 * ```typescript
 * looksVastXml('<VAST version="3.0">...</VAST>')  // => true
 * looksVastXml('<?xml version="1.0"?><VAST>...')  // => true
 * looksVastXml('<html>...</html>')                 // => false
 * looksVastXml('https://example.com/vast.xml')     // => false
 * ```
 */
export function looksVastXml(s: string): boolean {
  return s.trim().startsWith('<') && /<VAST\b/i.test(s);
}

/**
 * Extract hostname from URL with error handling
 * 
 * Safely extracts hostname using URL constructor.
 * Returns empty string on parse error.
 * 
 * @param url - URL string to parse
 * @returns Hostname or empty string
 * 
 * @example
 * ```typescript
 * extractHost('https://ad.doubleclick.net/path')  // => 'ad.doubleclick.net'
 * extractHost('http://example.com:8080/path')     // => 'example.com'
 * extractHost('not a url')                         // => ''
 * ```
 */
export function extractHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Extract query parameters from URL
 * 
 * Parses URL query string into key-value object.
 * Returns empty object on parse error.
 * 
 * @param url - URL string to parse
 * @returns Query parameters as object
 * 
 * @example
 * ```typescript
 * extractParams('https://example.com?foo=bar&baz=qux')
 * // => { foo: 'bar', baz: 'qux' }
 * 
 * extractParams('https://example.com')
 * // => {}
 * 
 * extractParams('not a url')
 * // => {}
 * ```
 */
export function extractParams(url: string): Record<string, string> {
  try {
    const parsed = new URL(url);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  } catch {
    return {};
  }
}

/**
 * Extract the last N segments from a hostname
 * 
 * Useful for vendor fallback (e.g., 'ad.doubleclick.net' => 'doubleclick.net').
 * 
 * @param hostname - Hostname to process
 * @param segments - Number of segments to extract (default: 2)
 * @returns Last N segments joined with dots
 * 
 * @example
 * ```typescript
 * lastHostSegments('ad.doubleclick.net', 2)  // => 'doubleclick.net'
 * lastHostSegments('sub.example.com', 2)     // => 'example.com'
 * lastHostSegments('localhost', 2)           // => 'localhost'
 * ```
 */
export function lastHostSegments(hostname: string, segments: number = 2): string {
  const parts = hostname.split('.');
  return parts.slice(-segments).join('.');
}

/**
 * VAST XML helper: Get first text content by local tag name
 * 
 * Searches for element by local name (ignoring namespaces) and returns text content.
 * 
 * @param doc - XML Document to search
 * @param localNames - Array of local tag names to try
 * @returns First matching text content or empty string
 */
export function firstTextByLocal(doc: Document, localNames: string[]): string {
  for (const name of localNames) {
    const els = doc.querySelectorAll('*');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.localName === name) {
        return (el.textContent || '').trim();
      }
    }
  }
  return '';
}

/**
 * VAST XML helper: Get all elements by local tag name
 * 
 * Returns array of elements matching local name (ignoring namespaces).
 * 
 * @param doc - XML Document to search
 * @param localName - Local tag name to find
 * @returns Array of matching elements
 */
export function elsByLocal(doc: Document, localName: string): Element[] {
  const result: Element[] = [];
  const els = doc.querySelectorAll('*');
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (el.localName === localName) {
      result.push(el);
    }
  }
  return result;
}

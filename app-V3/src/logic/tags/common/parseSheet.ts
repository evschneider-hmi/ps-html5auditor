/**
 * VAST Tag System - Sheet Parser
 * 
 * Parses Excel/CSV tag sheets to extract VAST URLs and metadata.
 * Extracted from V2 VastTester.tsx for V3 modular architecture.
 * 
 * @module vast/parseSheet
 */

import { loadXLSX, normalizeText, normalizeHeader } from './utils';
import { parseBulkInput } from './parseBulk';
import type { SheetRowWithEntry, TagSheetRow } from '../types';

/**
 * Expected header column names for tag sheets
 * 
 * Flexible header detection supports multiple naming variations.
 * Case-insensitive matching with whitespace normalization.
 */
export const EXPECTED_HEADERS = new Set([
  'placement id',
  'placementid',
  'placement_id',
  'placement name',
  'placementname',
  'platform',
  'start date',
  'startdate',
  'end date',
  'enddate',
  'tag',
  'vast url',
  'vast',
  'vasturl',
  'ad tag',
  'adtag',
  'ad tag uri',
  'adtaguri',
  'ad tag url',
  'adtag url',
  'vast tag',
  'vasttag',
  'vast ad tag uri',
  'vast ad tag url',
]);

/**
 * Sheet file extension pattern
 */
export const SHEET_FILE_PATTERN = /(\.xlsx|\.xlsm|\.xlsb|\.xls|\.csv)$/i;

/**
 * Extract VAST tags from Excel/CSV workbook
 * 
 * Searches for header row by scoring expected column names.
 * Extracts VAST URLs and metadata from data rows.
 * 
 * @param xlsx - XLSX module instance
 * @param workbook - Parsed workbook object
 * @param fileLabel - Display label for source file
 * @returns Array of parsed rows with VAST entries and metadata
 * 
 * @example
 * ```typescript
 * const xlsx = await loadXLSX();
 * const file = await fetch('tags.xlsx').then(r => r.arrayBuffer());
 * const workbook = xlsx.read(file, { type: 'array' });
 * const rows = extractRowsFromWorkbook(xlsx, workbook, 'tags.xlsx');
 * // => [
 * //   {
 * //     entry: { i: 1, type: 'VAST URL', raw: '...', vendor: 'CM360', ... },
 * //     meta: {
 * //       rowIndex: 2,
 * //       placementId: '123456',
 * //       placementName: 'Display Campaign',
 * //       platform: 'Desktop',
 * //       startDate: '2025-01-01',
 * //       endDate: '2025-01-31',
 * //       vastUrl: 'https://...',
 * //       sourceLabel: 'tags.xlsx - Sheet1 #2'
 * //     },
 * //     source: 'upload',
 * //     key: 'tags.xlsx - Sheet1|2|https://...'
 * //   }
 * // ]
 * ```
 */
export function extractRowsFromWorkbook(
  xlsx: any,
  workbook: any,
  fileLabel: string,
): SheetRowWithEntry[] {
  const collected: SheetRowWithEntry[] = [];

  workbook.SheetNames.forEach((sheetName: string) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    // Convert sheet to array of arrays
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (!Array.isArray(rows) || rows.length === 0) return;

    // 1) Find the most likely header row by scanning for expected headings
    let headerRowIndex = 0;
    let bestScore = -1;

    for (let ri = 0; ri < Math.min(rows.length, 50); ri++) {
      const r = rows[ri] as any[];
      if (!Array.isArray(r)) continue;

      const score = r.reduce((acc: number, cell: any) => {
        const norm = normalizeHeader(normalizeText(cell));
        return acc + (EXPECTED_HEADERS.has(norm) ? 1 : 0);
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = ri;
      }

      // Stop early if we found a good header
      if (score >= 4) break;
    }

    // Parse header row
    const headers = (rows[headerRowIndex] as any[]).map((cell: any) =>
      normalizeText(cell),
    );

    const headerMap = new Map<string, number>();
    headers.forEach((cell: string, idx: number) => {
      const norm = normalizeHeader(cell);
      if (norm) headerMap.set(norm, idx);
    });

    /**
     * Pick first matching value from row by header aliases
     */
    const pick = (row: any[], keys: string[]): string | undefined => {
      for (const key of keys) {
        const index = headerMap.get(key);
        if (index === undefined || index >= row.length) continue;
        const text = normalizeText(row[index]);
        if (text) return text;
      }
      return undefined;
    };

    // 2) Iterate data rows after the header row
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i] as any[];
      if (!row) continue;

      const textCells = row.map(normalizeText).filter(Boolean);

      // Prefer known header aliases for the VAST URL cell
      let vastUrl = pick(row, [
        'vast url',
        'vast',
        'vasturl',
        'tag',
        'ad tag',
        'adtag',
        'ad tag uri',
        'adtaguri',
        'ad tag url',
        'adtag url',
        'vast tag',
        'vasttag',
        'vast ad tag uri',
        'vast ad tag url',
      ]);

      if (!vastUrl) {
        // Fallback: any URL-like text that looks like a VAST/adtag link
        vastUrl = textCells.find(
          (value) => /https?:\/\//i.test(value) && /(vast|adtag)/i.test(value),
        );
      }

      if (!vastUrl) continue;

      // Parse VAST URL
      const parsed = parseBulkInput(vastUrl);
      const entry = parsed[0]
        ? { ...parsed[0], raw: vastUrl }
        : {
            i: i,
            type: 'VAST URL' as const,
            raw: vastUrl,
            host: '',
            vendor: '',
            params: {},
          };

      // Build metadata
      const label = sheetName ? `${fileLabel} - ${sheetName}` : fileLabel;
      const meta: TagSheetRow = {
        rowIndex: i + 1,
        placementId: pick(row, ['placement id', 'placementid', 'placement_id']),
        placementName: pick(row, ['placement name', 'placementname']),
        platform: pick(row, ['platform']),
        startDate: pick(row, ['start date', 'startdate']),
        endDate: pick(row, ['end date', 'enddate']),
        vastUrl,
        sourceLabel: `${label} #${i + 1}`,
      };

      collected.push({
        entry,
        meta,
        source: 'upload',
        key: `${label}|${i + 1}|${vastUrl}`,
      });
    }
  });

  return collected;
}

/**
 * Parse tag sheet file
 * 
 * High-level function to load and parse Excel/CSV file.
 * 
 * @param file - File object or ArrayBuffer
 * @param fileName - Display name for file
 * @returns Promise resolving to parsed rows
 * 
 * @example
 * ```typescript
 * // From File input
 * const file = fileInput.files[0];
 * const rows = await parseTagSheet(file, file.name);
 * 
 * // From fetch
 * const buffer = await fetch('tags.xlsx').then(r => r.arrayBuffer());
 * const rows = await parseTagSheet(buffer, 'tags.xlsx');
 * ```
 */
export async function parseTagSheet(
  file: File | ArrayBuffer,
  fileName: string,
): Promise<SheetRowWithEntry[]> {
  const xlsx = await loadXLSX();

  // Get buffer from File if needed
  let buffer: ArrayBuffer;
  if (file instanceof File) {
    buffer = await file.arrayBuffer();
  } else {
    buffer = file;
  }

  // Parse workbook
  const workbook = xlsx.read(buffer, { type: 'array' });

  // Extract rows
  return extractRowsFromWorkbook(xlsx, workbook, fileName);
}

/**
 * Parse multiple tag sheet files
 * 
 * @param files - Array of files to parse
 * @returns Promise resolving to combined results
 * 
 * @example
 * ```typescript
 * const files = Array.from(fileInput.files);
 * const allRows = await parseMultipleSheets(files);
 * ```
 */
export async function parseMultipleSheets(
  files: File[],
): Promise<SheetRowWithEntry[]> {
  const results = await Promise.all(
    files.map((file) => parseTagSheet(file, file.name)),
  );

  return results.flat();
}

/**
 * Check if file is a tag sheet
 * 
 * @param fileName - File name to check
 * @returns True if file is Excel/CSV
 * 
 * @example
 * ```typescript
 * isTagSheet('tags.xlsx')  // => true
 * isTagSheet('tags.csv')   // => true
 * isTagSheet('image.jpg')  // => false
 * ```
 */
export function isTagSheet(fileName: string): boolean {
  return SHEET_FILE_PATTERN.test(fileName);
}

/**
 * Get sheet statistics
 * 
 * @param rows - Parsed sheet rows
 * @returns Statistics object
 * 
 * @example
 * ```typescript
 * const rows = await parseTagSheet(file, 'tags.xlsx');
 * const stats = getSheetStats(rows);
 * // => {
 * //   totalRows: 100,
 * //   uniqueVendors: ['CM360', 'Innovid', 'DoubleVerify'],
 * //   vendorCounts: { 'CM360': 50, 'Innovid': 30, 'DoubleVerify': 20 },
 * //   sheets: ['Sheet1', 'Sheet2']
 * // }
 * ```
 */
export function getSheetStats(rows: SheetRowWithEntry[]) {
  const vendors = new Set<string>();
  const vendorCounts: Record<string, number> = {};
  const sheets = new Set<string>();

  for (const row of rows) {
    const vendor = row.entry.vendor || 'Unknown';
    vendors.add(vendor);
    vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;

    // Extract sheet name from source label
    const sheetMatch = row.meta.sourceLabel.match(/- (.+?) #/);
    if (sheetMatch) {
      sheets.add(sheetMatch[1]);
    }
  }

  return {
    totalRows: rows.length,
    uniqueVendors: Array.from(vendors),
    vendorCounts,
    sheets: Array.from(sheets),
  };
}

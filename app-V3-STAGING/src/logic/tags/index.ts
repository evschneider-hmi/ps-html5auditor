/**
 * Tag System (Multi-Type Support)
 * 
 * Comprehensive tag parsing, classification, and sheet processing.
 * Supports VAST, JavaScript, Pixel, Iframe, and other ad tag types.
 * 
 * @module tags
 * 
 * @example
 * ```typescript
 * // Parse bulk text input (auto-detects tag type)
 * import { parseBulkInput } from './logic/tags';
 * const entries = parseBulkInput(text);
 * 
 * // Parse Excel/CSV tag sheet
 * import { parseTagSheet } from './logic/tags';
 * const rows = await parseTagSheet(file, 'tags.xlsx');
 * 
 * // Classify vendor
 * import { classifyVendor } from './logic/tags';
 * const result = classifyVendor(url);
 * ```
 */

// Type definitions
export type {
  VastEntry,
  VastEntryType,
  BulkEntry,
  TagSheetRow,
  SheetRowWithEntry,
  VendorClassification,
  KnownVendor,
  VastAnalysisSummary,
} from './types';

export { HIGHLIGHT_PARAM_PRIORITY, KNOWN_VENDORS } from './types';

// Bulk parsing (supports all tag types)
export {
  parseBulkInput,
  parseSingleTag,
  filterByType,
  filterByVendor,
  groupByVendor,
  getSummary,
} from './common/parseBulk';

// Sheet parsing (supports all tag types)
export {
  extractRowsFromWorkbook,
  parseTagSheet,
  parseMultipleSheets,
  isTagSheet,
  getSheetStats,
  EXPECTED_HEADERS,
  SHEET_FILE_PATTERN,
} from './common/parseSheet';

// Vendor classification (supports all tag types)
export {
  classifyVendor,
  classify,
  host,
  classifyBatch,
  getVendorStats,
} from './common/classifyVendor';

// Utilities (supports all tag types)
export {
  loadXLSX,
  normalizeText,
  normalizeHeader,
  isUrlLine,
  looksVastUrl,
  looksVastXml,
  extractHost,
  extractParams,
  lastHostSegments,
  firstTextByLocal,
  elsByLocal,
} from './common/utils';

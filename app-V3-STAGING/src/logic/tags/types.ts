/**
 * VAST Tag System - Type Definitions
 * 
 * Provides comprehensive type definitions for VAST tag parsing, classification,
 * and sheet processing. Extracted from V2 for modular V3 architecture.
 * 
 * @module vast/types
 */

/**
 * Classified VAST entry type
 */
export type VastEntryType = 
  | 'VAST XML'  // Inline VAST XML content
  | 'VAST URL'  // URL to VAST XML resource
  | 'Ad Tag'    // Generic ad tag URL
  | 'Other';    // Unclassified content

/**
 * Single VAST tag entry with classification metadata
 * 
 * @property i - 1-based index in source list
 * @property type - Classified entry type
 * @property raw - Original input string (URL or XML)
 * @property host - Extracted hostname (empty if XML)
 * @property vendor - Classified vendor name (e.g., 'CM360', 'Innovid')
 * @property params - Extracted URL query parameters
 */
export interface VastEntry {
  i: number;
  type: VastEntryType;
  raw: string;
  host: string;
  vendor: string;
  params: Record<string, string>;
}

/**
 * Alias for VastEntry (legacy compatibility)
 */
export type BulkEntry = VastEntry;

/**
 * Priority URL parameters for highlighting/display
 * 
 * Parameters are listed in descending priority order for UI display.
 */
export const HIGHLIGHT_PARAM_PRIORITY = [
  'plc',        // Placement
  'cmp',        // Campaign
  'sid',        // Site ID
  'ctx',        // Context
  'advid',      // Advertiser ID
  'adsrv',      // Ad Server
  'campaign',   // Campaign (full name)
  'placement',  // Placement (full name)
  'lineitem',   // Line Item
  'lineitemid', // Line Item ID
  'bundle',     // Bundle ID
  'creative',   // Creative
  'unit',       // Unit
  'pid',        // Publisher ID
  'tagid',      // Tag ID
] as const;

/**
 * Tag sheet row metadata
 * 
 * @property rowIndex - Original row number in sheet (1-based)
 * @property placementId - CM360/DCM placement identifier
 * @property placementName - Human-readable placement name
 * @property platform - Delivery platform (e.g., 'Desktop', 'Mobile')
 * @property startDate - Campaign start date
 * @property endDate - Campaign end date
 * @property vastUrl - VAST tag URL or XML content
 * @property sourceLabel - Display label for source (file + sheet + row)
 */
export interface TagSheetRow {
  rowIndex: number;
  placementId?: string;
  placementName?: string;
  platform?: string;
  startDate?: string;
  endDate?: string;
  vastUrl: string;
  sourceLabel: string;
}

/**
 * Combined sheet row with parsed VAST entry
 * 
 * @property entry - Parsed VAST entry
 * @property meta - Row metadata
 * @property source - Data source ('upload' | 'manual')
 * @property key - Unique row identifier
 */
export interface SheetRowWithEntry {
  entry: VastEntry;
  meta: TagSheetRow;
  source: 'upload' | 'manual';
  key: string;
}

/**
 * Vendor classification result
 * 
 * @property vendor - Primary vendor name
 * @property host - Hostname extracted from URL
 * @property isRecognized - Whether vendor is in known list
 */
export interface VendorClassification {
  vendor: string;
  host: string;
  isRecognized: boolean;
}

/**
 * Known VAST vendors
 */
export const KNOWN_VENDORS = [
  'CM360',
  'Innovid',
  'DoubleVerify',
  'IAS',
  'MOAT',
  'Sizmek',
  'Flashtalking',
  'AdForm',
  'Celtra',
  'Bannerflow',
] as const;

export type KnownVendor = typeof KNOWN_VENDORS[number];

/**
 * VAST tag analysis summary
 * 
 * @property total - Total entries analyzed
 * @property vastXml - Count of VAST XML entries
 * @property vastUrl - Count of VAST URL entries
 * @property adTag - Count of generic ad tag entries
 * @property other - Count of unclassified entries
 * @property vendors - Vendor distribution map
 */
export interface VastAnalysisSummary {
  total: number;
  vastXml: number;
  vastUrl: number;
  adTag: number;
  other: number;
  vendors: Record<string, number>;
}

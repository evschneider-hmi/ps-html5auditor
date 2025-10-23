import { Severity } from './severity';

export interface SizeSourceInfo {
  method: 'meta' | 'gwd-admetadata' | 'css-media' | 'css-rule' | 'inline-style' | 'css-file';
  snippet?: string;
  path?: string;
}

export interface ZipBundle {
  id: string;
  name: string;
  bytes: Uint8Array;
  files: Record<string, Uint8Array>; // normalized path -> bytes
  lowerCaseIndex: Record<string, string>; // lowercase path -> canonical path
}

export interface PrimaryAsset {
  path: string;
  adSize?: { width: number; height: number };
  sizeSource?: SizeSourceInfo;
}

export type ReferenceType = 'img' | 'css' | 'js' | 'font' | 'media' | 'xhr' | 'anchor';

export interface Reference {
  from: string; // source file path
  type: ReferenceType;
  url: string; // original url string
  normalized?: string; // normalized (for in-zip matching)
  inZip: boolean;
  external: boolean;
  secure?: boolean;
  line?: number;
  column?: number;
}

export type OffenderCategory = 'code' | 'assets' | 'environment' | 'packaging';

export interface FindingOffender {
  path: string;
  detail?: string;
  line?: number;
  category?: OffenderCategory;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  messages: string[];
  offenders: FindingOffender[];
  profiles?: ('CM360' | 'IAB' | 'BOTH')[];
  description?: string;
}

export interface BundleResultSummary {
  status: Severity;
  totalFindings: number;
  fails: number;
  warns: number;
  pass: number;
  orphanCount: number;
  missingAssetCount: number;
}

export interface RuntimeMetrics {
  source?: string;
  capturedAt?: number;
  loadEventTime?: number;
  initialRequests?: number;
  subloadRequests?: number;
  userRequests?: number;
  totalRequests?: number;
  initialBytes?: number;
  subloadBytes?: number;
  userBytes?: number;
  totalBytes?: number;
}

export interface BundleResult {
  bundleId: string;
  bundleName: string;
  primary?: PrimaryAsset;
  adSize?: { width: number; height: number };
  adSizeSource?: SizeSourceInfo;
  findings: Finding[];
  references: Reference[];
  summary: BundleResultSummary;
  totalBytes?: number; // aggregate size of all in-zip files
  // IAB phase metrics (computed heuristically based on direct references from primary HTML & CSS graph)
  initialBytes?: number; // compressed bytes for primary + directly referenced assets (initial load)
  subsequentBytes?: number; // compressed bytes for polite/subload assets
  zippedBytes?: number; // original compressed zip size (bundle.bytes length)
  initialRequests?: number; // count of initial load assets (including primary)
  totalRequests?: number; // total distinct in-zip referenced assets (including primary)
  subloadRequests?: number;
  userRequests?: number;
  subloadBytes?: number;
  userBytes?: number;
  initialBytesUncompressed?: number; // raw bytes for primary + referenced assets
  subsequentBytesUncompressed?: number; // raw bytes for polite/subload assets
  runtime?: RuntimeMetrics;
  runtimeSummary?: Record<string, unknown>;
}

export interface Report {
  profile: string;
  settings: any;
  results: BundleResult[];
  generatedAt: string;
  version: string;
}


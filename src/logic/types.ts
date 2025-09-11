import { Severity } from './severity';

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

export interface FindingOffender {
  path: string;
  detail?: string;
  line?: number;
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  messages: string[];
  offenders: FindingOffender[];
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

export interface BundleResult {
  bundleId: string;
  bundleName: string;
  primary?: PrimaryAsset;
  adSize?: { width: number; height: number };
  findings: Finding[];
  references: Reference[];
  summary: BundleResultSummary;
  totalBytes?: number; // aggregate size of all in-zip files
  // IAB phase metrics (computed heuristically based on direct references from primary HTML & CSS graph)
  initialBytes?: number; // bytes for primary + directly referenced assets
  subsequentBytes?: number; // total - initial
  zippedBytes?: number; // original compressed zip size (bundle.bytes length)
  initialRequests?: number; // count of initial load assets (including primary)
  totalRequests?: number; // total distinct in-zip referenced assets (including primary)
}

export interface Report {
  profile: string;
  settings: any;
  results: BundleResult[];
  generatedAt: string;
  version: string;
}

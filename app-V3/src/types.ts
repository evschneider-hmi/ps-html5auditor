// Shared App-level types for V3
import type { Finding, BundleResult, ZipBundle } from './logic/types';
import type { CreativeMetadata } from './utils/creativeMetadataDetector';

export type UploadType = 'creative' | 'tag';
export type CreativeSubtype = 'html5' | 'static' | 'video';
export type TagSubtype = 'vast' | 'adtag';

export interface Upload {
  id: string;
  timestamp: number;
  type: UploadType;
  subtype: CreativeSubtype | TagSubtype;
  bundle: ZipBundle;
  bundleResult: BundleResult;
  findings: Finding[];
  creativeMetadata?: CreativeMetadata; // Auto-detected creative metadata from filename
}

export type ActiveTab = null | 'creatives' | 'tags';

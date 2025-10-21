export interface VastEntry {
  id: string;
  type: 'VAST URL' | 'VAST XML';
  vendor: string;
  host: string;
  placementId: string;
  placementName: string;
  platform: string;
  startDate: string;
  endDate: string;
  vastUrl: string;
  creative: string;
  vastVersion: string;
  duration: string;
  impressionVendors: string[];
  clickVendors: string[];
  otherParams: string;
  alerts: string[];
  sourceFile?: string;
}

export interface ParsedVastData {
  version: string;
  duration: string;
  mediaUrl: string;
  clickThrough: string;
  impressionTrackers: string[];
  clickTrackers: string[];
  vendor: string;
  warnings: string[];
  errors: string[];
}

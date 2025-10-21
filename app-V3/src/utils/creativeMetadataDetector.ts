/**
 * Creative Metadata Detection Utility
 * 
 * Analyzes HTML5 creative filenames to automatically detect:
 * - Brand/Client (Eylea HD, Honda, Walden, SWO, UHCH, etc.)
 * - Creative Set Name (Teresa Animated Banners, Spirit of Honda Value, etc.)
 * - Creative Size (160x600, 300x250, etc.)
 * - Variant/Version (if applicable)
 * 
 * Used to auto-name uploads and group creatives by brand and creative set.
 */

export interface CreativeMetadata {
  brand: string;
  creativeName: string;
  size: string;
  variant?: string;
  fullName: string; // "Brand - Creative Name (Size)"
  groupKey: string; // "brand_creativeName" for grouping
}

/**
 * Extract creative size from filename
 * Matches patterns: 160x600, 300x250, 728x90, 970x250, 320x50, etc.
 */
function extractSize(filename: string): string | null {
  const sizeMatch = filename.match(/(\d{2,4}x\d{2,4})/);
  return sizeMatch ? sizeMatch[1] : null;
}

/**
 * Detect Eylea HD creatives
 * Pattern: [size]_Eylea HD_[creative]_H5_[codes]_[job].zip
 * Example: 160x600_Eylea HD_Teresa Animated Banners_H5_45_A23_US.EHD.24.11.0015.zip
 */
function detectEyleaHD(filename: string): CreativeMetadata | null {
  const match = filename.match(/Eylea\s*HD[_\s]+([^_]+)/i);
  if (!match) return null;

  const creativeName = match[1]
    .replace(/[_\s]+H5.*$/, '') // Remove everything after H5
    .trim();
  
  const size = extractSize(filename) || 'unknown';
  
  return {
    brand: 'Eylea HD',
    creativeName: creativeName,
    size,
    fullName: `Eylea HD - ${creativeName} (${size})`,
    groupKey: 'eylea_hd_' + creativeName.toLowerCase().replace(/\s+/g, '_')
  };
}

/**
 * Detect Honda ACC creatives
 * Pattern: ACC_NEW_[creative]_[codes]_ENG_[size]_[codes]_ACC.zip
 * Example: ACC_NEW_Spirit of Honda Value RV2_NSEV_239LL_ENG_160x600_WDCH_H5_NV_SNW_ACC.zip
 */
function detectHondaACC(filename: string): CreativeMetadata | null {
  const match = filename.match(/ACC_NEW_([^_]+)_[^_]+_[^_]+_ENG/);
  if (!match) return null;

  const creativeName = match[1].trim();
  const size = extractSize(filename) || 'unknown';
  
  return {
    brand: 'Honda',
    creativeName: `ACC - ${creativeName}`,
    size,
    fullName: `Honda ACC - ${creativeName} (${size})`,
    groupKey: 'honda_acc_' + creativeName.toLowerCase().replace(/\s+/g, '_')
  };
}

/**
 * Detect Honda HRV creatives
 * Pattern: HRV_NEW_[creative]_[codes]_ENG_[size]_[codes]_HRV.zip
 * Example: HRV_NEW_Spirit of Honda Value_SPRE_279L_ENG_160x600_WDCH_H5_NV_SNW_HRV.zip
 */
function detectHondaHRV(filename: string): CreativeMetadata | null {
  const match = filename.match(/HRV_NEW_([^_]+)_[^_]+_[^_]+_ENG/);
  if (!match) return null;

  const creativeName = match[1].trim();
  const size = extractSize(filename) || 'unknown';
  
  return {
    brand: 'Honda',
    creativeName: `HRV - ${creativeName}`,
    size,
    fullName: `Honda HRV - ${creativeName} (${size})`,
    groupKey: 'honda_hrv_' + creativeName.toLowerCase().replace(/\s+/g, '_')
  };
}

/**
 * Detect Walden creatives
 * Pattern: walden_[creative]_[size]_[type].zip
 * Example: walden_conversion_160x600_animated.zip
 */
function detectWalden(filename: string): CreativeMetadata | null {
  const match = filename.match(/walden[_\s]+([^_]+)/i);
  if (!match) return null;

  const creativeType = match[1].trim();
  const size = extractSize(filename) || 'unknown';
  const isAnimated = filename.toLowerCase().includes('animated');
  
  const creativeName = creativeType.charAt(0).toUpperCase() + creativeType.slice(1);
  const fullCreative = isAnimated ? `${creativeName} (Animated)` : creativeName;
  
  return {
    brand: 'Walden',
    creativeName: fullCreative,
    size,
    fullName: `Walden - ${fullCreative} (${size})`,
    groupKey: 'walden_' + creativeType.toLowerCase()
  };
}

/**
 * Detect SWO creatives
 * Pattern: SWO_[date]_[creative]_[codes]_[size]_ENG.zip
 * Example: SWO_10-19-25_LOC SDay D-O_HOS_SDT_AL4599_DIS_D-HTML5_160x600_ENG.zip
 */
function detectSWO(filename: string): CreativeMetadata | null {
  const match = filename.match(/SWO_([0-9\-]+)_([^_]+)/);
  if (!match) return null;

  const date = match[1];
  const creativeName = match[2].trim();
  const size = extractSize(filename) || 'unknown';
  
  return {
    brand: 'SWO',
    creativeName: creativeName,
    size,
    variant: date,
    fullName: `SWO - ${creativeName} (${size}) [${date}]`,
    groupKey: 'swo_' + creativeName.toLowerCase().replace(/\s+/g, '_')
  };
}

/**
 * Detect UHCH creatives
 * Pattern: UHCH_[creative]_[variant]_Display_[size].zip
 * Example: UHCH_Sept Campaign_OTC Jabra_Display_970x250.zip
 */
function detectUHCH(filename: string): CreativeMetadata | null {
  const match = filename.match(/UHCH_([^_]+)_([^_]+)_Display/);
  if (!match) return null;

  const creativeName = match[1].trim();
  const variant = match[2].trim();
  const size = extractSize(filename) || 'unknown';
  
  return {
    brand: 'UHCH',
    creativeName: creativeName,
    size,
    variant,
    fullName: `UHCH - ${creativeName} (${size}) - ${variant}`,
    groupKey: 'uhch_' + creativeName.toLowerCase().replace(/\s+/g, '_')
  };
}

/**
 * Fallback: Extract basic info from filename
 * Uses size and first part of filename as brand
 */
function detectGeneric(filename: string): CreativeMetadata {
  const size = extractSize(filename) || 'unknown';
  
  // Extract first meaningful part (before underscore or after slash)
  const cleanName = filename.replace(/\.zip$/i, '');
  const parts = cleanName.split(/[_\s]+/);
  const brand = parts[0] || 'Unknown';
  
  return {
    brand: brand.charAt(0).toUpperCase() + brand.slice(1),
    creativeName: 'Creative',
    size,
    fullName: `${brand} - Creative (${size})`,
    groupKey: brand.toLowerCase() + '_creative'
  };
}

/**
 * Main detection function
 * Tries all brand-specific detectors, falls back to generic
 */
export function detectCreativeMetadata(filename: string): CreativeMetadata {
  // Remove path if present (keep only filename)
  const cleanFilename = filename.split(/[/\\]/).pop() || filename;
  
  // Try brand-specific detectors in order
  const detectors = [
    detectEyleaHD,
    detectHondaACC,
    detectHondaHRV,
    detectWalden,
    detectSWO,
    detectUHCH
  ];
  
  for (const detector of detectors) {
    const result = detector(cleanFilename);
    if (result) return result;
  }
  
  // Fallback to generic detection
  return detectGeneric(cleanFilename);
}

/**
 * Group multiple creative sets by brand and creative name
 * Returns Map of groupKey -> array of CreativeMetadata
 */
export function groupCreativeSets(creatives: CreativeMetadata[]): Map<string, CreativeMetadata[]> {
  const groups = new Map<string, CreativeMetadata[]>();
  
  for (const creative of creatives) {
    const existing = groups.get(creative.groupKey) || [];
    existing.push(creative);
    groups.set(creative.groupKey, existing);
  }
  
  return groups;
}

/**
 * Generate suggested workspace name from creative metadata
 * Example: "Eylea HD - Teresa Animated Banners" (combines all sizes)
 */
export function suggestWorkspaceName(creatives: CreativeMetadata[]): string {
  if (creatives.length === 0) return 'New Workspace';
  
  const groups = groupCreativeSets(creatives);
  
  // If single creative set, use that name
  if (groups.size === 1) {
    const first = creatives[0];
    return `${first.brand} - ${first.creativeName}`;
  }
  
  // Multiple creative sets: use brand + count
  const brands = new Set(creatives.map(c => c.brand));
  if (brands.size === 1) {
    const brand = Array.from(brands)[0];
    return `${brand} - ${groups.size} Creative Sets`;
  }
  
  // Mixed brands: generic name
  return `Mixed Creatives (${creatives.length} files)`;
}

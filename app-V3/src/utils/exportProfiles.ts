/**
 * Export Profile System
 * Manages user preferences for export formats (PDF, Excel, HTML)
 */

export type ExportFormat = 'pdf' | 'excel' | 'html';

export interface ExportProfile {
  id: string;
  name: string;
  format: ExportFormat;
  
  // Column visibility
  includeColumns: {
    name: boolean;
    status: boolean;
    dimensions: boolean;
    issues: boolean;
    fileSize: boolean;
    initialKB: boolean;
    politeKB: boolean;
    requests: boolean;
    profile: boolean;
    metadata: boolean;
  };
  
  // Content options
  includeChecks: boolean;
  includeOffenders: boolean;
  includePreview: boolean;
  includeSummary: boolean;
  
  // Filter options
  statusFilter?: 'ALL' | 'FAIL' | 'WARN' | 'PASS';
  
  // Format-specific options
  pdfOptions?: {
    orientation: 'portrait' | 'landscape';
    pageSize: 'a4' | 'letter' | 'legal';
    includeTableOfContents: boolean;
    includePageNumbers: boolean;
    colorScheme: 'color' | 'grayscale';
  };
  
  excelOptions?: {
    includeFormulas: boolean;
    freezeHeader: boolean;
    autoFilter: boolean;
    includeCharts: boolean;
  };
  
  htmlOptions?: {
    includeCSS: boolean;
    embeddImages: boolean;
    responsive: boolean;
    darkMode: boolean;
  };
  
  // Metadata
  createdAt: Date;
  lastUsed: Date;
}

// Default profiles
export const DEFAULT_PROFILES: Record<ExportFormat, ExportProfile> = {
  pdf: {
    id: 'default-pdf',
    name: 'Standard PDF Report',
    format: 'pdf',
    includeColumns: {
      name: true,
      status: true,
      dimensions: true,
      issues: true,
      fileSize: true,
      initialKB: true,
      politeKB: true,
      requests: true,
      profile: true,
      metadata: true,
    },
    includeChecks: true,
    includeOffenders: true,
    includePreview: false,
    includeSummary: true,
    pdfOptions: {
      orientation: 'portrait',
      pageSize: 'a4',
      includeTableOfContents: true,
      includePageNumbers: true,
      colorScheme: 'color',
    },
    createdAt: new Date(),
    lastUsed: new Date(),
  },
  
  excel: {
    id: 'default-excel',
    name: 'Standard Excel Workbook',
    format: 'excel',
    includeColumns: {
      name: true,
      status: true,
      dimensions: true,
      issues: true,
      fileSize: true,
      initialKB: true,
      politeKB: true,
      requests: true,
      profile: true,
      metadata: true,
    },
    includeChecks: true,
    includeOffenders: true,
    includePreview: false,
    includeSummary: true,
    excelOptions: {
      includeFormulas: false,
      freezeHeader: true,
      autoFilter: true,
      includeCharts: false,
    },
    createdAt: new Date(),
    lastUsed: new Date(),
  },
  
  html: {
    id: 'default-html',
    name: 'Standalone HTML Report',
    format: 'html',
    includeColumns: {
      name: true,
      status: true,
      dimensions: true,
      issues: true,
      fileSize: true,
      initialKB: true,
      politeKB: true,
      requests: true,
      profile: true,
      metadata: true,
    },
    includeChecks: true,
    includeOffenders: true,
    includePreview: false,
    includeSummary: true,
    htmlOptions: {
      includeCSS: true,
      embeddImages: false,
      responsive: true,
      darkMode: false,
    },
    createdAt: new Date(),
    lastUsed: new Date(),
  },
};

// Storage key for localStorage
const STORAGE_KEY = 'creative-auditor-export-profiles';

/**
 * Load export profiles from localStorage
 */
export function loadExportProfiles(): ExportProfile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return Object.values(DEFAULT_PROFILES);
    }
    
    const profiles: ExportProfile[] = JSON.parse(stored);
    // Convert date strings back to Date objects
    return profiles.map(p => ({
      ...p,
      createdAt: new Date(p.createdAt),
      lastUsed: new Date(p.lastUsed),
    }));
  } catch (error) {
    console.error('[ExportProfiles] Failed to load profiles:', error);
    return Object.values(DEFAULT_PROFILES);
  }
}

/**
 * Save export profiles to localStorage
 */
export function saveExportProfiles(profiles: ExportProfile[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (error) {
    console.error('[ExportProfiles] Failed to save profiles:', error);
  }
}

/**
 * Get a specific profile by ID
 */
export function getExportProfile(id: string): ExportProfile | undefined {
  const profiles = loadExportProfiles();
  return profiles.find(p => p.id === id);
}

/**
 * Get default profile for a format
 */
export function getDefaultProfile(format: ExportFormat): ExportProfile {
  const profiles = loadExportProfiles();
  const defaultProfile = profiles.find(p => p.format === format && p.id.startsWith('default'));
  return defaultProfile || DEFAULT_PROFILES[format];
}

/**
 * Update profile last used timestamp
 */
export function markProfileUsed(id: string): void {
  const profiles = loadExportProfiles();
  const profile = profiles.find(p => p.id === id);
  if (profile) {
    profile.lastUsed = new Date();
    saveExportProfiles(profiles);
  }
}

/**
 * Create a new custom profile
 */
export function createExportProfile(
  name: string,
  format: ExportFormat,
  baseProfile?: Partial<ExportProfile>
): ExportProfile {
  const id = `custom-${format}-${Date.now()}`;
  const defaultProfile = DEFAULT_PROFILES[format];
  
  const newProfile: ExportProfile = {
    ...defaultProfile,
    ...baseProfile,
    id,
    name,
    format,
    createdAt: new Date(),
    lastUsed: new Date(),
  };
  
  const profiles = loadExportProfiles();
  profiles.push(newProfile);
  saveExportProfiles(profiles);
  
  return newProfile;
}

/**
 * Delete a custom profile
 */
export function deleteExportProfile(id: string): boolean {
  // Don't allow deleting default profiles
  if (id.startsWith('default-')) {
    return false;
  }
  
  const profiles = loadExportProfiles();
  const filtered = profiles.filter(p => p.id !== id);
  
  if (filtered.length < profiles.length) {
    saveExportProfiles(filtered);
    return true;
  }
  
  return false;
}

/**
 * Update an existing profile
 */
export function updateExportProfile(id: string, updates: Partial<ExportProfile>): boolean {
  const profiles = loadExportProfiles();
  const index = profiles.findIndex(p => p.id === id);
  
  if (index === -1) {
    return false;
  }
  
  profiles[index] = {
    ...profiles[index],
    ...updates,
    id: profiles[index].id, // Don't allow changing ID
    format: profiles[index].format, // Don't allow changing format
  };
  
  saveExportProfiles(profiles);
  return true;
}

/**
 * Get all profiles for a specific format
 */
export function getProfilesByFormat(format: ExportFormat): ExportProfile[] {
  const profiles = loadExportProfiles();
  return profiles.filter(p => p.format === format);
}

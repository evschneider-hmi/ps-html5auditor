import { Severity } from './severity';

export type Profile = 'CM360' | 'Ads';

export interface CheckSeverityOverrides {
  [checkId: string]: Severity;
}

export interface Settings {
  profile: Profile;
  disallowNestedZips: boolean;
  dangerousExtensions: string[];
  externalHostAllowlist: string[];
  externalFiletypeAllowlist: string[];
  clickTagPatterns: string[]; // regex strings
  stripCacheBusters: boolean;
  orphanSeverity: Severity;
  missingAssetSeverity: Severity;
  httpSeverity: Severity;
  externalResourceSeverity: Severity;
  hardcodedNavSeverity: Severity;
  iabInitialLoadKB?: number; // IAB initial load cap
  iabSubsequentLoadKB?: number; // polite/subsequent load cap
  iabMaxZippedKB?: number; // optional compressed cap
  iabStandardDate?: string; // date of last applied standard
}

export const defaultSettings: Settings = {
  profile: 'CM360',
  disallowNestedZips: true,
  dangerousExtensions: ['.exe', '.bat', '.cmd', '.sh', '.msi'],
  externalHostAllowlist: ['fonts.googleapis.com', 'fonts.gstatic.com'],
  externalFiletypeAllowlist: ['.woff', '.woff2', '.ttf'],
  clickTagPatterns: [
    String(/\bwindow\.clickTag\b/),
    String(/\bclickTag\b/),
    String(/\bclickTAG\b/),
    String(/\bEnabler\.(exit|exitOverride)\b/)
  ],
  stripCacheBusters: true,
  orphanSeverity: 'WARN',
  missingAssetSeverity: 'FAIL',
  httpSeverity: 'FAIL',
  externalResourceSeverity: 'WARN',
  hardcodedNavSeverity: 'WARN',
  // Based on IAB New Ad Portfolio (public landing indicates last update 2025-02-25); values should be validated against full spec internally.
  iabInitialLoadKB: 150, // initial load budget (compressed) target
  iabSubsequentLoadKB: 1000, // polite / secondary load allowance
  iabMaxZippedKB: 200, // recommended max compressed creative (optional enforcement)
  iabStandardDate: '2025-02-25'
};

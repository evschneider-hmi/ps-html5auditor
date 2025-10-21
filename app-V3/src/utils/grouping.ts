import { Finding } from '../logic/types';

/**
 * Group configuration for custom grouping logic
 */
export interface GroupConfig {
  name: string;
  filter: (finding: Finding) => boolean;
  order?: number;
}

/**
 * Group state for tracking expanded/collapsed sections
 */
export interface GroupState {
  [groupName: string]: boolean;
}

/**
 * Grouping preferences stored in localStorage
 */
export interface GroupingPreferences {
  expandedGroups: GroupState;
  groupingMode: 'severity' | 'custom';
  customGroupConfig?: GroupConfig[];
}

const STORAGE_KEY = 'creative-suite-auditor-grouping';

/**
 * Groups findings by severity in the order: FAIL → WARN → PASS
 */
export function groupBySeverity(findings: Finding[]): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();

  // Initialize groups in order
  groups.set('FAIL', []);
  groups.set('WARN', []);
  groups.set('PASS', []);

  // Distribute findings into groups
  findings.forEach((finding) => {
    const severity = finding.severity;
    if (severity === 'FAIL' || severity === 'WARN' || severity === 'PASS') {
      const group = groups.get(severity);
      if (group) {
        group.push(finding);
      }
    }
  });

  // Remove empty groups
  const result = new Map<string, Finding[]>();
  groups.forEach((value, key) => {
    if (value.length > 0) {
      result.set(key, value);
    }
  });

  return result;
}

/**
 * Creates custom groups based on provided configuration
 */
export function createCustomGroup(
  findings: Finding[],
  groupConfig: GroupConfig[]
): Map<string, Finding[]> {
  const groups = new Map<string, Finding[]>();

  // Sort config by order (lower numbers first)
  const sortedConfig = [...groupConfig].sort((a, b) => {
    return (a.order ?? 999) - (b.order ?? 999);
  });

  // Initialize all groups
  sortedConfig.forEach((config) => {
    groups.set(config.name, []);
  });

  // Distribute findings into groups
  findings.forEach((finding) => {
    for (const config of sortedConfig) {
      if (config.filter(finding)) {
        const group = groups.get(config.name);
        if (group) {
          group.push(finding);
          break; // Only add to first matching group
        }
      }
    }
  });

  // Remove empty groups
  const result = new Map<string, Finding[]>();
  groups.forEach((value, key) => {
    if (value.length > 0) {
      result.set(key, value);
    }
  });

  return result;
}

/**
 * Sets all groups to expanded or collapsed
 */
export function expandCollapseAll(expanded: boolean): GroupState {
  // This returns a state object that can be merged with existing state
  // The actual implementation depends on which groups are currently visible
  // For now, return an empty object - callers should merge with their visible groups
  return {};
}

/**
 * Load grouping preferences from localStorage
 */
export function loadGroupingPreferences(): GroupingPreferences | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load grouping preferences:', error);
  }
  return null;
}

/**
 * Save grouping preferences to localStorage
 */
export function saveGroupingPreferences(preferences: GroupingPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save grouping preferences:', error);
  }
}

/**
 * Get default grouping preferences
 */
export function getDefaultGroupingPreferences(): GroupingPreferences {
  return {
    expandedGroups: {
      FAIL: true,
      WARN: true,
      PASS: false, // Collapsed by default since PASS checks are less critical
    },
    groupingMode: 'severity',
  };
}

/**
 * Merge saved preferences with defaults
 */
export function mergeGroupingPreferences(
  saved: GroupingPreferences | null
): GroupingPreferences {
  const defaults = getDefaultGroupingPreferences();
  if (!saved) {
    return defaults;
  }

  return {
    ...defaults,
    ...saved,
    expandedGroups: {
      ...defaults.expandedGroups,
      ...saved.expandedGroups,
    },
  };
}

/**
 * Priority check IDs (for custom grouping)
 */
export const PRIORITY_CHECK_IDS = [
  'clicktag',
  'pkg-format',
  'allowed-ext',
  'file-limits',
  'entry-html',
  'bad-filenames',
];

/**
 * Check if a finding is a priority check
 */
export function isPriorityCheck(finding: Finding): boolean {
  return PRIORITY_CHECK_IDS.includes(finding.id);
}

/**
 * Split findings into priority and additional groups
 */
export function splitByPriority(findings: Finding[]): {
  priority: Finding[];
  additional: Finding[];
} {
  const priority: Finding[] = [];
  const additional: Finding[] = [];

  findings.forEach((finding) => {
    if (isPriorityCheck(finding)) {
      priority.push(finding);
    } else {
      additional.push(finding);
    }
  });

  return { priority, additional };
}

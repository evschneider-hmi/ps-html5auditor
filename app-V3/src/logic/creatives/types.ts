/**
 * Type definitions for the modular check system (V3)
 */

import type { ZipBundle, BundleResult, Finding } from '../types';
import type { Settings } from '../profiles';

/**
 * Context provided to each check during execution
 */
export interface CheckContext {
  /** The uploaded creative bundle with all files */
  bundle: ZipBundle;
  
  /** Partial scan results from initial processing */
  partial: BundleResult;
  
  /** User settings and configuration */
  settings: Settings;
  
  /** List of all file paths in the bundle */
  files: string[];
  
  /** Path to the primary HTML file (if detected) */
  primary?: string;
  
  /** Decoded text content of the primary HTML file */
  htmlText: string;
  
  /** Entry filename (e.g., "index.html") */
  entryName?: string;
  
  /** Whether the IAB profile is active */
  isIabProfile: boolean;
}

/**
 * Profile type for checks
 */
export type CheckProfile = 'CM360' | 'IAB' | 'BOTH';

/**
 * Priority level for checks
 */
export type CheckPriority = 'required' | 'recommended' | 'advisory';

/**
 * Standard interface that all checks must implement
 */
export interface Check {
  /** Unique identifier for the check (e.g., 'clicktag') */
  id: string;
  
  /** Human-readable title shown in UI */
  title: string;
  
  /** Description explaining what the check validates */
  description: string;
  
  /** Which profiles this check applies to */
  profiles: CheckProfile[];
  
  /** Priority/importance level */
  priority: CheckPriority;
  
  /** Optional tags for categorization */
  tags?: string[];
  
  /** Execute the check and return a finding */
  execute: (context: CheckContext) => Promise<Finding> | Finding;
}

/**
 * Helper type for checks that need async execution
 */
export interface AsyncCheck extends Check {
  execute: (context: CheckContext) => Promise<Finding>;
}

/**
 * Helper type for checks that run synchronously
 */
export interface SyncCheck extends Check {
  execute: (context: CheckContext) => Finding;
}

/**
 * Options for check execution
 */
export interface CheckExecutionOptions {
  /** Filter checks by profile */
  profile?: 'CM360' | 'IAB';
  
  /** Filter checks by priority */
  priority?: CheckPriority[];
  
  /** Include/exclude specific checks by ID */
  include?: string[];
  exclude?: string[];
  
  /** Enable parallel execution */
  parallel?: boolean;
}

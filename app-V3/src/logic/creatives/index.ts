/**
 * Check Registry - Central hub for all checks in V3
 * 
 * This file exports all available checks and provides utilities
 * for running them with filtering and execution options.
 */

import type { Check, CheckContext, CheckExecutionOptions } from './types';
import type { Finding } from '../types';

// Import all checks - HTML5 CM360 Checks
import { clickTagCheck } from './html5/cm360/clickTag';
import { entryHtmlCheck } from './html5/cm360/entryHtml';
import { iframeSafeCheck } from './html5/cm360/iframeSafe';
import { noWebStorageCheck } from './html5/cm360/noWebStorage';
import { gwdEnvCheck } from './html5/cm360/gwdEnvCheck';
import { hardcodedClickCheck } from './html5/cm360/hardcodedClick';

// Import common checks
import { packagingCheck } from './common/packaging';
import { allowedExtensionsCheck } from './common/allowedExtensions';
import { fileLimitsCheck } from './common/fileLimits';
import { filenamesCheck } from './common/filenames';

// IAB Checks - Batch 1 (Simple Validation)
import { hostedCountCheck } from './html5/iab/hostedCount';
import { hostedSizeCheck } from './html5/iab/hostedSize';
import { cssEmbeddedCheck } from './html5/iab/cssEmbedded';
import { indexFileCheck } from './html5/iab/indexFile';
import { videoCheck } from './html5/iab/video';

// IAB Checks - Batch 2 (Runtime Probe)
import { dialogsCheck } from './html5/iab/dialogs';
import { cookiesCheck } from './html5/iab/cookies';
import { localStorageCheck } from './html5/iab/localStorage';
import { syntaxErrorsCheck } from './html5/iab/syntaxErrors';
import { noDocumentWriteCheck } from './html5/iab/noDocumentWrite';
import { jqueryCheck } from './html5/iab/jquery';

// IAB Checks - Batch 3 (Pattern Scanning)
import { html5libCheck } from './html5/iab/html5lib';
import { minifiedCheck } from './html5/iab/minified';
import { measurementCheck } from './html5/iab/measurement';
import { relativePathsCheck } from './html5/iab/relativePaths';
import { imagesOptimizedCheck } from './html5/iab/imagesOptimized';
import { iframesCheck } from './html5/iab/iframes';
import { noBackupInZipCheck } from './html5/iab/noBackupInZip';

// IAB Checks - Batch 4 (Complex Runtime)
import { hostRequestsCheck } from './html5/iab/hostRequests';
import { cpuBudgetCheck } from './html5/iab/cpuBudget';
import { timeToRenderCheck } from './html5/iab/timeToRender';
import { domContentLoadedCheck } from './html5/iab/domContentLoaded';

// IAB Checks - Batch 5 (Advanced Parsing)
import { animationCapCheck } from './html5/iab/animationCap';
import { creativeBorderCheck } from './html5/iab/creativeBorder';

// Runtime Checks - Phase 4
import { timingCheck } from './html5/runtime/timing';
import { creativeRenderedCheck } from './html5/runtime/creativeRendered';
import { runtimeIframesCheck } from './html5/runtime/runtimeIframes';

// Validation Checks - Phase 4
import { invalidUrlRefCheck } from './html5/validation/invalidUrlRef';
import { orphanedAssetsCheck } from './html5/validation/orphanedAssets';
import { invalidMarkupCheck } from './html5/validation/invalidMarkup';

/**
 * Registry of all available checks
 * Add new checks here after creating them
 */
export const ALL_CHECKS: Check[] = [
  // CM360 Checks - Batch 1 (Foundation)
  clickTagCheck,
  packagingCheck,
  allowedExtensionsCheck,
  fileLimitsCheck,
  
  // CM360 Checks - Batch 2 (Structure)
  entryHtmlCheck,
  filenamesCheck,
  
  // CM360 Checks - Batch 3 (Code Analysis)
  iframeSafeCheck,
  noWebStorageCheck,
  gwdEnvCheck,
  hardcodedClickCheck,
  
  // IAB Checks - Batch 1 (Simple Validation)
  hostedCountCheck,
  hostedSizeCheck,
  cssEmbeddedCheck,
  indexFileCheck,
  videoCheck,
  
  // IAB Checks - Batch 2 (Runtime Probe)
  dialogsCheck,
  cookiesCheck,
  localStorageCheck,
  syntaxErrorsCheck,
  noDocumentWriteCheck,
  jqueryCheck,
  
  // IAB Checks - Batch 3 (Pattern Scanning)
  html5libCheck,
  minifiedCheck,
  measurementCheck,
  relativePathsCheck,
  imagesOptimizedCheck,
  iframesCheck,
  noBackupInZipCheck,
  
  // IAB Checks - Batch 4 (Complex Runtime)
  hostRequestsCheck,
  cpuBudgetCheck,
  timeToRenderCheck,
  domContentLoadedCheck,
  
  // IAB Checks - Batch 5 (Advanced Parsing)
  animationCapCheck,
  creativeBorderCheck,
  
  // Runtime Checks - Phase 4
  timingCheck,
  creativeRenderedCheck,
  runtimeIframesCheck,
  
  // Validation Checks - Phase 4
  invalidUrlRefCheck,
  orphanedAssetsCheck,
  invalidMarkupCheck,
];

/**
 * Get checks filtered by execution options
 */
export function getFilteredChecks(options: CheckExecutionOptions = {}): Check[] {
  let checks = [...ALL_CHECKS];
  
  // Filter by profile
  if (options.profile) {
    checks = checks.filter(check => 
      check.profiles.includes(options.profile!) || 
      check.profiles.includes('BOTH')
    );
  }
  
  // Filter by priority
  if (options.priority && options.priority.length > 0) {
    checks = checks.filter(check => 
      options.priority!.includes(check.priority)
    );
  }
  
  // Include specific checks
  if (options.include && options.include.length > 0) {
    checks = checks.filter(check => 
      options.include!.includes(check.id)
    );
  }
  
  // Exclude specific checks
  if (options.exclude && options.exclude.length > 0) {
    checks = checks.filter(check => 
      !options.exclude!.includes(check.id)
    );
  }
  
  return checks;
}

/**
 * Run all checks (or filtered subset) and return findings
 */
export async function runAllChecks(
  context: CheckContext,
  options: CheckExecutionOptions = {}
): Promise<Finding[]> {
  const checks = getFilteredChecks(options);
  
  console.log(`[Check Registry] Running ${checks.length} checks...`);
  
  if (options.parallel !== false) {
    // Run checks in parallel (default)
    const results = await Promise.all(
      checks.map(async (check) => {
        try {
          console.log(`[Check Registry] Running: ${check.id}`);
          const result = await Promise.resolve(check.execute(context));
          console.log(`[Check Registry] ✓ ${check.id}: ${result.severity}`);
          // Add profile and description information to the finding
          return {
            ...result,
            profiles: check.profiles,
            description: check.description
          };
        } catch (error) {
          console.error(`[Check Registry] ✗ ${check.id} failed:`, error);
          return {
            id: check.id,
            title: check.title,
            severity: 'FAIL' as const,
            messages: [`Check failed: ${error instanceof Error ? error.message : String(error)}`],
            offenders: [],
            profiles: check.profiles,
            description: check.description
          };
        }
      })
    );
    return results;
  } else {
    // Run checks sequentially
    const results: Finding[] = [];
    for (const check of checks) {
      try {
        console.log(`[Check Registry] Running: ${check.id}`);
        const result = await Promise.resolve(check.execute(context));
        console.log(`[Check Registry] ✓ ${check.id}: ${result.severity}`);
        // Add profile and description information to the finding
        results.push({
          ...result,
          profiles: check.profiles,
          description: check.description
        });
      } catch (error) {
        console.error(`[Check Registry] ✗ ${check.id} failed:`, error);
        results.push({
          id: check.id,
          title: check.title,
          severity: 'FAIL',
          messages: [`Check failed: ${error instanceof Error ? error.message : String(error)}`],
          offenders: [],
          profiles: check.profiles,
          description: check.description
        });
      }
    }
    return results;
  }
}

/**
 * Get a specific check by ID
 */
export function getCheckById(id: string): Check | undefined {
  return ALL_CHECKS.find(check => check.id === id);
}

/**
 * Get all check IDs
 */
export function getAllCheckIds(): string[] {
  return ALL_CHECKS.map(check => check.id);
}

/**
 * Get checks by profile
 */
export function getChecksByProfile(profile: 'CM360' | 'IAB'): Check[] {
  return ALL_CHECKS.filter(check => 
    check.profiles.includes(profile) || check.profiles.includes('BOTH')
  );
}

/**
 * Get checks by priority
 */
export function getChecksByPriority(priority: 'required' | 'recommended' | 'advisory'): Check[] {
  return ALL_CHECKS.filter(check => check.priority === priority);
}

/**
 * Export types for consumers
 */
export type { Check, CheckContext, CheckExecutionOptions } from './types';

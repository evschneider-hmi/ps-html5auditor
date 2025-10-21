/**
 * Invalid URL References Check
 * 
 * Validates that all URL references in the creative are valid and resolvable.
 * 
 * Why This Matters:
 * - Broken references = missing images/scripts/styles
 * - Invalid URLs cause browser errors
 * - Missing assets = broken creative
 * - Publishers reject ads with broken references
 * - Poor user experience from failed loads
 * 
 * What This Checks:
 * 1. **URL Syntax**: All references must be valid URLs
 * 2. **Packaged Assets**: In-zip references must exist in bundle
 * 3. **Absolute Paths**: Absolute paths must be external or packaged
 * 
 * Invalid Reference Types:
 * 
 * **Syntax Errors:**
 * - Malformed URLs (e.g., `ht tp://example.com`)
 * - Invalid characters in URL
 * - Broken URL encoding
 * 
 * **Missing Assets:**
 * - Reference to `images/logo.png` but file not in bundle
 * - Typo in filename (case-sensitive)
 * - File deleted but reference remains
 * 
 * **Absolute Paths:**
 * - Local absolute paths like `/img/x.png` (not packaged)
 * - Assumes server structure that won't exist
 * - Should be relative (e.g., `img/x.png`) or external (e.g., `https://...`)
 * 
 * FAIL Condition:
 * - Any invalid/broken reference found
 * - Creative will likely have missing content
 * - Must be fixed before deployment
 * 
 * Common Causes:
 * - Case sensitivity (Windows vs Linux)
 * - Typos in filenames
 * - Files removed but references remain
 * - Absolute paths from local development
 * - Copy/paste errors
 * - URL encoding issues
 * 
 * How to Fix:
 * - Verify all referenced files exist in bundle
 * - Use relative paths for packaged assets
 * - Check spelling and case
 * - Test in case-sensitive environment
 * - Remove references to deleted files
 * 
 * Best Practice:
 * - Use relative paths for bundled assets
 * - Use external URLs for CDN resources
 * - Verify case sensitivity
 * - Keep references synchronized with files
 */

import type { Check, CheckContext } from '../../types';
import type { Finding, FindingOffender } from '../../../types';

export const invalidUrlRefCheck: Check = {
  id: 'invalid-url-ref',
  title: 'Invalid URL References',
  description: 'Validates all URL references are valid and resolvable',
  profiles: ['CM360', 'IAB'],
  priority: 'required',
  tags: ['references', 'urls', 'validation'],
  
  execute(context: CheckContext): Finding {
    const { partial, bundle } = context;
    const badRefs: FindingOffender[] = [];
    
    for (const r of partial.references || []) {
      try {
        const ustr = String(r.url || '');
        
        // 1. Validate URL syntax
        try {
          new URL(ustr, 'https://x');
        } catch {
          badRefs.push({
            path: r.from,
            line: r.line,
            detail: `Invalid URL: ${ustr}`
          });
          continue;
        }
        
        // 2. Check in-zip references are resolvable
        if (r.inZip && r.normalized) {
          const key = r.normalized.toLowerCase();
          const real = (bundle as any).lowerCaseIndex?.[key];
          if (!real || !bundle.files[real]) {
            badRefs.push({
              path: r.from,
              line: r.line,
              detail: `Missing packaged asset: ${ustr}`
            });
          }
        }
        
        // 3. Check for non-packaged absolute paths
        if (!r.external && /^\//.test(ustr)) {
          badRefs.push({
            path: r.from,
            line: r.line,
            detail: `Absolute path not packaged: ${ustr}`
          });
        }
      } catch {
        // Skip malformed reference entries
      }
    }
    
    const messages: string[] = [];
    
    if (badRefs.length > 0) {
      messages.push(`${badRefs.length} invalid/broken reference(s)`);
      messages.push('Fix these references to ensure all assets load');
      messages.push('Check for typos, case sensitivity, and missing files');
    } else {
      messages.push('All references valid');
      messages.push('No broken or invalid URL references found');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: badRefs.length ? 'FAIL' : 'PASS',
      messages,
      offenders: badRefs
    };
  }
};

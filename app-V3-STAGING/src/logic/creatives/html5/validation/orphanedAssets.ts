/**
 * Orphaned Assets Check
 * 
 * Identifies files in the bundle that are not referenced by the entry HTML.
 * 
 * Why This Matters:
 * - Unreferenced files = wasted bytes
 * - Larger file size = slower downloads
 * - May indicate unused backup/old versions
 * - Could be files that should be referenced
 * - Helps identify cleanup opportunities
 * 
 * What This Detects:
 * - Files in ZIP that are never referenced
 * - Assets not linked from entry HTML
 * - Orphaned images, scripts, styles, etc.
 * - Backup files accidentally included
 * 
 * Not Considered Orphaned:
 * - Entry HTML file itself
 * - Files referenced via <img>, <script>, <link>, etc.
 * - Assets loaded via CSS (background-image, etc.)
 * - Resources referenced in JavaScript strings
 * - Files in reference scan results
 * 
 * WARN Condition:
 * - One or more orphaned files found
 * - Not critical but worth reviewing
 * - May indicate accidental inclusion
 * 
 * Common Orphaned Files:
 * - **Backup files**: `image_old.png`, `script.backup.js`
 * - **Unused versions**: `style_v2.css` when using `style_v3.css`
 * - **Test files**: `test.html`, `debug.js`
 * - **Source files**: `.psd`, `.ai`, `.sketch`
 * - **Documentation**: `README.md`, `notes.txt`
 * 
 * When Orphaned Files Are OK:
 * - Dynamically loaded by filename patterns
 * - Loaded conditionally at runtime
 * - Part of a library/framework (not all files used)
 * - Intentionally bundled for future use
 * 
 * How to Fix:
 * - Remove truly unused files
 * - Add references if files should be used
 * - Document why files are included if intentional
 * - Check for typos in filenames
 * 
 * Best Practice:
 * - Keep bundles lean (only necessary files)
 * - Remove backup/test files before packaging
 * - Use build tools to tree-shake unused assets
 * - Document dynamically loaded files
 */

import type { Check, CheckContext } from '../../types';
import type { Finding, FindingOffender } from '../../../types';

export const orphanedAssetsCheck: Check = {
  id: 'orphaned-assets',
  title: 'Orphaned Assets (Not Referenced)',
  description: 'Identifies files in bundle not referenced by entry HTML',
  profiles: ['CM360', 'IAB'],
  priority: 'advisory',
  tags: ['optimization', 'references', 'cleanup'],
  
  execute(context: CheckContext): Finding {
    const { partial, files, entryName } = context;
    
    // Build set of referenced files
    const referenced = new Set<string>();
    
    // Add all referenced files from scan
    for (const r of partial.references || []) {
      if (r.inZip && r.normalized) {
        referenced.add(r.normalized.toLowerCase());
      }
    }
    
    // Add primary/entry file itself
    if (partial.primary?.path) {
      referenced.add(partial.primary.path.toLowerCase());
    }
    
    // Find orphaned files
    const orphans: FindingOffender[] = [];
    for (const p of files) {
      const pl = p.toLowerCase();
      if (!referenced.has(pl)) {
        orphans.push({ path: p });
      }
    }
    
    const messages: string[] = [];
    
    if (orphans.length > 0) {
      const entryMsg = entryName 
        ? `${orphans.length} file(s) not referenced by entry file: ${entryName}`
        : `${orphans.length} file(s) not referenced by entry`;
      
      messages.push(`${entryMsg}`);
      messages.push('These files may be unused and can be removed');
      messages.push('Or they may be loaded dynamically (verify if intentional)');
      
      // Helpful hints for common orphan types
      const hasBackup = orphans.some(o => /backup|old|copy|_v\d+|\.bak/i.test(o.path));
      const hasSource = orphans.some(o => /\.(psd|ai|sketch|fig)$/i.test(o.path));
      const hasDocs = orphans.some(o => /readme|notes|todo/i.test(o.path));
      
      if (hasBackup) messages.push('Tip: Remove backup/old versions');
      if (hasSource) messages.push('Tip: Remove source files (.psd, .ai, etc.)');
      if (hasDocs) messages.push('Tip: Remove documentation files');
    } else {
      messages.push('All files referenced by entry');
      messages.push('No orphaned files detected');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: orphans.length ? 'WARN' : 'PASS',
      messages,
      offenders: orphans.slice(0, 50) // Limit to first 50 for UI
    };
  }
};

/**
 * CM360 Packaging Format Check
 * 
 * Validates that:
 * 1. Upload is in ZIP/ADZ format (not extracted folder)
 * 2. No nested ZIP/ADZ archives inside
 * 3. Files are at top level, not wrapped in extra folder
 * 
 * CM360 Requirements:
 * - Creative must be uploaded as a single ZIP file
 * - ZIP must contain files at the root level
 * - No nested archives allowed (confuses trafficking system)
 * - Common mistake: zipping a folder instead of folder contents
 */

import type { Check, CheckContext } from '../types';
import type { Finding } from '../../types';

export const packagingCheck: Check = {
  id: 'pkg-format',
  title: 'Packaging Format',
  description: 'CM360: Upload must be ZIP/ADZ with no nested archives, files at top level.',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['packaging', 'structure', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    // Check if bundle is in ZIP mode
    const mode = (bundle as any).mode as string | undefined;
    const isZipMode = mode === 'zip';
    
    // Find nested archives
    const nestedArchives = files.filter(p => /(\.zip|\.adz)$/i.test(p));
    
    // Analyze top-level structure for clearer guidance
    const rootFiles = files.filter(p => !p.includes('/'));
    const topDirs = Array.from(
      new Set(files.filter(p => p.includes('/')).map(p => p.split('/')[0]))
    );
    
    // Common wrapper folder names that often indicate double-wrapping
    const WRAPPER_HINTS = [
      /unzip/i, 
      /for[-_]?delivery/i, 
      /delivery/i, 
      /_zip/i, 
      /_final/i
    ];
    const wrapperDirs = topDirs.filter(d => 
      WRAPPER_HINTS.some(rx => rx.test(d))
    );
    const singleTopDir = topDirs.length === 1 ? topDirs[0] : undefined;
    
    // Build messages
    const messages: string[] = [];
    messages.push(`Package: ${isZipMode ? 'ZIP/ADZ' : 'not ZIP/ADZ'}`);
    messages.push(`Nested archives: ${nestedArchives.length}`);
    messages.push(`Top-level: ${rootFiles.length} file(s), ${topDirs.length} folder(s)`);
    
    if (wrapperDirs.length) {
      messages.push(
        `Wrapper folders detected: ${wrapperDirs.slice(0, 5).join(', ')}`
      );
    }
    
    if (singleTopDir && rootFiles.length === 0) {
      messages.push(
        `All content inside single folder: "${singleTopDir}" — ` +
        `zip the folder's contents, not the folder`
      );
    }
    
    // Build offenders list
    const offenders = nestedArchives.map(p => ({
      path: p,
      detail: 'Nested archive (.zip/.adz) — remove inner ZIP and include its files at top level'
    }));
    
    // Determine severity
    const hasProblem = !isZipMode || nestedArchives.length > 0;
    const severity = hasProblem ? 'FAIL' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

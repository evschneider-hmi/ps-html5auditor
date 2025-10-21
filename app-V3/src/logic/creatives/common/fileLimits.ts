/**
 * CM360 File Count and Upload Size Check
 * 
 * Validates CM360 creative size limits.
 * 
 * CM360 Requirements:
 * - Maximum 100 files per creative
 * - Maximum 10MB compressed (ZIP) size
 * 
 * Why These Limits:
 * - Trafficking system performance
 * - CDN distribution efficiency
 * - Ad server load times
 * - Publisher page weight guidelines
 */

import type { Check, CheckContext } from '../types';
import type { Finding } from '../../types';

// CM360 limits
const MAX_FILE_COUNT = 100;
const MAX_ZIP_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ZIP_SIZE_KB = 10240;

export const fileLimitsCheck: Check = {
  id: 'file-limits',
  title: 'File Count and Upload Size',
  description: 'CM360: Maximum 100 files and 10MB compressed size.',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['limits', 'size', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle, partial, files } = context;
    
    // Count files
    const fileCount = files.length;
    const overCount = fileCount > MAX_FILE_COUNT;
    
    // Get ZIP size (compressed)
    const zipBytes = (
      partial.zippedBytes || 
      (bundle as any).bytes?.length || 
      0
    ) as number;
    const overSize = zipBytes > MAX_ZIP_SIZE_BYTES;
    
    // Build messages
    const messages = [
      `Files: ${fileCount} / ${MAX_FILE_COUNT}`,
      `Zip size: ${(zipBytes / 1024).toFixed(1)} KB / ${MAX_ZIP_SIZE_KB.toFixed(1)} KB`
    ];
    
    if (overCount) {
      messages.push(
        `File count exceeds limit by ${fileCount - MAX_FILE_COUNT} files`
      );
    }
    
    if (overSize) {
      const overByKB = ((zipBytes - MAX_ZIP_SIZE_BYTES) / 1024).toFixed(1);
      messages.push(
        `ZIP size exceeds limit by ${overByKB} KB`
      );
    }
    
    // Determine severity
    const severity = (overCount || overSize) ? 'FAIL' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

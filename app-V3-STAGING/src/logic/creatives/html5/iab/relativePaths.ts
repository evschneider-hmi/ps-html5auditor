/**
 * IAB Relative Paths Check
 * 
 * Validates that packaged assets use relative paths (not absolute).
 * 
 * Why This Matters:
 * - Absolute paths break when files move
 * - Root-relative (/) paths may fail
 * - HTTP:// URLs should use clickTag
 * - Best practice for portability
 * - Ensures creative is self-contained
 * 
 * IAB Guidelines:
 * - Use relative paths for all packaged assets
 * - No root-relative paths (/)
 * - No absolute URLs for internal files
 * - Keep creative portable
 * 
 * Good Examples:
 * - "images/banner.jpg"
 * - "./style.css"
 * - "../assets/video.mp4"
 * 
 * Bad Examples:
 * - "/images/banner.jpg" (root-relative)
 * - "http://example.com/banner.jpg" (absolute URL)
 * - "C:/files/banner.jpg" (file system path)
 * 
 * Best Practice:
 * - Always use relative paths
 * - Test in different environments
 * - Maintain flat structure when possible
 * - Use build tools to resolve paths
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const relativePathsCheck: Check = {
  id: 'relative-refs',
  title: 'Relative Paths For Packaged Assets',
  description: 'IAB: Packaged assets should use relative paths (not absolute).',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['paths', 'references', 'portability', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { partial } = context;
    
    const offenders: Array<{ path: string; line?: number; detail: string }> = [];
    
    // Check references for absolute paths to packaged assets
    for (const ref of partial.references || []) {
      // Only check references to files inside the ZIP
      if (!ref.inZip) continue;
      
      const url = String(ref.url || '');
      
      // Check for absolute paths
      if (url.startsWith('/') || /^https?:\/\//i.test(url)) {
        offenders.push({
          path: ref.from,
          line: ref.line,
          detail: url
        });
      }
    }
    
    const severity = offenders.length > 0 ? 'WARN' : 'PASS';
    
    const messages = offenders.length > 0
      ? [
          `${offenders.length} absolute path reference(s) found`,
          'Use relative paths for packaged assets',
          'Example: "./images/banner.jpg" instead of "/images/banner.jpg"'
        ]
      : ['All packaged asset references are relative'];
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

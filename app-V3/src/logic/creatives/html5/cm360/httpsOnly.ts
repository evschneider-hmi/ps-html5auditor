/**
 * CM360 HTTPS Only Check
 * 
 * Validates that all external resources use HTTPS protocol (no http://).
 * 
 * CM360 Requirements:
 * - All external resource requests must use HTTPS
 * - Mixed content (HTTP + HTTPS) causes security warnings
 * - Modern browsers block HTTP resources on HTTPS pages
 * 
 * Why This Matters:
 * - Ads served on HTTPS sites will fail to load HTTP resources
 * - Mixed content warnings damage user trust
 * - CM360 validates HTTPS-only during creative upload
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const httpsOnlyCheck: Check = {
  id: 'https-only',
  title: 'HTTPS Only',
  description: 'CM360: All external resource references must use HTTPS (no http://).',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['security', 'protocol', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { files, bundle } = context;
    
    // Pattern: Matches src= or href= attributes with http:// URLs
    // Excludes https:// and protocol-relative URLs (//)
    const httpPattern = /(?:src|href)=["'](http:\/\/[^"']+)["']/gi;
    
    const httpRefs: Array<{ path: string; detail: string }> = [];
    
    // Check JS, HTML, and CSS files for HTTP references
    for (const filePath of files) {
      if (/\.(js|html?|css)$/i.test(filePath)) {
        const fileBuffer = bundle.files[filePath];
        if (!fileBuffer) continue;
        
        const text = new TextDecoder().decode(fileBuffer);
        
        // Find all HTTP references
        let match: RegExpExecArray | null;
        const matches: string[] = [];
        
        // Reset lastIndex before using exec in a loop
        httpPattern.lastIndex = 0;
        
        while ((match = httpPattern.exec(text)) !== null) {
          const httpUrl = match[1]; // Capture group 1: the full http:// URL
          matches.push(httpUrl);
        }
        
        if (matches.length > 0) {
          const uniqueUrls = Array.from(new Set(matches));
          httpRefs.push({
            path: filePath,
            detail: `HTTP URLs found: ${uniqueUrls.slice(0, 3).join(', ')}${uniqueUrls.length > 3 ? ` and ${uniqueUrls.length - 3} more` : ''}`
          });
        }
      }
    }
    
    // Build messages
    const messages: string[] = [];
    
    if (httpRefs.length === 0) {
      messages.push('✓ All external resources use HTTPS protocol');
    } else {
      messages.push(`✗ ${httpRefs.length} file(s) contain HTTP references`);
      messages.push('All external URLs must use https:// (not http://)');
      
      // List first 3 offending files
      const sampleFiles = httpRefs.slice(0, 3).map(r => r.path).join(', ');
      messages.push(`Files with HTTP URLs: ${sampleFiles}${httpRefs.length > 3 ? ' ...' : ''}`);
    }
    
    // Determine severity
    const severity = httpRefs.length === 0 ? 'PASS' : 'FAIL';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: httpRefs
    };
  }
};

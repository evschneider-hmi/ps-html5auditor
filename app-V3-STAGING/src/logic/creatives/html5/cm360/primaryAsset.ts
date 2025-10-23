/**
 * CM360 Primary File and Size Check
 * 
 * Validates creative entry file requirements:
 * 1. Primary file must be named "index.html"
 * 2. Must contain <meta name="ad.size" ...> tag with dimensions
 * 
 * CM360 Requirements:
 * - Primary HTML must be called index.html (no alternatives)
 * - ad.size meta tag required for proper ad server ingestion
 * - Dimensions in meta tag must match declared creative size
 * 
 * Why This Matters:
 * - CM360 specifically looks for index.html as entry point
 * - Missing ad.size meta tag causes ingestion failures
 * - Incorrect dimensions lead to trafficking errors
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const primaryAssetCheck: Check = {
  id: 'primary-asset',
  title: 'Primary File and Size',
  description: 'CM360: Entry file must be index.html and contain ad.size meta tag.',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['structure', 'html', 'meta', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { files, partial } = context;
    
    // Check 1: Primary file must be index.html
    const primaryPath = partial.primary?.path || '';
    const isIndexHtml = primaryPath.toLowerCase() === 'index.html';
    
    // Check 2: Read primary HTML content to find ad.size meta tag
    let hasAdSizeMeta = false;
    let adSizeValue = '';
    
    if (isIndexHtml && files.includes('index.html')) {
      const htmlFile = context.bundle.files['index.html'];
      if (htmlFile) {
        const htmlText = new TextDecoder().decode(htmlFile);
        
        // Pattern: <meta name="ad.size" content="width=300,height=250">
        const adSizePattern = /<meta\s+name=["']ad\.size["']\s+content=["']([^"']+)["']/i;
        const match = htmlText.match(adSizePattern);
        
        if (match) {
          hasAdSizeMeta = true;
          adSizeValue = match[1]; // e.g., "width=300,height=250"
        }
      }
    }
    
    // Build messages
    const messages: string[] = [];
    
    if (isIndexHtml) {
      messages.push('✓ Entry file: index.html');
    } else {
      messages.push(`✗ Entry file: ${primaryPath || '(none)'} (expected index.html)`);
    }
    
    if (hasAdSizeMeta) {
      messages.push(`✓ ad.size meta tag present: ${adSizeValue}`);
    } else {
      messages.push('✗ ad.size meta tag missing (required for CM360 ingestion)');
    }
    
    // Determine severity
    const severity = (isIndexHtml && hasAdSizeMeta) ? 'PASS' : 'FAIL';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

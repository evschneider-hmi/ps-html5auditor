/**
 * IAB Hosted File Size Check
 * 
 * Validates total uncompressed file size ≤2.5MB.
 * 
 * Why This Matters:
 * - Large creatives slow down page load
 * - Network bandwidth costs
 * - Mobile data usage concerns
 * - Poor user experience on slow connections
 * 
 * IAB Guidelines:
 * - Maximum 2.5MB (2500KB) uncompressed
 * - This is TOTAL of all files in the creative
 * - Compressed size should be much smaller
 * 
 * Best Practice:
 * - Optimize images (use WebP, compress JPEGs)
 * - Minify JS/CSS
 * - Remove unused code
 * - Use image sprites
 * - Consider lazy loading
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// IAB limit: 2.5MB uncompressed
const MAX_SIZE_KB = 2500;

export const hostedSizeCheck: Check = {
  id: 'hostedSize',
  title: 'Hosted File Size',
  description: 'IAB: Total uncompressed file size must be ≤2.5MB.',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['size', 'performance', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { partial } = context;
    
    const totalKB = Math.round((partial.totalBytes || 0) / 1024);
    const severity = totalKB <= MAX_SIZE_KB ? 'PASS' : 'FAIL';
    
    const messages = [
      `Uncompressed ${totalKB} KB`,
      `Target: <= ${MAX_SIZE_KB} KB`
    ];
    
    if (totalKB > MAX_SIZE_KB) {
      const overBy = totalKB - MAX_SIZE_KB;
      messages.push(`Over limit by ${overBy} KB`);
      messages.push('Optimize images, minify code, remove unused assets');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

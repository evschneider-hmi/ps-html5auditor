/**
 * IAB Hosted File Count Check
 * 
 * Reports the total number of hosted files in the creative.
 * 
 * Why This Matters:
 * - Informational metric for tracking complexity
 * - More files = more HTTP requests
 * - Helps identify over-complicated creatives
 * - Useful for performance analysis
 * 
 * IAB Guidelines:
 * - No explicit file count limit
 * - But keep it reasonable (<50 files recommended)
 * - Consider combining/minifying files
 * 
 * Best Practice:
 * - Minimize file count
 * - Combine CSS/JS files
 * - Use sprite sheets for images
 * - Inline small assets
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const hostedCountCheck: Check = {
  id: 'hostedCount',
  title: 'Hosted File Count',
  description: 'IAB: Reports total number of hosted files (informational).',
  profiles: ['IAB'],
  priority: 'advisory',
  tags: ['files', 'performance', 'debug', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { files } = context;
    
    const count = files.length;
    
    // Informational only - always PASS
    const messages = [`Files: ${count}`];
    
    if (count > 50) {
      messages.push('Consider reducing file count (<50 recommended)');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: 'PASS',
      messages,
      offenders: []
    };
  }
};

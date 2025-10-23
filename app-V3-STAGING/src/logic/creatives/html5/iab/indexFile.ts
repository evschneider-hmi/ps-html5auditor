/**
 * IAB Index File Check
 * 
 * Validates that index.html exists at root level.
 * 
 * Why This Matters:
 * - Standard entry point for HTML5 creatives
 * - Expected by ad servers and preview tools
 * - Simplifies trafficking and QA
 * - Industry standard naming convention
 * 
 * IAB Guidelines:
 * - Root-level index.html required
 * - Must be at top level (not in subdirectory)
 * - Case-insensitive (index.html or index.htm)
 * 
 * Best Practice:
 * - Always name entry file "index.html"
 * - Place at root of ZIP
 * - Keep naming consistent across all sizes
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const indexFileCheck: Check = {
  id: 'indexFile',
  title: 'Index File Check',
  description: 'IAB: index.html must be present at root level.',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['filename', 'structure', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { bundle } = context;
    
    // Check if any file at root is named index.html or index.htm
    const hasIndex = Object.keys(bundle.files).some(path => {
      const filename = path.split('/').pop() || '';
      return /^index\.html?$/i.test(filename);
    });
    
    const severity = hasIndex ? 'PASS' : 'FAIL';
    
    const messages = hasIndex
      ? ['index.html present']
      : [
          'index.html not found at root',
          'Rename entry file to index.html',
          'Place at root level of ZIP'
        ];
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

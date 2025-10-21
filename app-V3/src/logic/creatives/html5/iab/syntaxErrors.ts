/**
 * IAB Syntax Errors Check
 * 
 * Validates no uncaught JavaScript errors occur.
 * 
 * Why This Matters:
 * - Broken creative = no impressions
 * - Errors stop execution
 * - Poor user experience
 * - May break publisher page
 * - Indicates code quality issues
 * 
 * IAB Guidelines:
 * - Zero uncaught errors required
 * - Creative must execute cleanly
 * - Test across browsers
 * - Handle all edge cases
 * 
 * Common Causes:
 * - Syntax errors (typos, missing brackets)
 * - Reference errors (undefined variables)
 * - Type errors (wrong data types)
 * - Network errors (failed asset loads)
 * - Browser compatibility issues
 * 
 * Best Practice:
 * - Use try-catch for risky code
 * - Test in multiple browsers
 * - Use ESLint/TypeScript
 * - Handle asset load failures
 * - Monitor console during testing
 * 
 * Detection:
 * - Runtime probe tracks window.onerror
 * - Catches all uncaught errors
 * - Includes network failures
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const syntaxErrorsCheck: Check = {
  id: 'syntaxErrors',
  title: 'Syntax Errors',
  description: 'IAB: No uncaught JavaScript errors may occur.',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['errors', 'javascript', 'quality', 'iab'],
  
  execute(context: CheckContext): Finding {
    // Get runtime probe data
    const meta = (window as any).__audit_last_summary as any;
    const errors = meta?.errors || 0;
    
    const severity = errors > 0 ? 'FAIL' : 'PASS';
    
    const messages = [`Uncaught errors: ${errors}`];
    
    if (errors > 0) {
      messages.push('JavaScript errors detected');
      messages.push('Check browser console for details');
      messages.push('Fix all errors before trafficking');
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

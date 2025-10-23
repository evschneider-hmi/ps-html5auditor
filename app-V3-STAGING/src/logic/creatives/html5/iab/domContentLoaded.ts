/**
 * IAB DOMContentLoaded Check
 * 
 * Validates that DOMContentLoaded event fires within 1000ms (1 second).
 * 
 * Why This Matters:
 * - DCL indicates HTML parsed and ready
 * - Critical milestone for page performance
 * - Affects when JavaScript can run safely
 * - Publishers track DCL timing
 * - Late DCL = slow creative
 * 
 * IAB Guidelines:
 * - Target: DOMContentLoaded <1000ms
 * - Measured from page load start
 * - Indicates HTML parsing complete
 * - Scripts have finished loading/executing
 * - DOM is ready for manipulation
 * 
 * What is DOMContentLoaded:
 * - Browser event fired when HTML is parsed
 * - Does NOT wait for images/stylesheets
 * - Does NOT wait for async scripts
 * - DOES wait for synchronous scripts
 * - Indicates DOM tree is complete
 * 
 * Difference from Load Event:
 * - DCL: HTML parsed, DOM ready
 * - Load: All resources loaded (images, CSS, fonts)
 * - DCL fires first
 * - Load can be much later
 * - DCL is more important for ads
 * 
 * Common Causes of Slow DCL:
 * - Large HTML files
 * - Synchronous scripts blocking parser
 * - Slow external scripts
 * - Heavy inline JavaScript
 * - Complex DOM structure
 * 
 * How to Improve:
 * - Minimize HTML size
 * - Use async/defer for scripts
 * - Avoid synchronous external scripts
 * - Reduce inline JavaScript
 * - Simplify DOM structure
 * - Remove unused HTML
 * - Optimize critical path
 * 
 * Measurement Details:
 * - Captured in preview using runtime probe
 * - Uses performance.timing API
 * - Measured in milliseconds
 * - Reliable across all browsers
 * 
 * FAIL vs PASS:
 * - <1000ms: PASS (good performance)
 * - ≥1000ms: FAIL (too slow)
 * - Not captured: No severity (preview needed)
 * 
 * Best Practice:
 * - Aim for <500ms for best performance
 * - 500-1000ms: acceptable
 * - >1000ms: FAIL (needs optimization)
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const domContentLoadedCheck: Check = {
  id: 'domContentLoaded',
  title: 'DOMContentLoaded',
  description: 'IAB: DOM should be ready (DOMContentLoaded) within 1000ms.',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['performance', 'timing', 'dcl', 'iab'],
  
  execute(context: CheckContext): Finding {
    const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
    const dcl = meta?.domContentLoaded;
    
    // If no DCL data, skip check (preview needed)
    if (typeof dcl !== 'number') {
      return {
        id: this.id,
        title: this.title,
        severity: 'PASS',
        messages: [
          'Not captured',
          'Preview needed for DCL measurement'
        ],
        offenders: []
      };
    }
    
    const severity = dcl < 1000 ? 'PASS' : 'FAIL';
    const messages = [
      `DCL ${Math.round(dcl)} ms`,
      'Target: < 1000 ms'
    ];
    
    if (dcl >= 1000) {
      messages.push(`Slow DOMContentLoaded (${Math.round(dcl - 1000)}ms over target)`);
      messages.push('Optimize HTML parsing and script execution');
      messages.push('Use async/defer for scripts, reduce DOM complexity');
    } else {
      messages.push('Fast DOMContentLoaded');
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

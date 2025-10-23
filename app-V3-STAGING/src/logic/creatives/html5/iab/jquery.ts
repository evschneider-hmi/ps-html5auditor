/**
 * IAB jQuery Usage Check
 * 
 * Detects use of jQuery library (runtime detection).
 * 
 * Why This Matters:
 * - jQuery is 30KB+ (large file size)
 * - Slower than vanilla JS
 * - Modern browsers don't need it
 * - Better alternatives available
 * - Impacts load time
 * 
 * IAB Guidelines:
 * - Avoid jQuery if possible
 * - Use vanilla JavaScript
 * - Modern APIs are sufficient
 * - Keep file sizes small
 * 
 * When jQuery is Acceptable:
 * - Legacy code maintenance
 * - Minimal usage justified
 * - Already used by publisher
 * - But still discouraged
 * 
 * Modern Alternatives:
 * - querySelector() / querySelectorAll()
 * - fetch() for AJAX
 * - addEventListener() for events
 * - classList for classes
 * - Native DOM manipulation
 * 
 * Best Practice:
 * - Use vanilla JavaScript
 * - Modern ES6+ features
 * - Smaller file sizes
 * - Better performance
 * - No external dependencies
 * 
 * Detection:
 * - Runtime probe checks for jQuery global
 * - Detects both $ and jQuery
 * - Catches all jQuery versions
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const jqueryCheck: Check = {
  id: 'jquery',
  title: 'Uses jQuery',
  description: 'IAB: Avoid jQuery - use vanilla JavaScript instead.',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['jquery', 'libraries', 'performance', 'iab'],
  
  execute(context: CheckContext): Finding {
    // Get runtime probe data
    const meta = (window as any).__audit_last_summary as any;
    const jq = meta?.jquery || false;
    
    const severity = jq ? 'WARN' : 'PASS';
    
    const messages = jq
      ? [
          'Detected',
          'jQuery adds ~30KB+ to file size',
          'Use vanilla JavaScript for better performance'
        ]
      : ['Not detected'];
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

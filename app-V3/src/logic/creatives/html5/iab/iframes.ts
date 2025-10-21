/**
 * IAB Iframe Count Check
 * 
 * Detects iframes in HTML (warns if present).
 * 
 * Why This Matters:
 * - Iframes add complexity
 * - Security concerns
 * - Performance overhead
 * - Harder to track
 * - May cause issues with ad serving
 * 
 * IAB Guidelines:
 * - Avoid iframes when possible
 * - Use direct HTML instead
 * - Better performance
 * - Simpler structure
 * 
 * When Iframes are Acceptable:
 * - Third-party content isolation
 * - Security sandboxing required
 * - Legacy component integration
 * - Video embeds (YouTube, etc.)
 * 
 * Issues with Iframes:
 * - Additional HTTP requests
 * - Cross-origin restrictions
 * - Harder to debug
 * - Tracking complications
 * - Size calculation issues
 * 
 * Best Practice:
 * - Avoid iframes if possible
 * - Use direct HTML/JS
 * - If needed, document reason
 * - Test thoroughly
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const iframesCheck: Check = {
  id: 'iframes',
  title: 'Iframe Count',
  description: 'IAB: Avoid iframes when possible (performance/security).',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['iframes', 'structure', 'performance', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { htmlText } = context;
    
    // Count iframe tags in HTML
    const iframes = (htmlText.match(/<iframe\b/gi) || []).length;
    
    const severity = iframes > 0 ? 'WARN' : 'PASS';
    
    const messages = [`iframes (static HTML): ${iframes}`];
    
    if (iframes > 0) {
      messages.push('Iframes detected');
      messages.push('Consider using direct HTML instead');
      messages.push('Iframes add complexity and overhead');
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

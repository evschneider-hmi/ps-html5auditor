/**
 * IAB Cookies Dropped Check
 * 
 * Validates no cookies are set by the creative.
 * 
 * Why This Matters:
 * - Privacy regulations (GDPR, CCPA)
 * - User consent requirements
 * - Publisher policies prohibit
 * - IAB compliance requirement
 * - Tracking must use ad server methods
 * 
 * IAB Guidelines:
 * - No document.cookie writes
 * - No cookies set via JavaScript
 * - Use ad server for frequency capping
 * - Respect user privacy
 * 
 * Best Practice:
 * - Never set cookies from creative
 * - Use platform frequency capping
 * - Implement via ad server
 * - Follow privacy regulations
 * 
 * Detection:
 * - Runtime probe intercepts document.cookie writes
 * - Tracks both direct and dynamic calls
 * - Catches all cookie setting attempts
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const cookiesCheck: Check = {
  id: 'cookies',
  title: 'Cookies Dropped',
  description: 'IAB: No cookies may be set by the creative.',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['cookies', 'privacy', 'iab'],
  
  execute(context: CheckContext): Finding {
    // Get runtime probe data
    const meta = (window as any).__audit_last_summary as any;
    const cookieSet = meta?.cookies || 0;
    
    const severity = cookieSet > 0 ? 'FAIL' : 'PASS';
    
    const messages = [`Cookie sets: ${cookieSet}`];
    
    if (cookieSet > 0) {
      messages.push('Cookie writes detected');
      messages.push('Use ad server frequency capping instead');
      messages.push('Remove all document.cookie writes');
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

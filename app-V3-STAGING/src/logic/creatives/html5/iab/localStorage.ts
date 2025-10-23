/**
 * IAB Local Storage Check
 * 
 * Validates no use of localStorage API (runtime detection).
 * 
 * Why This Matters:
 * - Privacy regulations (GDPR, CCPA)
 * - User consent requirements
 * - Publisher policies prohibit
 * - IAB compliance requirement
 * - Persistent storage without consent
 * 
 * IAB Guidelines:
 * - No localStorage.setItem() calls
 * - No persistent data storage
 * - Use ad server for state management
 * - Respect user privacy
 * 
 * Difference from CM360 Check:
 * - CM360: Static code scan (finds API references)
 * - IAB: Runtime detection (catches actual calls)
 * - Both are important for full coverage
 * 
 * Best Practice:
 * - Never use localStorage in creatives
 * - Use platform frequency capping
 * - In-memory state only
 * - Follow privacy regulations
 * 
 * Detection:
 * - Runtime probe intercepts localStorage.setItem()
 * - Tracks actual usage, not just presence
 * - Catches dynamic/eval() calls
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const localStorageCheck: Check = {
  id: 'localStorage',
  title: 'Local Storage',
  description: 'IAB: No use of localStorage API (runtime detection).',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['storage', 'privacy', 'iab'],
  
  execute(context: CheckContext): Finding {
    // Get runtime probe data
    const meta = (window as any).__audit_last_summary as any;
    const ls = meta?.localStorage || 0;
    
    const severity = ls > 0 ? 'FAIL' : 'PASS';
    
    const messages = [`setItem calls: ${ls}`];
    
    if (ls > 0) {
      messages.push('localStorage usage detected');
      messages.push('Remove all localStorage.setItem() calls');
      messages.push('Use ad server frequency capping');
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

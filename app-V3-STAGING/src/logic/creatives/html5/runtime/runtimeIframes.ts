/**
 * Runtime Iframes Check
 * 
 * Detects iframes that are created or observed at runtime (debug check).
 * 
 * Why This Matters:
 * - Dynamically created iframes can bypass security checks
 * - Runtime iframes may not be detected by static analysis
 * - Helps identify dynamic content loading patterns
 * - Useful for debugging unexpected iframe behavior
 * - Publishers may restrict dynamic iframe creation
 * 
 * What This Detects:
 * - Iframes created via JavaScript (document.createElement)
 * - Iframes added to DOM at runtime
 * - Iframes present in initial HTML (counted in static analysis)
 * - Total count includes both static + dynamic
 * 
 * Static vs Runtime Iframes:
 * - **Static**: Present in HTML source (already checked by other validation)
 * - **Runtime**: Created/modified by JavaScript after page load
 * - This check focuses on runtime-created iframes
 * 
 * WARN Condition:
 * - Any iframes detected at runtime = WARN
 * - Not necessarily a failure, but worth noting
 * - Review if intentional vs unintentional
 * 
 * Common Sources:
 * - Ad SDKs loading tracking pixels
 * - Third-party widgets
 * - Analytics/measurement tools
 * - Polyfill/shim libraries
 * - Content Security Policy workarounds
 * 
 * Note:
 * - This is a debug/informational check
 * - Provides visibility into runtime behavior
 * - Does not fail creatives
 * - Helps identify unexpected dynamic content
 * 
 * Best Practice:
 * - Minimize dynamic iframe creation
 * - Use static HTML when possible
 * - Document why runtime iframes are needed
 * - Test in preview to verify behavior
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const runtimeIframesCheck: Check = {
  id: 'runtimeIframes',
  title: 'Runtime Iframes',
  description: 'Detects iframes created or observed at runtime',
  profiles: ['CM360', 'IAB'],
  priority: 'advisory',
  tags: ['debug', 'runtime', 'iframe'],
  
  execute(context: CheckContext): Finding {
    const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
    const runtimeIframes = meta?.runtimeIframes ?? 0;
    
    const messages: string[] = [];
    
    if (runtimeIframes > 0) {
      messages.push(`${runtimeIframes} iframe(s) created/observed at runtime`);
      messages.push('Review if this is intentional');
      messages.push('Dynamic iframes may bypass static checks');
    } else {
      messages.push('No runtime iframes detected');
      messages.push('All iframes (if any) are static');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: runtimeIframes > 0 ? 'WARN' : 'PASS',
      messages,
      offenders: []
    };
  }
};

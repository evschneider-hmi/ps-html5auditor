/**
 * IAB CPU Budget Check
 * 
 * Validates that the creative uses ≤30% of CPU time during first 3 seconds (Long Tasks API).
 * 
 * Why This Matters:
 * - Heavy CPU usage degrades user experience
 * - Can slow down entire page
 * - Battery drain on mobile devices
 * - May freeze browser UI
 * - Bad for publisher site performance
 * 
 * IAB Guidelines:
 * - Maximum 30% CPU busy in first 3 seconds
 * - Measured using Long Tasks API
 * - Long Task = main thread busy ≥50ms
 * - Total long task time / 3000ms = CPU busy %
 * 
 * Long Tasks API:
 * - Browser API to detect main thread blocking
 * - Reports tasks that take ≥50ms
 * - Indicates JavaScript is blocking UI
 * - Only available in Chromium browsers
 * 
 * Example Calculation:
 * - Creative runs 3 seconds
 * - Long tasks total 900ms
 * - CPU busy = 900 / 3000 = 30%
 * - If >30% → FAIL
 * 
 * Common CPU Hogs:
 * - Complex JavaScript animations
 * - Heavy DOM manipulation
 * - Large image processing
 * - Excessive rendering
 * - Unoptimized loops
 * 
 * How to Reduce CPU Usage:
 * - Use CSS animations instead of JS
 * - Optimize JavaScript loops
 * - Debounce/throttle event handlers
 * - Use requestAnimationFrame
 * - Lazy load heavy operations
 * - Reduce DOM manipulation
 * - Profile with Chrome DevTools
 * 
 * PENDING State:
 * - Returns "PENDING" if measurement in progress
 * - Creative just loaded, still collecting data
 * - Preview needs to run for 3+ seconds
 * - Reload to get final measurement
 * 
 * Browser Support:
 * - Requires Long Tasks API (Chromium only)
 * - Not available in Firefox/Safari
 * - If unsupported: returns WARN
 * - Best tested in Chrome/Edge
 * 
 * Best Practice:
 * - Keep CPU usage <20% for best performance
 * - 20-30%: acceptable but optimize if possible
 * - >30%: FAIL (too heavy)
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const cpuBudgetCheck: Check = {
  id: 'cpu-budget',
  title: 'CPU Busy Budget',
  description: 'IAB: Creative should use ≤30% CPU in first 3 seconds (Long Tasks API).',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['performance', 'cpu', 'long-tasks', 'iab'],
  
  execute(context: CheckContext): Finding {
    const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
    const longMs = typeof meta?.longTasksMs === 'number' 
      ? Math.max(0, Math.min(3000, Math.round(meta.longTasksMs))) 
      : undefined;
    
    // Check if CPU measurement is pending (creative just loaded)
    const cpuTracking = meta?.cpuTracking;
    if (cpuTracking === 'pending') {
      return {
        id: this.id,
        title: this.title,
        severity: 'PENDING' as any,
        messages: [
          '⏳ Measuring CPU usage...',
          'Collecting Long Tasks data'
        ],
        offenders: []
      };
    }
    
    // If we have measurement data
    if (typeof longMs === 'number') {
      const clamped = Math.max(0, Math.min(3000, Math.round(longMs)));
      const pct = Math.round((clamped / 3000) * 100);
      const severity = pct > 30 ? 'FAIL' : 'PASS';
      
      const messages = [
        `Main thread busy ~${pct}% (long tasks ${clamped} ms / 3000 ms)`,
        'Measured in preview'
      ];
      
      if (pct > 30) {
        messages.push(`Exceeded CPU budget (${pct - 30}% over)`);
        messages.push('Optimize JavaScript and animations');
        messages.push('Use CSS animations when possible');
      } else {
        messages.push('Within CPU budget');
      }
      
      return {
        id: this.id,
        title: this.title,
        severity,
        messages,
        offenders: []
      };
    }
    
    // No measurement data - check browser support
    const supportsLongTask = (() => {
      try {
        if (typeof PerformanceObserver === 'undefined') return false;
        const types: any = (PerformanceObserver as any).supportedEntryTypes;
        return Array.isArray(types) && types.includes('longtask');
      } catch {
        return false;
      }
    })();
    
    const reason = supportsLongTask
      ? 'Preview not yet measured — reload to collect CPU budget metrics'
      : 'Browser preview lacks Long Tasks API (try Chromium-based browser)';
    
    return {
      id: this.id,
      title: this.title,
      severity: 'WARN',
      messages: [reason],
      offenders: []
    };
  }
};

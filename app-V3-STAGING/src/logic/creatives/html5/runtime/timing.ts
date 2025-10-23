/**
 * Timing Metrics Check
 * 
 * Reports DOMContentLoaded, Time to Render, and Frames observed during runtime preview.
 * 
 * Why This Matters:
 * - Provides visibility into creative load performance metrics
 * - Helps diagnose slow-loading creatives
 * - Tracks frame rendering during preview
 * - Useful for performance debugging and optimization
 * 
 * Metrics Reported:
 * - **DOMContentLoaded (DCL)**: Time when HTML parsing completes and DOM is ready
 * - **Time to Render**: Approximate time when first visual content appears
 * - **Frames Observed**: Number of animation frames captured during preview
 * 
 * Note:
 * - This is a debug/informational check (always passes)
 * - Metrics are captured by the runtime probe during preview
 * - Values may not be available for static HTML-only creatives
 * 
 * Best Practice:
 * - Use these metrics to identify performance bottlenecks
 * - Compare metrics across different creative versions
 * - Monitor for regressions in load performance
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const timingCheck: Check = {
  id: 'timing',
  title: 'Timing Metrics',
  description: 'Reports DOMContentLoaded, Time to Render, and Frames observed',
  profiles: ['CM360', 'IAB'],
  priority: 'advisory',
  tags: ['debug'],
  
  execute(context: CheckContext): Finding {
    const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
    const dcl = meta?.domContentLoaded;
    const visual = meta?.visualStart;
    const frames = meta?.frames;
    
    const messages: string[] = [];
    
    // DOMContentLoaded timing
    if (typeof dcl === 'number' && isFinite(dcl)) {
      messages.push(`DOMContentLoaded ${Math.round(dcl)} ms`);
    } else {
      messages.push('DOMContentLoaded not captured');
    }
    
    // Visual start timing
    if (typeof visual === 'number' && isFinite(visual)) {
      messages.push(`Time to Render ~${Math.round(visual)} ms`);
    } else {
      messages.push('Time to Render not captured');
    }
    
    // Frames observed
    if (typeof frames === 'number' && isFinite(frames)) {
      messages.push(`Frames observed ${frames}`);
    } else {
      messages.push('Frames not tracked');
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

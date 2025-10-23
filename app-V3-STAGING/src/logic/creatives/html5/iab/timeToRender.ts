/**
 * IAB Time to Render Check
 * 
 * Validates that the creative starts rendering visible content within 500ms.
 * 
 * Why This Matters:
 * - Fast visual start improves user perception
 * - Users expect instant ad display
 * - Slow render = poor user experience
 * - Publishers penalize slow ads
 * - Better viewability scores
 * 
 * IAB Guidelines:
 * - Target: First visible content <500ms
 * - Measured from page load to first paint
 * - Includes HTML parsing and initial render
 * - Does NOT include full animation start
 * - Just "something visible on screen"
 * 
 * What "Visual Start" Means:
 * - First pixel painted on screen
 * - Could be background color
 * - Could be first image
 * - Could be text/border
 * - Detected by MutationObserver + IntersectionObserver
 * 
 * Common Causes of Slow Render:
 * - Heavy JavaScript before render
 * - Large CSS files blocking render
 * - Slow external resource loading
 * - Complex DOM construction
 * - Synchronous script tags
 * 
 * How to Improve:
 * - Minimize critical render path
 * - Inline critical CSS
 * - Defer non-critical JavaScript
 * - Use async/defer for scripts
 * - Optimize image loading
 * - Reduce DOM complexity
 * - Load fonts asynchronously
 * 
 * Measurement Details:
 * - Captured in preview using runtime probe
 * - Detects first visual change
 * - Uses MutationObserver for DOM changes
 * - Uses IntersectionObserver for visibility
 * - Measured in milliseconds
 * 
 * WARN vs PASS:
 * - <500ms: PASS (good performance)
 * - ≥500ms: WARN (slow but acceptable)
 * - Not captured: WARN (preview needed)
 * 
 * Best Practice:
 * - Aim for <300ms for best performance
 * - 300-500ms: acceptable
 * - >500ms: needs optimization
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const timeToRenderCheck: Check = {
  id: 'timeToRender',
  title: 'Time to Render',
  description: 'IAB: First visible content should appear within 500ms.',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['performance', 'timing', 'render', 'iab'],
  
  execute(context: CheckContext): Finding {
    const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
    const visual = meta?.visualStart;
    
    const hasVisual = typeof visual === 'number' && isFinite(visual);
    const severity = hasVisual && visual < 500 ? 'PASS' : 'WARN';
    
    const msg = hasVisual 
      ? `Render start ~${Math.round(visual)} ms` 
      : 'Not captured';
    
    const messages = [msg, 'Target: < 500 ms'];
    
    if (hasVisual && visual >= 500) {
      messages.push(`Slow render (${Math.round(visual - 500)}ms over target)`);
      messages.push('Optimize critical render path');
      messages.push('Inline critical CSS, defer JavaScript');
    } else if (hasVisual) {
      messages.push('Fast visual start');
    } else {
      messages.push('Preview needed for timing measurement');
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

/**
 * Creative Rendered Check
 * 
 * Validates that the creative actually renders (not blank or failed).
 * 
 * Why This Matters:
 * - Blank creatives = wasted impressions
 * - Rendering failures cause 0% viewability
 * - Publishers reject non-rendering ads
 * - Critical for creative delivery
 * - Indicates fundamental HTML/JS errors
 * 
 * Detection Methods:
 * 1. **Runtime Probe (preferred)**: Checks if frames rendered or visual start detected
 * 2. **Static Fallback**: Checks if HTML has <body> tag (basic structure)
 * 
 * Runtime Probe Signals:
 * - **Frames > 0**: Animation frames captured (creative is animating)
 * - **Visual Start**: First visual content detected (creative is visible)
 * - Both indicate successful render
 * 
 * Static Fallback:
 * - If runtime not available, checks for basic HTML structure
 * - Presence of <body> tag indicates valid HTML
 * - Less reliable but catches obvious errors
 * 
 * FAIL Conditions:
 * - No runtime signal captured
 * - AND no valid HTML structure
 * - = Creative likely blank or broken
 * 
 * Common Causes of FAIL:
 * - JavaScript errors preventing render
 * - Missing or corrupt entry HTML
 * - CSS hiding all content
 * - Empty <body> tag
 * - Fatal exceptions during load
 * 
 * Best Practice:
 * - Test in preview to validate render
 * - Check browser console for errors
 * - Verify at least one frame renders
 * - Ensure visible content exists
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const creativeRenderedCheck: Check = {
  id: 'creativeRendered',
  title: 'Creative Rendered',
  description: 'Validates the creative renders successfully (not blank or failed)',
  profiles: ['CM360', 'IAB'],
  priority: 'required',
  tags: ['runtime', 'render', 'critical'],
  
  execute(context: CheckContext): Finding {
    const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
    const htmlText = context.htmlText;
    
    // Check runtime probe signals
    const okProbe = (meta?.frames || 0) > 0 || (typeof meta?.visualStart === 'number');
    
    // Fallback to static HTML check
    const okStatic = !!(htmlText && /<body[\s>]/i.test(htmlText));
    
    const ok = okProbe || okStatic;
    const messages: string[] = [];
    
    if (okProbe) {
      messages.push('Rendered (preview confirmed)');
      if (meta?.frames > 0) {
        messages.push(`${meta.frames} frame(s) captured`);
      }
      if (typeof meta?.visualStart === 'number') {
        messages.push(`Visual start at ${Math.round(meta.visualStart)}ms`);
      }
    } else if (okStatic) {
      messages.push('Rendered (static HTML structure detected)');
      messages.push('Preview recommended for confirmation');
    } else {
      messages.push('No render signal captured');
      messages.push('Creative may be blank or failed to render');
      messages.push('Check for JavaScript errors or missing content');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: ok ? 'PASS' : 'FAIL',
      messages,
      offenders: []
    };
  }
};

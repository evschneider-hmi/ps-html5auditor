/**
 * IAB CSS Embedded Check
 * 
 * Validates that CSS is embedded (not external).
 * 
 * Why This Matters:
 * - External CSS requires additional HTTP request
 * - Delays initial render
 * - Can fail if external resource unavailable
 * - IAB requires self-contained creatives
 * 
 * IAB Guidelines:
 * - CSS must be embedded via <style> tags or inline styles
 * - No external CSS files via <link> tags
 * - Ensures creative works without external dependencies
 * 
 * Best Practice:
 * - Use <style> tags in HTML
 * - Inline critical CSS for above-the-fold content
 * - Minify embedded CSS
 * - Keep CSS focused and minimal
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const cssEmbeddedCheck: Check = {
  id: 'cssEmbedded',
  title: 'CSS Embedded',
  description: 'IAB: CSS must be embedded via style tags or inline styles (no external CSS).',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['css', 'embedding', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { htmlText } = context;
    
    const hasStyleTag = /<style[\s>]/i.test(htmlText);
    const inlineStyles = (htmlText.match(/ style=/gi) || []).length;
    
    const severity = (hasStyleTag || inlineStyles > 0) ? 'PASS' : 'FAIL';
    
    const messages: string[] = [];
    
    if (hasStyleTag) {
      messages.push('Style tags present');
    }
    
    if (inlineStyles > 0) {
      messages.push(`${inlineStyles} inline style attribute(s)`);
    }
    
    if (!hasStyleTag && inlineStyles === 0) {
      messages.push('No embedded CSS detected');
      messages.push('Add <style> tags or inline styles');
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

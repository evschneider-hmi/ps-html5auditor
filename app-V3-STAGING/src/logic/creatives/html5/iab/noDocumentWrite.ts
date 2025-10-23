/**
 * IAB Avoid document.write() Check
 * 
 * Validates no use of document.write() or document.writeln().
 * 
 * Why This Matters:
 * - Deprecated API (Chrome blocks it)
 * - Can break page after load
 * - Performance issues
 * - Not reliable in async scripts
 * - Modern best practices avoid it
 * 
 * IAB Guidelines:
 * - Avoid document.write()
 * - Use DOM manipulation instead
 * - Async-safe code required
 * - Better performance
 * 
 * Chrome Behavior:
 * - Blocks document.write() on slow connections
 * - Shows console warning
 * - May cause creative to fail
 * 
 * Alternatives:
 * - Use innerHTML
 * - Use createElement() + appendChild()
 * - Use insertAdjacentHTML()
 * - Modern DOM APIs
 * 
 * Best Practice:
 * - Never use document.write()
 * - Use modern DOM methods
 * - Async-compatible code
 * - Better performance
 * 
 * Detection:
 * - Runtime probe intercepts document.write() calls
 * - Catches actual usage
 * - Includes dynamic calls
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const noDocumentWriteCheck: Check = {
  id: 'no-document-write',
  title: 'Avoid document.write()',
  description: 'IAB: Avoid document.write() and document.writeln().',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['document-write', 'deprecated', 'iab'],
  
  execute(context: CheckContext): Finding {
    // Get runtime probe data
    const meta = (window as any).__audit_last_summary as any;
    const docw = meta?.documentWrites || 0;
    
    const severity = docw > 0 ? 'WARN' : 'PASS';
    
    const messages = docw > 0
      ? [
          `Calls detected: ${docw}`,
          'document.write() is deprecated',
          'Use DOM APIs instead (innerHTML, createElement, etc.)'
        ]
      : ['No document.write usage detected'];
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

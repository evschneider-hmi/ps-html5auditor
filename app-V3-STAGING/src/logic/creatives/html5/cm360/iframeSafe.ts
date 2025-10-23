/**
 * CM360 Iframe Safe (No Cross-Frame DOM) Check
 * 
 * Validates that creative doesn't access parent/top frame DOM.
 * 
 * CM360 Requirements:
 * - No window.parent.* access (except allowed APIs)
 * - No window.top.* access (except allowed APIs)
 * - No document.domain manipulation
 * 
 * Allowed APIs:
 * - parent.postMessage() - Standard cross-frame communication
 * - parent.$iframe - CM360-provided for pharmaceutical creatives
 * 
 * Why This Matters:
 * - Creatives run in iframes for security
 * - Cross-frame access violates same-origin policy
 * - Can cause trafficking rejection
 * - Publishers block ads that access parent frames
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// Pattern: Match window.parent.*, window.top.*, or bare parent.*/top.* (global)
// Exclude: parent.postMessage, parent.$iframe (allowed APIs)
// Exclude: this.parent, foo.parent (object properties, not global)
const PARENT_TOP_GLOBAL = /(^|[^.$\w])(?:window\.)?(?:parent|top)\.(?!(?:postMessage|\$iframe)\b)/i;

// Pattern: document.domain assignment (security violation)
const DOC_DOMAIN = /document\.domain\s*=/i;

export const iframeSafeCheck: Check = {
  id: 'iframe-safe',
  title: 'Iframe Safe (No Cross-Frame DOM)',
  description: 'CM360: No access to parent/top frame DOM (window.parent.*, window.top.*, document.domain).',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['security', 'iframe', 'dom', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    const offenders: Array<{ path: string; line: number; detail: string }> = [];
    
    // Scan JS and HTML files
    for (const filePath of files) {
      if (!/\.(js|html?)$/i.test(filePath)) continue;
      
      const text = new TextDecoder().decode(bundle.files[filePath]);
      const lines = text.split(/\r?\n/);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for document.domain manipulation
        if (DOC_DOMAIN.test(line)) {
          offenders.push({
            path: filePath,
            line: i + 1,
            detail: line.trim().slice(0, 200)
          });
          continue;
        }
        
        // Check for parent/top frame access
        const match = PARENT_TOP_GLOBAL.exec(line);
        if (match) {
          // Matched via global form (not this.parent or foo.parent)
          // The regex already guards against object properties via [^.$\w] pre-char check
          offenders.push({
            path: filePath,
            line: i + 1,
            detail: line.trim().slice(0, 200)
          });
        }
      }
    }
    
    // Build messages
    const messages = [
      `Cross-frame access references: ${offenders.length}`
    ];
    
    if (offenders.length > 0) {
      messages.push(
        'Detected window.parent.*, window.top.*, or document.domain'
      );
      messages.push(
        'Allowed: parent.postMessage(), parent.$iframe (pharmaceutical only)'
      );
      
      // Show sample offenders
      const samples = offenders.slice(0, 3).map(o => 
        `${o.path}:${o.line}`
      );
      messages.push(`Examples: ${samples.join(', ')}`);
    }
    
    const severity = offenders.length ? 'FAIL' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

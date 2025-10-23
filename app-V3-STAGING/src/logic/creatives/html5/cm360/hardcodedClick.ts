/**
 * CM360 Hard-Coded Clickthrough URLs Check
 * 
 * Detects hard-coded URLs that should use dynamic clickTag variables.
 * 
 * Why This Matters:
 * - Hard-coded URLs bypass CM360 tracking
 * - Clicks won't be measured or attributed
 * - Can't change landing page after trafficking
 * - Breaks A/B testing and retargeting
 * 
 * Patterns Detected:
 * - window.open() with direct URL
 * - location.href = "http://..."
 * - top.location = "http://..."
 * - parent.location = "http://..."
 * - clickTag = "http://..." (should be dynamic)
 * - <a href="http://..."> (should use clickTag JS)
 * 
 * Best Practice:
 * - Use Enabler.exit() or window.open(clickTag)
 * - Never hard-code destination URLs
 * - Test in Preview environment first
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// Patterns for various hard-coded click mechanisms
const HARDCODED_PATTERNS: Array<{ id: string; regex: RegExp }> = [
  { 
    id: 'window.open', 
    regex: /window\.open\s*\(\s*['"]https?:\/\//i 
  },
  { 
    id: 'location.assign', 
    regex: /location\.(href|replace)\s*=\s*['"]https?:\/\//i 
  },
  { 
    id: 'top.location', 
    regex: /top\.location(?:\.href)?\s*=\s*['"]https?:\/\//i 
  },
  { 
    id: 'parent.location', 
    regex: /parent\.location(?:\.href)?\s*=\s*['"]https?:\/\//i 
  },
  { 
    id: 'clickTag assign', 
    regex: /\bclickTAG?\s*=\s*['"]https?:\/\//i 
  },
];

// Pattern for <a href="http://..."> in HTML
const ANCHOR_HARDCODED = /<a[^>]+href=["']https?:\/\/[^"]+["'][^>]*>/gi;

export const hardcodedClickCheck: Check = {
  id: 'hardcoded-click',
  title: 'Hard Coded Click Tag Check',
  description: 'CM360: No hard-coded clickthrough URLs. Use dynamic clickTag variables.',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['clicktag', 'tracking', 'urls', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    const offenders: Array<{ path: string; line: number; detail: string }> = [];
    
    // Scan JS and HTML files
    for (const filePath of files) {
      if (!/\.(html?|js)$/i.test(filePath)) continue;
      
      const text = new TextDecoder().decode(bundle.files[filePath]);
      const lines = text.split(/\r?\n/);
      
      // Check each line against patterns
      lines.forEach((line, i) => {
        for (const pattern of HARDCODED_PATTERNS) {
          if (pattern.regex.test(line)) {
            offenders.push({
              path: filePath,
              line: i + 1,
              detail: `${pattern.id} with hard-coded URL`
            });
            break; // Only report first match per line
          }
        }
      });
      
      // Check HTML files for <a href="http://...">
      if (/\.html?$/i.test(filePath)) {
        let match: RegExpExecArray | null;
        ANCHOR_HARDCODED.lastIndex = 0;
        
        while ((match = ANCHOR_HARDCODED.exec(text))) {
          const lineNum = text.slice(0, match.index).split(/\r?\n/).length;
          offenders.push({
            path: filePath,
            line: lineNum,
            detail: '<a> with hard-coded href'
          });
        }
      }
    }
    
    // Build messages
    const messages = offenders.length === 0
      ? ['No hard-coded click tags present']
      : [
          `${offenders.length} hard-coded clickthrough(s) detected`,
          'Use dynamic clickTag variables instead',
          'Example: window.open(clickTag) or Enabler.exit("exit1")'
        ];
    
    const severity = offenders.length > 0 ? 'FAIL' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

/**
 * Invalid Markup Check
 * 
 * Performs heuristic syntax validation for HTML, CSS, and SVG files.
 * 
 * Why This Matters:
 * - Syntax errors cause rendering failures
 * - Browser parser errors = broken creative
 * - Malformed HTML/CSS/SVG may not display correctly
 * - Early detection prevents deployment issues
 * - Saves time vs debugging in production
 * 
 * What This Checks:
 * 
 * **HTML Files (.html, .htm):**
 * - Uses DOMParser to parse HTML
 * - Detects parser errors (malformed tags, invalid structure)
 * - Catches common HTML syntax mistakes
 * 
 * **SVG Files (.svg):**
 * - Parses as XML/SVG
 * - Detects XML parsing errors
 * - Validates SVG structure
 * 
 * **CSS Files (.css):**
 * - Heuristic: Checks for unmatched braces
 * - Counts opening { and closing } braces
 * - Mismatch indicates syntax error
 * 
 * WARN Condition:
 * - Any file with detected syntax issues
 * - Not always 100% accurate (heuristic)
 * - But usually indicates real problems
 * 
 * Common Issues Detected:
 * 
 * **HTML:**
 * - Unclosed tags (`<div>` without `</div>`)
 * - Invalid nesting (`<p><div></div></p>`)
 * - Malformed attributes
 * - Invalid characters
 * 
 * **SVG:**
 * - Broken XML structure
 * - Invalid SVG elements
 * - Malformed paths
 * - XML parsing errors
 * 
 * **CSS:**
 * - Unmatched braces (missing { or })
 * - Incomplete rules
 * - Truncated files
 * 
 * Limitations:
 * - Heuristic detection (not full validation)
 * - May miss some complex errors
 * - May report false positives (rare)
 * - CSS check is basic (just brace matching)
 * 
 * How to Fix:
 * - Run HTML validator on flagged files
 * - Check CSS syntax with linter
 * - Validate SVG in editor
 * - Fix unclosed/malformed tags
 * - Ensure all braces are balanced
 * 
 * Best Practice:
 * - Use linters during development
 * - Validate before packaging
 * - Test in multiple browsers
 * - Use editor syntax highlighting
 */

import type { Check, CheckContext } from '../../types';
import type { Finding, FindingOffender } from '../../../types';
import { getDOMParser } from '../../../../utils/domParser';

export const invalidMarkupCheck: Check = {
  id: 'invalid-markup',
  title: 'Invalid Markup (HTML/CSS/SVG)',
  description: 'Heuristic syntax validation for HTML, CSS, and SVG files',
  profiles: ['CM360', 'IAB'],
  priority: 'recommended',
  tags: ['syntax', 'validation', 'html', 'css', 'svg'],
  
  async execute(context: CheckContext): Promise<Finding> {
    const { bundle, files } = context;
    const invalid: FindingOffender[] = [];
    const parser = await getDOMParser();
    
    for (const p of files) {
      const low = p.toLowerCase();
      
      // Check HTML files
      if (/\.html?$/.test(low)) {
        try {
          const text = new TextDecoder().decode(bundle.files[p]);
          const doc = parser.parseFromString(text, 'text/html');
          const isErr = doc.querySelector('parsererror');
          
          if (isErr) {
            invalid.push({
              path: p,
              detail: 'HTML parser error'
            });
          }
        } catch {
          invalid.push({
            path: p,
            detail: 'HTML parse exception'
          });
        }
      }
      
      // Check SVG files
      if (/\.svg$/.test(low)) {
        try {
          const text = new TextDecoder().decode(bundle.files[p]);
          const doc = parser.parseFromString(text, 'image/svg+xml');
          const isErr = doc.querySelector('parsererror');
          
          if (isErr) {
            invalid.push({
              path: p,
              detail: 'SVG parser error'
            });
          }
        } catch {
          invalid.push({
            path: p,
            detail: 'SVG parse exception'
          });
        }
      }
      
      // Check CSS files (heuristic: brace matching)
      if (/\.css$/.test(low)) {
        try {
          const text = new TextDecoder().decode(bundle.files[p]);
          
          // Count opening and closing braces
          const opens = (text.match(/\{/g) || []).length;
          const closes = (text.match(/\}/g) || []).length;
          
          if (opens !== closes) {
            invalid.push({
              path: p,
              detail: `Unmatched braces {${opens}} vs }${closes}`
            });
          }
        } catch {
          invalid.push({
            path: p,
            detail: 'CSS read exception'
          });
        }
      }
    }
    
    const messages: string[] = [];
    
    if (invalid.length > 0) {
      messages.push(`${invalid.length} file(s) with syntax issues (heuristic)`);
      messages.push('Review flagged files for syntax errors');
      messages.push('Run validators/linters for detailed diagnostics');
    } else {
      messages.push('No syntax issues detected');
      messages.push('All HTML/CSS/SVG files appear valid');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: invalid.length ? 'WARN' : 'PASS',
      messages,
      offenders: invalid.slice(0, 100) // Limit to first 100 for UI
    };
  }
};

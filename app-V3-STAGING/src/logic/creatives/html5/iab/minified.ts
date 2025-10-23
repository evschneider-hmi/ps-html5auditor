/**
 * IAB CSS/JS Minified Check
 * 
 * Validates that JavaScript and CSS files are minified.
 * 
 * Why This Matters:
 * - Minification reduces file size 40-60%
 * - Faster downloads
 * - Better performance
 * - Industry best practice
 * - Required for IAB compliance
 * 
 * IAB Guidelines:
 * - All JS/CSS must be minified
 * - Remove whitespace, comments
 * - Shorten variable names
 * - Use build tools
 * 
 * Detection Method (Heuristic):
 * - Long lines (>2000 chars) indicate minification
 * - Dense lines (>98% non-whitespace, >200 chars)
 * - ≥20 dense lines suggests minified
 * - Not perfect, but reliable
 * 
 * Common Minifiers:
 * - UglifyJS (JavaScript)
 * - Terser (JavaScript, modern)
 * - cssnano (CSS)
 * - Build tool plugins (Webpack, Vite, etc.)
 * 
 * Best Practice:
 * - Automate minification in build process
 * - Don't minify manually
 * - Keep source files separate
 * - Use source maps for debugging
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const minifiedCheck: Check = {
  id: 'minified',
  title: 'CSS/JS Minified',
  description: 'IAB: All JavaScript and CSS files must be minified.',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['minification', 'performance', 'filesize', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    let jsMinified = 0;
    let cssMinified = 0;
    let jsFiles = 0;
    let cssFiles = 0;
    const offenders: Array<{ path: string; detail: string }> = [];
    
    // Check each JS/CSS file
    for (const filePath of files) {
      if (!/\.(js|css)$/i.test(filePath)) continue;
      
      const text = new TextDecoder().decode(bundle.files[filePath]);
      const lines = text.split(/\r?\n/);
      
      // Heuristic: minified files have very long lines or many dense lines
      const longLines = lines.filter(l => l.length > 2000);
      const dense = lines.filter(l => 
        l.length > 200 && 
        (l.replace(/\s+/g, '').length / l.length) > 0.98
      );
      
      const isMinified = longLines.length > 0 || dense.length > 20;
      
      // Count files
      if (/\.js$/i.test(filePath)) {
        jsFiles++;
        if (isMinified) jsMinified++;
      } else {
        cssFiles++;
        if (isMinified) cssMinified++;
      }
      
      // Track non-minified files
      if (!isMinified) {
        offenders.push({
          path: filePath,
          detail: 'not minified (heuristic)'
        });
      }
    }
    
    const jsNot = Math.max(0, jsFiles - jsMinified);
    const cssNot = Math.max(0, cssFiles - cssMinified);
    const severity = (jsNot + cssNot) === 0 ? 'PASS' : 'FAIL';
    
    const messages = [
      `JS minified: ${jsMinified}/${jsFiles}`,
      `CSS minified: ${cssMinified}/${cssFiles}`
    ];
    
    if (jsNot > 0 || cssNot > 0) {
      messages.push('Non-minified files detected');
      messages.push('Use build tools (Webpack, Vite, etc.) to minify');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

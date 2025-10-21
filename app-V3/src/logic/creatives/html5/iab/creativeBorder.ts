/**
 * IAB Creative Border Check
 * 
 * Validates that the creative has a visible border (helps distinguish ad from content).
 * 
 * Why This Matters:
 * - Clearly separates ad from editorial content
 * - IAB standard for user transparency
 * - Reduces "deceptive" appearance
 * - Publishers often require borders
 * - Better user trust
 * 
 * IAB Guidelines:
 * - Creative should have visible border
 * - Can be CSS border property
 * - Can be edge lines (GWD style)
 * - Must be detectable at runtime
 * - Helps distinguish ad from content
 * 
 * Detection Methods:
 * 
 * 1. CSS Border Detection:
 *    - Scans for border properties in CSS
 *    - Checks inline styles
 *    - Validates border is visible (not none/hidden)
 *    - Requires positive width (>0px)
 *    - Must have style (solid/dashed/dotted)
 * 
 * 2. Edge Line Detection (GWD):
 *    - Detects 4 absolute positioned lines
 *    - Top: top:0, left:0, width:100%, height:1-16px
 *    - Bottom: bottom:0, left:0, width:100%, height:1-16px
 *    - Left: left:0, top:0, height:100%, width:1-16px
 *    - Right: right:0, top:0, height:100%, width:1-16px
 *    - Must have visible background color
 *    - Common pattern from Google Web Designer
 * 
 * 3. Runtime Probe Detection:
 *    - Uses browser runtime detection
 *    - Checks computed styles
 *    - Counts border sides
 *    - More accurate than static analysis
 * 
 * Border Examples:
 * - CSS: `border: 1px solid black;`
 * - CSS: `border: 2px dashed #ccc;`
 * - Edge lines: 4 divs at edges with background color
 * - Box shadow can work if visible
 * 
 * Common Patterns:
 * - 1px solid black (most common)
 * - 1px solid #cccccc (subtle gray)
 * - 2px solid (thicker border)
 * - GWD: 4 x 1px divs at edges
 * 
 * When Border Not Detected:
 * - Returns WARN (not FAIL)
 * - Preview may not have rendered yet
 * - Border might be added dynamically
 * - Check runtime probe for accurate result
 * 
 * Best Practice:
 * - Use CSS border property (simplest)
 * - 1px solid black or gray
 * - Apply to main container
 * - Test with runtime preview
 * - Verify all 4 sides visible
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';
import { getDOMParser } from '../../../../utils/domParser';

export const creativeBorderCheck: Check = {
  id: 'border',
  title: 'Border Present',
  description: 'IAB: Creative should have visible border (CSS or edge lines).',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['border', 'css', 'transparency', 'iab'],
  
  async execute(context: CheckContext): Promise<Finding> {
    const { htmlText, bundle, primary } = context;
    const files = Object.keys(bundle.files);
    const parser = await getDOMParser();
    
    // Helper: Check if CSS border declaration is visible
    const hasVisibleBorderDecl = (valueRaw: string): boolean => {
      const value = (valueRaw || '').toLowerCase().replace(/!important/g, '').trim();
      if (!value) return false;
      if (/\b(none|hidden)\b/.test(value)) return false;
      const hasStyle = /\b(solid|dashed|dotted|double|groove|ridge|inset|outset)\b/.test(value);
      if (!hasStyle) return false;
      const hasKeywordWidth = /\b(thin|medium|thick)\b/.test(value);
      const hasPositivePx = /(?:^|[^0-9.])(?:[1-9]\d*(?:\.\d+)?|0*\.\d*[1-9]\d*)px\b/.test(value);
      return hasKeywordWidth || hasPositivePx;
    };
    
    // 1) Look for CSS border declarations in HTML and linked CSS
    const cssSources: Array<{ path: string; text: string }> = [];
    try {
      const html = htmlText || '';
      const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map((m, idx) => ({
        path: primary ? `${primary} <style #${idx + 1}>` : `<style #${idx + 1}>`,
        text: m[1] || '',
      }));
      cssSources.push(...styleBlocks);
      for (const p of files) {
        if (/\.css$/i.test(p)) {
          try {
            const text = new TextDecoder().decode(bundle.files[p]);
            cssSources.push({ path: p, text });
          } catch {}
        }
      }
    } catch {}
    
    let cssHasBorder = false;
    const cssOffenders: any[] = [];
    
    for (const source of cssSources) {
      const lines = source.text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const declPattern = /\bborder(?:-top|-right|-bottom|-left)?\s*:\s*([^;{}]+)/gi;
        let match: RegExpExecArray | null;
        let added = false;
        while ((match = declPattern.exec(line))) {
          const declValue = match[1] || '';
          if (!hasVisibleBorderDecl(declValue)) {
            continue;
          }
          const snippetEnd = Math.min(line.length, match.index + match[0].length + 24);
          const snippet = line
            .slice(match.index, snippetEnd)
            .replace(/\s+/g, ' ')
            .trim();
          cssHasBorder = true;
          cssOffenders.push({ 
            path: source.path, 
            line: i + 1, 
            detail: snippet.slice(0, 200) 
          });
          added = true;
          break;
        }
        if (added) continue;
      }
    }
    
    let hasBorder = cssHasBorder || /\bborder\s*:\s*\d+px\s+(solid|dashed|double)\b/i.test(htmlText);
    const messages: string[] = [];
    const edgeOffenders: any[] = [];
    
    if (hasBorder) messages.push('Detected via CSS border');
    
    // 2) Detect absolute edge lines with thickness 1-16px and any visible color (GWD pattern)
    try {
      const doc = parser.parseFromString(htmlText, 'text/html');
      const nodes = Array.from(doc.querySelectorAll('[style]')) as HTMLElement[];
      
      function parseStyle(s: string): Record<string, string> {
        const map: Record<string, string> = {};
        s.split(';').forEach(part => {
          const [k, v] = part.split(':');
          if (!k || !v) return;
          map[k.trim().toLowerCase()] = v.trim().toLowerCase();
        });
        return map;
      }
      
      function isZero(val?: string) {
        if (!val) return false;
        return /^0(px|)$/.test(val) || val === '0';
      }
      
      function isPx1to16(val?: string) {
        if (!val) return false;
        const m = /^([1-9]|1[0-6])(px)?$/.exec(val);
        return !!m;
      }
      
      function isFull(val?: string) {
        if (!val) return false;
        return /^100%$/.test(val);
      }
      
      function isVisibleColor(val?: string) {
        if (!val) return false;
        return (
          !/transparent|rgba\(0,\s*0,\s*0,\s*0\)/i.test(val) &&
          /#|rgb|hsl|\bblack\b|\bwhite\b|\bred\b|\bblue\b|\bgreen\b|\byellow\b|\bgray\b/i.test(val)
        );
      }
      
      let top = false, bottom = false, left = false, right = false;
      
      for (const el of nodes) {
        const st = parseStyle(el.getAttribute('style') || '');
        const bg = st['background-color'] || st['background'] || '';
        const pos = st['position'] || '';
        if (pos !== 'absolute') continue;
        
        const id = el.getAttribute('id');
        const cls = el.getAttribute('class');
        const tag = el.tagName.toLowerCase();
        const marker = [
          tag,
          id ? `#${id}` : null,
          cls ? `.${cls.replace(/\s+/g, '.')}` : null
        ].filter(Boolean).join('');
        
        // Top line: top:0, left:0, width:100%, height:1-16px, visible bg
        if (isZero(st['top']) && isZero(st['left']) && isFull(st['width']) && isPx1to16(st['height']) && isVisibleColor(bg)) {
          top = true;
          edgeOffenders.push({ 
            path: primary || '(inline)', 
            detail: `${marker || 'element'} top line ${st['height'] || ''}` 
          });
          continue;
        }
        
        // Bottom line: bottom:0, left:0, width:100%, height:1-16px, visible bg
        if (isZero(st['bottom']) && isZero(st['left']) && isFull(st['width']) && isPx1to16(st['height']) && isVisibleColor(bg)) {
          bottom = true;
          edgeOffenders.push({ 
            path: primary || '(inline)', 
            detail: `${marker || 'element'} bottom line ${st['height'] || ''}` 
          });
          continue;
        }
        
        // Left line: left:0, top:0, height:100%, width:1-16px, visible bg
        if (isZero(st['left']) && isZero(st['top']) && isFull(st['height']) && isPx1to16(st['width']) && isVisibleColor(bg)) {
          left = true;
          edgeOffenders.push({ 
            path: primary || '(inline)', 
            detail: `${marker || 'element'} left line ${st['width'] || ''}` 
          });
          continue;
        }
        
        // Right line: right:0, top:0, height:100%, width:1-16px, visible bg
        if (isZero(st['right']) && isZero(st['top']) && isFull(st['height']) && isPx1to16(st['width']) && isVisibleColor(bg)) {
          right = true;
          edgeOffenders.push({ 
            path: primary || '(inline)', 
            detail: `${marker || 'element'} right line ${st['width'] || ''}` 
          });
          continue;
        }
      }
      
      const count = [top, bottom, left, right].filter(Boolean).length;
      if (count >= 3) {
        hasBorder = true;
        messages.push(`Detected via ${count} edge lines`);
      }
    } catch {}
    
    // 3) Prefer runtime probe signal if available
    try {
      const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
      if (meta && (meta.borderSides || meta.borderCssRules)) {
        if ((meta.borderSides || 0) >= 3 || (meta.borderCssRules || 0) > 0) {
          hasBorder = true;
          messages.push(
            `Detected at runtime (${meta.borderSides || 0} sides, ${meta.borderCssRules || 0} css rule(s))`
          );
        }
      }
    } catch {}
    
    const severity = hasBorder ? 'PASS' : 'WARN';
    
    // Get runtime probe stats
    const meta = (typeof window !== 'undefined' && (window as any).__audit_last_summary) as any;
    const sides = (meta?.borderSides ?? 0) as number;
    const cssRules = (meta?.borderCssRules ?? 0) as number;
    
    const borderMsgs = [
      `Border detected: ${hasBorder ? 'yes' : 'no'}`,
      `Sides detected: ${sides}`,
      `CSS rules: ${cssRules}`,
      ...messages
    ];
    
    if (!hasBorder) {
      borderMsgs.push('No border detected');
      borderMsgs.push('Add CSS border or edge lines (GWD style)');
      borderMsgs.push('Example: border: 1px solid #000;');
    }
    
    // Collect evidence
    let evidence = hasBorder ? cssOffenders.concat(edgeOffenders) : edgeOffenders.slice(0, 4);
    if (hasBorder && evidence.length === 0 && (sides > 0 || cssRules > 0)) {
      evidence = [{ 
        path: '(runtime)', 
        detail: `Runtime detected ${sides} side(s), ${cssRules} css rule(s)` 
      }];
    }
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages: borderMsgs,
      offenders: evidence.slice(0, 100)
    };
  }
};

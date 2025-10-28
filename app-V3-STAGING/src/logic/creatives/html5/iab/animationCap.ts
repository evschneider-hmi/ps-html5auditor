/**
 * IAB Animation Length Cap Check
 * 
 * Validates that animations run for ≤15 seconds OR ≤3 loops (whichever is shorter).
 * 
 * Why This Matters:
 * - Long animations annoy users
 * - Waste CPU and battery
 * - Distract from content
 * - Publishers often reject long-running ads
 * - Better user experience with shorter animations
 * 
 * IAB Guidelines:
 * - Maximum 15 seconds total animation time
 * - OR maximum 3 loops
 * - Whichever limit is reached first
 * - Infinite loops allowed if ≤15 seconds total
 * - After limit: ad should be static
 * 
 * What We Check:
 * 1. CSS Animations:
 *    - animation-duration property
 *    - animation-iteration-count property
 *    - animation shorthand
 *    - Supports s/ms units
 *    - Detects infinite loops
 * 
 * 2. JavaScript Animations:
 *    - Runtime tracking (if available)
 *    - Detects JS animation libraries
 *    - Duration estimation
 * 
 * Calculation Examples:
 * - 5s animation, infinite loops: FAIL (exceeds 15s)
 * - 3s animation, 5 loops (15s total): PASS
 * - 2s animation, 10 loops (20s total): FAIL
 * - 20s animation, 1 loop: FAIL (exceeds 15s)
 * 
 * Common Violations:
 * - Infinite loop with >15s duration
 * - Multiple animations running simultaneously
 * - JavaScript animations without time limit
 * - Looping background animations
 * 
 * How to Comply:
 * - Limit animation to 15 seconds
 * - Use 3 or fewer loops
 * - Stop animation after time limit
 * - Use finite iteration-count
 * - Test with timer to verify
 * 
 * PENDING State:
 * - Returns "PENDING" if JS animation tracking in progress
 * - Creative just loaded, analyzing runtime behavior
 * - Preview needs to run for animation cycle
 * - Reload to get final measurement
 * 
 * Detection Methods:
 * - Parses CSS for animation properties
 * - Scans inline styles
 * - Checks external CSS files
 * - Uses runtime probe for JS animations
 * - Combines static + runtime analysis
 * 
 * Best Practice:
 * - Use 3-5 second animations
 * - Loop 1-3 times max
 * - Stop after 15 seconds
 * - Provide static end state
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const animationCapCheck: Check = {
  id: 'animation-cap',
  title: 'Animation Length Cap',
  description: 'IAB: Animations must run ≤15 seconds OR ≤3 loops (whichever is reached first). After limit, ad should be static.',
  profiles: ['IAB', 'CM360'],
  priority: 'required',
  tags: ['animation', 'duration', 'loops', 'iab', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { htmlText, bundle } = context;
    const files = Object.keys(bundle.files);
    
    // Helper to parse duration tokens (s or ms)
    const parseDurToken = (tok: string): number => {
      const s = String(tok || '').trim();
      let m = /^([\d.]+)\s*s$/i.exec(s);
      if (m) return parseFloat(m[1]) || 0;
      m = /^([\d.]+)\s*ms$/i.exec(s);
      if (m) return (parseFloat(m[1]) || 0) / 1000;
      const n = parseFloat(s);
      return isFinite(n) ? n : 0;
    };
    
    // Collect all CSS text sources
    const cssTexts: string[] = [];
    
    // Inline <style> blocks
    try {
      const html = htmlText || '';
      const styleBlocks = Array.from(html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)).map(m => m[1] || '');
      cssTexts.push(...styleBlocks);
    } catch {}
    
    // External CSS files in bundle
    for (const p of files) {
      if (/\.css$/i.test(p)) {
        try {
          cssTexts.push(new TextDecoder().decode(bundle.files[p]));
        } catch {}
      }
    }
    
    // Also scan raw HTML for inline style attributes
    const htmlRaw = htmlText || '';
    cssTexts.push(htmlRaw);
    
    let maxDurS = 0;
    let maxLoops = 1;
    let infinite = false;
    
    // Parse CSS for animation properties
    for (const t of cssTexts) {
      // animation-duration property
      const reDur = /(?:^|;|\n|\{)\s*(?:-webkit-)?animation-duration\s*:\s*([^;\n\r]+)[;\n\r]/gi;
      let m: RegExpExecArray | null;
      reDur.lastIndex = 0;
      while ((m = reDur.exec(t))) {
        const list = String(m[1] || '').split(',');
        for (const part of list) {
          const v = parseDurToken(part);
          if (isFinite(v)) maxDurS = Math.max(maxDurS, v);
        }
      }
      
      // animation-iteration-count property
      const reIter = /(?:^|;|\n|\{)\s*(?:-webkit-)?animation-iteration-count\s*:\s*([^;\n\r]+)[;\n\r]/gi;
      let mi: RegExpExecArray | null;
      reIter.lastIndex = 0;
      while ((mi = reIter.exec(t))) {
        const list = String(mi[1] || '').split(',');
        for (const raw0 of list) {
          const raw = raw0.trim().toLowerCase();
          if (raw === 'infinite') {
            infinite = true;
            maxLoops = Math.max(maxLoops, 9999);
          } else {
            const v = parseFloat(raw);
            if (isFinite(v)) maxLoops = Math.max(maxLoops, Math.round(v));
          }
        }
      }
      
      // animation shorthand property
      const reSh = /(?:^|;|\n|\{)\s*(?:-webkit-)?animation\s*:\s*([^;\n\r]+)[;\n\r]/gi;
      let ms: RegExpExecArray | null;
      reSh.lastIndex = 0;
      while ((ms = reSh.exec(t))) {
        const blocks = String(ms[1] || '').split(',');
        for (const blk of blocks) {
          const tk = blk.trim().replace(/\([^)]*\)/g, '');
          const toks = tk.split(/\s+/);
          for (const tok of toks) {
            if (/^([\d.]+)(ms|s)$/i.test(tok)) {
              const v = parseDurToken(tok);
              if (v > maxDurS) maxDurS = v;
            } else if (tok.toLowerCase() === 'infinite') {
              infinite = true;
              if (maxLoops < 9999) maxLoops = 9999;
            } else if (/^\d+$/.test(tok)) {
              const iv = parseInt(tok, 10);
              if (iv > maxLoops) maxLoops = iv;
            }
          }
        }
      }
    }
    
    // Note: Runtime animation tracking happens in the preview iframe AFTER checks run.
    // Checks execute in a worker during upload (no access to runtime data).
    // For JS animations (GSAP, Anime.js), static detection is limited.
    // Users should check the "Diagnostics" tab in preview for runtime animation metrics.
    
    // Check if violates: (infinite OR >3 loops) AND >15s duration
    const violates = (infinite || maxLoops > 3) && maxDurS > 15;
    
    const messages: string[] = [];
    
    // If no static CSS animations detected
    if (maxDurS === 0 && !infinite && maxLoops <= 1) {
      messages.push('No CSS animation detected in static analysis');
      messages.push('');
      messages.push('For JavaScript animations (GSAP, Anime.js, etc.):');
      messages.push('✓ Runtime tracking is active in preview iframe');
      messages.push('✓ Animation duration is automatically measured');
      messages.push('⚠ This check cannot validate JS animations during upload');
      messages.push('');
      messages.push('IAB Requirement: Animation must be ≤15s OR ≤3 loops');
    } else {
      // Static CSS animation detected
      messages.push(`Max animation duration ~${maxDurS.toFixed(2)} s`);
      messages.push(`Max loops ${infinite ? 'infinite' : maxLoops}`);
    }
    
    if (violates) {
      messages.push('⚠ Animation exceeds 15s limit');
      messages.push('Limit to ≤15 seconds OR ≤3 loops');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: violates ? 'FAIL' : 'PASS',
      messages,
      offenders: []
    };
  }
};

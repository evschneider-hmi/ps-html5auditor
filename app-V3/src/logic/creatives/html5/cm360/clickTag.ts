/**
 * CM360 ClickTag Check
 * 
 * Validates that:
 * 1. A global clickTag variable is declared
 * 2. The clickTag is used for navigation (window.open, location assignment, etc.)
 * 3. Displays the temporary URL value if set for testing
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const clickTagCheck: Check = {
  id: 'clicktag',
  title: 'ClickTag Present and Used',
  description: 'CM360: Global clickTag present and used via window.open(clickTag).',
  profiles: ['CM360'],
  priority: 'required',
  
  execute(context: CheckContext): Finding {
    const { files, bundle } = context;
    
    let hasClickTag = false;
    let hasWindowClickTag = false;
    let hasOpen = false;
    let hasEnablerExit = false;
    const ctOff: any[] = [];
    
    // Regex patterns for clickTag detection
    const ctVar = /\b(?:window\.)?(clicktag|clickTag|clickTAG)\d*\b/i;
    const ctVarWindow = /\bwindow\.(clicktag|clickTag|clickTAG)\d*\b/i;
    const ctOpen = /window\.open\s*\(\s*(?:window\.)?(clickTAG|clickTag)\d*\b/i;
    const ctOpenLoose = /window\.open\s*\(\s*([^)]*)\)/ig;
    const ctAliasDecl = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*[^;]*clicktag\d*[^;]*;/ig;
    const ctAliasAssign = /\b([A-Za-z_$][\w$]*)\s*=\s*[^;]*clicktag\d*[^;]*;/ig;
    const enablerExit = /\b(?:studio\.)?Enabler\.(?:exit|dynamicExit)\s*\(/i;
    
    // Additional navigation patterns
    const anchorHrefJs = /<a\b[^>]*\bhref=["']\s*javascript:\s*window\.open\s*\([^"']*(?:window\.)?(clickTAG|clickTag)\d*/i;
    const anchorOnclick = /<a\b[^>]*\bonclick=["'][^"']*(?:window\.)?open\s*\([^"']*(?:window\.)?(clickTAG|clickTag)\d*/i;
    const assignLocationVar = /(window|document|top)\.location\s*=\s*(?:window\.)?(clickTAG|clickTag)\d*/i;
    
    // Scan all JS/HTML files
    for (const p of files) {
      if (!/(\.(js|html?))$/i.test(p)) continue;
      
      const text = new TextDecoder().decode(bundle.files[p]);
      const lines = text.split(/\r?\n/);
      const seen = new Set<string>();
      
      // Track alias variable names
      const aliasNames = new Set<string>();
      let aliasMatch: RegExpExecArray | null;
      
      ctAliasDecl.lastIndex = 0;
      while ((aliasMatch = ctAliasDecl.exec(text))) {
        if (aliasMatch && aliasMatch[1]) aliasNames.add(aliasMatch[1]);
      }
      
      ctAliasAssign.lastIndex = 0;
      while ((aliasMatch = ctAliasAssign.exec(text))) {
        if (!aliasMatch || !aliasMatch[1]) continue;
        const idx = aliasMatch.index ?? 0;
        const prevChar = idx > 0 ? text[idx - 1] : '';
        if (prevChar === '.' || prevChar === '$' || prevChar === ']') continue;
        aliasNames.add(aliasMatch[1]);
      }
      
      // Scan line by line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check for clickTag variable declaration
        if (ctVar.test(line)) {
          hasClickTag = true;
          const k = `${p}:${i+1}:var`;
          if (!seen.has(k)) {
            seen.add(k);
            ctOff.push({ 
              path: p, 
              line: i+1, 
              kind: 'var', 
              detail: line.trim().slice(0, 200) 
            });
          }
        }
        
        // Check for window.clickTag usage
        if (ctVarWindow.test(line)) {
          hasWindowClickTag = true;
          const k = `${p}:${i+1}:varw`;
          if (!seen.has(k)) {
            seen.add(k);
            ctOff.push({ 
              path: p, 
              line: i+1, 
              kind: 'varw', 
              detail: line.trim().slice(0, 200) 
            });
          }
        }
        
        // Check for direct window.open(clickTag) usage
        if (ctOpen.test(line)) {
          hasOpen = true;
          const k = `${p}:${i+1}:open`;
          if (!seen.has(k)) {
            seen.add(k);
            ctOff.push({ 
              path: p, 
              line: i+1, 
              kind: 'open', 
              detail: line.trim().slice(0, 200) 
            });
          }
        }
        
        // Check for window.open with alias variables
        ctOpenLoose.lastIndex = 0;
        let openLoose: RegExpExecArray | null;
        while ((openLoose = ctOpenLoose.exec(line))) {
          const rawArg = (openLoose[1] || '').trim();
          if (!rawArg) continue;
          
          const includesClickVar = /clicktag/i.test(rawArg);
          let aliasUsed = false;
          let aliasName = '';
          
          const identMatch = rawArg.match(/^([A-Za-z_$][\w$]*)$/);
          if (identMatch && identMatch[1]) {
            aliasName = identMatch[1];
            if (aliasNames.has(aliasName)) aliasUsed = true;
          }
          
          if (!includesClickVar && !aliasUsed) continue;
          
          const key = includesClickVar 
            ? `${p}:${i+1}:open` 
            : `${p}:${i+1}:open-alias:${aliasName || rawArg}`;
          
          if (seen.has(key)) continue;
          if (includesClickVar && seen.has(`${p}:${i+1}:open`)) continue;
          
          hasOpen = true;
          seen.add(key);
          ctOff.push({ 
            path: p, 
            line: i+1, 
            kind: includesClickVar ? 'open' : 'open-alias', 
            detail: line.trim().slice(0, 200) 
          });
        }
        
        // Check for Enabler.exit usage (DoubleClick)
        if (enablerExit.test(line)) {
          hasEnablerExit = true;
          const k = `${p}:${i+1}:enabler`;
          if (!seen.has(k)) {
            seen.add(k);
            ctOff.push({ 
              path: p, 
              line: i+1, 
              kind: 'enabler', 
              detail: line.trim().slice(0, 200) 
            });
          }
        }
        
        // Check for anchor href with clickTag
        if (anchorHrefJs.test(line)) {
          hasOpen = true;
          const k = `${p}:${i+1}:ahref`;
          if (!seen.has(k)) {
            seen.add(k);
            ctOff.push({ 
              path: p, 
              line: i+1, 
              kind: 'ahref', 
              detail: line.trim().slice(0, 200) 
            });
          }
        }
        
        // Check for anchor onclick with clickTag
        if (anchorOnclick.test(line)) {
          hasOpen = true;
          const k = `${p}:${i+1}:aonclick`;
          if (!seen.has(k)) {
            seen.add(k);
            ctOff.push({ 
              path: p, 
              line: i+1, 
              kind: 'aonclick', 
              detail: line.trim().slice(0, 200) 
            });
          }
        }
        
        // Check for location assignment
        if (assignLocationVar.test(line)) {
          hasOpen = true;
          const k = `${p}:${i+1}:assign`;
          if (!seen.has(k)) {
            seen.add(k);
            ctOff.push({ 
              path: p, 
              line: i+1, 
              kind: 'assign', 
              detail: line.trim().slice(0, 200) 
            });
          }
        }
      }
    }
    
    // Determine severity
    const usedForNav = hasOpen;
    const ctPass = hasEnablerExit || (hasClickTag && usedForNav);
    const ctWarn = !ctPass && (hasClickTag || hasWindowClickTag || usedForNav || hasEnablerExit);
    const severity = ctPass ? 'PASS' : ctWarn ? 'WARN' : 'FAIL';
    
    // Build messages
    const messages: string[] = [];
    
    if (hasClickTag || hasWindowClickTag || hasEnablerExit) {
      messages.push('clickTag detected');
    } else {
      messages.push('clickTag not detected');
    }
    
    if (ctPass) {
      messages.push('clickTag referenced for redirect');
    }
    
    // Extract URL from clickTag assignment (if present)
    for (const offender of ctOff) {
      if (offender.kind === 'var' && offender.detail) {
        const urlMatch = offender.detail.match(
          /(?:var|let|const)?\s*(?:window\.)?(clicktag|clickTag|clickTAG)\s*=\s*["']([^"']+)["']/i
        );
        if (urlMatch && urlMatch[2]) {
          const url = urlMatch[2];
          messages.push(`URL temporarily set to '${url}'`);
          break; // Only show first URL found
        }
      }
    }
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: ctOff
    };
  }
};

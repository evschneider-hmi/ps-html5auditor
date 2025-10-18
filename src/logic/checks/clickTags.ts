import { ZipBundle, BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

interface ScanResult {
  hasClickTag: boolean;
  clickTagAssignments: { path: string; line: number; snippet: string; url: string }[];
  clickTagUsage: { path: string; line: number; snippet: string }[];
  hardcodedUrls: { path: string; line: number; snippet: string; url: string }[];
}

export function checkClickTags(bundle: ZipBundle, result: BundleResult, settings: Settings): Finding {
  const messages: string[] = [];
  const offenders: { path: string; detail?: string; line?: number }[] = [];
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';

  const scan = scanBundle(bundle, settings);
  
  // Determine clickTag status and hardcoded URL issues
  const hasClickTag = scan.hasClickTag;
  const hasClickTagUsage = scan.clickTagUsage.length > 0;
  const hasHardcodedUrls = scan.hardcodedUrls.length > 0;
  const clickTagAssignments = scan.clickTagAssignments;

  // Case 1: clickTag present AND used for redirect (PASS)
  if (hasClickTag && hasClickTagUsage && !hasHardcodedUrls) {
    severity = 'PASS';
    messages.push('clickTag detected and used for redirect');
    
    // Only show the temporarily assigned URL if there's actually a non-empty URL
    if (clickTagAssignments.length > 0) {
      const assignment = clickTagAssignments[0];
      const url = assignment.url.trim();
      // Only add the URL bullet if the URL is not empty
      if (url && url !== '') {
        const displayUrl = url.length > 50 ? url.slice(0, 50) + '...' : url;
        messages.push(`URL temporarily set to "${displayUrl}"`);
      }
    }
    
    // Add offenders for debugging/reference
    for (const c of scan.clickTagUsage) {
      offenders.push({ path: c.path, line: c.line, detail: 'ClickTag usage: ' + c.snippet.trim().slice(0, 100) });
    }
  }
  // Case 2: clickTag present but NOT used for redirect (hardcoded URL instead) (FAIL)
  else if (hasClickTag && !hasClickTagUsage && hasHardcodedUrls) {
    severity = 'FAIL';
    messages.push('clickTag detected but not used for redirect');
    
    // Show hardcoded URLs
    const uniqueUrls = Array.from(new Set(scan.hardcodedUrls.map(h => h.url))).slice(0, 3);
    for (const url of uniqueUrls) {
      const displayUrl = url.length > 60 ? url.slice(0, 60) + '...' : url;
      messages.push(`Clickthrough URL is hardcoded to "${displayUrl}"`);
    }
    
    for (const h of scan.hardcodedUrls) {
      offenders.push({ path: h.path, line: h.line, detail: 'Hardcoded URL: ' + h.snippet.trim().slice(0, 100) });
    }
  }
  // Case 3: clickTag present, used, but ALSO has hardcoded URLs (FAIL - mixed usage)
  else if (hasClickTag && hasClickTagUsage && hasHardcodedUrls) {
    severity = 'FAIL';
    messages.push('clickTag detected and used, but also has hardcoded URLs');
    
    const uniqueUrls = Array.from(new Set(scan.hardcodedUrls.map(h => h.url))).slice(0, 3);
    for (const url of uniqueUrls) {
      const displayUrl = url.length > 60 ? url.slice(0, 60) + '...' : url;
      messages.push(`Clickthrough URL is hardcoded to "${displayUrl}"`);
    }
    
    for (const h of scan.hardcodedUrls) {
      offenders.push({ path: h.path, line: h.line, detail: 'Hardcoded URL: ' + h.snippet.trim().slice(0, 100) });
    }
  }
  // Case 4: No clickTag AND no hardcoded URLs (FAIL)
  else if (!hasClickTag && !hasHardcodedUrls) {
    severity = 'FAIL';
    messages.push('clickTag not detected');
    messages.push('No redirect mechanism found');
  }
  // Case 5: No clickTag but hardcoded URLs exist (FAIL)
  else if (!hasClickTag && hasHardcodedUrls) {
    severity = 'FAIL';
    messages.push('clickTag not detected');
    
    const uniqueUrls = Array.from(new Set(scan.hardcodedUrls.map(h => h.url))).slice(0, 3);
    for (const url of uniqueUrls) {
      const displayUrl = url.length > 60 ? url.slice(0, 60) + '...' : url;
      messages.push(`Clickthrough URL is hardcoded to "${displayUrl}"`);
    }
    
    for (const h of scan.hardcodedUrls) {
      offenders.push({ path: h.path, line: h.line, detail: 'Hardcoded URL: ' + h.snippet.trim().slice(0, 100) });
    }
  }
  // Case 6: clickTag present but neither used nor has hardcoded URLs (FAIL - clickTag defined but not used at all)
  else {
    severity = 'FAIL';
    messages.push('clickTag detected but not used');
    messages.push('No redirect mechanism found');
  }

  return { id: 'clickTags', title: 'Click Tags / Exit', severity, messages, offenders };
}

function scanBundle(bundle: ZipBundle, settings: Settings): ScanResult {
  const patterns = settings.clickTagPatterns.map(r => new RegExp(r.slice(1, r.lastIndexOf('/')), r.split('/').pop() || ''));
  
  // Patterns to detect clickTag variable definition/assignment
  const clickTagAssignPattern = /\b(clicktag|clickTag|clickTAG)\s*=\s*["']([^"']+)["']/gi;
  
  // Patterns to detect clickTag being USED for navigation
  const clickTagUsagePatterns = [
    /window\.open\s*\(\s*clickTag/i,
    /location\.href\s*=\s*clickTag/i,
    /location\.assign\s*\(\s*clickTag/i,
    /location\.replace\s*\(\s*clickTag/i,
    /top\.location\s*=\s*clickTag/i,
    /parent\.location\s*=\s*clickTag/i,
  ];
  
  // Patterns to detect HARDCODED URLs (not using clickTag)
  const hardcodedPatterns = [
    { id: 'window.open', regex: /window\.open\s*\(\s*["']https?:\/\/[^"']+["']/i },
    { id: 'location.href', regex: /location\.href\s*=\s*["']https?:\/\/[^"']+["']/i },
    { id: 'location.assign', regex: /location\.assign\s*\(\s*["']https?:\/\/[^"']+["']/i },
    { id: 'location.replace', regex: /location\.replace\s*\(\s*["']https?:\/\/[^"']+["']/i },
    { id: 'top.location', regex: /top\.location(?:\.href)?\s*=\s*["']https?:\/\/[^"']+["']/i },
    { id: 'parent.location', regex: /parent\.location(?:\.href)?\s*=\s*["']https?:\/\/[^"']+["']/i },
  ];
  
  const anchorHardRegex = /<a[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  const urlExtractRegex = /(https?:\/\/[^\s"']+)/i;
  
  let hasClickTag = false;
  const clickTagAssignments: ScanResult['clickTagAssignments'] = [];
  const clickTagUsage: ScanResult['clickTagUsage'] = [];
  const hardcodedUrls: ScanResult['hardcodedUrls'] = [];
  
  for (const path of Object.keys(bundle.files)) {
    if (!/\.(html?|js)$/i.test(path)) continue;
    const text = new TextDecoder().decode(bundle.files[path]);
    const lines = text.split(/\r?\n/);
    
    lines.forEach((line, i) => {
      // Check for clickTag variable presence (any of the configured patterns)
      for (const pat of patterns) {
        if (pat.test(line)) {
          hasClickTag = true;
        }
      }
      
      // Check for clickTag assignment with URL value
      clickTagAssignPattern.lastIndex = 0;
      let assignMatch: RegExpExecArray | null;
      while ((assignMatch = clickTagAssignPattern.exec(line))) {
        hasClickTag = true;
        const url = assignMatch[2] || '';
        clickTagAssignments.push({ 
          path, 
          line: i + 1, 
          snippet: line.slice(0, 200),
          url
        });
      }
      
      // Check for clickTag USAGE in navigation
      for (const usagePattern of clickTagUsagePatterns) {
        if (usagePattern.test(line)) {
          clickTagUsage.push({ path, line: i + 1, snippet: line.slice(0, 200) });
          break; // Only add once per line
        }
      }
      
      // Check for HARDCODED URLs in navigation (not using clickTag variable)
      for (const hp of hardcodedPatterns) {
        if (hp.regex.test(line)) {
          const urlMatch = line.match(urlExtractRegex);
          const url = urlMatch ? urlMatch[1] : 'unknown';
          hardcodedUrls.push({ 
            path, 
            line: i + 1, 
            snippet: line.slice(0, 200),
            url
          });
          break; // Only add once per line
        }
      }
    });
    
    // Check for hardcoded URLs in anchor tags (HTML files only)
    if (/\.html?$/i.test(path)) {
      anchorHardRegex.lastIndex = 0;
      let anchorMatch: RegExpExecArray | null;
      while ((anchorMatch = anchorHardRegex.exec(text))) {
        const url = anchorMatch[1] || 'unknown';
        const lineNum = text.slice(0, anchorMatch.index).split(/\r?\n/).length;
        hardcodedUrls.push({ 
          path, 
          line: lineNum, 
          snippet: anchorMatch[0].slice(0, 200),
          url
        });
      }
    }
  }
  
  return { hasClickTag, clickTagAssignments, clickTagUsage, hardcodedUrls };
}

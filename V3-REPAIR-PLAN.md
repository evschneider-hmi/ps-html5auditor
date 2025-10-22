# V3 Repair Plan - Using V2 as Reference

## Executive Summary

This document outlines the complete plan to repair V3's audit system to achieve feature parity with V2, based on the comprehensive Teresa 300x250 comparison analysis.

**Current Status**: Priority 1 complete (animation detection fixed)
**Teresa Validation**:  GSAP detection working (8.5s detected, previously 0s)
**Commit**: 441feb7 - Enhanced Probe Object.defineProperty fix applied

---

## Priority 1: Animation Detection  COMPLETE

### Status: COMPLETE (Validated with Teresa)

**Problem**: Enhanced Probe reported 0s animation for Teresa's 8.5s GSAP timeline

**Root Cause**: setInterval polling installed GSAP hook too late - after creative already loaded and used GSAP library

**Solution Applied**:
- Ported V2's \Object.defineProperty(window, 'gsap', ...)\ pattern
- Hook installs BEFORE creative loads GSAP
- Timeline tracking on assignment: \	imelines.push(tl)\
- Extended polling: 500ms, 1s, 2s, 3s, 5s, 8s, 10s
- Summary object updates synchronized

**Validation Results**:
\\\
[Enhanced Probe] GSAP being assigned to window
[Enhanced Probe] Timeline created, total tracked: 1
[Enhanced Probe] GSAP timeline duration updated: 8.5s
[Enhanced Probe] Animation scan complete: {maxDuration: 8.5s, ...}
\\\

**Files Modified**:
- \pp-V3/src/ui/preview/utils/enhancedProbe.ts\ (lines 131-187, 103-125, 189-221)

**Evidence**:
- Screenshot: \.playwright-mcp/v3-enhanced-probe-fix-validation.png\
- Console logs confirm timeline tracking working
- Build time: 20.80s (no regression)

---

## Priority 2: Add 8 Missing Priority Checks

### Overview

V2 has 18 priority checks, V3 has only 10. The following checks need to be ported:

| Check ID | Title | V2 Source | V3 Target | Complexity |
|----------|-------|-----------|-----------|------------|
| \primaryAsset\ | Primary File and Size | extendedChecks.ts:200-220 | \pp-V3/src/logic/creatives/common/primaryAsset.ts\ | Low |
| \ssetReferences\ | All Files Referenced | extendedChecks.ts:221-250 | \pp-V3/src/logic/creatives/common/assetReferences.ts\ | Medium |
| \httpsOnly\ | HTTPS Only | extendedChecks.ts:251-280 | \pp-V3/src/logic/creatives/html5/cm360/httpsOnly.ts\ | Low |
| \syntaxErrors\ | Runtime Errors | buildIframeHtml.ts:700-750 | \pp-V3/src/logic/creatives/html5/runtime/syntaxErrors.ts\ | Medium |
| \iabWeight\ | Weight Budgets | extendedChecks.ts:300-350 | \pp-V3/src/logic/creatives/html5/iab/iabWeight.ts\ | Medium |
| \host-requests-initial\ | Initial Host Requests | runtimeProbe.ts:800-850 | \pp-V3/src/logic/creatives/html5/iab/hostRequestsInitial.ts\ | High |
| \cpu-budget\ | CPU Busy Budget | runtimeProbe.ts:1200-1300 | \pp-V3/src/logic/creatives/html5/iab/cpuBudgetInitial.ts\ | High |
| \nimation-cap\ (runtime) | Animation Cap (runtime) | EXISTS (needs runtime integration) | Update existing \nimationCap.ts\ | Low |

### Check 1: Primary File and Size (\primaryAsset\)

**Purpose**: Validates that \index.html\ exists and contains \<meta name="ad.size"\ declaration

**V2 Implementation** (extendedChecks.ts ~line 200):
\\\	ypescript
// Primary file must be index.html with ad.size meta
const primaryIsIndex = entryName && /^index\.html?$/i.test(entryName);
const hasAdSizeMeta = /<meta\s+name=["']ad\.size["']/i.test(htmlText);
const primaryOk = primaryIsIndex && hasAdSizeMeta;
\\\

**V3 Implementation Plan**:
\\\	ypescript
// File: app-V3/src/logic/creatives/common/primaryAsset.ts
export const primaryAssetCheck: Check = {
  id: 'primaryAsset',
  title: 'Primary File and Size',
  description: 'CM360: Entry file must be index.html with ad.size meta tag.',
  profiles: ['CM360'],
  priority: 'required',
  
  execute(context: CheckContext): Finding {
    const { primaryPath, htmlText } = context;
    const entryName = primaryPath?.split('/').pop() || '';
    
    const isIndex = /^index\.html?$/i.test(entryName);
    const hasAdSizeMeta = /<meta\s+name=["']ad\.size["']/i.test(htmlText || '');
    
    const severity = (isIndex && hasAdSizeMeta) ? 'PASS' : 'FAIL';
    const messages: string[] = [];
    
    if (isIndex) {
      messages.push('Entry file: index.html ');
    } else {
      messages.push(\Entry file: \  (expected index.html)\);
    }
    
    if (hasAdSizeMeta) {
      messages.push('ad.size meta tag present ');
    } else {
      messages.push('ad.size meta tag missing ');
    }
    
    return { id: this.id, title: this.title, severity, messages, offenders: [] };
  }
};
\\\

### Check 2: All Files Referenced (\ssetReferences\)

**Purpose**: Ensures all bundled files are referenced by entry HTML (no orphaned assets)

**V2 Implementation** (extendedChecks.ts ~line 221):
\\\	ypescript
const referenced = new Set<string>();
if (partial.references && Array.isArray(partial.references)) {
  for (const r of partial.references) {
    if (r.inZip && r.normalized) referenced.add(r.normalized.toLowerCase());
  }
}
const unreferenced = files.filter(p => !referenced.has(p.toLowerCase()));
\\\

**V3 Implementation Plan**: Already partially exists in \entry-html\ check - extract to dedicated check

### Check 3: HTTPS Only (\httpsOnly\)

**Purpose**: Validates that all external resource requests use HTTPS protocol

**V2 Implementation** (extendedChecks.ts ~line 251):
\\\	ypescript
const httpPattern = /(?:src|href)=["'](http:\/\/[^"']+)/gi;
const httpRefs: any[] = [];
for (const p of files) {
  if (/\\.(js|html?|css)$/i.test(p)) {
    const text = new TextDecoder().decode(bundle.files[p]);
    let m: RegExpExecArray | null;
    httpPattern.lastIndex = 0;
    while ((m = httpPattern.exec(text))) {
      httpRefs.push({ path: p, url: m[1], detail: m[0] });
    }
  }
}
\\\

**V3 Implementation Plan**: Simple regex scan across JS/HTML/CSS files

### Check 4: Runtime Errors (\syntaxErrors\)

**Purpose**: Captures uncaught JavaScript errors during preview execution

**V2 Implementation** (buildIframeHtml.ts ~line 700):
\\\	ypescript
window.addEventListener('error', function(e) {
  var msg = e.message || String(e.error || e);
  var file = e.filename || '(unknown)';
  var line = e.lineno || 0;
  runtimeErrors.push({ message: msg, file: file, line: line });
  summary.runtimeErrors = runtimeErrors.length;
});
\\\

**V3 Implementation Plan**: Add error listener to Enhanced Probe, expose via summary object

### Check 5: Weight Budgets (\iabWeight\)

**Purpose**: Validates IAB weight limits (150KB initial, 1000KB total polite load)

**V2 Implementation** (extendedChecks.ts ~line 300):
\\\	ypescript
const initialBytes = diagnostics?.initialLoadBytes || 0;
const politeBytes = diagnostics?.subloadBytes || 0;
const initialKB = initialBytes / 1024;
const politeKB = politeBytes / 1024;

const overInitial = initialKB > 150;
const overPolite = (initialKB + politeKB) > 1000;

const severity = (overInitial || overPolite) ? 'FAIL' : 'PASS';
\\\

**V3 Implementation Plan**: Requires load-phase categorization (initial vs. subload)

### Check 6: Initial Host Requests (\host-requests-initial\)

**Purpose**: Validates IAB limit of 10 initial host requests

**V2 Implementation** (runtimeProbe.ts ~line 800):
\\\	ypescript
var initialHostRequests = 0;
var observer = new PerformanceObserver(function(list) {
  var entries = list.getEntries();
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
      var url = new URL(entry.name);
      if (url.hostname !== window.location.hostname) {
        initialHostRequests++;
      }
    }
  }
});
observer.observe({ entryTypes: ['resource'] });
\\\

**V3 Implementation Plan**: Add PerformanceObserver to Enhanced Probe

### Check 7: CPU Busy Budget (\cpu-budget\)

**Purpose**: Validates IAB CPU usage cap (30% busy in first 3 seconds)

**V2 Implementation** (runtimeProbe.ts ~line 1200):
\\\	ypescript
var longTasks = [];
var cpuBusyMs = 0;
var cpuObserver = new PerformanceObserver(function(list) {
  var entries = list.getEntries();
  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    longTasks.push(entry);
    cpuBusyMs += entry.duration;
  }
});
if ('PerformanceLongTaskTiming' in window) {
  cpuObserver.observe({ entryTypes: ['longtask'] });
}

setTimeout(function() {
  var elapsed = 3000;
  var busyPercent = (cpuBusyMs / elapsed) * 100;
  summary.cpuBusyPercent = busyPercent;
}, 3000);
\\\

**V3 Implementation Plan**: Add Long Tasks API observer to Enhanced Probe

### Check 8: Animation Cap Runtime Integration

**Current Status**: Check exists but only uses CSS parsing, not runtime data

**Fix Required**: Ensure \nimationCap.ts\ reads from \window.__audit_last_summary.animMaxDurationS\

**Already Implemented**: Line 247 in \nimationCap.ts\ already reads runtime data

---

## Priority 3: Fix False Positives

### False Positive 1: Packaging Format

**Problem**: Reports valid ZIP files as "not ZIP/ADZ"

**V2 Check**: \const isZipMode = mode === 'zip';\

**V3 Check**: Same pattern used - investigate why failing

**Investigation Needed**:
1. Check \undle.mode\ value in V3
2. Verify ZIP MIME type detection
3. Test with various ZIP creation tools

**Fix Location**: \pp-V3/src/logic/creatives/common/packaging.ts\

### False Positive 2: Problematic Filenames

**Problem**: Flags hyphens and underscores in filenames (industry standard)

**V2 Check**: \const DISALLOWED_CHARS = /[<>:"\\|?*\\x00-\\x1F]/;\

**V3 Check**: Likely using overly strict pattern

**Fix Required**: Align with CM360's actual filename rules

**Fix Location**: \pp-V3/src/logic/creatives/common/filenames.ts\

---

## Priority 4: Add Metadata Panel

### Requirements

Display the following metadata in V3's preview panel header:

| Field | V2 Source | Display Format |
|-------|-----------|----------------|
| CM360 Preview Simulation | ExtendedPreview.tsx:370 | Badge/label |
| Base Directory | diagnostics.baseDir | \Base dir: ""\ or folder name |
| Dimensions Source | diagnostics.dimensionsSource | "Detected from: ad.size meta" |
| Enabler Source | diagnostics.enablerSource | "Enabler: cdn" or "studio" |

### V2 Implementation Reference

\\\	ypescript
// File: app-V2/src/ui/ExtendedPreview.tsx (lines 370-378)
<div className="metadata-panel">
  <div className="metadata-item">
    <strong>CM360 Preview Simulation</strong>
  </div>
  <div className="metadata-item">
    Base dir: <code>{diagnostics?.baseDir ?? ''}</code>
  </div>
  <div className="metadata-item">
    Dimensions: {diagnostics?.dimensionsSource ?? 'unknown'}
  </div>
  <div className="metadata-item">
    Enabler: <code>{diagnostics?.enablerSource ?? 'unknown'}</code>
  </div>
</div>
\\\

### V3 Implementation Plan

**File to Modify**: \pp-V3/src/components/preview/PreviewPanel.tsx\

**Integration Point**: Add metadata toggle button next to reload button (line ~320)

**Component Structure**:
\\\	ypescript
// Add state
const [showMetadata, setShowMetadata] = useState(false);

// Add button
<button 
  onClick={() => setShowMetadata(!showMetadata)}
  className="metadata-toggle"
>
  Metadata
</button>

// Add panel (conditional render)
{showMetadata && (
  <div className="preview-metadata">
    <div className="metadata-row">
      <span className="metadata-label">CM360 Preview Simulation</span>
    </div>
    <div className="metadata-row">
      <span className="metadata-label">Base dir:</span>
      <code>{diagnostics?.baseDir ?? ''}</code>
    </div>
    <div className="metadata-row">
      <span className="metadata-label">Dimensions:</span>
      <span>{diagnostics?.dimensionsSource ?? 'unknown'}</span>
    </div>
    <div className="metadata-row">
      <span className="metadata-label">Enabler:</span>
      <code>{diagnostics?.enablerSource ?? 'unknown'}</code>
    </div>
  </div>
)}
\\\

---

## Implementation Roadmap

### Sprint 1 (Immediate)
-  COMPLETE: Priority 1 - Enhanced Probe animation detection
-  Add Primary File and Size check
-  Add HTTPS Only check  
-  Fix Packaging Format false positive
-  Fix Filenames false positive

**Estimated Effort**: 4-6 hours
**Dependencies**: None
**Validation**: Upload Teresa, verify PASS status (not FAIL)

### Sprint 2 (Short-term)
-  Add All Files Referenced check
-  Add Runtime Errors tracking to Enhanced Probe
-  Add Metadata Panel component
-  Update Animation Cap check to use runtime data

**Estimated Effort**: 6-8 hours
**Dependencies**: Enhanced Probe modifications
**Validation**: Metadata visible, runtime errors captured

### Sprint 3 (Medium-term)
-  Add Weight Budgets check
-  Add load-phase categorization (initial/subload)
-  Display Initial KB and Polite KB in table
-  Add Initial Host Requests tracking

**Estimated Effort**: 8-10 hours
**Dependencies**: Enhanced Probe PerformanceObserver integration
**Validation**: IAB weight limits enforced correctly

### Sprint 4 (Long-term)
-  Add CPU Busy Budget check (Long Tasks API)
-  Complete PerformanceObserver integration
-  Full IAB compliance validation

**Estimated Effort**: 6-8 hours
**Dependencies**: Enhanced Probe Long Tasks API
**Validation**: CPU percentage tracking working

---

## Success Criteria

### Definition of Done

V3 repair is complete when:

1.  **Animation Detection**: Teresa shows 8.5s (not 0s)
2.  **Check Parity**: V3 has 18 priority checks (matching V2)
3.  **Teresa Validation**: Status PASS (not FAIL)
4.  **False Positives**: 0 false positive FAILs
5.  **Metadata Panel**: All 4 fields visible and accurate
6.  **Performance Tracking**: CPU %, network requests, weight budgets
7.  **Load Phases**: Initial KB and Polite KB displayed

### Validation Test Cases

| Test Case | V2 Expected | V3 Current | V3 Target |
|-----------|-------------|------------|-----------|
| Teresa 300x250 status | PASS | FAIL (2 false positives) | PASS |
| Teresa animation | 8.5s |  8.5s |  8.5s |
| Teresa priority checks | 18 | 10 | 18 |
| Teresa metadata panel | Visible | Missing | Visible |
| Teresa Initial KB | 2.7KB | N/A | 2.7KB |
| Teresa Polite KB | 81.1KB | N/A | 81.1KB |
| Teresa CPU % | 5% | N/A | 5% |
| Teresa requests | 1/0/0 | 0/0 | 1/0/0 |

---

## Technical Debt & Future Enhancements

### Phase 5 (Future)
- Port V2's 20 "Additional Checks" (non-priority)
- Add collapsible sections for advanced users
- Implement batch export improvements
- Add comparison mode (side-by-side V2/V3 results)

### Known Limitations
- Animation detection requires preview execution (can't detect from static analysis alone)
- CPU tracking requires browser support for Long Tasks API
- Network request categorization assumes standard load patterns
- Some checks may produce PENDING state during initial load

---

## Appendices

### A. File Inventory

**V2 Reference Files**:
- \pp-V2/src/logic/extendedChecks.ts\ (1099 lines) - All V2 checks
- \pp-V2/src/logic/priority.ts\ (91 lines) - Priority order definition
- \pp-V2/src/preview/buildIframeHtml.ts\ (2500+ lines) - Runtime probe
- \pp-V2/src/ui/ExtendedPreview.tsx\ (800+ lines) - Metadata panel

**V3 Modified Files**:
-  \pp-V3/src/ui/preview/utils/enhancedProbe.ts\ - Animation detection fixed
-  \pp-V3/src/components/preview/PreviewPanel.tsx\ - Needs metadata panel
-  \pp-V3/src/logic/creatives/index.ts\ - Register new checks

**V3 New Files Needed** (8 checks):
1. \pp-V3/src/logic/creatives/common/primaryAsset.ts\
2. \pp-V3/src/logic/creatives/common/assetReferences.ts\
3. \pp-V3/src/logic/creatives/html5/cm360/httpsOnly.ts\
4. \pp-V3/src/logic/creatives/html5/runtime/runtimeErrors.ts\
5. \pp-V3/src/logic/creatives/html5/iab/iabWeight.ts\
6. \pp-V3/src/logic/creatives/html5/iab/hostRequestsInitial.ts\
7. \pp-V3/src/logic/creatives/html5/iab/cpuBudgetInitial.ts\
8. (animation-cap runtime integration - update existing file)

### B. Testing Checklist

Before each commit:
-  Build succeeds (\
pm run build\)
-  No TypeScript errors
-  Upload Teresa creative
-  Preview renders successfully
-  Take screenshot for validation
-  Console logs show expected behavior
-  Commit with descriptive message and test evidence

### C. Resources

- V2 vs V3 Comparison: \V2-V3-TERESA-COMPARISON.md\
- Enhanced Probe Fix Commit: 441feb7
- Teresa Validation Screenshot: \.playwright-mcp/v3-enhanced-probe-fix-validation.png\
- V2 Teresa Baseline: \.playwright-mcp/v2-teresa-300x250-complete.png\

---

**Document Version**: 1.0
**Last Updated**: 2025-10-22 14:20
**Status**: Priority 1 complete, Priorities 2-4 pending
**Next Action**: Implement Primary File and Size check

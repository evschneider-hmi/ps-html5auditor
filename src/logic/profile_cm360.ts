import { BundleResult, ZipBundle } from './types';
import { Settings } from './profiles';

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface ProfileCheckItem {
  id: string;
  status: CheckStatus;
  message: string;
  evidence?: string;
  fix?: string;
}

export interface ProfileMetrics {
  zip_bytes: number;
  file_count: number;
  initial_kweight_bytes: number;
  subload_kweight_bytes: number;
  user_kweight_bytes: number;
  initial_host_requests: number;
  subload_host_requests: number;
  user_host_requests: number;
  total_runtime_requests: number;
  animation_duration_s: number;
  cpu_mainthread_busy_pct: number;
  detected_clicktags: string[];
  external_domains: string[];
  uses_storage_apis: string[];
  uses_document_write: boolean;
  has_meta_ad_size: boolean;
  border_detected: 'none' | 'explicit' | 'background-contrast';
}

export interface ProfileOutput {
  overall_status: CheckStatus;
  summary: string;
  cm360_checks: ProfileCheckItem[];
  iab_checks: ProfileCheckItem[];
  legacy_checks: ProfileCheckItem[];
  metrics: ProfileMetrics;
  notes: string[];
}

// Utility: gather text content of HTML/JS files for simple static scanning
function gatherTextFiles(bundle: ZipBundle): Array<{ path: string; text: string }>{
  const out: Array<{ path: string; text: string }> = [];
  for (const [path, bytes] of Object.entries(bundle.files)) {
    if (/\.(html?|js|css|svg)$/i.test(path)) {
      try { out.push({ path, text: new TextDecoder().decode(bytes) }); } catch {}
    }
  }
  return out;
}

function unique<T>(arr: T[]): T[] { return Array.from(new Set(arr)); }

export function buildProfileOutput(bundle: ZipBundle, result: BundleResult, settings: Settings): ProfileOutput {
  // Metrics
  const zipBytes = bundle.bytes?.length || 0;
  const fileCount = Object.keys(bundle.files).length;
  const toNumber = (value: unknown): number | undefined =>
    typeof value === 'number' && isFinite(value) ? Number(value) : undefined;
  const runtime = result.runtime || {};
  const runtimeSummary = (result.runtimeSummary as any) || {};
  const initialBytes = runtime.initialBytes ?? result.initialBytes ?? 0;
  const subloadBytes = runtime.subloadBytes ?? result.subloadBytes ?? result.subsequentBytes ?? Math.max(0, (runtime.totalBytes ?? result.totalBytes ?? 0) - (runtime.initialBytes ?? result.initialBytes ?? 0));
  const userBytes = runtime.userBytes ?? toNumber(runtimeSummary.userBytes) ?? 0;
  const initialReq = runtime.initialRequests ?? toNumber(runtimeSummary.initialRequests) ?? result.initialRequests ?? 0;
  const subloadReq = runtime.subloadRequests ?? toNumber(runtimeSummary.subloadRequests) ?? Math.max(((runtime.totalRequests ?? toNumber(runtimeSummary.totalRequests) ?? result.totalRequests ?? 0) - initialReq), 0);
  const userReq = runtime.userRequests ?? toNumber(runtimeSummary.userRequests) ?? 0;
  const totalRuntimeReq = runtime.totalRequests ?? toNumber(runtimeSummary.totalRequests) ?? result.totalRequests ?? (initialReq + subloadReq + userReq);
  const animationDuration = toNumber(runtimeSummary.animMaxDurationS) ?? 0;
  const longTasksMs = toNumber(runtimeSummary.longTasksMs) ?? 0;
  const cpuBusyPct = Math.round(Math.min(3000, Math.max(0, longTasksMs)) / 3000 * 100);
  const runtimeStorage: string[] = [];
  if ((toNumber(runtimeSummary.cookies) ?? 0) > 0) runtimeStorage.push('cookies');
  if ((toNumber(runtimeSummary.localStorage) ?? 0) > 0) runtimeStorage.push('localStorage');
  const hasMetaAdSize = !!result.adSize;

  const texts = gatherTextFiles(bundle);
  const textAll = texts.map(t => t.text).join('\n');
  const usesStorage: string[] = [];
  if (/\blocalStorage\b/.test(textAll)) usesStorage.push('localStorage');
  if (/\bsessionStorage\b/.test(textAll)) usesStorage.push('sessionStorage');
  if (/\bindexedDB\b/i.test(textAll)) usesStorage.push('indexedDB');
  if (/\bopenDatabase\b/.test(textAll)) usesStorage.push('openDatabase');
  const usesDocWrite = /\bdocument\.write\s*\(/i.test(textAll) || ((toNumber(runtimeSummary.documentWrites) ?? 0) > 0);
  const clickTagMatches = Array.from(textAll.matchAll(/\b(clicktag|clickTag|clickTAG)\b\s*=\s*(["']?)([^\n;\"']{0,512})/gi)).map(m => `${m[1]}=${m[3]}`);

  // External domains from references
  const externalDomains = unique((result.references || []).filter(r => r.external).map(r => {
    try { const u = new URL(r.url, 'https://example.com'); return u.hostname; } catch { return ''; }
  }).filter(Boolean));

  // CM360 checks (hard + recommended)
  const cm360: ProfileCheckItem[] = [];
  // pkg-format: must be zip/adz — assumed by app; pass
  cm360.push({ id: 'pkg-format', status: 'PASS', message: 'Upload provided as .zip' });
  // entry-html: exactly one entry; others (if any) must be referenced by it
  const htmlFiles = Object.keys(bundle.files).filter(p => /\.(html?)$/i.test(p));
  if (htmlFiles.length === 0) {
    cm360.push({ id: 'entry-html', status: 'FAIL', message: 'No HTML entry found', evidence: '0 HTML files in bundle' });
  } else if (htmlFiles.length === 1) {
    cm360.push({ id: 'entry-html', status: 'PASS', message: 'Single HTML entry present' });
  } else {
    const referencedHtml = new Set((result.references||[]).filter(r => /\.(html?)$/i.test(r.url || r.normalized || '') && r.inZip && r.normalized).map(r => (r.normalized||'').toLowerCase()));
    const prim = result.primary?.path?.toLowerCase();
    const unreferenced = htmlFiles.filter(h => h.toLowerCase() !== prim && !referencedHtml.has(h.toLowerCase()));
    if (unreferenced.length) cm360.push({ id: 'entry-html', status: 'FAIL', message: `Multiple HTMLs not referenced by primary`, evidence: unreferenced.join(', ') });
    else cm360.push({ id: 'entry-html', status: 'PASS', message: 'Multiple HTMLs but all referenced by primary' });
  }
  // file-limits: ≤ 100 files AND ≤ 10 MB
  const tooManyFiles = fileCount > 100;
  const tooLargeZip = zipBytes > 10 * 1024 * 1024;
  cm360.push({ id: 'file-limits', status: (tooManyFiles || tooLargeZip) ? 'FAIL' : 'PASS', message: `Files: ${fileCount}/100; Zipped: ${(zipBytes/1024/1024).toFixed(2)}MB / 10MB` });
  // allowed-ext list
  const allowed = new Set(['.html','.htm','.js','.css','.jpg','.jpeg','.gif','.png','.json','.xml','.svg','.eot','.otf','.ttf','.woff','.woff2']);
  const badExt: string[] = [];
  for (const p of Object.keys(bundle.files)) {
    const m = p.toLowerCase().match(/\.[a-z0-9]+$/);
    const ext = m ? m[0] : '';
    if (!allowed.has(ext)) badExt.push(p);
  }
  cm360.push({ id: 'allowed-ext', status: badExt.length ? 'FAIL':'PASS', message: badExt.length ? `${badExt.length} file(s) with disallowed extension` : 'All file extensions allowed', evidence: badExt.slice(0,10).join(', ') });
  // iframe-safe: detect references to window.top/parent.document
  const iframeUnsafe = /\bwindow\.(top|parent)\b/.test(textAll) || /\bparent\.(document|frames)\b/.test(textAll) || /\btop\.(document|frames)\b/.test(textAll);
  cm360.push({ id: 'iframe-safe', status: iframeUnsafe ? 'FAIL':'PASS', message: iframeUnsafe ? 'References to window.top/parent detected' : 'No cross-frame DOM reliance detected' });
  
  // clicktag: enhanced check with hardcoded URL detection
  const hasClickTag = /\b(clicktag|clickTag|clickTAG)\b/i.test(textAll);
  const clickTagAssignMatch = textAll.match(/\b(clicktag|clickTag|clickTAG)\s*=\s*["']([^"']+)["']/i);
  const hasClickTagUsage = /window\.open\s*\(\s*clickTag/i.test(textAll) || 
                           /location\.href\s*=\s*clickTag/i.test(textAll) ||
                           /location\.assign\s*\(\s*clickTag/i.test(textAll) ||
                           /location\.replace\s*\(\s*clickTag/i.test(textAll);
  const hasHardcodedUrls = /window\.open\s*\(\s*["']https?:\/\//i.test(textAll) ||
                           /location\.href\s*=\s*["']https?:\/\//i.test(textAll) ||
                           /location\.assign\s*\(\s*["']https?:\/\//i.test(textAll) ||
                           /location\.replace\s*\(\s*["']https?:\/\//i.test(textAll) ||
                           /<a[^>]+href=["']https?:\/\//i.test(textAll);
  
  let clickTagStatus: CheckStatus = 'FAIL';
  let clickTagMessage = 'clickTag not detected';
  
  if (hasClickTag && hasClickTagUsage && !hasHardcodedUrls) {
    // Case 1: clickTag present AND used for redirect (PASS)
    clickTagStatus = 'PASS';
    clickTagMessage = 'clickTag detected and used for redirect';
    if (clickTagAssignMatch && clickTagAssignMatch[2]) {
      const url = clickTagAssignMatch[2].trim();
      console.log('[CLICKTAG DEBUG] clickTagAssignMatch[2]:', clickTagAssignMatch[2]);
      console.log('[CLICKTAG DEBUG] url after trim:', url);
      console.log('[CLICKTAG DEBUG] url check:', url && url !== '');
      // Only add the URL bullet if the URL is not empty
      if (url && url !== '') {
        const displayUrl = url.length > 50 ? url.slice(0, 50) + '...' : url;
        clickTagMessage += `; URL temporarily set to "${displayUrl}"`;
        console.log('[CLICKTAG DEBUG] Final message:', clickTagMessage);
      }
    }
  } else if (hasClickTag && !hasClickTagUsage && hasHardcodedUrls) {
    // Case 2: clickTag present but NOT used (hardcoded URL instead)
    clickTagStatus = 'FAIL';
    clickTagMessage = 'clickTag detected but not used for redirect; hardcoded URLs found';
  } else if (hasClickTag && hasClickTagUsage && hasHardcodedUrls) {
    // Case 3: Mixed usage
    clickTagStatus = 'FAIL';
    clickTagMessage = 'clickTag used but also has hardcoded URLs';
  } else if (!hasClickTag && hasHardcodedUrls) {
    // Case 4: No clickTag but has hardcoded URLs
    clickTagStatus = 'FAIL';
    clickTagMessage = 'clickTag not detected; hardcoded URLs found';
  } else if (!hasClickTag && !hasHardcodedUrls) {
    // Case 5: No clickTag and no redirect mechanism
    clickTagStatus = 'FAIL';
    clickTagMessage = 'clickTag not detected; no redirect mechanism found';
  } else {
    // Case 6: clickTag present but not used at all
    clickTagStatus = 'FAIL';
    clickTagMessage = 'clickTag detected but not used';
  }
  
  cm360.push({ id: 'clicktag', status: clickTagStatus, message: clickTagMessage });
  
  // no-webstorage
  cm360.push({ id: 'no-webstorage', status: usesStorage.length ? 'FAIL':'PASS', message: usesStorage.length ? `Uses storage APIs: ${usesStorage.join(', ')}` : 'No storage API usage detected' });
  // https-only: from existing checks; derive from references
  const mixed = (result.references||[]).some(r => r.external && r.secure === false);
  cm360.push({ id: 'https-only', status: mixed ? 'FAIL':'PASS', message: mixed ? 'Non-HTTPS external resource(s) detected' : 'All external resources HTTPS' });
  // Recommended
  cm360.push({ id: 'meta-ad-size', status: hasMetaAdSize ? 'PASS':'WARN', message: hasMetaAdSize ? 'meta ad.size present' : 'Consider adding <meta name="ad.size">' });
  const backupImage = Object.keys(bundle.files).some(p => /(^|\/)backup[-_]?\w*\.(png|jpe?g|gif)$/i.test(p));
  cm360.push({ id: 'no-backup-in-zip', status: backupImage ? 'WARN':'PASS', message: backupImage ? 'Backup image detected in ZIP; upload separately' : 'No explicit backup image detected' });
  const hasAbsolute = (result.references||[]).some(r => /^\//.test(r.url || ''));
  cm360.push({ id: 'relative-refs', status: hasAbsolute ? 'WARN':'PASS', message: hasAbsolute ? 'Absolute path reference(s) detected' : 'References appear relative' });
  cm360.push({ id: 'no-document-write', status: usesDocWrite ? 'WARN':'PASS', message: usesDocWrite ? 'document.write detected' : 'No document.write usage' });

  // IAB checks
  const iab: ProfileCheckItem[] = [];
  // host-requests-initial: cap 10 (per provided rule) using initialRequests
  const reqCap = 10;
  iab.push({ id: 'host-requests-initial', status: initialReq > reqCap ? 'FAIL' : 'PASS', message: `Initial requests: ${initialReq} / ${reqCap}` });
  if (toNumber(runtimeSummary.longTasksMs) !== undefined) {
    const pct = cpuBusyPct;
    const longDetail = Math.round(longTasksMs);
    iab.push({
      id: 'cpu-budget',
      status: pct > 30 ? 'FAIL' : 'PASS',
      message: `Main thread busy ~${pct}% (long tasks ${longDetail} ms / 3000 ms)`
    });
  } else {
    iab.push({ id: 'cpu-budget', status: 'PASS', message: 'CPU budget check not collected in this environment' });
  }
  if (
    toNumber(runtimeSummary.animMaxDurationS) !== undefined ||
    toNumber(runtimeSummary.animMaxLoops) !== undefined ||
    runtimeSummary.animInfinite
  ) {
    const maxDur = Math.max(0, toNumber(runtimeSummary.animMaxDurationS) ?? 0);
    const loopsRaw = toNumber(runtimeSummary.animMaxLoops);
    const infinite = !!runtimeSummary.animInfinite;
    const loops = infinite ? Infinity : (loopsRaw ?? 1);
    const violates = (infinite || loops > 3) && maxDur > 15;
    const loopLabel = infinite ? 'infinite' : `${Math.round(loops)}`;
    iab.push({
      id: 'animation-cap',
      status: violates ? 'FAIL' : 'PASS',
      message: `Max animation ~${maxDur.toFixed(2)}s, loops ${loopLabel}`
    });
  } else {
    iab.push({ id: 'animation-cap', status: 'PASS', message: 'Animation duration/loops not collected in this environment' });
  }
  // border — static detection TBD; leaving WARN only if we can heuristically detect lack of border on non-white bg; default PASS with note
  iab.push({ id: 'border', status: 'PASS', message: 'Border/keyline check not collected in this environment' });

  // Legacy checks — map a subset of existing findings for diagnostic continuity
  const legacy: ProfileCheckItem[] = [];
  const legacyMap: Record<string, string> = {
    'assetReferences': 'invalid-url-ref',
    'orphanAssets': 'orphaned-assets',
    'packaging': 'bad-filenames', // not a perfect map; kept for parity placeholder
    'gwdEnvironment': 'gwd-env-check',
  };
  for (const f of result.findings || []) {
    const mapped = legacyMap[f.id];
    if (!mapped) continue;
    legacy.push({ id: mapped, status: f.severity as CheckStatus, message: f.messages.join('; '), evidence: (f.offenders||[]).map(o=>o.path).slice(0,5).join(', ') });
  }

  // Precedence policy for overall
  const anyCm360Fail = cm360.some(c => c.status === 'FAIL');
  const anyIabFail = iab.some(c => c.status === 'FAIL');
  const anyWarn = cm360.concat(iab).concat(legacy).some(c => c.status === 'WARN');
  const overall: CheckStatus = anyCm360Fail ? 'FAIL' : (anyIabFail ? 'FAIL' : (anyWarn ? 'WARN' : 'PASS'));
  const summary = overall === 'PASS' ? 'All critical checks passed' : overall === 'WARN' ? 'Non-blocking issues detected' : 'Blocking violations detected';

  const metrics: ProfileMetrics = {
    zip_bytes: zipBytes,
    file_count: fileCount,
    initial_kweight_bytes: initialBytes,
    subload_kweight_bytes: subloadBytes,
    user_kweight_bytes: userBytes,
    initial_host_requests: initialReq,
    subload_host_requests: subloadReq,
    user_host_requests: userReq,
    total_runtime_requests: totalRuntimeReq,
    animation_duration_s: animationDuration,
    cpu_mainthread_busy_pct: cpuBusyPct,
    detected_clicktags: unique(clickTagMatches).slice(0, 10),
    external_domains: externalDomains,
    uses_storage_apis: unique([...usesStorage, ...runtimeStorage]),
    uses_document_write: usesDocWrite,
    has_meta_ad_size: hasMetaAdSize,
    border_detected: 'none'
  };

  const notes: string[] = [];
  if (iab.some(c => c.message.includes('not collected'))) notes.push('Some IAB runtime metrics are not collected in this local tool.');

  return { overall_status: overall, summary, cm360_checks: cm360, iab_checks: iab, legacy_checks: legacy, metrics, notes };
}

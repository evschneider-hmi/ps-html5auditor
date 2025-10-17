import type { BundleResult, Finding } from '../../../src/logic/types';
import type { ExtBundle } from '../state/useStoreExt';

type CheckStatus = 'PASS' | 'WARN' | 'FAIL';

export interface Cm360ReportJson {
  overall_status: CheckStatus;
  summary: string;
  cm360_checks: Array<CheckEntry>;
  iab_checks: Array<CheckEntry>;
  legacy_checks: Array<CheckEntry>;
  metrics: {
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
  };
  notes: string[];
}

export interface CheckEntry {
  id: string;
  status: CheckStatus;
  message: string;
  evidence: string;
  fix: string;
}

// CM360 hard-gate checks (packaging/serving). If these fail, overall FAIL.
const CM360_IDS = new Set<string>([
  // Existing core gates
  'packaging',
  'primaryAsset',
  'assetReferences',
  'externalResources',
  'httpsOnly',
  'clickTags',
  'systemArtifacts',
  'indexFile',
  'bad-filenames',
  'creativeRendered',
  'docWrite',
  'syntaxErrors',
  // New CM360 hard requirement IDs (Chunk 2)
  'pkg-format',
  'entry-html',
  'file-limits',
  'allowed-ext',
  'iframe-safe',
  'clicktag',
  'no-webstorage',
  'gwd-env-check',
  'hardcoded-click',
  // CM360 recommended (WARN) items are still CM360 category
  'meta-ad-size',
  'no-backup-in-zip',
  'relative-refs',
  'no-document-write',
]);

// IAB performance thresholds (including global rules from Chunk 4)
const IAB_IDS = new Set<string>([
  'iabWeight',
  'iabRequests',
  'host-requests-initial',
  'cpu-budget',
  'animation-cap',
  'border',
]);

function mapFindingToEntry(f: Finding): CheckEntry {
  const evidence = f.offenders?.[0]
    ? [f.offenders[0].path, f.offenders[0].detail, typeof f.offenders[0].line === 'number' ? `line ${f.offenders[0].line}` : '']
        .filter(Boolean)
        .join(' — ')
    : '';
  return {
    id: f.id,
    status: f.severity as CheckStatus,
    message: (f.messages || []).join(' | '),
    evidence,
    fix: '',
  };
}

function worst(a: CheckStatus, b: CheckStatus): CheckStatus {
  const order: Record<CheckStatus, number> = { PASS: 0, WARN: 1, FAIL: 2 };
  return order[a] >= order[b] ? a : b;
}

function extractDomains(res: BundleResult): string[] {
  const set = new Set<string>();
  for (const r of res.references || []) {
    if (!r.external) continue;
    try { const u = new URL(r.url, 'https://x'); set.add(u.hostname.toLowerCase()); } catch {}
  }
  return Array.from(set).sort();
}

function parseAnimSeconds(findings: Finding[]): number {
  const f = findings.find(ff => ff.id === 'animDuration');
  if (!f) return 0;
  const text = (f.messages || []).join(' ');
  const m = text.match(/(~|≈)?\s*(\d+)\s*ms/i);
  if (m) {
    const ms = parseFloat(m[2]);
    if (isFinite(ms)) return Math.round(ms) / 1000;
  }
  return 0;
}

function detectBorder(findings: Finding[]): 'none' | 'explicit' | 'background-contrast' {
  const f = findings.find(ff => ff.id === 'creativeBorder');
  if (!f) return 'none';
  if (f.severity === 'PASS') {
    const msg = (f.messages || []).join(' ').toLowerCase();
    if (msg.includes('edge lines') || msg.includes('background')) return 'background-contrast';
    return 'explicit';
  }
  return 'none';
}

function extractClickTags(findings: Finding[]): string[] {
  const f = findings.find(ff => ff.id === 'clickTags');
  if (!f) return [];
  const vals = f.offenders?.filter(o => (o.detail || '').toLowerCase().includes('clicktag')).map(o => String(o.detail)) || [];
  return Array.from(new Set(vals));
}

export function buildCm360ReportJson(res: BundleResult, bundle?: ExtBundle): Cm360ReportJson {
  const findings: Finding[] = res.findings || [];

  const cm360: Finding[] = findings.filter(f => CM360_IDS.has(f.id));
  const iab: Finding[] = findings.filter(f => IAB_IDS.has(f.id));
  const legacy: Finding[] = findings.filter(f => !CM360_IDS.has(f.id) && !IAB_IDS.has(f.id));

  // Overall status: CM360 and IAB are hard pass/fail; Legacy failures contribute at most WARN per precedence policy.
  const cm360Worst = cm360.reduce<CheckStatus>((acc, f) => worst(acc, f.severity as CheckStatus), 'PASS');
  const iabWorst = iab.reduce<CheckStatus>((acc, f) => worst(acc, f.severity as CheckStatus), 'PASS');
  const legacyWorstRaw = legacy.reduce<CheckStatus>((acc, f) => worst(acc, f.severity as CheckStatus), 'PASS');
  const legacyWorst: CheckStatus = legacyWorstRaw === 'FAIL' ? 'WARN' : legacyWorstRaw; // cap at WARN
  const overall = [cm360Worst, iabWorst, legacyWorst].reduce(worst, 'PASS');

  const zipBytes = res.zippedBytes ?? 0;
  const fileCount = bundle ? Object.keys(bundle.files || {}).length : 0;
  const toNumber = (value: any): number | undefined =>
    typeof value === 'number' && isFinite(value) ? Number(value) : undefined;
  const runtime = res.runtime || {};
  const runtimeSummary = (res.runtimeSummary as any) || {};
  const lastSummary = (window as any).__audit_last_summary || {};
  const meta: any = Object.keys(runtimeSummary || {}).length ? runtimeSummary : lastSummary;
  const rtInitialBytes = runtime.initialBytes ?? toNumber(meta.initialBytes);
  const rtSubloadBytes = runtime.subloadBytes ?? toNumber(meta.subloadBytes);
  const rtUserBytes = runtime.userBytes ?? toNumber(meta.userBytes);
  const rtTotalBytes = runtime.totalBytes ?? toNumber(meta.totalBytes);
  const rtInitialReq = runtime.initialRequests ?? toNumber(meta.initialRequests);
  const rtSubloadReq = runtime.subloadRequests ?? toNumber(meta.subloadRequests);
  const rtUserReq = runtime.userRequests ?? toNumber(meta.userRequests);
  const rtTotalReq = runtime.totalRequests ?? toNumber(meta.totalRequests);
  const initialBytes = rtInitialBytes ?? (res.initialBytes ?? 0);
  const subloadBytes = rtSubloadBytes ?? (res.subloadBytes ?? res.subsequentBytes ?? Math.max(0, (res.totalBytes || 0) - initialBytes));
  const userBytes = rtUserBytes ?? (res.userBytes ?? 0);
  const initialReq = rtInitialReq ?? (res.initialRequests ?? 0);
  const subloadReq = rtSubloadReq ?? (res.subloadRequests ?? Math.max(((rtTotalReq ?? res.totalRequests ?? 0) - initialReq), 0));
  const userReq = rtUserReq ?? (res.userRequests ?? 0);
  const totalRuntimeReq = rtTotalReq ?? (runtime.totalRequests ?? res.totalRequests ?? (initialReq + subloadReq + userReq));

  // CPU busy percent based on long tasks in first 3s (if captured)
  const longMs = typeof meta.longTasksMs === 'number' ? Math.max(0, Math.min(3000, meta.longTasksMs)) : 0;
  const cpuBusyPct = Math.round((longMs / 3000) * 100);

  const metrics = {
    zip_bytes: zipBytes,
    file_count: fileCount,
    initial_kweight_bytes: Math.max(0, initialBytes),
    subload_kweight_bytes: Math.max(0, subloadBytes),
    user_kweight_bytes: Math.max(0, userBytes),
    initial_host_requests: initialReq,
    subload_host_requests: subloadReq,
    user_host_requests: userReq,
    total_runtime_requests: totalRuntimeReq,
    animation_duration_s: parseAnimSeconds(findings),
    cpu_mainthread_busy_pct: cpuBusyPct,
    detected_clicktags: extractClickTags(findings),
    external_domains: extractDomains(res),
    uses_storage_apis: [
      ...(meta.cookies > 0 ? ['cookies'] : []),
      ...(meta.localStorage > 0 ? ['localStorage'] : []),
    ],
    uses_document_write: (meta.documentWrites || 0) > 0,
    has_meta_ad_size: !!(res.adSize && typeof res.adSize.width === 'number' && typeof res.adSize.height === 'number'),
    border_detected: detectBorder(findings),
  } as Cm360ReportJson['metrics'];

  const cm360_checks = cm360.map(mapFindingToEntry);
  const iab_checks = iab.map(mapFindingToEntry);
  const legacy_checks = legacy.map(mapFindingToEntry);

  const summary = `${overall}: ${res.summary?.fails ?? 0} fail(s), ${res.summary?.warns ?? 0} warn(s). Size ${res.adSize ? res.adSize.width + 'x' + res.adSize.height : 'n/a'}, zip ${(zipBytes/1024).toFixed(1)}KB.`;

  return {
    overall_status: overall,
    summary,
    cm360_checks,
    iab_checks,
    legacy_checks,
    metrics,
    notes: [],
  };
}

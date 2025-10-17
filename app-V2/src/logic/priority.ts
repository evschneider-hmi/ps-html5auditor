import type { Finding } from '../../../src/logic/types';

// Centralized Priority (required) checks used for gating overall status and the Priority list
// Keep this as the single source of truth to avoid drift between components.

// Ordered by ad ops relevance (top = most relevant)
// 1) Packaging/ingestion musts
// 2) Exit plumbing (clicks)
// 3) Safety/compliance
// 4) Weight/requests/perf caps
// 5) Presentation heuristics
export const PRIORITY_ORDER: ReadonlyArray<string> = [
  // Packaging/ingestion
  'pkg-format',
  'entry-html',
  // Exit plumbing surfaced within top three
  'clicktag',
  // Remaining packaging/ingestion safety
  'allowed-ext',
  'file-limits',
  'primaryAsset',
  'assetReferences',
  // Safety/compliance
  'httpsOnly',
  'iframe-safe',
  'no-webstorage',
  'gwd-env-check',
  'hardcoded-click',
  'bad-filenames',
  'syntaxErrors',
  'creativeRendered',
  // Performance / IAB caps
  'iabWeight',
  'host-requests-initial',
  'cpu-budget',
  'animation-cap',
  // Presentation
  'border',
];

export const PRIORITY_IDS: ReadonlySet<string> = new Set<string>(PRIORITY_ORDER);

const PRIORITY_CANONICAL: Record<string, string> = {
  systemArtifacts: 'allowed-ext',
};

type Severity = 'PASS' | 'WARN' | 'FAIL';

const SEVERITY_ORDER: Record<Severity, number> = { PASS: 0, WARN: 1, FAIL: 2 };

function worstSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_ORDER[a] >= SEVERITY_ORDER[b] ? a : b;
}

export function canonicalPriorityId(id: string): string {
  return PRIORITY_CANONICAL[id] ?? id;
}

export function isPriorityCheck(id: string | undefined | null): boolean {
  if (!id) return false;
  return PRIORITY_IDS.has(canonicalPriorityId(id));
}

export function mergePriorityFindings(findings: ReadonlyArray<Finding>): Finding[] {
  const map = new Map<string, Finding>();
  for (const finding of findings) {
    if (!finding) continue;
    const canonical = canonicalPriorityId(finding.id);
    if (!PRIORITY_IDS.has(canonical)) continue;
    const cloned: Finding = {
      ...finding,
      id: canonical,
      messages: Array.isArray(finding.messages) ? [...finding.messages] : [],
      offenders: Array.isArray(finding.offenders) ? [...finding.offenders] : [],
    };
    const existing = map.get(canonical);
    if (!existing) {
      map.set(canonical, cloned);
      continue;
    }
    map.set(canonical, {
      ...existing,
      title: cloned.title || existing.title,
      severity: worstSeverity(existing.severity as Severity, cloned.severity as Severity),
      messages: Array.from(
        new Set([...(existing.messages || []), ...(cloned.messages || [])])
      ),
      offenders: [...(existing.offenders || []), ...(cloned.offenders || [])],
    });
  }

  return PRIORITY_ORDER
    .map((id) => map.get(id))
    .filter((f): f is Finding => !!f);
}

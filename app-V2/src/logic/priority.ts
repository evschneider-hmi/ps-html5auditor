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
  'bad-filenames',
  'systemArtifacts',
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

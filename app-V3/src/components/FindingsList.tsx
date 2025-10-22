import React, { useState } from 'react';
import type { Finding } from '../logic/types';
import { mergePriorityFindings, isPriorityCheck } from '../logic/priority';

interface FindingsListProps {
  findings: Finding[];
  creativeName: string;
  onClose: () => void;
}

// Tooltip component for section help
const SectionHelp: React.FC<{
  explanation: string;
  why: string;
}> = ({ explanation, why }) => {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          padding: 0,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--text-secondary)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'help',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title="Section info"
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: '50%',
            left: '110%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            pointerEvents: 'auto',
            whiteSpace: 'pre-wrap',
            maxWidth: 420,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--text)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {explanation}
          {'\n\n'}
          {`Why it matters: ${why}`}
        </div>
      )}
    </span>
  );
};

// Spec badge data
type SourceKind = 'IAB' | 'CM360' | 'H5';

const CM360_IDS_UI = new Set<string>([
  'packaging',
  'primaryAsset',
  'assetReferences',
  'externalResources',
  'httpsOnly',
  'clickTags',
  'systemArtifacts',
  'indexFile',
  'creativeRendered',
  'docWrite',
  'syntaxErrors',
  'pkg-format',
  'entry-html',
  'file-limits',
  'allowed-ext',
  'iframe-safe',
  'clicktag',
  'no-webstorage',
  'gwd-env-check',
  'no-backup-in-zip',
  'relative-refs',
  'no-document-write',
  'bad-filenames',
]);

const IAB_IDS_UI = new Set<string>([
  'iabWeight',
  'iabRequests',
  'host-requests-initial',
  'cpu-budget',
  'animation-cap',
  'border',
]);

function sourcesFor(id: string): SourceKind[] {
  const isIab = IAB_IDS_UI.has(id);
  const isCm = CM360_IDS_UI.has(id);
  if (isIab && isCm) return ['IAB', 'CM360'];
  if (isIab) return ['IAB'];
  if (isCm) return ['CM360'];
  return ['H5'];
}

const SPEC_TEXT: Record<string, string> = {
  // IAB
  iabWeight:
    'IAB: Ad weight budgets (initial/polite compressed, zip package) per configured settings. Exceeding caps fails.',
  'host-requests-initial': 'IAB: Initial host requests ≤ 10.',
  'cpu-budget':
    'IAB: Main-thread busy ≤ 30% in first 3 seconds (Long Tasks ≤ 900ms).',
  'animation-cap':
    'IAB: Animation length ≤ 15s or ≤ 3 loops (infinite loops not allowed).',
  border: 'IAB: A visible 1px border or keyline is required.',

  // CM360 (hard + recommended)
  packaging: 'CM360: ZIP packaging, no nested archives or OS artifacts.',
  primaryAsset: 'CM360: One primary HTML with declared size (ad.size meta).',
  assetReferences: 'CM360: All referenced files must exist in the ZIP.',
  externalResources: 'CM360: No disallowed off-domain references.',
  httpsOnly: 'CM360: All external requests must use HTTPS.',
  clickTags:
    'CM360: Click-through configured via clickTag/exit API; no hard-coded destinations.',
  systemArtifacts:
    'CM360: No OS/system artifacts in ZIP (reported via Allowed File Types priority).',
  indexFile:
    'CM360: Root entry HTML present (name is flexible; one entry required).',
  creativeRendered: 'CM360: Creative must render successfully.',
  docWrite: 'CM360: Do not use document.write in runtime.',
  syntaxErrors: 'CM360: No uncaught runtime errors during load.',
  'pkg-format': 'CM360: Upload is ZIP/ADZ; no nested .zip/.adz.',
  'entry-html':
    'CM360: Exactly one root entry HTML; all other files referenced by it.',
  'file-limits': 'CM360: ≤ 100 files and ≤ 10 MB upload (compressed).',
  'allowed-ext':
    'CM360: Only typical creative extensions allowed (html, js, css, images, fonts, etc.) and no OS metadata artifacts (e.g., __MACOSX, Thumbs.db, .DS_Store).',
  'iframe-safe':
    'CM360: No cross-frame DOM access (parent/top/document.domain).',
  clicktag:
    'CM360: Global clickTag present and used via window.open(clickTag).',
  'no-webstorage':
    'CM360: Do not reference Web Storage APIs (localStorage/sessionStorage), IndexedDB, or WebSQL (openDatabase).',
  'gwd-env-check':
    'CM360: Ensure creatives built in Google Web Designer were created using the correct environment.',
  'no-backup-in-zip':
    'CM360 (recommended): Do not include backup image in the ZIP.',
  'relative-refs':
    'CM360 (recommended): Use relative paths for packaged assets.',
  'no-document-write': 'CM360 (recommended): Avoid document.write usage.',

  // Legacy H5 validator parity
  'invalid-url-ref':
    'H5: Broken/invalid references and absolute non-packaged paths are disallowed.',
  'orphaned-assets':
    'H5: Files not referenced by the entry file should be removed.',
  'bad-filenames':
    'CM360: Filenames should avoid disallowed characters, and the ZIP filename must include the creative dimensions (e.g., 300x250).',
  'invalid-markup':
    'H5: HTML/SVG must parse without errors; CSS braces should be balanced.',

  // Heuristic/diagnostic H5 checks
  minified: 'H5: JS/CSS should be minified in production.',
  cssEmbedded:
    'H5: Inline CSS is allowed but keep minimal; prefer external CSS.',
  dialogs: 'H5: Avoid alert/confirm/prompt in creatives.',
  domContentLoaded: 'H5: DOMContentLoaded target < 1000ms.',
  timeToRender: 'H5: Time to first render < 500ms is recommended.',
  measurement: 'H5: Minimize tracker/measurement hosts.',
  html5lib:
    'H5: Library use (CreateJS/GSAP/jQuery/etc.) flagged for awareness.',
  imagesOptimized:
    'H5: Optimize large images (PNG → JPEG/WebP where reasonable).',
  hostedSize: 'H5: Total uncompressed size should meet partner limits.',
  jquery: 'H5: Consider avoiding jQuery in lightweight placements.',
  iframes: 'H5: Avoid nested iframes in creatives.',
  networkDynamic: 'H5: Avoid unexpected runtime network calls.',
  heavyAdRisk:
    'H5: Large initial size or CPU jitter may trigger heavy-ad intervention.',
  memoryUsage: 'H5: Peak JS heap < 10 MB on test hardware.',
  hostedCount: 'H5: Keep file count practical for QA and packaging.',
  video: 'H5: Video assets require appropriate spec handling.',
  timing: 'H5: Reported timing metrics from preview.',
  imageMeta: 'H5: Image metadata diagnostics (dimensions/size).',
  videoMeta: 'H5: Video metadata diagnostics.',
  audioMeta: 'H5: Audio metadata diagnostics.',
  runtimeIframes: 'H5: Avoid nested iframes in creatives.',
};

// ==================================================================
// CHECK DESCRIPTIONS (for HelpIcon tooltips)
// ==================================================================
const DESCRIPTIONS: Record<string, string> = {
  packaging:
    'Validates ZIP packaging: single root creative (no loose siblings), no nested archives, no empty folders, and a required index.html.\n\nWhy it matters: nested archives, missing entry points, or extra folders break CM360 or IAB ingestion workflows and cause instant rejections.',

  clicktag:
    'Detects global clickTag variable (case-insensitive) required by CM360, The Trade Desk, and many other platforms.\n\nWhy it matters: CM360 dynamically injects clickTag at runtime. If your code does not check for it, the creative will not be clickable and will fail QA or auto-rejections.',

  size:
    'ZIP size (in bytes) matches platform limits.\n\nWhy it matters: exceeding size caps prevents upload or triggers auto-reject in trafficking systems.',

  filenaming:
    'Filenames and naming: avoid disallowed characters and ensure the ZIP file name includes the creative dimensions (e.g., 300x250).\n\nWhy it matters: problematic names break ad servers and missing size tokens in the ZIP make trafficking harder.',

  subdirectories:
    'Limit folder depth to 2 or 3 levels.\n\nWhy it matters: deeply nested paths complicate QA automation and trigger warnings in some strict validators.',

  dimensions:
    'Declared dimensions match placement.\n\nWhy it matters: size mismatches trigger mandatory QA rework and delay delivery.',

  networkOnLoad:
    'No external calls in initial render.\n\nWhy it matters: dynamic loads breach data policies and complicate ad review approvals.',

  externalScripts:
    'Avoid 3rd-party script hosts.\n\nWhy it matters: many supply partners ban unapproved domains and such calls trigger compliance holds.',

  hardcodedClickUrl:
    'Hard-coded absolute clickthrough URL(s) in code/markup.\n\nWhy it matters: bypassing macros removes tracking and causes trafficking rejections.',

  'hardcoded-click':
    'Hard-coded absolute clickthrough URL(s) in code/markup.\n\nWhy it matters: bypassing macros removes tracking and causes trafficking rejections.',

  animDuration:
    'Heuristic scan of CSS animation/transition durations.\n\nWhy it matters: overly long motion breaks brand rules and triggers QA escalations.',

  cssEmbedded:
    'Inline CSS usage (style tags/attributes).\n\nWhy it matters: heavy inline styling inflates HTML size and complicates dynamic QA edits.',

  minified:
    'Heuristic detection of minified JS/CSS files.\n\nWhy it matters: unminified code increases payload and can push creatives over weight limits.',

  dialogs:
    'alert/confirm/prompt usage inside creative.\n\nWhy it matters: disruptive dialogs violate platform policies and will be blocked.',

  cookies:
    'document.cookie writes detected in runtime.\n\nWhy it matters: unmanaged cookies can violate privacy policies and trigger compliance holds.',

  localStorage:
    'localStorage writes detected in runtime.\n\nWhy it matters: storage usage may be disallowed by partners and requires disclosure.',

  'no-webstorage':
    'No Web Storage/DB APIs: avoid localStorage, sessionStorage, IndexedDB, or WebSQL (openDatabase).\n\nWhy it matters: storage access is commonly disallowed and can trigger policy violations or rejections.',

  timing:
    'DOMContentLoaded, time to render, frames observed.\n\nWhy it matters: slow render metrics predict viewability issues and heavy-ad interventions.',

  timeToRender:
    'Time to first visible render of the ad; < 500 ms is recommended.\n\nWhy it matters: delayed first paint hurts viewability guarantees.',

  measurement:
    'Known analytics/measurement host references.\n\nWhy it matters: stacking trackers raises privacy concerns and can be blocked by supply partners.',

  domContentLoaded:
    'DOMContentLoaded budget.\n\nWhy it matters: exceeding ~1s signals heavy creatives that partners can reject.',

  html5lib:
    'Common creative libraries detected (CreateJS, GSAP, Pixi, jQuery).\n\nWhy it matters: knowing libraries helps validate licensing and optimization plans.',

  video:
    'Video asset(s) in bundle.\n\nWhy it matters: video placements enforce extra specs, so trafficking must attach the correct serving settings.',

  iframes:
    'Iframe tags in markup.\n\nWhy it matters: creatives are served inside secure iframes/SafeFrame; nested frames are often disallowed and can break integrations.',

  'iframe-safe':
    'Iframe-safe behavior: no attempts to access parent/top windows or document.domain at runtime.\n\nWhy it matters: cross-frame access is blocked in secure placements and will break or be flagged by CM360.',

  imagesOptimized:
    'Potentially large images to optimize (heuristic).\n\nWhy it matters: oversized imagery drives weight over limits and slows load times.',

  indexFile:
    'index.html presence at root.\n\nWhy it matters: This is the de facto standard entry point for HTML5 creatives. CM360 typically expects index.html for ZIP ingestion. The Trade Desk lets you choose a primary file, but index.html is recommended for automation. IAB specs do not strictly mandate index.html, but most ad servers and workflows assume it.',

  hostedSize:
    'Total uncompressed size of files.\n\nWhy it matters: large payloads exceed ad server caps and may be auto-throttled.',

  cpuUsage:
    'Long tasks total (first 3s) budget.\n\nWhy it matters: high CPU usage triggers heavy-ad rules and throttles delivery.',

  memoryUsage:
    'Peak JS heap usage budget.\n\nWhy it matters: memory spikes crash host pages and get creatives blacklisted.',

  perfHeuristics:
    'Advisory signal from preview-only measurements (CPU jitter, JS heap).\n\nWhy it matters: sustained main‑thread blocking or memory spikes can trigger heavy‑ad throttling and hurt viewability. Treat as a hint; confirm on standardized hardware if gating.',

  syntaxErrors:
    'Uncaught runtime errors during preview.\n\nWhy it matters: crashing scripts show blanks and result in automatic takedowns.',

  docWrite:
    'document.write calls used.\n\nWhy it matters: document.write is blocked in most modern ad slots, preventing any render.',

  jquery:
    'jQuery presence detected.\n\nWhy it matters: heavy frameworks inflate payloads and are banned in many lightweight placements.',

  backup:
    'Backup image presence (heuristic).\n\nWhy it matters: without a backup image, fallback delivery fails and impressions are lost.',

  hostedCount:
    'Count of files in bundle.\n\nWhy it matters: excessive files complicate QA and can push weight budgets over limits.',

  fileTypes:
    'File types outside a conservative allowlist.\n\nWhy it matters: unusual file types trip security scans and block approvals.',

  creativeBorder:
    'Presence of border styles (heuristic).\n\nWhy it matters: missing borders violate spec requirements for publisher separation.',

  creativeRendered:
    'Render activity observed during preview.\n\nWhy it matters: confirming render ensures the creative will not serve blank in production.',

  networkDynamic:
    'Runtime fetch/XHR requests detected.\n\nWhy it matters: unexpected calls breach data policies and raise monitoring alerts.',

  heavyAdRisk:
    'Risk indicator from initial size/CPU jitter.\n\nWhy it matters: creatives flagged heavy are throttled or unloaded by Chrome and major DSPs.',

  imageMeta:
    'Image metadata (dimensions/size).\n\nWhy it matters: quick audit confirms assets meet spec prior to trafficking.',

  videoMeta:
    'Video metadata (dimensions/duration/size).\n\nWhy it matters: ensures motion assets align with placement length and resolution requirements.',

  audioMeta:
    'Audio metadata (duration/size).\n\nWhy it matters: audio assets must meet rich-media specs to avoid rejection.',

  'host-requests-initial':
    'Initial Host Requests is the number of files the ad loads immediately from the entry HTML (HTML, CSS, JS, images, fonts, etc.). The IAB guideline is to keep this count at 10 or fewer.\n\nWhy it matters: While an ad with more than 10 calls can still run, many exchanges and publishers enforce this guideline through QA tools and policies. Exceeding it often leads to slower initial load and a higher risk of warnings or rejection.',

  'cpu-budget':
    'Keep main-thread busy time ≤ 30% in the first 3s (via Long Tasks) per IAB guidance.\n\nWhy it matters: excessive main-thread blocking triggers heavy-ad throttling.',

  'animation-cap':
    'Animation must be ≤ 15s total or ≤ 3 loops under the IAB display standard.\n\nWhy it matters: long/looping motion violates common IAB/publisher specs.',

  border:
    'A visible 1px border/keyline must be present per IAB display guidance.\n\nWhy it matters: borders visually separate ads from page content per spec.',

  'invalid-url-ref':
    'Broken or invalid URL references (including absolute non-packaged paths).\n\nWhy it matters: missing or malformed URLs break loads and cause blanks.',

  'orphaned-assets':
    'Files in the ZIP that are not referenced by the entry HTML.\n\nWhy it matters: unused files inflate weight and complicate QA.',

  'bad-filenames':
    'Filenames and naming: avoid disallowed characters and ensure the ZIP file name includes the creative dimensions (e.g., 300x250).\n\nWhy it matters: problematic names break ad servers and missing size tokens in the ZIP make trafficking harder.',

  'invalid-markup':
    'Heuristic HTML/CSS/SVG syntax validation.\n\nWhy it matters: invalid markup can render inconsistently or be blocked by sanitizers.',

  'gwd-env-check':
    'Detects Google Web Designer environment artifacts.\n\nWhy it matters: leftover environment code can conflict with host pages.',
};

// ==================================================================
// HELP ICON COMPONENT (inline after title, before badges)
// ==================================================================
const HelpIcon: React.FC<{
  checkId: string;
  group?: 'priority' | 'optional';
}> = ({ checkId, group = 'optional' }) => {
  const [open, setOpen] = React.useState(false);

  const base = DESCRIPTIONS[checkId] || '';

  function soften(text: string): string {
    return text
      .replace(/\bmust\b/gi, 'should')
      .replace(/\bis required\b/gi, 'is typically expected')
      .replace(/\brequires\b/gi, 'typically requires')
      .replace(/\bwill be\b/gi, 'can be')
      .replace(/\bwill\b/gi, 'can')
      .replace(/\bare rejected\b/gi, 'may be rejected')
      .replace(/\bare blocked\b/gi, 'may be blocked')
      .replace(/\bare disallowed\b/gi, 'may not be allowed')
      .replace(/\bviolates\b/gi, 'may violate')
      .replace(/\bresults in\b/gi, 'can result in');
  }

  const marker = 'why it matters:';
  let explanation = base;
  let why = '';

  if (base) {
    const loc = base.toLowerCase().indexOf(marker);
    if (loc >= 0) {
      explanation = base.slice(0, loc).trim();
      why = base.slice(loc + marker.length).trim();
    }
  }

  if (!explanation) {
    const spec = SPEC_TEXT[checkId];
    explanation = spec ? spec.replace(/^.*?:\s*/, '') : checkId;
  }

  if (!why) {
    why =
      group === 'optional'
        ? 'Improving this can enhance reliability or performance and reduce the chance of policy friction.'
        : 'Issues here can cause delivery problems or lead to platform rejections.';
  }

  if (group === 'optional' && why) {
    why = soften(why);
  }

  const desc = [explanation, `Why it matters: ${why}`].filter(Boolean).join('\n\n');

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`Help for ${checkId}`}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          padding: 0,
          border: '1px solid var(--border)',
          background: 'var(--card)',
          color: 'var(--text-secondary)',
          cursor: 'help',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ?
      </button>

      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            top: '50%',
            right: '110%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            pointerEvents: 'auto',
            whiteSpace: 'pre-wrap',
            width: 480,
            maxWidth: 480,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: 16,
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
          }}
        >
          {desc}
        </div>
      )}
    </span>
  );
};

const SpecBadges: React.FC<{ checkId: string }> = ({ checkId }) => {
  const sources = sourcesFor(checkId);
  const baseText = SPEC_TEXT[checkId] || 'No spec text available.';

  const stripIabPrefix = (text: string): string =>
    text.replace(/^IAB(?:\s*\([^)]*\))?:\s*/i, '');

  function tooltipFor(source: SourceKind): string {
    if (source === 'CM360') {
      const isIab = IAB_IDS_UI.has(checkId);
      if (isIab) {
        const iabText = stripIabPrefix(baseText);
        return `CM360: Aligns with IAB for this check.\n\n${iabText}`;
      }
      const clean = stripIabPrefix(baseText);
      return clean.startsWith('CM360:') ? clean : `CM360: ${clean}`;
    }
    if (source === 'IAB') {
      return /^IAB(?:\s*\([^)]*\))?:\s*/i.test(baseText) ? baseText : `IAB: ${baseText}`;
    }
    return baseText;
  }

  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '1px 6px',
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    border: '1px solid var(--border)',
    color: '#6b7280',
    background: 'rgba(255,255,255,0.02)',
    cursor: 'help',
  };

  const colorFor = (s: SourceKind) =>
    s === 'IAB' ? '#0ea5e9' : s === 'CM360' ? '#22c55e' : '#a855f7';

  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 8 }}>
      {sources.map((s, i) => (
        <span
          key={i}
          title={tooltipFor(s)}
          style={{ ...base, borderColor: colorFor(s), color: colorFor(s) }}
        >
          {s}
        </span>
      ))}
    </span>
  );
};

export const FindingsList: React.FC<FindingsListProps> = ({ findings, creativeName, onClose }) => {
  const [severityFilter, setSeverityFilter] = useState<Set<'FAIL' | 'WARN' | 'PASS'>>(
    new Set(['FAIL', 'WARN', 'PASS'])
  );
  const [filterOpen, setFilterOpen] = useState(false);

  // Only show priority checks (CM360/IAB required)
  // Non-priority checks are still run and stored in metadata for export/debugging
  const priorityFindings = mergePriorityFindings(findings);

  const filteredPriority = priorityFindings.filter(f => severityFilter.has(f.severity as 'FAIL' | 'WARN' | 'PASS'));

  const badge = (severity: string) => {
    const color = severity === 'FAIL' ? '#ef4444' : severity === 'WARN' ? '#f59e0b' : '#10b981';
    const icon = severity === 'FAIL' ? '✕' : severity === 'WARN' ? '△' : '✓';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: color,
          color: '#fff',
          fontSize: severity === 'WARN' ? 14 : 12,
          fontWeight: severity === 'WARN' ? 400 : 700,
        }}
      >
        {icon}
      </span>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--bg)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Priority Checks</h2>
          <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 4 }}>({filteredPriority.length})</span>
          <SectionHelp
            explanation="Checks that are necessary for the creative to function and pass common platform policies."
            why="Fixing failures here helps ensure reliable rendering and acceptance across placements.\n\nNote: WARNs here do not impact overall PASS/FAIL status."
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Filter button */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              style={{
                width: 24,
                height: 24,
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                borderRadius: 4,
                background: filterOpen ? 'var(--primary)' : 'var(--bg)',
                color: filterOpen ? '#fff' : 'var(--text)',
                cursor: 'pointer',
              }}
              title="Filter by severity"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 4h18l-7 8v6l-4 2v-8L3 4z" />
              </svg>
            </button>

            {filterOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 28,
                  zIndex: 20,
                  padding: 8,
                  minWidth: 160,
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Show severities
                </div>
                {(['FAIL', 'WARN', 'PASS'] as const).map((sv) => (
                  <label
                    key={sv}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      padding: '4px 2px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={severityFilter.has(sv)}
                      onChange={(e) => {
                        setSeverityFilter((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(sv);
                          else next.delete(sv);
                          return next;
                        });
                      }}
                    />
                    <span>{sv}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close preview"
          >
            ×
          </button>
        </div>
      </div>

      {/* Creative name */}
      <div
        style={{
          padding: '8px 16px',
          fontSize: 13,
          color: 'var(--muted)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {creativeName}
      </div>

      {/* Priority Findings list */}
      <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gap: 12 }}>
          {filteredPriority.map((f) => (
            <div
              key={f.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 12,
                backgroundColor: 'var(--bg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                {badge(f.severity)}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                      {f.title}
                    </h3>
                    <HelpIcon checkId={f.id} group="priority" />
                    <SpecBadges checkId={f.id} />
                  </div>
                </div>
              </div>

              {/* Messages */}
              {f.messages.length > 0 && (
                <ul
                  style={{
                    margin: '6px 0 0 28px',
                    padding: 0,
                    listStyle: 'disc',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  {f.messages.map((m: string, i: number) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              )}

              {/* Offenders */}
              {f.offenders.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary
                    style={{
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'var(--muted)',
                      marginLeft: 28,
                    }}
                  >
                    {f.severity === 'PASS' ? 'Details' : 'Offenders'} ({f.offenders.length})
                  </summary>
                  <ul
                    style={{
                      margin: '6px 0 0 28px',
                      padding: 0,
                      listStyle: 'disc',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    {f.offenders.map((o: any, i: number) => (
                      <li key={i}>
                        <code
                          style={{
                            fontSize: 10,
                            backgroundColor: 'rgba(0,0,0,0.05)',
                            padding: '1px 4px',
                            borderRadius: 3,
                          }}
                        >
                          {o.path}
                        </code>
                        {o.detail && <span> — {o.detail}</span>}
                        {typeof o.line === 'number' && <span> (line {o.line})</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>

        {filteredPriority.length === 0 && (
          <div
            style={{
              padding: 16,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            No priority findings match the current filter
          </div>
        )}

        {/* Additional Checks section removed - non-priority checks still run and stored in metadata for export */}
      </div>
    </div>
  );
};

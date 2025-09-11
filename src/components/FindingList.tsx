import React, { useState, useMemo } from 'react';
import { useAppStore } from '../state/useStore';

const passIcon = (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-pass text-white text-xs" aria-label="pass">✓</span>
);
const failIcon = (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-fail text-white text-xs" aria-label="fail">✕</span>
);
const warnIcon = (
  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-warn text-white text-xs" aria-label="warn">!</span>
);

export const FindingList: React.FC = () => {
  const { results, selectedBundleId } = useAppStore(s => ({ results: s.results, selectedBundleId: s.selectedBundleId }));
  const bundle = results.find(r => r.bundleId === selectedBundleId) || results[0];
  const [filter, setFilter] = useState<'ALL' | 'FAIL' | 'WARN' | 'PASS'>('ALL');

  if (!bundle) return <div className="text-sm text-gray-500">No validation results yet.</div>;

  const counts = useMemo(() => {
    return bundle.findings.reduce((acc: Record<string, number>, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [bundle.findings]);

  const filtered = filter === 'ALL' ? bundle.findings : bundle.findings.filter(f => f.severity === filter);

  return (
    <div aria-live="polite">
      <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter findings by severity">
        <FilterButton label={`All (${bundle.findings.length})`} active={filter === 'ALL'} onClick={() => setFilter('ALL')} />
        <FilterButton label={`Fail (${counts.FAIL || 0})`} active={filter === 'FAIL'} onClick={() => setFilter('FAIL')} variant="fail" />
        <FilterButton label={`Warn (${counts.WARN || 0})`} active={filter === 'WARN'} onClick={() => setFilter('WARN')} variant="warn" />
        <FilterButton label={`Pass (${counts.PASS || 0})`} active={filter === 'PASS'} onClick={() => setFilter('PASS')} variant="pass" />
      </div>
      <div className="space-y-3">
        {filtered.map(f => (
          <div key={f.id} className="border rounded p-3 bg-white shadow-sm relative">
            <div className="flex items-start gap-3">
              {f.severity === 'FAIL' ? failIcon : f.severity === 'WARN' ? warnIcon : passIcon}
              <div className="flex-1">
                <div className="font-medium text-sm flex items-start gap-2">
                  <span>{f.title}</span>
                  <StatusLabel severity={f.severity} />
                </div>
                <ul className="mt-1 text-xs list-disc ml-5 space-y-1">
                  {f.messages.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
                {f.offenders.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-800">Offenders ({f.offenders.length})</summary>
                    <ul className="mt-1 text-xs font-mono bg-gray-50 p-2 rounded max-h-40 overflow-auto">
                      {f.offenders.map((o, i) => (
                        <li key={i} className="py-0.5">
                          <span>{o.path}</span>{o.detail && <span className="text-gray-500"> — {o.detail}</span>}
                          {typeof o.line === 'number' && <span className="text-gray-400"> (line {o.line})</span>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
            <div className="absolute top-2 right-2"><HelpIcon checkId={f.id} /></div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-xs text-gray-500 border rounded p-3 bg-white">No findings for selected filter.</div>
        )}
      </div>
    </div>
  );
};

const FilterButton: React.FC<{ label: string; active: boolean; onClick: () => void; variant?: 'fail' | 'warn' | 'pass' }> = ({ label, active, onClick, variant }) => {
  const base = 'px-3 py-1 rounded text-xs font-medium focus-ring transition';
  const color = active
    ? variant === 'fail'
      ? 'bg-fail text-white'
      : variant === 'warn'
        ? 'bg-warn text-white'
        : variant === 'pass'
          ? 'bg-pass text-white'
          : 'bg-gray-800 text-white'
    : 'bg-gray-200 text-gray-700 hover:bg-gray-300';
  return (
    <button type="button" aria-pressed={active} className={`${base} ${color}`} onClick={onClick}>{label}</button>
  );
};

const StatusLabel: React.FC<{ severity: string }> = ({ severity }) => {
  const color = severity === 'FAIL' ? 'text-fail' : severity === 'WARN' ? 'text-warn' : 'text-pass';
  return <span className={`text-[10px] uppercase tracking-wide ${color}`}>{severity}</span>;
};

// Descriptions (mirrors excel report reference data; keep in sync if edited)
const CHECK_DESCRIPTIONS: Record<string, string> = {
  packaging: 'Validates ZIP packaging: no nested archives or disallowed file types.',
  primaryAsset: 'Detects main HTML file & required ad.size meta width/height.',
  assetReferences: 'Ensures all HTML/CSS referenced assets exist in the bundle.',
  orphanAssets: 'Lists files not referenced by primary asset dependency graph.',
  externalResources: 'Flags external network references outside allow‑list.',
  httpsOnly: 'Requires all external references to use HTTPS.',
  clickTags: 'Detects clickTag variables / exit APIs and hard-coded navigations.',
  gwdEnvironment: 'Identifies Google Web Designer runtime artifacts.',
  iabWeight: 'Compares initial/polite & compressed weights to 2025 IAB thresholds.',
  iabRequests: 'Counts initial load asset requests vs guideline cap.',
  systemArtifacts: 'OS metadata (Thumbs.db, .DS_Store) / __MACOSX entries.',
  hardcodedClickUrl: 'Hard-coded absolute clickthrough URL(s) in code/markup.'
};

const HelpIcon: React.FC<{ checkId: string }> = ({ checkId }) => {
  const [open, setOpen] = useState(false);
  const desc = CHECK_DESCRIPTIONS[checkId] || 'No description available.';
  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={`Help for ${checkId}`}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] flex items-center justify-center hover:bg-gray-300 focus-ring"
      >?</button>
      {open && (
        <div role="tooltip" className="absolute z-10 left-1/2 -translate-x-1/2 mt-1 w-56 text-[10px] bg-gray-900 text-white p-2 rounded shadow-lg">
          {desc}
        </div>
      )}
    </span>
  );
};

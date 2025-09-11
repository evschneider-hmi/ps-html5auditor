import React, { useEffect } from 'react';
import { useAppStore } from '../state/useStore';
import { runChecks, summarize } from '../logic/checks';
import { discoverPrimary } from '../logic/discovery';
import { parsePrimary } from '../logic/parse';
import { buildReport } from '../logic/report';
import { buildWorkbook, downloadWorkbook } from '../logic/excelReport';
import { worst } from '../logic/severity';
import { FindingList } from './FindingList';
import { PreviewPane } from './PreviewPane';

export const ResultsTable: React.FC = () => {
  const { bundles, results, settings, setResults, selectBundle, selectedBundleId } = useAppStore((s: any) => ({
    bundles: s.bundles, results: s.results, settings: s.settings, setResults: s.setResults, selectBundle: s.selectBundle, selectedBundleId: s.selectedBundleId
  }));
  const inferBundleSize = (id: string): number => {
    const b = bundles.find((bb: any) => bb.id === id);
    if (!b) return 0;
    try { return (Object.values(b.files) as Uint8Array[]).reduce((acc, u) => acc + u.byteLength, 0); } catch { return 0; }
  };

  async function process(): Promise<void> {
    if (bundles.length === 0) {
      alert('No bundles uploaded. Please add at least one ZIP first.');
      return;
    }
    const bundleResults: any[] = [];
    for (const b of bundles) {
      const discovery = discoverPrimary(b);
      const primary = discovery.primary;
      let adSize: { width: number; height: number } | undefined; let references: any[] = [];
      if (primary) {
        const parsed = parsePrimary(b, primary);
        adSize = parsed.adSize;
        references = parsed.references;
      }
      const totalBytes = (Object.values(b.files) as Uint8Array[]).reduce((acc, u) => acc + u.byteLength, 0);
      // Heuristic: initial assets = primary HTML + directly referenced assets from HTML (excluding deep chain) & CSS referenced by HTML.
      // Simplification: treat any reference discovered (flat) as initial; future refinement could parse JS dynamic loads.
      const referencedPaths = new Set<string>();
      for (const r of references) {
        if (r.inZip && r.normalized) referencedPaths.add(r.normalized);
      }
      const primaryPath = primary?.path?.toLowerCase();
      if (primaryPath) referencedPaths.add(primaryPath);
      let initialBytes = 0;
      for (const p of referencedPaths) {
        const real = b.lowerCaseIndex[p];
        if (real && b.files[real]) initialBytes += b.files[real].byteLength;
      }
      if (initialBytes === 0) initialBytes = totalBytes; // fallback
      const subsequentBytes = Math.max(0, totalBytes - initialBytes);
      const initialRequests = referencedPaths.size || (primary ? 1 : 0);
      const totalRequests = referencedPaths.size; // currently same heuristic
      const partial: any = {
        bundleId: b.id,
        bundleName: b.name,
        primary,
        adSize,
        references,
        totalBytes,
        initialBytes,
        subsequentBytes,
        zippedBytes: b.bytes.length,
        initialRequests,
        totalRequests,
        findings: [],
        summary: { status: 'PASS', totalFindings: 0, fails: 0, warns: 0, pass: 0, orphanCount: 0, missingAssetCount: 0 }
      };
      const findings = runChecks(b, partial as any, settings);
      partial.findings = findings;
      const sum = summarize(findings);
      partial.summary = { ...partial.summary, status: sum.status, fails: sum.fails, warns: sum.warns, pass: sum.pass, totalFindings: findings.length };
      bundleResults.push(partial);
    }
    setResults(bundleResults as any);
  }

  // Auto-run validation whenever bundles change (so uploads appear immediately)
  useEffect(() => {
    if (bundles.length === 0) return;
    // Only rerun if bundle count differs from results count (avoids infinite loop)
    if (results.length !== bundles.length) {
      void process();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundles.length]);

  function downloadScope(scope: 'all' | 'failed') {
    if (bundles.length === 0) {
      alert('No bundles to report on. Upload a ZIP first.');
      return;
    }
    const wb = buildWorkbook(results as any, scope);
    const ts = new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
    downloadWorkbook(wb, scope === 'all' ? `all-bundles-report-${ts}.xlsx` : `failed-bundles-report-${ts}.xlsx`);
  }

  return (
    <div className="mt-6">
      <div className="flex gap-3 mb-2">
        <button className="px-3 py-1 bg-gray-800 text-white rounded disabled:opacity-50" onClick={process} disabled={bundles.length===0}>Run Validation</button>
        {results.length > 0 ? (
          <>
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => downloadScope('all')}>Download All Bundle Report</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => downloadScope('failed')}>Download Failed Bundle Report</button>
          </>
        ) : (
          <>
            <button className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" onClick={() => downloadScope('all')} disabled={bundles.length===0}>Download All Bundle Report</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50" onClick={() => downloadScope('failed')} disabled={bundles.length===0}>Download Failed Bundle Report</button>
          </>
        )}
      </div>
      {bundles.length > 0 && (
        <div className="text-xs text-gray-600 mb-3" aria-live="polite">
          Uploaded bundles: {bundles.map((b: any) => b.name).join(', ')}
        </div>
      )}
  <table className="w-full text-sm border" aria-label="Validation results table">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 text-left">Bundle</th>
            <th className="p-2 text-center">Status</th>
            <th className="p-2 text-center">Primary HTML</th>
            <th className="p-2 text-center">Dimensions</th>
            <th className="p-2 text-center" title="Sum of uncompressed bytes of all files in the bundle">Total Weight (Uncompressed)</th>
            <th className="p-2 text-center">Findings</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r: any) => (
            <tr key={r.bundleId} className={`border-t cursor-pointer hover:bg-gray-50 ${selectedBundleId === r.bundleId ? 'bg-blue-50' : ''}`} onClick={() => selectBundle(r.bundleId)}>
              <td className="p-2 font-medium">{r.bundleName}</td>
              <td className="p-2 text-center"><StatusBadge status={r.summary.status} /></td>
              <td className="p-2 text-center">{r.primary?.path || '-'}</td>
              <td className="p-2 text-center">{r.adSize ? `${r.adSize.width}x${r.adSize.height}` : '-'}</td>
              <td className="p-2 text-center">{formatBytes(typeof r.totalBytes === 'number' ? r.totalBytes : inferBundleSize(r.bundleId))}</td>
              {(() => { const fails = r.findings.filter((f: any)=>f.severity==='FAIL').length; const warns = r.findings.filter((f: any)=>f.severity==='WARN').length; const nonPass = fails + warns + r.findings.filter((f:any)=>f.severity==='INFO').length; return (
                <td className="p-2 text-center" title={`${fails} fail${fails!==1?'s':''} / ${warns} warning${warns!==1?'s':''}`}
                    aria-label={`This bundle has ${fails} fail${fails!==1?'s':''} and ${warns} warning${warns!==1?'s':''}`}>
                  {nonPass} issues
                </td>
              ); })()}
            </tr>
          ))}
        </tbody>
      </table>
      {results.length > 0 && (
    <div className="mt-6 grid md:grid-cols-2 gap-6" aria-label="Bundle details section">
          <div>
            <div className="flex items-start justify-between mb-2 gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">All Checks</h2>
                {settings.iabStandardDate && (
                  <span className="text-[10px] text-gray-500" title="Applied IAB HTML5 display creative guideline date">
                    IAB Standard: {settings.iabStandardDate}
                  </span>
                )}
              </div>
              {results.length > 1 && (
                <div className="flex flex-col items-end" aria-label="Bundle selection">
                  <label htmlFor="bundleSelect" className="text-[11px] font-semibold text-gray-700 mb-1 select-none">Choose Bundle</label>
                  <div className="relative">
                    <select
                      id="bundleSelect"
                      className="border rounded px-1 py-0.5 text-xs bg-white w-44 max-w-[11rem] overflow-hidden text-ellipsis whitespace-nowrap pr-5 appearance-none"
                      value={selectedBundleId || results[0].bundleId}
                      onChange={e => selectBundle(e.target.value)}
                      title={results.find((r: any)=> (selectedBundleId || results[0].bundleId) === r.bundleId)?.bundleName}
                    >
                      {results.map((r:any) => (
                        <option key={r.bundleId} value={r.bundleId} title={r.bundleName}>{r.bundleName}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-gray-500">▼</span>
                  </div>
                </div>
              )}
            </div>
            <FindingList />
          </div>
          <div>
      <h2 className="text-sm font-semibold mb-2">Preview</h2>
      <PreviewPane />
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const color = status === 'FAIL' ? 'bg-fail' : status === 'WARN' ? 'bg-warn' : 'bg-pass';
  return <span className={`text-white text-xs px-2 py-1 rounded ${color}`}>{status}</span>;
};

function formatBytes(bytes: number): string {
  if (typeof bytes !== 'number' || !isFinite(bytes) || isNaN(bytes) || bytes < 0) return '0 KB';
  if (bytes === 0) return '0 KB';
  const thresh = 1024;
  if (bytes < thresh) return bytes + ' B';
  const units = ['KB','MB','GB'];
  let u = -1;
  let val = bytes;
  do { val /= thresh; ++u; } while (val >= thresh && u < units.length - 1);
  return (Math.round(val * 10) / 10) + ' ' + units[u];
}

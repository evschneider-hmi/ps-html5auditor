import { ZipBundle, BundleResult, Finding } from '../types';
import { Settings } from '../profiles';
import { checkPrimaryAsset } from './primaryAsset';
import { checkAssetReferences } from './assetReferences';
import { Severity, worst } from '../severity';
import { checkExternalResources } from './externalResources';
import { checkHttpsOnly } from './httpsOnly';
import { checkIabWeight } from './iabWeight';
import { checkSystemArtifacts } from './systemArtifacts';

export function runChecks(bundle: ZipBundle, partial: BundleResult, settings: Settings): Finding[] {
  const findings: Finding[] = [];
  findings.push(checkPrimaryAsset(partial, settings));
  findings.push(checkAssetReferences(partial, settings));
  findings.push(checkExternalResources(partial, settings));
  findings.push(checkHttpsOnly(partial, settings));
  const profile = settings.profile ?? 'IAB';
  if (profile === 'IAB') {
    findings.push(checkIabWeight(bundle, partial, settings));
  }
  findings.push(checkSystemArtifacts(bundle, settings));
  return findings;
}

export function summarize(findings: Finding[]): { status: Severity; fails: number; warns: number; pass: number } {
  let status: Severity = 'PASS';
  let fails = 0, warns = 0, pass = 0;
  for (const f of findings) {
    status = worst(status, f.severity);
    if (f.severity === 'FAIL') fails++; else if (f.severity === 'WARN') warns++; else pass++;
  }
  return { status, fails, warns, pass };
}

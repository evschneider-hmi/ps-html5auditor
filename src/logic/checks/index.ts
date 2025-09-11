import { ZipBundle, BundleResult, Finding } from '../types';
import { Settings } from '../profiles';
import { checkPackaging } from './packaging';
import { checkPrimaryAsset } from './primaryAsset';
import { checkAssetReferences } from './assetReferences';
import { checkOrphanAssets } from './orphanAssets';
import { Severity, worst } from '../severity';
import { checkExternalResources } from './externalResources';
import { checkHttpsOnly } from './httpsOnly';
import { checkClickTags } from './clickTags';
import { checkGwdEnvironment } from './gwdEnvironment';
import { checkIabWeight } from './iabWeight';
import { checkIabRequests } from './iabRequests';
import { checkSystemArtifacts } from './systemArtifacts';
import { checkHardcodedClickUrl } from './hardcodedClickUrl';

export function runChecks(bundle: ZipBundle, partial: BundleResult, settings: Settings): Finding[] {
  const findings: Finding[] = [];
  findings.push(checkPackaging(bundle, settings));
  findings.push(checkPrimaryAsset(partial, settings));
  findings.push(checkAssetReferences(partial, settings));
  findings.push(checkOrphanAssets(bundle, partial, settings));
  findings.push(checkExternalResources(partial, settings));
  findings.push(checkHttpsOnly(partial, settings));
  findings.push(checkClickTags(bundle, partial, settings));
  findings.push(checkGwdEnvironment(bundle, partial, settings));
  findings.push(checkIabWeight(bundle, partial, settings));
  findings.push(checkIabRequests(partial, settings));
  findings.push(checkSystemArtifacts(bundle, settings));
  findings.push(checkHardcodedClickUrl(bundle, settings));
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

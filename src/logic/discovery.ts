import { ZipBundle, PrimaryAsset } from './types';

export interface DiscoveryResult {
  primary?: PrimaryAsset;
  htmlCandidates: string[];
  messages: string[];
}

export function discoverPrimary(bundle: ZipBundle): DiscoveryResult {
  const htmlFiles = Object.keys(bundle.files).filter(f => f.toLowerCase().endsWith('.html'));
  const messages: string[] = [];
  if (htmlFiles.length === 0) {
    messages.push('No HTML files present');
    return { htmlCandidates: [], messages };
  }
  if (htmlFiles.length === 1) {
    return { primary: { path: htmlFiles[0] }, htmlCandidates: htmlFiles, messages };
  }
  // Prefer file containing meta name="ad.size"
  const adSizeMatches: string[] = [];
  for (const path of htmlFiles) {
    const text = new TextDecoder().decode(bundle.files[path]);
    if (/meta[^>]+name=["']ad\.size["']/i.test(text)) {
      adSizeMatches.push(path);
    }
  }
  if (adSizeMatches.length === 1) {
    return { primary: { path: adSizeMatches[0] }, htmlCandidates: htmlFiles, messages };
  }
  if (adSizeMatches.length > 1) {
    // choose shortest depth
    adSizeMatches.sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);
    const chosen = adSizeMatches[0];
    messages.push('Multiple HTMLs with ad.size meta; chose ' + chosen);
    return { primary: { path: chosen }, htmlCandidates: htmlFiles, messages };
  }
  messages.push('Multiple HTML files without ad.size meta; ambiguous');
  return { htmlCandidates: htmlFiles, messages };
}

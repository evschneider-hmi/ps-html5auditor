import { ZipBundle, PrimaryAsset } from './types';

export interface DiscoveryResult {
  primary?: PrimaryAsset;
  htmlCandidates: string[];
  messages: string[];
}

export function discoverPrimary(bundle: ZipBundle): DiscoveryResult {
  // Include .html and .htm (case-insensitive)
  const htmlFiles = Object.keys(bundle.files).filter(f => /\.(html?)$/i.test(f));
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
  // Fallback: choose a reasonable primary even without ad.size
  const chosen = chooseFallbackHTML(htmlFiles);
  messages.push('Multiple HTML files without ad.size meta; chose fallback ' + chosen);
  return { primary: { path: chosen }, htmlCandidates: htmlFiles, messages };
}

function chooseFallbackHTML(paths: string[]): string {
  // Prefer index.html/htm at shallowest depth, else fewest path segments, else shortest name
  const byDepth = (p: string) => p.split('/').length;
  const isIndex = (p: string) => /\/(index\.html?)$/i.test('/' + p);
  const indexCands = paths.filter(isIndex);
  if (indexCands.length) {
    indexCands.sort((a, b) => byDepth(a) - byDepth(b) || a.length - b.length);
    return indexCands[0];
  }
  const sorted = [...paths].sort((a, b) => byDepth(a) - byDepth(b) || a.length - b.length);
  return sorted[0];
}

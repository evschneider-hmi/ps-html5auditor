import { ZipBundle, Finding } from '../types';
import { Settings } from '../profiles';

// Detect common unwanted system artifacts that should not ship in creative ZIPs.
// Failing these enforces clean packaging discipline.
const BLOCKED_FILENAMES = new Set([
  'thumbs.db', // Windows
  '.ds_store'  // macOS
]);

export function checkSystemArtifacts(bundle: ZipBundle, _settings: Settings): Finding {
  const offenders: { path: string; detail?: string }[] = [];
  let hasMacResourceDir = false;
  for (const path of Object.keys(bundle.files)) {
    const lower = path.toLowerCase();
    if (lower.startsWith('__macosx/')) {
      hasMacResourceDir = true;
      offenders.push({ path, detail: 'macOS resource fork directory entry' });
      continue;
    }
    const base = lower.split('/').pop() || lower;
    if (BLOCKED_FILENAMES.has(base)) {
      offenders.push({ path, detail: 'OS metadata file' });
    }
  }
  if (offenders.length === 0) {
    return {
      id: 'systemArtifacts',
      title: 'System Artifacts',
      severity: 'PASS',
      messages: ['No disallowed OS metadata artifacts found'],
      offenders: []
    };
  }
  const messages: string[] = [];
  if (hasMacResourceDir) messages.push('Contains __MACOSX resource fork entries');
  if (offenders.some(o => /thumbs\.db$/i.test(o.path))) messages.push('Contains Thumbs.db');
  if (offenders.some(o => /\.ds_store$/i.test(o.path))) messages.push('Contains .DS_Store');
  if (messages.length === 0) messages.push('Contains disallowed system artifact files');
  return {
    id: 'systemArtifacts',
    title: 'System Artifacts',
    severity: 'FAIL',
    messages,
    offenders
  };
}

import { BundleResult, Finding } from '../types';
import { Settings } from '../profiles';

// 2025 IAB guideline (assumed) initial request cap. If spec refines, adjust here.
const DEFAULT_INITIAL_REQUEST_CAP = 15;

export function checkIabRequests(partial: BundleResult, settings: Settings): Finding {
  const cap = DEFAULT_INITIAL_REQUEST_CAP;
  const initial = partial.initialRequests ?? 0;
  const total = partial.totalRequests ?? initial;
  let severity: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
  const messages: string[] = [];
  if (initial > cap) {
    severity = 'FAIL';
    messages.push(`Initial requests: ${initial}; exceeds cap of ${cap}`);
  } else if (initial > cap * 0.8) {
    severity = 'WARN';
    messages.push(`Initial requests: ${initial}; near cap of ${cap}`);
  } else {
    messages.push(`Initial requests: ${initial}; within cap of ${cap}`);
  }
  messages.push(`Total referenced requests: ${total}`);
  return {
    id: 'iabRequests',
    title: 'IAB Initial Requests',
    severity,
    messages,
    offenders: []
  };
}

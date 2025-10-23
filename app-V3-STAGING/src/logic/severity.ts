export type Severity = 'PASS' | 'WARN' | 'FAIL';

export const order: Record<Severity, number> = { PASS: 0, WARN: 1, FAIL: 2 };

export function worst(a: Severity, b: Severity): Severity {
  return order[a] >= order[b] ? a : b;
}

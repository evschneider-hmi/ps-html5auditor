/**
 * DOM Parser utility that works in both main thread and Web Workers
 * 
 * In main thread: Uses native browser DOMParser
 * In Web Workers: Uses linkedom/worker
 */

/**
 * Get a DOMParser instance that works in current context
 * Returns the native DOMParser in main thread, linkedom DOMParser in workers
 */
export async function getDOMParser(): Promise<any> {
  // Check if we're in a worker context (no window object)
  if (typeof window === 'undefined') {
    // Worker context - use linkedom
    const { DOMParser } = await import('linkedom/worker');
    return new DOMParser();
  } else {
    // Main thread context - use native DOMParser
    return new window.DOMParser();
  }
}

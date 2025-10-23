/**
 * IAB & CM360 Weight Budgets Check
 * 
 * Validates ad weight across load phases (initial, polite, total).
 * 
 * Why This Matters:
 * - Large initial load blocks page content
 * - Slow ads hurt user experience
 * - Publishers reject heavy creatives
 * - Mobile users on limited data
 * - Page load performance metrics
 * 
 * IAB Guidelines:
 * - Initial load (polite load start): ≤150KB compressed
 * - Polite load (subsequent): ≤1000KB compressed  
 * - Total compressed: ≤2200KB (2.2MB)
 * - Package ZIP: ≤200KB recommended
 * 
 * CM360 Guidelines:
 * - Aligns with IAB weight budgets
 * - ZIP upload: ≤10MB max
 * - Uncompressed total: ≤2.5MB
 * 
 * Load Phases:
 * 1. **Initial** (0-1s): HTML + critical CSS/JS for first paint
 * 2. **Polite** (1s+): Deferred assets loaded after page interactive
 * 3. **User** (on demand): User-triggered resources (video, etc.)
 * 
 * Best Practices:
 * - Inline critical CSS (< 14KB)
 * - Defer non-critical resources
 * - Compress images (WebP, optimized JPEGs)
 * - Minify JS/CSS
 * - Lazy load heavy assets
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// IAB weight limits (compressed bytes)
const INITIAL_CAP_KB = 150;
const POLITE_CAP_KB = 1000;  
const ZIP_RECOMMENDED_KB = 200;

export const weightBudgetsCheck: Check = {
  id: 'iabWeight',
  title: 'Weight Budgets',
  description: 'IAB: Ad weight budgets (initial/polite compressed, zip package) per configured settings. Exceeding caps fails.',
  profiles: ['IAB', 'CM360'],
  priority: 'required',
  tags: ['size', 'performance', 'weight', 'iab', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { partial, bundle } = context;
    
    // Get weight metrics (in bytes)
    const initialBytes = partial.initialBytes || 0;
    const subloadBytes = partial.subloadBytes || 0;
    const zipBytes = bundle.bytes.length;
    const totalUncompressed = partial.totalBytes || 0;
    
    // Convert to KB for display
    const initialKB = initialBytes / 1024;
    const politeKB = subloadBytes / 1024;
    const zipKB = zipBytes / 1024;
    const totalKB = (initialBytes + subloadBytes) / 1024;
    
    // Check against caps
    const initialPass = initialKB <= INITIAL_CAP_KB;
    const politePass = politeKB <= POLITE_CAP_KB;
    const zipWarn = zipKB > ZIP_RECOMMENDED_KB;
    
    const messages: string[] = [];
    
    // Initial load phase
    messages.push(
      `Initial load ${initialKB.toFixed(1)}KB ${initialPass ? 'within' : 'exceeds'} cap ${INITIAL_CAP_KB}KB`
    );
    
    // Polite load phase  
    messages.push(
      `Subsequent (polite) load ${politeKB.toFixed(1)}KB ${politePass ? 'within' : 'exceeds'} cap ${POLITE_CAP_KB}KB`
    );
    
    // ZIP package size
    messages.push(
      `Compressed creative size ${zipKB.toFixed(1)}KB ${zipWarn ? 'exceeds recommended max' : 'within recommended max'} ${ZIP_RECOMMENDED_KB}KB`
    );
    
    // Total uncompressed (for context)
    messages.push(
      `Total uncompressed ${(totalUncompressed / 1024).toFixed(1)}KB (initial + subsequent)`
    );
    
    // Additional guidance if failing
    if (!initialPass) {
      messages.push('Reduce initial load: inline critical CSS, defer images');
    }
    if (!politePass) {
      messages.push('Reduce polite load: compress images, minify scripts');
    }
    
    // Overall severity
    const severity = (!initialPass || !politePass) ? 'FAIL' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

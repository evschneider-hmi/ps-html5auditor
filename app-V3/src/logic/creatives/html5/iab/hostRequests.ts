/**
 * IAB Initial Host Requests Check
 * 
 * Validates that the creative makes ≤10 unique host requests during initial load.
 * 
 * Why This Matters:
 * - Reduces latency
 * - Faster page load
 * - Better user experience
 * - Lower network overhead
 * - Improves ad performance
 * 
 * IAB Guidelines:
 * - Maximum 10 unique hosts on initial load
 * - Each additional host adds DNS lookup time
 * - Round-trip latency adds up quickly
 * - Mobile networks especially affected
 * 
 * What Counts as a Host Request:
 * - Unique hostname contacted
 * - External resources (images, scripts, fonts)
 * - Third-party tracking pixels
 * - CDN resources
 * - API calls
 * 
 * Example Calculation:
 * - example.com (1 host)
 * - cdn.example.com (2 hosts)
 * - fonts.googleapis.com (3 hosts)
 * - analytics.google.com (4 hosts)
 * - If >10 unique hosts → FAIL
 * 
 * How to Reduce Host Requests:
 * - Embed fonts instead of loading from CDN
 * - Consolidate resources on fewer domains
 * - Use data URIs for small images
 * - Inline critical CSS/JS
 * - Bundle resources together
 * - Remove unnecessary tracking pixels
 * 
 * Performance Impact:
 * - Each new host: ~50-200ms DNS lookup
 * - 10 hosts = 500-2000ms overhead
 * - Mobile networks: even worse
 * - Keep host count low for best performance
 * 
 * Best Practice:
 * - Keep ≤5 hosts for optimal performance
 * - 6-10 hosts: acceptable but slower
 * - >10 hosts: FAIL (too slow)
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const hostRequestsCheck: Check = {
  id: 'host-requests-initial',
  title: 'Initial Host Requests',
  description: 'IAB: Creative should contact ≤10 unique hosts on initial load (performance).',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['performance', 'network', 'hosts', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { partial } = context;
    
    const cap = 10;
    const initial = partial.initialRequests ?? 0;
    
    const severity = initial > cap ? 'FAIL' : 'PASS';
    
    const messages = [`Initial requests: ${initial} / ${cap}`];
    
    if (initial > cap) {
      messages.push(`Exceeded host request limit (${initial - cap} over)`);
      messages.push('Each additional host adds DNS lookup latency');
      messages.push('Consolidate resources on fewer domains');
    } else {
      messages.push('Within host request limit');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

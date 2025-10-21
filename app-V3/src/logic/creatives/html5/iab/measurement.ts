/**
 * IAB Measurement Pixels Check
 * 
 * Detects references to known measurement/tracking pixel hosts.
 * 
 * Why This Matters:
 * - Too many trackers slow page load
 * - Privacy concerns
 * - Publisher policies may limit
 * - Performance impact
 * - Network overhead
 * 
 * IAB Guidelines:
 * - <5 tracking references recommended
 * - Each pixel = additional HTTP request
 * - Coordinate with trafficking team
 * - Use ad server tracking when possible
 * 
 * Common Tracking Hosts:
 * - doubleclick.net, google-analytics.com
 * - facebook.com, pixel.facebook.com
 * - adsrvr.org, adnxs.com
 * - quantserve.com, scorecardresearch.com
 * 
 * Best Practice:
 * - Minimize tracking pixels
 * - Use ad server tracking
 * - Consolidate when possible
 * - Consider privacy implications
 * - Test performance impact
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// Known measurement/tracking pixel hosts
const MEASUREMENT_HOSTS = [
  'doubleclick.net',
  'google-analytics.com',
  'googletagmanager.com',
  'facebook.com',
  'pixel.facebook.com',
  'adsrvr.org',
  'adnxs.com',
  'quantserve.com',
  'scorecardresearch.com',
  'moatads.com',
  'imrworldwide.com',
  'krxd.net'
];

export const measurementCheck: Check = {
  id: 'measurement',
  title: 'Measurement Pixels',
  description: 'IAB: Limit measurement pixel references (<5 recommended).',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['tracking', 'pixels', 'performance', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { partial } = context;
    
    const offenders: Array<{ path: string; detail: string }> = [];
    
    // Check external references for known tracking hosts
    for (const ref of partial.references || []) {
      if (!ref.external) continue;
      
      try {
        const url = new URL(ref.url, 'https://x');
        const hostname = url.hostname.toLowerCase();
        
        if (MEASUREMENT_HOSTS.some(h => hostname.includes(h))) {
          offenders.push({
            path: ref.from,
            detail: ref.url
          });
        }
      } catch {
        // Invalid URL, skip
      }
    }
    
    const count = offenders.length;
    const severity = count >= 5 ? 'FAIL' : count > 0 ? 'WARN' : 'PASS';
    
    const messages = [
      `${count} known tracking reference(s)`,
      'Target: < 5'
    ];
    
    if (count >= 5) {
      messages.push('Too many measurement pixels');
      messages.push('Consolidate tracking or use ad server');
    } else if (count > 0) {
      messages.push('Consider consolidating tracking pixels');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

/**
 * CM360 No Web Storage APIs Check
 * 
 * Validates that creative doesn't use browser storage APIs.
 * 
 * CM360 Requirements:
 * - No localStorage
 * - No sessionStorage
 * - No indexedDB
 * - No openDatabase (WebSQL - deprecated)
 * 
 * Why This Matters:
 * - Privacy concerns (tracking across sites)
 * - Publisher policies prohibit storage
 * - CM360 trafficking may reject ads with storage
 * - GDPR/privacy regulations
 * - Creates persistent data without user consent
 * 
 * Alternatives:
 * - Use frequency capping via CM360 platform
 * - Use cookies with proper consent
 * - Use in-memory state only
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// Pattern: Match any web storage API
const STORAGE_APIS = /(localStorage|sessionStorage|indexedDB|openDatabase)\b/i;

export const noWebStorageCheck: Check = {
  id: 'no-webstorage',
  title: 'No Web Storage APIs',
  description: 'CM360: No use of localStorage, sessionStorage, indexedDB, or openDatabase.',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['storage', 'privacy', 'api', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    const offenders: Array<{ path: string; line: number; detail: string }> = [];
    
    // Scan JS and HTML files
    for (const filePath of files) {
      if (!/\.(js|html?)$/i.test(filePath)) continue;
      
      const text = new TextDecoder().decode(bundle.files[filePath]);
      const lines = text.split(/\r?\n/);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (STORAGE_APIS.test(line)) {
          offenders.push({
            path: filePath,
            line: i + 1,
            detail: line.trim().slice(0, 200)
          });
        }
      }
    }
    
    // Build messages
    const messages = [
      `Storage API references: ${offenders.length}`
    ];
    
    if (offenders.length > 0) {
      messages.push(
        'Web Storage APIs detected (localStorage, sessionStorage, indexedDB, openDatabase)'
      );
      messages.push(
        'Use CM360 frequency capping instead, or contact trafficking team'
      );
      
      // Show sample offenders
      const samples = offenders.slice(0, 3).map(o => 
        `${o.path}:${o.line}`
      );
      messages.push(`Found in: ${samples.join(', ')}`);
    }
    
    const severity = offenders.length ? 'FAIL' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

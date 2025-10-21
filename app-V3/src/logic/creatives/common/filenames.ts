/**
 * CM360 Problematic Filenames Check
 * 
 * Validates filenames follow CM360 naming conventions.
 * 
 * CM360 Requirements:
 * - No special characters: % # ? ; \ : * " | < >
 * - No control characters (spaces, dashes in some contexts)
 * - ZIP filename must contain size token (e.g., "banner_300x250.zip")
 * 
 * Why This Matters:
 * - Special characters cause upload errors
 * - URL encoding issues in trafficking
 * - File system compatibility problems
 * - Size token helps trafficking team identify creative
 * - Prevents mismatch between creative size and trafficking setup
 * 
 * Best Practice:
 * - Use lowercase with underscores: banner_300x250.zip
 * - Include size in ZIP name: campaign_300x250_v1.zip
 * - Avoid spaces, use underscores instead
 */

import type { Check, CheckContext } from '../types';
import type { Finding } from '../../types';

// Pattern: Characters that CM360 disallows
const DISALLOWED_CHARS = /[%#?;\\:*"|<>]/g;

// Pattern: Control characters that may cause issues
const CONTROL_CHARS = /[ -]/;

export const filenamesCheck: Check = {
  id: 'bad-filenames',
  title: 'Problematic Filenames',
  description: 'CM360: No special characters in filenames. ZIP name must include size token.',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['filenames', 'naming', 'conventions', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files, partial } = context;
    
    const disallowedOffenders: Array<{ path: string; detail: string }> = [];
    
    // Check each file for problematic characters
    for (const filePath of files) {
      const filename = (filePath.split('/').pop() || filePath).toString();
      const issues: string[] = [];
      
      // Check for disallowed special characters
      const matches = filename.match(DISALLOWED_CHARS);
      if (matches && matches.length) {
        const uniqueChars = Array.from(new Set(matches));
        issues.push(`illegal character(s): ${uniqueChars.join(' ')}`);
      }
      
      // Check for control characters (spaces, dashes in problematic positions)
      if (CONTROL_CHARS.test(filename)) {
        issues.push('control characters present');
      }
      
      if (issues.length) {
        disallowedOffenders.push({
          path: filePath,
          detail: issues.join('; ')
        });
      }
    }
    
    // Check ZIP filename includes size token
    const bundleName = String((partial as any).bundleName || bundle.name || '');
    let sizeMessage = '';
    let sizeOk = true;
    const sizeOffenders: Array<{ path: string; detail: string }> = [];
    const size = (partial as any).adSize;
    
    if (size && typeof size.width === 'number' && typeof size.height === 'number' && bundleName) {
      const w = Math.round(size.width);
      const h = Math.round(size.height);
      const expected = `${w}x${h}`;
      const sizePattern = new RegExp(`(^|[^0-9])${w}\\s*[xX]\\s*${h}([^0-9]|$)`);
      
      if (sizePattern.test(bundleName)) {
        sizeMessage = `Correct dimensions found in file name (${expected})`;
      } else {
        sizeOk = false;
        sizeMessage = `Expected ${expected} in ZIP name "${bundleName}"`;
        sizeOffenders.push({
          path: bundleName,
          detail: `missing ${expected}`
        });
      }
    } else {
      sizeMessage = 'Creative dimensions unavailable for filename check';
    }
    
    // Combine offenders
    const hasDisallowed = disallowedOffenders.length > 0;
    const severity = hasDisallowed || !sizeOk ? 'FAIL' : 'PASS';
    
    const messages: string[] = [];
    if (hasDisallowed) {
      messages.push(`Disallowed characters found in ${disallowedOffenders.length} file(s)`);
    } else {
      messages.push('No disallowed characters');
    }
    
    if (sizeMessage) {
      messages.push(sizeMessage);
    }
    
    const offenders = disallowedOffenders.concat(sizeOffenders).slice(0, 200);
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

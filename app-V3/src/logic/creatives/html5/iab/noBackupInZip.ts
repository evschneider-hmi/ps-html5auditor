/**
 * IAB No Backup Image in ZIP Check
 * 
 * Ensures backup images are not packaged inside the ZIP (should be hosted separately).
 * 
 * Why This Matters:
 * - Backup images are fallback ads
 * - Should be separate from HTML5 creative
 * - Reduces ZIP file size
 * - Simplifies trafficking
 * - Better ad serving logic
 * 
 * IAB/CM360 Guidelines:
 * - Do NOT include backup.png/jpg/gif in ZIP
 * - Upload backup separately
 * - Ad server handles fallback logic
 * - Cleaner creative structure
 * 
 * What We Check:
 * - Files named "backup.png"
 * - Files named "backup.jpg" or "backup.jpeg"
 * - Files named "backup.gif"
 * - Any directory path (case-insensitive)
 * 
 * Common Mistakes:
 * - Including backup from Google Web Designer
 * - Adding fallback image "just in case"
 * - Not removing backup from export
 * 
 * Best Practice:
 * - Keep backup separate from creative ZIP
 * - Upload to ad server independently
 * - Let ad server manage fallback
 * - Results in cleaner, smaller ZIP
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const noBackupInZipCheck: Check = {
  id: 'no-backup-in-zip',
  title: 'No Backup Image Inside ZIP',
  description: 'IAB/CM360: Backup images should be separate, not packaged in ZIP.',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['backup', 'structure', 'iab', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle } = context;
    
    // Find files named backup.png, backup.jpg, backup.jpeg, backup.gif (any path, case-insensitive)
    const backupPattern = /(^|\/)backup\.(png|jpe?g|gif)$/i;
    const backupFiles = Object.keys(bundle.files).filter(path => backupPattern.test(path));
    
    const severity = backupFiles.length > 0 ? 'WARN' : 'PASS';
    
    const messages = [
      backupFiles.length > 0
        ? `Found: ${backupFiles[0]}`
        : 'No backup image in ZIP'
    ];
    
    if (backupFiles.length > 0) {
      messages.push('Backup images should be uploaded separately');
      messages.push('Remove backup from creative ZIP');
      messages.push('Upload backup to ad server independently');
    }
    
    // Show up to 5 offenders
    const offenders = backupFiles.slice(0, 5).map(path => ({
      path,
      detail: 'backup image found in ZIP'
    }));
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

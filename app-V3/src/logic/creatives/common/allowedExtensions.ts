/**
 * CM360 Allowed File Extensions Check
 * 
 * Validates that all files use approved extensions.
 * 
 * CM360 Requirements:
 * - Only specific file types are allowed
 * - Unsupported files may cause trafficking issues
 * - All files must have proper extensions
 * 
 * Allowed Extensions:
 * - HTML: .html, .htm
 * - Scripts: .js
 * - Styles: .css
 * - Images: .jpg, .jpeg, .gif, .png, .svg
 * - Data: .json, .xml
 * - Fonts: .eot, .otf, .ttf, .woff, .woff2
 */

import type { Check, CheckContext } from '../types';
import type { Finding } from '../../types';

// Allowed file extensions for CM360 creatives
const ALLOWED_EXTENSIONS = new Set([
  // HTML
  '.html',
  '.htm',
  
  // Scripts
  '.js',
  
  // Styles
  '.css',
  
  // Images
  '.jpg',
  '.jpeg',
  '.gif',
  '.png',
  '.svg',
  
  // Data
  '.json',
  '.xml',
  
  // Fonts
  '.eot',
  '.otf',
  '.ttf',
  '.woff',
  '.woff2'
]);

export const allowedExtensionsCheck: Check = {
  id: 'allowed-ext',
  title: 'Allowed File Extensions',
  description: 'CM360: All files must use approved extensions (.html, .js, .css, images, fonts, etc.).',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['extensions', 'files', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { files } = context;
    
    const badExts: Array<{ path: string; detail: string }> = [];
    
    for (const filePath of files) {
      // Extract extension (case-insensitive)
      const match = filePath.toLowerCase().match(/\.[a-z0-9]+$/);
      const ext = match ? match[0] : '';
      
      // Check if extension is allowed
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        badExts.push({
          path: filePath,
          detail: ext || '(no extension)'
        });
      }
    }
    
    const messages = [
      `Disallowed extension files: ${badExts.length}`
    ];
    
    if (badExts.length > 0) {
      messages.push(
        'Allowed extensions: ' +
        Array.from(ALLOWED_EXTENSIONS).slice(0, 10).join(', ') + 
        '...'
      );
    }
    
    const severity = badExts.length ? 'FAIL' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: badExts
    };
  }
};

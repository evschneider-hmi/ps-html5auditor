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

// Common banned file types (OS artifacts, archives, executables, etc.)
// These explicitly trigger FILE_TYPE_INVALID in Google H5 Validator
const BANNED_FILE_TYPES = new Map([
  // OS artifacts
  ['.db', 'OS artifact (Thumbs.db, .DS_Store)'],
  ['.ds_store', 'macOS artifact'],
  ['.ini', 'Windows configuration file'],
  
  // Archives (should be extracted first)
  ['.zip', 'Archive file (extract contents)'],
  ['.rar', 'Archive file (extract contents)'],
  ['.7z', 'Archive file (extract contents)'],
  ['.tar', 'Archive file (extract contents)'],
  ['.gz', 'Archive file (extract contents)'],
  
  // Executables
  ['.exe', 'Executable file'],
  ['.dll', 'Windows library file'],
  ['.bat', 'Batch script'],
  ['.sh', 'Shell script'],
  ['.app', 'macOS application'],
  
  // Documents
  ['.pdf', 'PDF document'],
  ['.doc', 'Word document'],
  ['.docx', 'Word document'],
  ['.xls', 'Excel spreadsheet'],
  ['.xlsx', 'Excel spreadsheet'],
  ['.ppt', 'PowerPoint presentation'],
  ['.pptx', 'PowerPoint presentation'],
  
  // Source files
  ['.psd', 'Photoshop source file'],
  ['.ai', 'Illustrator source file'],
  ['.sketch', 'Sketch source file'],
  ['.fig', 'Figma source file'],
  ['.fla', 'Flash source file'],
  
  // Other
  ['.swf', 'Flash file (deprecated)'],
  ['.mp4', 'Video file (use streaming service)'],
  ['.mov', 'Video file (use streaming service)'],
  ['.avi', 'Video file (use streaming service)'],
  ['.mp3', 'Audio file (usually not supported)'],
  ['.wav', 'Audio file (usually not supported)']
]);

// Special case: __MACOSX directory files
function isMacOSMetadata(path: string): boolean {
  return path.includes('__MACOSX') || path.startsWith('._');
}

export const allowedExtensionsCheck: Check = {
  id: 'allowed-ext',
  title: 'Allowed File Extensions',
  description: 'CM360: Only typical creative extensions allowed (html, js, css, images, fonts, etc.)',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['extensions', 'files', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { files } = context;
    
    const badExts: Array<{ path: string; detail: string }> = [];
    
    for (const filePath of files) {
      // Check for macOS metadata files (always banned)
      if (isMacOSMetadata(filePath)) {
        badExts.push({
          path: filePath,
          detail: 'macOS metadata file (__MACOSX or ._*)'
        });
        continue;
      }
      
      // Extract extension (case-insensitive)
      const match = filePath.toLowerCase().match(/\.[a-z0-9]+$/);
      const ext = match ? match[0] : '';
      
      // Check if it's a specifically banned file type
      if (ext && BANNED_FILE_TYPES.has(ext)) {
        badExts.push({
          path: filePath,
          detail: `${BANNED_FILE_TYPES.get(ext)} - explicitly banned`
        });
        continue;
      }
      
      // Check if extension is allowed
      if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
        badExts.push({
          path: filePath,
          detail: ext ? `Unsupported extension: ${ext}` : '(no extension)'
        });
      }
    }
    
    const messages: string[] = [];
    
    if (badExts.length > 0) {
      messages.push(`Disallowed/banned files: ${badExts.length}`);
      messages.push(
        'Allowed: ' +
        Array.from(ALLOWED_EXTENSIONS).slice(0, 10).join(', ') + 
        ', etc.'
      );
      
      // Add specific warnings for common banned types
      const bannedTypes = new Set(badExts.map(b => {
        const ext = b.path.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
        return ext;
      }).filter(Boolean));
      
      if (bannedTypes.size > 0) {
        const typeList = Array.from(bannedTypes).slice(0, 5).join(', ');
        messages.push(`Banned types found: ${typeList}`);
      }
    } else {
      messages.push('All file extensions allowed');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity: badExts.length > 0 ? 'FAIL' : 'PASS',
      messages,
      offenders: badExts
    };
  }
};

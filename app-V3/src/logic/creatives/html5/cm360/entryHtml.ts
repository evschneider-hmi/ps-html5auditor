/**
 * CM360 Single Entry HTML & References Check
 * 
 * Validates proper creative structure:
 * 1. Exactly one HTML entry file
 * 2. All other files are referenced by the HTML (or its dependencies)
 * 
 * CM360 Requirements:
 * - Creative must have single point of entry
 * - Unreferenced files waste bandwidth and may confuse trafficking
 * - Multiple HTML files indicate improper packaging
 * 
 * Why This Matters:
 * - CM360 looks for the primary HTML file
 * - Unreferenced files add unnecessary weight
 * - Multiple HTMLs suggest creative isn't properly bundled
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const entryHtmlCheck: Check = {
  id: 'entry-html',
  title: 'Single Entry HTML & References',
  description: 'CM360: Exactly one HTML entry file, all other files must be referenced.',
  profiles: ['CM360'],
  priority: 'required',
  tags: ['structure', 'html', 'references', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { files, partial } = context;
    
    // Find all HTML files
    const htmlFiles = files.filter(p => /\.(html?)$/i.test(p));
    const htmlCount = htmlFiles.length;
    
    // Build set of referenced files
    const referenced = new Set<string>();
    
    // Add files from reference analysis
    if (partial.references && Array.isArray(partial.references)) {
      for (const ref of partial.references) {
        if (ref.inZip && ref.normalized) {
          referenced.add(ref.normalized.toLowerCase());
        }
      }
    }
    
    // Add primary HTML file
    if (partial.primary?.path) {
      referenced.add(partial.primary.path.toLowerCase());
    }
    
    // Find unreferenced files
    const unreferenced: Array<{ path: string; detail?: string }> = [];
    for (const filePath of files) {
      const pathLower = filePath.toLowerCase();
      
      // HTML files are allowed to be unreferenced (primary will be counted)
      if (htmlFiles.includes(filePath)) continue;
      
      if (!referenced.has(pathLower)) {
        unreferenced.push({
          path: filePath,
          detail: 'Not referenced by entry file'
        });
      }
    }
    
    // Build messages
    const messages: string[] = [];
    messages.push(`Entry HTML files: ${htmlCount} (expected 1)`);
    messages.push(`Unreferenced files: ${unreferenced.length}`);
    
    if (htmlCount > 1) {
      messages.push(
        `Multiple HTML files detected - only one entry HTML allowed`
      );
    } else if (htmlCount === 0) {
      messages.push(
        `No HTML entry file found - creative must have index.html`
      );
    }
    
    if (unreferenced.length > 0) {
      messages.push(
        `Files not referenced: ${unreferenced.slice(0, 5).map(u => u.path).join(', ')}` +
        (unreferenced.length > 5 ? ` and ${unreferenced.length - 5} more...` : '')
      );
    }
    
    // Determine severity
    const severity = (htmlCount !== 1)
      ? 'FAIL'
      : (unreferenced.length > 0 ? 'WARN' : 'PASS');
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: unreferenced
    };
  }
};

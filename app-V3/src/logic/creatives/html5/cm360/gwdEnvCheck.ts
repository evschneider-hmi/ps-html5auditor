/**
 * CM360 GWD Environment Check
 * 
 * Detects Google Web Designer exports and warns about environment configuration.
 * 
 * Why This Matters:
 * - Google Web Designer (GWD) exports have environment-specific code
 * - Must be exported with correct settings for CM360
 * - Wrong environment can cause tracking failures
 * - Preview vs. Production modes differ
 * 
 * GWD Signatures Detected:
 * - gwd-page-wrapper: Main wrapper element
 * - GWD_preventAutoplay: Autoplay prevention flag
 * - gwd-google: Google-specific elements
 * 
 * Best Practice:
 * - Export from GWD using "Publish to DoubleClick Studio" option
 * - Not "Generic HTML5" or "Preview"
 * - Verify environment string is "studio" not "test"
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// Pattern: Common GWD signature strings
const GWD_SIGNATURES = /gwd-page-wrapper|GWD_preventAutoplay|gwd-google/i;

export const gwdEnvCheck: Check = {
  id: 'gwd-env-check',
  title: 'GWD Environment Check',
  description: 'CM360: Verify Google Web Designer exports use correct environment configuration.',
  profiles: ['CM360'],
  priority: 'recommended',
  tags: ['gwd', 'google-web-designer', 'environment', 'cm360'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    const offenders: Array<{ path: string; detail: string }> = [];
    
    // Scan HTML files for GWD signatures
    for (const filePath of files) {
      if (!/\.html?$/i.test(filePath)) continue;
      
      const text = new TextDecoder().decode(bundle.files[filePath]);
      
      if (GWD_SIGNATURES.test(text)) {
        offenders.push({
          path: filePath,
          detail: 'GWD signature found'
        });
      }
    }
    
    // Build messages
    const messages: string[] = [];
    
    if (offenders.length === 0) {
      messages.push('No Google Web Designer signatures detected');
    } else {
      messages.push('Google Web Designer export detected');
      messages.push('Verify environment configuration for CM360');
      messages.push('Should be exported as "Publish to DoubleClick Studio"');
      messages.push(`Found in ${offenders.length} file(s)`);
    }
    
    // WARN if GWD detected (not FAIL - may be correctly configured)
    const severity = offenders.length > 0 ? 'WARN' : 'PASS';
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

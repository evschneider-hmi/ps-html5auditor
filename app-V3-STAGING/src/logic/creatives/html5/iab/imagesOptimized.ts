/**
 * IAB Images Optimized Check
 * 
 * Validates that large PNG images should use JPEG or WebP instead.
 * 
 * Why This Matters:
 * - PNGs are larger than JPEGs for photos
 * - Large files slow load time
 * - Wastes bandwidth
 * - Poor mobile experience
 * - Can exceed file size limits
 * 
 * IAB Guidelines:
 * - Optimize all images
 * - Use appropriate formats
 * - JPEGs for photos
 * - PNGs for graphics/transparency
 * - WebP for modern browsers
 * 
 * Format Guide:
 * - JPEG: Photos, no transparency (smaller)
 * - PNG: Graphics, transparency needed (larger)
 * - WebP: Modern, smaller than both
 * - SVG: Vectors, icons, logos
 * 
 * Threshold:
 * - PNGs >300KB should be JPEG/WebP
 * - Exceptions: Need transparency
 * - Compress PNGs with tools
 * 
 * Best Practice:
 * - Use image optimization tools
 * - TinyPNG, ImageOptim, Squoosh
 * - Automate in build process
 * - Test visual quality
 * - Consider WebP with JPEG fallback
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

// Threshold: PNGs over 300KB should be optimized
const MAX_PNG_SIZE = 300 * 1024; // 300KB

export const imagesOptimizedCheck: Check = {
  id: 'imagesOptimized',
  title: 'Images Optimized',
  description: 'IAB: Large PNGs (>300KB) should be JPEG or WebP.',
  profiles: ['IAB'],
  priority: 'recommended',
  tags: ['images', 'optimization', 'performance', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    const offenders: Array<{ path: string; detail: string }> = [];
    
    // Check image files
    const images = files.filter(path => 
      /(\.png|\.jpe?g|\.gif|\.webp)$/i.test(path)
    );
    
    for (const path of images) {
      const size = bundle.files[path].byteLength;
      
      // Flag large PNGs
      if (size > MAX_PNG_SIZE && /\.png$/i.test(path)) {
        const sizeKB = Math.round(size / 1024);
        offenders.push({
          path,
          detail: `PNG ${sizeKB} KB — consider JPEG/WebP`
        });
      }
    }
    
    const severity = offenders.length > 0 ? 'FAIL' : 'PASS';
    
    const messages = offenders.length > 0
      ? [
          `${offenders.length} image(s) could be optimized`,
          'Large PNGs detected (>300KB)',
          'Convert photos to JPEG, or compress PNGs',
          'Use WebP for best compression'
        ]
      : ['OK'];
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders
    };
  }
};

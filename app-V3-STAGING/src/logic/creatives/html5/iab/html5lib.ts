/**
 * IAB HTML5 Library Detection Check
 * 
 * Detects use of third-party libraries (CreateJS, GSAP, PixiJS, jQuery).
 * 
 * Why This Matters:
 * - Large file sizes (50KB-200KB+)
 * - Performance impact
 * - Load time increases
 * - Better alternatives exist
 * - IAB discourages heavy libraries
 * 
 * IAB Guidelines:
 * - Avoid third-party libraries when possible
 * - Use vanilla JavaScript
 * - Keep file sizes minimal
 * - Optimize for performance
 * 
 * Libraries Detected:
 * - CreateJS (animation/canvas library)
 * - GSAP (GreenSock animation)
 * - PixiJS (WebGL/Canvas rendering)
 * - jQuery (DOM manipulation)
 * 
 * When Libraries are Acceptable:
 * - Complex animations justified
 * - Canvas/WebGL requirements
 * - Already included by publisher
 * - File size still under limit
 * 
 * Alternatives:
 * - CSS animations
 * - Web Animations API
 * - Vanilla canvas/WebGL
 * - Native DOM APIs
 * 
 * Best Practice:
 * - Use native browser APIs
 * - CSS for simple animations
 * - Web Animations API for complex
 * - Keep total size under limits
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const html5libCheck: Check = {
  id: 'html5lib',
  title: 'HTML5 Library',
  description: 'IAB: Avoid third-party libraries (CreateJS, GSAP, PixiJS, jQuery).',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['libraries', 'performance', 'filesize', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { bundle, files } = context;
    
    const libs: string[] = [];
    
    // Scan JS and HTML files for library signatures
    const text = files
      .filter(p => /\.(js|html?)$/i.test(p))
      .map(p => new TextDecoder().decode(bundle.files[p]))
      .join('\n');
    
    // Detect CreateJS
    if (/createjs\./i.test(text)) {
      libs.push('CreateJS');
    }
    
    // Detect GSAP
    if (/gsap\(|TweenMax|TweenLite/i.test(text)) {
      libs.push('GSAP');
    }
    
    // Detect PixiJS
    if (/pixi\.js/i.test(text)) {
      libs.push('PixiJS');
    }
    
    // Detect jQuery
    if (/jquery|\$\(/i.test(text)) {
      libs.push('jQuery');
    }
    
    const severity = libs.length > 0 ? 'FAIL' : 'PASS';
    
    const messages = libs.length > 0
      ? [
          libs.join(', '),
          'Third-party libraries detected',
          'Use vanilla JavaScript for better performance',
          'Consider CSS animations or Web Animations API'
        ]
      : ['None detected'];
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

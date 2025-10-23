/**
 * IAB Video Detection Check
 * 
 * Detects presence of video files in the creative.
 * 
 * Why This Matters:
 * - Informational for tracking video usage
 * - Videos have special IAB requirements
 * - Large files need optimization
 * - May trigger additional validation
 * 
 * IAB Guidelines:
 * - No specific prohibition on video
 * - But must meet file size limits
 * - Consider autoplay policies
 * - Ensure mobile compatibility
 * 
 * Supported Formats:
 * - .mp4 (H.264 recommended)
 * - .webm (VP8/VP9)
 * - .ogg (Theora)
 * - .mov (QuickTime)
 * 
 * Best Practice:
 * - Use modern codecs (H.264, VP9)
 * - Optimize compression
 * - Provide poster images
 * - Test across browsers
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const videoCheck: Check = {
  id: 'video',
  title: 'Has Video',
  description: 'IAB: Detects presence of video files (informational).',
  profiles: ['IAB'],
  priority: 'advisory',
  tags: ['video', 'media', 'debug', 'iab'],
  
  execute(context: CheckContext): Finding {
    const { files } = context;
    
    // Detect video files by extension
    const videos = files.filter(path => 
      /(\.mp4|\.webm|\.ogg|\.mov)$/i.test(path)
    );
    
    const messages = videos.length > 0
      ? [`${videos.length} video file(s)`]
      : ['No video files'];
    
    // Build offenders list with video file paths
    const offenders = videos.map(path => ({
      path,
      detail: 'Video file'
    }));
    
    // Always PASS - informational only
    return {
      id: this.id,
      title: this.title,
      severity: 'PASS',
      messages,
      offenders
    };
  }
};

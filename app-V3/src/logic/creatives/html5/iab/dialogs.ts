/**
 * IAB Dialogs and Modals Check
 * 
 * Validates no use of alert(), confirm(), or prompt().
 * 
 * Why This Matters:
 * - Blocks user interaction with page
 * - Poor user experience
 * - Can be blocked by browsers
 * - Inappropriate for ads
 * - May trigger popup blockers
 * 
 * IAB Guidelines:
 * - No alert(), confirm(), or prompt() calls
 * - Use custom modals if needed
 * - Don't interrupt user flow
 * 
 * Best Practice:
 * - Use inline UI for user interaction
 * - Custom modals with CSS
 * - Non-blocking notifications
 * - Respect user attention
 * 
 * Detection:
 * - Runtime probe tracks dialog calls
 * - Catches both direct and dynamic calls
 * - Includes eval() generated calls
 */

import type { Check, CheckContext } from '../../types';
import type { Finding } from '../../../types';

export const dialogsCheck: Check = {
  id: 'dialogs',
  title: 'Dialogs and Modals',
  description: 'IAB: No use of alert(), confirm(), or prompt().',
  profiles: ['IAB'],
  priority: 'required',
  tags: ['dialogs', 'ux', 'iab'],
  
  execute(context: CheckContext): Finding {
    // Get runtime probe data
    const meta = (window as any).__audit_last_summary as any;
    const count = meta?.dialogs || 0;
    
    const severity = count > 0 ? 'FAIL' : 'PASS';
    
    const messages = [`Count: ${count}`];
    
    if (count > 0) {
      messages.push('Dialog calls detected (alert/confirm/prompt)');
      messages.push('Use custom UI elements instead');
    }
    
    return {
      id: this.id,
      title: this.title,
      severity,
      messages,
      offenders: []
    };
  }
};

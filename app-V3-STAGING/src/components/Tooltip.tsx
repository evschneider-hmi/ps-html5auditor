/**
 * Tooltip Component
 * 
 * Displays helpful information on hover or focus.
 * Used throughout the app for progressive disclosure.
 */

import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  maxWidth?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  maxWidth = 300 
}) => {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    
    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = trigger.top - tooltip.height - 8;
        left = trigger.left + (trigger.width / 2) - (tooltip.width / 2);
        break;
      case 'bottom':
        top = trigger.bottom + 8;
        left = trigger.left + (trigger.width / 2) - (tooltip.width / 2);
        break;
      case 'left':
        top = trigger.top + (trigger.height / 2) - (tooltip.height / 2);
        left = trigger.left - tooltip.width - 8;
        break;
      case 'right':
        top = trigger.top + (trigger.height / 2) - (tooltip.height / 2);
        left = trigger.right + 8;
        break;
    }

    // Keep tooltip in viewport
    if (left < 8) left = 8;
    if (left + tooltip.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltip.width - 8;
    }
    if (top < 8) top = 8;
    if (top + tooltip.height > window.innerHeight - 8) {
      top = window.innerHeight - tooltip.height - 8;
    }

    setCoords({ top, left });
  }, [visible, position]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: 420,
            maxWidth: 420,
            padding: 10,
            backgroundColor: 'var(--panel-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 11,
            lineHeight: 1.5,
            zIndex: 9999,
            boxShadow: 'var(--shadow)',
            pointerEvents: 'none',
            whiteSpace: 'pre-line',
            wordWrap: 'break-word'
          }}
        >
          {content}
        </div>
      )}
    </>
  );
};

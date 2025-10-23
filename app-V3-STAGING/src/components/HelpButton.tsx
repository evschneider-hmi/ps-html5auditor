/**
 * HelpButton Component
 * 
 * A small "?" button that shows helpful information in a tooltip.
 * Used throughout the app for contextual help.
 */

import React from 'react';
import { Tooltip } from './Tooltip';

interface HelpButtonProps {
  content: string | React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  ariaLabel?: string;
}

export const HelpButton: React.FC<HelpButtonProps> = ({ 
  content, 
  position = 'top',
  ariaLabel = 'Help'
}) => {
  return (
    <Tooltip content={content} position={position}>
      <button
        type="button"
        aria-label={ariaLabel}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 18,
          height: 18,
          padding: 0,
          margin: 0,
          backgroundColor: 'var(--btn-bg)',
          border: '1px solid var(--btn-border)',
          borderRadius: '50%',
          color: 'var(--muted)',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'help',
          transition: 'all 0.15s ease',
          userSelect: 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--btn-bg-hover)';
          e.currentTarget.style.color = 'var(--text)';
          e.currentTarget.style.borderColor = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--btn-bg)';
          e.currentTarget.style.color = 'var(--muted)';
          e.currentTarget.style.borderColor = 'var(--btn-border)';
        }}
        onClick={(e) => e.preventDefault()}
      >
        ?
      </button>
    </Tooltip>
  );
};

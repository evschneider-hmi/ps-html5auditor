/**
 * ProfileBadge Component
 * 
 * Displays CM360 and/or IAB profile badges for checks.
 * - CM360: Green badge
 * - IAB: Purple badge
 * - BOTH: Shows both badges
 */

import React from 'react';

interface ProfileBadgeProps {
  profiles?: ('CM360' | 'IAB' | 'BOTH')[];
  description?: string;
}

export const ProfileBadge: React.FC<ProfileBadgeProps> = ({ profiles, description }) => {
  if (!profiles || profiles.length === 0) return null;

  // Determine which badges to show
  const showCM360 = profiles.includes('CM360') || profiles.includes('BOTH');
  const showIAB = profiles.includes('IAB') || profiles.includes('BOTH');

  return (
    <div className="profile-badges" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {showCM360 && (
        <span 
          className="profile-badge cm360"
          title={description || 'CM360 Specification'}
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 3,
            backgroundColor: 'var(--cm360-bg, #d4edda)',
            color: 'var(--cm360-text, #155724)',
            border: '1px solid var(--cm360-border, #c3e6cb)',
            cursor: 'help',
            userSelect: 'none'
          }}
        >
          CM360
        </span>
      )}
      {showIAB && (
        <span 
          className="profile-badge iab"
          title={description || 'IAB Specification'}
          style={{
            display: 'inline-block',
            padding: '2px 6px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 3,
            backgroundColor: 'var(--iab-bg, #e7d4f0)',
            color: 'var(--iab-text, #5a2e6b)',
            border: '1px solid var(--iab-border, #d4b5e3)',
            cursor: 'help',
            userSelect: 'none'
          }}
        >
          IAB
        </span>
      )}
    </div>
  );
};

/**
 * ShareButton Component
 * 
 * Provides UI for sharing the current session via URL.
 * Features:
 * - Copy shareable URL to clipboard
 * - Visual feedback (toast notification)
 * - Deep linking options (optional)
 * - Privacy notice
 */

import React, { useState } from 'react';
import { Icon } from './Icon';
import { generateShareableURL, copyToClipboard } from '../utils/sessionStorage';

interface ShareButtonProps {
  sessionId: string | null;
  activeTab?: string;
  activeCheckId?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  sessionId,
  activeTab,
  activeCheckId,
  className = '',
  style,
}) => {
  const [showToast, setShowToast] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleShare = async () => {
    if (!sessionId) {
      return;
    }

    // Generate shareable URL with optional deep link params
    const shareableURL = generateShareableURL(sessionId, {
      tab: activeTab,
      checkId: activeCheckId,
    });

    // Copy to clipboard
    const success = await copyToClipboard(shareableURL);

    if (success) {
      setShowToast(true);
      setCopyFailed(false);
      
      // Hide toast after 3 seconds
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
    } else {
      setShowToast(true);
      setCopyFailed(true);
      
      setTimeout(() => {
        setShowToast(false);
        setCopyFailed(false);
      }, 3000);
    }
  };

  // Don't render if no session
  if (!sessionId) {
    return null;
  }

  return (
    <>
      <button
        className={`share-button ${className}`}
        onClick={handleShare}
        style={style}
        title="Copy shareable URL to clipboard"
      >
        <Icon name="external-link" size={16} />
        <span>Share Results</span>
      </button>

      {showToast && (
        <div className={`share-toast ${copyFailed ? 'share-toast--error' : ''}`}>
          <Icon name={copyFailed ? 'error' : 'check'} size={16} />
          <span>
            {copyFailed
              ? 'Failed to copy URL'
              : 'URL copied to clipboard! Share it with your team.'}
          </span>
        </div>
      )}

      <style>{`
        .share-button {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2, 8px);
          padding: var(--space-2, 8px) var(--space-4, 16px);
          background: var(--primary-color, #4f46e5);
          color: white;
          border: none;
          border-radius: var(--radius-md, 6px);
          font-size: var(--text-sm, 14px);
          font-weight: var(--font-medium, 500);
          cursor: pointer;
          transition: all var(--transition-fast, 150ms) ease;
          box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
        }

        .share-button:hover {
          background: var(--primary-hover, #4338ca);
          box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
          transform: translateY(-1px);
        }

        .share-button:active {
          transform: translateY(0);
          box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
        }

        .share-button:focus-visible {
          outline: 2px solid var(--focus-ring-color, #4f46e5);
          outline-offset: 2px;
        }

        .share-toast {
          position: fixed;
          bottom: var(--space-6, 24px);
          right: var(--space-6, 24px);
          display: flex;
          align-items: center;
          gap: var(--space-3, 12px);
          padding: var(--space-4, 16px) var(--space-6, 24px);
          background: var(--success-bg, #10b981);
          color: white;
          border-radius: var(--radius-lg, 8px);
          box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
          font-size: var(--text-sm, 14px);
          font-weight: var(--font-medium, 500);
          z-index: var(--z-toast, 1500);
          animation: slideInUp 0.3s ease;
        }

        .share-toast--error {
          background: var(--error-bg, #ef4444);
        }

        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .share-button {
            background: var(--primary-color-dark, #6366f1);
          }

          .share-button:hover {
            background: var(--primary-hover-dark, #818cf8);
          }

          .share-toast {
            box-shadow: var(--shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.3));
          }
        }
      `}</style>
    </>
  );
};

/**
 * Privacy Notice Component
 * 
 * Displays information about session storage and data privacy
 */
interface PrivacyNoticeProps {
  className?: string;
}

export const SessionPrivacyNotice: React.FC<PrivacyNoticeProps> = ({ className = '' }) => {
  return (
    <div className={`session-privacy-notice ${className}`}>
      <Icon name="info" size={16} />
      <div className="session-privacy-notice__content">
        Your data is stored locally in your browser for 7 days. Sessions currently work only on this device.
        No data is sent to external servers.
      </div>

      <style>{`
        .session-privacy-notice {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3, 12px);
          padding: var(--space-4, 16px);
          background: var(--info-bg, rgba(59, 130, 246, 0.1));
          border: 1px solid var(--info-border, rgba(59, 130, 246, 0.2));
          border-radius: var(--radius-md, 6px);
          font-size: var(--text-sm, 14px);
          line-height: var(--leading-relaxed, 1.625);
          color: var(--text-secondary);
        }

        .session-privacy-notice__content {
          flex: 1;
        }

        .session-privacy-notice__content strong {
          color: var(--text-primary);
          font-weight: var(--font-semibold, 600);
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .session-privacy-notice {
            background: var(--info-bg-dark, rgba(59, 130, 246, 0.15));
            border-color: var(--info-border-dark, rgba(59, 130, 246, 0.3));
          }
        }
      `}</style>
    </div>
  );
};

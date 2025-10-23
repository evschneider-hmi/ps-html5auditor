import React from 'react';
import { Icon } from './Icon';
import './ErrorDialog.css';

interface ErrorDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
}

/**
 * Simple error dialog modal
 * User-friendly popup for displaying errors
 */
export function ErrorDialog({ isOpen, title, message, onClose }: ErrorDialogProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="error-dialog-backdrop"
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close error dialog"
      />

      {/* Dialog */}
      <div className="error-dialog" role="alertdialog" aria-labelledby="error-title">
        {/* Header */}
        <div className="error-dialog-header">
          <div className="error-dialog-title-row">
            <div className="error-dialog-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 20h20L12 2z" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 id="error-title">{title}</h2>
          </div>
          <button
            className="error-dialog-close"
            onClick={onClose}
            aria-label="Close error dialog"
            title="Close (Esc)"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="error-dialog-content">
          <p>{message}</p>
        </div>

        {/* Footer */}
        <div className="error-dialog-footer">
          <button
            className="error-dialog-button"
            onClick={onClose}
            autoFocus
          >
            OK
          </button>
        </div>
      </div>
    </>
  );
}

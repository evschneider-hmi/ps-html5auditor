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
            <Icon name="alert-circle" size={24} />
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

/**
 * BatchActions Component
 * 
 * Provides bulk operations UI for multiple selected uploads:
 * - Select all/none controls
 * - Bulk delete with confirmation
 * - Bulk export (JSON/CSV)
 * - Selection count display
 * - Clear selection
 * 
 * Features:
 * - Keyboard shortcuts (Ctrl+A, Delete)
 * - Confirmation modals for destructive actions
 * - Export selected uploads
 * - Accessible controls
 */

import React, { useState } from 'react';
import { Icon } from './Icon';
import type { Upload } from '../types';

interface BatchActionsProps {
  uploads: Upload[];
  selectedIds: Set<string>;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onBulkDelete: (ids: string[]) => void;
  onBulkExport: (ids: string[], format: 'json' | 'csv') => void;
  className?: string;
  activeTab?: 'creatives' | 'tags' | null;
}

export const BatchActions: React.FC<BatchActionsProps> = ({
  uploads,
  selectedIds,
  onSelectAll,
  onSelectNone,
  onBulkDelete,
  onBulkExport,
  className = '',
  activeTab = null,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === uploads.length && uploads.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < uploads.length;

  // Determine label based on active tab
  const itemLabel = activeTab === 'tags' ? 'tag' : 'creative';
  const itemLabelPlural = activeTab === 'tags' ? 'tags' : 'creatives';

  const handleToggleAll = () => {
    if (allSelected || someSelected) {
      onSelectNone();
    } else {
      onSelectAll();
    }
  };

  const handleDelete = () => {
    const idsArray = Array.from(selectedIds);
    onBulkDelete(idsArray);
    setShowDeleteConfirm(false);
  };

  const handleExport = () => {
    const idsArray = Array.from(selectedIds);
    onBulkExport(idsArray, exportFormat);
  };

  if (uploads.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`batch-actions ${className}`}>
        <div className="batch-actions__selection">
          <button
            className="batch-actions__checkbox"
            onClick={handleToggleAll}
            title={allSelected ? 'Deselect all' : 'Select all'}
            aria-label={allSelected ? 'Deselect all creatives' : 'Select all creatives'}
          >
            <div className={`checkbox ${allSelected ? 'checked' : ''} ${someSelected ? 'indeterminate' : ''}`}>
              {allSelected && <Icon name="check" size={14} />}
              {someSelected && <span className="indeterminate-mark">−</span>}
            </div>
          </button>

          <span className="batch-actions__count">
            {selectedCount > 0 ? (
              <>
                <strong>{selectedCount}</strong> of <strong>{uploads.length}</strong> selected
              </>
            ) : (
              <>
                {uploads.length} {uploads.length !== 1 ? itemLabelPlural : itemLabel}
              </>
            )}
          </span>
        </div>

        {selectedCount > 0 && (
          <div className="batch-actions__buttons">
            <button
              className="batch-actions__btn"
              onClick={onSelectNone}
              title="Clear selection"
            >
              <Icon name="close" size={16} />
              <span>Clear</span>
            </button>

            <div className="batch-actions__divider" />

            <select
              className="batch-actions__format"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
              aria-label="Export format"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>

            <button
              className="batch-actions__btn batch-actions__btn--primary"
              onClick={handleExport}
              title={`Export ${selectedCount} creative${selectedCount !== 1 ? 's' : ''} as ${exportFormat.toUpperCase()}`}
            >
              <Icon name="download" size={16} />
              <span>Export ({selectedCount})</span>
            </button>

            <div className="batch-actions__divider" />

            <button
              className="batch-actions__btn batch-actions__btn--danger"
              onClick={() => setShowDeleteConfirm(true)}
              title={`Delete ${selectedCount} creative${selectedCount !== 1 ? 's' : ''}`}
            >
              <Icon name="close" size={16} />
              <span>Delete ({selectedCount})</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="batch-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="batch-modal" onClick={(e) => e.stopPropagation()}>
            <div className="batch-modal__header">
              <Icon name="warning" size={24} />
              <h3>Confirm Bulk Delete</h3>
            </div>

            <div className="batch-modal__body">
              <p>
                Are you sure you want to delete <strong>{selectedCount}</strong>{' '}
                creative{selectedCount !== 1 ? 's' : ''}?
              </p>
              <p className="batch-modal__warning">
                This action cannot be undone.
              </p>
            </div>

            <div className="batch-modal__footer">
              <button
                className="batch-modal__btn batch-modal__btn--secondary"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="batch-modal__btn batch-modal__btn--danger"
                onClick={handleDelete}
                autoFocus
              >
                <Icon name="close" size={16} />
                Delete {selectedCount} Creative{selectedCount !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .batch-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4, 16px);
          padding: var(--space-3, 12px) var(--space-4, 16px);
          background: var(--surface-color, #fff);
          border: 1px solid var(--border-color, #e5e7eb);
          border-radius: var(--radius-md, 6px);
          margin-bottom: var(--space-4, 16px);
        }

        .batch-actions__selection {
          display: flex;
          align-items: center;
          gap: var(--space-3, 12px);
        }

        .batch-actions__checkbox {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
        }

        .checkbox {
          width: 18px;
          height: 18px;
          border: 2px solid var(--border-color, #d1d5db);
          border-radius: var(--radius-sm, 4px);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast, 150ms) ease;
          background: var(--input-bg, #fff);
        }

        .checkbox:hover {
          border-color: var(--primary-color, #4f46e5);
        }

        .checkbox.checked,
        .checkbox.indeterminate {
          background: var(--primary-color, #4f46e5);
          border-color: var(--primary-color, #4f46e5);
          color: white;
        }

        .checkbox .indeterminate-mark {
          font-size: 18px;
          line-height: 1;
          color: white;
          font-weight: bold;
        }

        .batch-actions__count {
          font-size: var(--text-sm, 14px);
          color: var(--text-secondary);
        }

        .batch-actions__count strong {
          color: var(--text-primary);
          font-weight: var(--font-semibold, 600);
        }

        .batch-actions__buttons {
          display: flex;
          align-items: center;
          gap: var(--space-2, 8px);
        }

        .batch-actions__divider {
          width: 1px;
          height: 24px;
          background: var(--border-color, #e5e7eb);
        }

        .batch-actions__btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2, 8px);
          padding: var(--space-2, 8px) var(--space-3, 12px);
          background: var(--surface-color, #fff);
          color: var(--text-primary);
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: var(--radius-md, 6px);
          font-size: var(--text-sm, 14px);
          font-weight: var(--font-medium, 500);
          cursor: pointer;
          transition: all var(--transition-fast, 150ms) ease;
        }

        .batch-actions__btn:hover {
          background: var(--hover-bg, #f9fafb);
          border-color: var(--border-hover, #9ca3af);
        }

        .batch-actions__btn--primary {
          background: var(--primary-color, #4f46e5);
          color: white;
          border-color: var(--primary-color, #4f46e5);
        }

        .batch-actions__btn--primary:hover {
          background: var(--primary-hover, #4338ca);
          border-color: var(--primary-hover, #4338ca);
        }

        .batch-actions__btn--danger {
          background: var(--error-bg, #fee2e2);
          color: var(--error-color, #dc2626);
          border-color: var(--error-border, #fecaca);
        }

        .batch-actions__btn--danger:hover {
          background: var(--error-color, #dc2626);
          color: white;
          border-color: var(--error-color, #dc2626);
        }

        .batch-actions__format {
          padding: var(--space-2, 8px);
          border: 1px solid var(--border-color, #d1d5db);
          border-radius: var(--radius-md, 6px);
          background: var(--input-bg, #fff);
          color: var(--text-primary);
          font-size: var(--text-sm, 14px);
          cursor: pointer;
        }

        /* Modal Styles */
        .batch-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: var(--z-modal, 1400);
          animation: fadeIn 0.2s ease;
        }

        .batch-modal {
          background: var(--surface-color, #fff);
          border-radius: var(--radius-lg, 8px);
          box-shadow: var(--shadow-xl, 0 20px 25px rgba(0, 0, 0, 0.15));
          max-width: 500px;
          width: 90%;
          animation: slideUp 0.3s ease;
        }

        .batch-modal__header {
          display: flex;
          align-items: center;
          gap: var(--space-3, 12px);
          padding: var(--space-6, 24px);
          border-bottom: 1px solid var(--border-color, #e5e7eb);
          color: var(--warning-color, #f59e0b);
        }

        .batch-modal__header h3 {
          margin: 0;
          font-size: var(--text-lg, 18px);
          font-weight: var(--font-semibold, 600);
          color: var(--text-primary);
        }

        .batch-modal__body {
          padding: var(--space-6, 24px);
        }

        .batch-modal__body p {
          margin: 0 0 var(--space-4, 16px) 0;
          font-size: var(--text-base, 16px);
          line-height: var(--leading-relaxed, 1.625);
          color: var(--text-primary);
        }

        .batch-modal__body p:last-child {
          margin-bottom: 0;
        }

        .batch-modal__warning {
          color: var(--text-secondary);
          font-size: var(--text-sm, 14px) !important;
        }

        .batch-modal__footer {
          display: flex;
          justify-content: flex-end;
          gap: var(--space-3, 12px);
          padding: var(--space-6, 24px);
          border-top: 1px solid var(--border-color, #e5e7eb);
        }

        .batch-modal__btn {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2, 8px);
          padding: var(--space-3, 12px) var(--space-4, 16px);
          border: none;
          border-radius: var(--radius-md, 6px);
          font-size: var(--text-base, 16px);
          font-weight: var(--font-medium, 500);
          cursor: pointer;
          transition: all var(--transition-fast, 150ms) ease;
        }

        .batch-modal__btn--secondary {
          background: var(--surface-color, #f9fafb);
          color: var(--text-primary);
        }

        .batch-modal__btn--secondary:hover {
          background: var(--hover-bg, #e5e7eb);
        }

        .batch-modal__btn--danger {
          background: var(--error-color, #dc2626);
          color: white;
        }

        .batch-modal__btn--danger:hover {
          background: var(--error-hover, #b91c1c);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .batch-actions {
            background: var(--surface-color-dark, #1f2937);
            border-color: var(--border-color-dark, #374151);
          }

          .checkbox {
            background: var(--input-bg-dark, #111827);
            border-color: var(--border-color-dark, #4b5563);
          }

          .batch-actions__format {
            background: var(--input-bg-dark, #111827);
            border-color: var(--border-color-dark, #4b5563);
          }

          .batch-modal {
            background: var(--surface-color-dark, #1f2937);
          }

          .batch-modal__header,
          .batch-modal__footer {
            border-color: var(--border-color-dark, #374151);
          }

          .batch-modal__btn--secondary {
            background: var(--surface-color-dark, #374151);
          }

          .batch-modal__btn--secondary:hover {
            background: var(--hover-bg-dark, #4b5563);
          }
        }
      `}</style>
    </>
  );
};

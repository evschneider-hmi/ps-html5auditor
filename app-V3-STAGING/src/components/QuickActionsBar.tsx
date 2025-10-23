import React from 'react';
import { Icon } from './Icon';
import './QuickActionsBar.css';

interface QuickActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onDelete: () => void;
  onExport: () => void;
  onShowHelp: () => void;
}

/**
 * Sticky quick actions toolbar that appears when items are selected
 * Provides quick access to batch operations and keyboard shortcuts
 */
export function QuickActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onDelete,
  onExport,
  onShowHelp,
}: QuickActionsBarProps) {
  const hasSelection = selectedCount > 0;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  // Don't show if no creatives
  if (totalCount === 0) return null;

  return (
    <div className={`quick-actions-bar ${hasSelection ? 'has-selection' : ''}`}>
      <div className="quick-actions-content">
        {/* Selection info */}
        <div className="quick-actions-info">
          {hasSelection ? (
            <>
              <Icon name="check" size={16} />
              <span className="selection-count">
                {selectedCount} of {totalCount} selected
              </span>
            </>
          ) : (
            <>
              <Icon name="info" size={16} />
              <span className="quick-hint">
                Select creatives to perform batch actions
              </span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="quick-actions-buttons">
          {/* Select/Deselect */}
          {!allSelected ? (
            <button
              className="quick-action-btn"
              onClick={onSelectAll}
              title="Select all (Ctrl+A)"
            >
              <Icon name="check" size={16} />
              <span>Select All</span>
            </button>
          ) : (
            <button
              className="quick-action-btn"
              onClick={onDeselectAll}
              title="Deselect all (Ctrl+Shift+A)"
            >
              <Icon name="close" size={16} />
              <span>Deselect All</span>
            </button>
          )}

          {/* Export */}
          <button
            className="quick-action-btn"
            onClick={onExport}
            disabled={!hasSelection}
            title="Export selected (Ctrl+E)"
          >
            <Icon name="download" size={16} />
            <span>Export</span>
          </button>

          {/* Delete */}
          <button
            className="quick-action-btn danger"
            onClick={onDelete}
            disabled={!hasSelection}
            title="Delete selected (Delete)"
          >
            <Icon name="close" size={16} />
            <span>Delete</span>
          </button>

          {/* Divider */}
          <div className="quick-actions-divider" />

          {/* Help */}
          <button
            className="quick-action-btn secondary"
            onClick={onShowHelp}
            title="Keyboard shortcuts (?)"
          >
            <Icon name="help" size={16} />
            <span>Shortcuts</span>
          </button>
        </div>
      </div>
    </div>
  );
}

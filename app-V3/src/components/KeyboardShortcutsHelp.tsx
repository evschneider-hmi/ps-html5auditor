import React from 'react';
import { Icon } from './Icon';
import { getKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './KeyboardShortcutsHelp.css';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal displaying all available keyboard shortcuts
 * Organized by category for easy reference
 */
export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  const shortcuts = getKeyboardShortcuts();
  const categories = {
    selection: shortcuts.filter((s) => s.category === 'selection'),
    actions: shortcuts.filter((s) => s.category === 'actions'),
    navigation: shortcuts.filter((s) => s.category === 'navigation'),
    general: shortcuts.filter((s) => s.category === 'general'),
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="shortcuts-backdrop"
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close shortcuts help"
      />

      {/* Modal */}
      <div className="shortcuts-modal" role="dialog" aria-labelledby="shortcuts-title">
        {/* Header */}
        <div className="shortcuts-header">
          <div className="shortcuts-title-row">
            <Icon name="help" size={24} />
            <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          </div>
          <button
            className="shortcuts-close"
            onClick={onClose}
            aria-label="Close shortcuts help"
            title="Close (Esc)"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="shortcuts-content">
          {/* Selection */}
          <section className="shortcuts-category">
            <h3>
              <Icon name="check" size={18} />
              Selection
            </h3>
            <div className="shortcuts-list">
              {categories.selection.map((shortcut, i) => (
                <div key={i} className="shortcut-item">
                  <kbd className="shortcut-key">{shortcut.key}</kbd>
                  <span className="shortcut-description">{shortcut.description}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <section className="shortcuts-category">
            <h3>
              <Icon name="download" size={18} />
              Actions
            </h3>
            <div className="shortcuts-list">
              {categories.actions.map((shortcut, i) => (
                <div key={i} className="shortcut-item">
                  <kbd className="shortcut-key">{shortcut.key}</kbd>
                  <span className="shortcut-description">{shortcut.description}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Navigation */}
          <section className="shortcuts-category">
            <h3>
              <Icon name="search" size={18} />
              Navigation
            </h3>
            <div className="shortcuts-list">
              {categories.navigation.map((shortcut, i) => (
                <div key={i} className="shortcut-item">
                  <kbd className="shortcut-key">{shortcut.key}</kbd>
                  <span className="shortcut-description">{shortcut.description}</span>
                </div>
              ))}
            </div>
          </section>

          {/* General */}
          <section className="shortcuts-category">
            <h3>
              <Icon name="info" size={18} />
              General
            </h3>
            <div className="shortcuts-list">
              {categories.general.map((shortcut, i) => (
                <div key={i} className="shortcut-item">
                  <kbd className="shortcut-key">{shortcut.key}</kbd>
                  <span className="shortcut-description">{shortcut.description}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="shortcuts-footer">
          <p className="shortcuts-tip">
            <Icon name="info" size={16} />
            Tip: Press <kbd>?</kbd> anytime to see this help
          </p>
        </div>
      </div>
    </>
  );
}

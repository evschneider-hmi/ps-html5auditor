import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  description: string;
  category: 'selection' | 'actions' | 'navigation' | 'general';
  handler: (e: KeyboardEvent) => void;
}

export interface KeyboardShortcutHandlers {
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
  onFocusSearch?: () => void;
  onClearSearch?: () => void;
  onShowHelp?: () => void;
  onToggleTheme?: () => void;
  onNewWorkspace?: () => void;
  onCloseWorkspace?: () => void;
  onNextWorkspace?: () => void;
  onPreviousWorkspace?: () => void;
}

/**
 * Custom hook for managing global keyboard shortcuts
 * Provides a consistent keyboard-driven workflow for power users
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers) {
  const {
    onSelectAll,
    onDeselectAll,
    onDelete,
    onExport,
    onFocusSearch,
    onClearSearch,
    onShowHelp,
    onToggleTheme,
    onNewWorkspace,
    onCloseWorkspace,
    onNextWorkspace,
    onPreviousWorkspace,
  } = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore shortcuts when typing in input fields (except for Escape)
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Handle Escape always (even in inputs)
      if (e.key === 'Escape') {
        if (isInput) {
          // Blur the input to unfocus it
          target.blur();
        } else if (onClearSearch) {
          onClearSearch();
        } else if (onDeselectAll) {
          onDeselectAll();
        }
        return;
      }

      // Skip other shortcuts when in input fields
      if (isInput && e.key !== '/') {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + A: Select all creatives
      if (modKey && e.key.toLowerCase() === 'a' && onSelectAll) {
        e.preventDefault();
        onSelectAll();
        return;
      }

      // Ctrl/Cmd + Shift + A: Deselect all
      if (modKey && e.shiftKey && e.key.toLowerCase() === 'a' && onDeselectAll) {
        e.preventDefault();
        onDeselectAll();
        return;
      }

      // Delete/Backspace: Delete selected items (not in inputs)
      if (
        !isInput &&
        (e.key === 'Delete' || (e.key === 'Backspace' && modKey)) &&
        onDelete
      ) {
        e.preventDefault();
        onDelete();
        return;
      }

      // Ctrl/Cmd + E: Export selected
      if (modKey && e.key.toLowerCase() === 'e' && onExport) {
        e.preventDefault();
        onExport();
        return;
      }

      // Ctrl/Cmd + F or /: Focus search
      if (
        ((modKey && e.key.toLowerCase() === 'f') || e.key === '/') &&
        onFocusSearch
      ) {
        e.preventDefault();
        onFocusSearch();
        return;
      }

      // ?: Show keyboard shortcuts help
      if (e.key === '?' && !isInput && onShowHelp) {
        e.preventDefault();
        onShowHelp();
        return;
      }

      // Ctrl/Cmd + T: New workspace
      if (modKey && e.key.toLowerCase() === 't' && onNewWorkspace) {
        e.preventDefault();
        onNewWorkspace();
        return;
      }

      // Ctrl/Cmd + W: Close current workspace
      if (modKey && e.key.toLowerCase() === 'w' && onCloseWorkspace) {
        e.preventDefault();
        onCloseWorkspace();
        return;
      }

      // Ctrl/Cmd + Tab: Next workspace
      if (modKey && e.key === 'Tab' && !e.shiftKey && onNextWorkspace) {
        e.preventDefault();
        onNextWorkspace();
        return;
      }

      // Ctrl/Cmd + Shift + Tab: Previous workspace
      if (modKey && e.key === 'Tab' && e.shiftKey && onPreviousWorkspace) {
        e.preventDefault();
        onPreviousWorkspace();
        return;
      }

      // Ctrl/Cmd + D: Toggle dark mode
      if (modKey && e.key.toLowerCase() === 'd' && onToggleTheme) {
        e.preventDefault();
        onToggleTheme();
        return;
      }
    },
    [
      onSelectAll,
      onDeselectAll,
      onDelete,
      onExport,
      onFocusSearch,
      onClearSearch,
      onShowHelp,
      onToggleTheme,
      onNewWorkspace,
      onCloseWorkspace,
      onNextWorkspace,
      onPreviousWorkspace,
    ]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * Get list of all keyboard shortcuts for display in help modal
 */
export function getKeyboardShortcuts(): KeyboardShortcut[] {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return [
    // Selection shortcuts
    {
      key: `${modKey}+A`,
      description: 'Select all creatives',
      category: 'selection',
      handler: () => {},
    },
    {
      key: `${modKey}+Shift+A`,
      description: 'Deselect all',
      category: 'selection',
      handler: () => {},
    },
    {
      key: 'Escape',
      description: 'Clear search / Deselect all / Unfocus input',
      category: 'selection',
      handler: () => {},
    },

    // Action shortcuts
    {
      key: 'Delete',
      description: 'Delete selected creatives',
      category: 'actions',
      handler: () => {},
    },
    {
      key: `${modKey}+E`,
      description: 'Export selected creatives',
      category: 'actions',
      handler: () => {},
    },

    // Navigation shortcuts
    {
      key: `${modKey}+F`,
      description: 'Focus search input',
      category: 'navigation',
      handler: () => {},
    },
    {
      key: '/',
      description: 'Focus search input',
      category: 'navigation',
      handler: () => {},
    },
    {
      key: `${modKey}+T`,
      description: 'New workspace',
      category: 'navigation',
      handler: () => {},
    },
    {
      key: `${modKey}+W`,
      description: 'Close workspace',
      category: 'navigation',
      handler: () => {},
    },
    {
      key: `${modKey}+Tab`,
      description: 'Next workspace',
      category: 'navigation',
      handler: () => {},
    },
    {
      key: `${modKey}+Shift+Tab`,
      description: 'Previous workspace',
      category: 'navigation',
      handler: () => {},
    },

    // General shortcuts
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      category: 'general',
      handler: () => {},
    },
    {
      key: `${modKey}+D`,
      description: 'Toggle dark mode',
      category: 'general',
      handler: () => {},
    },
  ];
}

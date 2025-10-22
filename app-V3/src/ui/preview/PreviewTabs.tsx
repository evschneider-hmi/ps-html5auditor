/**
 * Preview Tabs Component
 * 
 * Tab navigation for switching between preview views.
 * 
 * Quality Principles:
 * - Efficiency: Minimal re-renders, keyboard shortcuts
 * - Organization: Simple, focused component
 * - Consistency: Standard tab pattern, accessible
 * - Maneuverability: Easy to add/remove tabs, test interactions
 */

import React, { useCallback } from 'react';
import type { PreviewTab } from './types';

export interface PreviewTabsProps {
  /** Currently active tab */
  activeTab: PreviewTab;
  
  /** Callback when tab changes */
  onTabChange: (tab: PreviewTab) => void;
  
  /** Available tabs (for Phase 5A, only 'preview') */
  tabs: PreviewTab[];
  
  /** CSS class name */
  className?: string;
}

/**
 * Tab labels (display text)
 */
const TAB_LABELS: Record<PreviewTab, string> = {
  preview: 'Preview',
  source: 'Source',
  assets: 'Assets',
  json: 'JSON',
  diagnostics: 'Diagnostics'
};

/**
 * Tab icons (simple text characters)
 */
const TAB_ICONS: Record<PreviewTab, string> = {
  preview: 'P',
  source: 'S',
  assets: 'A',
  json: 'J',
  diagnostics: 'D'
};

/**
 * Tab navigation component
 * 
 * Features:
 * - Keyboard navigation (Arrow keys)
 * - Accessible (ARIA labels, role="tablist")
 * - Smooth transitions
 * - Responsive layout
 * 
 * @example
 * ```tsx
 * <PreviewTabs
 *   activeTab="preview"
 *   onTabChange={(tab) => setActiveTab(tab)}
 *   tabs={['preview', 'source', 'assets', 'json']}
 * />
 * ```
 */
export const PreviewTabs: React.FC<PreviewTabsProps> = ({
  activeTab,
  onTabChange,
  tabs,
  className = ''
}) => {
  /**
   * Handles tab click
   */
  const handleTabClick = useCallback(
    (tab: PreviewTab) => {
      if (tab !== activeTab) {
        onTabChange(tab);
      }
    },
    [activeTab, onTabChange]
  );
  
  /**
   * Handles keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, currentIndex: number) => {
      let newIndex = currentIndex;
      
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        newIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      } else {
        return;
      }
      
      const newTab = tabs[newIndex];
      if (newTab) {
        onTabChange(newTab);
      }
    },
    [tabs, onTabChange]
  );
  
  return (
    <div className={`preview-tabs ${className}`} role="tablist">
      {tabs.map((tab, index) => {
        const isActive = tab === activeTab;
        const label = TAB_LABELS[tab];
        const icon = TAB_ICONS[tab];
        
        return (
          <button
            key={tab}
            className={`preview-tab ${isActive ? 'preview-tab--active' : ''}`}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            tabIndex={isActive ? 0 : -1}
            onClick={() => handleTabClick(tab)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            <span className="preview-tab__icon">{icon}</span>
            <span className="preview-tab__label">{label}</span>
          </button>
        );
      })}
      
      <style>{`
        .preview-tabs {
          display: flex;
          gap: 4px;
        }
        
        .preview-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #64748b;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 150ms ease;
          position: relative;
        }
        
        .preview-tab:hover {
          background: rgba(59, 130, 246, 0.08);
          color: #3b82f6;
        }
        
        .preview-tab:focus {
          outline: none;
          background: rgba(59, 130, 246, 0.12);
        }
        
        .preview-tab--active {
          color: #3b82f6;
          border-bottom-color: #3b82f6;
        }
        
        .preview-tab--active:hover {
          background: rgba(59, 130, 246, 0.12);
        }
        
        .preview-tab__icon {
          font-size: 16px;
          line-height: 1;
        }
        
        .preview-tab__label {
          line-height: 1;
        }
        
        /* Keyboard focus indicator */
        .preview-tab:focus-visible::after {
          content: '';
          position: absolute;
          inset: 2px;
          border: 2px solid #3b82f6;
          border-radius: 4px;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
};

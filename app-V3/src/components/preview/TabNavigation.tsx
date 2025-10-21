import React from 'react';

export type PreviewTab = 'preview' | 'source' | 'assets' | 'json';

export interface TabNavigationProps {
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
}

const tabs: { id: PreviewTab; label: string }[] = [
  { id: 'preview', label: 'Preview' },
  { id: 'source', label: 'Source' },
  { id: 'assets', label: 'Assets' },
  { id: 'json', label: 'JSON' },
];

export const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--border)',
        padding: '0 12px',
        background: 'var(--surface)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--primary)' : 'var(--text)',
              background: 'transparent',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              position: 'relative',
              top: 1,
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--primary)';
                e.currentTarget.style.opacity = '0.7';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text)';
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

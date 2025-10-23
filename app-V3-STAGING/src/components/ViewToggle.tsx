import React from 'react';
import { Icon } from './Icon';
import './ViewToggle.css';

export type ViewMode = 'list' | 'grid';

interface ViewToggleProps {
  mode: ViewMode;
  onToggle: (mode: ViewMode) => void;
}

export const ViewToggle: React.FC<ViewToggleProps> = ({ mode, onToggle }) => {
  return (
    <div className="view-toggle">
      <button
        className={`view-toggle-btn ${mode === 'list' ? 'active' : ''}`}
        onClick={() => onToggle('list')}
        title="List view"
        aria-label="Switch to list view"
      >
        <Icon name="list" size={18} />
        <span className="view-toggle-label">List</span>
      </button>
      <button
        className={`view-toggle-btn ${mode === 'grid' ? 'active' : ''}`}
        onClick={() => onToggle('grid')}
        title="Grid view"
        aria-label="Switch to grid view"
      >
        <Icon name="grid" size={18} />
        <span className="view-toggle-label">Grid</span>
      </button>
    </div>
  );
};

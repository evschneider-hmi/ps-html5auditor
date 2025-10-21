import React from 'react';
import { Icon } from './Icon';
import './SortControls.css';

export type SortField = 'name' | 'status' | 'size' | 'date' | 'issues';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface SortControlsProps {
  sortConfig: SortConfig;
  onSort: (field: SortField) => void;
}

const SORT_OPTIONS: Array<{ field: SortField; label: string }> = [
  { field: 'name', label: 'Name' },
  { field: 'status', label: 'Status' },
  { field: 'size', label: 'File Size' },
  { field: 'date', label: 'Date' },
  { field: 'issues', label: 'Issues' },
];

export const SortControls: React.FC<SortControlsProps> = ({ sortConfig, onSort }) => {
  return (
    <div className="sort-controls">
      <span className="sort-label">Sort by:</span>
      <div className="sort-buttons">
        {SORT_OPTIONS.map(({ field, label }) => {
          const isActive = sortConfig.field === field;
          const direction = isActive ? sortConfig.direction : 'asc';
          
          return (
            <button
              key={field}
              className={`sort-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSort(field)}
              title={`Sort by ${label} ${isActive ? (direction === 'asc' ? 'descending' : 'ascending') : ''}`}
            >
              <span>{label}</span>
              {isActive && (
                <span className={`sort-arrow ${direction}`}>
                  {direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

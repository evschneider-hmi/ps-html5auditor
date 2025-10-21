import React, { useState, useEffect } from 'react';
import { Finding } from '../logic/types';
import { Icon } from './Icon';
import { Badge } from './Badge';
import './FilterControls.css';

export type StatusFilter = 'ALL' | 'FAIL' | 'WARN' | 'PASS';

export interface FilterState {
  status: StatusFilter;
  searchQuery: string;
}

export interface FilterControlsProps {
  findings: Finding[];
  onFilterChange: (filtered: Finding[], filterState: FilterState) => void;
}

const STORAGE_KEY = 'creative-suite-auditor-filters';

export const FilterControls: React.FC<FilterControlsProps> = ({
  findings,
  onFilterChange,
}) => {
  const [filterState, setFilterState] = useState<FilterState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure searchQuery exists (backward compatibility)
        return {
          status: parsed.status || 'ALL',
          searchQuery: parsed.searchQuery || '',
        };
      }
      return { status: 'ALL', searchQuery: '' };
    } catch {
      return { status: 'ALL', searchQuery: '' };
    }
  });

  // Apply filters whenever findings or filter state changes
  useEffect(() => {
    const filtered = findings.filter((finding) => {
      // Status filter
      if (filterState.status !== 'ALL' && finding.severity !== filterState.status) {
        return false;
      }

      // Search query filter (case-insensitive, searches across multiple fields)
      if (filterState.searchQuery && filterState.searchQuery.trim()) {
        const query = filterState.searchQuery.toLowerCase();
        const searchableFields = [
          finding.id,
          finding.title,
          finding.description || '',
          ...(finding.messages || []),
          ...(finding.offenders || []).map(o => o.path || ''),
          ...(finding.offenders || []).map(o => o.detail || ''),
        ].join(' ').toLowerCase();

        if (!searchableFields.includes(query)) {
          return false;
        }
      }

      return true;
    });

    onFilterChange(filtered, filterState);
  }, [findings, filterState, onFilterChange]);

  // Save filters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filterState));
    } catch (error) {
      console.warn('Failed to save filter state:', error);
    }
  }, [filterState]);

  const updateFilter = (key: keyof FilterState, value: StatusFilter | string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilterState({ status: 'ALL', searchQuery: '' });
  };

  const hasActiveFilters = filterState.status !== 'ALL' || (filterState.searchQuery && filterState.searchQuery.trim() !== '');

  // Count findings by status
  type CountsType = { FAIL: number; WARN: number; PASS: number; total: number };
  const counts = findings.reduce(
    (acc, f) => {
      if (f.severity === 'FAIL' || f.severity === 'WARN' || f.severity === 'PASS') {
        acc[f.severity as keyof Omit<CountsType, 'total'>] = (acc[f.severity as keyof Omit<CountsType, 'total'>] || 0) + 1;
      }
      acc.total++;
      return acc;
    },
    { FAIL: 0, WARN: 0, PASS: 0, total: 0 } as CountsType
  );

  // Count filtered findings
  const filteredCount = findings.filter((finding) => {
    if (filterState.status !== 'ALL' && finding.severity !== filterState.status) {
      return false;
    }
    if (filterState.searchQuery && filterState.searchQuery.trim()) {
      const query = filterState.searchQuery.toLowerCase();
      const searchableFields = [
        finding.id,
        finding.title,
        finding.description || '',
        ...(finding.messages || []),
        ...(finding.offenders || []).map(o => o.path || ''),
        ...(finding.offenders || []).map(o => o.detail || ''),
      ].join(' ').toLowerCase();

      if (!searchableFields.includes(query)) {
        return false;
      }
    }
    return true;
  }).length;

  return (
    <div className="filter-controls">
      <div className="filter-controls-header">
        <div className="filter-controls-title">
          <Icon name="filter" size={18} />
          <span>Filters</span>
        </div>
        {hasActiveFilters && (
          <button
            className="filter-clear-btn"
            onClick={clearFilters}
            title="Clear all filters"
          >
            <Icon name="close" size={14} />
            Clear
          </button>
        )}
      </div>

      <div className="filter-controls-body">
        {/* Search Input */}
        <div className="filter-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            className="filter-search-input"
            placeholder="Search checks..."
            value={filterState.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
          />
          {filterState.searchQuery && (
            <button
              className="filter-search-clear"
              onClick={() => updateFilter('searchQuery', '')}
              title="Clear search"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="filter-group">
          <label className="filter-label">Status</label>
          <div className="filter-options">
            <button
              className={`filter-option ${filterState.status === 'ALL' ? 'active' : ''}`}
              onClick={() => updateFilter('status', 'ALL')}
            >
              All
              <Badge variant="neutral" size="sm" count={counts.total} />
            </button>
            <button
              className={`filter-option ${filterState.status === 'FAIL' ? 'active' : ''}`}
              onClick={() => updateFilter('status', 'FAIL')}
            >
              <Icon name="error" size={14} />
              Fail
              <Badge variant="error" size="sm" count={counts.FAIL} />
            </button>
            <button
              className={`filter-option ${filterState.status === 'WARN' ? 'active' : ''}`}
              onClick={() => updateFilter('status', 'WARN')}
            >
              <Icon name="warning" size={14} />
              Warn
              <Badge variant="warning" size="sm" count={counts.WARN} />
            </button>
            <button
              className={`filter-option ${filterState.status === 'PASS' ? 'active' : ''}`}
              onClick={() => updateFilter('status', 'PASS')}
            >
              <Icon name="check" size={14} />
              Pass
              <Badge variant="success" size="sm" count={counts.PASS} />
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="filter-controls-footer">
        <span className="filter-results-count">
          Showing {filteredCount} of {counts.total} checks
        </span>
      </div>
    </div>
  );
};

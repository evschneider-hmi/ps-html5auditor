import React, { useState, useEffect, useRef } from 'react';
import type { Upload } from '../types';
import type { Finding } from '../logic/types';
import { ProfileBadge } from './ProfileBadge';
import { Icon } from './Icon';
import type { SortConfig } from './SortControls';
import { isPriorityCheck } from '../utils/grouping';

interface ResultsTableProps {
  uploads: Upload[];
  onSelectUpload: (id: string) => void;
  onRemoveUpload: (id: string) => void;
  selectedUploadId: string | null;
  // Multi-select support
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  multiSelectMode?: boolean;
  // Sorting support
  sortConfig?: SortConfig;
  onSort?: (field: SortConfig['field']) => void;
}

type ColKey =
  | 'name'
  | 'status'
  | 'dimensions'
  | 'issues'
  | 'fileSize'
  | 'initialKB'
  | 'politeKB'
  | 'requests'
  | 'profile';

interface Column {
  key: ColKey;
  label: string;
  minWidth: number;
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Name', minWidth: 200 },
  { key: 'status', label: 'Status', minWidth: 80 },
  { key: 'dimensions', label: 'Dimensions', minWidth: 100 },
  { key: 'issues', label: 'Issues', minWidth: 100 },
  { key: 'fileSize', label: 'File Size', minWidth: 100 },
  { key: 'initialKB', label: 'Initial KB', minWidth: 100 },
  { key: 'politeKB', label: 'Polite KB', minWidth: 100 },
  { key: 'requests', label: 'Requests', minWidth: 100 },
  { key: 'profile', label: 'Profile', minWidth: 100 },
];

// Map column keys to sort fields
const COLUMN_TO_SORT_FIELD: Record<ColKey, SortConfig['field'] | null> = {
  name: 'name',
  status: 'status',
  dimensions: null,
  issues: 'issues',
  fileSize: 'size',
  initialKB: null,
  politeKB: null,
  requests: null,
  profile: null,
};

const STORAGE_KEY = 'ext_v3_table_widths';

export const ResultsTable: React.FC<ResultsTableProps> = ({
  uploads,
  onSelectUpload,
  onRemoveUpload,
  selectedUploadId,
  selectedIds = new Set(),
  onToggleSelect,
  multiSelectMode = false,
  sortConfig,
  onSort,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate stored widths against min widths
        const validated: Record<string, number> = {};
        for (const col of COLUMNS) {
          if (typeof parsed[col.key] === 'number' && parsed[col.key] >= col.minWidth) {
            validated[col.key] = parsed[col.key];
          }
        }
        return validated;
      }
    } catch {}
    return {};
  });

  const [hoveredRemoveId, setHoveredRemoveId] = useState<string | null>(null);
  const dragRef = useRef<{
    colKey: ColKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Persist column widths
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {}
  }, [columnWidths]);

  // Handle column resize drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      e.preventDefault();

      const { colKey, startX, startWidth } = dragRef.current;
      const diff = e.clientX - startX;
      const col = COLUMNS.find(c => c.key === colKey);
      if (!col) return;

      const newWidth = Math.max(col.minWidth, startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      if (dragRef.current) {
        dragRef.current = null;
        document.body.style.cursor = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleResizeStart = (e: React.MouseEvent, colKey: ColKey) => {
    e.preventDefault();
    const th = (e.target as HTMLElement).closest('th');
    if (!th) return;

    const startWidth = columnWidths[colKey] || th.getBoundingClientRect().width;
    dragRef.current = {
      colKey,
      startX: e.clientX,
      startWidth,
    };
    document.body.style.cursor = 'col-resize';
  };

  // Compute status and issues for each upload
  // Overall status determined by Priority checks only (matches V2 behavior)
  // Status: FAIL if any priority check fails, otherwise PASS (warnings don't affect status)
  const getUploadStatus = (upload: Upload) => {
    const priorityFindings = upload.findings.filter((f: Finding) => isPriorityCheck(f));
    const fails = priorityFindings.filter((f: Finding) => f.severity === 'FAIL').length;

    return fails > 0 ? 'FAIL' : 'PASS';
  };

  const getIssuesSummary = (upload: Upload) => {
    // Issue counts based on Priority checks only
    const priorityFindings = upload.findings.filter((f: Finding) => isPriorityCheck(f));
    const fails = priorityFindings.filter((f: Finding) => f.severity === 'FAIL').length;
    const warns = priorityFindings.filter((f: Finding) => f.severity === 'WARN').length;
    return { fails, warns };
  };

  const getDimensions = (upload: Upload) => {
    const adSize = upload.bundleResult.adSize;
    if (!adSize) return 'N/A';
    return `${adSize.width}×${adSize.height}`;
  };

  const getProfiles = (upload: Upload): ('CM360' | 'IAB' | 'BOTH')[] => {
    // Collect all unique profiles from findings
    const profileSet = new Set<'CM360' | 'IAB' | 'BOTH'>();
    
    for (const finding of upload.findings) {
      if (finding.profiles) {
        for (const profile of finding.profiles) {
          profileSet.add(profile);
        }
      }
    }

    // If we have both CM360 and IAB, return BOTH
    if (profileSet.has('CM360') && profileSet.has('IAB')) {
      return ['BOTH'];
    }

    return Array.from(profileSet);
  };

  if (uploads.length === 0) return null;

  return (
    <div style={{ overflowX: 'auto', marginTop: 16 }}>
      <style>{`
        .results-table {
          width: 100%;
          min-width: max-content;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
        }

        .results-table thead th {
          position: sticky;
          top: 0;
          background: var(--surface);
          color: var(--muted);
          font-weight: 600;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 2px solid var(--border);
          white-space: nowrap;
          user-select: none;
        }

        .results-table thead th .resize-handle {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          cursor: col-resize;
          background: transparent;
          transition: background 120ms ease;
        }

        .results-table thead th .resize-handle:hover {
          background: var(--primary);
        }

        .results-table tbody tr {
          transition: background 120ms ease;
          cursor: pointer;
        }

        .results-table tbody tr:hover {
          background: var(--surface-2);
        }

        .results-table tbody tr.selected {
          background: rgba(99, 102, 241, 0.08);
        }

        .results-table tbody tr.remove-hover {
          opacity: 0.5;
        }

        .results-table tbody td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .results-table .name-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          position: relative;
          min-width: 0;
          max-width: 100%;
        }

        .results-table .name-cell .remove-btn {
          opacity: 0;
          transform: scale(0.88);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--surface-2);
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 120ms ease;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
        }

        .results-table .name-cell:hover .remove-btn,
        .results-table .name-cell .remove-btn:focus-visible {
          opacity: 1;
          transform: scale(1);
        }

        .results-table .name-cell .remove-btn:hover {
          background: var(--danger);
          color: white;
          border-color: var(--danger);
        }

        .results-table .status-badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .results-table .status-badge.pass {
          background: var(--pass-bg);
          color: var(--pass-text);
        }

        .results-table .status-badge.warn {
          background: var(--warn-bg);
          color: var(--warn-text);
        }

        .results-table .status-badge.fail {
          background: var(--fail-bg);
          color: var(--fail-text);
        }

        .results-table .issues-cell {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .results-table .issue-count {
          font-size: 12px;
          font-weight: 500;
        }

        .results-table .issue-count.fail {
          color: var(--fail-text);
        }

        .results-table .issue-count.warn {
          color: var(--warn-text);
        }

        .results-table .row-checkbox {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
        }

        .results-table .checkbox {
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

        .results-table .checkbox:hover {
          border-color: var(--primary-color, #4f46e5);
        }

        .results-table .checkbox.checked {
          background: var(--primary-color, #4f46e5);
          border-color: var(--primary-color, #4f46e5);
          color: white;
        }
      `}</style>

      <table ref={tableRef} className="results-table" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {multiSelectMode && <col style={{ width: '48px' }} />}
          {COLUMNS.map(col => (
            <col
              key={col.key}
              style={{
                width: columnWidths[col.key]
                  ? `${columnWidths[col.key]}px`
                  : `${col.minWidth}px`,
              }}
            />
          ))}
        </colgroup>

        <thead>
          <tr>
            {multiSelectMode && <th style={{ width: 48, padding: '10px' }}></th>}
            {COLUMNS.map(col => {
              const sortField = COLUMN_TO_SORT_FIELD[col.key];
              const isSortable = sortField && onSort;
              const isActive = sortConfig && sortConfig.field === sortField;
              
              return (
                <th 
                  key={col.key} 
                  style={{ 
                    position: 'relative',
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                  }}
                  onClick={() => isSortable && onSort(sortField)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{col.label}</span>
                    {isActive && (
                      <span style={{ fontSize: 11 }}>
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                  <div
                    className="resize-handle"
                    onMouseDown={e => handleResizeStart(e, col.key)}
                    title="Drag to resize"
                  />
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {uploads.map(upload => {
            const status = getUploadStatus(upload);
            const { fails, warns } = getIssuesSummary(upload);
            const dimensions = getDimensions(upload);
            const profiles = getProfiles(upload);
            const selected = selectedUploadId === upload.id;
            const isSelected = multiSelectMode && selectedIds.has(upload.id);
            const isHovered = hoveredRemoveId === upload.id;

            const handleRowClick = () => {
              // Always open preview on row click (checkbox handles selection separately)
              onSelectUpload(upload.id);
            };

            return (
              <tr
                key={upload.id}
                className={`${selected || isSelected ? 'selected' : ''} ${isHovered ? 'remove-hover' : ''}`}
                onClick={handleRowClick}
              >
                {/* Checkbox (multi-select mode) */}
                {multiSelectMode && (
                  <td style={{ padding: '10px' }}>
                    <button
                      className="row-checkbox"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleSelect) {
                          onToggleSelect(upload.id);
                        }
                      }}
                      aria-label={`${isSelected ? 'Deselect' : 'Select'} ${upload.bundle.name}`}
                    >
                      <div className={`checkbox ${isSelected ? 'checked' : ''}`}>
                        {isSelected && <Icon name="check" size={14} />}
                      </div>
                    </button>
                  </td>
                )}

                {/* Name */}
                <td>
                  <div className="name-cell">
                    <button
                      className="remove-btn"
                      onClick={e => {
                        e.stopPropagation();
                        onRemoveUpload(upload.id);
                      }}
                      onMouseEnter={() => setHoveredRemoveId(upload.id)}
                      onMouseLeave={() => setHoveredRemoveId(null)}
                      aria-label={`Remove ${upload.creativeMetadata?.fullName || upload.bundle.name}`}
                      title="Remove"
                    >
                      ×
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(upload.creativeMetadata?.fullName || upload.bundle.name).replace(/\.zip$/i, '')}
                      </span>
                      {upload.creativeMetadata && upload.creativeMetadata.fullName !== upload.bundle.name && (
                        <span style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {upload.bundle.name.replace(/\.zip$/i, '')}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td>
                  <span className={`status-badge ${status.toLowerCase()}`}>
                    {status}
                  </span>
                </td>

                {/* Dimensions */}
                <td style={{ color: 'var(--muted)' }}>{dimensions}</td>

                {/* Issues */}
                <td>
                  <div className="issues-cell">
                    {fails > 0 && (
                      <span className="issue-count fail">FAIL: {fails}</span>
                    )}
                    {warns > 0 && (
                      <span className="issue-count warn">WARN: {warns}</span>
                    )}
                    {fails === 0 && warns === 0 && (
                      <span style={{ color: 'var(--pass-text)' }}>None</span>
                    )}
                  </div>
                </td>

                {/* File Size */}
                <td style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(upload.bundle.bytes.length / 1024)} KB
                </td>

                {/* Initial KB */}
                <td style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {upload.bundleResult.initialBytes
                    ? `${Math.round(upload.bundleResult.initialBytes / 1024)} KB`
                    : 'N/A'}
                </td>

                {/* Polite KB (subload) */}
                <td style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {upload.bundleResult.subsequentBytes
                    ? `${Math.round(upload.bundleResult.subsequentBytes / 1024)} KB`
                    : 'N/A'}
                </td>

                {/* Requests */}
                <td style={{ color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {upload.bundleResult.initialRequests || 0} / {upload.bundleResult.totalRequests || 0}
                </td>

                {/* Profile */}
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {profiles.length > 0 ? (
                      <ProfileBadge profiles={profiles} />
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>N/A</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

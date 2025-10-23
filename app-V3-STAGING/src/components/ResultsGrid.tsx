import React, { useState } from 'react';
import type { Upload } from '../types';
import type { Finding } from '../logic/types';
import { ProfileBadge } from './ProfileBadge';
import { Icon } from './Icon';
import { isPriorityCheck } from '../utils/grouping';
import './ResultsGrid.css';

interface ResultsGridProps {
  uploads: Upload[];
  onSelectUpload: (id: string) => void;
  onRemoveUpload: (id: string) => void;
  selectedUploadId: string | null;
  // Multi-select support
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  multiSelectMode?: boolean;
}

export const ResultsGrid: React.FC<ResultsGridProps> = ({
  uploads,
  onSelectUpload,
  onRemoveUpload,
  selectedUploadId,
  selectedIds = new Set(),
  onToggleSelect,
  multiSelectMode = false,
}) => {
  const [hoveredRemoveId, setHoveredRemoveId] = useState<string | null>(null);

  if (!uploads.length) {
    return (
      <div className="results-grid-empty">
        <Icon name="folder" size={48} color="var(--muted)" />
        <p>No creatives to display</p>
      </div>
    );
  }

  return (
    <div className="results-grid">
      {uploads.map((upload) => {
        const selected = selectedUploadId === upload.id;
        const isSelected = selectedIds.has(upload.id);
        const isHovered = hoveredRemoveId === upload.id;

        // Calculate status metrics from Priority checks only
        // Overall status and issue counts based on Priority checks (matches V2 behavior)
        const findings = upload.findings || [];
        const priorityFindings = findings.filter((f: Finding) => isPriorityCheck(f));
        
        const fails = priorityFindings.filter((f: Finding) => f.severity === 'FAIL').length;
        const warns = priorityFindings.filter((f: Finding) => f.severity === 'WARN').length;
        const passes = priorityFindings.filter((f: Finding) => f.severity === 'PASS').length;
        
        // Status: FAIL if any priority check fails, otherwise PASS (warnings don't affect status)
        const status = fails > 0 ? 'FAIL' : 'PASS';
        
        const dimensions = upload.bundleResult.adSize
          ? `${upload.bundleResult.adSize.width}×${upload.bundleResult.adSize.height}`
          : 'N/A';

        // Extract profiles from findings
        const profiles = Array.from(
          new Set(
            findings
              .filter((f: Finding) => f.profiles && f.profiles.length > 0)
              .flatMap((f: Finding) => f.profiles || [])
          )
        );

        const handleCardClick = (e: React.MouseEvent) => {
          // Don't open preview if clicking remove button or checkbox
          if ((e.target as HTMLElement).closest('.card-remove-btn, .card-checkbox-btn')) {
            return;
          }
          // Always open preview on card click (checkbox handles selection separately)
          onSelectUpload(upload.id);
        };

        return (
          <div
            key={upload.id}
            className={`results-card ${selected || isSelected ? 'selected' : ''} ${isHovered ? 'remove-hover' : ''}`}
            onClick={handleCardClick}
          >
            {/* Card Header */}
            <div className="card-header">
              {/* Checkbox (multi-select mode) */}
              {multiSelectMode && (
                <button
                  className="card-checkbox-btn"
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
              )}

              {/* Status Badge */}
              <div className={`card-status-badge ${status.toLowerCase()}`}>
                {status}
              </div>

              {/* Remove Button */}
              <button
                className="card-remove-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveUpload(upload.id);
                }}
                onMouseEnter={() => setHoveredRemoveId(upload.id)}
                onMouseLeave={() => setHoveredRemoveId(null)}
                aria-label={`Remove ${upload.bundle.name}`}
                title="Remove"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Card Body */}
            <div className="card-body">
              {/* Name */}
              <div className="card-name" title={(upload.creativeMetadata?.fullName || upload.bundle.name).replace(/\.zip$/i, '')}>
                {(upload.creativeMetadata?.fullName || upload.bundle.name).replace(/\.zip$/i, '')}
              </div>
              
              {/* Show original filename if creative name is different */}
              {upload.creativeMetadata && upload.creativeMetadata.fullName !== upload.bundle.name && (
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                  {upload.bundle.name.replace(/\.zip$/i, '')}
                </div>
              )}

              {/* Dimensions */}
              <div className="card-dimensions">
                <Icon name="expand" size={14} />
                <span>{dimensions}</span>
              </div>

              {/* Stats Grid */}
              <div className="card-stats">
                <div className="stat">
                  <span className="stat-label">File Size</span>
                  <span className="stat-value">
                    {Math.round(upload.bundle.bytes.length / 1024)} KB
                  </span>
                </div>

                <div className="stat">
                  <span className="stat-label">Initial</span>
                  <span className="stat-value">
                    {upload.bundleResult.initialBytes
                      ? `${Math.round(upload.bundleResult.initialBytes / 1024)} KB`
                      : 'N/A'}
                  </span>
                </div>

                <div className="stat">
                  <span className="stat-label">Polite</span>
                  <span className="stat-value">
                    {upload.bundleResult.subsequentBytes
                      ? `${Math.round(upload.bundleResult.subsequentBytes / 1024)} KB`
                      : 'N/A'}
                  </span>
                </div>

                <div className="stat">
                  <span className="stat-label">Requests</span>
                  <span className="stat-value">
                    {upload.bundleResult.initialRequests || 0} / {upload.bundleResult.totalRequests || 0}
                  </span>
                </div>
              </div>

              {/* Issues */}
              <div className="card-issues">
                {fails > 0 && (
                  <div className="issue-badge fail">
                    <Icon name="error" size={14} />
                    <span>FAIL: {fails}</span>
                  </div>
                )}
                {warns > 0 && (
                  <div className="issue-badge warn">
                    <Icon name="warning" size={14} />
                    <span>WARN: {warns}</span>
                  </div>
                )}
                {fails === 0 && warns === 0 && (
                  <div className="issue-badge pass">
                    <Icon name="check" size={14} />
                    <span>All checks passed</span>
                  </div>
                )}
              </div>

              {/* Profile */}
              {profiles.length > 0 && (
                <div className="card-profile">
                  <ProfileBadge profiles={profiles} />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

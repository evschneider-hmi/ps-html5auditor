import React, { useState, useEffect, useMemo } from 'react';
import { Finding } from '../logic/types';
import { Icon } from './Icon';
import { StatusBadge } from './Badge';
import { HelpButton } from './HelpButton';
import { getHelpContent } from '../data/helpContent';
import './CheckSection.css';

export interface CheckSectionProps {
  title: string;
  helpKey?: string;
  findings: Finding[];
  children: React.ReactNode;
  defaultExpanded?: boolean;
  storageKey?: string;
}

export const CheckSection: React.FC<CheckSectionProps> = ({
  title,
  helpKey,
  findings,
  children,
  defaultExpanded = true,
  storageKey,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (!storageKey) return defaultExpanded;
    try {
      const saved = localStorage.getItem(storageKey);
      return saved !== null ? JSON.parse(saved) : defaultExpanded;
    } catch {
      return defaultExpanded;
    }
  });

  // Save expanded state to localStorage
  useEffect(() => {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(isExpanded));
      } catch (error) {
        console.warn('Failed to save section state:', error);
      }
    }
  }, [isExpanded, storageKey]);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  // Count findings by severity (memoized for Phase 5.4 optimization)
  const counts = useMemo(() => {
    return findings.reduce(
      (acc, f) => {
        if (f.severity === 'FAIL') acc.fail++;
        else if (f.severity === 'WARN') acc.warn++;
        else if (f.severity === 'PASS') acc.pass++;
        return acc;
      },
      { fail: 0, warn: 0, pass: 0 }
    );
  }, [findings]);

  const hasFindings = findings.length > 0;

  return (
    <div className={`check-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="check-section-header">
        <button
          className="check-section-toggle"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
        >
          <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} size={20} />
          <span className="check-section-title">{title}</span>
          <span className="check-section-count">({findings.length})</span>
        </button>

        <div className="check-section-badges">
          {counts.fail > 0 && <StatusBadge status="FAIL" count={counts.fail} size="sm" />}
          {counts.warn > 0 && <StatusBadge status="WARN" count={counts.warn} size="sm" />}
          {counts.pass > 0 && <StatusBadge status="PASS" count={counts.pass} size="sm" />}
        </div>

        {helpKey && <HelpButton content={getHelpContent(helpKey)} />}
      </div>

      {isExpanded && hasFindings && (
        <div className="check-section-content">{children}</div>
      )}

      {isExpanded && !hasFindings && (
        <div className="check-section-empty">
          <Icon name="info" size={18} color="var(--muted)" />
          <span>No checks in this section</span>
        </div>
      )}
    </div>
  );
};

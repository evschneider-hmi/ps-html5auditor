import React, { useState } from 'react';
import { FindingOffender, OffenderCategory } from '../logic/types';
import { groupOffendersByCategory, CATEGORY_META } from '../utils/categorizeOffenders';
import { Icon } from './Icon';
import './OffendersList.css';

export interface OffendersListProps {
  offenders: FindingOffender[];
  findingId?: string;
  defaultExpanded?: boolean;
}

export const OffendersList: React.FC<OffendersListProps> = ({
  offenders,
  findingId,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [expandedCategories, setExpandedCategories] = useState<Set<OffenderCategory>>(
    new Set(['code', 'assets', 'environment', 'packaging']) // All expanded by default
  );

  if (!offenders || offenders.length === 0) return null;

  const grouped = groupOffendersByCategory(offenders, findingId);
  const categoryOrder: OffenderCategory[] = ['code', 'assets', 'environment', 'packaging'];
  
  // Count non-empty categories
  const nonEmptyCategories = categoryOrder.filter((cat) => grouped[cat].length > 0);
  const hasMultipleCategories = nonEmptyCategories.length > 1;

  const toggleCategory = (category: OffenderCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <details className="offenders-section" open={isExpanded} onToggle={(e) => setIsExpanded(e.currentTarget.open)}>
      <summary className="offenders-summary">
        Offenders ({offenders.length})
      </summary>
      
      <div className="offenders-content">
        {hasMultipleCategories ? (
          // Categorized view when multiple categories exist
          categoryOrder.map((category) => {
            const items = grouped[category];
            if (items.length === 0) return null;

            const meta = CATEGORY_META[category];
            const isCategoryExpanded = expandedCategories.has(category);

            return (
              <div key={category} className="offender-category">
                <button
                  className="category-header"
                  onClick={() => toggleCategory(category)}
                  aria-expanded={isCategoryExpanded}
                >
                  <Icon name={isCategoryExpanded ? 'chevron-down' : 'chevron-right'} size={16} />
                  <Icon name={meta.icon} size={16} color={meta.color} />
                  <span className="category-label">
                    {meta.label}
                    <span className="category-count">({items.length})</span>
                  </span>
                </button>

                {isCategoryExpanded && (
                  <ul className="offenders-list">
                    {items.map((offender, idx) => (
                      <li key={idx} className="offender-item">
                        {offender.path && (
                          <div className="offender-path">
                            <Icon name="file" size={14} />
                            <span>{offender.path}</span>
                            {offender.line && <span className="offender-line">Line {offender.line}</span>}
                          </div>
                        )}
                        {offender.detail && (
                          <div className="offender-detail">{offender.detail}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        ) : (
          // Simple list view when only one category
          <ul className="offenders-list offenders-list-simple">
            {offenders.map((offender, idx) => (
              <li key={idx} className="offender-item">
                {offender.path && (
                  <div className="offender-path">
                    <Icon name="file" size={14} />
                    <span>{offender.path}</span>
                    {offender.line && <span className="offender-line">Line {offender.line}</span>}
                  </div>
                )}
                {offender.detail && (
                  <div className="offender-detail">{offender.detail}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
};

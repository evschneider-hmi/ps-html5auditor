import type { Upload } from '../types';
import type { Finding } from '../logic/types';

export type SortField = 'name' | 'status' | 'size' | 'date' | 'issues';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

/**
 * Sort uploads based on the provided sort configuration
 */
export function sortUploads(uploads: Upload[], config: SortConfig): Upload[] {
  const sorted = [...uploads];
  
  sorted.sort((a, b) => {
    let comparison = 0;
    
    switch (config.field) {
      case 'name':
        comparison = a.bundle.name.localeCompare(b.bundle.name);
        break;
        
      case 'status': {
        const getStatusPriority = (upload: Upload): number => {
          const findings = upload.findings || [];
          const fails = findings.filter((f: Finding) => f.severity === 'FAIL').length;
          const warns = findings.filter((f: Finding) => f.severity === 'WARN').length;
          
          if (fails > 0) return 3; // FAIL
          if (warns > 0) return 2; // WARN
          return 1; // PASS
        };
        
        comparison = getStatusPriority(b) - getStatusPriority(a); // Reverse for fails first
        break;
      }
        
      case 'size':
        comparison = a.bundle.bytes.length - b.bundle.bytes.length;
        break;
        
      case 'date':
        comparison = a.timestamp - b.timestamp;
        break;
        
      case 'issues': {
        const getIssueCount = (upload: Upload): number => {
          const findings = upload.findings || [];
          return findings.filter((f: Finding) => 
            f.severity === 'FAIL' || f.severity === 'WARN'
          ).length;
        };
        
        comparison = getIssueCount(b) - getIssueCount(a); // Most issues first
        break;
      }
    }
    
    // Apply direction
    return config.direction === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
}

/**
 * Toggle sort direction for a field (if same field, toggle; if new field, default to asc)
 */
export function toggleSort(current: SortConfig, field: SortField): SortConfig {
  if (current.field === field) {
    return {
      field,
      direction: current.direction === 'asc' ? 'desc' : 'asc',
    };
  }
  
  // New field - default to ascending (except for status and issues which should be desc)
  const defaultDirection: SortDirection = 
    field === 'status' || field === 'issues' ? 'desc' : 'asc';
  
  return {
    field,
    direction: defaultDirection,
  };
}

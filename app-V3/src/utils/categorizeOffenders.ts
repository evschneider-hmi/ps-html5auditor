import { FindingOffender, OffenderCategory } from '../logic/types';
import type { IconName } from '../components/Icon';

/**
 * Auto-categorize offenders based on path, detail, and context
 */
export function categorizeOffender(offender: FindingOffender, findingId?: string): OffenderCategory {
  // If already categorized, return existing category
  if (offender.category) return offender.category;

  const path = offender.path?.toLowerCase() || '';
  const detail = offender.detail?.toLowerCase() || '';
  const id = findingId?.toLowerCase() || '';
  const combined = `${path} ${detail} ${id}`;

  // ASSET ISSUES: Missing files, oversized images, wrong formats, bad paths
  if (
    combined.includes('missing') ||
    combined.includes('not found') ||
    combined.includes('404') ||
    combined.includes('image') ||
    combined.includes('file size') ||
    combined.includes('oversized') ||
    combined.includes('too large') ||
    combined.includes('file format') ||
    combined.includes('.jpg') ||
    combined.includes('.png') ||
    combined.includes('.gif') ||
    combined.includes('.svg') ||
    combined.includes('.mp4') ||
    combined.includes('.webm') ||
    combined.includes('asset') ||
    path.match(/\.(jpg|jpeg|png|gif|svg|webp|mp4|webm|ogv|wav|mp3|ogg|woff|woff2|ttf|eot)$/i) ||
    id.includes('asset') ||
    id.includes('image') ||
    id.includes('file')
  ) {
    return 'assets';
  }

  // CODE ISSUES: HTML/CSS/JS syntax, logic errors, script problems
  if (
    combined.includes('syntax') ||
    combined.includes('parse error') ||
    combined.includes('script error') ||
    combined.includes('javascript') ||
    combined.includes('function') ||
    combined.includes('variable') ||
    combined.includes('undefined') ||
    combined.includes('error:') ||
    combined.includes('css') ||
    combined.includes('style') ||
    combined.includes('selector') ||
    combined.includes('property') ||
    offender.line !== undefined || // Line numbers suggest code issues
    path.match(/\.(js|css|html)$/i) ||
    id.includes('code') ||
    id.includes('script') ||
    id.includes('css') ||
    id.includes('html')
  ) {
    return 'code';
  }

  // ENVIRONMENT ISSUES: Sandbox flags, browser compatibility, API usage
  if (
    combined.includes('sandbox') ||
    combined.includes('permission') ||
    combined.includes('cors') ||
    combined.includes('cross-origin') ||
    combined.includes('browser') ||
    combined.includes('compatibility') ||
    combined.includes('api') ||
    combined.includes('feature') ||
    combined.includes('support') ||
    combined.includes('polyfill') ||
    combined.includes('vendor') ||
    combined.includes('prefix') ||
    id.includes('sandbox') ||
    id.includes('browser') ||
    id.includes('compatibility')
  ) {
    return 'environment';
  }

  // PACKAGING ISSUES: Folder structure, naming conventions, manifest problems
  if (
    combined.includes('manifest') ||
    combined.includes('folder') ||
    combined.includes('directory') ||
    combined.includes('structure') ||
    combined.includes('naming') ||
    combined.includes('convention') ||
    combined.includes('index.html') ||
    combined.includes('backup_') ||
    combined.includes('_backup') ||
    combined.includes('macosx') ||
    combined.includes('__macosx') ||
    combined.includes('.ds_store') ||
    combined.includes('thumbs.db') ||
    id.includes('package') ||
    id.includes('structure') ||
    id.includes('folder') ||
    id.includes('backup')
  ) {
    return 'packaging';
  }

  // Default fallback based on finding ID patterns
  if (id.includes('clicktag') || id.includes('click')) return 'code';
  if (id.includes('size') || id.includes('dimension')) return 'assets';

  // Ultimate fallback: code (most common category)
  return 'code';
}

/**
 * Group offenders by category
 */
export interface CategorizedOffenders {
  code: FindingOffender[];
  assets: FindingOffender[];
  environment: FindingOffender[];
  packaging: FindingOffender[];
}

export function groupOffendersByCategory(
  offenders: FindingOffender[],
  findingId?: string
): CategorizedOffenders {
  const groups: CategorizedOffenders = {
    code: [],
    assets: [],
    environment: [],
    packaging: [],
  };

  offenders.forEach((offender) => {
    const category = categorizeOffender(offender, findingId);
    groups[category].push(offender);
  });

  return groups;
}

/**
 * Category metadata for display
 */
export interface CategoryMeta {
  label: string;
  icon: IconName;
  color: string;
  description: string;
}

export const CATEGORY_META: Record<OffenderCategory, CategoryMeta> = {
  code: {
    label: 'Code Issues',
    icon: 'code',
    color: 'var(--severity-fail)',
    description: 'HTML/CSS/JS syntax, logic errors, script problems',
  },
  assets: {
    label: 'Asset Issues',
    icon: 'image',
    color: 'var(--severity-warn)',
    description: 'Missing files, oversized images, wrong formats, bad paths',
  },
  environment: {
    label: 'Environment Issues',
    icon: 'globe',
    color: 'var(--info)',
    description: 'Sandbox flags, browser compatibility, API usage',
  },
  packaging: {
    label: 'Packaging Issues',
    icon: 'package',
    color: 'var(--muted)',
    description: 'Folder structure, naming conventions, manifest problems',
  },
};

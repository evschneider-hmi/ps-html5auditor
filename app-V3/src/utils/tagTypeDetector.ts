import * as XLSX from 'xlsx';

export type TagType = 'vast' | 'js-display' | '1x1-pixel' | 'unknown' | 'creative';

/**
 * Detects the type of content in an Excel/CSV file by examining its structure
 * Returns: 'vast', 'js-display', '1x1-pixel', 'unknown', or 'creative'
 */
export async function detectTagType(file: File): Promise<TagType> {
  // If it's a ZIP, it's a creative
  if (file.name.toLowerCase().endsWith('.zip')) {
    return 'creative';
  }

  // If it's not Excel/CSV, unknown
  if (!file.name.match(/\.(xlsx|xlsm|xls|csv)$/i)) {
    return 'unknown';
  }

  try {
    // Read the file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return 'unknown';
    
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(sheet, { header: 1, defval: '' });

    // Look at first 10 rows for headers and data
    const sampleRows = data.slice(0, 10);
    const allText = sampleRows.map(row => 
      Array.isArray(row) ? row.join(' ').toLowerCase() : ''
    ).join(' ');

    // Detection patterns
    const vastIndicators = [
      'vast url', 'vast_url', 'vasturl', 'ad tag uri', 'adtaguri',
      'vast xml', 'vast tag', 'video url', 'videourl',
      '.xml', 'wrapper', 'linear'
    ];

    const jsDisplayIndicators = [
      '<script', 'javascript', 'clicktag', 'click tag',
      'ad.doubleclick', 'flashtalking', 'sizmek',
      'document.write', 'adform'
    ];

    const pixelIndicators = [
      '<img', 'tracking pixel', '1x1', '11',
      'impression pixel', 'impression tracker',
      'width="1"', 'height="1"'
    ];

    // Count matches for each type
    const vastScore = vastIndicators.filter(i => allText.includes(i)).length;
    const jsScore = jsDisplayIndicators.filter(i => allText.includes(i)).length;
    const pixelScore = pixelIndicators.filter(i => allText.includes(i)).length;

    // Return the highest scoring type (with VAST as default if tied)
    if (vastScore >= jsScore && vastScore >= pixelScore && vastScore > 0) {
      return 'vast';
    }
    if (jsScore > vastScore && jsScore >= pixelScore && jsScore > 0) {
      return 'js-display';
    }
    if (pixelScore > vastScore && pixelScore > jsScore && pixelScore > 0) {
      return '1x1-pixel';
    }

    // If no clear winner but has URL-like patterns, assume VAST
    if (allText.includes('http') && allText.includes('tag')) {
      return 'vast';
    }

    return 'unknown';
  } catch (error) {
    console.error('[tagTypeDetector] Error detecting tag type:', error);
    return 'unknown';
  }
}

/**
 * Batch detect tag types for multiple files
 */
export async function detectTagTypes(files: File[]): Promise<Map<File, TagType>> {
  const results = new Map<File, TagType>();
  
  for (const file of files) {
    const type = await detectTagType(file);
    results.set(file, type);
  }
  
  return results;
}

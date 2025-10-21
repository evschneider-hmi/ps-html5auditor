/**
 * HTML parsing and manipulation utilities
 */

/**
 * Extract text content from HTML tags
 */
export function getTextContent(html: string, tagName: string): string[] {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(html)) !== null) {
    matches.push(match[1].trim());
  }
  
  return matches;
}

/**
 * Extract attribute values from HTML tags
 */
export function getAttributeValues(html: string, tagName: string, attrName: string): string[] {
  const tagPattern = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const attrPattern = new RegExp(`${attrName}=["']([^"']+)["']`, 'i');
  const values: string[] = [];
  
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[0];
    const attrMatch = attrPattern.exec(tag);
    if (attrMatch) {
      values.push(attrMatch[1]);
    }
  }
  
  return values;
}

/**
 * Check if HTML contains a specific tag
 */
export function hasTag(html: string, tagName: string): boolean {
  const pattern = new RegExp(`<${tagName}[^>]*>`, 'i');
  return pattern.test(html);
}

/**
 * Count occurrences of a tag
 */
export function countTags(html: string, tagName: string): number {
  const pattern = new RegExp(`<${tagName}[^>]*>`, 'gi');
  const matches = html.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Extract all script sources (external scripts)
 */
export function getExternalScripts(html: string): string[] {
  const pattern = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const sources: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(html)) !== null) {
    sources.push(match[1]);
  }
  
  return sources;
}

/**
 * Extract all inline script content
 */
export function getInlineScripts(html: string): string[] {
  const pattern = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      scripts.push(content);
    }
  }
  
  return scripts;
}

/**
 * Extract all stylesheet hrefs (external styles)
 */
export function getExternalStyles(html: string): string[] {
  const pattern = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  const pattern2 = /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  const hrefs: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(html)) !== null) {
    hrefs.push(match[1]);
  }
  
  while ((match = pattern2.exec(html)) !== null) {
    if (!hrefs.includes(match[1])) {
      hrefs.push(match[1]);
    }
  }
  
  return hrefs;
}

/**
 * Extract all inline style content
 */
export function getInlineStyles(html: string): string[] {
  const pattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styles: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(html)) !== null) {
    const content = match[1].trim();
    if (content) {
      styles.push(content);
    }
  }
  
  return styles;
}

/**
 * Get all elements with a specific attribute
 */
export function getElementsWithAttribute(html: string, attrName: string): string[] {
  const pattern = new RegExp(`<[^>]+${attrName}=["']([^"']+)["'][^>]*>`, 'gi');
  const elements: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(html)) !== null) {
    elements.push(match[0]);
  }
  
  return elements;
}

/**
 * Strip HTML tags from text
 */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Get meta tag content by name
 */
export function getMetaContent(html: string, name: string): string | null {
  const pattern = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  const pattern2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["'][^>]*>`, 'i');
  
  let match = pattern.exec(html);
  if (match) return match[1];
  
  match = pattern2.exec(html);
  if (match) return match[1];
  
  return null;
}

/**
 * Check if element has specific attribute value
 */
export function hasAttributeValue(html: string, tagName: string, attrName: string, value: string): boolean {
  const pattern = new RegExp(`<${tagName}[^>]*${attrName}=["']${value}["'][^>]*>`, 'i');
  return pattern.test(html);
}

/**
 * Extract all image sources
 */
export function getImageSources(html: string): string[] {
  const pattern = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const sources: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(html)) !== null) {
    sources.push(match[1]);
  }
  
  return sources;
}

/**
 * Find line number of text in HTML
 */
export function findLineNumber(html: string, searchText: string): number | null {
  const lines = html.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchText)) {
      return i + 1; // 1-indexed
    }
  }
  return null;
}

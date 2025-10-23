/**
 * CSS parsing and validation utilities
 */

/**
 * Extract all CSS rules from stylesheet content
 */
export function extractCSSRules(css: string): string[] {
  // Match selector { properties }
  const pattern = /([^{]+)\{([^}]+)\}/g;
  const rules: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    rules.push(match[0].trim());
  }
  
  return rules;
}

/**
 * Extract selectors from CSS
 */
export function extractSelectors(css: string): string[] {
  const pattern = /([^{]+)\{/g;
  const selectors: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    selectors.push(match[1].trim());
  }
  
  return selectors;
}

/**
 * Check if CSS contains specific property
 */
export function hasProperty(css: string, property: string): boolean {
  const pattern = new RegExp(`${property}\\s*:`, 'i');
  return pattern.test(css);
}

/**
 * Extract property values from CSS
 */
export function getPropertyValues(css: string, property: string): string[] {
  const pattern = new RegExp(`${property}\\s*:\\s*([^;]+);?`, 'gi');
  const values: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    values.push(match[1].trim());
  }
  
  return values;
}

/**
 * Check for !important declarations
 */
export function hasImportant(css: string): boolean {
  return /!important/i.test(css);
}

/**
 * Count !important declarations
 */
export function countImportant(css: string): number {
  const matches = css.match(/!important/gi);
  return matches ? matches.length : 0;
}

/**
 * Extract @import statements
 */
export function extractImports(css: string): string[] {
  const pattern = /@import\s+(?:url\()?["']?([^"')]+)["']?\)?[^;]*;/gi;
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Extract @font-face declarations
 */
export function extractFontFaces(css: string): string[] {
  const pattern = /@font-face\s*\{[^}]+\}/gi;
  const fontFaces: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    fontFaces.push(match[0]);
  }
  
  return fontFaces;
}

/**
 * Extract @media queries
 */
export function extractMediaQueries(css: string): string[] {
  const pattern = /@media[^{]+\{/gi;
  const queries: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    queries.push(match[0].trim());
  }
  
  return queries;
}

/**
 * Extract @keyframes declarations
 */
export function extractKeyframes(css: string): string[] {
  const pattern = /@(?:-webkit-|-moz-|-o-)?keyframes\s+([a-zA-Z0-9_-]+)/gi;
  const keyframes: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    keyframes.push(match[1]);
  }
  
  return keyframes;
}

/**
 * Check if CSS contains animations
 */
export function hasAnimations(css: string): boolean {
  return /animation(?:-name)?\\s*:/i.test(css) || /@keyframes/i.test(css);
}

/**
 * Check if CSS contains transitions
 */
export function hasTransitions(css: string): boolean {
  return /transition(?:-property)?\\s*:/i.test(css);
}

/**
 * Extract color values from CSS
 */
export function extractColors(css: string): string[] {
  // Match hex colors, rgb/rgba, hsl/hsla, named colors
  const hexPattern = /#[0-9a-fA-F]{3,8}/g;
  const rgbPattern = /rgba?\\([^)]+\\)/g;
  const hslPattern = /hsla?\\([^)]+\\)/g;
  
  const colors = new Set<string>();
  
  css.match(hexPattern)?.forEach(c => colors.add(c));
  css.match(rgbPattern)?.forEach(c => colors.add(c));
  css.match(hslPattern)?.forEach(c => colors.add(c));
  
  return Array.from(colors);
}

/**
 * Remove comments from CSS
 */
export function removeComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Minify CSS (basic)
 */
export function minify(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, '$1') // Remove whitespace around punctuation
    .trim();
}

/**
 * Extract URLs from CSS (background-image, etc.)
 */
export function extractURLs(css: string): string[] {
  const pattern = /url\(["']?([^"')]+)["']?\)/gi;
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  
  while ((match = pattern.exec(css)) !== null) {
    urls.push(match[1]);
  }
  
  return urls;
}

/**
 * Check for vendor prefixes
 */
export function hasVendorPrefixes(css: string): boolean {
  return /-webkit-|-moz-|-ms-|-o-/.test(css);
}

/**
 * Count CSS rules
 */
export function countRules(css: string): number {
  const matches = css.match(/\{[^}]*\}/g);
  return matches ? matches.length : 0;
}

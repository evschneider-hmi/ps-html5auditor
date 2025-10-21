/**
 * Common regex patterns used across checks
 */

/**
 * URL patterns
 */
export const URL_PATTERN = /https?:\/\/[^\s'"<>]+/gi;
export const SECURE_URL_PATTERN = /https:\/\/[^\s'"<>]+/gi;
export const INSECURE_URL_PATTERN = /http:\/\/[^\s'"<>]+/gi;

/**
 * ClickTag patterns
 */
export const CLICKTAG_VAR_PATTERN = /var\s+(clickTag\d*)\s*=\s*["']([^"']+)["']/gi;
export const CLICKTAG_ASSIGNMENT_PATTERN = /(clickTag\d*)\s*=\s*["']([^"']+)["']/gi;
export const CLICKTAG_USAGE_PATTERN = /clickTag\d*/gi;

/**
 * File extension patterns
 */
export const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|svg|webp)$/i;
export const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi)$/i;
export const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|m4a)$/i;
export const FONT_EXTENSIONS = /\.(woff|woff2|ttf|otf|eot)$/i;
export const SCRIPT_EXTENSIONS = /\.(js|ts|jsx|tsx)$/i;
export const STYLE_EXTENSIONS = /\.(css|scss|sass|less)$/i;
export const HTML_EXTENSIONS = /\.(html?|htm)$/i;

/**
 * Script/code patterns
 */
export const SCRIPT_TAG_PATTERN = /<script[^>]*>[\s\S]*?<\/script>/gi;
export const INLINE_SCRIPT_PATTERN = /<script[^>]*>([\s\S]*?)<\/script>/gi;
export const EXTERNAL_SCRIPT_PATTERN = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;

/**
 * Style patterns
 */
export const STYLE_TAG_PATTERN = /<style[^>]*>[\s\S]*?<\/style>/gi;
export const INLINE_STYLE_PATTERN = /style=["']([^"']+)["']/gi;
export const EXTERNAL_STYLE_PATTERN = /<link[^>]*href=["']([^"']+\.css)["'][^>]*>/gi;

/**
 * HTML attribute patterns
 */
export const ID_PATTERN = /id=["']([^"']+)["']/gi;
export const CLASS_PATTERN = /class=["']([^"']+)["']/gi;
export const SRC_PATTERN = /src=["']([^"']+)["']/gi;
export const HREF_PATTERN = /href=["']([^"']+)["']/gi;

/**
 * Comment patterns
 */
export const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;
export const JS_SINGLE_LINE_COMMENT_PATTERN = /\/\/.*/g;
export const JS_MULTI_LINE_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;

/**
 * Google Web Designer patterns
 */
export const GWD_COMPONENT_PATTERN = /gwd-[a-z-]+/gi;
export const GWD_RUNTIME_PATTERN = /gwdAd|gwdpage|gwd\./gi;

/**
 * Enabler API patterns
 */
export const ENABLER_EXIT_PATTERN = /Enabler\.(exit|exitOverride)\s*\(/gi;
export const ENABLER_INIT_PATTERN = /Enabler\.(isInitialized|addEventListener)\s*\(/gi;

/**
 * Console patterns
 */
export const CONSOLE_LOG_PATTERN = /console\.(log|warn|error|debug|info)\s*\(/gi;

/**
 * Helper: Test if string matches pattern
 */
export function matchesPattern(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/**
 * Helper: Extract all matches from text
 */
export function extractMatches(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  
  // Reset lastIndex for global regex
  pattern.lastIndex = 0;
  
  while ((match = pattern.exec(text)) !== null) {
    matches.push(match[1] || match[0]);
  }
  
  return matches;
}

/**
 * Helper: Count pattern occurrences
 */
export function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Helper: Remove comments from code
 */
export function removeComments(code: string, type: 'html' | 'js' = 'js'): string {
  let cleaned = code;
  
  if (type === 'html') {
    cleaned = cleaned.replace(HTML_COMMENT_PATTERN, '');
  } else {
    cleaned = cleaned.replace(JS_SINGLE_LINE_COMMENT_PATTERN, '');
    cleaned = cleaned.replace(JS_MULTI_LINE_COMMENT_PATTERN, '');
  }
  
  return cleaned;
}

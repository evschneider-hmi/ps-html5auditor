/**
 * Type definitions for the V3 Preview System
 * 
 * These types define the interfaces for the modular preview components,
 * including runtime diagnostics, tab management, and iframe communication.
 */

/**
 * Available preview tabs
 */
export type PreviewTab = 'preview' | 'source' | 'assets' | 'json' | 'diagnostics';

/**
 * Preview info containing base directory and index path
 */
export interface PreviewInfo {
  /** Base directory path (e.g., "assets/") */
  baseDir: string;
  
  /** Path to the index/entry HTML file */
  indexPath: string;
}

/**
 * Runtime diagnostics captured from the preview iframe
 * Matches the data structure from runtimeProbe.ts
 */
export interface PreviewDiagnostics {
  /** DOMContentLoaded timing in ms */
  domContentLoaded?: number;
  
  /** Visual start timing in ms */
  visualStart?: number;
  
  /** Number of animation frames observed */
  frames?: number;
  
  /** Number of console errors */
  consoleErrors?: number;
  
  /** Number of console warnings */
  consoleWarnings?: number;
  
  /** Number of alert/confirm/prompt dialogs */
  dialogs?: number;
  
  /** Number of cookies set */
  cookies?: number;
  
  /** localStorage access count */
  localStorage?: number;
  
  /** Number of JavaScript errors */
  errors?: number;
  
  /** Number of document.write calls */
  documentWrites?: number;
  
  /** Whether jQuery was detected */
  jquery?: boolean;
  
  /** Detected click URL */
  clickUrl?: string;
  
  /** Memory usage in MB */
  memoryMB?: number;
  
  /** Minimum memory usage in MB */
  memoryMinMB?: number;
  
  /** Maximum memory usage in MB */
  memoryMaxMB?: number;
  
  /** CPU performance score */
  cpuScore?: number;
  
  /** Number of network requests */
  network?: number;
  
  /** Number of runtime-created iframes */
  runtimeIframes?: number;
  
  /** Number of URL rewrites */
  rewrites?: number;
  
  /** Image URL rewrites */
  imgRewrites?: number;
  
  /** Media URL rewrites */
  mediaRewrites?: number;
  
  /** Script URL rewrites */
  scriptRewrites?: number;
  
  /** Link URL rewrites */
  linkRewrites?: number;
  
  /** setAttribute URL rewrites */
  setAttrRewrites?: number;
  
  /** Style URL rewrites */
  styleUrlRewrites?: number;
  
  /** Style attribute rewrites */
  styleAttrRewrites?: number;
  
  /** Number of DOM images */
  domImages?: number;
  
  /** Number of background URLs */
  domBgUrls?: number;
  
  /** Whether DoubleClick Enabler stub is active */
  enablerStub?: boolean;
  
  /** Maximum animation duration in seconds */
  animMaxDurationS?: number;
  
  /** Maximum animation loop count */
  animMaxLoops?: number;
  
  /** Whether infinite animation detected */
  animInfinite?: boolean;
  
  /** Initial page load requests */
  initialRequests?: number;
  
  /** Subresource load requests */
  subloadRequests?: number;
  
  /** User-triggered requests */
  userRequests?: number;
  
  /** Total request count */
  totalRequests?: number;
  
  /** Initial load bytes */
  initialBytes?: number;
  
  /** Subresource load bytes */
  subloadBytes?: number;
  
  /** User-triggered bytes */
  userBytes?: number;
  
  /** Total bytes transferred */
  totalBytes?: number;
  
  /** Load event timing */
  loadEventTime?: number;
  
  /** Border detection */
  borderSides?: number;
  
  /** Border CSS rules detected */
  borderCssRules?: number;
}

/**
 * Result from building instrumented preview HTML
 */
export interface PreviewBuildResult {
  /** Instrumented HTML ready for iframe */
  html: string;
  
  /** Map of file paths to blob URLs */
  blobMap: Record<string, string>;
  
  /** Original HTML before instrumentation */
  originalHtml: string;
  
  /** Assets referenced but not found in bundle */
  missingAssets?: Array<{ url: string; path: string; context: string }>;
}

/**
 * Options for building preview HTML
 */
export interface PreviewBuildOptions {
  /** Override detected ad size */
  adSize?: { width: number; height: number };
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Message types for iframe communication
 */
export type PreviewMessageType = 
  | 'tracking-update'
  | 'tracking-complete'
  | 'dimension-detected'
  | 'click-detected'
  | 'resize'
  | 'error'
  | 'ready';

/**
 * Message structure for iframe postMessage
 */
export interface PreviewMessage {
  type: PreviewMessageType;
  bundleId?: string;
  data?: any;
}

/**
 * Asset info for display in Assets tab
 */
export interface AssetInfo {
  /** File path in bundle */
  path: string;
  
  /** File size in bytes */
  size: number;
  
  /** MIME type */
  mimeType: string;
  
  /** Blob URL for preview */
  blobUrl?: string;
  
  /** Whether this is an image */
  isImage?: boolean;
  
  /** Whether this is a video */
  isVideo?: boolean;
  
  /** Whether this is audio */
  isAudio?: boolean;
}

/**
 * Props for PreviewPane component
 */
export interface PreviewPaneProps {
  /** Maximum body height for responsive sizing */
  maxBodyHeight?: number;
  
  /** Callback when diagnostics update */
  onDiagnosticsUpdate?: (diagnostics: PreviewDiagnostics) => void;
}

/**
 * Props for PreviewIframe component
 */
export interface PreviewIframeProps {
  /** HTML content to display */
  html: string;
  
  /** Current bundle ID */
  bundleId?: string;
  
  /** Height for iframe */
  height: number;
  
  /** Callback when message received */
  onMessage?: (data: any) => void;
  
  /** Callback when ready */
  onReady?: () => void;
  
  /** Loading state */
  loading?: boolean;
}

/**
 * Props for PreviewTabs component
 */
export interface PreviewTabsProps {
  /** Currently active tab */
  activeTab: PreviewTab;
  
  /** Callback when tab changes */
  onTabChange: (tab: PreviewTab) => void;
  
  /** Whether to show insights badge */
  showInsightsBadge?: boolean;
}

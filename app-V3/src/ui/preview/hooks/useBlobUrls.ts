/**
 * useBlobUrls Hook
 * 
 * Manages blob URL lifecycle for preview assets with automatic cleanup.
 * Prevents memory leaks by revoking URLs when they're no longer needed.
 * 
 * Why This Matters:
 * - Blob URLs must be manually revoked to prevent memory leaks
 * - Assets change when bundles change, requiring cleanup
 * - Proper lifecycle management ensures efficient resource usage
 * 
 * Usage:
 * ```typescript
 * const { blobUrls, createBlobUrls, cleanup } = useBlobUrls();
 * 
 * // Create blob URLs for files
 * const urls = createBlobUrls(bundle.files);
 * 
 * // URLs are automatically cleaned up on unmount
 * ```
 */

import { useCallback, useEffect, useRef } from 'react';

export interface BlobUrlMap {
  [path: string]: string;
}

export interface UseBlobUrlsReturn {
  /** Current blob URL map */
  blobUrls: React.MutableRefObject<BlobUrlMap>;
  
  /** Create blob URLs for files */
  createBlobUrls: (files: Record<string, Uint8Array>) => BlobUrlMap;
  
  /** Clean up all blob URLs */
  cleanup: () => void;
}

/**
 * Hook for managing blob URLs with automatic cleanup
 */
export function useBlobUrls(): UseBlobUrlsReturn {
  const blobUrls = useRef<BlobUrlMap>({});
  
  /**
   * Clean up all existing blob URLs
   */
  const cleanup = useCallback(() => {
    for (const url of Object.values(blobUrls.current)) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        // Silently ignore revocation errors
        console.warn('Failed to revoke blob URL:', err);
      }
    }
    blobUrls.current = {};
  }, []);
  
  /**
   * Create blob URLs for a set of files
   */
  const createBlobUrls = useCallback((files: Record<string, Uint8Array>): BlobUrlMap => {
    // Clean up existing URLs first
    cleanup();
    
    const newUrls: BlobUrlMap = {};
    
    for (const [path, bytes] of Object.entries(files)) {
      try {
        // Infer MIME type from file extension
        const mimeType = inferMimeType(path);
        // Create a new Uint8Array with regular ArrayBuffer to satisfy type requirements
        const buffer = new Uint8Array(bytes);
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);
        newUrls[path] = url;
      } catch (err) {
        console.error(`Failed to create blob URL for ${path}:`, err);
      }
    }
    
    blobUrls.current = newUrls;
    return newUrls;
  }, [cleanup]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);
  
  return {
    blobUrls,
    createBlobUrls,
    cleanup,
  };
}

/**
 * Infer MIME type from file extension
 */
function inferMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    
    // Video
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogv': 'video/ogg',
    
    // Audio
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'wav': 'audio/wav',
    
    // Text
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'txt': 'text/plain',
    'xml': 'application/xml',
    
    // Fonts
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'otf': 'font/otf',
    'eot': 'application/vnd.ms-fontobject',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

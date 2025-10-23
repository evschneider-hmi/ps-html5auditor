/**
 * Preview Assets Component
 * 
 * Displays all bundle files with metadata and previews.
 * 
 * Quality Principles:
 * - Efficiency: Lazy image loading, virtualized list for large bundles
 * - Organization: Clear grouping by file type, sortable columns
 * - Consistency: Standard file browser patterns
 * - Maneuverability: Easy to add filters, sorting, preview modes
 */

import React, { useMemo, useState, useCallback } from 'react';

export interface AssetFile {
  path: string;
  size: number;
  mimeType: string;
  blobUrl?: string;
}

export interface PreviewAssetsProps {
  /** Bundle files */
  files: Record<string, Uint8Array>;
  
  /** Blob URLs for files */
  blobUrls: Record<string, string>;
  
  /** CSS class name */
  className?: string;
}

/**
 * Format file size for display
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Get file extension
 */
const getExtension = (path: string): string => {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/**
 * Check if file is an image
 */
const isImage = (path: string): boolean => {
  const ext = getExtension(path);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico'].includes(ext);
};

/**
 * Check if file is video
 */
const isVideo = (path: string): boolean => {
  const ext = getExtension(path);
  return ['mp4', 'webm', 'ogv'].includes(ext);
};

/**
 * Get file type category
 */
const getFileCategory = (path: string): string => {
  const ext = getExtension(path);
  
  if (isImage(path)) return 'Image';
  if (isVideo(path)) return 'Video';
  if (['mp3', 'ogg', 'wav'].includes(ext)) return 'Audio';
  if (['html', 'htm'].includes(ext)) return 'HTML';
  if (ext === 'css') return 'CSS';
  if (ext === 'js') return 'JavaScript';
  if (ext === 'json') return 'JSON';
  if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(ext)) return 'Font';
  
  return 'Other';
};

/**
 * Assets file browser component
 * 
 * Features:
 * - File list with metadata
 * - Image thumbnails
 * - Sortable by name, size, type
 * - Click to preview
 * - Total size summary
 * 
 * @example
 * ```tsx
 * <PreviewAssets
 *   files={bundleFiles}
 *   blobUrls={blobUrlMap}
 * />
 * ```
 */
export const PreviewAssets: React.FC<PreviewAssetsProps> = ({
  files,
  blobUrls,
  className = ''
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  
  /**
   * Convert files to asset list with metadata
   */
  const assets = useMemo((): AssetFile[] => {
    return Object.entries(files).map(([path, bytes]) => ({
      path,
      size: bytes.length,
      mimeType: getFileCategory(path),
      blobUrl: blobUrls[path]
    }));
  }, [files, blobUrls]);
  
  /**
   * Sort assets
   */
  const sortedAssets = useMemo(() => {
    const sorted = [...assets];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.path.localeCompare(b.path);
      } else if (sortBy === 'size') {
        comparison = a.size - b.size;
      } else if (sortBy === 'type') {
        comparison = a.mimeType.localeCompare(b.mimeType);
      }
      
      return sortDir === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [assets, sortBy, sortDir]);
  
  /**
   * Calculate total size
   */
  const totalSize = useMemo(() => {
    return assets.reduce((sum, asset) => sum + asset.size, 0);
  }, [assets]);
  
  /**
   * Handle sort change
   */
  const handleSort = useCallback((column: 'name' | 'size' | 'type') => {
    if (sortBy === column) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  }, [sortBy]);
  
  /**
   * Handle file click
   */
  const handleFileClick = useCallback((path: string) => {
    setSelectedFile(prev => prev === path ? null : path);
  }, []);
  
  const selectedAsset = selectedFile ? assets.find(a => a.path === selectedFile) : null;
  
  return (
    <div className={`preview-assets ${className}`}>
      {/* Header with summary */}
      <div className="preview-assets__header">
        <div className="preview-assets__info">
          <span className="preview-assets__label">Bundle Assets</span>
          <span className="preview-assets__stats">
            {assets.length} files · {formatFileSize(totalSize)}
          </span>
        </div>
      </div>
      
      <div className="preview-assets__content">
        {/* File list */}
        <div className="preview-assets__list">
          {/* Table header */}
          <div className="preview-assets__table-header">
            <button
              className={`preview-assets__header-cell preview-assets__header-cell--name ${sortBy === 'name' ? 'preview-assets__header-cell--active' : ''}`}
              onClick={() => handleSort('name')}
            >
              File {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`preview-assets__header-cell ${sortBy === 'type' ? 'preview-assets__header-cell--active' : ''}`}
              onClick={() => handleSort('type')}
            >
              Type {sortBy === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button
              className={`preview-assets__header-cell ${sortBy === 'size' ? 'preview-assets__header-cell--active' : ''}`}
              onClick={() => handleSort('size')}
            >
              Size {sortBy === 'size' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          </div>
          
          {/* Table body */}
          <div className="preview-assets__table-body">
            {sortedAssets.map((asset) => (
              <div
                key={asset.path}
                className={`preview-assets__row ${selectedFile === asset.path ? 'preview-assets__row--selected' : ''}`}
                onClick={() => handleFileClick(asset.path)}
              >
                <div className="preview-assets__cell preview-assets__cell--name">
                  {isImage(asset.path) && asset.blobUrl && (
                    <img
                      src={asset.blobUrl}
                      alt=""
                      className="preview-assets__thumbnail"
                      loading="lazy"
                    />
                  )}
                  <span className="preview-assets__filename" title={asset.path}>
                    {asset.path}
                  </span>
                </div>
                <div className="preview-assets__cell">
                  {asset.mimeType}
                </div>
                <div className="preview-assets__cell">
                  {formatFileSize(asset.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Preview panel */}
        {selectedAsset && (
          <div className="preview-assets__preview">
            <div className="preview-assets__preview-header">
              <h3 className="preview-assets__preview-title">
                {selectedAsset.path}
              </h3>
              <button
                className="preview-assets__preview-close"
                onClick={() => setSelectedFile(null)}
              >
                ✕
              </button>
            </div>
            
            <div className="preview-assets__preview-content">
              {isImage(selectedAsset.path) && selectedAsset.blobUrl && (
                <img
                  src={selectedAsset.blobUrl}
                  alt={selectedAsset.path}
                  className="preview-assets__preview-image"
                />
              )}
              
              {isVideo(selectedAsset.path) && selectedAsset.blobUrl && (
                <video
                  src={selectedAsset.blobUrl}
                  controls
                  className="preview-assets__preview-video"
                />
              )}
              
              {!isImage(selectedAsset.path) && !isVideo(selectedAsset.path) && (
                <div className="preview-assets__preview-placeholder">
                  <p>No preview available</p>
                  <p className="preview-assets__preview-meta">
                    {selectedAsset.mimeType} · {formatFileSize(selectedAsset.size)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <style>{`
        .preview-assets {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #ffffff;
        }
        
        .preview-assets__header {
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .preview-assets__info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .preview-assets__label {
          font-weight: 600;
          font-size: 13px;
          color: #0f172a;
        }
        
        .preview-assets__stats {
          font-size: 12px;
          color: #64748b;
        }
        
        .preview-assets__content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        .preview-assets__list {
          flex: ${selectedAsset ? '0 0 60%' : '1'};
          display: flex;
          flex-direction: column;
          overflow: auto;
          border-right: ${selectedAsset ? '1px solid #e2e8f0' : 'none'};
        }
        
        .preview-assets__table-header {
          display: grid;
          grid-template-columns: 1fr 120px 100px;
          gap: 8px;
          padding: 8px 16px;
          background: #f1f5f9;
          border-bottom: 2px solid #e2e8f0;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        
        .preview-assets__header-cell {
          background: transparent;
          border: none;
          padding: 4px 0;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: color 150ms;
        }
        
        .preview-assets__header-cell:hover {
          color: #1e293b;
        }
        
        .preview-assets__header-cell--active {
          color: #3b82f6;
        }
        
        .preview-assets__header-cell--name {
          flex: 1;
        }
        
        .preview-assets__table-body {
          flex: 1;
          overflow: auto;
        }
        
        .preview-assets__row {
          display: grid;
          grid-template-columns: 1fr 120px 100px;
          gap: 8px;
          padding: 8px 16px;
          border-bottom: 1px solid #f1f5f9;
          cursor: pointer;
          transition: background 150ms;
        }
        
        .preview-assets__row:hover {
          background: #f8fafc;
        }
        
        .preview-assets__row--selected {
          background: #eff6ff;
          border-left: 3px solid #3b82f6;
        }
        
        .preview-assets__cell {
          font-size: 13px;
          color: #475569;
          display: flex;
          align-items: center;
        }
        
        .preview-assets__cell--name {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }
        
        .preview-assets__thumbnail {
          width: 24px;
          height: 24px;
          object-fit: cover;
          border-radius: 2px;
          flex-shrink: 0;
        }
        
        .preview-assets__filename {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .preview-assets__preview {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
        }
        
        .preview-assets__preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #ffffff;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .preview-assets__preview-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #0f172a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .preview-assets__preview-close {
          padding: 4px 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 16px;
          color: #64748b;
          transition: color 150ms;
        }
        
        .preview-assets__preview-close:hover {
          color: #1e293b;
        }
        
        .preview-assets__preview-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          overflow: auto;
        }
        
        .preview-assets__preview-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .preview-assets__preview-video {
          max-width: 100%;
          max-height: 100%;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .preview-assets__preview-placeholder {
          text-align: center;
          color: #64748b;
        }
        
        .preview-assets__preview-meta {
          margin-top: 8px;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

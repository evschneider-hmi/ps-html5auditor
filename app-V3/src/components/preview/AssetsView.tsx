import React, { useState } from 'react';
import type { ZipBundle } from '../../logic/types';

export interface AssetsViewProps {
  bundle: ZipBundle;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const getFileIcon = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  
  if (['html', 'htm'].includes(ext)) return '📄';
  if (['css'].includes(ext)) return '🎨';
  if (['js'].includes(ext)) return '📜';
  if (['json'].includes(ext)) return '📋';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
  if (['mp4', 'webm', 'ogg'].includes(ext)) return '🎬';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return '🔊';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  if (['txt', 'md'].includes(ext)) return '📝';
  
  return '📎';
};

const getFileType = (path: string): string => {
  const ext = path.split('.').pop()?.toUpperCase() || 'Unknown';
  return `${ext} File`;
};

export const AssetsView: React.FC<AssetsViewProps> = ({ bundle }) => {
  const [copied, setCopied] = useState(false);
  
  // Get all files with sizes
  const files = Object.entries(bundle.files).map(([path, bytes]) => ({
    path,
    size: bytes.byteLength || bytes.length,
    icon: getFileIcon(path),
    type: getFileType(path),
  }));
  
  // Sort by path
  files.sort((a, b) => a.path.localeCompare(b.path));
  
  // Calculate totals
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalCount = files.length;

  const handleCopyList = () => {
    const fileList = files.map((f) => `${f.path} (${formatBytes(f.size)})`).join('\n');
    navigator.clipboard.writeText(fileList).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header with stats and copy button */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>{totalCount}</strong> files · {' '}
          <strong style={{ color: 'var(--text)' }}>{formatBytes(totalSize)}</strong> total
        </div>
        <button
          type="button"
          className="btn"
          onClick={handleCopyList}
          style={{
            padding: '4px 8px',
            fontSize: 11,
          }}
        >
          {copied ? '✓ Copied' : 'Copy List'}
        </button>
      </div>

      {/* File list */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg)',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          <thead>
            <tr
              style={{
                background: 'var(--surface)',
                position: 'sticky',
                top: 0,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                }}
              >
                Icon
              </th>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                }}
              >
                File Path
              </th>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                }}
              >
                Type
              </th>
              <th
                style={{
                  padding: '8px 12px',
                  textAlign: 'right',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                }}
              >
                Size
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr
                key={file.path}
                style={{
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <td
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    fontSize: 16,
                  }}
                >
                  {file.icon}
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 300,
                  }}
                  title={file.path}
                >
                  {file.path}
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    color: 'var(--muted)',
                  }}
                >
                  {file.type}
                </td>
                <td
                  style={{
                    padding: '8px 12px',
                    textAlign: 'right',
                    color: 'var(--muted)',
                  }}
                >
                  {formatBytes(file.size)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import type { ZipBundle } from '../../logic/types';

export interface SourceViewProps {
  bundle: ZipBundle;
}

// Simple syntax highlighter
const highlightCode = (code: string, language: string): string => {
  let highlighted = code;
  
  // Escape HTML entities
  highlighted = highlighted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (language === 'html') {
    // HTML tags
    highlighted = highlighted.replace(
      /(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)(.*?)(&gt;)/g,
      '$1<span style="color: #e06c75;">$2</span>$3$4'
    );
    // Attributes
    highlighted = highlighted.replace(
      /([a-zA-Z-]+)(=)(&quot;|&#39;)/g,
      '<span style="color: #d19a66;">$1</span>$2$3'
    );
    // Attribute values
    highlighted = highlighted.replace(
      /(=)(&quot;|&#39;)([^&quot;&#39;]*)(&quot;|&#39;)/g,
      '$1$2<span style="color: #98c379;">$3</span>$4'
    );
  } else if (language === 'css') {
    // Selectors
    highlighted = highlighted.replace(
      /([.#]?[a-zA-Z-][a-zA-Z0-9-]*)\s*\{/g,
      '<span style="color: #e06c75;">$1</span> {'
    );
    // Properties
    highlighted = highlighted.replace(
      /([a-zA-Z-]+)(\s*:)/g,
      '<span style="color: #d19a66;">$1</span>$2'
    );
    // Values
    highlighted = highlighted.replace(
      /(:)(.*?)(;)/g,
      '$1<span style="color: #98c379;">$2</span>$3'
    );
  } else if (language === 'javascript') {
    // Keywords
    const keywords = /\b(var|let|const|function|return|if|else|for|while|class|new|import|export|default|async|await)\b/g;
    highlighted = highlighted.replace(
      keywords,
      '<span style="color: #c678dd;">$1</span>'
    );
    // Strings
    highlighted = highlighted.replace(
      /(['""])(.*?)(['""])/g,
      '<span style="color: #98c379;">$1$2$3</span>'
    );
    // Comments
    highlighted = highlighted.replace(
      /(\/\/.*?$)/gm,
      '<span style="color: #5c6370; font-style: italic;">$1</span>'
    );
  }

  return highlighted;
};

const getFileExtension = (path: string): string => {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

const getLanguage = (path: string): string => {
  const ext = getFileExtension(path);
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'js') return 'javascript';
  if (ext === 'json') return 'json';
  return 'text';
};

const isTextFile = (path: string): boolean => {
  const ext = getFileExtension(path);
  const textExtensions = ['html', 'htm', 'css', 'js', 'json', 'txt', 'xml', 'svg', 'md'];
  return textExtensions.includes(ext);
};

export const SourceView: React.FC<SourceViewProps> = ({ bundle }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Get all text files from bundle
  const textFiles = Object.keys(bundle.files).filter(isTextFile).sort();

  // Select first file by default
  React.useEffect(() => {
    if (textFiles.length > 0 && !selectedFile) {
      setSelectedFile(textFiles[0]);
    }
  }, [textFiles, selectedFile]);

  // Load file content when selection changes
  React.useEffect(() => {
    if (!selectedFile) {
      setFileContent('');
      return;
    }

    const bytes = bundle.files[selectedFile];
    if (!bytes) {
      setFileContent('// File not found');
      return;
    }

    try {
      const decoder = new TextDecoder('utf-8');
      const content = decoder.decode(bytes);
      setFileContent(content);
    } catch (e) {
      setFileContent('// Error decoding file');
      console.error('Failed to decode file:', e);
    }
  }, [selectedFile, bundle.files]);

  const handleCopy = () => {
    if (!fileContent) return;
    navigator.clipboard.writeText(fileContent).then(() => {
      setCopiedPath(selectedFile);
      setTimeout(() => setCopiedPath(null), 2000);
    });
  };

  if (textFiles.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>No Source Files</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>
          No text files found in this creative
        </div>
      </div>
    );
  }

  const language = selectedFile ? getLanguage(selectedFile) : 'text';
  const lines = fileContent.split('\n');
  const highlightedLines = lines.map((line) => highlightCode(line, language));

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* File Tree */}
      <div
        style={{
          width: 220,
          borderRight: '1px solid var(--border)',
          overflow: 'auto',
          background: 'var(--surface)',
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            color: 'var(--muted)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          Files ({textFiles.length})
        </div>
        {textFiles.map((path) => {
          const isSelected = path === selectedFile;
          const fileName = path.split('/').pop() || path;
          return (
            <button
              key={path}
              type="button"
              onClick={() => setSelectedFile(path)}
              style={{
                width: '100%',
                padding: '6px 12px',
                fontSize: 12,
                textAlign: 'left',
                background: isSelected ? 'var(--primary-bg)' : 'transparent',
                color: isSelected ? 'var(--primary)' : 'var(--text)',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={path}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {fileName}
            </button>
          );
        })}
      </div>

      {/* Code Display */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header with filename and copy button */}
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface)',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontFamily: 'monospace',
              color: 'var(--muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={selectedFile || ''}
          >
            {selectedFile || ''}
          </span>
          <button
            type="button"
            className="btn"
            onClick={handleCopy}
            style={{
              padding: '4px 8px',
              fontSize: 11,
            }}
          >
            {copiedPath === selectedFile ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Code content with line numbers */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: 'var(--bg)',
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: 'flex' }}>
            {/* Line numbers */}
            <div
              style={{
                padding: '12px 8px',
                textAlign: 'right',
                color: 'var(--muted)',
                background: 'var(--surface)',
                borderRight: '1px solid var(--border)',
                userSelect: 'none',
                minWidth: 48,
              }}
            >
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>

            {/* Code lines */}
            <div
              style={{
                flex: 1,
                padding: '12px',
                color: 'var(--text)',
              }}
            >
              {highlightedLines.map((line, i) => (
                <div
                  key={i}
                  style={{ whiteSpace: 'pre' }}
                  dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

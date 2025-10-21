import React, { useState } from 'react';
import type { Finding } from '../../logic/types';

export interface JsonViewProps {
  findings: Finding[];
  creativeName: string;
}

// Simple JSON syntax highlighter
const highlightJson = (json: string): string => {
  let highlighted = json;
  
  // Escape HTML
  highlighted = highlighted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Keys (strings before colons)
  highlighted = highlighted.replace(
    /"([^"]+)":/g,
    '<span style="color: #61afef;">"$1"</span>:'
  );
  
  // String values
  highlighted = highlighted.replace(
    /:\s*"([^"]*)"/g,
    ': <span style="color: #98c379;">"$1"</span>'
  );
  
  // Numbers
  highlighted = highlighted.replace(
    /:\s*(\d+\.?\d*)/g,
    ': <span style="color: #d19a66;">$1</span>'
  );
  
  // Booleans
  highlighted = highlighted.replace(
    /\b(true|false|null)\b/g,
    '<span style="color: #c678dd;">$1</span>'
  );
  
  // Brackets
  highlighted = highlighted.replace(
    /([{}\[\]])/g,
    '<span style="color: #abb2bf; font-weight: bold;">$1</span>'
  );
  
  return highlighted;
};

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  count,
  children,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'left',
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--surface)';
        }}
      >
        <span>
          {isExpanded ? '▼' : '▶'} {title}
          {count !== undefined && (
            <span style={{ marginLeft: 8, color: 'var(--muted)', fontWeight: 400 }}>
              ({count})
            </span>
          )}
        </span>
      </button>
      {isExpanded && (
        <div style={{ marginTop: 8, paddingLeft: 12 }}>
          {children}
        </div>
      )}
    </div>
  );
};

export const JsonView: React.FC<JsonViewProps> = ({ findings, creativeName }) => {
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  
  // Group findings by severity
  const failFindings = findings.filter((f) => f.severity === 'FAIL');
  const warnFindings = findings.filter((f) => f.severity === 'WARN');
  const passFindings = findings.filter((f) => f.severity === 'PASS');
  
  // Create structured JSON object
  const jsonData = {
    creativeName,
    timestamp: new Date().toISOString(),
    summary: {
      total: findings.length,
      fail: failFindings.length,
      warn: warnFindings.length,
      pass: passFindings.length,
    },
    findings: findings.map((f) => ({
      id: f.id,
      title: f.title,
      severity: f.severity,
      profiles: f.profiles,
      messages: f.messages,
      offenders: f.offenders?.map((o) => ({
        path: o.path,
        line: o.line,
      })),
      description: f.description,
    })),
  };
  
  const jsonString = JSON.stringify(jsonData, null, 2);
  const highlightedJson = highlightJson(jsonString);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header with controls */}
      <div
        style={{
          padding: '12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--surface)',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>{findings.length}</strong> checks ·{' '}
          <span style={{ color: 'var(--fail-text)' }}>{failFindings.length} FAIL</span> ·{' '}
          <span style={{ color: 'var(--warn-text)' }}>{warnFindings.length} WARN</span> ·{' '}
          <span style={{ color: 'var(--pass-text)' }}>{passFindings.length} PASS</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={() => setShowRaw(!showRaw)}
            style={{
              padding: '4px 8px',
              fontSize: 11,
            }}
          >
            {showRaw ? 'Structured' : 'Raw'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleCopy}
            style={{
              padding: '4px 8px',
              fontSize: 11,
            }}
          >
            {copied ? '✓ Copied' : 'Copy JSON'}
          </button>
        </div>
      </div>

      {/* JSON content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--bg)',
          padding: 16,
        }}
      >
        {showRaw ? (
          // Raw JSON view
          <pre
            style={{
              margin: 0,
              fontFamily: 'monospace',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--text)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            dangerouslySetInnerHTML={{ __html: highlightedJson }}
          />
        ) : (
          // Structured view with collapsible sections
          <div>
            <CollapsibleSection title="Summary" defaultExpanded={true}>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  padding: 12,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 4,
                }}
              >
                <div>Creative: <strong>{creativeName}</strong></div>
                <div style={{ marginTop: 4 }}>Total Checks: <strong>{findings.length}</strong></div>
                <div style={{ marginTop: 4, color: 'var(--fail-text)' }}>
                  FAIL: <strong>{failFindings.length}</strong>
                </div>
                <div style={{ marginTop: 4, color: 'var(--warn-text)' }}>
                  WARN: <strong>{warnFindings.length}</strong>
                </div>
                <div style={{ marginTop: 4, color: 'var(--pass-text)' }}>
                  PASS: <strong>{passFindings.length}</strong>
                </div>
              </div>
            </CollapsibleSection>

            {failFindings.length > 0 && (
              <CollapsibleSection title="Failed Checks" count={failFindings.length} defaultExpanded={true}>
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--text)',
                    background: 'var(--surface)',
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    overflow: 'auto',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightJson(JSON.stringify(failFindings, null, 2)),
                  }}
                />
              </CollapsibleSection>
            )}

            {warnFindings.length > 0 && (
              <CollapsibleSection title="Warning Checks" count={warnFindings.length} defaultExpanded={false}>
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--text)',
                    background: 'var(--surface)',
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    overflow: 'auto',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightJson(JSON.stringify(warnFindings, null, 2)),
                  }}
                />
              </CollapsibleSection>
            )}

            {passFindings.length > 0 && (
              <CollapsibleSection title="Passing Checks" count={passFindings.length} defaultExpanded={false}>
                <pre
                  style={{
                    margin: 0,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--text)',
                    background: 'var(--surface)',
                    padding: 12,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    overflow: 'auto',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: highlightJson(JSON.stringify(passFindings, null, 2)),
                  }}
                />
              </CollapsibleSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

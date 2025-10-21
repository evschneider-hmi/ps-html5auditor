import React, { useState } from 'react';
import type { BundleResult } from '../../logic/types';

export interface MetadataButtonProps {
  bundleResult: BundleResult;
  bundle: {
    name: string;
    bytes: Uint8Array;
  };
}

export const MetadataButton: React.FC<MetadataButtonProps> = ({ bundleResult, bundle }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleClose = (e: React.MouseEvent) => {
    // Only close if clicking the overlay, not the modal content
    if (e.target === e.currentTarget) {
      setIsModalOpen(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={() => setIsModalOpen(true)}
        title="View metadata"
        style={{
          padding: '4px 8px',
          fontSize: 12,
        }}
      >
        Metadata
      </button>

      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={handleClose}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 8,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: '1px solid var(--border)',
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
                Preview Metadata
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  padding: 0,
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--text)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--muted)';
                }}
                title="Close"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Creative Info */}
              <section>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Creative Information
                </h3>
                <div
                  style={{
                    background: 'var(--bg)',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <strong>Name:</strong> {bundle.name}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Size:</strong> {formatBytes(bundle.bytes.length)}
                  </div>
                  {bundleResult.adSize && (
                    <div>
                      <strong>Dimensions:</strong> {bundleResult.adSize.width} × {bundleResult.adSize.height}px
                    </div>
                  )}
                </div>
              </section>

              {/* Simulation Info */}
              <section>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Simulation Environment
                </h3>
                <div
                  style={{
                    background: 'var(--bg)',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <strong>Base Directory:</strong>{' '}
                    {bundleResult.primary ? bundleResult.primary.path.split('/').slice(0, -1).join('/') || '/' : 'N/A'}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Entry Point:</strong> {bundleResult.primary ? bundleResult.primary.path : 'N/A'}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Enabler Source:</strong> CDN (Simulated)
                  </div>
                  <div>
                    <strong>Sandbox Mode:</strong> allow-scripts allow-same-origin allow-popups allow-forms
                  </div>
                </div>
              </section>

              {/* Performance Info */}
              {(bundleResult.initialBytes || bundleResult.subsequentBytes) && (
                <section>
                  <h3
                    style={{
                      margin: '0 0 8px 0',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Performance Metrics
                  </h3>
                  <div
                    style={{
                      background: 'var(--bg)',
                      padding: 12,
                      borderRadius: 4,
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  >
                    {bundleResult.initialBytes && (
                      <div style={{ marginBottom: 6 }}>
                        <strong>Initial Load:</strong> {formatBytes(bundleResult.initialBytes)} (compressed)
                      </div>
                    )}
                    {bundleResult.subsequentBytes && (
                      <div style={{ marginBottom: 6 }}>
                        <strong>Polite Load:</strong> {formatBytes(bundleResult.subsequentBytes)}
                      </div>
                    )}
                    {bundleResult.initialRequests && (
                      <div style={{ marginBottom: 6 }}>
                        <strong>Initial Requests:</strong> {bundleResult.initialRequests}
                      </div>
                    )}
                    {bundleResult.totalRequests && (
                      <div>
                        <strong>Total Requests:</strong> {bundleResult.totalRequests}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Notices */}
              <section>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Important Notices
                </h3>
                <div
                  style={{
                    background: 'var(--warn-bg)',
                    color: 'var(--warn-text)',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>⚠️ Visibility Guard:</strong> This preview is simulated in a sandboxed iframe. Some features
                    may behave differently in production environments.
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>🔗 Clickthrough URLs:</strong> Click tracking is simulated. Actual click behavior will vary
                    based on ad server configuration.
                  </p>
                  <p style={{ margin: 0 }}>
                    <strong>🌐 External Resources:</strong> External HTTP requests may be blocked by the sandbox. Use
                    HTTPS for all external resources.
                  </p>
                </div>
              </section>

              {/* Environment Details */}
              <section>
                <h3
                  style={{
                    margin: '0 0 8px 0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Environment Details
                </h3>
                <div
                  style={{
                    background: 'var(--bg)',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <strong>User Agent:</strong> {navigator.userAgent.substring(0, 60)}...
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <strong>Viewport:</strong> {window.innerWidth} × {window.innerHeight}px
                  </div>
                  <div>
                    <strong>Device Pixel Ratio:</strong> {window.devicePixelRatio}
                  </div>
                </div>
              </section>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                marginTop: 20,
                paddingTop: 16,
                borderTop: '1px solid var(--border)',
                textAlign: 'right',
              }}
            >
              <button
                type="button"
                className="btn"
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  fontSize: 13,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

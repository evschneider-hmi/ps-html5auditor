import React from 'react';
import { PreviewPanel } from './preview/PreviewPanel';
import type { ZipBundle, BundleResult, Finding } from '../logic/types';

interface PreviewModalProps {
  bundle: ZipBundle;
  bundleResult: BundleResult;
  findings: Finding[];
  creativeName: string;
  onClose: () => void;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  bundle,
  bundleResult,
  findings,
  creativeName,
  onClose,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 12,
          width: '90vw',
          maxWidth: '1200px',
          height: '90vh',
          maxHeight: '900px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Preview: {creativeName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 28,
              cursor: 'pointer',
              color: 'var(--muted)',
              padding: '0 8px',
              lineHeight: 1,
              transition: 'color 120ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--muted)')}
            aria-label="Close preview"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <PreviewPanel
            bundle={bundle}
            bundleResult={bundleResult}
            findings={findings}
            creativeName={creativeName}
          />
        </div>
      </div>
    </div>
  );
};

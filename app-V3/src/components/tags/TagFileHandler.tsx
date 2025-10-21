import React, { useRef } from 'react';
import { VastValidator } from './VAST';
import { JsDisplayTag } from './JsDisplayTag';
import { OneByOnePixel } from './OneByOnePixel';
import type { TagType } from '../../utils/tagTypeDetector';

export interface TagFileHandlerProps {
  files: File[];
  tagType: TagType;
  onClose: () => void;
}

/**
 * Handles tag files by routing them to the appropriate validator
 * based on detected tag type (VAST, JS Display, or 1x1 Pixel)
 */
export function TagFileHandler({ files, tagType, onClose }: TagFileHandlerProps) {
  const vastRef = useRef<any>(null);

  // Render the appropriate validator based on tag type
  const renderValidator = () => {
    switch (tagType) {
      case 'vast':
        return <VastValidator />;
      
      case 'js-display':
        return (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <h2>JavaScript Display Tag Validator</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Coming soon: Auto-process JavaScript display tags from Excel files
            </p>
            <JsDisplayTag />
          </div>
        );
      
      case '1x1-pixel':
        return (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <h2>1x1 Tracking Pixel Validator</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Coming soon: Auto-process tracking pixels from Excel files
            </p>
            <OneByOnePixel />
          </div>
        );
      
      default:
        return (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <h2>Unknown Tag Type</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              Could not determine tag type. Please use manual tag testing.
            </p>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        );
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 20
    }}>
      <div style={{
        backgroundColor: 'var(--bg)',
        borderRadius: 8,
        maxWidth: 1200,
        maxHeight: '90vh',
        width: '100%',
        overflow: 'auto',
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
      }}>
        <div style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '15px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1
        }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            Tag Validator - {tagType.toUpperCase()}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: 'var(--text)',
              padding: '0 10px'
            }}
            title="Close"
          >
            
          </button>
        </div>
        
        <div style={{ padding: 20 }}>
          {renderValidator()}
        </div>
      </div>
    </div>
  );
}

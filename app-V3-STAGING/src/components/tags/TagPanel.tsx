import React, { useState } from 'react';
import type { ZipBundle, BundleResult, Finding } from '../../logic/types';
import type { TagType } from '../../utils/tagTypeDetector';
import { VastValidator } from './VAST';
import { JsDisplayTag } from './JsDisplayTag';
import { OneByOnePixel } from './OneByOnePixel';

export interface TagPanelProps {
  files: File[];
  tagType: TagType;
  tagName: string;
}

/**
 * TagPanel - Main panel for displaying tag validation
 * Similar to PreviewPanel but for tags instead of creatives
 * Clean, organized, no popups
 */
export function TagPanel({ files, tagType, tagName }: TagPanelProps) {
  const [activeTab, setActiveTab] = useState<'validator' | 'details'>('validator');

  const renderValidator = () => {
    switch (tagType) {
      case 'vast':
        return <VastValidator initialFiles={files} />;
      
      case 'js-display':
        return (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 16 }}>JavaScript Display Tag Validator</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
              Coming soon: Auto-process JavaScript display tags from Excel files
            </p>
            <JsDisplayTag />
          </div>
        );
      
      case '1x1-pixel':
        return (
          <div style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 16 }}>1x1 Tracking Pixel Validator</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
              Coming soon: Auto-process tracking pixels from Excel files
            </p>
            <OneByOnePixel />
          </div>
        );
      
      case 'unknown':
      default:
        return (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 16 }}>Unknown Tag Type</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Could not determine tag type. File: {tagName}
            </p>
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
      {/* Header */}
      <div style={{ 
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          Tag Validator - {tagType.toUpperCase()}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e0e0e0',
        flexShrink: 0,
      }}>
        <button
          onClick={() => setActiveTab('validator')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeTab === 'validator' ? 'var(--surface)' : 'transparent',
            borderBottom: activeTab === 'validator' ? '2px solid var(--primary)' : 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'validator' ? 600 : 400,
            color: activeTab === 'validator' ? 'var(--primary)' : 'var(--text)',
          }}
        >
          Validator
        </button>
        <button
          onClick={() => setActiveTab('details')}
          style={{
            padding: '8px 16px',
            border: 'none',
            background: activeTab === 'details' ? 'var(--surface)' : 'transparent',
            borderBottom: activeTab === 'details' ? '2px solid var(--primary)' : 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: activeTab === 'details' ? 600 : 400,
            color: activeTab === 'details' ? 'var(--primary)' : 'var(--text)',
          }}
        >
          Details
        </button>
      </div>

      {/* Content */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: 0,
      }}>
        {activeTab === 'validator' && renderValidator()}
        {activeTab === 'details' && (
          <div style={{ padding: 20 }}>
            <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Tag Information</h4>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              <div><strong>File:</strong> {tagName}</div>
              <div><strong>Type:</strong> {tagType}</div>
              <div><strong>Files:</strong> {files.length}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { VastValidator } from './VAST';
import { JsDisplayTag } from './JsDisplayTag';
import { OneByOnePixel } from './OneByOnePixel';

export type TagMode = 'vast' | 'javascript' | 'pixel';

export interface TagTestingPanelProps {
  defaultMode?: TagMode;
}

export const TagTestingPanel: React.FC<TagTestingPanelProps> = ({ defaultMode = 'vast' }) => {
  const [mode, setMode] = useState<TagMode>(defaultMode);

  return (
    <div className="tag-testing-panel" style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="tag-testing-header" style={{ marginBottom: '20px' }}>
        <h2 style={{ marginBottom: '10px' }}>Tag Testing Suite</h2>
        <div className="tag-mode-tabs" style={{ display: 'flex', gap: '10px', borderBottom: '2px solid #ddd', marginBottom: '20px' }}>
          <button
            onClick={() => setMode('vast')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: mode === 'vast' ? '3px solid #0066cc' : 'none',
              background: mode === 'vast' ? '#f0f0f0' : 'transparent',
              cursor: 'pointer',
              fontWeight: mode === 'vast' ? 'bold' : 'normal',
            }}
          >
            VAST XML
          </button>
          <button
            onClick={() => setMode('javascript')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: mode === 'javascript' ? '3px solid #0066cc' : 'none',
              background: mode === 'javascript' ? '#f0f0f0' : 'transparent',
              cursor: 'pointer',
              fontWeight: mode === 'javascript' ? 'bold' : 'normal',
            }}
          >
            JavaScript Tag
          </button>
          <button
            onClick={() => setMode('pixel')}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: mode === 'pixel' ? '3px solid #0066cc' : 'none',
              background: mode === 'pixel' ? '#f0f0f0' : 'transparent',
              cursor: 'pointer',
              fontWeight: mode === 'pixel' ? 'bold' : 'normal',
            }}
          >
            1x1 Pixel
          </button>
        </div>
      </div>
      
      <div className="tag-testing-content">
        {mode === 'vast' && <VastValidator />}
        {mode === 'javascript' && <JsDisplayTag />}
        {mode === 'pixel' && <OneByOnePixel />}
      </div>
    </div>
  );
};

import React, { useState } from 'react';

export interface VastTag {
  url: string;
  xml?: string;
  vendor?: string;
  version?: string;
  duration?: number;
  mediaUrl?: string;
  clickThrough?: string;
  impressionTrackers?: string[];
  clickTrackers?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface VastValidatorProps {
  onResults?: (results: VastTag) => void;
}

const parseVastXml = async (xmlOrUrl: string): Promise<VastTag> => {
  const results: VastTag = {
    url: '',
    errors: [],
    warnings: [],
  };

  try {
    let xmlText = '';
    
    // Detect if input is URL or XML
    if (/^https?:\/\//i.test(xmlOrUrl.trim())) {
      results.url = xmlOrUrl.trim();
      try {
        const response = await fetch(xmlOrUrl.trim(), { mode: 'cors' });
        if (!response.ok) {
          results.errors?.push('HTTP ' + response.status + ': ' + response.statusText);
          return results;
        }
        xmlText = await response.text();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.errors?.push('Failed to fetch VAST URL: ' + message);
        return results;
      }
    } else {
      xmlText = xmlOrUrl;
    }

    results.xml = xmlText;

    // Parse XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const parseError = doc.querySelector('parsererror');
    
    if (parseError) {
      results.errors?.push('XML parsing error: ' + (parseError.textContent || 'Unknown error'));
      return results;
    }

    // Extract VAST version
    const vastEl = doc.querySelector('VAST');
    if (vastEl) {
      results.version = vastEl.getAttribute('version') || 'Unknown';
    } else {
      results.errors?.push('Not a valid VAST document (missing VAST root element)');
      return results;
    }

    // Extract duration from Linear creative
    const durationEl = doc.querySelector('Linear Duration');
    if (durationEl?.textContent) {
      const durationText = durationEl.textContent.trim();
      const parts = durationText.split(':');
      if (parts.length === 3) {
        const [h, m, s] = parts.map(parseFloat);
        results.duration = h * 3600 + m * 60 + s;
      }
    }

    // Extract media file URL (prefer highest bitrate MP4)
    const mediaFiles = Array.from(doc.querySelectorAll('MediaFile'));
    let bestMedia: Element | null = null;
    let bestBitrate = 0;
    
    for (const media of mediaFiles) {
      const type = media.getAttribute('type') || '';
      const bitrate = parseInt(media.getAttribute('bitrate') || '0', 10);
      
      if (type.includes('mp4') && bitrate > bestBitrate) {
        bestMedia = media;
        bestBitrate = bitrate;
      }
    }
    
    if (bestMedia?.textContent) {
      results.mediaUrl = bestMedia.textContent.trim();
    }

    // Extract ClickThrough
    const clickThroughEl = doc.querySelector('VideoClicks ClickThrough, NonLinearClickThrough, CompanionClickThrough');
    if (clickThroughEl?.textContent) {
      results.clickThrough = clickThroughEl.textContent.trim();
    }

    // Extract Impression trackers
    results.impressionTrackers = Array.from(doc.querySelectorAll('Impression'))
      .map(el => el.textContent?.trim())
      .filter((url): url is string => !!url);

    // Extract Click trackers
    results.clickTrackers = Array.from(doc.querySelectorAll('ClickTracking, NonLinearClickTracking, CompanionClickTracking'))
      .map(el => el.textContent?.trim())
      .filter((url): url is string => !!url);

    // Vendor detection (basic)
    const allUrls = [
      ...(results.impressionTrackers || []),
      ...(results.clickTrackers || []),
      results.mediaUrl || '',
    ].join(' ');

    if (allUrls.includes('doubleclick.net') || allUrls.includes('cm.g.doubleclick.net')) {
      results.vendor = 'CM360';
    } else if (allUrls.includes('innovid.com')) {
      results.vendor = 'Innovid';
    } else if (allUrls.includes('doubleverify.com')) {
      results.vendor = 'DoubleVerify';
    } else {
      results.vendor = 'Unknown';
    }

    // Validation warnings
    if (!results.duration) {
      results.warnings?.push('Duration not found in VAST XML');
    }
    if (!results.mediaUrl) {
      results.warnings?.push('No media file URL found');
    }
    if (!results.clickThrough) {
      results.warnings?.push('No ClickThrough URL found');
    }
    if ((results.impressionTrackers?.length || 0) === 0) {
      results.warnings?.push('No impression trackers found');
    }

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.errors?.push('Unexpected error: ' + message);
  }

  return results;
};

export const VastValidator: React.FC<VastValidatorProps> = ({ onResults }) => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState<VastTag | null>(null);
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    setResults(null);
    
    try {
      const vastResults = await parseVastXml(input);
      setResults(vastResults);
      onResults?.(vastResults);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResults({
        url: input,
        errors: ['Failed to validate VAST: ' + message],
        warnings: [],
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="vast-validator">
      <h3>VAST XML Validator</h3>
      <textarea
        placeholder="Paste VAST XML or URL here..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={8}
        style={{ width: '100%', fontFamily: 'monospace', fontSize: '12px', marginBottom: '10px' }}
      />
      <button onClick={handleValidate} disabled={!input.trim() || loading}>
        {loading ? 'Validating...' : 'Validate VAST'}
      </button>
      
      {results && (
        <div className="validation-results" style={{ marginTop: '20px' }}>
          <h4>VAST Validation Results</h4>
          
          {results.errors && results.errors.length > 0 && (
            <div className="errors" style={{ color: 'red', marginBottom: '10px' }}>
              <strong>Errors:</strong>
              <ul>
                {results.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {results.warnings && results.warnings.length > 0 && (
            <div className="warnings" style={{ color: 'orange', marginBottom: '10px' }}>
              <strong>Warnings:</strong>
              <ul>
                {results.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}

          {(!results.errors || results.errors.length === 0) && (
            <div className="vast-info">
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li><strong>Version:</strong> {results.version || 'N/A'}</li>
                <li><strong>Vendor:</strong> {results.vendor || 'Unknown'}</li>
                <li><strong>Duration:</strong> {results.duration ? results.duration.toFixed(1) + 's' : 'N/A'}</li>
                <li><strong>Media URL:</strong> {results.mediaUrl ? <a href={results.mediaUrl} target="_blank" rel="noopener noreferrer">View</a> : 'N/A'}</li>
                <li><strong>ClickThrough:</strong> {results.clickThrough ? <a href={results.clickThrough} target="_blank" rel="noopener noreferrer">{results.clickThrough.substring(0, 50)}...</a> : 'N/A'}</li>
                <li><strong>Impression Trackers:</strong> {results.impressionTrackers?.length || 0}</li>
                <li><strong>Click Trackers:</strong> {results.clickTrackers?.length || 0}</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

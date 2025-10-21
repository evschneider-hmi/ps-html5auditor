import React, { useState, useCallback, useEffect } from 'react';
import { VastEntry } from './types';
import { parseExcelFile } from './excelParser';
import { parseVastXml } from './vastParser';
import { extractHost, extractVendorsFromTrackers } from './vendorUtils';
import { VastDataTable } from './VastDataTable';
import { VastPreview } from './VastPreview';

export interface VastValidatorProps {
  initialFiles?: File[];
}

export const VastValidator: React.FC<VastValidatorProps> = ({ initialFiles }) => {
  const [entries, setEntries] = useState<VastEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [info, setInfo] = useState<string[]>([]);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<VastEntry | null>(null);

  // Auto-process initialFiles when component mounts
  useEffect(() => {
    if (!initialFiles || initialFiles.length === 0) return;

    const processFiles = async () => {
      setLoading(true);
      setAlerts([]);
      setInfo([]);

      const newEntries: VastEntry[] = [];
      const newInfo: string[] = [];
      const newAlerts: string[] = [];

      for (const file of initialFiles) {
        try {
          if (file.name.match(/\.(xlsx|xlsm|xls|csv)$/i)) {
            // Parse Excel/CSV
            const parsed = await parseExcelFile(file);
            newEntries.push(...parsed);
            newInfo.push(`Extracted ${parsed.length} VAST tags from ${file.name}`);
          } else if (file.name.match(/\.zip$/i)) {
            newAlerts.push(`ZIP file support not yet implemented: ${file.name}`);
          } else {
            newAlerts.push(`Unsupported file type: ${file.name}`);
          }
        } catch (error) {
          newAlerts.push(`Error parsing ${file.name}: ${(error as Error).message}`);
        }
      }

      setInfo(newInfo);
      setAlerts(newAlerts);
      
      // Process VAST URLs
      await processVastUrls(newEntries);
      
      setEntries(prev => [...prev, ...newEntries]);
      
      // Auto-select first entry
      if (newEntries.length > 0 && !selectedEntry) {
        setSelectedEntry(newEntries[0]);
      }
      
      setLoading(false);
    };

    processFiles();
  }, []); // Run once on mount

  const processVastUrls = async (entries: VastEntry[]) => {
    for (const entry of entries) {
      try {
        const parsed = await parseVastXml(entry.vastUrl);
        
        entry.vendor = parsed.vendor;
        entry.host = extractHost(entry.vastUrl);
        entry.vastVersion = parsed.version;
        entry.duration = parsed.duration;
        entry.creative = parsed.mediaUrl ? parsed.mediaUrl.split('/').pop() || '' : '';
        entry.impressionVendors = extractVendorsFromTrackers(parsed.impressionTrackers);
        entry.clickVendors = extractVendorsFromTrackers(parsed.clickTrackers);
        
        if (parsed.errors.length > 0 || parsed.warnings.length > 0) {
          entry.alerts = [...parsed.errors, ...parsed.warnings];
        }
      } catch (error) {
        entry.alerts = ['Failed to parse VAST: ' + (error as Error).message];
      }
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;

    setLoading(true);
    const newEntry: VastEntry = {
      id: `entry-${Date.now()}`,
      type: 'VAST URL',
      vendor: '',
      host: '',
      placementId: '',
      placementName: '',
      platform: '',
      startDate: '',
      endDate: '',
      vastUrl: urlInput.trim(),
      creative: '',
      vastVersion: '',
      duration: '',
      impressionVendors: [],
      clickVendors: [],
      otherParams: 'Manual URL entry',
      alerts: [],
    };

    await processVastUrls([newEntry]);
    setEntries(prev => [...prev, newEntry]);
    setUrlInput('');
    setShowUrlModal(false);
    setLoading(false);
  };

  const handleRemoveEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const handleClearAll = useCallback(() => {
    setEntries([]);
    setAlerts([]);
    setInfo([]);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      {/* Action Controls */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12 }}>
        <button
          onClick={() => setShowUrlModal(true)}
          style={{
            padding: '10px 20px',
            background: 'var(--primary, #4f46e5)',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Enter VAST URL
        </button>

        {entries.length > 0 && (
          <button
            onClick={handleClearAll}
            style={{
              padding: '10px 20px',
              background: 'var(--danger, #ef4444)',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Clear Uploads
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary, #666)' }}>
          Processing VAST tags...
        </div>
      )}

      {/* Layout: Table, then Preview below */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Data Table */}
        <VastDataTable
          entries={entries}
          onRemoveEntry={handleRemoveEntry}
          onRowClick={setSelectedEntry}
          selectedEntryId={selectedEntry?.id}
        />

        {/* Preview Panel - appears below table when row is selected */}
        {selectedEntry && (
          <div style={{ 
            border: '1px solid var(--border, #e0e0e0)', 
            borderRadius: 6,
            padding: 16,
            background: 'var(--surface, #fff)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Preview</h3>
              <button
                onClick={() => setSelectedEntry(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: 'var(--text-secondary, #666)',
                  padding: 4,
                }}
                title="Close preview"
              >
                ×
              </button>
            </div>
            <VastPreview entry={selectedEntry} />
          </div>
        )}
      </div>

      {/* Alerts and Info */}
      {(alerts.length > 0 || info.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Alerts</div>
            <ul
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                minHeight: 80,
                background: 'var(--surface-2, #f5f5f5)',
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--border, #ddd)',
                listStyle: 'none',
                margin: 0,
              }}
            >
              {alerts.length === 0 && <li style={{ color: 'var(--text-secondary, #999)' }}>No alerts</li>}
              {alerts.map((alert, i) => (
                <li
                  key={i}
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    margin: '2px 0',
                    padding: '2px 4px',
                  }}
                >
                  {alert}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Info</div>
            <ul
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                minHeight: 80,
                background: 'var(--surface-2, #f5f5f5)',
                padding: 6,
                borderRadius: 6,
                border: '1px solid var(--border, #ddd)',
                listStyle: 'none',
                margin: 0,
              }}
            >
              {info.length === 0 && <li style={{ color: 'var(--text-secondary, #999)' }}>No info</li>}
              {info.map((item, i) => (
                <li key={i} style={{ margin: '2px 0', padding: '2px 4px' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* URL Input Modal */}
      {showUrlModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowUrlModal(false)}
        >
          <div
            style={{
              background: 'white',
              padding: 24,
              borderRadius: 8,
              width: '90%',
              maxWidth: 600,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Enter VAST URL</h3>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/vast.xml"
              style={{
                width: '100%',
                padding: 12,
                border: '1px solid var(--border, #ddd)',
                borderRadius: 6,
                fontSize: 14,
                marginBottom: 16,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlSubmit();
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUrlModal(false)}
                style={{
                  padding: '10px 20px',
                  background: 'var(--surface-2, #e5e5e5)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUrlSubmit}
                disabled={!urlInput.trim()}
                style={{
                  padding: '10px 20px',
                  background: urlInput.trim() ? 'var(--primary, #4f46e5)' : 'var(--surface-2, #e5e5e5)',
                  color: urlInput.trim() ? 'white' : 'var(--text-secondary, #999)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: urlInput.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                Add VAST URL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

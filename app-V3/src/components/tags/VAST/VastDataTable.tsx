import React from 'react';
import { VastEntry } from './types';

interface VastDataTableProps {
  entries: VastEntry[];
  onRemoveEntry: (id: string) => void;
}

export const VastDataTable: React.FC<VastDataTableProps> = ({ entries, onRemoveEntry }) => {
  if (entries.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
        Detected {entries.length} input{entries.length !== 1 ? 's' : ''}
      </div>
      
      <div style={{ overflowX: 'auto', border: '1px solid var(--border, #ddd)', borderRadius: 6 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--surface-2, #f5f5f5)', borderBottom: '2px solid var(--border, #ddd)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 40 }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 80 }}>Type</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 100 }}>Vendor</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 150 }}>Host</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 100 }}>Placement ID</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 200 }}>Placement Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 150 }}>Platform</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 100 }}>Start Date</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 100 }}>End Date</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 300 }}>VAST URL</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 150 }}>Creative</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 80 }}>VAST Ver</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 80 }}>Duration</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 150 }}>Impression Vendors</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 150 }}>Click Vendors</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 200 }}>Other Params</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, minWidth: 80 }}>Alerts</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr
                key={entry.id}
                style={{
                  borderBottom: '1px solid var(--border, #e5e5e5)',
                  background: index % 2 === 0 ? 'transparent' : 'var(--surface-1, #fafafa)',
                }}
              >
                <td style={{ padding: '8px 12px' }}>
                  <button
                    onClick={() => onRemoveEntry(entry.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--danger, #ef4444)',
                      cursor: 'pointer',
                      fontSize: 16,
                      padding: '0 4px',
                      marginRight: 4,
                    }}
                    title="Remove row"
                  >
                    ×
                  </button>
                  {index + 1}
                </td>
                <td style={{ padding: '8px 12px' }}>{entry.type}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{entry.vendor || '-'}</td>
                <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'monospace' }}>{entry.host || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{entry.placementId || '-'}</td>
                <td style={{ padding: '8px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.placementName}>
                  {entry.placementName || '-'}
                </td>
                <td style={{ padding: '8px 12px' }}>{entry.platform || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{entry.startDate || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{entry.endDate || '-'}</td>
                <td style={{ padding: '8px 12px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.vastUrl}>
                  <a href={entry.vastUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary, #4f46e5)' }}>
                    {entry.vastUrl}
                  </a>
                </td>
                <td style={{ padding: '8px 12px' }}>{entry.creative || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{entry.vastVersion || '-'}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{entry.duration || '-'}</td>
                <td style={{ padding: '8px 12px', fontSize: 11 }}>
                  {entry.impressionVendors.length > 0 ? entry.impressionVendors.join(', ') : '-'}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 11 }}>
                  {entry.clickVendors.length > 0 ? entry.clickVendors.join(', ') : '-'}
                </td>
                <td style={{ padding: '8px 12px', fontSize: 10, fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.otherParams}>
                  {entry.otherParams || '-'}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                  {entry.alerts.length > 0 ? (
                    <span style={{ color: 'var(--danger, #ef4444)', fontWeight: 700 }}>{entry.alerts.length}</span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

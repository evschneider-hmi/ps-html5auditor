import { useState } from 'react';
import { saveSessionToCloud, generateShareUrl } from '../services/firebase';

interface ShareButtonProps {
  uploads: any[];
  selectedUploadId: string | null;
  activeTab: 'creatives' | 'tags' | null;
  viewMode: 'list' | 'grid';
  sortConfig: { field: string; direction: 'asc' | 'desc' };
}

export default function ShareButton({
  uploads,
  selectedUploadId,
  activeTab,
  viewMode,
  sortConfig
}: ShareButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleShare = async () => {
    if (uploads.length === 0) {
      alert('No results to share. Please upload a creative or tag first.');
      return;
    }

    setIsSharing(true);
    try {
      const sessionId = await saveSessionToCloud(
        uploads,
        selectedUploadId,
        activeTab,
        viewMode,
        sortConfig
      );
      const url = generateShareUrl(sessionId);
      setShareUrl(url);
      setShowDialog(true);
      
      // Auto-copy to clipboard
      try {
        await navigator.clipboard.writeText(url);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 3000);
      } catch (err) {
        setCopyStatus('error');
      }
    } catch (error) {
      console.error('Share failed:', error);
      alert('Failed to create shareable link. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      setCopyStatus('error');
    }
  };

  return (
    <>
      <button
        onClick={handleShare}
        disabled={isSharing || uploads.length === 0}
        title="Share results"
        style={{
          padding: '8px 16px',
          background: isSharing ? '#94a3b8' : uploads.length === 0 ? '#cbd5e1' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: isSharing || uploads.length === 0 ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'all 0.2s'
        }}
      >
        {isSharing ? 'Creating Link...' : ' Share Results'}
      </button>

      {showDialog && shareUrl && (
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
            zIndex: 9999
          }}
          onClick={() => setShowDialog(false)}
        >
          <div
            style={{
              background: 'white',
              padding: '32px',
              borderRadius: '12px',
              maxWidth: '600px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', color: '#1e293b' }}>
               Shareable Link Created
            </h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '14px' }}>
              Share this link with anyone. Results will be available for 7 days.
            </p>
            
            <div style={{ 
              display: 'flex', 
              gap: '8px',
              marginBottom: '20px'
            }}>
              <input
                type="text"
                value={shareUrl}
                readOnly
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  background: '#f8fafc'
                }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={handleCopy}
                style={{
                  padding: '12px 20px',
                  background: copyStatus === 'copied' ? '#10b981' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}
              >
                {copyStatus === 'copied' ? ' Copied' : ' Copy'}
              </button>
            </div>

            <button
              onClick={() => setShowDialog(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

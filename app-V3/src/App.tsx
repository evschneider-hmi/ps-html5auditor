import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { runAllChecks } from './logic/creatives';
import { defaultSettings } from './logic/profiles';
import { readZip } from './logic/zipReader';
import { discoverPrimary } from './logic/discovery';
import { parsePrimary } from './logic/parse';
import type { Finding, BundleResult, ZipBundle } from './logic/types';
import { HelpButton } from './components/HelpButton';
import { getHelpContent } from './data/helpContent';
import type { Upload, ActiveTab, CreativeSubtype } from './types';
import { ResultsTable } from './components/ResultsTable';
import { PreviewPanel } from './components/preview/PreviewPanel';
import { FindingsList } from './components/FindingsList';
import { TagPanel } from './components/tags';
import { detectTagType, type TagType } from './utils/tagTypeDetector';

import { BatchActions } from './components/BatchActions';
import { downloadAllUploadsJson, downloadAllUploadsCsv } from './utils/export';
import { ExportButton } from './components/ExportButton';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { QuickActionsBar } from './components/QuickActionsBar';
import { ViewToggle, type ViewMode } from './components/ViewToggle';
import type { SortConfig } from './components/SortControls';
import { ResultsGrid } from './components/ResultsGrid';
import { sortUploads, toggleSort } from './utils/sorting';
import { detectCreativeMetadata } from './utils/creativeMetadataDetector';
import { useUploadQueue } from './hooks/useUploadQueue';
import { ErrorDialog } from './components/ErrorDialog';

export default function App() {
  // Upload state
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<ActiveTab>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'name', direction: 'asc' });

  // Theme state
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ext_theme') === 'dark';
    } catch {
      return false;
    }
  });

  // UI state (not workspace-specific)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Error dialog state
  const [errorDialog, setErrorDialog] = useState<{ title: string; message: string } | null>(null);

  // Keyboard shortcuts help modal state
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  // Split pane state (0.25 to 0.75 range)
  const [split, setSplit] = useState<number>(() => {
    try {
      const stored = localStorage.getItem('ext_split');
      if (stored) {
        const value = parseFloat(stored);
        if (!isNaN(value)) return Math.min(0.75, Math.max(0.25, value));
      }
    } catch {}
    return 0.5;
  });

  // Auto-adjust split when creative dimensions require it
  useEffect(() => {
    if (!selectedUploadId || !containerRef.current) return;
    
    const selectedUpload = uploads.find(u => u.id === selectedUploadId);
    if (!selectedUpload?.bundleResult?.adSize) {
      console.log('[App] No adSize found for selected upload');
      return;
    }

    const creativeWidth = selectedUpload.bundleResult.adSize.width;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    
    console.log('[App] Auto-split calculation:', {
      creativeWidth,
      containerWidth,
      currentSplit: split,
      currentPreviewWidth: containerWidth * (1 - split),
    });
    
    // Calculate minimum split needed to show full creative width
    // Preview needs: creative width + 80px padding + 20px for controls
    const minPreviewWidth = creativeWidth + 100;
    const minSplitForCreative = 1 - (minPreviewWidth / containerWidth);
    
    // If creative needs more than 50% of screen, expand preview
    // Otherwise, default to 50/50 split
    const idealSplit = Math.max(0.25, Math.min(0.5, minSplitForCreative));
    
    console.log('[App] Calculated splits:', {
      minPreviewWidth,
      minSplitForCreative,
      idealSplit,
    });
    
    // Update split if it differs from the ideal split
    // This ensures we expand for wide creatives and shrink back to 50/50 for normal sizes
    if (split !== idealSplit) {
      console.log('[App] Adjusting split from', split, 'to', idealSplit);
      setSplit(idealSplit);
    }
  }, [selectedUploadId, uploads, split]);

  // Upload queue for parallel processing
  const uploadQueue = useUploadQueue({
    maxWorkers: 4,
    onComplete: (newUploads) => {
      console.log('[App] Upload queue complete:', newUploads.length);
      
      // Add all completed uploads
      const allUploads = [...uploads, ...newUploads];
      setUploads(allUploads);
      
      // Select the last uploaded creative
      const lastUploadId = newUploads[newUploads.length - 1]?.id;
      if (lastUploadId) {
        setSelectedUploadId(lastUploadId);
      }
      
      setLoading(false);
    },
    onError: (errorMsg, fileName) => {
      console.error('[App] Upload error:', fileName, errorMsg);
      setError(`Error uploading ${fileName}: ${errorMsg}`);
    },
  });

  // Determine if tabs should be shown (both creatives AND tags exist)
  const hasCreatives = uploads.some(u => u.type === 'creative');
  const hasTags = uploads.some(u => u.type === 'tag');
  const showTabs = hasCreatives && hasTags;

  // Set default active tab when tabs appear
  useEffect(() => {
    if (showTabs && !activeTab) {
      setActiveTab('creatives');
    } else if (!showTabs) {
      setActiveTab(null);
    }
  }, [showTabs, activeTab]);

  // Memoize filtered uploads to avoid recalculating on every render (Phase 5.4 optimization)
  const filteredUploads = useMemo(() => {
    if (!showTabs || !activeTab) {
      return uploads;
    }
    if (activeTab === 'creatives') {
      return uploads.filter(u => u.type === 'creative');
    }
    if (activeTab === 'tags') {
      return uploads.filter(u => u.type === 'tag');
    }
    return uploads;
  }, [uploads, activeTab, showTabs]);

  // Memoize sorted uploads to avoid re-sorting on every render (Phase 5.4 optimization)
  const sortedUploads = useMemo(() => {
    return sortUploads(filteredUploads, sortConfig);
  }, [filteredUploads, sortConfig]);

  // Auto-select first filtered upload when active tab changes
  useEffect(() => {
    if (!activeTab || !showTabs) return;
    
    // If currently selected upload is not in filtered list, auto-select first one
    const currentlySelectedInFiltered = selectedUploadId && 
      filteredUploads.some(u => u.id === selectedUploadId);
    
    if (!currentlySelectedInFiltered && filteredUploads.length > 0) {
      setSelectedUploadId(filteredUploads[0].id);
    }
  }, [activeTab, filteredUploads, selectedUploadId, showTabs]);

  // Apply theme
  useEffect(() => {
    try {
      localStorage.setItem('ext_theme', dark ? 'dark' : 'light');
    } catch {}
    try {
      const cls = document.body.classList;
      if (!cls) return;
      if (dark) cls.add('theme-dark');
      else cls.remove('theme-dark');
    } catch {}
  }, [dark]);

  // Persist split state
  useEffect(() => {
    try {
      localStorage.setItem('ext_split', String(split));
    } catch {}
  }, [split]);

  // Handle drag resize for split pane
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const p = Math.min(0.75, Math.max(0.25, x / Math.max(1, rect.width)));
      setSplit(p);
      e.preventDefault();
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);



  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    
    console.log(`[App] Processing ${files.length} file(s)`);
    
    // Reset error state
    setLoading(true);
    setError(null);
    
    // Check for duplicate names
    const existingNames = new Set(uploads.map(u => u.bundle.name));
    const duplicates: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const fileName = files[i].name;
      if (existingNames.has(fileName)) {
        duplicates.push(fileName);
      }
    }
    
    // Show error dialog if duplicates found
    if (duplicates.length > 0) {
      setLoading(false);
      const fileList = duplicates.map(name => `• ${name}`).join('\n');
      setErrorDialog({
        title: 'Duplicate Files Detected',
        message: `The following file(s) are already uploaded:\n\n${fileList}\n\nPlease remove or rename the existing file(s) before uploading again.`
      });
      return;
    }
    
    // Separate files by type
    const creativeFiles: File[] = [];
    const newTagUploads: Upload[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const detectedType = await detectTagType(file);
      
      console.log(`[App] File "${file.name}" detected as: ${detectedType}`);
      
      if (detectedType === 'creative') {
        creativeFiles.push(file);
      } else if (detectedType === 'vast' || detectedType === 'js-display' || detectedType === '1x1-pixel') {
        // Create a tag upload immediately
        const tagUpload: Upload = {
          id: `tag-${Date.now()}-${i}`,
          timestamp: Date.now(),
          type: 'tag',
          subtype: 'adtag',
          bundle: {
            id: `tag-${Date.now()}-${i}`,
            name: file.name,
            bytes: new Uint8Array(),
            files: {},
            lowerCaseIndex: {},
          },
          bundleResult: {
            bundleId: `tag-${Date.now()}-${i}`,
            bundleName: file.name,
            primary: undefined,
            adSize: { width: 0, height: 0 },
            findings: [],
            references: [],
            summary: {
              status: 'PASS',
              totalFindings: 0,
              fails: 0,
              warns: 0,
              pass: 0,
              orphanCount: 0,
              missingAssetCount: 0,
            },
          },
          findings: [],
          tagType: detectedType,
          tagFiles: [file],
        };
        newTagUploads.push(tagUpload);
      } else {
        // Unknown type - default to creative processing
        creativeFiles.push(file);
      }
    }
    
    // Add tag uploads immediately
    if (newTagUploads.length > 0) {
      const allUploads = [...uploads, ...newTagUploads];
      setUploads(allUploads);
      
      // Select the first tag upload
      const firstTagId = newTagUploads[0]?.id;
      if (firstTagId) {
        setSelectedUploadId(firstTagId);
        setActiveTab('tags');
      }
    }
    
    // Process creative files through normal queue
    if (creativeFiles.length > 0) {
      console.log(`[App] Adding ${creativeFiles.length} creative file(s) to queue`);
      uploadQueue.addFiles(creativeFiles);
      uploadQueue.start();
    }
    
    setLoading(false);
  };

  const openFileDialog = () => {
    if (!inputRef.current) return;
    try {
      inputRef.current.value = '';
    } catch {}
    inputRef.current.click();
  };

  const handleRemoveUpload = (id: string) => {
    setUploads(uploads.filter(u => u.id !== id));
    // Clear selection if removed upload was selected
    if (selectedUploadId === id) {
      setSelectedUploadId(null);
    }
  };

  const handleSelectUpload = (id: string) => {
    // Toggle selection: if clicking the same upload, deselect it
    setSelectedUploadId(prev => prev === id ? null : id);
  };

  // Batch operation handlers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAll = () => {
    // Select all filtered uploads matching current tab
    setSelectedIds(new Set(filteredUploads.map(u => u.id)));
  };

  const handleSelectNone = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = (ids: string[]) => {
    setUploads(uploads.filter(u => !ids.includes(u.id)));
    setSelectedIds(new Set());
    // Clear selection if deleted upload was selected
    if (selectedUploadId && ids.includes(selectedUploadId)) {
      setSelectedUploadId(null);
    }
  };

  const handleBulkExport = (ids: string[], format: 'json' | 'csv') => {
    const selectedUploads = uploads.filter(u => ids.includes(u.id));
    if (selectedUploads.length === 0) return;
    
    if (format === 'json') {
      downloadAllUploadsJson(selectedUploads);
    } else {
      downloadAllUploadsCsv(selectedUploads);
    }
  };

  // Keyboard shortcut handlers
  const handleDeleteShortcut = () => {
    if (selectedIds.size > 0) {
      handleBulkDelete(Array.from(selectedIds));
    }
  };

  const handleExportShortcut = () => {
    if (selectedIds.size > 0) {
      handleBulkExport(Array.from(selectedIds), 'json');
    }
  };

  const handleFocusSearch = () => {
    // Focus the first search input found
    const searchInput = document.querySelector<HTMLInputElement>('.filter-search-input');
    if (searchInput) {
      searchInput.focus();
      searchInput.select();
    }
  };

  const handleClearSearch = () => {
    // Trigger clear on all filter controls
    const clearButtons = document.querySelectorAll<HTMLButtonElement>('.filter-header button');
    clearButtons.forEach(btn => {
      if (btn.textContent?.includes('Clear')) {
        btn.click();
      }
    });
    // Also deselect if nothing to clear
    if (selectedIds.size > 0) {
      handleSelectNone();
    }
  };

  const handleToggleTheme = () => {
    setDark(prev => !prev);
  };

  // View mode and sort handlers
  const handleViewToggle = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(toggleSort(sortConfig, field));
  };

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onSelectAll: handleSelectAll,
    onDeselectAll: handleSelectNone,
    onDelete: handleDeleteShortcut,
    onExport: handleExportShortcut,
    onFocusSearch: handleFocusSearch,
    onClearSearch: handleClearSearch,
    onShowHelp: () => setShowShortcutsHelp(true),
    onToggleTheme: handleToggleTheme,
  });

  return (
    <div className="app">
      <style>{`
        @keyframes ext-spinner {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="brand">
          <div className="brand-logo" />
          <div>
            <div className="brand-title">Creative Suite Auditor V3</div>
            <div className="brand-sub">
              From Horizon Media's Platform Solutions team
            </div>
          </div>
        </div>
        <div className="toolbar">
          <ExportButton 
            uploads={uploads}
            disabled={uploads.length === 0}
          />
          <button 
            className="btn primary" 
            onClick={() => {
              // Clear all state
              setUploads([]);
              setSelectedUploadId(null);
              setSelectedIds(new Set());
              setActiveTab(null);
              setError(null);
              // Clear URL session parameter
              window.history.pushState({}, '', window.location.pathname);
              // Note: localStorage sessions persist for sharing, not cleared on restart
            }}
            title="Clear all uploads and start fresh"
          >
            Restart
          </button>
          <ThemeSwitch dark={dark} onToggle={() => setDark((v) => !v)} />
        </div>
      </header>

      {/* Beta Banner */}
      <div className="beta-banner" role="status">
        <span className="beta-label">BETA</span>
        <span className="beta-message">
          V3 is in active development. Some features may be incomplete.
        </span>
        <HelpButton 
          content={getHelpContent('betaBanner')} 
          position="bottom"
          ariaLabel="What does beta mean?"
        />
      </div>

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload ZIP files"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFileDialog();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (inputRef.current) {
            try {
              inputRef.current.value = '';
            } catch {}
          }
          void handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 12,
          padding: 32,
          minHeight: 320,
          background: dragOver ? 'var(--surface-2)' : 'var(--surface)',
          color: 'var(--text)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          position: 'relative',
          cursor: 'pointer',
          outline: 'none',
          transition: 'background 120ms ease, border-color 120ms ease',
          userSelect: 'none',
        }}
      >
        {loading && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              borderRadius: 999,
              background: 'rgba(99, 102, 241, 0.18)',
              color: '#4338ca',
              boxShadow: '0 8px 18px rgba(79, 70, 229, 0.18)',
              pointerEvents: 'none',
              zIndex: 5,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '3px solid rgba(165, 180, 252, 0.28)',
                borderTopColor: '#7c3aed',
                borderRightColor: '#7c3aed',
                animation: 'ext-spinner 0.9s linear infinite',
              }}
              aria-hidden="true"
            />
            <span>Processing...</span>
          </div>
        )}
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 6,
            }}
          >
            Drop creatives or tags here to upload
          </div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Accept: .zip, .xlsx, .xlsm, .xls, .csv (multiple allowed)
          </div>
          <div style={{ marginTop: 10 }}>
            <div
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: 'white',
                fontSize: 12,
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              Upload files
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.xlsx,.xlsm,.xls,.csv"
            multiple={true}
            onClick={(e) => {
              try {
                e.currentTarget.value = '';
              } catch {}
            }}
            onChange={(e) => void handleFiles(e.target.files)}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 5,
            }}
          />
          {error && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--fail)',
                marginTop: 8,
                fontWeight: 600,
              }}
            >
              ❌ {error}
            </div>
          )}
        </div>
      </div>

      {/* Results Section with Split Pane */}
      {uploads.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {/* Quick Actions Bar (sticky) */}
          <QuickActionsBar
            selectedCount={selectedIds.size}
            totalCount={filteredUploads.length}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleSelectNone}
            onDelete={handleDeleteShortcut}
            onExport={handleExportShortcut}
            onShowHelp={() => setShowShortcutsHelp(true)}
          />

          {/* Tab Navigation (only shown when both creatives and tags exist) */}
          {showTabs && (
            <div className="tabs" style={{ marginBottom: 12 }}>
              <button
                className={`tab ${activeTab === 'creatives' ? 'active' : ''}`}
                onClick={() => setActiveTab('creatives')}
              >
                Creatives
              </button>
              <button
                className={`tab ${activeTab === 'tags' ? 'active' : ''}`}
                onClick={() => setActiveTab('tags')}
              >
                Tags
              </button>
            </div>
          )}

          {/* Export Buttons */}
          <ExportButton uploads={filteredUploads} />

          {/* View Controls: ViewToggle */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px', 
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <ViewToggle mode={viewMode} onToggle={handleViewToggle} />
          </div>

          {/* Results View (Grid or List) */}
          <>
            {/* Batch Actions Bar */}
            <BatchActions
              uploads={sortedUploads}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectNone={handleSelectNone}
              onBulkDelete={handleBulkDelete}
              onBulkExport={handleBulkExport}
              activeTab={activeTab}
            />

            {/* Results Grid or Table */}
            {viewMode === 'grid' ? (
              <ResultsGrid
                uploads={sortedUploads}
                onSelectUpload={handleSelectUpload}
                onRemoveUpload={handleRemoveUpload}
                selectedUploadId={selectedUploadId}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                multiSelectMode={true}
              />
            ) : (
              <ResultsTable
                uploads={sortedUploads}
                onSelectUpload={handleSelectUpload}
                onRemoveUpload={handleRemoveUpload}
                selectedUploadId={selectedUploadId}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                multiSelectMode={true}
                sortConfig={sortConfig}
                onSort={handleSort}
              />
            )}
          </>


        </div>
      )}

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={errorDialog !== null}
        title={errorDialog?.title || ''}
        message={errorDialog?.message || ''}
        onClose={() => setErrorDialog(null)}
      />

      {/* Split Pane Preview - Only show for selected upload */}
      {selectedUploadId && (() => {
        const selectedUpload = uploads.find(u => u.id === selectedUploadId);
        if (!selectedUpload) return null;
        
        // Determine if this is a creative or tag upload
        const isTagUpload = selectedUpload.type === 'tag';
        
        return (
          <div 
            ref={containerRef}
            className="split" 
            style={{ 
              marginTop: 16,
              minHeight: 480,
              border: '2px solid var(--primary)',
              borderRadius: 8,
            }}
          >
            {/* Left: Findings/Checks List (only for creatives) */}
            {!isTagUpload && (
              <div
                className="left"
                style={{
                  width: `${Math.round(split * 1000) / 10}%`,
                  minWidth: 280,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <FindingsList
                  findings={selectedUpload.findings}
                  creativeName={selectedUpload.bundle.name}
                  onClose={() => setSelectedUploadId(null)}
                />
              </div>
            )}

            {/* Divider (only for creatives) */}
            {!isTagUpload && (
              <div
                role="separator"
                aria-orientation="vertical"
                title="Drag to resize"
                className="separator"
                onMouseDown={(e) => {
                  dragging.current = true;
                  document.body.style.cursor = 'col-resize';
                  e.preventDefault();
                }}
              >
                <i />
              </div>
            )}

            {/* Right: Preview Panel or Tag Panel */}
            <div
              className="right"
              style={{
                width: isTagUpload ? '100%' : `${Math.round((1 - split) * 1000) / 10}%`,
                minWidth: isTagUpload ? '100%' : 320,
                overflow: 'hidden',
              }}
            >
              {isTagUpload ? (
                <TagPanel
                  files={selectedUpload.tagFiles || []}
                  tagType={selectedUpload.tagType || 'unknown'}
                  tagName={selectedUpload.bundle.name}
                />
              ) : (
                <PreviewPanel
                  bundle={selectedUpload.bundle}
                  bundleResult={selectedUpload.bundleResult}
                  findings={selectedUpload.findings}
                  creativeName={selectedUpload.bundle.name}
                />
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Theme Switch Component
const ThemeSwitch: React.FC<{ dark: boolean; onToggle: () => void }> = ({
  dark,
  onToggle,
}) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light Mode' : 'Dark Mode'}
      className={`switch ${dark ? 'on' : ''}`}
      onClick={onToggle}
    >
      <span className="knob" />
    </button>
  );
};



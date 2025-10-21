# V2  V3 Feature Porting Plan

## Executive Summary

V3 has superior architecture (cleaner state management, Web Workers, modular checks) but is missing critical features from V2. This plan prioritizes porting high-value features while maintaining V3's architectural improvements.

## Architecture Comparison

### V2 Architecture
- **State**: Zustand store (useStoreExt.ts)
- **Preview**: Inline runtime probe script (runtimeProbe.ts)
- **Animation Tracking**: Comprehensive GSAP/Anime.js detection
- **Processing**: Synchronous in main thread
- **Export**: CM360 JSON, Excel, CSV

### V3 Architecture  
- **State**: React state in App.tsx (simpler, but lacks preview diagnostics tracking)
- **Preview**: Cleaner hook-based system (usePreviewManager, useIframeMessaging, useBlobUrls)
- **Workers**: Parallel file processing with Web Workers
- **Export**: Excel, HTML, PDF (missing CM360 JSON)
- **Modularity**: Better separation of concerns

## Priority 1: Animation & Diagnostics (CRITICAL)

### 1.1 Runtime Animation Tracking
**V2 Location**: pp-V2/src/logic/runtimeProbe.ts (lines 240-370)
**V3 Target**: pp-V3/src/ui/preview/utils/buildPreviewHtml.ts

**Features to Port**:
- GSAP timeline duration tracking (wraps gsap.timeline, .to, .from, .fromTo)
- Anime.js animation detection (hooks anime() calls, converts ms to seconds)
- CSS animation parsing (duration, iteration count, infinite detection)
- JavaScript animation timeout extension (2s  5s  10s  30s scans)
- Merge JS + CSS animation durations for accurate max duration

**Implementation**: Inject enhanced probe script into preview HTML

### 1.2 Preview Diagnostics Panel
**V2 Location**: pp-V2/src/state/useStoreExt.ts (PreviewDiagnostics interface)
**V3 Target**: New pp-V3/src/ui/preview/components/DiagnosticsPanel.tsx

**Diagnostics to Track**:
- Network failures (failed resource loads)
- Missing assets (broken references)
- Enabler status (CDN vs shim vs unknown)
- Visibility guards (active/inactive detection)
- Memory usage (min/max/current MB)
- CPU score (long task accumulation)
- Console errors/warnings count
- Animation metrics (duration, loops, infinite flag)

**State Management**: Extend Preview types to include diagnostics

### 1.3 Real-Time Animation Updates
**V2 Location**: pp-V2/src/preview/ExtendedPreview.tsx (animation tracking UI)
**V3 Target**: pp-V3/src/components/preview/PreviewPanel.tsx

**Features**:
- Live animation duration display
- Loop count indicator
- Infinite loop warning badge
- Timeline visualization (optional Phase 2)

## Priority 2: Static & Video Asset Support

### 2.1 Static Asset Detection
**V2 Location**: pp-V2/src/logic/staticDetector.ts
**V3 Target**: pp-V3/src/logic/creatives/static/ (new directory)

**Features**:
- Image format validation (JPG, PNG, GIF, WebP, SVG)
- Video format validation (MP4, WebM, MOV)
- Audio format validation (MP3, WAV, M4A)
- Dimension extraction from image headers
- Duration extraction from video headers
- IAB size matching (300x250, 728x90, 160x600, etc.)

### 2.2 Static Asset Checks
**V3 Target**: pp-V3/src/logic/creatives/static/checks/

**Checks to Implement**:
- File size limits (200KB for images, 2.2MB for video first-load)
- Format compliance
- Dimension accuracy
- Metadata validation (no PII, proper encoding)

### 2.3 Video Player Preview
**V2 Location**: pp-V2/src/preview/VideoPreview.tsx
**V3 Target**: pp-V3/src/components/preview/VideoPreview.tsx

**Features**:
- Built-in video player with controls
- Duration display
- Frame seeking
- Mute/unmute toggle
- Playback speed control

## Priority 3: CM360 JSON Export

### 3.1 CM360 JSON Format
**V2 Location**: pp-V2/src/export/cm360Export.ts
**V3 Target**: pp-V3/src/utils/cm360Export.ts

**Export Fields**:
`json
{
  "name": "Creative Name",
  "size": "300x250",
  "htmlFile": "index.html",
  "backupImage": "backup.jpg",
  "clickTag": "http://www.example.com",
  "customExitEvents": [],
  "thirdPartyUrls": [],
  "counterEvents": []
}
`

**Implementation**:
- Parse creative metadata from ZIP
- Extract clickTag from HTML/JS
- Detect backup images
- Generate third-party tracking URL list
- Export as downloadable JSON

### 3.2 Export UI Integration
**V3 Target**: Extend pp-V3/src/components/ExportButton.tsx

**Add Dropdown**:
- Excel (existing)
- HTML Report (existing)
- PDF Report (existing)
- **CM360 JSON** (new)
- CSV (move from bulk export)

## Priority 4: ClickTag Testing

### 4.1 ClickTag Detector
**V2 Location**: pp-V2/src/logic/clickTagDetector.ts
**V3 Target**: pp-V3/src/logic/creatives/html5/validation/clickTag.ts

**Detection Methods**:
- window.clickTag / window.clickTAG (global variables)
- Enabler.exit() calls
- Anchor tag hrefs
- window.open() calls
- Event listener click handlers

### 4.2 ClickTag Test Modal
**V2 Location**: pp-V2/src/preview/ClickTagTestModal.tsx
**V3 Target**: pp-V3/src/components/preview/ClickTagTestModal.tsx

**Features**:
- Input field for test URL
- "Test Click" button to simulate click
- Display detected exit URL
- Show click-through method (anchor, Enabler.exit, window.open)
- Warning if no clickTag detected

## Priority 5: Tag & VAST Testing (V2 already has, V3 needs)

### 5.1 Tag Tester Module
**V2 Location**: pp-V2/src/pages/TagTester.tsx (1200+ lines)
**V3 Target**: pp-V3/src/logic/tags/ (already exists, enhance)

**Features**:
- Bulk tag parsing (paste text, Excel upload)
- Tag validation (format, required fields)
- Vendor classification (DV360, CM360, Flashtalking, Sizmek, etc.)
- Batch export results

### 5.2 VAST Tester Module  
**V2 Location**: pp-V2/src/pages/VastTester.tsx (800+ lines)
**V3 Target**: pp-V3/src/logic/tags/vast/ (already exists, enhance)

**Features**:
- VAST XML parsing (URL or paste)
- VAST validation (schema, required elements)
- Wrapper chain resolution
- Video file download & inspection
- Duration extraction
- Tracking event inventory

## Priority 6: Enhanced Preview Features

### 6.1 Download Original ZIP
**V2 Location**: pp-V2/src/preview/ExtendedResults.tsx (download button)
**V3 Target**: Add to pp-V3/src/components/preview/PreviewPanel.tsx

**Implementation**:
- Store original ZIP bytes in Upload state
- Trigger browser download with original filename
- Show file size in UI

### 6.2 Share Link Generation
**V2 Location**: pp-V2/src/preview/ShareLinkModal.tsx
**V3 Target**: pp-V3/src/components/preview/ShareLinkModal.tsx

**Features**:
- Compress bundle with lz-string
- Encode in URL hash
- Generate shareable link
- Copy to clipboard button
- QR code generation (optional)

### 6.3 Screenshot Capture
**V3 Target**: pp-V3/src/components/preview/ScreenshotButton.tsx

**Features**:
- Capture preview iframe as PNG
- Download as image file
- Optional: Copy to clipboard
- Optional: Timestamp overlay

## Implementation Phases

### Phase 1: Animation Tracking (Week 1)
- [ ] Port enhanced probe script with GSAP/Anime.js hooks
- [ ] Extend preview hooks to capture diagnostics
- [ ] Create DiagnosticsPanel component
- [ ] Add real-time animation metrics display
- **Estimated**: 2-3 days

### Phase 2: Static Assets (Week 1-2)
- [ ] Implement static asset detector
- [ ] Add image/video format validation
- [ ] Create VideoPreview component
- [ ] Add dimension/duration extraction
- **Estimated**: 2-3 days

### Phase 3: CM360 Export (Week 2)
- [ ] Implement CM360 JSON exporter
- [ ] Add to ExportButton dropdown
- [ ] Test with real creatives
- **Estimated**: 1-2 days

### Phase 4: ClickTag Testing (Week 2)
- [ ] Enhance clickTag detection
- [ ] Create ClickTagTestModal
- [ ] Integrate with preview panel
- **Estimated**: 1 day

### Phase 5: Enhanced Preview (Week 3)
- [ ] Add download original ZIP button
- [ ] Implement share link generation
- [ ] Add screenshot capture
- **Estimated**: 1-2 days

### Phase 6: Tag/VAST Enhancement (Week 3)
- [ ] Review existing V3 tag logic
- [ ] Port missing V2 features
- [ ] Add bulk operations
- **Estimated**: 2-3 days

## Architecture Decisions

### State Management
**Decision**: Keep React state in App.tsx for simplicity, but add diagnostics tracking
**Rationale**: V3's approach is cleaner than V2's Zustand store for this use case

### Worker Processing
**Decision**: Maintain V3's Web Worker architecture
**Rationale**: Superior performance, don't regress

### Preview System
**Decision**: Extend V3's hook-based preview system with V2's probe capabilities
**Rationale**: Best of both worlds - clean architecture + comprehensive tracking

### Export Formats
**Decision**: Keep V3's exporters, add CM360 JSON
**Rationale**: V3's export system is already good, just missing one format

## Testing Strategy

### Unit Tests
- Animation detection logic
- Static asset validation
- CM360 export format
- ClickTag detection

### Integration Tests
- Preview diagnostics flow
- Worker processing with new asset types
- Export button with all formats

### Manual Testing
- Test with Teresa creatives (complex GSAP animations)
- Test with static JPG/PNG files
- Test with video MP4 files
- Test CM360 export with real campaigns

## Success Metrics

1. **Animation Tracking Accuracy**: 95%+ detection rate for GSAP/Anime.js animations
2. **Static Asset Support**: 100% of image/video formats validated
3. **CM360 Export**: Valid JSON for 100% of test creatives
4. **Build Time**: No regression (maintain <2s for average creative)
5. **User Workflow**: Preview diagnostics visible within 500ms of load

## Next Steps

1. Start with Phase 1 (Animation Tracking) - highest impact
2. Test with real creatives from SampleZips/Teresa/
3. Iterate based on findings
4. Move to Phase 2 once animation tracking is solid
5. Continue through phases sequentially

---

**Document Version**: 1.0
**Last Updated**: 2025-10-20 20:38:35
**Status**: Ready for implementation

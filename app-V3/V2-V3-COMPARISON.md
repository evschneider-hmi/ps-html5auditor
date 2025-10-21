# V2 vs V3 Feature Comparison & Action Plan

## Executive Summary
Both apps have been launched and tested side-by-side. V2 is more mature with extensive features, while V3 has better architecture but is missing several critical features.

## Features in V2 Missing from V3 (MUST ADD TO V3)

### 1. **Static/Video/Audio Testing**
- **V2**: Has dedicated tabs for Static CM360, Video, and separate upload modes
- **V3**: Only supports HTML5 creatives
- **Action**: Add static image, video file upload support with appropriate validators

### 2. **Tag Testing (Ad Tags & VAST)**
- **V2**: Full TagTester and VastTester modules with bulk sheet upload
- **V3**: Missing entirely
- **Action**: Port TagTester and VastTester components to V3

### 3. **Bulk Upload from Sheets**
- **V2**: Can upload Excel/CSV sheets with bulk VAST/Tag URLs
- **V3**: Missing
- **Action**: Implement sheet parsing for bulk operations

### 4. **Export Formats**
- **V2**: Excel (All/Fail+Warn), Printable HTML, Share Links, CM360 JSON Report
- **V3**: Has PDF, HTML, Excel but missing CM360 JSON format
- **Action**: Add CM360 JSON export format to V3

### 5. **Preview Features - Animation Tracking**
- **V2**: Advanced animation tracking with GSAP/Anime.js detection, realtime updates via postMessage
- **V3**: Basic preview, missing animation tracking integration
- **Action**: Port animation tracking system from V2's ExtendedPreview

### 6. **Preview Features - Debug Insights Panel**
- **V2**: Shows diagnostics panel with:
  - Network failures
  - Missing assets
  - Enabler source
  - Visibility guard status
  - Animation duration tracking
  - CPU tracking
- **V3**: Missing comprehensive diagnostics
- **Action**: Add diagnostics panel to V3 PreviewPanel

### 7. **ClickTag Testing**
- **V2**: Interactive clickTag testing with modal showing click-through behavior
- **V3**: Missing
- **Action**: Add clickTag testing UI to V3 preview

### 8. **Download Original ZIP**
- **V2**: Can download the original uploaded ZIP file
- **V3**: Missing
- **Action**: Add download original functionality

### 9. **Share Link via Compressed Data**
- **V2**: Uses lz-string to create shareable URLs with compressed audit data
- **V3**: Missing
- **Action**: Add share link generation

### 10. **Multi-Tab System**
- **V2**: Tabs for HTML5 Zip, Ad Tag, VAST, Video, Static
- **V3**: Single upload type at a time
- **Action**: Implement tab system for different asset types

## Features V3 Has That V2 Doesn't (KEEP IN V3)

### 1. **Better Architecture**
- V3 has cleaner separation of concerns with logic/creatives directory
- Better TypeScript types and interfaces
- More modular check system

### 2. **Upload Queue Management**
- V3 has useUploadQueue hook for progressive file processing
- Better UX for multiple uploads

### 3. **Keyboard Shortcuts**
- V3 has comprehensive keyboard shortcut system
- Help modal for shortcuts

### 4. **Grid vs List View Toggle**
- V3 supports both grid and list view for results
- V2 only has list view

### 5. **Multi-Select with Batch Actions**
- V3 has checkbox multi-select
- Batch export, delete operations

### 6. **Better Sorting & Filtering**
- V3 has sortable columns
- Filter controls for status/severity

### 7. **Session Storage & Recovery**
- V3 has session persistence
- Can recover work after page reload

### 8. **Creative Metadata Detection**
- V3 auto-detects creative metadata from filenames
- Extracts client, campaign, placement info

### 9. **Resizable Split Panes**
- V3 has better split pane with auto-sizing based on creative dimensions
- Persists split ratio

### 10. **Profile-Based Validation**
- V3 has cleaner profile system (CM360, IAB, etc.)
- Better organized check groups

## Implementation Priority

### High Priority (Critical for V3)
1. Animation tracking & diagnostics panel
2. Static/Video asset support
3. CM360 JSON export format
4. ClickTag testing modal
5. Download original ZIP

### Medium Priority (Important UX)
6. Tag & VAST testing modules
7. Share link generation
8. Bulk sheet upload
9. Multi-tab interface
10. Debug insights integration

### Low Priority (Nice to Have)
- Print-optimized HTML export (V3 has PDF which is better)
- Legacy compatibility features
- V2-specific workarounds

## Next Steps
1.  Launch both apps side-by-side
2.  Document feature differences
3.  Port animation tracking to V3
4.  Add diagnostics panel to V3
5.  Implement static/video support in V3
6.  Port Tag/VAST testers to V3
7.  Add missing export formats
8.  Add clickTag testing UI
9.  Add share link generation
10.  Final testing & validation


# VAST-Specific Tag Logic

**Status:** 🔮 **Future Implementation**  
**Purpose:** VAST XML parsing and analysis (beyond basic URL handling)

---

## Planned Functions

### VAST XML Parsing
- **parseVastXml.ts** - Full VAST XML parser
  - Parse VAST 2.0/3.0/4.0 schema
  - Extract all tracking events
  - Parse companion ads
  - Handle wrapper tags

### Media Extraction
- **extractMedia.ts** - Media URL extraction
  - Extract MediaFile URLs
  - Parse progressive vs streaming
  - Detect video/audio codecs
  - Extract duration

### Tracker Extraction
- **extractTrackers.ts** - Tracking URL extraction
  - Extract Impression trackers
  - Parse Click trackers (ClickThrough/ClickTracking)
  - Extract Event trackers (start, midpoint, complete, etc.)
  - Parse Error trackers

### VAST Validation
- **validateVast.ts** - VAST schema validation
  - Validate XML structure
  - Check required elements
  - Verify VAST version
  - Detect schema violations

### Wrapper Following
- **followWrapper.ts** - VAST wrapper chain following
  - Detect wrapper tags
  - Fetch nested VAST
  - Aggregate tracking events
  - Detect redirect loops

---

## Example Usage

```typescript
import { parseVastXml } from './logic/tags/vast';

const vastXml = '<VAST version="3.0">...</VAST>';
const result = await parseVastXml(vastXml);
// => {
//   version: '3.0',
//   mediaUrl: 'https://cdn.example.com/video.mp4',
//   duration: 30,
//   impressionTrackers: ['https://...', 'https://...'],
//   clickTrackers: ['https://...'],
//   wrapperUrl: null,
//   errors: []
// }
```

---

## Implementation Notes

**When to implement:** When adding full VAST analysis features

**Dependencies:**
- DOMParser (browser native)
- XML validation library
- HTTP fetch for wrapper following

**Estimated effort:** 4-6 hours for complete implementation

---

**Current Status:**
- ✅ VAST URL detection (in common/parseBulk.ts)
- ✅ VAST vendor classification (in common/classifyVendor.ts)
- 🔮 VAST XML parsing (future - this module)

---

**See also:**
- [FUTURE_TAG_TYPES_ARCHITECTURE.md](../../../../docs/FUTURE_TAG_TYPES_ARCHITECTURE.md)
- [VAST_MODULE_EXTRACTION.md](../../../../docs/VAST_MODULE_EXTRACTION.md)
- IAB VAST specification

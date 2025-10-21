# 1x1 Pixel Tag Parser

**Status:** 🔮 **Future Implementation**  
**Purpose:** Parse and analyze 1x1 tracking pixel tags

---

## Planned Functions

### Pixel Parsing
- **parsePixel.ts** - Main pixel tag parser
  - Extract image source URL
  - Detect pixel dimensions
  - Parse tag attributes
  - Identify tracking type

### Pixel Validation
- **validatePixel.ts** - Pixel tag validation
  - Verify 1x1 dimensions
  - Check protocol (HTTP/HTTPS)
  - Validate URL structure
  - Detect invalid pixels

### Parameter Extraction
- **extractParams.ts** - Query parameter extraction
  - Parse tracking parameters
  - Identify user ID/session data
  - Extract campaign information
  - Detect privacy concerns

---

## Example Usage

```typescript
import { parsePixel } from './logic/tags/pixel';

const tag = '<img src="https://track.example.com/pixel.gif?id=123" width="1" height="1" />';
const result = parsePixel(tag);
// => {
//   src: 'https://track.example.com/pixel.gif?id=123',
//   dimensions: { width: 1, height: 1 },
//   is1x1: true,
//   protocol: 'https',
//   vendor: 'track.example.com',
//   params: { id: '123' }
// }
```

---

## Implementation Notes

**When to implement:** When adding pixel tag support

**Dependencies:**
- HTML parser (for tag extraction)
- URL parameter parser (from common/utils.ts)
- Vendor classification (from common/classifyVendor.ts)

**Estimated effort:** 2-3 hours for initial implementation

---

**See also:**
- [FUTURE_TAG_TYPES_ARCHITECTURE.md](../../../../docs/FUTURE_TAG_TYPES_ARCHITECTURE.md)

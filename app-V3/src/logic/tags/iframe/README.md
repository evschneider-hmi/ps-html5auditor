# Iframe Tag Parser

**Status:** 🔮 **Future Implementation**  
**Purpose:** Parse and analyze iframe ad tags

---

## Planned Functions

### Iframe Parsing
- **parseIframe.ts** - Main iframe tag parser
  - Extract iframe source URL
  - Parse iframe attributes
  - Detect dimensions
  - Extract sandbox settings

### Source Extraction
- **extractSrc.ts** - Iframe source URL extraction
  - Extract src attribute
  - Parse srcdoc content
  - Detect data URLs
  - Identify dynamic sources

### Iframe Validation
- **validateIframe.ts** - Iframe tag validation
  - Validate sandbox attributes
  - Check security settings
  - Verify allowfullscreen
  - Detect unsafe practices

---

## Example Usage

```typescript
import { parseIframe } from './logic/tags/iframe';

const tag = '<iframe src="https://ads.example.com/creative" width="300" height="250" sandbox="allow-scripts"></iframe>';
const result = parseIframe(tag);
// => {
//   src: 'https://ads.example.com/creative',
//   sandbox: ['allow-scripts'],
//   allowFullscreen: false,
//   dimensions: { width: 300, height: 250 },
//   vendor: 'example.com'
// }
```

---

## Implementation Notes

**When to implement:** When adding iframe tag support

**Dependencies:**
- HTML parser (for tag extraction)
- Iframe security validation rules
- Vendor classification (from common/classifyVendor.ts)

**Estimated effort:** 2-3 hours for initial implementation

---

**See also:**
- [FUTURE_TAG_TYPES_ARCHITECTURE.md](../../../../docs/FUTURE_TAG_TYPES_ARCHITECTURE.md)

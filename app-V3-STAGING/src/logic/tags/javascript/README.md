# JavaScript Tag Parser

**Status:** 🔮 **Future Implementation**  
**Purpose:** Parse and analyze JavaScript ad tags

---

## Planned Functions

### Tag Parsing
- **parseJsTag.ts** - Main JavaScript tag parser
  - Extract script source URL
  - Detect async/defer attributes
  - Parse script type
  - Extract inline code

### Code Analysis
- **validateSyntax.ts** - JavaScript syntax validation
  - Detect syntax errors
  - Validate JS version compatibility
  - Check for common issues

### Library Detection
- **detectLibraries.ts** - Detect JavaScript libraries
  - jQuery, GSAP, CreateJS, etc.
  - Library version detection
  - Compatibility checks

### URL Extraction
- **extractUrls.ts** - Extract URLs from JavaScript
  - Parse dynamic URL construction
  - Extract tracking URLs
  - Detect external dependencies

---

## Example Usage

```typescript
import { parseJsTag } from './logic/tags/javascript';

const tag = '<script src="https://ads.example.com/tag.js" async></script>';
const result = parseJsTag(tag);
// => {
//   src: 'https://ads.example.com/tag.js',
//   async: true,
//   defer: false,
//   type: 'text/javascript',
//   libraries: ['CM360'],
//   vendor: 'example.com'
// }
```

---

## Implementation Notes

**When to implement:** When adding JavaScript tag support

**Dependencies:**
- JavaScript parser (e.g., @babel/parser, acorn)
- Library detection patterns
- Syntax validation tools

**Estimated effort:** 3-4 hours for initial implementation

---

**See also:**
- [FUTURE_TAG_TYPES_ARCHITECTURE.md](../../../../docs/FUTURE_TAG_TYPES_ARCHITECTURE.md)

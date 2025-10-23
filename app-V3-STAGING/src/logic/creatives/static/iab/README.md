# Static Image Checks - IAB

**Status:** 🔮 **Future Implementation**  
**Purpose:** IAB-specific validation checks for static image creatives

---

## Planned Checks

### Accessibility
- **imageAccessibility.ts** - WCAG image compliance
- **imageAltText.ts** - Alt text requirements (if embedded in HTML)
- **imageContrast.ts** - Color contrast validation

### Standards Compliance
- **imageStandards.ts** - IAB display ad standards
- **imageViewability.ts** - Viewability requirements
- **imageSafeFrame.ts** - SafeFrame compatibility

### Quality
- **imageClarity.ts** - Image clarity/sharpness validation
- **imageRendering.ts** - Rendering quality checks

---

## Implementation Notes

**When to implement:** When adding static creative support to V3

**Dependencies:**
- IAB display ad standards documentation
- Accessibility testing tools
- Image quality analysis libraries

**Estimated effort:** 2-3 hours for initial implementation

---

**See also:**
- [FUTURE_CREATIVE_TYPES_ARCHITECTURE.md](../../../../../docs/FUTURE_CREATIVE_TYPES_ARCHITECTURE.md)
- IAB display ad guidelines

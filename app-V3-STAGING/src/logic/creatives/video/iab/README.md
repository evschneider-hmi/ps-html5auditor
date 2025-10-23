# Video Creative Checks - IAB

**Status:** 🔮 **Future Implementation**  
**Purpose:** IAB-specific validation checks for video creatives

---

## Planned Checks

### Accessibility
- **videoAccessibility.ts** - WCAG compliance for video
- **videoCaptions.ts** - Caption/subtitle requirements
- **videoTranscript.ts** - Transcript availability

### Quality & Performance
- **videoQuality.ts** - Quality metrics validation
- **videoLoadTime.ts** - Load time requirements
- **videoBuffering.ts** - Buffering behavior checks

### Standards Compliance
- **videoStandards.ts** - IAB video ad standards
- **videoVPAID.ts** - VPAID compliance (if applicable)
- **videoVAST.ts** - VAST companion validation

---

## Implementation Notes

**When to implement:** When adding video creative support to V3

**Dependencies:**
- IAB video ad standards documentation
- VAST/VPAID compliance tools
- Video accessibility testing tools

**Estimated effort:** 3-4 hours for initial implementation

---

**See also:**
- [FUTURE_CREATIVE_TYPES_ARCHITECTURE.md](../../../../../docs/FUTURE_CREATIVE_TYPES_ARCHITECTURE.md)
- IAB video ad guidelines

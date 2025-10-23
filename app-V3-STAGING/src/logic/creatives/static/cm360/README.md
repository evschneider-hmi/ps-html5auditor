# Static Image Checks - CM360

**Status:** 🔮 **Future Implementation**  
**Purpose:** CM360-specific validation checks for static image creatives

---

## Planned Checks

### Image Format
- **imageFormat.ts** - JPG/PNG/GIF/WebP validation
- **imageMode.ts** - RGB/CMYK mode validation
- **imageColorSpace.ts** - Color space validation

### Image Specifications
- **imageDimensions.ts** - Pixel dimension requirements
- **imageSize.ts** - File size limits
- **imageResolution.ts** - DPI/PPI requirements
- **imageAspectRatio.ts** - Aspect ratio validation

### Image Quality
- **imageOptimization.ts** - Compression and optimization
- **imageQuality.ts** - Quality score validation
- **imageProgressive.ts** - Progressive JPEG checks

### Image Content
- **imageSafeArea.ts** - Safe area validation (for clickable regions)
- **imageTransparency.ts** - Alpha channel validation
- **imageAnimation.ts** - Animated GIF validation

---

## Implementation Notes

**When to implement:** When adding static creative support to V3

**Dependencies:**
- Image processing library (e.g., sharp, jimp)
- CM360 static creative specifications
- Image optimization tools

**Estimated effort:** 3-4 hours for initial implementation

---

**See also:**
- [FUTURE_CREATIVE_TYPES_ARCHITECTURE.md](../../../../../docs/FUTURE_CREATIVE_TYPES_ARCHITECTURE.md)
- CM360 static creative specifications

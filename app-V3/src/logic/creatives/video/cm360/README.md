# Video Creative Checks - CM360

**Status:** 🔮 **Future Implementation**  
**Purpose:** CM360-specific validation checks for video creatives

---

## Planned Checks

### Video Format & Codec
- **videoFormat.ts** - MP4/WebM format validation
- **videoCodec.ts** - H.264/VP9 codec requirements
- **audioCod.ts** - AAC/Opus audio codec validation

### Video Specifications
- **videoDuration.ts** - Duration limits (typically 15s, 30s, 60s)
- **videoResolution.ts** - Resolution requirements (e.g., 1920x1080)
- **videoBitrate.ts** - Bitrate limits for delivery
- **videoFrameRate.ts** - Frame rate validation (24/30/60 fps)

### Video Metadata
- **videoMetadata.ts** - Required metadata fields
- **videoCompression.ts** - Compression quality checks
- **videoAspectRatio.ts** - Aspect ratio validation (16:9, 9:16, etc.)

---

## Implementation Notes

**When to implement:** When adding video creative support to V3

**Dependencies:**
- Video player component
- Media metadata extraction library (e.g., ffprobe, mediainfo)
- CM360 video specifications

**Estimated effort:** 4-6 hours for initial implementation

---

**See also:**
- [FUTURE_CREATIVE_TYPES_ARCHITECTURE.md](../../../../../docs/FUTURE_CREATIVE_TYPES_ARCHITECTURE.md)
- CM360 video creative specifications

# CM360/Google H5 Validator - Banned File Types

## Overview
Google's H5 Validator explicitly bans file types that are not approved for CM360 HTML5 creatives. The V3 tool now tracks 30+ banned file extensions across multiple categories.

## Google's Approved Extensions
Per Google H5 Validator error message:
> "Supported file types are HTML, HTM, JS, CSS, JPG, JPEG, GIF, PNG, JSON, XML, and SVG."

Plus fonts: EOT, OTF, TTF, WOFF, WOFF2

**Total Allowed:** 17 extensions

## Banned File Types (30+ tracked)

### 1. OS Artifacts (Always Fail)
These files are automatically created by operating systems and must be removed:

| Extension | Description | Common Files |
|-----------|-------------|--------------|
| .db | Database files | Thumbs.db (Windows) |
| .ds_store | macOS metadata | .DS_Store (macOS) |
| .ini | Windows config | desktop.ini, folder.ini |
| __MACOSX/* | macOS metadata folder | All files in __MACOSX/ |
| ._* | macOS resource fork | ._filename (macOS) |

**Evidence:** Playwright testing confirmed Thumbs.db causes FILE_TYPE_INVALID error in Google validator.

### 2. Archives (Must Extract First)
Archive files must be extracted before upload:

| Extension | Description |
|-----------|-------------|
| .zip | ZIP archive |
| .rar | RAR archive |
| .7z | 7-Zip archive |
| .tar | Tar archive |
| .gz | Gzip archive |

**Why:** CM360 expects creative files directly, not nested archives.

### 3. Executables (Security Risk)
Executable files are banned for security:

| Extension | Description |
|-----------|-------------|
| .exe | Windows executable |
| .dll | Windows library |
| .bat | Batch script |
| .sh | Shell script |
| .app | macOS application |

**Why:** Ad creatives cannot execute arbitrary code.

### 4. Documents (Not Display Assets)
Document files are not creative assets:

| Extension | Description |
|-----------|-------------|
| .pdf | PDF document |
| .doc / .docx | Word document |
| .xls / .xlsx | Excel spreadsheet |
| .ppt / .pptx | PowerPoint presentation |

**Why:** These are reference materials, not web assets.

### 5. Source Files (Not Production Assets)
Design source files must be converted to web formats:

| Extension | Description |
|-----------|-------------|
| .psd | Photoshop source |
| .ai | Illustrator source |
| .sketch | Sketch source |
| .fig | Figma source |
| .fla | Flash source |

**Why:** Must export to JPG/PNG/SVG for web use.

### 6. Media Files (Use Streaming)
Large media files should use streaming services:

| Extension | Description |
|-----------|-------------|
| .swf | Flash file (deprecated) |
| .mp4 | Video file |
| .mov | Video file |
| .avi | Video file |
| .mp3 | Audio file |
| .wav | Audio file |

**Why:** Exceeds CM360 file size limits, use video platforms instead.

## Detection Logic

### V3 Tool Implementation
`	ypescript
// 1. Check for macOS metadata files first
if (isMacOSMetadata(filePath)) {
  // __MACOSX or ._* files
}

// 2. Check if extension is explicitly banned
if (BANNED_FILE_TYPES.has(ext)) {
  // Show specific ban reason
}

// 3. Check if extension is allowed
if (!ALLOWED_EXTENSIONS.has(ext)) {
  // Generic unsupported extension
}
`

### Error Messages
Each banned file type shows a specific reason:
- Thumbs.db  "OS artifact (Thumbs.db, .DS_Store) - explicitly banned"
- 	est.psd  "Photoshop source file - explicitly banned"
- rchive.zip  "Archive file (extract contents) - explicitly banned"
- ideo.mp4  "Video file (use streaming service) - explicitly banned"

## Testing Evidence

### Playwright MCP Test Results
**Test Creative:** test-multiple-banned-types.zip
- **Files:** index.html, Thumbs.db, .DS_Store, test.psd, archive.zip, video.mp4
- **Result:**  Detected all 5 banned files
- **Summary:** "Banned types found: .zip, .psd, .db, .mp4"

**Screenshots:**
- anned-file-types-detection.png - Overview showing 5 banned files
- anned-file-types-details.png - Expanded list with specific reasons

### Google H5 Validator Comparison
**Test 1:** Honda HRV 320x50 (clean)
- **Result:**  PASSED all checks

**Test 2:** Creative with Thumbs.db
- **Result:**  FAILED with "FILE_TYPE_INVALID found in Thumbs.db"
- **Error:** "The creative contains a file type that isn't supported by DCM"

**Conclusion:** V3 tool correctly matches Google's validation behavior.

## Best Practices

### For Designers/Developers
1.  **Export** source files to web formats (PSD  PNG/JPG)
2.  **Extract** ZIP archives before uploading creative
3.  **Remove** OS artifacts (Thumbs.db, .DS_Store)
4.  **Convert** videos to streaming URLs (not embedded files)
5.  **Delete** temporary files before zipping creative

### Cleanup Commands
`ash
# macOS - Remove .DS_Store files
find . -name ".DS_Store" -delete
find . -name "__MACOSX" -type d -exec rm -rf {} +

# Windows - Remove Thumbs.db files
del /s /q /f /a Thumbs.db
`

## References
- Google H5 Validator: https://h5validator.appspot.com/dcm/asset
- V3 Implementation: pp-V3/src/logic/creatives/common/allowedExtensions.ts
- Test Evidence: .playwright-mcp/.playwright-mcp/

---
Last Updated: 2025-10-22
Tool Version: V3 (commit 46af9ca)

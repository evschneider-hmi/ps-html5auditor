# V3 Validation Coverage Summary

## Complete Check List (46 Checks)

### Common Checks (4)
-  Packaging Format (ZIP required)
-  File Count and Upload Size Limits
-  **Allowed File Extensions** (.db files = FAIL per Google H5 Validator)
-  Problematic Filenames (spaces, special chars)

### CM360 Required Checks (8)
-  Primary File and Size
-  Single Entry HTML & References  
-  ClickTag Present and Used
-  Hard Coded Click Tag Check
-  HTTPS Only
-  No Web Storage APIs
-  Iframe Safe (No Cross-Frame DOM)
-  GWD Environment Check

### Validation Checks (3)
-  Orphaned Assets (Not Referenced)
-  Invalid URL References
-  Invalid Markup (HTML/CSS/SVG)

### IAB Compliance Checks (31)
-  Weight Budgets
-  Animation Length Cap
-  Border Present
-  CPU Busy Budget
-  Cookies Dropped
-  Creative Rendered
-  CSS Embedded
-  Dialogs and Modals
-  DOMContentLoaded
-  Hosted File Count
-  Hosted File Size
-  Initial Host Requests
-  HTML5 Library
-  Iframe Count
-  Images Optimized
-  Index File Check
-  jQuery Usage
-  Local Storage
-  Measurement Pixels
-  CSS/JS Minified
-  No Backup Image Inside ZIP
-  Avoid document.write()
-  Relative Paths For Packaged Assets
-  Runtime Iframes
-  Syntax Errors
-  Time to Render
-  Timing Metrics
-  Has Video

## Recent Fix: OS Artifacts (.db files)

**Commit:** a0517eb  
**Change:** Reverted .db files from WARN to FAIL

**Rationale:**  
- Google H5 Validator treats Thumbs.db as disallowed extension (hard failure)
- Files like .db, .DS_Store are not just cleanup recommendations
- CM360 will reject creatives containing these files
- Test: Upload 320x50 to https://h5validator.appspot.com/dcm/asset confirms FAIL status

**Git History:**
- c3cfd21: Changed .db to WARN (incorrect)
- a0517eb: Reverted to FAIL (correct per Google validator)

## Validation Alignment

Our tool now matches Google H5 Validator requirements:
- All 46 checks cover CM360, IAB, and validation requirements
- .db files correctly fail validation
- Priority checks determine PASS/FAIL status
- Warnings don't gate creative approval

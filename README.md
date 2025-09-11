# HTML5 Creative Auditor

Created by Horizon Media's Platform Solutions Team

Live Tool: https://evan-schneider.github.io/html5-audit-tool/

Client‑side auditing of HTML5 display creative ZIP bundles (no files uploaded to a server). Provides quick compliance and quality checks aligned with common Campaign Manager 360 (CM360) and IAB HTML5 guidance.

## How To Use
1. Open the live URL above in a modern desktop browser (Chrome, Edge, Firefox, Safari).
2. Drag & drop one or more creative ZIP files (each should contain a single HTML entry and its assets).
3. Review the summary table (status, dimensions, total weight, issue counts).
4. Click a bundle to inspect detailed findings (Fail / Warn / Pass) and open the preview.
5. Use the Preview pane to verify rendering and capture clickthrough (CTURL Status button).
6. Download Excel reports (All Issues or Failed Issues) for sharing or record‑keeping.

## Key Checks (Abbreviated)
* Packaging / primary HTML detection
* Missing vs orphaned assets
* External / non‑HTTPS resources
* ClickTag & hard‑coded clickthrough URL detection
* Google Web Designer environment identification
* IAB 2025 weight & initial request heuristics
* System artifacts (.DS_Store, Thumbs.db, __MACOSX)

## Output
* On‑screen findings with severity badges
* Sandboxed live creative preview with captured clickthrough URL
* XLSX report (issues + summary sheets)

## Notes
* All processing happens locally in your browser; no network calls are made with creative contents.
* Drop multiple ZIPs to compare bundles side by side.
* For best accuracy ensure the ZIP root contains the primary HTML file (no nested archives).

## Attribution
Created by Horizon Media's Platform Solutions Team

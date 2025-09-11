# HTML5 Creative Auditor

![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)

Created by Horizon Media's Platform Solutions Team

Fully client‑side (no server calls) auditing tool for HTML5 display creatives, focused on Campaign Manager 360 (CM360) and 2025 IAB HTML5 guidance. Drop one or more ZIP bundles and receive structured compliance findings, rich preview, and multi‑sheet Excel reporting.

---
## ✨ Key Capabilities

### Core Processing
* Multi‑ZIP drag & drop ingestion (browser only) using JSZip – no file upload leaves the machine.
* Primary HTML asset discovery heuristic (scores candidate HTML files, selects best).
* `ad.size` meta parsing (dimensions surfaced in summaries and reports).
* Asset graph extraction from HTML, CSS, and JS (img / css / js / font / media / anchor references).
* Heuristic phase classification for IAB metrics (initial vs subsequent vs zipped bytes/requests).

### Implemented Checks (ordered execution)
| ID | Title | Purpose |
|----|-------|---------|
| packaging | Packaging Structure | Nested archive & dangerous extension detection |
| primaryAsset | Primary HTML Asset | Ensures a dependable entry HTML & dimensions |
| assetReferences | Referenced Assets Present | Every referenced in‑bundle asset exists |
| orphanAssets | Orphaned Assets | Flags unreferenced (potential bloat) assets |
| externalResources | External Resource Policy | External hosts/filetypes vs allowlist |
| httpsOnly | HTTPS Only | Blocks insecure (http:) references |
| clickTags | Click Tags / Exit | Detects clickTag variables & hard navigations |
| gwdEnvironment | GWD Environment | Identifies Google Web Designer runtime artifacts |
| iabWeight | IAB Weight | Initial / subsequent / zipped bytes vs 2025 thresholds |
| iabRequests | IAB Initial Requests | Initial network request count heuristic |
| systemArtifacts | System Artifacts | OS cruft (.DS_Store, Thumbs.db, __MACOSX) |
| hardcodedClickUrl | Hard-Coded Clickthrough URL | Absolute click destinations embedded in code |

Each check returns: id, title, severity (PASS / WARN / FAIL), messages, and offender list (`path`, optional `detail`, `line`).

### Preview & Interaction
* Sandboxed iframe preview with dynamic height clamp (800–1400px) and mutation observation.
* Blob URL rewriting – all in‑bundle asset paths remapped without a server.
* Clickthrough capture instrumentation (DOM click interception + `window.open` hook + postMessage channel).
* Manual “CTURL Status” modal (only opens on user click or explicit button).
* Debug log (expandable) for capture events & injection states.

### Reporting
* Multi‑sheet Excel workbook (XLSX):
	* All / Failed Issues (flattened offenders) 
	* Summary (bytes, requests, dimensions, status counts)
	* Reference (check catalog + descriptions)
* Optional JSON export (internal use) – Excel is primary.

### UX / Accessibility
* Contextual “?” help icons (top‑right of each finding card) explaining standards & remediation intent.
* Bundle selector with truncation + tooltip.
* Guard rails: dialogs for invalid operations (no bundles / non‑ZIP selection).
* Persistent status badges & aggregated fail/warn counts per bundle.

### Standards Alignment
* Enforces 2025 IAB HTML5 New Ad Portfolio byte/request targets through `iabWeight` + `iabRequests`.
* Enforces CM360 packaging hygiene (primary HTML, clickTag presence, no hardcoded exits, HTTPS, no system artifacts).

---
## 🧪 Architecture Overview

```
ZIP (Uint8Array) -> zipReader -> ZipBundle
			 |-> discovery (primary HTML + ad.size)
			 |-> parse (references graph)
			 |-> runChecks (ordered modules) -> findings[] & summary
			 |-> preview builder (rewritten HTML + blob URLs + capture script)
```

Key modules:
* `zipReader.ts` – Decompression & file normalization.
* `discovery.ts` – Primary HTML heuristic & dimension extraction.
* `parse.ts` – Lightweight HTML/CSS/JS scanning for referenced assets.
* `checks/*` – Each atomic validation (pure, synchronous functions over bundle/result/settings).
* `preview.ts` – Injects instrumentation & produces iframe HTML + blob map.
* `excelReport.ts` – Workbook generation, reference catalog.
* `profiles.ts` – Default settings & guideline thresholds (2025 IAB values embedded).
* `severity.ts` – Severity type & merge logic.
* `state/useStore` – Zustand global store for bundles, results, selection.

Data contracts live in `types.ts` (BundleResult, Finding, Reference, etc.).

---
## ⚖️ IAB Metrics (2025)
Captured per bundle:
* InitialKB – Primary + directly referenced first‑phase assets.
* SubsequentKB – Remaining in‑bundle bytes.
* ZippedKB – Original archive compressed size.
* InitialRequests / TotalRequests – Heuristic count of initial vs overall referenced assets.

Thresholds (subject to spec validation):
* Initial Load: 150 KB (iabInitialLoadKB)
* Polite/Subsequent: 1000 KB (iabSubsequentLoadKB)
* Max Zipped (advisory): 200 KB (iabMaxZippedKB)

---
## 🛠 Development Workflow

Install & run dev server:
```bash
npm install
npm run dev
```

Run tests (if added):
```bash
npm test
```

Production build:
```bash
npm run build
```

The app is a purely static bundle; deploy by serving the `dist/` directory (any static hosting or local file server).

---
## ➕ Adding a New Check
1. Create `src/logic/checks/<name>.ts` exporting a function: `(bundle: ZipBundle, partial: BundleResult, settings: Settings) => Finding` (omit unused params if not needed).
2. Append invocation inside `checks/index.ts#runChecks` (preserves order relevance outside severity).
3. Provide a stable `id` (kebab or camel), a concise `title`, fill `messages`, `offenders`.
4. Keep runtime synchronous & side‑effect free (deterministic given inputs) for predictable ordering.
5. Update `excelReport.ts` REF_DATA with description (ensures Reference sheet completeness).

Severity conventions:
* FAIL – Violates platform requirement or spec budget.
* WARN – Deviation / potential optimization.
* PASS – No issues or purely informational.

---
## ⚙️ Configuration (`profiles.ts` Settings)
| Field | Purpose |
|-------|---------|
| disallowNestedZips | Fails on embedded archives |
| dangerousExtensions | Blocklisted executable/script extensions |
| externalHostAllowlist | Permit listed external hosts |
| externalFiletypeAllowlist | Permitted external file extensions |
| clickTagPatterns | Regex (string form) patterns for exit detection |
| stripCacheBusters | Normalize URLs when matching references |
| orphanSeverity / missingAssetSeverity | Tunable severities for asset graph outcomes |
| httpSeverity / externalResourceSeverity | Policy severity switches |
| hardcodedNavSeverity | Severity for hard-coded exit/navigation patterns |
| iab* fields | 2025 byte / request thresholds & reference date |

Future UI will surface a settings panel to adjust these dynamically.

---
## 🧩 Preview Internals
Instrumentation injects:
* DOM click listener (captures anchors + `clickTag` globals).
* `window.open` proxy (silent capture, no forced modal).
* Handshake logging (debug banner until script attaches).

Modal opens only on: (a) explicit user click with URL or (b) user presses “CTURL Status”.

---
## 📄 Excel Report Sheets
* All Issues / Failed Issues – Flattened row per offender (or single row if none).
* Summary – Aggregated metrics & dimensions.
* Reference – Descriptions of each implemented check (update when adding new checks).

---
## 🔐 Privacy & Local Execution
No network requests are made for analysis; all data stays in the browser memory. External hosts in creatives are parsed, not fetched.

---
## 🚧 Known Gaps / Planned Enhancements
Short‑term targets:
* Enforce CM360 extras: file count limit (≤100), total ZIP size (≤10 MB), unsupported file type whitelist, percent symbol filename ban.
* Forbidden storage APIs scan (localStorage, sessionStorage, indexedDB, openDatabase).
* Explicit `ad.size` validation (malformed / missing severity separation).
* ClickTag multiplicity summary (count + unusual patterns).
* Optional fallback image detection & advisory.
* Refined polite vs subsequent classification (defer/lazy hints, async imports).
* Settings UI with severity overrides & profile presets.
Accessibility & UX:
* Keyboard focus trapping & ARIA roles for modal and help tooltips.
* High contrast mode / color‑blind safe palette options.

---
## 🧪 Testing
Lightweight unit tests (example: primary asset detection, system artifacts, hardcoded click URL). Expand by placing additional specs in `src/tests/` (Jest / Vitest depending on configured runner).

Recommended future tests:
* Reference graph edge cases (query params, hashes, data URIs, case normalization).
* IAB phase classification accuracy.
* ClickTag detection (multiple patterns, obfuscation resilience).

---
## 🛡 License
MIT (template). Validation logic and interpretations supplied “as‑is” without warranty.

---
## 🙋 Support / Feedback
Open an internal ticket or submit an issue (if repository issue tracking enabled). Provide sample ZIP(s), expected vs actual findings, and environment (browser + version).

---
## ✅ Quick Start
```bash
git clone <repo-url>
cd html5-audit-tool
npm install
npm run dev
# Open http://localhost:5173 and drop one or more creative ZIPs
```

---
## 📦 Tech Stack
| Layer | Choice | Notes |
|-------|--------|-------|
| Build | Vite | Fast dev HMR / production bundling |
| UI | React + TypeScript | Componentized checks & preview flow |
| Styling | Tailwind CSS | Utility‑first, small custom layer |
| State | Zustand | Minimal global store |
| ZIP Parsing | JSZip | Client‑side decompression |
| Reporting | SheetJS (xlsx) | Multi‑sheet export |

---
## 🔄 Versioning
Semantic intent (MAJOR.MINOR.PATCH) once initial spec coverage stabilizes. Current pre‑1.0; breaking changes may occur.

---
## 📋 Checklist When Adding Features
1. Add/modify check in `checks/` & update `runChecks` ordering.
2. Provide REF_DATA entry.
3. Surface any new metrics in Summary table & Excel.
4. Add help tooltip description.
5. Add / update unit tests.
6. Update README section(s) above if scope changes.

---
Copyright (c) 2025 Evan Schneider

Licensed under the MIT License — see the included `LICENSE` file for details.

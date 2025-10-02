# HTML5 Creative Auditor (Extended)

From Horizon Media’s Platform Solutions team

[![Pages](https://img.shields.io/badge/Pages-live-brightgreen?logo=github&style=flat-square)](https://evschneider-hmi.github.io/ps-html5auditor/)

Client‑side auditing of HTML5 display creative ZIP bundles (no files uploaded to a server). Provides quick compliance and quality checks aligned with common Campaign Manager 360 (CM360) and IAB HTML5 guidance.

Note: The application in `app-V2/` is the primary and only active app. Root npm scripts (dev/build/preview) delegate to `app-V2`.

## How To Use
1. Open the built tool locally or via an approved internal hosting location in a modern desktop browser (Chrome, Edge, Firefox, Safari).
2. Drag & drop one or more creative ZIP files (each should contain a single HTML entry and its assets).
3. Review the summary table (status, dimensions, total weight, issue counts).
4. Click a bundle to inspect detailed findings (Fail / Warn / Pass) and open the preview.
5. Use the Preview pane to verify rendering and capture clickthrough (CTURL Status button).
6. Download Excel reports (All Issues or Failed Issues) for sharing or record‑keeping.

### Local development
- From repo root:
	- `npm run dev` to start the dev server for app-V2
	- `npm run build` to build app-V2
	- `npm run preview` to preview the app-V2 build

### Testing & quality checks
- `npm run test:e2e` launches the Playwright suite in headed Chromium against the local dev server. Evidence screenshots and network logs are written to `evidence/` for documentation.
- `npm run build` (above) exercises the TypeScript project references and Vite production build. Run this before committing to ensure the generated bundle is healthy.
- Tests expect port `4173` to be available; stop any conflicting dev servers first.

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

Archived: The original root app remains in the repository for reference (`archive/original-app/`).

> Note: GitHub Pages provisioning can take a short time after a successful deploy. If the site does not appear immediately after a workflow completes, wait ~1–2 minutes and refresh.

## Deploying to Vercel
1. Push the latest `main` branch to GitHub (see workflow in this README).
2. In Vercel, choose **Add New Project → Import Git Repository**, then select `evschneider-hmi/ps-html5auditor`.
3. When prompted for the root directory, leave it at the repo root. The default build command (`npm run build`) already delegates to `app-V2` and the output directory `app-V2/dist` is uploaded automatically.
4. Set the production and preview build outputs to `app-V2/dist`. No environment variables are required for the static build.
5. Complete the import. Subsequent pushes to `main` (or PR branches if you enable preview deployments) will trigger automatic builds and Vercel previews.

> Tip: Enable the existing Playwright GitHub Action to guard deployments—Vercel will only receive new builds after the tests succeed on `main`.

## Automated Vercel failure triage

The repository includes two optional pieces that close the loop between Vercel deployments and GitHub triage:

- `.github/workflows/vercel-deploy-watch.yml` listens for either a Vercel webhook (`repository_dispatch` with type `vercel-deployment-error`) or the built-in Vercel GitHub Check. When it detects a failed deployment it:
	- resolves the failing deployment via the Vercel REST API,
	- downloads the build/runtime logs,
	- comments on the associated PR/commit with the truncated logs, and
	- (optionally) opens a "Fix Vercel deployment failure" issue tagged for automation/Copilot follow-up.
- `api/github-dispatch.js` is an example Vercel Serverless Function that receives the `deployment.error` webhook, verifies the signature, and forwards a `repository_dispatch` to GitHub. Deploy it to the same Vercel project (or adapt it to any webhook relay service) when you do not want to expose a custom endpoint.

### Secret / environment setup

GitHub → **Settings → Secrets and variables → Actions**:

- `VERCEL_TOKEN` – project-scoped token with access to deployments/logs
- `VERCEL_PROJECT_ID` – the project identifier shown in Vercel settings
- `VERCEL_ORG_ID` – team id (omit or leave blank for personal accounts)

Vercel → **Project Settings → Environment Variables** (used by `api/github-dispatch.js`):

- `VERCEL_WEBHOOK_SECRET` – shared secret to verify webhook signatures
- `GITHUB_OWNER` / `GITHUB_REPO` – overrides if you fork the repo
- `GITHUB_DISPATCH_TOKEN` – PAT (or fine-grained token) with `repo` scope to call the GitHub `repository_dispatch` API

### Wiring the webhook

1. In Vercel, create a webhook that listens to `deployment.error` (and optionally `deployment.canceled` / `deployment.succeeded`). Point it to `https://<your-app>.vercel.app/api/github-dispatch` (or wherever you host the bridge).
2. Each failure will trigger the bridge, which calls `POST /repos/{owner}/{repo}/dispatches` with event type `vercel-deployment-error` and sends the deployment id / commit SHA / PR number.
3. The GitHub Action inspects the payload, pulls the latest logs, and files the comment/issue automatically. If you have Copilot Enterprise or Pro Plus, assign the generated issue to the Copilot agent for a fully automated fix attempt; otherwise, treat the issue as a ready-made work order.

> Quick smoke test: run `vercel deployment list` or `vercel build` locally to produce a failure, then use `curl -X POST` against `api/github-dispatch` with a captured webhook payload to ensure the automation path is wired before relying on production failures.

## Attribution
From Horizon Media’s Platform Solutions team

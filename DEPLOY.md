# Deployment guide

The repository publishes two experiences:

- **Production app** at <https://creative.hmi-platformsolutions.com/> — built and deployed by your primary pipeline (outside this repo).
- **Migration landing page** at <https://evschneider-hmi.github.io/ps-html5auditor/> — built from `app-V2`, forced to show the migration overlay, and backed by a static screenshot so the legacy app bundle never loads on GitHub Pages.

## GitHub Pages publishing

GitHub Pages deployments are intentionally guarded to avoid accidental publishes. The workflow lives at `.github/workflows/deploy.yml` and only runs when one of the following is true:

1. You launch it manually from the **Actions → Deploy to GitHub Pages → Run workflow** button.
2. You push a commit to `main` whose commit message contains the token `[pages]`.

Both execution paths build `app-V2` with `VITE_SHOW_MIGRATION_OVERLAY=always`, so the published Pages site permanently shows the migration overlay (and skips loading the legacy app). The runtime also checks the host, so the overlay is only visible on `evschneider-hmi.github.io` by default.

### Manual run

1. Open the repository on GitHub.
2. Navigate to **Actions → Deploy to GitHub Pages**.
3. Click **Run workflow**, confirm branch `main`, and submit.

### Token-based push

1. Make your changes locally.
2. Commit with a message that includes `[pages]`, for example:
   ```
   git commit -m "docs: update deploy notes [pages]"
   ```
3. Push to `main`. The workflow will detect the token and deploy automatically.

If you want a different guard (tags, labels, approvals), edit `deploy.yml` accordingly.

## Verifying the overlay

The overlay is controlled by the Vite build flag `VITE_SHOW_MIGRATION_OVERLAY`. When omitted, the runtime automatically shows the gate only on GitHub Pages. Setting the flag to `always` (or `true`) forces the overlay everywhere; `never`/`false` disables it entirely. To preview the overlay locally, run:

```powershell
cd app-V2
$env:VITE_SHOW_MIGRATION_OVERLAY = 'always'
npm run dev
```

When you are done, remove the environment variable (or close the terminal session).

## Refreshing the backdrop screenshot

The overlay renders a static screenshot stored at `app-V2/src/assets/migration-app-preview.png`. If the UI shell changes, regenerate the image after a production build:

```powershell
npm --prefix ./app-V2 run build
node scripts/capture-overlay-screenshot.mjs
```

Commit the updated PNG before deploying so GitHub Pages serves the latest backdrop.

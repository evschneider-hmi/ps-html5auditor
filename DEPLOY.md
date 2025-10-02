# Deployment guide

The repository publishes two experiences:

- **Production app** at <https://creative.hmi-platformsolutions.com/> — built and deployed by your primary pipeline (outside this repo).
- **Migration landing page** at <https://evschneider-hmi.github.io/ps-html5auditor/> — built from `app-V2` with an enforced migration overlay.

## GitHub Pages publishing

GitHub Pages deployments are intentionally guarded to avoid accidental publishes. The workflow lives at `.github/workflows/deploy.yml` and only runs when one of the following is true:

1. You launch it manually from the **Actions → Deploy to GitHub Pages → Run workflow** button.
2. You push a commit to `main` whose commit message contains the token `[pages]`.

Both execution paths build `app-V2` with `VITE_SHOW_MIGRATION_OVERLAY=true`, so the published Pages site always shows the migration overlay.

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

The overlay is controlled by the Vite build flag `VITE_SHOW_MIGRATION_OVERLAY`. It is set inside the workflow so local builds and the production environment remain unaffected. To preview the overlay locally, run:

```powershell
cd app-V2
$env:VITE_SHOW_MIGRATION_OVERLAY = 'true'
npm run dev
```

When you are done, remove the environment variable (or close the terminal session).

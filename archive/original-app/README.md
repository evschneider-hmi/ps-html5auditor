# Archived original app

The original root app has been archived in this folder. The active application is now the one in `extended-app/`.

Why this change:
- We consolidated all future work into `extended-app` to avoid drift and confusion.
- Root npm scripts now delegate to `extended-app` (dev/build/preview).

How to run the current app:
- From repo root, use:
  - `npm run dev` (starts extended-app)
  - `npm run build` (builds extended-app)
  - `npm run preview` (previews extended-app)

If you need to reference the previous implementation, its source remains in the root (for now) but is considered frozen. Please port changes into `extended-app` if needed.
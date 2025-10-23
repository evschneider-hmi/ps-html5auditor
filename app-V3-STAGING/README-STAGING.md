# Creative Suite Auditor V3 - STAGING

This is a **staging environment** for testing changes before they go live in app-V3.

## Purpose

- Test new features and bug fixes in isolation
- Validate changes before deploying to production (app-V3)
- Maintain a stable production version while iterating on improvements

## Visual Indicators

- **Title**: "Creative Suite Auditor V3 - STAGING" in browser tab
- **Favicon**: Orange badge (vs. purple for production)
- **Header Badge**: Orange "STAGING" badge next to title
- **Package Name**: ps-html5auditor-v3-staging
- **Version**: 3.0.0-staging

## Workflow

1. Make and test changes in **app-V3-STAGING**
2. Once validated, copy changes to **app-V3**
3. Build and deploy app-V3 to production

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build
```

## Notes

- This directory is cloned from app-V3 as of commit 297d13e
- Changes here should be tested thoroughly before moving to app-V3
- Keep this environment updated with any critical fixes from app-V3

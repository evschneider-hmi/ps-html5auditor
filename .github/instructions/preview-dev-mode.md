# CM360 Preview Dev Mode Fix

## Problem
The CM360 preview was showing a **blank white box** in dev mode (`npm run dev`) with no dimensions detected, even though it worked perfectly in the e2e test environment.

## Root Cause
**Service workers cannot register properly in Vite dev mode:**

1. **Dev mode**: Vite serves files from `/src/preview/sw.js` (not bundled)
2. **Service worker scope restriction**: A service worker at `/src/preview/sw.js` can only control paths under `/src/preview/`
3. **Our creative URLs**: We were trying to intercept `/__cm360/<bundle>/...` which is outside the allowed scope
4. **Result**: SW registration silently fails → creative iframe gets 404 → blank white box

In **production/preview mode** (`npm run preview`), the service worker gets bundled to `/assets/sw-<hash>.js` and can control the root scope properly.

## Solution: Hybrid Approach
Implemented a **graceful degradation strategy**:

### 1. Try Service Worker First (Production)
- Register SW from bundled asset URL
- Use fetch interception for creative assets
- Full CM360 simulation with proper origin handling

### 2. Fallback to Direct Mode (Dev)
When service worker registration fails:
- Decode the `index.html` from the bundle entries
- Inject it directly via `iframe.srcdoc`
- Skip service worker entirely
- Creative still renders, Enabler shim still works

## Key Changes

### `buildIframeHtml.ts`
```typescript
// 1. Added loadCreativeDirectly() function
const loadCreativeDirectly = () => {
  // Find index.html in entries
  // Decode buffer to string
  // Load via srcdoc attribute
  creativeFrame.srcdoc = indexHtml;
};

// 2. Updated handleEntries() to try both paths
const handleEntries = (payload) => {
  state.entries = payload.entries;
  
  // Try SW first, fallback to direct
  if (state.ready && state.worker) {
    flushEntries(); // Service worker mode
  } else {
    loadCreativeDirectly(); // Direct mode
  }
};

// 3. Made SW registration non-blocking
navigator.serviceWorker.register(SW_URL, {...})
  .catch((error) => {
    console.warn('SW failed, using direct mode', error);
    if (state.entries) loadCreativeDirectly();
  });
```

## Limitations in Direct Mode

### ✅ What Works
- Creative HTML renders
- JavaScript executes
- Enabler shim injects
- Dimensions detected
- Click tracking works

### ⚠️ What Doesn't Work
- **External assets** (images, fonts, scripts with relative URLs) may 404
- **Subloading** won't be measured accurately (everything loads at once)
- **Network request interception** unavailable (no fetch debugging)

## Testing

### Dev Mode (Direct)
```bash
npm run dev
# Visit http://localhost:5173
# Upload a creative ZIP
# Preview should show creative content (may miss external assets)
```

### Production Mode (Service Worker)
```bash
npm run build
npm run preview
# Visit http://localhost:4173
# Upload a creative ZIP
# Preview should show full creative with all assets
```

### E2E Tests (Service Worker)
```bash
npm run test:e2e
# Teresa spec should pass
# Tests use production build
```

## Why This Is Better Than Breaking Localhost

**Alternative considered**: Force service worker to work in dev mode by:
- Using a different dev server setup
- Adding `Service-Worker-Allowed` headers
- Registering SW from root

**Why we didn't**: 
- Would break hot module replacement
- Requires complex Vite config
- Doesn't match production behavior
- Harder to debug

**Our approach**:
- Zero config changes
- Works in both dev and prod
- Graceful degradation
- Better DX (faster dev iteration)

## Future Enhancements

If we need full asset support in dev mode:
1. Build an asset proxy service that maps bundle paths to blob URLs
2. Inject a custom `<base>` tag with data URL scheme
3. Rewrite asset paths during direct load
4. Add a dev-mode-only asset resolver

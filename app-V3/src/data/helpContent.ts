/**
 * Help Content
 * 
 * Centralized help text for all UI elements and checks.
 * Used by HelpButton and Tooltip components throughout the app.
 */

export const helpContent = {
  // Beta Banner
  betaBanner: `V3 is the next-generation Creative Suite Auditor with a modular check system and clean architecture. 
  
Some features from V2 are still being migrated. If you need full V2 functionality, you can still access it at the V2 URL.

What's new in V3:
• Modular, extensible check system
• Cleaner, more maintainable code architecture
• Better performance and error handling
• Foundation for advanced features coming soon`,

  // Check Results Section
  checkResults: `This section shows all validation checks run against your creative.

Each check validates a specific requirement from CM360 or IAB specifications. Checks are color-coded:
• ✓ PASS (green) - Requirement met
• ⚠ WARN (yellow) - Potential issue, review recommended
• ✗ FAIL (red) - Requirement not met, must fix

Click "Offenders" to see specific files or code causing issues.`,

  // Priority vs Additional Checks (for future organization)
  priorityChecks: `Priority checks are critical requirements that will block your creative from serving or cause major issues.

These should be fixed before launching.`,

  additionalChecks: `Additional checks are best practices and recommendations that improve creative quality and performance.

While not strictly required, following these guidelines prevents common issues.`,

  // Profile Badges
  profileBadges: `Profile badges indicate which specification a check comes from:

• CM360 (green) - Google Campaign Manager 360 requirement
• IAB (purple) - IAB Tech Lab standard

Some checks apply to both specifications.`,

  // Individual Check Help - CM360
  checks: {
    clicktag: `ClickTag is CM360's required mechanism for click tracking.

Your creative must:
1. Declare a global clickTag variable
2. Use it for navigation (e.g., window.open(clickTag))
3. NOT hard-code the destination URL

Why: CM360 dynamically sets the clickTag URL to track clicks and redirect users to the advertiser's landing page.`,

    packaging: `Your ZIP file must have a flat structure with no nested ZIPs or wrapper folders.

Requirements:
• No nested .zip files inside the upload
• No Mac __MACOSX folders
• All files in root or simple subdirectories

Why: Nested structures are rejected by CM360 and most ad exchanges during ingestion.`,

    'allowed-extensions': `Only specific file types are allowed in HTML5 creatives.

Allowed: .html, .htm, .js, .css, .jpg, .jpeg, .png, .gif, .svg, .json, .woff, .woff2, .ttf, .otf, .mp3, .mp4, .webm

Not allowed: .exe, .zip, .rar, executables, archives

Why: Exchanges block unsafe file types for security and to prevent malicious code.`,

    'file-limits': `CM360 has default limits to prevent oversized creatives.

Limits:
• Max 100 files in ZIP
• Max 10 MB compressed ZIP size
• Some exchanges have stricter limits

Why: Large creatives slow QA, increase load times, and may be rejected during upload.`,

    'entry-html': `Your creative must have an index.html or [creativename].html entry point.

CM360 looks for:
1. index.html
2. [creativename].html
3. Single .html file if only one exists

Why: Ad servers need to know which HTML file to load as the creative's starting point.`,

    filenames: `File and folder names must be safe for all platforms.

Rules:
• No spaces, special characters, or unicode
• Use hyphens or underscores for separations
• Lowercase recommended
• Max 255 characters

Why: Special characters cause issues on different operating systems and CDNs.`,

    'iframe-safe': `Your creative should work inside an iframe (sandboxed environment).

Avoid:
• Accessing parent/top window
• Breaking out of iframe
• Manipulating parent page

Why: Creatives run in iframes for security. Trying to escape causes serving failures.`,

    'no-web-storage': `CM360 creatives cannot use localStorage or sessionStorage.

Not allowed:
• localStorage.setItem()
• sessionStorage.setItem()
• Any web storage APIs

Why: Storage APIs don't work in CM360's sandboxed serving environment and will cause runtime errors.`,

    'gwd-env': `Google Web Designer creatives must properly initialize the Enabler.

Required:
• Wait for Enabler ready event
• Check environment (gwd.environments.Environments.LOCAL vs CM360)
• Handle different initialization paths

Why: GWD has specific initialization requirements for CM360 serving vs. local preview.`,

    'hardcoded-click': `Don't hard-code click destination URLs in your creative.

Wrong: window.open('https://advertiser.com')
Right: window.open(clickTag)

Why: Hard-coded URLs bypass CM360's click tracking, breaking attribution and reporting.`,

    // IAB Checks
    'hosted-count': `IAB recommends limiting hosted (external) files to improve load reliability.

Recommendation: ≤ 5 external file requests

Why: Each external request adds latency and failure points. More requests = slower, less reliable loading.`,

    'hosted-size': `IAB recommends limiting total size of hosted (external) assets.

Recommendation: ≤ 100 KB external assets

Why: Large external files slow initial load and may not be cached, hurting user experience.`,

    'css-embedded': `CSS should be embedded in HTML or served from same origin.

Avoid: External CSS from third-party domains
Prefer: Inline <style> or same-domain CSS files

Why: External CSS blocks rendering and adds latency. Embedded CSS loads faster.`,

    'index-file': `IAB standard requires index.html as the entry point.

Required: Your ZIP must have index.html at the root

Why: Publishers expect index.html as the standard entry point for HTML5 creatives.`,

    video: `Video files should be optimized for web delivery.

Best practices:
• Use efficient codecs (H.264, VP9, AV1)
• Compress for web (not broadcast quality)
• Provide multiple formats for compatibility
• Include poster images

Why: Large video files cause slow loading and playback issues across devices.`,

    dialogs: `Avoid using alert(), confirm(), or prompt() dialogs.

Not recommended:
• alert('message')
• confirm('question')
• prompt('input')

Why: Modals block the page, create poor UX, and may be blocked by publishers or browsers.`,

    cookies: `Avoid relying on cookies for essential creative functionality.

Why: Many browsers block third-party cookies, and privacy regulations restrict cookie usage.`,

    'local-storage': `Avoid relying on localStorage for essential functionality.

Why: Storage may be blocked in sandboxed environments or by privacy settings. Use sessionStorage if needed, but with fallbacks.`,

    'syntax-errors': `Your JavaScript must be free of syntax errors.

Check for:
• Missing semicolons
• Unclosed brackets
• Invalid syntax

Why: Syntax errors prevent code execution and break the creative.`,

    'no-document-write': `Don't use document.write() in your creative.

Why: document.write() can overwrite the entire page and cause rendering issues in modern browsers.`,

    jquery: `If using jQuery, ensure it's loaded properly.

Best practices:
• Use slim build if possible
• Load from CDN with local fallback
• Declare version explicitly

Why: jQuery is heavy. Use modern vanilla JS when possible, or load efficiently.`,

    'html5-lib': `Use modern HTML5 APIs instead of legacy libraries when possible.

Prefer: Vanilla JS, Fetch API, ES6+
Avoid: Heavy frameworks for simple tasks

Why: Modern browsers support most features natively. Libraries add unnecessary weight.`,

    minified: `Production creative files should be minified.

Minify:
• JavaScript (.js files)
• CSS (.css files)
• HTML (if large)

Why: Minification reduces file sizes by 40-60%, improving load times.`,

    measurement: `Include proper measurement and tracking pixels.

Include:
• Impression pixels
• Click trackers
• Third-party verification (if applicable)

Why: Tracking ensures accurate reporting and campaign measurement.`,

    'relative-paths': `Use relative paths for in-ZIP assets.

Good: ./images/logo.png
Bad: /images/logo.png or http://...

Why: Absolute paths break when creative is served from different domains or CDNs.`,

    'images-optimized': `Images should be optimized for web delivery.

Optimize:
• Compress JPGs (60-80% quality)
• Use PNG-8 when possible
• Consider WebP format
• Use appropriate dimensions

Why: Unoptimized images are the #1 cause of slow creative loading.`,

    iframes: `Minimize use of iframes in your creative.

Why: Iframes add complexity, security concerns, and can cause rendering issues across platforms.`,

    'no-backup-in-zip': `Remove backup and temporary files from your ZIP.

Remove:
• .bak files
• ~temp files
• .DS_Store
• Thumbs.db
• .git folders

Why: These files add unnecessary bloat and may contain sensitive information.`,

    'host-requests': `Limit total number of HTTP requests.

IAB recommendation: ≤ 15 total requests

Why: Each request adds latency. Fewer requests = faster loading.`,

    'cpu-budget': `Keep CPU usage within IAB limits for smooth performance.

Budget: < 100ms total CPU time

Why: Heavy CPU usage drains battery on mobile and causes choppy animations.`,

    'time-to-render': `Creative should render quickly after page load.

IAB goal: ≤ 1 second to first render

Why: Slow rendering frustrates users and may cause creative to be skipped.`,

    'dom-content-loaded': `Creative should be ready quickly after DOMContentLoaded.

Why: Fast initialization ensures creative displays before user scrolls past.`,

    'animation-cap': `IAB limits total animation duration to conserve resources.

Limit: 30 seconds of animation, then stop or loop subtly

Why: Continuous animation drains battery and distracts users.`,

    'creative-border': `Creative should have a defined border to distinguish it from content.

Requirement: 1px border around creative

Why: Users must be able to distinguish ads from editorial content.`,

    // Runtime checks
    timing: `Monitors creative load timing and performance metrics.

Tracks:
• Load event timing
• Script execution time
• Asset loading duration

Why: Performance metrics help identify optimization opportunities.`,

    'creative-rendered': `Verifies creative successfully rendered in preview.

Checks: Creative visible, no blank frames

Why: Ensures creative actually displays and isn't hidden or broken.`,

    'runtime-iframes': `Monitors iframes created at runtime.

Why: Dynamically created iframes may cause unexpected behavior or security issues.`,

    // Validation checks
    'invalid-url-ref': `Detects broken or invalid asset references.

Finds:
• 404 missing files
• Malformed URLs
• Protocol issues

Why: Broken references cause missing images, scripts, or styles.`,

    'orphaned-assets': `Identifies unused files in your ZIP.

Orphans are files not referenced by any HTML/CSS/JS

Why: Unused files add unnecessary bloat to creative size.`,

    'invalid-markup': `Validates HTML structure and syntax.

Checks:
• Unclosed tags
• Invalid nesting
• Malformed attributes

Why: Invalid markup causes rendering issues across browsers.`
  }
};

// Helper function to get help content
export function getHelpContent(key: string): string {
  // Check if it's a check-specific help
  if (key.startsWith('check:')) {
    const checkId = key.substring(6);
    return (helpContent.checks as Record<string, string>)[checkId] || 'No help available for this check.';
  }
  
  // Otherwise look in top-level
  return (helpContent as unknown as Record<string, string>)[key] || 'No help available.';
}

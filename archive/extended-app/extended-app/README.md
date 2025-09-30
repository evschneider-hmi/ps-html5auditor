Extended HTML5 Creative Auditor (Parity Build)

This folder contains a separate copy of the auditor with additional features to approach parity with the referenced AdValify scan page, implemented without altering the main app.

Highlights added here:

- Multi-input validators: HTML5 ZIP, Ad Tag, VAST, Video, Image, Audio
- Extra checks: animation duration, console errors/warnings, dialogs, cookies/localStorage usage, CSS embedded/minified, jQuery detection, document.write, iframe count, images optimized (heuristic), HTML5 library detection (GWD, jQuery, GSAP, CreateJS), hosted file count/size, time metrics (DOMContentLoaded, approximate visual start), CPU/memory heuristics, network (XHR/fetch) capture, etc.
- Runtime probe: instruments the preview iframe to collect metrics/events
- Share/Rescan stubs, printable report (Save as PDF) and original creative download

Note: This implementation is client-only and uses heuristics. Some server-side features (e.g., true screenshot bundle, NSFW classifier, mockups) are provided as stubs or approximations.

Run

- From repo root: `cd extended-app && npm run dev`


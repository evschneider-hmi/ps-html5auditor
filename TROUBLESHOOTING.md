# Troubleshooting guide (app-V2)

This doc captures the fixes and patterns we used so future incidents are faster to resolve.

## Invalid hook call (React) on VAST tab

Symptoms:
- Navigating to VAST tab throws "Invalid hook call".
- Stack points into `VastTester.tsx`.
- Other tabs render fine.

Root causes we saw:
1) Hooks were called at module scope in `VastTester.tsx` (outside any component/custom hook). This always throws.
2) Potential duplicate React runtime when using a local file dependency (monorepo-ish), mitigated via Vite dedupe/alias.

Fixes applied:
- Move module-scope hooks into the `VastTester` component:
  - `createRef` -> `useRef`, `useState`, `useEffect` moved inside component.
  - Keep the XML search highlight and auto-scroll behavior via a component-level `useEffect` tied to `[xmlIndex, xmlQuery, formattedXml, rawXml]`.
- Enforce single React instance in Vite:
  - `resolve.dedupe = ['react','react-dom','react-dom/client','react/jsx-runtime','react/jsx-dev-runtime']`
  - `alias` those ids to `app-V2/node_modules`.
  - `optimizeDeps.include` the same identifiers to harmonize pre-bundling.
- Align package manifests:
  - Root `package.json`: move `react` and `react-dom` to `peerDependencies`.
  - `app-V2/package.json`: depend on `react`, `react-dom` and add `resolutions` to the same versions.

Verification:
- `npm --prefix ./app-V2 ls react react-dom --all` shows a single version tree.
- `npm --prefix ./app-V2 run build` succeeds and VAST loads without the hook error.

Prevention checklist:
- Never call React hooks outside a component or custom hook. Period.
- For monorepos/local file deps, add Vite `resolve.dedupe` and `alias` for React and react-dom (including `react-dom/client` and JSX runtime ids).
- Ensure the root package that is consumed as a local dep lists React as a peer, not a dependency.
- Prefer lazy-loading heavy route components to isolate failures and speed startup.

## Dev blank screen after adding a new lib (e.g., XLSX)

Symptoms:
- Dev server runs, page is blank, or crashes early.
- Console may show Node polyfill errors or default import mismatches.

Fixes applied:
- Use the browser ESM build for XLSX: `import('xlsx/xlsx.mjs')` via a dynamic import wrapper.
- Add minimal window.onerror/unhandledrejection overlay in `app-V2/index.html` for dev to surface early errors.

Prevention checklist:
- For browser-only libs, prefer ESM/browser entry points. Avoid Node-only entry paths.
- Lazy-load heavy libs used in secondary tabs to reduce surface area during app boot.

## Layered isolation/strip-back strategy

- Add a small Boot component in `app-V2/src/main.tsx` with a `strip` flag to progressively disable features.
- Render a minimal shell first; then dynamically import the main page component.
- For debugging, allow `?strip=1` or `?strip=2` query param to force minimal modes.

## Helpful commands

- Build once to validate: `npm --prefix ./app-V2 run build`
- Start dev server: `npm run dev` (root delegates to `app-V2`)
- List resolved Reacts: `npm --prefix ./app-V2 ls react react-dom --all`

## Notes

- The Vite server may pick alternate ports (e.g., 5177-5179) if the default is taken. Check the terminal output for the actual URL.
- The in-dev overlay is gated to dev so it won’t affect production builds.

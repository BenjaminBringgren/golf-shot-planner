# Golf Shot Planner — Project Context for Claude Code

## What this app is
A golf shot planning tool for use on the course. Calculates
optimal shot strategies based on club distances, wind, altitude,
and course conditions. Built by Benjamin Bringgren.

## Copyright
All files must carry this header:
/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */

## Architecture — Five-Layer Rule
Dependencies flow downward only. No layer imports from a layer
above it. Ever.

  src/ui/        — DOM rendering only, no business logic
      ↓ imports down only
  src/app/       — business logic, state, navigation
      ↓ imports down only
  src/engine/    — pure functions, zero side effects,
                   no DOM, no storage, no network
      ↓ imports down only
  src/storage/   — all localStorage/sessionStorage, nothing else
      ↓ imports down only
  src/platform/  — GPS, weather fetch, raw browser APIs only

If you find yourself writing document. or localStorage. inside
src/engine/ — stop. That code belongs in a higher layer.

## Refactor status (as of 2026-04-25)
The five-layer ES module refactor is complete. index.html is
pure markup with a single entry point:
  <script type="module" src="src/app/router.js"></script>

## window.* status
window.* is fully retired. Zero assignments, zero reads anywhere
in src/ (excluding native browser APIs like window.scrollTo,
window.removeEventListener).

Cross-layer calls use two patterns instead:
1. Callbacks: router.js passes a buildCallbacks() object to
   renderPlayCourseBar, renderScoreEntry, showRoundCompleteOverlay.
   UI functions call callbacks.calculate?.() etc.
2. Service injection: courses.js exposes initServices(svc) which
   router.js calls once at startup with app-layer functions.

Do not add new window.* writes or reads to any module.

Never use Object.defineProperty on window (Safari bug).

## Critical rules
- All imports use explicit .js extensions
- All localStorage key strings are named constants in
  src/storage/storage.js — never hardcoded elsewhere
- Do not alter calculation logic in src/engine/ — values are
  validated against Trackman data
- No new window.* writes anywhere except router.js bridge
- No new window.* READS in src/engine/ or src/storage/

## Product roadmap
Phase 1 (done): Modular web app — this codebase, verified on iPhone Safari
Phase 2 (next): SwiftUI native rebuild — platform/ and storage/ layers swap,
  engine/ and app/ logic ported to Swift, ui/ rebuilt in SwiftUI.
  Web app stays on GitHub Pages as reference implementation throughout.

## Key files

| File | Layer | Role |
|---|---|---|
| `index.html` | entry | Pure markup + single script tag |
| `src/app/router.js` | app | Entry point. calculate(), GPS, wind, compass, override state, switchTab, wireMgNav, bridge assignments |
| `src/app/courses.js` | app | Course CRUD, hole-to-play logic, course editor, blendedScore, computeHoleStrokeCounts |
| `src/app/holeFlow.js` | app | Stage machine for advanced score entry: STAGE_SHOTS → STAGE_PUTTS → STAGE_RESULT. Owns penalty/relief logic and pick-up |
| `src/app/rounds.js` | app | Round stats, score rendering, My Golf sub-pages, showMgSub |
| `src/ui/mapView.js` | ui | Mapbox GL map overlay: scope dots, shot lines, labels, dispersion arc, drag-to-override. SwiftUI migration replaces Mapbox with MapKit. |
| `src/ui/carousel.js` | ui | Strategy carousel, wind breakdown, chip row sync |
| `src/ui/scorecard.js` | ui | Active round scorecard, round complete overlay, saved round detail |
| `src/ui/shotSheet/` | ui | Shot-by-shot entry UI components (index.js orchestrates; LieGrid, ShotChips, PuttsCard, ResultBar, etc.) |
| `src/ui/sheets.js` | ui | Club picker sheet, course picker sheet |
| `src/engine/calculations.js` | engine | Shot planning math, wind/temp adjustment, expected strokes |
| `src/engine/clubs.js` | engine | Club table, carry interpolation, roll factors |
| `src/storage/storage.js` | storage | All localStorage/sessionStorage — no other module touches storage |
| `src/platform/gps.js` | platform | Geolocation, shot tracking — only file that changes for SwiftUI migration |
| `src/platform/weather.js` | platform | Open-Meteo wind fetch, Nominatim reverse geocode |

## Typography
All font sizes must use Apple's Large (Default) Dynamic Type scale.
No other values are permitted.

| Role        | Size |
|-------------|------|
| Large Title | 34px |
| Title 1     | 28px |
| Title 2     | 22px |
| Title 3     | 20px |
| Headline    | 17px |
| Body        | 17px |
| Callout     | 16px |
| Subhead     | 15px |
| Footnote    | 13px |
| Caption 1   | 12px |
| Caption 2   | 11px |

Minimum size is 11px (Caption 2). Never go below it.
Off-scale values like 9, 14, 18, 23, or 30px are not allowed —
round to the nearest step in the table above.

These rules apply everywhere without exception: CSS classes,
inline styles in HTML, and JS-generated HTML strings.

Practical minimum for this app is 13px (Footnote). Caption 1
(12px) is permitted only in scorecards and genuinely
space-constrained table cells. Caption 2 (11px) only for unit
glyphs beside large numbers. Never use 11px or 12px for a label
that exists elsewhere at 13px.

Permitted font-weight values: 400, 600, 700, 800 only.
Never use 300 or 500. Primary buttons and actions: 700.
Secondary buttons and actions: 600.
All-caps tracking labels (badges, chips, section headers, menu
titles) use `text-transform: uppercase; letter-spacing: 0.04–0.05em`
and must use font-weight: 700 — they read visually smaller due to
letter-spacing, so the heavier weight is required for legibility.

## Score color convention
Never use green or blue for score values. Always:
- Under par → `#c0392b` (red)
- Over par or even → `#1a1a1a` (black)

This applies everywhere: score pills, FAB labels, round history
rows, hero numbers, stat tiles.

## Strategy types
Three strategy types exist with exact string keys stored in
localStorage. Never rename them — they are storage keys.

| Type | Color |
|---|---|
| `Max distance` | `#c0392b` |
| `Controlled` | `#c07820` |
| `Conservative` | `#1e7a45` |

Custom/Par 3 fallback color: `#888`. Strategy colors are also
used as the left-border stripe in saved round scorecards
(`box-shadow: inset 6px 0 0 ${color}` on the hole cell).

## Scroll lock rule
Every overlay and drawer open must set:
  document.body.style.overflow = 'hidden';
Every close path — including "back" buttons and programmatic
closes that bypass the normal close function — must reset it:
  document.body.style.overflow = '';

Recurring bug pattern: "Back to round", mode-toggle closes, and
next-hole navigation all bypass the normal closeDrawer() and have
historically forgotten to reset overflow, leaving the page
unscrollable until a tab switch.

## Sub-page navigation (MY GOLF)
All MY GOLF sub-page transitions go through showMgSub(id) in
src/app/rounds.js. It must always reset both scroll targets:
  window.scrollTo({ top: 0, behavior: 'instant' });
  document.getElementById('panePrepare').scrollTop = 0;
If only window is reset, content rendered into a previously
scrolled sub-page will open mid-scroll.

## Safari compatibility
Hard requirement. Tested on Brave and Safari on iPhone.
Never use Object.defineProperty on window.
Always test GPS reset on hole switch specifically on Safari —
this has been a recurring bug in this codebase.

Use type="text" inputmode="numeric" pattern="[0-9]*" for
numeric inputs that need to enable a button as-you-type.
type="number" with min/max clears the value on iOS for
intermediate inputs below min, breaking input event handling.

## Button press/hover states — iOS fix
Safari and WKWebView do not reliably clear :active when the DOM
changes during a touch gesture. The app uses a global fix instead:

- In CSS: use `.is-pressed` class, never `:active`, for all button
  feedback (background change, transform scale, etc.)
- The global handler lives in src/app/router.js and uses delegated
  touchstart/touchend/touchcancel on document to add/remove
  `.is-pressed` on any matching element.
- Selector covers: `button`, `.mg-menu-row`, `.gps-tile`,
  `.club-picker-item`, `.sh-lie`, `.picker-fmt-card`,
  `.mg-stat-tile.tappable`, `.mg-drilldown-btn`
- When adding new interactive elements that need press feedback:
  add the CSS rule as `.your-class.is-pressed { ... }` and, if the
  element is not a `<button>`, add its class to `_PRESS_SEL` in
  router.js. Do NOT use `:active` for touch feedback.

Two separate iOS issues, both fixed:
1. `:active` stuck — fixed via `.is-pressed` + JS touch handler
2. `:hover` stuck — iOS fires `:hover` on tap and it sticks until
   next tap elsewhere. Fixed by wrapping ALL `:hover` rules in
   `@media (hover: hover) { ... }` so they only apply on real
   pointer devices (desktop). Never write a bare `:hover` rule.
   Always write: `@media (hover: hover) { .foo:hover { ... } }`

## index.html is a static shell — strict rules

index.html must contain:
- Semantic HTML structure only (elements, IDs, classes)
- `<link rel="stylesheet" href="src/styles.css">`
- `<script type="module" src="src/app/router.js"></script>`
- Meta tags and viewport

index.html must never contain:
- Any `<style>` block or inline `style=""` attribute
- Any JavaScript — including onclick, onchange, or any
  inline event handler
- Any dynamically generated HTML
- Any template strings or render logic

New UI elements go in src/styles.css (styles) and the
relevant src/ui/ module (structure and behaviour).
If you are about to write anything into index.html beyond
a structural HTML element — stop and put it in the
correct module instead.

## Map overlay system (mapView.js)

`src/ui/mapView.js` renders the Mapbox GL overlay on the Play tab. It is a pure UI
module — zero storage, zero engine imports. All data flows in via callbacks.

### Initialisation
`router.js` calls `initMapView({ ...callbacks })` once. `openMapView()` is called each
time the map drawer opens. Never call `_renderShotOverlay` directly — always go through
`_whenStyleLoaded(() => _renderShotOverlay())` so it fires after the GL style is ready.

### Key callbacks (passed from router.js)
| Callback | Returns | Purpose |
|---|---|---|
| `getComputedStrategies()` | `Strategy[]` | Shot plans to render |
| `getHandicap()` | `number` | HCP for dispersion arc |
| `getGpsSnapshot()` | `{teeMark, ballMark}` | Current GPS marks |
| `haversine(lat1,lon1,lat2,lon2)` | `number` (m) | Distance between two points |
| `destinationFromBearing(lat,lon,brg,d)` | `{lat,lon}` | Point at bearing + distance |
| `findBestClubForDist(distM, excludeDriver)` | `string\|null` | Nearest club key for a distance |
| `commitClubOverride(segmentKey, distM, stratType)` | `void` | Write drag result as override + recalc |

### Dot position cache (`_dotPosCache`)
Keyed by `courseId|holeIdx|type`. Stores user-dragged dot positions so they survive
re-renders (strategy switch, calculate()). Partial caches (fewer entries than dots−1)
are allowed — cached entries override leading dots, the rest use engine positions.

### Drag-to-club
On `drag`: compute live distance → `findBestClubForDist` → update label text.
On `dragend`: `commitClubOverride(segmentKey, distM, stratType)` → override written,
`calculate()` called, carousel re-renders.

`segmentKey` values per dot:
- `'tee'` — first scope dot (par 4/5)
- `'shot2'` — second scope dot (3-shot plans)
- `'par3'` — par 3 scope dot
- `null` — approach/last dot (no override, label updates live only)

### Dispersion arc
Arc is a ±40° sweep (80° total) centered at `arcCenter`, radius `R`. Arc center is
offset `R − 15 m` backward from the scope dot so the arc's forward peak sits ~15m
beyond the scope (just above the crosshair ring toward the target).

Width = `2 × R × sin(40°) ≈ R × 1.286`.

`_DRIVER_95` — arc radius by HCP band (calibrated to real-world 95th-percentile data):
- HCP ≤5: 47m → arc width ~60m
- HCP ≤12: 58m → arc width ~75m
- HCP ≤20: 78m → arc width ~100m
- HCP ≤28: 97m → arc width ~125m
- HCP ≤54: 124m → arc width ~160m

Club scale factors in `_DISP_SCALE` — shorter clubs are proportionally much tighter
than carry ratio implies. Driver = 1.00; 7-iron = 0.51; 56° = 0.27.

### Color consistency rule
`_activeStratColor` must be set **before** the strategy guard in `_renderShotOverlay`.
If set after, a failed render (no strategy found) leaves the stale color from the
previous render, causing label/arc color mismatches when dragging across strategies.

## SF Symbols
All icons in this app use Apple SF Symbols. Never substitute
custom SVGs, emoji, Unicode glyphs, or third-party icon sets.

Extracted SVGs live in `assets/sf-symbols-web/` — generated by
`scripts/extract-sf-symbols.py` from template files the user
exports from the SF Symbols Mac app (Regular weight, S scale).

When adding a new icon or replacing an existing one:
1. Identify the correct SF Symbol name (check the SF Symbols app
   for semantics — e.g. `location` = navigation cursor,
   `mappin` = static pin, `arrow.up.right` = external link).
2. Check if it already exists in `assets/sf-symbols-web/`.
3. If not, ask the user to export it from the SF Symbols Mac app
   and run the extract script. Do not proceed with a placeholder.

Use `fill="currentColor"` so icons inherit CSS `color`. Use a
hardcoded fill (`fill="#555"`, `fill="#fff"`, etc.) only when the
parent element does not set `color` via CSS.

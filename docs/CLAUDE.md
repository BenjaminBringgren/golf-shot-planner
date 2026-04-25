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
683 lines of pure markup with a single entry point:
  <script type="module" src="src/app/router.js"></script>

## window.* status
window.* is used in two places:

1. src/app/router.js — intentional bridge. As the entry point,
   router.js assigns window.calculate, window.switchTab, etc.
   so that UI modules (which cannot import upward) can call
   app-layer functions. These are reads in the UI, assignments
   only in router.js.

2. src/ui/scorecard.js lines 733 and 740 — known debt.
   window._inRough is written from a UI module, which violates
   the layer rule. Should be refactored to pass _inRough as a
   parameter. Do not add any new window.* writes.

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
Phase 2 (next): Capacitor wrapper → App Store
Phase 3 (if it grows): Expo / React Native native rebuild

## Key files

| File | Layer | Role |
|---|---|---|
| `index.html` | entry | 683-line markup + single script tag |
| `src/app/router.js` | app | Entry point. calculate(), GPS, wind, compass, override state, switchTab, wireMgNav, bridge assignments |
| `src/app/courses.js` | app | Course CRUD, hole-to-play logic, course editor, blendedScore |
| `src/app/rounds.js` | app | Round stats, score rendering, My Golf sub-pages |
| `src/ui/carousel.js` | ui | Strategy carousel, wind breakdown, chip row sync |
| `src/ui/scorecard.js` | ui | Score drawer, hole grid, round complete overlay |
| `src/ui/sheets.js` | ui | Club picker sheet, course picker sheet |
| `src/engine/calculations.js` | engine | Shot planning math, wind/temp adjustment, expected strokes |
| `src/engine/clubs.js` | engine | Club table, carry interpolation, roll factors |
| `src/storage/storage.js` | storage | All localStorage/sessionStorage — no other module touches storage |
| `src/platform/gps.js` | platform | Geolocation, shot tracking — only file that changes for Capacitor |
| `src/platform/weather.js` | platform | Open-Meteo wind fetch, Nominatim reverse geocode |

## Safari compatibility
Hard requirement. Tested on Brave and Safari on iPhone.
Never use Object.defineProperty on window.
Always test GPS reset on hole switch specifically on Safari —
this has been a recurring bug in this codebase.

Use type="text" inputmode="numeric" pattern="[0-9]*" for
numeric inputs that need to enable a button as-you-type.
type="number" with min/max clears the value on iOS for
intermediate inputs below min, breaking input event handling.

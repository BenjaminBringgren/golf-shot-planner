# Golf Shot Planner — Architecture

## Five-Layer Architecture

Dependencies flow **downward only**. No layer may import from a layer above it. Ever.

```
┌─────────────────────────────────────────┐
│           src/ui/                       │
│   renders DOM, owns no business logic   │
│   carousel.js  scorecard.js  sheets.js  │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/app/                      │
│   business logic, state, navigation     │
│   router.js  courses.js  rounds.js      │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/engine/                   │
│   pure functions, zero side effects     │
│   no DOM, no storage, no network        │
│   calculations.js  clubs.js             │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/storage/                  │
│   all persistence in one place          │
│   storage.js                            │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/platform/                 │
│   GPS, weather fetch                    │
│   only layer that changes for Capacitor │
│   gps.js  weather.js                    │
└─────────────────────────────────────────┘
```

## Dependency Rules Per Layer

| Layer | File(s) | May import from | Example import |
|---|---|---|---|
| `src/ui/` | carousel.js, scorecard.js, sheets.js | engine, storage, platform | `import { interpolate } from '../engine/calculations.js'` |
| `src/app/` | router.js, rounds.js, courses.js | ui, engine, storage, platform | `import { renderPlan } from '../ui/carousel.js'` |
| `src/engine/` | clubs.js, calculations.js | **nothing** | (no imports) |
| `src/storage/` | storage.js | **nothing** | (no imports) |
| `src/platform/` | gps.js, weather.js | **nothing** | (no imports) |

Note: src/ui/ may import from src/app/ for data types but never for calling app-layer functions — those go through the window.* bridge in router.js (see below).

## The Engine Layer Constraint (Absolute)

`src/engine/` must contain **zero** DOM references, **zero** localStorage calls, and **zero** network requests. It receives data as function arguments and returns results. If you find yourself writing `document.` or `localStorage.` inside `src/engine/` — stop. That code belongs in a higher layer.

## window.* Bridge Pattern

`window.*` is fully retired — zero assignments, zero reads in any source module (excluding native browser APIs such as `window.scrollTo` and `window.removeEventListener`).

Cross-layer calls use two explicit patterns instead:

**Callbacks (router.js → scorecard.js):** `router.js` calls `buildCallbacks()` and passes the result to `renderPlayCourseBar`, `renderScoreEntry`, and `showRoundCompleteOverlay`. UI functions call `callbacks.calculate?.()`, `callbacks.gpsTeeSetState?.('idle')` etc. — always with optional chaining so missing callbacks are silent no-ops.

**Service injection (router.js → courses.js):** `courses.js` exports `initServices(svc)`. `router.js` calls it once at startup with all app-layer functions courses.js needs (`switchTab`, `renderPlayCourseBar`, `renderScoreEntry`, `calculate`, etc.). courses.js stores these in a module-level `_svc` object.

Do not add any new `window.*` reads or assignments to any module.

## Safari Rule

Never use `Object.defineProperty` on `window`. Use explicit assignment only (`window.foo = value`).

## Entry Point

`index.html` contains no JavaScript. Its sole script tag is:
```html
<script type="module" src="src/app/router.js"></script>
```
All module loading, including the full import graph, is resolved by the browser from that single entry point.

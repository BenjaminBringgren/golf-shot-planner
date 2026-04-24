# Golf Shot Planner — Architecture

## Five-Layer Architecture

Dependencies flow **downward only**. No layer may import from a layer above it. Ever.

```
┌─────────────────────────────────────────┐
│           src/ui/                       │
│   renders DOM, owns no business logic   │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/app/                      │
│   business logic, state, navigation     │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/engine/                   │
│   pure functions, zero side effects     │
│   no DOM, no storage, no network        │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/storage/                  │
│   all persistence in one place          │
└───────────────────┬─────────────────────┘
                    │ imports down only
┌───────────────────▼─────────────────────┐
│           src/platform/                 │
│   GPS, weather fetch                    │
│   everything that changes for Expo      │
└─────────────────────────────────────────┘
```

## Dependency Rules Per Layer

| Layer | File(s) | May import from |
|---|---|---|
| `src/ui/` | carousel.js, scorecard.js, sheets.js | app, engine, storage, platform |
| `src/app/` | router.js, rounds.js, courses.js | engine, storage, platform |
| `src/engine/` | clubs.js, calculations.js | **nothing** — pure functions only |
| `src/storage/` | storage.js | **nothing** — raw browser storage APIs only |
| `src/platform/` | gps.js, weather.js | **nothing** — raw browser APIs only |

## The Engine Layer Constraint (Absolute)

`src/engine/` must contain **zero** DOM references, **zero** localStorage calls, and **zero** network requests. It receives data as function arguments and returns results. If you find yourself writing `document.` or `localStorage.` inside `src/engine/` — stop. That code belongs in a higher layer.

## What Replaces window.*

`window.*` is fully retired. Every module imports what it needs directly via named ES module imports. There are no global window assignments.

## Safari Rule

Never use `Object.defineProperty` on `window`. Use explicit assignment only.

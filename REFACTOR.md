# Golf Shot Planner — Claude Code Refactor Handoff

**Copyright © 2025 Benjamin Bringgren. All rights reserved.**  
All output files must carry this comment at the top:
```
/* Copyright © 2025 Benjamin Bringgren. All rights reserved. Unauthorised copying or distribution is prohibited. */
```

---

## 1. Project Overview

**File:** `index.html`  
**Current state:** Single-file vanilla HTML/CSS/JS, ~9,000 lines, zero dependencies, zero build tools.  
**Hosted:** GitHub Pages (static). Tested on Brave and Safari on iPhone. Safari compatibility is a hard requirement.  
**Goal of this refactor:** Split the single file into a logical modular structure using native ES modules — no build tools. Isolate the calculation engine cleanly to serve three sequential phases: continued web development on GitHub Pages, App Store distribution via Capacitor, and eventual full native rebuild in Expo / React Native.

---

## 2. The Golden Rule — DO NOT BREAK THIS

The refactored app uses a **five-layer architecture** with a strict downward-only dependency direction. No layer may import from a layer above it. Ever.

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

**This replaces the old `window.*` boundary pattern entirely.** Every module imports what it needs directly. There are no global window assignments. `window.*` is retired.

**The engine layer constraint is absolute:** `src/engine/` must contain zero DOM references, zero localStorage calls, and zero network requests. It receives data as function arguments and returns results. If you find yourself writing `document.` or `localStorage.` inside `src/engine/`, stop — that code belongs in a higher layer.

**Safari rule (still applies to any bootstrap glue):** Never use `Object.defineProperty` on `window`. Use explicit assignment only.

---

## 3. Layer Ownership — What Lives Where

The following functions currently exist in `index.html`. During the audit (Prompt 0), Claude Code will produce a complete map. This table defines the target home for each concern.

| Current responsibility | Target layer | Target file |
|---|---|---|
| `calculate()` — main calculation fn | `src/engine/` | `calculations.js` |
| `clearGpsState()` — reset GPS | `src/platform/` | `gps.js` |
| `completedShots` — GPS shot array | `src/platform/` | `gps.js` |
| `teeMarked` — GPS bool | `src/platform/` | `gps.js` |
| `strategyDisplayName` — key→label | `src/engine/` | `calculations.js` |
| `_switchStrategyCard()` — UI swap | `src/ui/` | `carousel.js` |
| `_openClubPicker()` — modal | `src/ui/` | `sheets.js` |
| `_lastClubsList` — club snapshot | `src/engine/` | `clubs.js` |
| `par3ClubOverride` — override state | `src/app/` | `rounds.js` |
| `updateWindSectionStatus()` — UI | `src/ui/` | `carousel.js` |
| `updateWindBreakdown()` — UI | `src/ui/` | `carousel.js` |
| `syncChipRow()` — UI state | `src/ui/` | `carousel.js` |
| `decodeStrategy()` — parse string | `src/engine/` | `calculations.js` |
| `navigateTo()` — routing | `src/app/` | `router.js` |
| All localStorage read/write | `src/storage/` | `storage.js` |
| All sessionStorage read/write | `src/storage/` | `storage.js` |
| Open-Meteo fetch | `src/platform/` | `weather.js` |
| Nominatim reverse geocode | `src/platform/` | `weather.js` |
| Course CRUD | `src/app/` | `courses.js` |
| Round save/load/score | `src/app/` | `rounds.js` |
| Carousel render | `src/ui/` | `carousel.js` |
| Hole grid / scorecard render | `src/ui/` | `scorecard.js` |
| Bottom sheets | `src/ui/` | `sheets.js` |

**`window.*` is fully retired.** None of these functions are assigned to `window` in the refactored codebase. All cross-layer calls happen via named ES module imports.

---

## 4. localStorage Schema

| Key | Shape | Owned by (target module) |
|---|---|---|
| `golfBag_v2` | `{ checked[], driver, i7, pw, conditions }` | `src/storage/storage.js` |
| `golfCourses_v1` | `Course[]` with `holes[{par, si, length, note}]`, `courseRating`, `slopeRating` | `src/storage/storage.js` |
| `golfRounds_v1` | `Round[]` with per-hole scores + strategies | `src/storage/storage.js` |
| `golfProfile_v1` | `{ name, handicap, homeCourse }` | `src/storage/storage.js` |
| `golfWind_v1` | Wind state object | `src/storage/storage.js` |
| `windEnabled` | Bool | `src/storage/storage.js` |
| `golfTee_v1` | Tee preference | `src/storage/storage.js` |

**Key rule:** Each key must be owned by exactly one module. No other module reads or writes it directly — they call functions on the owning module.

---

## 5. sessionStorage Schema

| Key | Shape | Owned by |
|---|---|---|
| `activeCourse` | `{ id, holeIdx }` | `src/storage/storage.js` |
| `committedStrategies` | `{ holeIdx: 'Max distance · Driver', ... }` | `src/storage/storage.js` |
| `roundScores_<courseId>` | In-progress round scores per course | `src/storage/storage.js` |

---

## 6. Target File Structure

```
golf-shot-planner/              ← repo root (keep as-is)
├── index.html                  ← Thin shell (~50 lines), script imports only
├── src/
│   ├── platform/               ← LAYER 5 (bottom): runtime-specific APIs
│   │   ├── gps.js              ← navigator.geolocation, GPS state, shot tracking
│   │   └── weather.js          ← Open-Meteo fetch, Nominatim reverse geocode
│   ├── storage/                ← LAYER 4: all persistence, nothing else
│   │   └── storage.js          ← All localStorage + sessionStorage, key constants
│   ├── engine/                 ← LAYER 3: pure computation, zero side effects
│   │   ├── clubs.js            ← relCarry table, roll factors, club lookup
│   │   └── calculations.js     ← Distance interpolation, wind math, plan generation
│   ├── app/                    ← LAYER 2: business logic, state, navigation
│   │   ├── router.js           ← navigateTo(), tab/subpage state, hole switching
│   │   ├── rounds.js           ← Round management, scoring, GIR, save/load
│   │   └── courses.js          ← Course CRUD, course picker logic
│   ├── ui/                     ← LAYER 1 (top): DOM rendering only
│   │   ├── carousel.js         ← Strategy carousel (Max/Controlled/Conservative)
│   │   ├── scorecard.js        ← Hole grid, GIR rendering, score entry row
│   │   └── sheets.js           ← Bottom sheets (course picker, club picker modal)
│   └── styles.css              ← Extracted from <style> block verbatim
└── docs/
    ├── architecture.md
    ├── localStorage.md
    └── changelog.md
```

**Dependency rule per layer:**
- `src/ui/` may import from: `src/app/`, `src/engine/`, `src/storage/`, `src/platform/`
- `src/app/` may import from: `src/engine/`, `src/storage/`, `src/platform/`
- `src/engine/` may import from: nothing (pure functions, no imports needed)
- `src/storage/` may import from: nothing (raw localStorage/sessionStorage only)
- `src/platform/` may import from: nothing (raw browser APIs only)

No upward imports. Ever.

---

## 7. Calculation Engine Reference

These are the core algorithms currently in index.html. They must be preserved exactly — do not alter logic, only move and re-export.

### Club interpolation
```javascript
// relCarry table maps club index → fraction of driver carry
// Clubs: driver, fw3, fw5, fw7, u2, u3, u4, 4i, 5i, 6i, 7i, 8i, 9i, pw, 50°, 52°, 54°, 56°, 58°, 60°
carry = driverCarry × relCarry[clubIdx]
```

### Roll factor (conditions)
```javascript
// Two tables: rollSoft and rollFirm, indexed by club
total = carry × rollFactor(conditions, clubIdx)
// Wind-adjusted roll:
if (hw >= 0) adjusted = baseRoll × (1 − 0.022 × hw)   // headwind → steeper → less roll
else         adjusted = baseRoll × (1 + 0.011 × |hw|)  // tailwind → flatter → more roll
// clamp(adjusted, 1.0, 1.6)
```

### Wind adjustment (carry only, before roll)
```javascript
// Step 1: decompose
headwind = windSpeed × cos(windFromDeg − holeDirectionDeg)

// Step 2: altitude correction (boundary layer power law)
V(z) = V(10) × (z/10)^0.143
// Peak heights and ALT_FACTORS:
// driver_fw: 35m → 1.20 | hybrid_long: 28m → 1.16
// mid_iron: 22m → 1.12 | short_iron: 18m → 1.07 | wedge: 14m → 1.03

// Step 3: apply
// Headwind rates (m per m/s): driver_fw 2.5, hybrid_long 2.2, mid_iron 2.0, short_iron 1.8, wedge 1.5
// Tailwind rates (m per m/s): driver_fw 1.2, hybrid_long 1.0, mid_iron 0.9, short_iron 0.8, wedge 0.5
```

### Expected strokes remaining
```javascript
// 6 approach bands × 4 driver carry tiers lookup table
// Handicap adjustment: hcpAdj = min(handicap × 0.056, 3.0)
// Wind adjustment: windAdj = clamp(hw × altFac × 0.04, −0.15, +0.25)
result = EXPECTED_STROKES[band][tier] + hcpAdj + windAdj
```

### Plan generation (par 4/5)
```javascript
getValidTeeClubs(clubsList, par):
  par5 → [driver, fw3, fw5, fw7, u2, u3, u4] sorted longest→shortest
  par4 → clubs where idx ≤ idx7 (7i or longer)

validTeeClubs.slice(0, 3) → types: ['Max distance', 'Controlled', 'Conservative']

findBestContinuation(teeClub, hole, driverTotal, clubsList):
  single-shot if approach in [40, driverTotal × 0.92]
  otherwise best second club (shorter than tee, not driver, idx ≤ idx7)
  score = shots.length + expectedStrokesRemaining(approach, driverCarry)
```

### GIR
```javascript
gir = (fairway === par − 2)  // automatic, no user toggle
// Stored in score object: { fairway, putts, gir }
```

---

## 8. Refactor Phases — Execute In This Order

**Do one phase at a time. Grep-verify after each phase before continuing.**

### Phase 1 — Extract CSS (zero risk)
- Pull `<style>` block verbatim into `src/styles.css`
- Replace with `<link rel="stylesheet" href="/src/styles.css">`
- Verify: app renders identically on Safari

### Phase 2 — Extract src/storage/storage.js (Layer 4)
- Move ALL localStorage and sessionStorage calls here — no exceptions
- All key strings defined as named constants in this file and imported everywhere else
- This file imports from nothing — raw browser storage APIs only
- Verify: bag, courses, rounds, wind, profile all save and load correctly

### Phase 3 — Extract src/platform/ (Layer 5)
- `gps.js`: GPS state variables (`completedShots`, `teeMarked`), all GPS functions, shot tracking
- `weather.js`: Open-Meteo fetch, Nominatim reverse geocode
- These files import from nothing — raw browser APIs only
- No `window.*` assignments — callers will import directly
- Verify: GPS mark tee → mark ball → counter increments on Safari

### Phase 4 — Extract src/engine/ (Layer 3)
- `clubs.js`: relCarry table, rollSoft/rollFirm tables, club lookup — pure functions only
- `calculations.js`: distance interpolation, wind adjustment, altitude correction, expected strokes, plan generation, decodeStrategy — pure functions only
- These files import from nothing — zero side effects, zero DOM, zero storage
- Verify: shot distances identical to pre-refactor for identical inputs

### Phase 5 — Extract src/ui/ (Layer 1)
- `carousel.js` first, then `scorecard.js`, then `sheets.js`
- These import from `src/app/`, `src/engine/`, `src/storage/`, `src/platform/` as needed
- No upward imports — UI does not export anything consumed by lower layers
- Verify after each file: carousel renders all three strategy types, score drawer, course picker bottom sheet

### Phase 6 — Extract src/app/ (Layer 2)
- `courses.js` first, then `rounds.js`, then `router.js` last
- `router.js` is extracted last because it depends on everything else
- These import from `src/engine/`, `src/storage/`, `src/platform/` — never from `src/ui/`
- After `router.js` is extracted, `index.html` JS should be bootstrapping only
- Verify: tab switching, hole navigation, back buttons on Safari

---

## 9. Verification Checklist Per Phase

After each phase, manually test on iPhone Safari:

- [ ] Tab switching (Play ↔ My Golf) works
- [ ] Carousel renders and swipes correctly
- [ ] Calculate button produces correct distances for known club/distance combos
- [ ] Wind section fetches and applies correctly
- [ ] GPS: Mark Tee → Mark Ball → counter increments
- [ ] GPS resets on hole switch (Safari-specific — this has historically been a bug)
- [ ] Score drawer opens, saves to sessionStorage
- [ ] Course loads and hole navigation works
- [ ] Saved rounds persist and render in My Golf tab
- [ ] No `Object.defineProperty` on `window` anywhere in new code

---

## 10. Known Failure Modes to Watch For

**Upward imports**
The most likely mistake during the refactor. Symptom: circular dependency error from Vite, or a lower layer breaking when a UI change is made. Cause: a lower layer imported something from a higher layer. Fix: move the shared logic down to the correct layer or pass it as a function argument.

**GPS state not resetting on hole switch (Safari-specific)**
Historical bug that has bitten this codebase before. When `router.js` switches holes, it must call `clearGpsState()` from `src/platform/gps.js` via a direct import. Verify this explicitly on iPhone Safari after Phase 7.

**Safari `Object.defineProperty` on window**
Do not use anywhere in the refactored codebase. `window.*` is retired — this pattern no longer has a place.

**`file://` ES module CORS**
Native ES modules are blocked on `file://` origins. Always test via GitHub Pages or a local static server (e.g. `npx serve .`). Never open `index.html` directly from the filesystem.

**sessionStorage lost on Safari background purge**
Safari aggressively purges sessionStorage when the app is backgrounded for >~30 seconds. The existing handling logic must be preserved exactly when moving to `src/storage/storage.js` — do not change the read patterns, only relocate them.

**Engine layer contamination**
If any function in `src/engine/` touches `document`, `localStorage`, `sessionStorage`, `navigator`, or `fetch` — it is in the wrong layer. The audit in Prompt 0 should surface any existing violations before extraction begins.

---

## 11. What NOT to Change

- Do not alter any calculation logic (relCarry table, wind coefficients, ALT_FACTORS, EXPECTED_STROKES table) — these have been validated against Trackman data
- Do not rename any localStorage keys — existing user data would be lost on next load
- Do not introduce any new runtime dependencies — the refactored app is vanilla JS served directly, no build tools required
- Do not attempt to share UI code between the web app and any future Expo project — the UI layers are intentionally separate

---

## 12. Product Roadmap — Three Phases

This refactor is Phase 1 of a three-phase product journey. Every architectural decision is made with all three phases in mind.

---

### Phase 1 — Now: Modular Web App (this refactor)

Refactor `index.html` into the five-layer ES module structure. No build tools. GitHub Pages serves the source files directly via native ES module imports. Claude Code builds features. You test on iPhone in minutes. The app keeps evolving at full speed.

**Deployment:** GitHub Pages, native ES modules, no build step.  
**Workflow:** Edit → push → live. Identical to today.  
**Exit criteria:** The app is feature-complete and stable enough that you'd pay for it yourself.

---

### Phase 2 — When ready: Capacitor + App Store

Wrap the existing web app in a Capacitor native shell. HTML UI survives unchanged. Engine survives unchanged. One weekend of work produces an App Store submission. The market tells you whether people will pay for it.

**What changes:** A thin native Swift wrapper around your existing web app.  
**What stays the same:** Everything in `src/`. All five layers. All your logic.  
**Why Capacitor and not Expo here:** Capacitor is the fastest validated path to the App Store. You find out if the product has a market before investing weeks in a native UI rebuild.

**Capacitor integration when ready:**
```bash
npm install @capacitor/core @capacitor/cli @capacitor/geolocation
npx cap init "Golf Shot Planner" "com.bringgren.golfshotplanner"
npx cap add ios
```

Replace `navigator.geolocation` in `src/platform/gps.js` with `@capacitor/geolocation` — this is the only file that changes. Everything else is untouched.

**Exit criteria:** Real users, real revenue, clear signal the product is worth a full native rebuild.

---

### Phase 3 — If it grows: Expo / React Native

The market has validated the product. You invest in a proper native rebuild. Two layers swap, two layers copy unchanged, one layer rebuilds from scratch.

| Layer | Action | Effort |
|---|---|---|
| `src/platform/` | Swap two files | Low |
| `src/storage/` | Swap one file | Low |
| `src/engine/` | Copy unchanged | Zero |
| `src/app/` | Copy unchanged | Zero |
| `src/ui/` | Rebuild in React Native | High |

**src/platform/ swaps:**

`gps.js`:
```javascript
// Web / Capacitor
navigator.geolocation.getCurrentPosition(...)

// Expo
import * as Location from 'expo-location';
const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
```

`weather.js`: No change — `fetch()` works identically in React Native.

**src/storage/ swap:**
```javascript
// Web / Capacitor
localStorage.setItem(KEY, JSON.stringify(value))

// Expo
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem(KEY, JSON.stringify(value))
```
All key constants stay identical. All calling code in `src/app/` stays identical.

**src/ui/ rebuild:**  
The web UI modules are not used in Expo. They serve as the behavioural specification for the React Native rebuild:
- `carousel.js` → `react-native-reanimated` + gesture handler
- `scorecard.js` → RN `FlatList` components  
- `sheets.js` → `@gorhom/bottom-sheet`
- Wind compass → `react-native-gesture-handler`

Do not attempt to port or adapt the HTML/CSS. Treat `src/ui/` as documentation.

**Expo initialisation when ready:**
```bash
npx create-expo-app GolfShotPlanner --template blank-typescript
cd GolfShotPlanner
npx expo install expo-location expo-secure-store
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install @gorhom/bottom-sheet
```

The web app remains running on GitHub Pages as a development and preview environment throughout the Expo rebuild.

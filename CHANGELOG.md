# Changelog

Format: `[file affected] description`

---

## 2026-05-26

### Map overlay — new features and bug fixes

- `[CLAUDE.md, docs/architecture.md]` `src/ui/mapView.js` added to key files and layer diagram — Mapbox GL overlay for scope dots, shot lines, labels, dispersion arc, drag-to-override
- `[CLAUDE.md, docs/ui-patterns.md]` Map overlay system documented: render lifecycle, `_whenStyleLoaded` rule, callback interface, `_dotPosCache` partial cache behaviour, dispersion arc geometry
- `[docs/override-system.md]` Drag-to-club override documented: `findBestClubForDist` / `commitClubOverride` callbacks, `segmentKey` values, `stratType` closure capture
- `[docs/ui-patterns.md]` Fixed stale `:active` press-feedback rule — corrected to `.is-pressed` class pattern (`:active` is unreliable on Safari/WKWebView)

### Map overlay — bug fixes (no doc change)
- Fix map stuck on load: immediate `_renderShotOverlay` now gated on pre-existing GPS position — avoids race where `_whenStyleLoaded` fires before async GPS resolves
- Fix par 4 tee drag snapping back to straight line: cache full dot slice on 2-shot plans so dragged tee position survives re-render
- Fix 3-shot tee drag snapping: partial caches (length < dots−1) now accepted — tee position preserved while engine re-picks shot2
- Fix approach dot not updating club live during drag: removed `segmentKey &&` guard from incoming label lookup (`segmentKey` is null for approach dot)
- Fix label color mismatch when drag crosses strategy boundary: `_activeStratColor` now set before strategy guard so failed renders can't leave stale color

### Dispersion arc
- Introduced dispersion arc (white, 70% opacity, ±40° sweep) on active scope dot
- Arc center offset `R − 15m` backward from scope so peak sits ~15m beyond crosshair toward target
- `_DRIVER_95` and `_DISP_SCALE` recalibrated to real-world 95th-percentile data (Trackman/Shot Scope) — previous values were ~2× too wide, irons/wedges disproportionately so

---

## 2026-04-24

### Refactor — preparatory in-place changes (Sub-steps A, B, C)
- `[index.html]` **Sub-step A:** `calculate()` split into `readInputsFromDOM()` / `computePlan(inputs)` / `renderPlan(_result)` / thin `calculate()` shell. `computePlan` has zero DOM refs and zero direct storage calls in its own body. Wrapper at L5932 preserved unchanged.
- `[index.html]` **Sub-step B:** `expectedStrokesRemaining` now takes explicit `handicap` and `inRough` parameters. `readInputsFromDOM()` reads `handicap` from `golfProfile_v1` and passes it via inputs. Eliminated implicit `localStorage.getItem('golfProfile_v1')` and `window._inRough` reads inside the function. All 8 call sites updated (through `findBestContinuation` and direct).
- `[index.html]` **Sub-step C:** `windState` made an explicit parameter to all engine functions: `tempCarryFactor`, `applyWind`, `windAdjustedRoll`, `crosswindSide`, `getClubs`, `findBestContinuation`, `expectedStrokesRemaining`. Callers pass the module-level `windState` reference explicitly. All 26 call sites updated.

---

## 2026-04-23

### Calculation engine
- `[calculation-engine.md]` `_holeHcpAdj` now computed before par 3 branch AND before `ordered[]` — previously only before `ordered[]`, causing flat model on par 3 holes
- `[calculation-engine.md]` `driverCarry` defined at top of `calculate()` before par 3 branch — was previously undefined in par 3 scope causing silent tier fallback to worst tier
- `[calculation-engine.md]` `blendedScore` now applied to par 3 `scoreVal3` — was previously omitted
- `[calculation-engine.md]` `findBestContinuation` uses `driverCarry` not `teeClub.carry` — using teeClub carry caused tier mismatch between plans and overrides
- `[calculation-engine.md]` `buildPlanWithShot2Override` applies `blendedScore` — was returning raw model score causing visible score jumps when toggling overrides

### Handicap model
- `[handicap-model.md]` WHS block must be computed before `ordered[]` is built — historical ordering bug caused first-load always using flat fallback

### Wind & temperature
- `[wind-temperature.md]` `tempCarryFactor()` uses `windState.tempC` not `feelsLike` — display showed feels-like but calculation used actual temp, causing label/value mismatch
- `[wind-temperature.md]` Disabling wind now also disables temperature correction — both come from same weather fetch, both should gate on `windState.enabled`
- `[wind-temperature.md]` Removed temperature adjustment from `expectedStrokesRemaining` tier lookup — was causing cross-browser score differences at tier boundaries (219.6 vs 220m)

### Override system
- `[override-system.md]` All overrides now namespaced by `courseId|holeIdx|strategyType` via `_hk()` — previously keyed by strategy type only, causing cross-hole and cross-course bleed
- `[override-system.md]` `_overrideHoleIdx` and `_overrideCourseId` initialised at parse time via IIFE — previously only set inside `calculate()`, causing wrong namespace on first call
- `[override-system.md]` `par3ClubOverrides` keyed by `courseId|holeIdx` — separate from strategy type overrides
- `[override-system.md]` Tapping recommended chip now deletes override (not stores default key) — storing default key caused `buildPlanWithShot2Override` to run unnecessarily with different approach distance
- `[override-system.md]` `buildDeltaSection` and `getActivePlan` now apply shot2Overrides — were showing stale scores in compare card when override was active
- `[override-system.md]` `buildPlanWithShot2Override` result now spreads `type` — missing `type` caused `undefined` in strategy labels in delta section

### Data structures
- `[data-structures.md]` Course IDs changed to 5-digit numeric strings (10000–99999) — legacy `c_timestamp_random` IDs still supported
- `[data-structures.md]` `rough` field is 0/1 flag, counted in total strokes, also sets FIR=false and triggers +0.35 rough penalty in expected strokes

### UI patterns
- `[ui-patterns.md]` Par + Conditions strip hidden when course is active — par/distance already shown in course bar, redundant
- `[ui-patterns.md]` Conditions chips split into two instances: `#condChipRow` (no course) and `#condChipRowWeather` (course active, below Weather header)
- `[ui-patterns.md]` Strategy history section removed from round history — strategy column now inline in scorecard
- `[ui-patterns.md]` Best strategy simplified from expandable drawer to inline compact tag in course bar
- `[ui-patterns.md]` Bottom sheet drag-to-dismiss: listeners now attach to full sheet (not just handle), `touchmove` passive:false, listeners cleaned up on close
- `[ui-patterns.md]` Destructive buttons (delete round): resting state red, armed state filled red + white text, 3s timeout

### Bug fixes (no doc change needed)
- Wind panel `collapsible-body` missing closing `</div>` was hiding entire My Golf tab — fixed
- `calcPar3` was skipping clubs that could reach the hole — now correctly prefers shortest-remaining club
- `renderSavedRounds` rewritten — removed ~400 lines, strategy history section eliminated, round expand now shows stat bar + scorecard inline
- Club picker drag-to-dismiss: accumulated window listeners on every open fixed; `translateY` inline style was overriding CSS class on dismiss fixed

---

## How to add entries

```
## YYYY-MM-DD

- `[docs-file.md]` What changed and why (one line)
- `[CLAUDE.md]` If a non-negotiable rule was added or changed
```

If no doc needed updating, note it under "Bug fixes (no doc change needed)".

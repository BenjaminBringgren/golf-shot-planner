# Calculation Engine

## Responsibilities

Club distance interpolation, plan generation, expected strokes lookup.

---

## Pipeline overview

```
getCarryInputs()
  → interpolate()            — per club, in relCarry space
  → applyWind() / windAdjustedRoll()
  → getClubs()               — sorted club list { carry, baseCarry, total, roll, idx }

getValidTeeClubs()            — filter by par (par 5: long clubs; par 4: up to 7i)

for each tee club:
  findBestContinuation()     — best 1- or 2-shot plan
  → expectedStrokesRemaining()
  → blendedScore()

ordered[] = top 3 plans → Max distance / Balanced / Conservative
```

---

## 1. Club interpolation — `interpolate(driverDist, i7Dist, pwDist, key)`

### Inputs
- `driverDist`, `i7Dist`, `pwDist` — user-entered carry distances (metres)
- `key` — club identifier string

### Output
- Carry distance (metres) for the given club

### Logic
Each club has a `relCarry` (fraction of driver, e.g. 7i = 0.661). Three anchor points are used (driver always included; 7i and PW added if provided). The carry for any club is linearly interpolated between the two anchors that bracket its `relCarry` value. Clubs below the lowest anchor are extrapolated using the lowest segment's slope.

### Assumptions
- Driver `relCarry` = 1.000 always
- If only driver provided: all clubs scale by `relCarry` directly
- Interpolation is in `relCarry` space, not index space — this respects real-world non-uniform gaps

### Edge cases
- If `i7Dist` or `pwDist` is 0/falsy, those anchors are excluded
- Extrapolation below PW is linear — may underestimate for very lofted wedges

---

## 2. Club list — `getClubs(driver, i7, pw)`

### Inputs
- Three carry distances from user inputs
- Reads checked state from `#clubContainer` checkboxes
- Reads conditions from `#conditions` select

### Output
Array of club objects sorted longest-to-shortest total distance:
```js
{ key, carry, baseCarry, total, roll, idx }
```
- `baseCarry` — raw interpolated carry (before wind/temp)
- `carry` — wind+temperature adjusted carry via `applyWind(baseCarry, idx)`
- `roll` — wind-adjusted roll factor via `windAdjustedRoll(baseRoll, idx)`
- `total` = `carry × roll`

### Critical
`baseCarry` is stored separately for wind delta display in the UI. Never use `total` where `carry` is needed for expected strokes — the roll component is irrelevant to approach distance.

---

## 3. Plan generation — `findBestContinuation(teeClub, hole, driverTotal, clubsList, driverCarry)`

### Inputs
- `teeClub` — club object for tee shot
- `hole` — hole length in metres
- `driverTotal` — driver total distance (carry+roll), used for approach ceiling
- `clubsList` — full list of available clubs
- `driverCarry` — player's driver carry (raw, not wind-adjusted) — used as ability tier reference

### Output
```js
{ shots: [club, ...], approach: number, score: number }
```
or `null` if no valid plan exists.

### Logic

**Single-shot path:**
```
singleApproach = hole - teeClub.total
valid if: singleApproach >= 0
      AND singleApproach <= maxApproach (= driverTotal × 0.92)
      AND singleApproach <= longest non-driver club total
score = 1 + expectedStrokesRemaining(singleApproach, driverCarry)
```

**Two-shot path:**
Iterates all non-driver candidates where `c.total < teeClub.total`:
```
approach = hole - teeClub.total - second.total
valid if: approach >= 0 AND approach <= maxApproach
score = 2 + expectedStrokesRemaining(approach, driverCarry)
```
Picks candidate with lowest score.

### Critical rules
- Always use `driverCarry` (not `teeClub.carry`) as the second argument to `expectedStrokesRemaining` — using `teeClub.carry` causes a tier mismatch between plans and overrides, producing score inconsistency
- `maxApproach` uses wind-adjusted `driverTotal` — acceptable minor variation

### Edge cases
- If no valid two-shot plan exists, returns `null`
- Par 3 handled separately via `calcPar3()` — not routed through this function

---

## 4. Par 3 club selection — `calcPar3(clubsList, hole)`

### Inputs
- `clubsList` — available clubs
- `hole` — hole length in metres

### Output
```js
{ club, diff }
```
where `diff` = `hole - club.total` (positive = falls short, negative = overshoots)

### Logic
- **Prefer** clubs that fall short — pick the one with smallest positive `diff` (closest to pin)
- **Fallback** to club with smallest overshoot if nothing reaches
- Driver is not excluded — user may select any club via chip/bag picker override

### Score calculation (in card renderer)
```js
remaining = Math.max(0, hole - s.total)  // 0 if overshoots — treated as on green
scoreVal = 1 + expectedStrokesRemaining(remaining, driverCarry)
```
Overshoot clubs show negative distance in amber with "Overshoots — spin back" note.

---

## 5. Expected strokes lookup — `expectedStrokesRemaining(approachDist, driverCarry)`

### Inputs
- `approachDist` — distance to pin in metres
- `driverCarry` — raw driver carry for tier lookup

### Output
- Expected strokes to hole out (float)

### Lookup table

```
Tiers (by driver carry):  < 195  |  195–220  |  220–250  |  250+
Bands (approach dist):
  0–60m                    2.95     2.80        2.65       2.55
  60–100m                  3.10     2.95        2.75       2.60
  100–130m                 3.30     3.10        2.90       2.70
  130–160m                 3.55     3.30        3.10       2.85
  160–190m                 3.80     3.55        3.30       3.00
  190m+                    4.05     3.80        3.55       3.20
```

Tier lookup: `tiers.findIndex(t => driverCarry < t)` — uses raw driver carry, never temperature-adjusted (prevents float boundary flips across browsers).

### Adjustments applied in order

1. **HCP adjustment** (`_holeHcpAdj`) — read from module-level variable set before `ordered[]` is built. See `docs/handicap-model.md`
2. **Wind adjustment** — `±0.04 strokes/m/s` effective headwind, capped ±0.15/+0.25. Only when `windState.active && windState.enabled`
3. **Rough penalty** — `+0.35` when `window._inRough || _inRough` is true

### Critical ordering requirement
`_holeHcpAdj` must be set **before** `ordered[]` is built in `calculate()`. Setting it after means the first call always uses the flat fallback model regardless of course data. This has been a recurring bug.

---

## 6. Personal baseline blending — `blendedScore(modelScore, courseId, holeIdx)`

### Inputs
- `modelScore` — raw expected strokes from model
- `courseId`, `holeIdx` — identifies which hole's baseline to use

### Output
```js
{ score: number, blended: boolean, rounds?: number, weight?: number }
```

### Logic
```
weight = min(1, (rounds - 5) / 7)   // 0 at 5 rounds, 1 at 12+
score  = modelScore × (1 - weight) + avgActualScore × weight
```
Returns `{ score: modelScore, blended: false }` if fewer than 5 rounds of data.

### Must be applied in three places
1. `ordered[]` loop after plans are scored
2. Inside `buildPlanWithShot2Override()` — on the raw score before returning
3. Inside `buildDeltaSection()` and `getActivePlan()` in `buildCompareTable()` — when resolving overridden plans

Applying in only some paths causes visible score inconsistency when switching between override and non-override states.

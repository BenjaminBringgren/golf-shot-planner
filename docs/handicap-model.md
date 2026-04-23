# Handicap Model

## Responsibilities

Computing per-hole HCP stroke adjustments using WHS (World Handicap System) or a flat fallback model.

---

## Inputs

From `localStorage` (`golfProfile_v1`):
- `handicap` — player's HCP Index (float, e.g. 8.4)

From the active course (`golfCourses_v1[id]`):
- `courseRating` — CR (float, e.g. 72.1)
- `slopeRating` — Slope (integer, e.g. 125)
- `holes[i].si` — stroke index for each hole (1–18)
- `holes[i].par` — par for each hole

From session:
- `activeCourse.holeIdx` — which hole is currently active

---

## Output

`_holeHcpAdj` — module-level variable (integer, 0, 1, or 2).

- `null` — no course/profile data; use flat fallback inside `expectedStrokesRemaining`
- `0` — WHS model fired; this hole gets no extra stroke
- `1` — this hole gets 1 stroke (most common for mid-handicappers)
- `2` — this hole gets 2 strokes (high handicappers, SI ≤ playingHcp % 18)

---

## WHS Formula

```
playingHcp = round(hcpIndex × (slope / 113) + (CR − coursePar))
```

Where `coursePar` = sum of all 18 hole pars (not a fixed 72).

### Stroke allocation per hole

```
fullRounds = floor(playingHcp / 18)
remainder  = playingHcp % 18
strokes    = fullRounds + (holeSI <= remainder ? 1 : 0)
```

### Examples

| HCP Index | Slope | CR | Par | Playing HCP | Hole SI | Strokes |
|---|---|---|---|---|---|---|
| 8.0 | 125 | 72.0 | 72 | 9 | 7 | 1 |
| 8.0 | 125 | 72.0 | 72 | 9 | 10 | 0 |
| 28.0 | 125 | 72.0 | 72 | 31 | 13 | 2 |
| 28.0 | 125 | 72.0 | 72 | 14 | 1 |

---

## Flat fallback model

Used when WHS model cannot fire (missing CR, Slope, or any SI value):

```
hcpAdj = min(hcpIndex × 0.056, 3.0)
```

Applied uniformly to every hole. Less accurate than WHS — overestimates on easy holes, underestimates on hard ones. Acceptable when course data is incomplete.

---

## Activation conditions

WHS model fires only when ALL of the following are true:
- Player has a valid `handicap` index (> 0, not NaN)
- Course has `courseRating` > 0
- Course has `slopeRating` > 0
- Course has exactly 18 holes each with `si` between 1 and 18 (no missing or zero values)

If any condition fails, `_holeHcpAdj` is set to `null` and `expectedStrokesRemaining` uses the flat fallback.

---

## Timing requirement

`_holeHcpAdj` must be set **before** `ordered[]` is built in `calculate()`. The variable is read inside `expectedStrokesRemaining` which is called during plan scoring. Setting it after means every first call uses the flat model regardless of course data.

The code block that sets `_holeHcpAdj` also sets `_blCourseId` and `_blHoleIdx` (needed for baseline blending) — these must all be computed together, before plan generation begins.

---

## Edge cases

- **Partial SI data** — if some holes have SI and others don't, the WHS model does not fire at all. It's all-or-nothing per course. A partial course will always use flat fallback.
- **Playing HCP > 18** — correctly handled: `fullRounds = 1`, some holes get 2 strokes
- **Playing HCP = 0** — no strokes on any hole (`_holeHcpAdj = 0`)
- **Negative playing HCP** (scratch+ players) — formula naturally produces 0 or negative; `_holeHcpAdj` is set to 0 minimum in practice (scratch gives 0 strokes, plus is not modelled)

# Wind & Temperature

## Responsibilities

Adjusting club carry distances and roll factors for wind and air temperature. All adjustments gate on `windState.enabled`.

---

## windState object

```js
{
  speedMs:   number | null,  // sustained wind speed m/s at 10m height
  gustMs:    number | null,  // gust speed m/s
  dirDeg:    number | null,  // wind FROM direction (meteorological convention)
  holeDeg:   number | null,  // hole playing direction (where ball travels)
  headwind:  number | null,  // computed component (+head, −tail)
  crosswind: number | null,  // computed magnitude
  active:    boolean,        // true once both speed+direction are known
  enabled:   boolean,        // user toggle
  tempC:     number | null,  // actual air temperature °C
  feelsLike: number | null,  // apparent temperature (display only)
  rainPct:   number | null   // precipitation probability %
}
```

`active` is set to `true` by `computeWindComponents()` and never reset to false. Disabling uses `enabled`.

---

## `computeWindComponents()`

### Inputs
- `windState.speedMs`, `windState.dirDeg`, `windState.holeDeg`

### Output
Sets `windState.headwind` and `windState.crosswind`, sets `windState.active = true`.

### Formula
```
angleDeg = windState.dirDeg - windState.holeDeg
headwind  = speedMs × cos(angleDeg)   // positive = into player (headwind)
crosswind = |speedMs × sin(angleDeg)|
```

---

## `tempCarryFactor()`

### Input
- `windState.tempC` — actual measured air temperature (NOT feelsLike)

### Output
- Carry multiplier (float, 1.0 at 15°C standard)

### Formula
```
densityRatio = 288.15 / (273.15 + tempC)   // >1 cold, <1 warm
factor = 1 − (densityRatio − 1) × 0.55
```

### Calibration
- 4°C → factor ≈ 0.978 → −5m on 230m driver
- 15°C → factor = 1.000 → no effect
- 28°C → factor ≈ 1.024 → +5.5m on 230m driver

### Critical
Uses `windState.tempC` (actual air temperature), never `windState.feelsLike`. Feels-like accounts for human wind chill perception — irrelevant to air density and ball flight.

---

## `applyWind(carry, clubIdx)`

### Inputs
- `carry` — base carry distance (metres)
- `clubIdx` — index in `clubOrder` array (determines wind category)

### Output
- Adjusted carry distance (metres)

### Logic
```
if (!windState.enabled) return carry                    // wind off → no adjustment at all
tempAdj = carry × tempCarryFactor()                     // temperature correction
if (!windState.active) return tempAdj                   // no wind data yet
hw = windState.headwind × ALT_FACTORS[category]         // altitude-correct to trajectory height
if hw >= 0: return tempAdj − hw × WIND_ADJ[cat].head   // headwind reduces carry
else:       return tempAdj + |hw| × WIND_ADJ[cat].tail  // tailwind adds carry
```

Disabling wind (`!windState.enabled`) skips temperature correction too — both come from the same weather fetch, both should be off together.

### Wind categories and altitude factors

| Category | Clubs | Peak height | ALT_FACTOR |
|---|---|---|---|
| `driver_fw` | driver, fw3, fw5, fw7 | ~35m | 1.20 |
| `hybrid_long` | u2, u3, u4, 4i | ~28m | 1.16 |
| `mid_iron` | 5i, 6i, 7i | ~22m | 1.12 |
| `short_iron` | 8i, 9i, pw | ~18m | 1.07 |
| `wedge` | 50°–60° | ~14m | 1.03 |

### Wind adjustment coefficients (metres per m/s)

| Category | Headwind | Tailwind |
|---|---|---|
| `driver_fw` | 2.5 | 1.2 |
| `hybrid_long` | 2.2 | 1.0 |
| `mid_iron` | 2.0 | 0.9 |
| `short_iron` | 1.8 | 0.8 |
| `wedge` | 1.5 | 0.5 |

Headwind penalises more than tailwind helps — aerodynamic asymmetry from Trackman data.

---

## `windAdjustedRoll(baseRoll, clubIdx)`

### Inputs
- `baseRoll` — base roll multiplier from conditions (soft/firm)
- `clubIdx` — determines altitude factor

### Output
- Adjusted roll multiplier (float, floored at 1.0, ceilinged at 1.6)

### Formula
```
hw = windState.headwind × ALT_FACTORS[category]
if hw >= 0: adjusted = baseRoll × (1 − 0.022 × hw)   // headwind → steeper landing → less roll
else:       adjusted = baseRoll × (1 + 0.011 × |hw|)  // tailwind → flatter → more roll
return clamp(adjusted, 1.0, 1.6)
```

Physical basis: headwind steepens descent angle → ball lands steeper → less roll. Asymmetric coefficients (0.022 head vs 0.011 tail) from Trackman data.

### Gate
Returns `baseRoll` immediately if `!windState.active || !windState.enabled`.

---

## Wind effect on expected strokes

Inside `expectedStrokesRemaining`:

```
altFac = ALT_FACTORS['mid_iron']  // approach shots treated as mid-iron trajectory
hw = windState.headwind × altFac
penalty = hw × 0.04               // strokes per m/s of effective headwind
windAdj = clamp(penalty, −0.15, +0.25)
```

Only applied when `windState.active && windState.enabled`. Cap prevents runaway values at extreme wind speeds.

---

## Display rules

- **Temperature · carry cell** in weather breakdown: shows `tempC` and carry delta on a notional 230m driver
- **Wind strip text**: shows `feelsLike` in header for player comfort reference only
- Never display `feelsLike` as the input to any carry calculation

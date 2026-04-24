# Golf Shot Planner — Storage Schema

All localStorage and sessionStorage access is owned exclusively by `src/storage/storage.js`. No other module reads or writes these keys directly — they call functions on the storage module.

## localStorage Keys

| Key | Shape | Owned by |
|---|---|---|
| `golfBag_v2` | `{ checked[], driver, i7, pw, conditions }` | `src/storage/storage.js` |
| `golfCourses_v1` | `Course[]` with `holes[{par, si, length, note}]`, `courseRating`, `slopeRating` | `src/storage/storage.js` |
| `golfRounds_v1` | `Round[]` with per-hole scores + strategies | `src/storage/storage.js` |
| `golfProfile_v1` | `{ name, handicap, homeCourse }` | `src/storage/storage.js` |
| `golfWind_v1` | Wind state object | `src/storage/storage.js` |
| `windEnabled` | Bool | `src/storage/storage.js` |
| `golfTee_v1` | Tee preference | `src/storage/storage.js` |

**Key rule:** Each key must be owned by exactly one module. No other module reads or writes it directly — they call functions on the owning module.

## sessionStorage Keys

| Key | Shape | Owned by |
|---|---|---|
| `activeCourse` | `{ id, holeIdx }` | `src/storage/storage.js` |
| `committedStrategies` | `{ holeIdx: 'Max distance · Driver', ... }` | `src/storage/storage.js` |
| `roundScores_<courseId>` | In-progress round scores per course | `src/storage/storage.js` |

## Safari sessionStorage Warning

Safari aggressively purges sessionStorage when the app is backgrounded for >~30 seconds. The existing handling logic must be preserved exactly when moving to `src/storage/storage.js` — do not change the read patterns, only relocate them.

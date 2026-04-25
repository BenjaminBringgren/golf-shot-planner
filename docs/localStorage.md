# Golf Shot Planner — Storage Schema

All localStorage and sessionStorage access is owned exclusively by `src/storage/storage.js`. No other module reads or writes these keys directly — they call the exported functions below.

## localStorage Keys

| Key | Constant | Shape | Read fn | Write fn |
|---|---|---|---|---|
| `golfBag_v2` | `KEY_BAG` | `{ checked[], driver, i7, pw, conditions }` | `loadBag()` | `saveBag(data)` |
| `golfCourses_v1` | `KEY_COURSES` | `{ [id]: Course }` with `holes[{par, si, length, note}]`, `courseRating`, `slopeRating` | `loadCourses()` | `saveCourses(data)` |
| `golfRounds_v1` | `KEY_ROUNDS` | `{ [courseId]: Round[] }` with per-hole scores + strategies | `loadRounds(courseId)` | `saveRound(courseId, data)` / `deleteRound(courseId, idx)` / `deleteAllRoundsForCourse(courseId)` |
| `golfProfile_v1` | `KEY_PROFILE` | `{ name, handicap, homeCourse, scoringMode }` | `loadProfile()` / `getScoringMode()` | `saveProfile(data)` |
| `golfWind_v1` | `KEY_WIND` | `{ holeDeg }` | `loadWindPrefs()` | `saveWindPrefs(holeDeg)` |
| `windEnabled` | `KEY_WIND_ENABLED` | `'true'` \| `'false'` (string) | `loadWindEnabled()` | `saveWindEnabled(bool)` |
| `golfTee_v1` | `KEY_TEE` | Tee state snapshot | `loadTeeState()` | `saveTeeState(data)` / `clearTeeState()` |
| `roundScores_<courseId>` | built by `_scoresKey()` | `Array(18)` of scores or null | `loadScores(courseId)` | `saveScores(courseId, scores)` / `clearScores(courseId)` |
| `committedStrategies_<courseId>` | built by `_csKey()` | `{ [holeIdx]: strategyString }` | `getCommittedStrategies(courseId)` | `setCommittedStrategies(courseId, obj)` / `removeCommittedStrategies(courseId)` |
| `collapse_<sectionId>` | built by `_collapseKey()` | `'open'` \| `'closed'` (string) | `loadCollapseState(sectionId)` | `saveCollapseState(sectionId, value)` |

## sessionStorage Keys

| Key | Constant | Shape | Read fn | Write fn |
|---|---|---|---|---|
| `activeCourse` | `KEY_ACTIVE_COURSE` | `{ id, holeIdx }` | `loadActiveCourse()` / `getActiveCourseId()` | `saveActiveCourse(id, holeIdx)` / `clearActiveCourse()` |

## Notes

**roundScores uses localStorage (not sessionStorage).** An earlier version of these docs described round scores as sessionStorage. They are localStorage in the current codebase, which means they survive app backgrounding on iOS.

**Safari sessionStorage warning:** Safari aggressively purges sessionStorage when the app is backgrounded for >~30 seconds. `loadActiveCourse()` returns `{}` on parse failure and all callers guard against missing `.id`. Do not change these read patterns.

**Key rule:** Each key is owned by exactly one module. No other module reads or writes it directly.

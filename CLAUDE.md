# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Golf Shot Planner

## What this app is

A single-file mobile web app for golf shot planning, used on-course on iPhone. It recommends club strategies per hole, tracks GPS shot positions, logs rounds, and analyses performance over time. No internet required during play (weather is pre-fetched).

---

## The file

`index.html` — ~8300 lines, ~400KB. No build step. No dependencies. No frameworks.

**Copyright header required at top of every output:**
```
/* Copyright © 2025 Benjamin Bringgren. All rights reserved. Unauthorised copying or distribution is prohibited. */
```

---

## Architecture

Two `<script>` blocks inside one HTML file:

| Block | Scope | Contains |
|---|---|---|
| Script 0 | `DOMContentLoaded` closure | `calculate()`, GPS, wind, carousel, club picker, course bar |
| Script 1 | `prepare-module` `'use strict'` | My Golf tab, stats, rounds, courses, score entry |

Cross-scope rule: functions needed by both blocks go on `window.*` via explicit assignment. Never use `Object.defineProperty` on `window` — Safari bug.

Two tabs: **Play** (`#panePlay`) and **My Golf** (`#panePrepare`). Tab switching: `window.switchTab('play' | 'prepare')`.

---

## How Claude should behave

- **No scope creep.** Implement exactly what is specified. Nothing more.
- **Grep before replacing.** Use Python `str.replace` with `assert s.count(old) == 1`.
- **Syntax-check after every change.** See procedure below.
- **Trace data flow before proposing a fix.** Do not guess at the source of a bug.
- **Verify numerically.** For any calculation change, construct a Python test case and confirm the result before touching JS.
- **Find all call sites.** Changes to `blendedScore`, `expectedStrokesRemaining`, or override namespacing affect multiple locations — find every one before editing any.
- **Mockup before implementing** any UI change affecting layout or information hierarchy.
- **Test on both Safari and Brave** (iPhone). Cross-browser differences have caused production bugs.

---

## Syntax check procedure

```python
import re
with open('index.html', 'r') as f:
    content = f.read()
scripts = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
s1 = scripts[1]
with open('/tmp/s1.js', 'w') as f:
    f.write("'use strict';\n" + s1[s1.index("'use strict';"):])
```
```bash
node --check /tmp/s1.js
```

Also check div balance when touching HTML:
```python
segment = content[start:end]
assert segment.count('<div') == segment.count('</div>')
```

---

## Non-negotiable rules

1. `_holeHcpAdj` must be set **before** `ordered[]` is built in `calculate()`
2. Always pass `driverCarry` (not `teeClub.carry`) to `expectedStrokesRemaining`
3. `blendedScore` must be applied in **three** places: `ordered[]` loop, `buildPlanWithShot2Override`, `buildDeltaSection`/`getActivePlan`
4. All overrides keyed via `_hk(type)` — never bare strategy type strings
5. `tempCarryFactor()` uses `windState.tempC` — actual air temp, never `feelsLike`
6. Disabling wind disables temperature correction too — both gate on `windState.enabled`
7. The wind panel nests 3 levels deep — a missing `</div>` on `collapsible-body` hides the entire My Golf tab

---

## Key functions

| Function | Location | Notes |
|---|---|---|
| `calculate(clearOverrides?)` | Script 0 | Main entry — wrapped by prepare-module |
| `findBestContinuation()` | Script 0, global | → see `docs/calculation-engine.md` |
| `expectedStrokesRemaining()` | Script 0, global | → see `docs/calculation-engine.md` |
| `applyWind()` / `tempCarryFactor()` | Script 0, global | → see `docs/wind-temperature.md` |
| `buildPlanWithShot2Override()` | Script 0, inside calculate | Must call `blendedScore`, spread `type` on result |
| `buildStrategyCard()` | Script 0, inside calculate | Closure over `ordered`, `clubsList`, `hole`, `parValue` |
| `renderPlayCourseBar()` | Script 1 | Injected as first child of `#panePlay` |
| `renderSavedRounds()` | Script 1 | Replaces `#savedRoundsSection` |
| `renderScoreEntry()` | Script 1 | Score drawer, called after `calculate()` via wrapper |
| `updateHoleCardMode()` | Script 0 | Controls course-active state, shows/hides strips |

---

## Module reference

| Task | Use |
|---|---|
| Distance calculation, club interpolation, plan scoring | `docs/calculation-engine.md` |
| Handicap adjustment, WHS formula, stroke allocation | `docs/handicap-model.md` |
| Wind, temperature, carry adjustment, roll adjustment | `docs/wind-temperature.md` |
| Club overrides, namespacing, lifecycle | `docs/override-system.md` |
| UI components, design tokens, iOS patterns | `docs/ui-patterns.md` |
| Storage keys, course/round/score data shapes | `docs/data-structures.md` |

---

## Storage quick reference

```
localStorage:  golfBag_v2, golfCourses_v1, golfRounds_v1, golfProfile_v1,
               golfWind_v1, golfTee_v1, roundScores_<id>, committedStrategies_<id>, windEnabled
sessionStorage: activeCourse → { id: string, holeIdx: number }
```

Full schemas: → `docs/data-structures.md`

---

## Keeping docs current

After any session that changes a formula, fixes a bug in a core system, or establishes a new pattern:

1. Identify which `docs/` file owns that concern — use the module reference table above
2. Update the relevant section (inputs, outputs, logic, edge cases, assumptions)
3. If a new "never do X" rule emerges from a bug, add it to the Non-negotiable rules in this file
4. Add an entry to `CHANGELOG.md` — one line per change, date-stamped
5. Commit doc changes in the same commit as the code changes

### Trigger phrases

If any of these apply at the end of a session, docs need updating:

- A formula or coefficient was changed
- A bug was caused by incorrect ordering of operations
- A new edge case was discovered and handled
- A UI pattern was established or changed
- A "do not do X" rule was learned from a real bug
- A data structure field was added, removed, or reinterpreted

### Review prompt (run periodically)

Every 10 sessions or when something feels off:

> "Read `docs/<relevant-file>.md` and the corresponding code in `index.html`. List any discrepancies between what the doc describes and what the code actually does."

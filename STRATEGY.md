# Strategic Pre-Launch Analysis — Golf Shot Planner
_Analysis only. No code changes._

---

## Context

The app is functionally complete as a shot-planning + scoring tool. Before App Store submission it needs a clear strategic identity, a frictionless onboarding path, and a round-summary experience that creates a retention hook. The goal of this document is to audit what exists, identify gaps, and define the strategic angle.

---

## 1. What the App Currently Does Well

| Strength | Why it matters |
|---|---|
| Trackman-validated carry interpolation from 3 clubs | No hardware required — lowers barrier to entry |
| **Real-time wind + conditions shot planning** | **Genuinely unique — see section 1a below** |
| Expected strokes remaining per lie | Pre-shot decision support, not just tracking |
| Committed strategies per hole | Creates a loop: plan → execute → review |
| Personal baseline (per-hole avg vs par, 5+ rounds) | Strongest retention hook once unlocked |
| Stableford + stroke play | Covers the dominant casual format in many markets |
| Lie sequence tracking (tee/fw/rough/sand/penalty) | Raw material for stroke-loss attribution |

### 1a. The Wind Calculation Is a Real Differentiator

This deserves more prominence than the table above gives it. The current implementation:
- Fetches live wind from Open-Meteo (real weather API, not a manual slider)
- Uses GPS + Nominatim to reverse-geocode the user's exact location
- Computes headwind/tailwind/crosswind components against the compass-locked hole bearing
- Applies Trackman-derived carry adjustments per wind component
- Adds temperature correction to carry distance
- Locks the compass to hole direction so wind effect re-computes automatically as the player walks the fairway

**No other app in the no-hardware segment does this.** Competitors (18Birdies, Hole19, The Grint) show GPS distances to flag. Some show raw wind speed from a weather widget. None compute *shot-specific* carry adjustment from live wind resolved against the actual hole direction. Arccos does something similar but it's buried in a $99/yr subscription and tied to sensor hardware.

This is a genuine moat. It should be in the App Store screenshots, in the onboarding flow, and in the marketing copy — not hidden behind a collapse toggle on the Play screen.

---

## 2. Competitor Landscape

| App | Core angle | Hardware? | Subscription? | Wind planning? | Gap they leave |
|---|---|---|---|---|---|
| Arccos Caddie | Auto shot detection, AI caddie | Yes (sensors) | Yes ($99/yr) | Basic (subscription) | Stats without actionable fixes, hardware required |
| Shot Scope | Auto GPS + stats | Yes (watch) | No | No | Hardware gates the audience |
| Garmin Golf | Course maps, GPS yardages | Yes (watch) | Partial | No | No improvement coaching |
| 18Birdies | Full-featured GPS scoring | No | Freemium | Widget only (no shot calc) | Feature bloat, no focus |
| The Grint | Handicap + social | No | Freemium | No | Community focus, weak improvement loop |
| Hole19 | GPS scoring + stats | No | Freemium | No | Stat tracking only |

**The gap:** Every competitor tells you *what happened*. None tell you *why* and *what specific behavior to change*. More importantly: **none compute shot-specific wind carry adjustment from live weather resolved against hole direction** — without hardware or a subscription. That is this app's primary technical moat.

---

## 3. Strategic Twist — "The Improvement Loop"

Most golf apps are scorecard apps with GPS bolted on. This app already has something none of them have: **a shot planner that runs before the shot**. The strategic twist is to close the loop:

> **Plan → Execute → Measure → Show exactly where shots were lost → Feed that back into next round's plan.**

This positions the app as the only tool that connects pre-shot strategy to post-round outcome. The tagline might be: *"Stop tracking your scores. Start improving them."*

This is defensible because:
1. The shot planner is already built and validated against Trackman data.
2. The lie sequence data already captures enough to attribute stroke loss.
3. No other no-hardware, no-subscription app does this.

---

## 4. Onboarding — Time to First Value

### Current flow
1. Splash screen: enter driver carry distance → "Get started →"
2. Tab bar appears. No guidance.
3. To play: must navigate to Play → select course → but no courses exist.
4. Must go to My Golf → My Courses → add course manually (name, rating, slope, 18 holes of par/SI/length).
5. Come back to Play → select course → start round.

### Verdict: First-value latency is too high for the "play a round" path

The calculator (manual mode) is immediately usable — enter par/length/wind → get shot plan. That's ~20 seconds to first value if you guide the user there. But the scoring/improvement loop — which is the retention hook — requires a manually entered course. There is no course database.

### Specific friction points for a first-time user

| Friction | Severity | Status |
|---|---|---|
| ~~No course database — full 18-hole manual entry required~~ | ~~Critical~~ | **Solved by course API** |
| Splash only captures driver carry, no value proposition shown | High | To address |
| Stats dashboard is empty until rounds are played | High | To address |
| Personal Baseline requires 5+ rounds — long feedback delay | High | To address |
| Distances in meters only — many golfers think in yards | Medium | To address |
| No tooltips for GIR, FIR, Scrambling on first encounter | Medium | To address |
| Profile setup (name/handicap) feels like homework | Low | Low priority |

### Course API — what it unlocks

Removing the manual course entry wall changes the entire onboarding story:
- User searches for their home course, selects it, starts playing. Under 60 seconds.
- Course data (par, length, SI per hole, rating, slope) arrives pre-filled.
- Removes the single biggest reason a new user would bounce before their first round.

**Dream scenario — hole layout + shot landing visualisation**

Once hole geometry data is available (tee position, green position, hazard polygons), the shot planner can overlay the expected carry/roll zone on a birds-eye hole map. The user sees *where the ball will likely land* given their club selection, wind, and conditions — not just a distance number. They can visually compare strategies (lay up vs. cut the corner) on the actual hole shape.

This closes the loop completely: live wind → computed carry → visual placement on hole layout → commit strategy → score the outcome. No competitor does this without hardware. This is the Phase 3 feature that transforms the app from "shot calculator" to "caddie."

Data requirements for the hole layout feature:
- Hole outline/fairway polygon
- Hazard polygons (water, OB, bunkers)
- Green position + shape
- Tee box coordinates (already captured via GPS tee lock)

APIs to evaluate: Golf Course API, GOLFBERT, OpenStreetMap golf course layer, or a commercial course data provider.

### Onboarding improvements to prioritize

**A. Course API search as the default start**
"Search for your course" replaces "create a course manually." First impression is now a search box, not a data entry form. This alone changes the perceived effort from "this is complicated" to "this is instant."

**B. Instant calculator path as the secondary hook**
Users who want to skip setup entirely can open the manual calculator — pre-filled with a sample scenario (par 4, 380m, 10 m/s headwind) — and see a shot plan in under 30 seconds. Lets them feel the wind calculation before committing to anything.

**C. Yards/meters toggle**
In bag setup and the calculator. Store preference. This de-gates the US/UK audience who default to yards.

**D. Deferred profile — progressive disclosure**
Don't ask for name/handicap upfront. Surface it only when the user tries to enable net scoring. Keep the "?" avatar but add a micro-CTA: "Add your handicap to unlock net scores."

**E. Empty state as a preview**
The stats page empty state should show greyed-out example stats ("After your first round, you'll see...") rather than a blank screen. This sets expectation and motivation.

---

## 5. Round Summary — From Data Display to Improvement Coaching

### What the current round-complete overlay shows
- Score vs par, GIR%, FIR%, Putts, Scrambling%, PAR%
- Score distribution (birdie/par/bogey/double counts)
- Full 18-hole scorecard with running total

### What it doesn't do
It presents data. It does not interpret it. The user sees "GIR 44%" and has no idea if that's good, what caused it, or what to do differently.

### The improvement coaching layer — what's already computable from existing data

The lie sequence per hole (`shots: ['tee', 'rough', 'rough', 'green']`) combined with GIR, FIR, putts, and score gives enough to compute:

**Stroke-loss attribution (can be computed today):**

| Insight | Data required | Already stored? |
|---|---|---|
| Avg score when FIR vs not FIR | fir flag + total score per hole | Yes |
| Avg putts when GIR vs not GIR | gir flag + putts | Yes |
| Penalty stroke frequency | penalties count per hole | Yes |
| Scrambling success rate | gir=false + putts=1 | Yes (computed) |
| Which par type costs most strokes | par + score per hole | Yes |
| Rough shots per round (approach quality proxy) | shots array lie count | Yes |
| Hole-by-hole vs personal baseline | baseline + current round | Yes (5+ rounds) |

**What this enables — post-round insight cards:**

Instead of showing raw stats, show 2–3 insight cards:

> "You lost 4 strokes to missed fairways today — your avg score when hitting FIR was par, when missing it was +1.4."

> "3 three-putts cost you ~3 strokes. All came after missing the green."

> "Your Par 5 avg today was +1.5 — your worst par type. You made par or better on 0 of 4."

These are all computable today from existing data, no new tracking required.

**What requires new data capture to do properly:**

| Insight | Missing data |
|---|---|
| Club selection effectiveness | Club not stored per shot |
| Approach distance accuracy | Shot distance not stored |
| Short game (10–30m) performance | Distance to flag not stored |
| Strategy effectiveness (lay up vs go for it) | Strategies stored but not correlated to hole score |

The committed strategies (`committedStrategies_{courseId}`) are already stored per hole. Cross-referencing strategy choice (conservative/aggressive) with actual hole score is already possible but never computed. This is a near-zero-cost insight unlock.

---

## 6. Data Hooks — What Creates Retention

Ranked by expected retention impact:

| Hook | Current state | Potential |
|---|---|---|
| Personal baseline (hole-by-hole avg vs par) | Exists, 5+ round gate | Strong — very personalized |
| Round vs personal baseline comparison | Not built | Very strong — shows improvement |
| Improvement streak ("3 rounds below your avg") | Not built | Moderate — gamification |
| "You beat your best score" notification | Not built | Moderate — celebration moment |
| Pre-round focus prompt | Not built | High — behavioral priming |
| Strategy vs outcome correlation | Partial (per-hole hint only) | High — unique to this app |
| GIR trend (getting better/worse over time) | Sparkline only | Moderate — needs trend annotation |

The highest-impact unlock with zero new data capture: **round-vs-personal-baseline comparison** and **strategy effectiveness**. Both use data already stored.

### 6a. Personal Baseline — Lower the 5-Round Gate

**Code location:** `src/app/courses.js:67` — `if (data.count < 5) return null`

Currently shows a "—" dash for any hole with fewer than 5 rounds. The 5-round minimum means a player needs nearly a full season before any baseline appears. Recommended change: lower to **3 rounds**. Three rounds is enough signal to show a directional average; a "low sample" visual indicator (lighter colour, asterisk) communicates uncertainty without hiding the data entirely. The display rendering is in `src/app/rounds.js:819-822`.

### 6b. Round vs Personal Baseline Comparison

**Code location:** No existing code. Insert into `src/ui/scorecard.js` in the `showRoundCompleteOverlay()` save button handler (~line 1393), immediately after the `roundData` object is assembled and before `saveRound()` is called.

**Logic:**
- For each hole in `roundScores`, call `computeHoleBaseline(courseId, holeIdx)` from `courses.js`
- Compute `delta = holeScore.total − baseline.avgScore` per hole
- Aggregate to a round-level delta: "You scored X strokes better/worse than your baseline today"
- Display as a hero stat in the round-complete overlay alongside vs-par
- Store as `baselineVsRound` in the round object for trend tracking

**Edge cases:** If fewer than 3 holes have baseline data (first few rounds), suppress the comparison rather than show a misleading number.

### 6c. Pre-Round Focus Prompt

**Code location:** No existing code. Injection point is `src/app/courses.js:loadCourseIntoPlay()` between lines 96–98, after `saveActiveCourse()` but before `applyHoleToPlay()`. Alternatively inject as a dismissible card in `src/app/router.js` when `switchTab('play')` fires with an active course.

**Logic:** Read last 3–5 rounds, run the stroke-loss attribution (section 7), find the biggest single leak, and surface it as a one-line prompt before hole 1:

> "Last 3 rounds: 3-putts are costing you ~2 strokes/round. Focus on lag putting today."

Dismissed with a single tap. Should not show if player has 0 rounds at this course.

### 6d. Strategy vs Outcome Correlation — Full-Round Analysis

**Existing code:** `src/ui/scorecard.js:588-629` — `renderLastRoundHint(holeIdx)` already reads all saved rounds, groups hole scores by committed strategy, and computes avg vs par per strategy. It displays a "Best here: [strategy]" hint on the hole scorecard during play.

**What's missing:** This logic runs per-hole on demand. It is never run across the full round to produce a summary insight.

**To build:** Extract the correlation logic into a standalone function in `src/app/rounds.js`, call it after save, and render in the round-complete overlay:

> "When you play Conservative off the tee, your avg score on Par 4s is +0.4. Aggressive: +1.1. Conservative works for you."

Strategy values are strings like `"Max distance · Driver"` or `"Controlled"`. `decodeStrategy()` in `src/engine/calculations.js:265` parses them. The full round's strategies are already saved in every `roundData.strategies` object in `golfRounds_v1`.

---

## 7. Identifying Where Strokes Are Lost — The Core Value Proposition

The app already captures everything needed to answer: *"Where are you losing strokes?"*

The framework (compute from existing data):

```
Stroke loss = (actual score on hole) − (par)

Attribute to:
  Tee shot:    if fir === false on par 4/5 → tee accuracy cost
  Approach:    if gir === false → approach cost
               (further split by fir: missed FIR + missed GIR = both issues)
  Short game:  if gir === false && putts <= 2 → scrambling (recovered)
               if gir === false && putts > 2 → short game + putting cost
  Putting:     putts > 2 on any hole → putting cost
  Penalty:     penalties > 0 → penalty cost
```

This produces a "stroke-loss waterfall" per round and across rounds:
- "Over your last 5 rounds, 40% of your over-par holes were caused by approach shots after missing the fairway."
- "Putting accounts for 1.8 strokes/round above baseline — the single biggest opportunity."

This is the unique insight no competitor produces without hardware or subscription.

---

## 8. Translating Data Into Behavioral Change

The round summary should end with a single, specific "focus for next round":

| Pattern detected | Behavioral recommendation |
|---|---|
| FIR% < 40% and stroke-loss correlates with tee shots | "Hit driver to the fairway on every par 4. Club down if needed." |
| 3-putt rate > 25% | "On approach shots, aim for the fat part of the green, not the flag." |
| GIR% < 35% | "From 150m+, prioritize laying up to your favorite wedge distance." |
| Scrambling < 30% | "Practice 10–30m chip shots — you're not getting up-and-down." |
| Strong Par 3 but weak Par 5 | "Aggressive Par 5 decisions are costing strokes. Consider laying up." |

One recommendation, specific, actionable, derived from their actual data. This is the difference between a tracking app and a coaching app.

---

## 9. Priority Summary

**Phase 1 — Pre-launch (use existing data, no new tracking):**
1. Round-complete overlay: replace raw stats with 2–3 stroke-loss insight cards
2. Post-round "one focus for next round" recommendation
3. Strategy vs outcome correlation (data already stored, never computed)
4. Onboarding: route new user directly to live calculator demo, pre-filled scenario
5. Empty state: stats preview with greyed-out example data

**Phase 2 — Early post-launch (infrastructure + market reach):**
6. Course API integration — search & select real courses, no manual entry
7. Yards/meters toggle throughout
8. Round vs personal baseline delta view ("You're 1.2 strokes better than your avg today")
9. Pre-round focus prompt based on last-round pattern

**Phase 3 — Differentiation (the moat):**
10. Hole layout visualisation — shot landing overlay on course map using course API geometry
11. Club selection per shot (unlocks distance-band and club-specific analysis)
12. Improvement streak / milestone gamification

---

## 10. Strategic Identity

**One sentence:**
> "Golf Shot Planner is the only no-hardware, no-subscription app that computes your shot carry from live wind at your exact location — and tells you where you're actually losing strokes."

**The three-layer moat:**
1. **Wind calculation** — Live weather + GPS + compass + Trackman physics. No competitor does this without hardware or subscription.
2. **Improvement loop** — Pre-shot plan connected to post-round stroke-loss attribution. No competitor closes this loop.
3. **Visual strategy** _(Phase 3)_ — Shot landing on hole layout. Turns the calculator into a caddie.

---

## Build Checklist

Items move from _Planned_ to _Done_ as they are implemented.

### Phase 1 — Pre-launch (use existing data, no new tracking)
- [ ] **Round-complete overlay: stroke-loss insight cards** — 2–3 behavioural findings from the round just played (FIR correlation, 3-putt cost, par type weakness)
- [ ] **Post-round "one focus for next round"** — single actionable recommendation derived from stroke-loss pattern
- [x] **Strategy vs outcome: full-round analysis** — extract `renderLastRoundHint` logic into a round-level summary; show in round-complete overlay _(see §6d)_
- [x] **Personal baseline: lower gate from 5 → 3 rounds** — add low-sample indicator; `courses.js:67` + `rounds.js:819` _(see §6a)_
- [x] **Round vs personal baseline delta** — hero stat in round-complete overlay: "X strokes vs your baseline" _(see §6b)_
- [x] **Pre-round focus prompt** — one-card overlay before hole 1, derived from last 3–5 rounds stroke-loss _(see §6c)_
- [ ] **Empty state: stats preview** — greyed-out example stats on home dashboard and My Stats when no rounds exist

### Phase 2 — Early post-launch
- [ ] **Course API integration** — replace manual course entry with search & select
- [ ] **Yards/meters toggle** — bag setup, calculator, course distances
- [ ] **Improvement streak** — "3 rounds below your avg" gamification hook
- [ ] **"You beat your best score" celebration** — post-round notification

### Phase 3 — Differentiation
- [ ] **Hole layout visualisation** — shot landing overlay on course map using course API geometry
- [ ] **Club selection per shot** — store club used per shot (unlocks distance-band analysis)
- [ ] **Improvement streak gamification** — streaks, milestones, session goals

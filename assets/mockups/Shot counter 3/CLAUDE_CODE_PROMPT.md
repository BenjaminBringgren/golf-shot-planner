# Claude Code Implementation Prompt — Shot Counter Redesign

> Paste this entire document to Claude Code as the task brief. The accompanying file `shot-counter-v4-reference.html` and `shot-counter-v3.html` is the visual source of truth for the redesign and should be opened alongside this prompt.

---

## Task

Redesign the shot-tracking flow in `golf-shot-planner` to match the staged, iOS-native flow described below. **This is a refactor, not a rewrite** — some shot-tracking pieces already exist in `src/ui`. Identify what's there, reuse what works, replace what doesn't.

---

## Step 0 — Read these files before writing any code

1. `CLAUDE.md` — project conventions, constraints, gotchas
2. `docs/UI-patterns.md` (or wherever it lives — check `docs/` first) — existing UI tokens, animation curves, component patterns
3. `REFACTOR.md` — current refactor goals; ensure this work aligns rather than conflicts
4. `src/ui/` directory tree — list every file; identify the existing shot-tracking pieces
5. `src/storage/` — confirm storage keys and shapes for round/score data
6. `src/engine/` — confirm where score calculation, expected strokes, and milestone detection live (or should live)
7. `styles.css` — current design tokens, color variables, radius/shadow scales

After reading, **before writing code**, produce a short plan in chat that includes:
- Which existing files will be edited vs created
- Which existing tokens (colors, radii, fonts, animations) you will reuse
- Any tokens you propose to *add* (with justification)
- Any conflicts between this brief and `CLAUDE.md` / `UI-patterns.md` / `REFACTOR.md` (raise them; do not silently override)

Wait for confirmation before implementing.

---

## Architectural Constraints

### Respect the existing layered architecture

The repo separates concerns into `app/`, `engine/`, `platform/`, `storage/`, `ui/`. Honor this:

- **`engine/`** — pure logic. Stage machine, score calculation, milestone detection, expected-strokes computation. No DOM access. No imports from `ui/`.
- **`storage/`** — persistence layer. All `localStorage` / `sessionStorage` access goes here. UI must not touch storage directly.
- **`ui/`** — DOM rendering, event wiring, animation. Imports from `engine/` and `storage/` via their public exports only.
- **`platform/`** — browser/device shims (haptics, vibration, viewport). Use this for `navigator.vibrate`, `prefers-reduced-motion` checks, etc.
- **`app/`** — top-level wiring / entry composition.

If existing code violates these boundaries, fix the violation as part of this task. Do not propagate the violation.

### Vanilla ES modules — no framework

- Use `export` / `import`. No bundler-specific syntax beyond standard ES modules.
- Components are functions that return DOM nodes (or that mutate a passed-in mount node). Match the existing pattern in `src/ui` — read a few existing components to confirm the convention before writing new ones.
- State management: no global mutable singletons unless `CLAUDE.md` says otherwise. Prefer scoped state passed explicitly. If the app uses an event bus / pub-sub pattern, use it.

### Tokens — reuse, don't invent

The reference mockup `shot-counter-v4-reference.html` and `shot-counter-v3` uses specific colors (`#d6e5f5`, `#c7e4cb`, etc.) and radii (20px, 16px, etc.). **These are illustrative only.** Use the app's existing tokens from `styles.css` and `UI-patterns.md`. If a needed token genuinely doesn't exist (e.g. celebration gradients), add it to `styles.css` in the existing scale, and document it in `UI-patterns.md`.

The lie color system is the most likely place for existing tokens. Look for variables like `--lie-fairway`, `--surface-fairway`, or similar before introducing new ones.

### Browser support

- iPhone Safari and Brave on iOS are the primary targets.
- Avoid `Object.defineProperty` on `window` (Safari quirk noted in project history).
- Test gestures (swipe-to-undo) on touch; provide pointer-event fallbacks.
- Respect `prefers-reduced-motion` via `platform/` helper.

---

## What to Build

### Stage machine (engine layer)

Three stages of a single hole:

```
STAGE_SHOTS  →  STAGE_PUTTS  →  STAGE_RESULT
```

Transitions:
- `commitShot(lie)` from `STAGE_SHOTS`:
  - if `lie === 'green'` → transition to `STAGE_PUTTS`
  - else → stay in `STAGE_SHOTS`, increment shot counter
- `holeOut()` from `STAGE_SHOTS` → `STAGE_RESULT` (skip putts; chip-in or hole-in-one)
- `setPutts(n)` and `finishHole()` from `STAGE_PUTTS` → `STAGE_RESULT`
- `back()` from `STAGE_PUTTS` → `STAGE_SHOTS` (preserve history including Green)
- `edit()` from `STAGE_RESULT` → `STAGE_SHOTS` (preserve history; do not roll back the Green shot)
- `nextHole()` from `STAGE_RESULT` → persist hole, reset to `STAGE_SHOTS` for hole N+1

Place this state machine in `src/engine/`. Expose it as a small module (e.g. `holeState.js`) with pure functions. UI subscribes to changes; UI does not mutate state directly.

**Tee auto-log:** When entering `STAGE_SHOTS` for shot 1 of any hole, the engine should automatically commit a `tee` shot. The first user-visible prompt is "Shot 2 — where did it land?" The user never taps Tee.

### Storage shape (storage layer)

Reuse existing `roundScores_<courseId>` sessionStorage. Extend the per-hole record to include:

```js
{
  hole: 6,
  par: 4,
  shots: [{ n: 1, lie: 'tee' }, { n: 2, lie: 'rough' }, ...],
  putts: 2,
  penalties: 0,
  holedFromLie: 'green', // or 'fw', 'rough' for chip-ins
  milestones: ['first_gir', 'first_birdie'],
  completedAt: 1714000000000
}
```

Before changing the schema, **read every existing reader of this key** in the codebase to make sure additions are backward-compatible. If older saved rounds lack the new fields, default them gracefully on read.

### Milestone detection (engine layer)

Pure function: given the round so far + the just-completed hole, return the list of milestones triggered.

```js
// engine/milestones.js
export function detectMilestones(roundSoFar, completedHole) {
  const m = [];
  if (isFirstGIR(roundSoFar, completedHole)) m.push('first_gir');
  if (isFirstFairwayHit(roundSoFar, completedHole)) m.push('first_fw');
  if (isFirstOnePutt(roundSoFar, completedHole)) m.push('first_one_putt');
  if (isLongestDrive(roundSoFar, completedHole)) m.push('longest_drive');
  return m;
}
```

Result-tier classification (also engine layer):

```js
// engine/resultTier.js
export function classifyHoleResult(hole) {
  const score = totalShots(hole) - hole.par;
  if (score <= -2) return 'celebration_eagle'; // gold card
  if (score === -1) return 'celebration_birdie'; // green card
  if (hole.milestones.length > 0) return 'milestone_slim'; // gold-tinted slim bar
  return 'slim'; // default slim bar (par, bogey, double, worse)
}
```

For repeat-of-type handling (2nd birdie of a round): if the only milestone-class match is "this is a birdie but not the first," return `celebration_birdie` without the FIRST star badge. Track which celebration types have already fired this round in `roundSoFar`.

### UI components (ui layer)

Build these as separate ES modules under `src/ui/shot-sheet/` (or whatever convention the existing code uses for grouped components — check first):

1. `ActivityHeader` — pulsing dot, course name, hole progress, round score
2. `HoleHeader` — "Hole N · Par P" + context-sensitive right label
3. `ShotChips` — horizontal scroller with entry animation; swipe-to-undo on last chip; long-press menu fallback
4. `Prompt` — stage-aware headline + hint
5. `LieGrid` — 2×2 grid (FW / Rough / Sand / Green); the Green tile transitions to putts stage; tap commits immediately with ripple
6. `SecondaryActions` — Penalty + Holed Out
7. `PuttsCard` — big numeral + 1/2/3/4+ quick-picks; 4+ reveals stepper for 5+
8. `ConfirmRow` — Back + Finish hole (or Edit + Hole N+1 in result stage)
9. `ResultBar` — three render variants: `slim`, `milestone_slim`, `celebration` (birdie/eagle)
10. `StatsBar` — vs Expected + Round (hidden during STAGE_PUTTS)

Each component:
- Pure render function from props/state
- Subscribes to engine state changes via the existing pattern in the repo
- No direct storage access
- Exports a single mount/render function

The full reference layout, copy, and pixel relationships are in `shot-counter-v4-reference.html`. Open it in a browser while implementing — match the structure and behavior, but use the app's tokens for actual styling.

### Key interactions

**Tap on lie tile:**
1. Active state scales to 0.96 with spring curve
2. On release: ripple animation appears at touch point
3. Engine commits the shot
4. New chip animates into the history strip with overshoot spring (`cubic-bezier(0.34, 1.56, 0.64, 1)`)
5. Stats bar values flip-update
6. If lie was Green: 200ms delay, then transition to STAGE_PUTTS

**Swipe-to-undo on last chip:**
- Pan left on the most-recent chip
- Past 60px threshold on release: undo (engine pops last shot; UI removes chip with reverse animation)
- Show red "Undo" reveal behind the chip during the swipe
- Below threshold: spring back
- **Long-press fallback** on any chip: small popover with "Undo" / "Edit lie" / "Cancel"

**Quick-putt selection:**
- Tap 1, 2, 3, or 4+
- Big numeral updates
- 4+ reveals a stepper (5, 6, 7) inline below the quick-picks

**Back / Edit:**
- Both return to STAGE_SHOTS
- Both preserve history fully — the Green shot remains logged
- The user must explicitly swipe-undo a chip to roll back

### Animation tokens

Use existing project animation curves where they exist. If new ones are needed:

- Tile press: 120ms `cubic-bezier(0.34, 1.56, 0.64, 1)`
- Chip entry: 350ms `cubic-bezier(0.34, 1.56, 0.64, 1)` with scale 0.6→1 + translateY -4→0
- Score flip: 300ms ease-out, two-frame Y-translate fake roll
- Activity dot pulse: 2s ease-in-out infinite, opacity 1↔0.6 + scale 1↔0.85
- Sheet stage transitions: match existing sheet timing in the app — do not introduce a new curve

Wrap all of the above in `prefers-reduced-motion` reductions.

### Haptic / vibration

Add to `src/platform/haptics.js` (or extend if exists):

```js
export function tap()    { tryVibrate(10); }
export function commit() { tryVibrate(15); }
export function success(){ tryVibrate([10, 30, 10]); }
```

`tryVibrate` is a guarded wrapper. iOS Safari has no Vibration API — must no-op silently. Do not assume it works anywhere.

Fire `tap()` on quick-putt selection, `commit()` on lie tile commit, `success()` on hole finish if it's birdie or better.

---

## Edge Cases — Test Each One

1. Drive the green on a par 4 (Tee auto-logged → tap Green → Putts stage shows shot 2 was Green)
2. Hole-in-one on a par 3 (Tee auto-logged → tap Holed Out → Result stage classifies as eagle-or-better with HIO copy)
3. Chip-in from rough (Tee → Rough → Holed Out; `holedFromLie === 'rough'`)
4. Penalty on a par 3 tee shot (Tee → Penalty → drop sub-flow → continue)
5. User closes the sheet mid-hole (state persists in sessionStorage; reopening resumes at correct stage)
6. User taps Edit from Result, then immediately Next Hole without changing anything (hole commits as it was)
7. Swipe-undo the only shot in history (history goes empty; stage stays at STAGE_SHOTS; prompt reverts to "Shot 1 — where did it land?" — this is the one case where the Tee tile *might* need to surface, OR the engine re-auto-logs Tee. Decide based on what feels right and document the choice.)
8. Round score reads "E" not "0" when at even par
9. First hole of round: hole progress reads "1/18" not "0/18"
10. 18th hole completion: Next Hole button becomes "Finish round" and routes to round summary

---

## Definition of Done

- [ ] Plan reviewed and confirmed in chat before any code written
- [ ] `CLAUDE.md`, `docs/UI-patterns.md`, `REFACTOR.md` read and respected
- [ ] Existing shot-tracking pieces in `src/ui` identified; reused where possible
- [ ] Stage machine in `engine/` is pure (no DOM, no storage)
- [ ] Storage schema extension is backward-compatible with older saved rounds
- [ ] Milestone detection in `engine/`, not `ui/`
- [ ] No new tokens added to `styles.css` without entries in `UI-patterns.md`
- [ ] Tee auto-logged on shot 1 of every hole
- [ ] Quick-putt 1/2/3/4+ works; 4+ reveals stepper
- [ ] Three result tiers render correctly: slim / milestone-slim / celebration
- [ ] Birdie celebration: green; eagle+: gold; HIO: special copy
- [ ] Repeat-celebration handling: FIRST star drops on subsequent same-type
- [ ] Swipe-to-undo works on touch; long-press fallback works on all input types
- [ ] `prefers-reduced-motion` honored
- [ ] No `window.foo = ...` cross-boundary exposure introduced
- [ ] Tested on iPhone Safari and Brave
- [ ] All 10 edge cases above verified
- [ ] No imports from `ui/` into `engine/` or `storage/`

---

## Reference Files

- `shot-counter-v4-reference.html` and `shot-counter-v3.html`— visual reference; layout, copy, animations, tier system. Open in browser. Use the *structure*, not the literal colors/radii/fonts (those come from the app's existing tokens).

---

## Non-Goals (do not touch)

- GPS shot tracking
- Wind / altitude / roll calculation
- Course picker
- Round start flow
- Post-round statistics views
- Bag / club management

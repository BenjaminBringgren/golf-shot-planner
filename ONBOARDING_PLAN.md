# Onboarding Redesign Plan
_Implementation plan — review before coding._

---

## The Core Problem

The current splash asks for driver carry, then drops the user into the app with no guidance.
The calculator demo trick fails because the user **has already entered their driver carry** — the
trigger condition (`!driverEl.value`) can never fire after normal splash completion.

The user needs to feel the app's value proposition **before** committing to any data entry,
not after.

---

## Proposed New Flow

### Step 1 — Splash: Value proposition page (NEW)

Before asking for driver carry, show a single-screen value prop. Two sub-steps, swipeable/tappable:

**Screen 1a — "What this does"** (shown first, before carry entry)
- Large headline: *"Your pocket caddie."*
- Sub-line: *"Live wind · Calculated carry · Stroke coaching."*
- Background: existing `Approach.webp` hero image (already used in splash)
- CTA button: *"Set up my bag →"*
- No skip — this is 2 seconds to read, not a wall.

**Screen 1b — Carry entry** (existing splash, unchanged in logic)
- Same as today: driver carry input, "Get started →"
- Small addition: hint text changes to *"Used to calculate your club distances. You can add 7‑iron & PW later."*

**Implementation:** Two absolutely-positioned divs inside `#splashOverlay`.
Screen 1a is shown first. CTA slides to screen 1b. Existing splash logic (save bag, dismiss overlay) stays on screen 1b's button. No new storage.

---

### Step 2 — Post-splash: Play tab guided empty state (NEW)

After splash dismisses, the Play tab currently shows the hero landing with "Open Calculator" and
"Start a Round" buttons. The "Start a Round" flow immediately hits the course picker, which shows:
> *"No courses saved yet. Add one in My Golf → My Courses."*

This is a dead end. Replace with an active next-step prompt.

**Changes:**

**A. Course picker empty state → actionable CTA**

Change `sheets.js` line 254. Instead of a dead-end message, show a card:

```
┌─────────────────────────────────────┐
│  No courses yet                     │
│  Add your home course to track      │
│  rounds and unlock improvement      │
│  coaching.                          │
│                                     │
│  [ Add a course → ]                 │
└─────────────────────────────────────┘
```

The "Add a course →" button closes the picker and navigates directly to the course editor
(`My Golf → My Courses → new course`). One tap from Play tab → course editor.

**B. Play tab landing hint card** (shown only when no courses exist)

Below the hero section on the Play tab, show a dismissible hint card when `Object.keys(loadCourses()).length === 0` and `loadBag()?.driver > 0` (i.e., splash is done but no course yet):

```
┌─────────────────────────────────────┐
│  ⛳ Ready to play?                  │
│  Add your home course to start      │
│  tracking rounds and get coaching.  │
│  [ Add course ]     [ Try calculator ] │
└─────────────────────────────────────┘
```

Dismissed permanently via a localStorage flag (`onboardingHintDismissed`). Never shown again
once a course is added.

---

### Step 3 — Calculator: Keep demo, fix trigger (REVISED)

The existing demo code (pre-fill 230/165/110, par 4 380m, 10 m/s headwind) is good — it just
fires on the wrong condition. 

**New trigger:** Show the demo when `!getActiveCourseId()` — i.e., when the calculator is
opened without an active round. This is always true from the Play tab landing. The driver carry
is already set from splash, but the **hole length and wind are not** — so the demo fills:
- Hole length: 380m
- Wind: 10 m/s headwind (from north, hole bearing 0°)
- Carry inputs: **only if not already set** (keep existing `!driverEl.value` check for those)

Result: A returning user with no active round still sees a real-looking hole plan with their
actual club distances + a sample wind scenario. The banner reads:
*"Sample scenario · Tap 'Fetch Wind' for live conditions."*

This is more useful than showing a pre-filled dummy yardage that overwrites their real data.

---

## Files to Change

| File | Change |
|---|---|
| `index.html` | Add splash step 1a div inside `#splashOverlay`; add hint card div |
| `src/app/router.js` | Wire step 1a CTA; add hint card logic (show/dismiss); fix demo trigger |
| `src/ui/sheets.js` | Replace empty-state message with actionable CTA card |
| `src/storage/storage.js` | Add `KEY_ONBOARDING_HINT = 'onboardingHint'` constant |
| `src/styles.css` | Styles for splash step 1a, hint card, picker CTA card |

No engine or platform layer changes needed.

---

## Build Order

1. **Splash value prop screen** (step 1a) — highest first-impression impact
2. **Course picker CTA** — removes the dead-end message, one file
3. **Play tab hint card** — guides new users post-splash
4. **Calculator demo trigger fix** — polish, low effort

---

## What This Doesn't Do (Deferred)

- Course API search (requires backend/API integration — Phase 2)
- Yards/meters toggle (separate small task)
- App Store screenshots / marketing copy (separate)
- Interactive walkthrough / tooltips (over-engineered for current scale)

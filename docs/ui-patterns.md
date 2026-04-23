# UI Patterns

## Responsibilities

Design tokens, iOS interaction conventions, component patterns, and information architecture rules for the Golf Shot Planner.

---

## Design tokens

### Typography — Apple HIG scale (9 sizes only)

| Size | Usage |
|---|---|
| 34px | Large score numbers (exp. strokes, round score) |
| 28px | Hole number in course bar |
| 22px | Stat bar values, round score in history |
| 17px | Primary values, button labels |
| 16px | Body text |
| 15px | Secondary labels, club names, round dates |
| 13px | Tertiary text, pills, meta information |
| 12px | Labels, timestamps, muted text |
| 11px | ALL CAPS section headers, badges, table headers |

Minimum: 11px. Never use 9px or 10px.

### Colours (key app values)

| Purpose | Value |
|---|---|
| Background | `#fff` (cards), `#f5f4f0` (page), `#f9f8f6` (detail areas) |
| Primary text | `#1a1a1a` |
| Secondary text | `#888` |
| Muted / labels | `#aaa`, `#bbb`, `#ccc` |
| Borders | `0.5px solid rgba(0,0,0,0.07)` (default), `rgba(0,0,0,0.08)` (emphasis) |
| Under par (birdie) | `#c0392b` (red circle) |
| Over par (bogey) | `#3a6fc4` (blue square) |
| Double+ | `#1a3a7a` |
| Eagle | `#f07020` |
| GIR / positive | `#1e7a45` |
| FIR / info | `#185fa5` |

### Strategy pill colours

| Strategy | Background | Text |
|---|---|---|
| Max distance | `#f5e8e8` | `#5c2828` |
| Controlled | `#f5ede0` | `#5c3810` |
| Conservative | `#d0ead0` | `#0f5c2e` |
| Par 3 | `#e8e8ec` | `#38383f` |

These colours must be applied consistently everywhere pills appear — strategy card, compare table, round history scorecard, best strategy tag, course bar hint.

### Border radius

| Usage | Value |
|---|---|
| Cards | `12px` |
| Buttons, chips | `7–8px` |
| Pills | `4–6px` |
| Score circles | `50%` |
| Score squares (bogey+) | `4px` |

---

## iOS interaction conventions

### Touch targets
Minimum 44×44px for any interactive element. Chips are 42px tall. FAB is 72px diameter.

### Press feedback
All interactive elements need `:active` state:
```css
:active { transform: scale(0.98); }
/* or for backgrounds: */
:active { background: #f5f4f0; }
```
Never rely on browser default tap highlight — always set `-webkit-tap-highlight-color: transparent` and provide explicit feedback.

### Bottom sheets
Standard pattern:
```css
.sheet {
  position: fixed; bottom: 0; left: 0; right: 0;
  transform: translateY(100%);              /* hidden state */
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.sheet.open { transform: translateY(0); }  /* visible state */
```

Dismiss animation: set `transform: translateY(100%)` explicitly, wait 280ms, then call close function. Do not just remove `.open` — inline `style.transform` overrides the class.

Drag-to-dismiss:
- Attach to **full sheet**, not just handle (handle is too small a target)
- Activate only when touch starts in top 60px zone
- `touchmove` must be `{ passive: false }` to allow `preventDefault()` during drag
- Threshold: 80px drag = dismiss
- Cleanup all listeners on close via stored reference

### Safe area insets
Use `env(safe-area-inset-bottom)` for any element near the bottom edge (tab bar, FABs, bottom padding).

---

## Component patterns

### Destructive actions (delete, cancel round)
Tap-to-arm + tap-to-confirm pattern:
- **Resting state:** red text + subtle red border
- **Armed state:** filled red background + white text
- Timeout: 3 seconds, then auto-revert to resting state
- Never execute immediately on first tap

### Chip control rows
Two elements always paired: a visible chip row + a hidden `<select>` that holds the actual value.
```js
wireChipRow('rowId', 'hiddenSelectId')   // set up click → select change
syncChipRow('rowId', 'hiddenSelectId')   // sync active class from select value
```
Multiple chip rows can drive the same hidden select (e.g. conditions has two chip rows — one per context).

### Collapsible panels
Pattern: `.collapsible` parent, `.collapsible-header` (always visible), `.collapsible-body` (hidden by default).
```css
.collapsible-body { display: none; }
.collapsible.open .collapsible-body { display: block; }
```
**Critical:** Every `.collapsible-body` must have its closing `</div>` — a missing close tag will silently hide all subsequent content on the page.

### Scorecard tables
Use `table-layout: fixed` with explicit column widths:
- `#` — 32px
- `Par` — 36px
- `Score` — 52px
- `Putts` — 44px
- `GIR` — 36px
- `FIR` — 36px
- `Strategy` — remaining width (left-aligned, needs most room)

Strategy column: `text-align: left; padding-left: 8px`. Two-line wrapping is acceptable.

---

## Information architecture rules

### Redundancy
Before adding any UI element, verify it doesn't duplicate information already visible in the same context. Example: par and distance shown in course bar → par chip row and hole length input hidden when course is active.

### Aggregated vs instance data
- **Aggregated** (averages, trends, best strategy per hole) → Stats page (`mgSubStats`)
- **Instance** (individual round scorecard, per-hole score) → Round history

Do not mix concerns. The strategy history section was removed because it duplicated the per-hole strategy column already in the scorecard.

### Progressive disclosure
Default visible → expandable on tap → navigate to sub-page. Use this hierarchy:
1. **Always visible:** critical at-a-glance info (current score, hole, best strategy tag)
2. **Expandable:** supplementary detail (stat bar, scorecard within a round row)
3. **Sub-page:** comprehensive data (full stats breakdown, round history)

### Glanceability
The app is used on-course with one hand. Information hierarchy must support scanning in under 2 seconds. Avoid dense text blocks. Use numbers, pills, and icons over sentences.

### Mockup requirement
Any change that affects layout, information hierarchy, or the position of a UI element requires a visual mockup before implementation. Get explicit approval before writing code.

---

## Course-active state

When a course is loaded (`#playCourseBar` exists in DOM):
- `#thisHoleCard` → `.course-active` class → manual fields hidden
- `#parCondGrid` (par + conditions strip) → `display: none`
- `#weatherCondRow` (conditions below Weather header) → `display: flex`
- `#calcButton` → `.course-active` class → hidden; recalc link shown instead

Both `#condChipRow` (in strip) and `#condChipRowWeather` (in weather section) drive the same hidden `#conditions` select. Both must stay in sync when either is changed.

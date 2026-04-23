# Handoff: Shot Counter Redesign (Variant B — Shot History Timeline)

## Before You Start
**Read CLAUDE.md and all project MD rule files first.** Follow every rule and convention defined there. Do not proceed until you have read them.

---

## Overview
This replaces the existing shot counter bottom sheet in the scoring screen. The new design uses a **shot history timeline** pattern: shots build up as a vertical list, each showing its number and lie type. The user taps "Add shot N" to log a new shot (a lie picker slides up), and can tap any existing shot to edit or delete it.

The goal is a cleaner, more editable experience than the current Fairway/Rough two-button layout.

---

## About the Design File
`shot-counter-variants.html` is a **high-fidelity interactive prototype** built in HTML/React for design reference only. **Do not copy this code into the app.** Recreate the design in vanilla HTML/JS matching the existing codebase patterns.

The prototype contains 4 variants (A–D). **Only implement Variant B** — labelled "B — Timeline with + add" in the design canvas. You can open the file in a browser to interact with it.

---

## Fidelity
**High-fidelity.** Recreate colors, typography, spacing, border radii, and interactions as closely as possible using the existing codebase's patterns. Where the existing app already has established components (pills, bottom sheets, score chips), use those instead of inventing new ones.

---

## Screen: Shot Counter Bottom Sheet

### Purpose
Displayed during active hole scoring. Lets the user log each shot with its lie, edit past shots, manage putts, and see the running total.

### Layout
The sheet is a white bottom sheet with `border-radius: 28px 28px 0 0` that slides up from the bottom of the screen. It has three zones stacked vertically:

```
┌────────────────────────────┐
│  ░░░  drag handle          │  10px top padding, centered 36×4px pill, bg #ddd
├────────────────────────────┤
│  HOLE 6 · PAR 4            │  Section header
├────────────────────────────┤
│  Shot history list         │  Flex column, gap 10px, padding 0 20px
│  └─ [Shot row × N]         │
│  └─ [+ Add shot N]         │
├────────────────────────────┤
│  ⛳ Putts    − 0 +         │  Fixed row, border-top
├────────────────────────────┤
│  Total: N  [-2]  Running   │  Fixed footer row
└────────────────────────────┘
```

---

### Component: Hole Header
- Text: `"HOLE {n} · PAR {n}"`
- Font: 13px, weight 700, letter-spacing 0.08em, color `#888`
- Padding: 18px 20px 14px

---

### Component: Shot Row (existing shot)
Each logged shot renders as a tappable row. Tapping opens the Edit/Delete sheet.

```
[●]  Shot N          ›
      Fairway
```

- **Circle badge**: 36×36px, border-radius 999, background and border use lie color (see Lie Colors below), font 14px weight 700
- **Shot label**: "Shot N", 15px weight 600, color `#222`
- **Lie sublabel**: lie name (e.g. "Fairway"), 12px weight 500, color = lie text color
- **Chevron**: `›`, 12px color `#ccc`
- **Connector line** between rows: 2px wide, 10px tall, color `#f0f0f0`, centered below each badge (except last row)
- Row layout: `display: flex; align-items: center; margin-bottom: 10px`
- Badge has `margin-right: 14px`
- New shots animate in: `slideInRight 0.2s ease` (translateX 20px → 0, opacity 0 → 1)

---

### Component: Add Shot Button
Shown below the shot list. Tapping it opens the Lie Picker sheet.

```
[+]  Add shot N
```

- Outer: `display: flex; align-items: center; gap: 12px; border: 2px dashed #ddd; border-radius: 14px; padding: 10px 16px; width: 100%`
- Circle: 36×36px, bg `#f5f5f5`, border-radius 999, `+` in 22px color `#bbb`
- Text: "Add shot N", 15px, color `#bbb`, weight 500
- Background: transparent

---

### Component: Lie Picker Sheet (bottom sheet overlay)

Slides up over the scoring sheet when:
- User taps "Add shot N" → opens in **add mode**
- User taps an existing shot row → opens in **edit mode**

**Overlay**: `position: absolute; inset: 0; background: rgba(0,0,0,0.3)` — tapping overlay dismisses  
**Sheet**: `background: #fff; border-radius: 24px 24px 0 0; padding: 20px 20px 30px`  
**Animation**: `slideUp 0.25s ease` (translateY 100% → 0)

**Header label**:
- Add mode: `"LOG SHOT N"`, Edit mode: `"EDIT SHOT N"`
- 13px, weight 700, letter-spacing 0.08em, color `#aaa`, margin-bottom 16px

**Lie option grid**: `display: grid; grid-template-columns: 1fr 1fr; gap: 10px`

Each lie option is a button:
- Padding: 14px 16px, border-radius: 14px, text-align: left
- Background: lie bg color, border: 1.5px solid lie border color
- In edit mode, the currently-selected lie shows **inverted** (background = lie text color, text = white)
- Primary label: lie full name, 15px weight 700, lie text color (or white if selected)
- Sub-label: lie short code, 11px, 0.7 opacity

**Remove button** (edit mode only):
- Full width, margin-top 14px, padding 12px, border-radius 14px
- Background `#fdeaea`, border `1.5px solid #f0b8b8`, color `#a03030`
- Text: "Remove shot N", 14px weight 600

**Cancel button**:
- Full width, margin-top 12px, padding 12px, border-radius 14px
- Background `#f5f5f5`, border none, color `#888`, 14px weight 600

---

### Component: Putts Row
- Layout: `display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid #f0f0f0`
- Left: ⛳ emoji + "Putts" label (15px weight 500 color `#333`)
- Right: `−` button, count (20px weight 600), `+` button
- Buttons: 32×32px, border-radius 999, bg `#f0f0f0`, border none, 20px color `#444`
- Count cannot go below 0

---

### Component: Totals Row
- Layout: `display: flex; align-items: center; justify-content: space-between; padding: 12px 20px 16px; border-top: 1px solid #f0f0f0`
- Left: "Total: N" — 15px weight 600 color `#222`
- Center: Score chip (see below)
- Right: "Running: −3" — 13px color `#aaa`

**Score chip**: pill badge, padding 4px 12px, border-radius 999
- Under par: bg `#e2f0e8`, color `#3a7055`
- Over par: bg `#fdeaea`, color `#a03030`
- Even: bg `#f0f0f0`, color `#555`
- Text format: `−N` / `+N` / `E`

---

## Lie Colors

| Lie      | Short | Background | Text      | Border   |
|----------|-------|------------|-----------|----------|
| Tee      | TEE   | `#e8f4ff`  | `#2a6496` | `#b8d8f0`|
| Fairway  | FW    | `#e2f0e8`  | `#3a7055` | `#b4d8c1`|
| Rough    | RGH   | `#f5edda`  | `#8a6030` | `#dfc898`|
| Sand     | SND   | `#fdf3e0`  | `#a07020` | `#f0d898`|
| Penalty  | PEN   | `#fdeaea`  | `#a03030` | `#f0b8b8`|

Tee shot is only selectable as the first shot. From shot 2 onward, default to showing Fairway pre-selected.

---

## State Model

```js
// Per-hole state
{
  shots: [
    { num: 1, lie: 'tee' },
    { num: 2, lie: 'fw' },
    // ...
  ],
  putts: 0
}

// Derived
total = shots.length + putts
score = total - par
```

**Actions:**
- `addShot(lie)` — append `{ num: shots.length + 1, lie }` to shots array
- `editShot(index, lie)` — update lie at index
- `deleteShot(index)` — remove shot at index, re-number remaining shots (num = index + 1)
- `setPutts(n)` — set putts, min 0

---

## Interactions & Animations

| Trigger | Behavior |
|---|---|
| Tap "Add shot N" | Lie Picker sheet slides up (add mode) |
| Tap existing shot row | Lie Picker sheet slides up (edit mode, current lie highlighted) |
| Tap lie option (add mode) | Sheet dismisses, shot appended to list with slideInRight animation |
| Tap lie option (edit mode) | Sheet dismisses, shot lie updated in-place |
| Tap "Remove shot N" | Sheet dismisses, shot removed, list re-numbered |
| Tap overlay behind sheet | Sheet dismisses, no change |
| Tap Cancel | Sheet dismisses, no change |
| Tap − on Putts | Decrement putts, min 0 |
| Tap + on Putts | Increment putts |

**Keyframe animations needed:**
```css
@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes slideInRight {
  from { transform: translateX(20px); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

---

## What This Replaces

The existing "SHOT N — Fairway / Rough" two-button row + the separate shot counter. The new component handles both shot counting and lie capture in one unified timeline UI.

Keep the existing:
- Hole header (HOLE N · PAR N)
- Putts counter (can reuse existing component if it exists)
- Total / running score footer
- Bottom sheet container / drag handle

---

## Files in This Handoff
- `shot-counter-variants.html` — interactive prototype (open in browser, interact with Variant B)
- `README.md` — this document

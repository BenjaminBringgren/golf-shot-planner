# Handoff: Shot Counter — Direction 2.1 (Unified Tile Grid)

## Before You Start
**Read CLAUDE.md and all project MD rule files first.** Follow every rule and convention defined there. Do not proceed until you have read them.

---

## Overview
Replaces the existing shot counter bottom sheet. The design uses a **unified tile grid** where every interactive element — lie options, putts counter — is the same visual component: a rounded color tile. No dividers, no secondary button styles, no separate footer chrome. One language throughout.

The reference prototype is `direction-2-1-refined.html` — open it in a browser to interact with the full design.

---

## Fidelity
**High-fidelity.** Recreate colors, typography, spacing, border radii, and interactions exactly using the existing codebase's patterns.

---

## Visual Language

### Core principle
Every interactive element is a **tile**: `border-radius: 20px`, no border, colored background, large bold label bottom-left. Nothing else.

### Background
Sheet background: `#f6f2ed` (warm off-white). This color also bleeds into the phone chrome behind the sheet.

### Typography
- **Tile labels**: 23px, weight 800, letter-spacing `-0.02em`, color = lie text color
- **Putts count**: 30px, weight 800, letter-spacing `-0.03em`, color `#2a2420`
- **PUTTS sublabel**: 9px, weight 700, letter-spacing `0.07em`, color `#b0a898`
- **Header labels**: 11px, weight 700, letter-spacing `0.09em`, color `#c0bab3`
- **Shot badges**: 11px, weight 700, color = lie text color
- **Footer**: 13px, weight 600, color `#a09890` (total) / lie-specific or E/+N/−N (score) / `#c0bab3` (running)

---

## Layout

```
┌──────────────────────────────┐
│  ░░░  drag handle            │  10px top, centered 36×4px, rgba(0,0,0,0.1)
├──────────────────────────────┤
│  HOLE 6 · PAR 4   SHOT N     │  Header row, 11px caps
│  [1·TEE] [2·FW] …            │  Shot badges row
├──────────────────────────────┤
│  [  Tee  ] [  Fairway  ]     │  Row 1 — flex: 1
│  [  Rough ] [  Sand    ]     │  Row 2 — flex: 1
│  [ Pen.  ] [  0 PUTTS  ]     │  Row 3 — flex: 1
├──────────────────────────────┤
│  Total N      score   −3     │  Footer — plain text, no border
└──────────────────────────────┘
```

All three tile rows share equal height (`flex: 1` in a flex column). Outer padding: `0 14px`. Gap between tiles: `7px`. Gap between rows: `7px`.

---

## Lie Colors

| Lie     | Short | Tile bg   | Text      | Active bg  |
|---------|-------|-----------|-----------|------------|
| Tee     | TEE   | `#cde3f5` | `#0d3d5c` | `#1a6090`  |
| Fairway | FW    | `#bddece` | `#0d3d22` | `#1a6040`  |
| Rough   | RGH   | `#ddd0aa` | `#3d2a08` | `#7a5510`  |
| Sand    | SND   | `#edddb8` | `#3d2e08` | `#9a7010`  |
| Penalty | PEN   | `#e8b8b8` | `#3d0d0d` | `#9a1a1a`  |

**Active state** (on tap): background snaps to Active bg, text becomes `#fff`. Transition `background 0.13s`. Returns after ~240ms.

---

## Components

### Drag Handle
```
width: 36px; height: 4px; border-radius: 99px;
background: rgba(0,0,0,0.1); margin: 10px auto 0;
```

### Header Row
```
padding: 12px 18px 10px;
display: flex; justify-content: space-between; align-items: center;
margin-bottom: 8px;
```
Left: `HOLE {n} · PAR {n}` — Right: `SHOT {n}`
Both: 11px, weight 700, letter-spacing 0.09em, color `#c0bab3`

### Shot Badges Row
Below the header. `display: flex; gap: 6px; min-height: 28px; align-items: center; flex-wrap: wrap;`

Each badge is a tappable pill:
```
height: 26px; padding: 0 9px; border-radius: 999px;
background: {lie bg}; border: none;
font-size: 11px; font-weight: 700; color: {lie text};
display: flex; align-items: center; gap: 3px;
```
Content: `<bold>{num}</bold> <muted 9px 0.5 opacity>{short}</muted>`

New badges animate in: `popIn 0.2s ease`
```css
@keyframes popIn {
  0%   { transform: scale(0.82); opacity: 0; }
  70%  { transform: scale(1.06); }
  100% { transform: scale(1);    opacity: 1; }
}
```

Tapping a badge opens the **Edit Sheet**.

### Lie Tile (Row 1 + Row 2, and Penalty in Row 3)
```
border-radius: 20px;
background: {lie bg};       /* → {lie deep} on active */
border: none;
cursor: pointer;
display: flex; flex-direction: column;
align-items: flex-start; justify-content: flex-end;
padding: 0 0 14px 16px;
transition: background 0.13s;
overflow: hidden;
```
Label inside: `font-size: 23px; font-weight: 800; color: {lie text}; letter-spacing: -0.02em; line-height: 1;`

On tap: background → `{lie deep}`, label color → `#fff`. Revert after 240ms.

**"Penalty" label** is shortened to `Pen.` to fit the tile at the same font size.

### Putts Tile (Row 3, right column)
Same outer shape as lie tiles (`border-radius: 20px`). Background `#ece8e2`. No border.

Internal layout: **3-column grid** — `grid-template-columns: 1fr auto 1fr`

```
[ −  zone ] [ count + label ] [ +  zone ]
```

**− and + zones**: full height, `background: transparent` normally → `rgba(0,0,0,0.08)` on tap (transition 0.12s). `font-size: 22px; color: #aaa; font-weight: 300`. Tap left zone = decrement (min 0), right zone = increment.

**Center count block** (pointer-events: none):
```
display: flex; flex-direction: column; align-items: center; gap: 2px;
```
- Count: `font-size: 30px; font-weight: 800; color: #2a2420; letter-spacing: -0.03em; line-height: 1`
- Label: `font-size: 9px; font-weight: 700; letter-spacing: 0.07em; color: #b0a898` — text: `PUTTS`

### Score Footer
No border, no background. `padding: 10px 20px 16px`.
```
display: flex; justify-content: space-between; align-items: center;
```
- **Left**: `Total {n}` — 13px, weight 600, color `#a09890`
- **Center**: Score delta — 13px, weight 700. Under par: `#1a6040`; over par: `#9a1a1a`; even: `#888`. Format: `−N` / `+N` / `E`
- **Right**: `Running −3` — 12px, color `#c0bab3`

---

## Edit Sheet

Slides up over the scoring sheet when a shot badge is tapped.

**Scrim**: `position: absolute; inset: 0; background: rgba(0,0,0,0.38); border-radius: inherit; display: flex; flex-direction: column; justify-content: flex-end;` — tapping scrim dismisses.

**Sheet**: `background: #f6f2ed; border-radius: 22px 22px 0 0; padding: 16px 16px 28px;`

**Animation**: `slideUp 0.2s ease`
```css
@keyframes slideUp {
  from { transform: translateY(36px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
```

**Drag handle**: 34×4px, `rgba(0,0,0,0.12)`, centered, margin-bottom 14px

**Header**: `EDIT SHOT {n}` — 11px, weight 700, letter-spacing 0.09em, color `#bbb`

**Lie grid**: `display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px`

Each option: `padding: 14px; border-radius: 16px; background: {lie bg}; border: none;`
- Selected: background → `{lie deep}`, text → `#fff`
- Label: 18px, weight 800, letter-spacing `-0.02em`

**Remove button**: `width: 100%; padding: 13px; border-radius: 14px; background: #e8b8b8; border: none; color: #9a1a1a; font-weight: 700; font-size: 15px;` — text: `Remove shot {n}`

**Cancel button**: same width/padding/radius. `background: rgba(0,0,0,0.06); color: #888; font-weight: 600; font-size: 14px;`

---

## State Model

```js
// Per-hole
{
  shots: [{ num: 1, lie: 'tee' }, { num: 2, lie: 'fw' }, ...],
  putts: 0  // min 0
}

// Derived
total = shots.length + putts
score = total - par
```

**Actions:**
- `logShot(lie)` — append `{ num: shots.length + 1, lie }`; trigger flash on tapped tile (240ms)
- `editShot(index, lie)` — update lie at index
- `deleteShot(index)` — remove, re-number remaining (num = index + 1)
- `incPutts(delta)` — `putts = max(0, putts + delta)`; trigger half-tile flash (220ms)

---

## Interactions

| Trigger | Behavior |
|---|---|
| Tap lie tile | Log shot with that lie; tile flashes active color 240ms |
| Tap shot badge | Open Edit Sheet for that shot |
| Tap lie in Edit Sheet (add) | Log shot, sheet dismisses |
| Tap lie in Edit Sheet (edit) | Update lie, sheet dismisses |
| Tap "Remove shot N" | Delete shot, re-number, sheet dismisses |
| Tap scrim | Sheet dismisses, no change |
| Tap Cancel | Sheet dismisses, no change |
| Tap left half of Putts tile | Decrement putts (min 0); left zone flashes |
| Tap right half of Putts tile | Increment putts; right zone flashes |

---

## What This Replaces
The existing "SHOT N — Fairway / Rough" two-button row and shot counter. The new design handles shot counting, lie capture, and putts in one unified tile grid UI.

Keep the existing:
- Hole header (HOLE N · PAR N)
- Bottom sheet container / drag handle
- Running score data feed

---

## Reference File
`direction-2-1-refined.html` — interactive prototype. Open in a browser to experience the full design before implementing.

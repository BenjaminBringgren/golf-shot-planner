# Override System

## Responsibilities

Persisting user-selected club choices (tee club, 2nd shot, approach, GPS next shot, par 3 club) across `calculate()` calls, scoped to the correct course and hole.

---

## The five override objects

| Variable | Purpose |
|---|---|
| `teeOverrides` | User-selected tee club per strategy type |
| `shot2Overrides` | User-selected 2nd shot club per strategy type |
| `approachOverrides` | User-selected approach club (1-shot plans only) |
| `gpsShot2Overrides` | Next club after GPS ball mark |
| `par3ClubOverrides` | Par 3 club selection |

---

## Namespace key — `_hk(type)`

All overrides (except `par3ClubOverrides`) are keyed by:

```js
function _hk(type) { return _overrideCourseId + '|' + _overrideHoleIdx + '|' + type; }
// Example: "47832|6|Max distance"
```

`par3ClubOverrides` is keyed by:
```js
_overrideCourseId + '|' + _overrideHoleIdx
// Example: "47832|6"
```

Never use bare strategy type strings as keys. This caused cross-hole bleed before namespacing was introduced.

---

## Namespace variables

| Variable | Set when |
|---|---|
| `_overrideHoleIdx` | At script parse time (IIFE from sessionStorage) AND at start of every `calculate()` call |
| `_overrideCourseId` | Same |

Both must be initialised at parse time so the first `calculate()` call (before any user interaction) uses the correct namespace. The parse-time IIFE:

```js
(function() {
  try {
    const _s = sessionStorage.getItem('activeCourse');
    if (_s) {
      const _o = JSON.parse(_s);
      _overrideHoleIdx  = _o.holeIdx ?? 0;
      _overrideCourseId = _o.id      ?? '';
    }
  } catch(e) {}
})();
```

---

## Lifecycle

### Set
Chip click or bag picker callback sets the override:
```js
shot2Overrides[_hk(basePlan.type)] = selectedKey;
```

### Read
`buildStrategyCard()` and `buildPlanWithShot2Override()` read via `_hk()`:
```js
const shot2Key = shot2Overrides[_hk(basePlan.type)];
```

### Delete (not null)
Use `delete` to clear an override — setting to `null` leaves the key present and can cause stale reads:
```js
delete shot2Overrides[_hk(basePlan.type)];  // correct
shot2Overrides[_hk(basePlan.type)] = null;  // wrong — key persists
```

Exception: `par3ClubOverrides` can be set to `null` (checked via `?? null`).

### Clear on calculate button press (`clearOverrides = true`)
```js
Object.keys(teeOverrides).forEach(k => delete teeOverrides[k]);
Object.keys(shot2Overrides).forEach(k => delete shot2Overrides[k]);
Object.keys(approachOverrides).forEach(k => delete approachOverrides[k]);
Object.keys(gpsShot2Overrides).forEach(k => delete gpsShot2Overrides[k]);
Object.keys(par3ClubOverrides).forEach(k => delete par3ClubOverrides[k]);
```

### Clear GPS overrides on hole navigation
`clearGpsState()` clears only `gpsShot2Overrides`. Tee, shot2, approach, and par3 overrides persist across hole navigation — they are intentional per-hole decisions for the current round.

---

## Tapping the recommended chip

When the user taps back to the recommended (default) club, **delete** the override rather than storing the default key. This ensures `buildPlanWithShot2Override` is not called unnecessarily, and the plan falls back to the original blended score from `findBestContinuation`:

```js
if (selectedKey === recS2Key) {
  delete shot2Overrides[_hk(basePlan.type)];
} else {
  shot2Overrides[_hk(basePlan.type)] = selectedKey;
}
```

---

## Score consistency requirement

When `shot2Overrides` is set, `buildPlanWithShot2Override` is called. Its score must be consistent with the base plan score. This requires:

1. Using `driverCarry` (not `teeClub.carry`) as tier reference
2. Calling `blendedScore()` on the raw score before returning
3. Spreading `type` onto the returned object (it's not preserved by the function naturally)

```js
const override = buildPlanWithShot2Override(base, resolved, s2Key);
return override ? { ...override, type: t } : resolved;
```

Missing `type` causes `undefined` to appear in strategy labels in the compare table delta section.

---

## Multi-render consistency

The override state must be applied consistently across all render paths:

| Location | Must apply overrides |
|---|---|
| `buildStrategyCard()` | ✓ tee + shot2 |
| `buildCompareTable()` → `getActivePlan()` | ✓ tee + shot2 |
| `buildDeltaSection()` | ✓ tee + shot2 |
| Strat footer (`cc-strat-footer`) | ✓ tee + shot2 |

A fix that applies overrides in some paths but not others will show inconsistent scores between the active card and the compare/delta views.

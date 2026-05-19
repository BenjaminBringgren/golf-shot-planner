/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 3 — engine — distance interpolation, wind math, plan generation.
// Pure functions only. Zero DOM, zero storage, zero network.

import { clubMap, idx7 } from './clubs.js';

// ── Wind adjustment constants (Trackman-derived, metres per m/s) ─────────────
// Headwind reduces carry more than tailwind adds (aerodynamic asymmetry).
// Categories map to club index ranges in clubOrder:
//   driver/fw  : idx 0–3
//   hybrid/long: idx 4–7   (u2–4i)
//   mid iron   : idx 8–10  (5i–7i)
//   short iron : idx 11–13 (8i–PW)
//   wedge      : idx 14+   (50°–60°)
export const WIND_ADJ = {
  //              headwind  tailwind   (metres per m/s of component)
  driver_fw:    { head: 2.5, tail: 1.2 },
  hybrid_long:  { head: 2.2, tail: 1.0 },
  mid_iron:     { head: 2.0, tail: 0.9 },
  short_iron:   { head: 1.8, tail: 0.8 },
  wedge:        { head: 1.5, tail: 0.5 },
};

// ── Altitude correction factors ───────────────────────────────────────────────
// Wind speed increases with height: V(z) = V(10) * (z/10)^0.143 (open terrain).
// Trackman data shows PGA Tour apex heights converge across clubs (~27–30m, all ~1.15).
// Amateurs diverge: driver stays airborne but wedge apex drops with lower technique.
// ALT_FACTORS = high-handicap baseline; ALT_FACTORS_SCRATCH = tour/low-hcp baseline.
export const ALT_FACTORS = {
  driver_fw:   1.20,
  hybrid_long: 1.16,
  mid_iron:    1.12,
  short_iron:  1.07,
  wedge:       1.03,
};
const ALT_FACTORS_SCRATCH = {
  driver_fw:   1.18,
  hybrid_long: 1.16,
  mid_iron:    1.15,
  short_iron:  1.14,
  wedge:       1.13,
};

// Returns the interpolated altitude factor for a club category and handicap.
// Fallback: HCP 18 (global amateur median) when handicap is unknown.
export function altFactor(category, handicap) {
  const hcp = Math.min(Math.max(handicap ?? 18, 0), 54);
  const t   = hcp / 28; // 0 = scratch, 1 = HCP 28+; clamped below
  const tt  = Math.min(t, 1);
  const lo  = ALT_FACTORS_SCRATCH[category];
  const hi  = ALT_FACTORS[category];
  return lo + tt * (hi - lo);
}

// ── Expected strokes remaining lookup ─────────────────────────────────────────
// 6 approach bands × 6 handicap tiers (null hcp → 0 = scratch baseline).
// Hard anchors (fairway lie):
//   Arccos (700M+ shots): 10-hcp at 91m (100y) = 3.38
//   Broadie/ShotLink:     15-hcp at 146m (160y) = 3.92
// 0-hcp column: Broadie/ShotLink tour baseline + 0.25 amateur adjustment
//   (tour pros play to ~−5 equivalent; scratch amateurs are meaningfully worse)
// 5-hcp: midpoint between 0-hcp and 10-hcp columns
// 15-hcp: ratio 3.92/2.98 = 1.315 × tour baseline, validated at anchor
// 20-hcp/21+: scaled from 15-hcp using Shot Scope scoring deltas (Law of Averages series)
// ≤60m: Shot Scope up-and-down rates by handicap (scratch 54%, 15-hcp 35%, 20-hcp 32%)
export const EXPECTED_STROKES = {
  bands:  [60, 100, 130, 160, 190, Infinity],
  tiers:  [0, 5, 10, 15, 20, Infinity],  // handicap upper bounds; null → 0 (scratch)
  values: [
    //   0     5     10    15    20    21+
    [2.60, 2.68, 2.75, 2.85, 2.95, 3.10],  // ≤60m   (short game / pitch)
    [3.05, 3.20, 3.38, 3.68, 3.80, 4.00],  // ≤100m  ← Arccos anchor: 10-hcp = 3.38
    [3.16, 3.35, 3.51, 3.83, 3.98, 4.23],  // ≤130m
    [3.23, 3.42, 3.60, 3.92, 4.10, 4.40],  // ≤160m  ← Broadie anchor: 15-hcp = 3.92
    [3.34, 3.55, 3.73, 4.06, 4.28, 4.63],  // ≤190m
    [3.41, 3.60, 3.81, 4.16, 4.44, 4.84],  // >190m
  ],
};

// ── Wind category ─────────────────────────────────────────────────────────────
// Key-based — index-based ranges break whenever clubs are added or reordered.
const _WC_DRIVER_FW   = new Set(['driver','fw3','fw5','fw7']);
const _WC_HYBRID_LONG = new Set(['hy3','hy4','hy5','hy6','2i','u2','u3','u4','3i','4i']);
const _WC_MID_IRON    = new Set(['5i','6i','7i']);
const _WC_SHORT_IRON  = new Set(['8i','9i','pw','48']);
// All remaining keys (50°–60°) fall through to 'wedge'
export function windCategory(key) {
  if (_WC_DRIVER_FW.has(key))   return 'driver_fw';
  if (_WC_HYBRID_LONG.has(key)) return 'hybrid_long';
  if (_WC_MID_IRON.has(key))    return 'mid_iron';
  if (_WC_SHORT_IRON.has(key))  return 'short_iron';
  return 'wedge';
}

// ── Temperature carry correction ──────────────────────────────────────────────
// Warmer air = less dense = less drag = more carry.
// Formula: density ratio = 288.15 / (273.15 + tempC); multiplier = 1 − (ratio−1)×0.55
// Result: +~1.3% at 28°C, −~1.2% at 4°C vs 15°C baseline.
export function tempCarryFactor(windState) {
  const tempC = windState.tempC;
  if (tempC == null || isNaN(tempC)) return 1.0;
  const densityRatio = 288.15 / (273.15 + tempC);
  return 1 - (densityRatio - 1) * 0.55;
}

// ── Wind carry adjustment ─────────────────────────────────────────────────────
// Applied to carry only — roll calculated after on the adjusted carry.
export function applyWind(carry, clubKey, windState, handicap) {
  if (!windState.enabled) return carry;
  const tempAdj = carry * tempCarryFactor(windState);
  if (!windState.active) return tempAdj;
  const cat    = windCategory(clubKey);
  const adj    = WIND_ADJ[cat];
  const altFac = altFactor(cat, handicap);
  const hw = windState.headwind * altFac;
  if (hw >= 0) {
    return tempAdj - hw * adj.head;
  } else {
    return tempAdj + Math.abs(hw) * adj.tail;
  }
}

// ── Wind roll adjustment ──────────────────────────────────────────────────────
// η_hw = 0.022 (headwind); η_tw = 0.011 (tailwind ≈ η_hw / 2)
// Floor: 1.0; ceiling: 1.6
export function windAdjustedRoll(baseRoll, clubKey, windState, handicap) {
  if (!windState.active || !windState.enabled) return baseRoll;
  const altFac = altFactor(windCategory(clubKey), handicap);
  const hw = windState.headwind * altFac;
  let adjusted;
  if (hw >= 0) {
    adjusted = baseRoll * (1 - 0.022 * hw);
  } else {
    adjusted = baseRoll * (1 + 0.011 * Math.abs(hw));
  }
  return Math.max(1.0, Math.min(1.6, adjusted));
}

// ── Distance interpolation ────────────────────────────────────────────────────
// Interpolates in relCarry space using user-provided anchor distances.
// Anchors: driver (always), 7i (optional), PW (optional).
export function interpolate(driverDist, i7Dist, pwDist, key) {
  const c   = clubMap[key];
  const rel = c.relCarry;

  const driverRel = clubMap['driver'].relCarry; // 1.0
  const i7Rel     = clubMap['7i'].relCarry;     // 0.661
  const pwRel     = clubMap['pw'].relCarry;     // 0.530

  const rawCarry = driverDist * rel;

  if (!i7Dist && !pwDist) return rawCarry;

  const anchors = [{ rel: driverRel, actual: driverDist }];
  if (i7Dist) anchors.push({ rel: i7Rel, actual: i7Dist });
  if (pwDist) anchors.push({ rel: pwRel, actual: pwDist });
  anchors.sort((a, b) => b.rel - a.rel);

  for (let i = 0; i < anchors.length - 1; i++) {
    const hi = anchors[i];
    const lo = anchors[i + 1];
    if (rel <= hi.rel && rel >= lo.rel) {
      const t = (hi.rel - rel) / (hi.rel - lo.rel);
      return hi.actual + t * (lo.actual - hi.actual);
    }
  }

  const lo = anchors[anchors.length - 1];
  const hi = anchors[anchors.length - 2];
  const slope = (lo.actual - hi.actual) / (lo.rel - hi.rel);
  return lo.actual + slope * (rel - lo.rel);
}

// ── Expected strokes remaining ────────────────────────────────────────────────
// holeHcpAdj: per-hole WHS stroke allocation (null = use flat Broadie model).
// applyWindAdj: undefined/true = apply wind; false = skip; {noWind:true} = skip.
// personalCal: [{avg, count}|null] × 6 bands — blended with table when count ≥ 3.
export function expectedStrokesRemaining(approachDist, driverCarry, handicap, inRough, windState, applyWindAdj, holeHcpAdj = null, personalCal = null) {
  const hcp = handicap ?? 0;
  const ti = EXPECTED_STROKES.tiers.findIndex(t => hcp <= t);
  const bi = EXPECTED_STROKES.bands.findIndex(b => approachDist <= b);
  const bandIdx = bi === -1 ? 5 : bi;
  let base = EXPECTED_STROKES.values[bandIdx][ti === -1 ? 5 : ti];

  // Personal calibration blend: weight grows with sample count, caps at 50%
  if (personalCal) {
    const cal = personalCal[bandIdx];
    if (cal && cal.count >= 3) {
      const w = Math.min(0.5, cal.count / 15);
      base = base * (1 - w) + cal.avg * w;
    }
  }

  let hcpAdj = 0;
  if (holeHcpAdj !== null) {
    hcpAdj = holeHcpAdj;
  }

  const useWind = applyWindAdj !== false && !(typeof applyWindAdj === 'object' && applyWindAdj?.noWind);
  let windAdj = 0;
  if (useWind && windState && windState.active && windState.enabled) {
    const altFac = ALT_FACTORS['mid_iron'] ?? 1.12;
    const hw = windState.headwind * altFac;
    const penalty = hw * 0.04;
    windAdj = Math.max(-0.15, Math.min(0.25, penalty));
  }

  const roughAdj = inRough ? 0.35 : 0;
  return base + hcpAdj + windAdj + roughAdj;
}

// ── Valid tee clubs ───────────────────────────────────────────────────────────
// Returns a 3-element array [maxClub, controlledClub, conservativeClub].
// Each element is a club object or null when no matching club exists in the bag.
// Max distance = driver (or longest available). Controlled = longest fairway wood
// (fw3/fw5/fw7 + future HY keys). Conservative = longest utility iron / iron
// (u2 onward); on par 5 restricted to u2–u4 since regular irons are too short.
// Par 3 is handled separately — this function is not called for par 3.
const _TEE_WOOD_KEYS = new Set(['fw3','fw5','fw7','hy3','hy4','hy5','hy6']);
const _TEE_IRON_KEYS = new Set(['2i','u2','u3','u4','3i','4i','5i','6i','7i','8i','9i','pw','48','50','52','54','56','58','60']);

export function getValidTeeClubs(clubsList, parValue) {
  const sorted = [...clubsList].sort((a, b) => b.total - a.total);

  // Max distance: driver first, otherwise longest club in bag
  const maxClub = sorted.find(c => c.key === 'driver') ?? sorted[0] ?? null;

  // Controlled: longest fairway wood (or HY) that differs from max club
  const controlledClub = sorted.find(c => _TEE_WOOD_KEYS.has(c.key) && c.key !== maxClub?.key) ?? null;

  // Conservative: longest utility iron / iron in bag (no par restriction — course layout is unknown)
  const conservativeClub = sorted.find(c => _TEE_IRON_KEYS.has(c.key)) ?? null;

  return [maxClub, controlledClub, conservativeClub];
}

// ── Best continuation ─────────────────────────────────────────────────────────
// Returns { shots, approach, score } or null if no valid plan found.
// holeHcpAdj: forwarded to expectedStrokesRemaining.
// personalCal: forwarded to expectedStrokesRemaining.
export function findBestContinuation(teeClub, hole, driverTotal, clubsList, driverCarry, handicap, inRough, windState, holeHcpAdj = null, personalCal = null) {
  const maxApproach = driverTotal * 0.92;
  const singleApproach = hole - teeClub.total;

  const approachClubs = clubsList.filter(c => c.key !== 'driver');
  const longestApproachTotal = approachClubs.length > 0
    ? Math.max(...approachClubs.map(c => c.total))
    : 0;

  if (singleApproach >= 0 && singleApproach <= maxApproach && singleApproach <= longestApproachTotal) {
    const score = 1 + expectedStrokesRemaining(singleApproach, driverCarry, handicap, inRough, windState, undefined, holeHcpAdj, personalCal);
    return { shots: [teeClub], approach: singleApproach, score };
  }

  const candidates = clubsList.filter(c =>
    c.total < teeClub.total && c.key !== 'driver'
  );

  let best = null;
  candidates.forEach(second => {
    const approach = hole - teeClub.total - second.total;
    if (approach < 0 || approach > maxApproach) return;
    const score = 2 + expectedStrokesRemaining(approach, driverCarry, handicap, inRough, windState, undefined, holeHcpAdj, personalCal);
    if (!best || score < best.score) {
      best = { shots: [teeClub, second], approach, score };
    }
  });

  return best;
}

// ── Par 3 ─────────────────────────────────────────────────────────────────────
export function calcPar3(clubsList, hole) {
  let bestShort = null;
  let bestOver  = null;

  clubsList.forEach(c => {
    const remaining = hole - c.total;
    if (remaining >= 0) {
      if (!bestShort || remaining < bestShort.diff) bestShort = { club: c, diff: remaining };
    } else {
      if (!bestOver || remaining > bestOver.diff) bestOver = { club: c, diff: remaining };
    }
  });

  if (bestShort) return bestShort;
  return bestOver;
}

// ── Strategy decode / display ─────────────────────────────────────────────────
export function strategyDisplayName(type) { return type; }

// ── Crosswind lateral drift ───────────────────────────────────────────────────
// Source: Trackman instructor community rule of thumb — 1 mph crosswind causes
// 1 foot of drift per 100 yards of carry. Converted to metric and rounded.
// Returns drift in metres (always positive — direction handled by caller).
export function crosswindDrift(crosswindMs, carryM) {
  if (!crosswindMs || !carryM) return 0;
  return Math.round(crosswindMs * carryM * 0.00748);
}

export function decodeStrategy(stored) {
  if (!stored) return { type: null, club: null, approachM: null };
  const parts = stored.split(' · ');
  const type = parts[0] || null;
  const club = parts.length >= 2 ? parts[1] : null;
  const approachRaw = parts.length >= 3 ? parseInt(parts[2], 10) : null;
  const approachM = (approachRaw != null && !isNaN(approachRaw)) ? approachRaw : null;
  return { type, club, approachM };
}

// ── Historical strategy analysis ─────────────────────────────────────────────

// Returns the strategy type that produced the best avg score on a specific hole,
// or null if fewer than 2 rounds with any single strategy.
export function analyzeHoleStrategies(rounds, holeIdx) {
  const byType = {};
  for (const round of rounds) {
    const stratStr = round.strategies?.[holeIdx];
    const holeScore = round.scores?.[holeIdx];
    if (!stratStr || !holeScore) continue;
    const { type } = decodeStrategy(stratStr);
    if (!type || type === 'Par 3') continue;
    const shots = (holeScore.shots?.length ?? 0) + (holeScore.putts ?? 0) + (holeScore.penalties ?? 0);
    const par = holeScore.par;
    if (!shots || !par) continue;
    if (!byType[type]) byType[type] = { sum: 0, count: 0 };
    byType[type].sum += shots - par;
    byType[type].count++;
  }
  let best = null;
  for (const [type, { sum, count }] of Object.entries(byType)) {
    if (count < 2) continue;
    const avg = sum / count;
    if (!best || avg < best.avg) best = { type, avg, count };
  }
  return best ? { bestStrategy: best.type, avgToPar: best.avg, sampleSize: best.count } : null;
}

// Returns the approach distance band (20m buckets) in which the player scores best,
// across all courses. Requires approach distance encoded in the strategy string.
// Returns { scoringZone: [low, high], avgToPar } or null if data is insufficient.
export function analyzeApproachDistances(allRoundsFlat) {
  const BAND = 20;
  const bands = {};
  for (const round of allRoundsFlat) {
    const strategies = round.strategies || {};
    const scores = round.scores || [];
    for (const [idxStr, stratStr] of Object.entries(strategies)) {
      const { approachM } = decodeStrategy(stratStr);
      if (approachM == null) continue;
      const holeScore = scores[parseInt(idxStr, 10)];
      if (!holeScore) continue;
      const shots = (holeScore.shots?.length ?? 0) + (holeScore.putts ?? 0) + (holeScore.penalties ?? 0);
      const par = holeScore.par;
      if (!shots || !par) continue;
      const bandKey = Math.floor(approachM / BAND);
      if (!bands[bandKey]) bands[bandKey] = { sum: 0, count: 0 };
      bands[bandKey].sum += shots - par;
      bands[bandKey].count++;
    }
  }
  const valid = Object.entries(bands)
    .filter(([, { count }]) => count >= 3)
    .map(([k, { sum, count }]) => {
      const low = parseInt(k, 10) * BAND;
      return { low, high: low + BAND, avg: sum / count, count };
    });
  if (valid.length < 2) return null;
  valid.sort((a, b) => a.avg - b.avg);
  return { scoringZone: [valid[0].low, valid[0].high], avgToPar: valid[0].avg };
}

// WHS course handicap: strokes received on a specific course.
// ch = round(hcpIndex × slope/113 + (courseRating − coursePar))
export function courseHandicap(hcpIndex, slope, rating, par) {
  return Math.round(hcpIndex * (slope / 113) + (rating - par));
}

// Stableford points: 2 = par net, 3 = birdie, 1 = bogey, 0 = double bogey or worse.
export function stablefordPoints(gross, par, strokesReceived) {
  const net = gross - strokesReceived;
  return Math.max(0, Math.min(5, 2 - (net - par)));
}

// ── Stroke-loss attribution ───────────────────────────────────────────────────
// Attributes over-par strokes to five categories from per-hole score records.
// Holes can contribute to multiple categories — shows the cascade, not a
// mutually exclusive split. `holes` is the course holes array (for par per hole).
export function computeStrokeLoss(scores, holes) {
  const r = { driving: 0, approach: 0, shortGame: 0, putting: 0, penalties: 0, holesPlayed: 0 };
  (scores || []).forEach((s, i) => {
    if (!s) return;
    const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
    if (!total) return;
    const par  = holes?.[i]?.par || 4;
    const over = Math.max(0, total - par);
    r.holesPlayed++;
    if (par >= 4 && s.fir === false && over > 0)             r.driving   += over;
    if (s.gir === false && over > 0)                         r.approach  += over;
    if (s.gir === false && (s.putts || 0) >= 2 && over > 0) r.shortGame += over;
    if ((s.putts || 0) >= 3)                                 r.putting   += (s.putts || 0) - 2;
    if ((s.penalties || 0) > 0)                              r.penalties += s.penalties;
  });
  return r;
}

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
// Golf ball peak trajectory heights (approx):
//   driver/fw : ~35m  → 1.20 | hybrid/long: ~28m → 1.16 | mid iron : ~22m → 1.12
//   short iron: ~16m  → 1.07 | wedge       : ~12m → 1.03
export const ALT_FACTORS = {
  driver_fw:   1.20,
  hybrid_long: 1.16,
  mid_iron:    1.12,
  short_iron:  1.07,
  wedge:       1.03,
};

// ── Expected strokes remaining lookup ─────────────────────────────────────────
// 6 approach bands × 4 driver carry tiers
export const EXPECTED_STROKES = {
  bands:  [60, 100, 130, 160, 190, Infinity],
  tiers:  [195, 220, 250, Infinity],
  values: [
    [2.95, 2.80, 2.65, 2.55],
    [3.10, 2.95, 2.75, 2.60],
    [3.30, 3.10, 2.90, 2.70],
    [3.55, 3.30, 3.10, 2.85],
    [3.80, 3.55, 3.30, 3.00],
    [4.05, 3.80, 3.55, 3.20],
  ],
};

// ── Wind category ─────────────────────────────────────────────────────────────
export function windCategory(idx) {
  if (idx <= 3)  return 'driver_fw';
  if (idx <= 7)  return 'hybrid_long';
  if (idx <= 10) return 'mid_iron';
  if (idx <= 13) return 'short_iron';
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
export function applyWind(carry, clubIdx, windState) {
  if (!windState.enabled) return carry;
  const tempAdj = carry * tempCarryFactor(windState);
  if (!windState.active) return tempAdj;
  const cat    = windCategory(clubIdx);
  const adj    = WIND_ADJ[cat];
  const altFac = ALT_FACTORS[cat];
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
export function windAdjustedRoll(baseRoll, clubIdx, windState) {
  if (!windState.active || !windState.enabled) return baseRoll;
  const altFac = ALT_FACTORS[windCategory(clubIdx)];
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
export function expectedStrokesRemaining(approachDist, driverCarry, handicap, inRough, windState, applyWindAdj, holeHcpAdj = null) {
  const ti = EXPECTED_STROKES.tiers.findIndex(t => driverCarry < t);
  const bi = EXPECTED_STROKES.bands.findIndex(b => approachDist <= b);
  const base = EXPECTED_STROKES.values[bi === -1 ? 5 : bi][ti === -1 ? 3 : ti];

  let hcpAdj = 0;
  if (holeHcpAdj !== null) {
    hcpAdj = holeHcpAdj;
  } else if (handicap != null && handicap > 0) {
    hcpAdj = Math.min(handicap * 0.056, 3.0);
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
// Par 5: long clubs only (driver through U4). Par 4: up to and including 7i.
// Par 3: handled separately (all clubs valid).
export function getValidTeeClubs(clubsList, parValue) {
  let filtered;
  if (parValue === 5) {
    const longClubs = ['driver','fw3','fw5','fw7','u2','u3','u4'];
    filtered = clubsList.filter(c => longClubs.includes(c.key));
  } else {
    filtered = clubsList.filter(c => c.idx <= idx7);
  }
  return filtered.sort((a, b) => b.total - a.total);
}

// ── Best continuation ─────────────────────────────────────────────────────────
// Returns { shots, approach, score } or null if no valid plan found.
// holeHcpAdj: forwarded to expectedStrokesRemaining.
export function findBestContinuation(teeClub, hole, driverTotal, clubsList, driverCarry, handicap, inRough, windState, holeHcpAdj = null) {
  const maxApproach = driverTotal * 0.92;
  const singleApproach = hole - teeClub.total;

  const approachClubs = clubsList.filter(c => c.key !== 'driver');
  const longestApproachTotal = approachClubs.length > 0
    ? Math.max(...approachClubs.map(c => c.total))
    : 0;

  if (singleApproach >= 0 && singleApproach <= maxApproach && singleApproach <= longestApproachTotal) {
    const score = 1 + expectedStrokesRemaining(singleApproach, driverCarry, handicap, inRough, windState, undefined, holeHcpAdj);
    return { shots: [teeClub], approach: singleApproach, score };
  }

  const candidates = clubsList.filter(c =>
    c.total < teeClub.total && c.key !== 'driver'
  );

  let best = null;
  candidates.forEach(second => {
    const approach = hole - teeClub.total - second.total;
    if (approach < 0 || approach > maxApproach) return;
    const score = 2 + expectedStrokesRemaining(approach, driverCarry, handicap, inRough, windState, undefined, holeHcpAdj);
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

export function decodeStrategy(stored) {
  if (!stored) return { type: null, club: null };
  const parts = stored.split(' · ');
  if (parts.length >= 2) return { type: parts[0], club: parts.slice(1).join(' · ') };
  return { type: stored, club: null };
}

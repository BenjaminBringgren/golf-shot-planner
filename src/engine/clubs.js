/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 3 — engine — relCarry table, roll factors, club lookup.
// Pure functions only. Zero DOM, zero storage, zero network.

// relCarry: carry as a fraction of driver carry, based on Trackman amateur averages.
// These are NON-UNIFORM — the gap from driver→FW3 is much larger than 8i→9i.
//
// Clubs are grouped by type, NOT sorted purely by distance.
// Distances may overlap between groups — this is expected and known to golfers.
//
// Typical amateur carries (~230m driver baseline):
//   WOODS:   Driver 230 → FW3 215 → FW5 205 → FW7 195
//   HYBRIDS: HY3 188 → HY4 182 → HY5 173 → HY6 164
//   UTILITY: 2i 198 → U2 190 → U3 185 → U4 180
//   IRONS:   3i 177 → 4i 175 → 5i 168 → 6i 160 → 7i 152 → 8i 143 → 9i 133
//   WEDGES:  PW 122 → 48° 118 → 50° 115 → 52° 110 → 54° 105 → 56° 100 → 58° 93 → 60° 87
//
// Roll factors (soft vs firm):
//   Soft  — ball plugs on landing, minimal run. Closer to carry = total.
//   Firm  — summer conditions, ball lands and runs. Driver +15%, FWs +10%, etc.
//   Source: Trackman data, R&A distance reports, PGA/DP World Tour shot-tracking.
//
// Note: wedges always stop quickly regardless of conditions (steep descent angle,
// high spin), so both factors are 1.00–1.02 even on firm ground.

export const clubs = [
  // ── Driver ──────────────────────────────────────────────────────────────────
  {key:'driver', label:'Driver', relCarry:1.000, rollSoft:1.06, rollFirm:1.15, checked:true},

  // ── Fairway woods ───────────────────────────────────────────────────────────
  {key:'fw3',    label:'FW3',    relCarry:0.935, rollSoft:1.06, rollFirm:1.13},
  {key:'fw5',    label:'FW5',    relCarry:0.891, rollSoft:1.05, rollFirm:1.12, checked:true},
  {key:'fw7',    label:'FW7',    relCarry:0.848, rollSoft:1.04, rollFirm:1.11},

  // ── Hybrids ─────────────────────────────────────────────────────────────────
  // relCarry sourced from Shot Scope hybrid/iron carry delta data (+8–12m over equiv. iron).
  {key:'hy3',    label:'HY3',    relCarry:0.817, rollSoft:1.04, rollFirm:1.10},
  {key:'hy4',    label:'HY4',    relCarry:0.791, rollSoft:1.03, rollFirm:1.09},
  {key:'hy5',    label:'HY5',    relCarry:0.752, rollSoft:1.03, rollFirm:1.09},
  {key:'hy6',    label:'HY6',    relCarry:0.713, rollSoft:1.02, rollFirm:1.08},

  // ── Utility irons / Driving iron ─────────────────────────────────────────────
  // 2i (driving iron ~17–18°): penetrating trajectory, carry similar to FW7.
  {key:'2i',     label:'2i',     relCarry:0.861, rollSoft:1.04, rollFirm:1.10},
  {key:'u2',     label:'U2',     relCarry:0.826, rollSoft:1.04, rollFirm:1.10},
  {key:'u3',     label:'U3',     relCarry:0.804, rollSoft:1.03, rollFirm:1.10},
  {key:'u4',     label:'U4',     relCarry:0.783, rollSoft:1.03, rollFirm:1.09, checked:true},

  // ── Irons ───────────────────────────────────────────────────────────────────
  {key:'3i',     label:'3i',     relCarry:0.770, rollSoft:1.03, rollFirm:1.09},
  {key:'4i',     label:'4i',     relCarry:0.761, rollSoft:1.03, rollFirm:1.09},
  {key:'5i',     label:'5i',     relCarry:0.730, rollSoft:1.02, rollFirm:1.08, checked:true},
  {key:'6i',     label:'6i',     relCarry:0.696, rollSoft:1.02, rollFirm:1.07, checked:true},
  {key:'7i',     label:'7i',     relCarry:0.661, rollSoft:1.01, rollFirm:1.06, checked:true},
  {key:'8i',     label:'8i',     relCarry:0.622, rollSoft:1.01, rollFirm:1.05, checked:true},
  {key:'9i',     label:'9i',     relCarry:0.578, rollSoft:1.00, rollFirm:1.04, checked:true},

  // ── Wedges ──────────────────────────────────────────────────────────────────
  {key:'pw',     label:'PW',     relCarry:0.530, rollSoft:1.00, rollFirm:1.03, checked:true},
  {key:'48',     label:'48°',    relCarry:0.513, rollSoft:1.00, rollFirm:1.02},
  {key:'50',     label:'50°',    relCarry:0.500, rollSoft:1.00, rollFirm:1.02},
  {key:'52',     label:'52°',    relCarry:0.478, rollSoft:1.00, rollFirm:1.02, checked:true},
  {key:'54',     label:'54°',    relCarry:0.457, rollSoft:1.00, rollFirm:1.00},
  {key:'56',     label:'56°',    relCarry:0.435, rollSoft:1.00, rollFirm:1.00, checked:true},
  {key:'58',     label:'58°',    relCarry:0.404, rollSoft:1.00, rollFirm:1.00},
  {key:'60',     label:'60°',    relCarry:0.378, rollSoft:1.00, rollFirm:1.00},
];

export const WOOD_KEYS = new Set(['fw3','fw5','fw7','hy3','hy4','hy5','hy6']);
export const IRON_KEYS = new Set(['2i','u2','u3','u4','3i','4i','5i','6i','7i','8i','9i','pw','48','50','52','54','56','58','60']);

export const clubOrder = clubs.map(c => c.key);
export const idx7      = clubOrder.indexOf('7i');
export const idxPW     = clubOrder.indexOf('pw');

export const clubMap = clubs.reduce((acc, c) => { acc[c.key] = c; return acc; }, {});

// conditions: 'soft' | 'firm'
export function getRollFactor(key, conditions) {
  const c = clubMap[key];
  return conditions === 'firm' ? c.rollFirm : c.rollSoft;
}

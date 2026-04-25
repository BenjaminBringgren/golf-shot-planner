/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 3 — engine — milestone detection. Pure function, zero side effects.

const ROUGH_LIES = new Set(['rough', 'sand', 'penalty']);

function _totalShots(hole) {
  return (hole.shots?.length ?? 0) + (hole.putts ?? 0);
}

function _isGir(hole) {
  if (!hole.shots?.length) return false;
  return hole.shots.length <= (hole.par - 2);
}

function _isFw(hole) {
  if (hole.par <= 3) return null;
  const shots = hole.shots ?? [];
  if (shots.length < 2) return null;
  return !ROUGH_LIES.has(shots[1]);
}

/**
 * Given all holes completed so far in the round (including the newly completed
 * one) and the index of the just-completed hole, returns an array of milestone
 * IDs earned on that hole.
 *
 * Possible IDs: 'first_gir' | 'first_fw' | 'first_one_putt'
 * (Birdie/eagle are celebration tiers, not milestones — handled by resultTier.js)
 */
export function detectMilestones(roundHoles, completedIdx) {
  const hole = roundHoles[completedIdx];
  if (!hole) return [];

  const milestones = [];
  const prior = roundHoles.slice(0, completedIdx).filter(Boolean);

  // First GIR of the round
  if (_isGir(hole)) {
    const hadGirBefore = prior.some(h => _isGir(h));
    if (!hadGirBefore) milestones.push('first_gir');
  }

  // First FW hit of the round (par 4/5 only)
  if (_isFw(hole) === true) {
    const hadFwBefore = prior.some(h => _isFw(h) === true);
    if (!hadFwBefore) milestones.push('first_fw');
  }

  // First one-putt of the round
  if ((hole.putts ?? 0) === 1) {
    const hadOnePuttBefore = prior.some(h => (h.putts ?? 0) === 1);
    if (!hadOnePuttBefore) milestones.push('first_one_putt');
  }

  return milestones;
}

/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 3 — engine — result tier classification. Pure functions, zero side effects.

/**
 * Classifies the result of a completed hole into a display tier.
 *
 * @param {object} hole  - { par, shots: string[], putts, holedFromLie, milestones }
 * @returns {'celebration_hio'|'celebration_eagle'|'celebration_birdie'|'milestone_slim'|'slim'}
 */
export function classifyHoleResult(hole) {
  const totalShots = (hole.shots?.length ?? 0) + (hole.putts ?? 0);
  const score = totalShots - hole.par;

  // Hole-in-one: single shot from the tee, holed directly
  if ((hole.shots?.length === 1) && hole.holedFromLie === 'tee') {
    return 'celebration_hio';
  }

  if (score <= -2) return 'celebration_eagle';
  if (score === -1) return 'celebration_birdie';

  // Par, bogey, double — check for milestones before defaulting to slim
  if (hole.milestones?.length > 0) return 'milestone_slim';
  return 'slim';
}

/**
 * Returns true if this is the FIRST occurrence of a celebration type in the round.
 * Used to show/hide the "FIRST ★" badge on celebration cards.
 *
 * @param {object[]} roundHoles  - All holes completed so far (including current)
 * @param {number}   currentIdx  - Index of the just-completed hole
 * @param {'celebration_birdie'|'celebration_eagle'|'celebration_hio'} type
 */
export function isFirstOfCelebrationType(roundHoles, currentIdx, type) {
  const prior = roundHoles.slice(0, currentIdx).filter(Boolean);
  return !prior.some(h => classifyHoleResult(h) === type);
}

/**
 * Returns the score label string: 'E', '+2', '-1', etc.
 */
export function scoreLabel(totalShots, par) {
  const diff = totalShots - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

/**
 * Returns the human-readable result name: 'Birdie', 'Par', 'Bogey', etc.
 */
export function resultName(totalShots, par) {
  const diff = totalShots - par;
  if (totalShots === 1) return 'Hole in one';
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0)  return 'Par';
  if (diff === 1)  return 'Bogey';
  if (diff === 2)  return 'Double bogey';
  return `+${diff}`;
}

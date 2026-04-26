/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — stage-aware prompt: large shot counter + hint line.
// shotCount = _shots.length (includes starting 'tee' position).
// Completed shots = shotCount - 1. Next shot number = shotCount.

import { STAGE_SHOTS } from '../../app/holeFlow.js';

/**
 * @param {object} opts
 * @param {string} opts.stage
 * @param {number} opts.shotCount  _shots.length (tee position + completed shots)
 * @returns {HTMLElement}
 */
export function renderPrompt({ stage, shotCount = 1 }) {
  const el = document.createElement('div');
  el.className = 'sh-prompt';

  if (stage === STAGE_SHOTS) {
    const completed = shotCount - 1;

    if (completed > 0) {
      const numEl = document.createElement('div');
      numEl.className = 'sh-shot-count';
      numEl.textContent = completed;
      el.appendChild(numEl);
    }

    const hint = document.createElement('span');
    hint.className = 'sh-prompt-hint';
    hint.textContent = `tap where shot ${shotCount} landed`;
    el.appendChild(hint);
  }

  return el;
}

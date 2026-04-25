/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — stage-aware prompt: large shot counter + hint line.

import { STAGE_SHOTS } from '../../app/holeFlow.js';

/**
 * @param {object} opts
 * @param {string} opts.stage
 * @param {number} opts.shotCount  shots logged so far (shots array length)
 * @returns {HTMLElement}
 */
export function renderPrompt({ stage, shotCount = 0 }) {
  const el = document.createElement('div');
  el.className = 'sh-prompt';

  if (stage === STAGE_SHOTS) {
    const numEl = document.createElement('div');
    numEl.className = 'sh-shot-count';
    numEl.textContent = shotCount;
    el.appendChild(numEl);

    const hint = document.createElement('span');
    hint.className = 'sh-prompt-hint';
    hint.textContent = `tap where shot ${shotCount + 1} landed`;
    el.appendChild(hint);
  }

  return el;
}

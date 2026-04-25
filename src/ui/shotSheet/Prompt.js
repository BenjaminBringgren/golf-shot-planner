/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — stage-aware prompt headline + hint.

import { STAGE_SHOTS, STAGE_PUTTS, STAGE_RESULT } from '../../app/holeFlow.js';

/**
 * @param {object} opts
 * @param {string} opts.stage
 * @returns {HTMLElement}
 */
export function renderPrompt({ stage }) {
  const el = document.createElement('div');
  el.className = 'sh-prompt';

  if (stage === STAGE_SHOTS) {
    el.appendChild(document.createTextNode('Where did it land?'));
    const hint = document.createElement('span');
    hint.className = 'sh-prompt-hint';
    hint.textContent = 'Tap to log · tap Green when on the putting surface';
    el.appendChild(hint);
  } else if (stage === STAGE_PUTTS) {
    el.appendChild(document.createTextNode('How many putts?'));
    const hint = document.createElement('span');
    hint.className = 'sh-prompt-hint';
    hint.textContent = 'Tap a number · tap 4+ for a stepper';
    el.appendChild(hint);
  }

  return el;
}

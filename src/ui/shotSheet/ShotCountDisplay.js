/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — running total above the putt counter in STAGE_PUTTS.

/**
 * @param {object} opts
 * @param {number} opts.shots  approach shots logged
 * @param {number} opts.putts  current putt count
 * @returns {HTMLElement}
 */
export function renderShotCountDisplay({ shots, putts }) {
  const el = document.createElement('div');
  el.className = 'sh-prompt';

  const numEl = document.createElement('div');
  numEl.className = 'sh-shot-count';
  numEl.textContent = shots + putts;
  el.appendChild(numEl);

  const lbl = document.createElement('span');
  lbl.className = 'sh-prompt-hint';
  lbl.textContent = 'Total';
  el.appendChild(lbl);

  return el;
}

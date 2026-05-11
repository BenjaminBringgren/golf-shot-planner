/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — running total with stepper above the putt counter in STAGE_PUTTS / STAGE_RESULT.

/**
 * @param {object} opts
 * @param {number}   opts.shots    approach shots logged
 * @param {number}   opts.putts    current putt count
 * @param {Function} [opts.onAdd]  called when + is tapped (adds fairway shot by default)
 * @param {Function} [opts.onRemove] called when − is tapped
 * @returns {HTMLElement}
 */
export function renderShotCountDisplay({ shots, putts, onAdd, onRemove, penaltyStrokes }) {
  const el = document.createElement('div');
  el.className = 'sh-prompt';

  const row = document.createElement('div');
  row.className = 'sh-shot-stepper';

  const minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'sh-stepper-btn';
  minusBtn.textContent = '−';
  minusBtn.addEventListener('click', () => onRemove?.());
  row.appendChild(minusBtn);

  const numEl = document.createElement('div');
  numEl.className = 'sh-shot-count';
  numEl.textContent = shots + putts + (penaltyStrokes ?? 0);
  row.appendChild(numEl);

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'sh-stepper-btn';
  plusBtn.textContent = '+';
  plusBtn.addEventListener('click', () => onAdd?.());
  row.appendChild(plusBtn);

  el.appendChild(row);

  const lbl = document.createElement('span');
  lbl.className = 'sh-prompt-hint';
  lbl.textContent = 'Total';
  el.appendChild(lbl);

  return el;
}

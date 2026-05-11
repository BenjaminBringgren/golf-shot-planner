/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — secondary actions row: Penalty + Holed Out.

import { tap as hapticTap } from '../../platform/haptics.js';

/**
 * @param {object} opts
 * @param {Function} opts.onPenalty        () => void  — first tap: record penalty lie
 * @param {Function} opts.onPenaltyRelief  () => void  — second tap: add +1 relief stroke
 * @param {Function} opts.onHoledOut       () => void
 * @param {Function} [opts.onPickUp]       () => void  — stableford only
 * @param {boolean}  [opts.showPickUp]
 * @param {boolean}  [opts.penaltyPending] — true = show "OB / Drop +1" instead of "Penalty"
 * @returns {HTMLElement}
 */
export function renderSecondaryActions({ onPenalty, onPenaltyRelief, onHoledOut, onPickUp, showPickUp, penaltyPending }) {
  const row = document.createElement('div');
  row.className = 'sh-secondary';

  const penBtn = document.createElement('button');
  penBtn.className = 'sh-sec-btn penalty';
  penBtn.type = 'button';
  penBtn.innerHTML = penaltyPending
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z"/>
       </svg>
       OB / Drop +1`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z"/>
       </svg>
       Penalty`;
  penBtn.addEventListener('click', () => {
    hapticTap();
    if (penaltyPending) onPenaltyRelief?.();
    else onPenalty();
  });

  const holedBtn = document.createElement('button');
  holedBtn.className = 'sh-sec-btn holed';
  holedBtn.type = 'button';
  holedBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 21V3L17 7L5 11"/><circle cx="5" cy="21" r="1.5" fill="currentColor"/>
    </svg>
    Holed out`;
  holedBtn.addEventListener('click', () => { hapticTap(); onHoledOut(); });

  row.appendChild(penBtn);
  row.appendChild(holedBtn);

  if (showPickUp && onPickUp) {
    const pickBtn = document.createElement('button');
    pickBtn.className = 'sh-sec-btn pickup';
    pickBtn.type = 'button';
    pickBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/>
      </svg>
      Pick up`;
    pickBtn.addEventListener('click', () => { hapticTap(); onPickUp(); });
    row.appendChild(pickBtn);
  }

  return row;
}

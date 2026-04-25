/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — secondary actions row: Penalty + Holed Out.

import { tap as hapticTap } from '../../platform/haptics.js';

/**
 * @param {object} opts
 * @param {Function} opts.onPenalty  () => void
 * @param {Function} opts.onHoledOut () => void
 * @returns {HTMLElement}
 */
export function renderSecondaryActions({ onPenalty, onHoledOut }) {
  const row = document.createElement('div');
  row.className = 'sh-secondary';

  const penBtn = document.createElement('button');
  penBtn.className = 'sh-sec-btn penalty';
  penBtn.type = 'button';
  penBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z"/>
    </svg>
    Penalty`;
  penBtn.addEventListener('click', () => { hapticTap(); onPenalty(); });

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
  return row;
}

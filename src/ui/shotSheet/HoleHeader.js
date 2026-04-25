/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — hole header ("Hole N · Par P").

/**
 * @param {object} opts
 * @param {number} opts.holeIdx  0-based
 * @param {number} opts.par
 * @returns {HTMLElement}
 */
export function renderHoleHeader({ holeIdx, par }) {
  const header = document.createElement('div');
  header.className = 'sh-hole-header';

  const title = document.createElement('div');
  title.className = 'sh-hole-title';
  title.innerHTML = `Hole ${holeIdx + 1}<span class="sh-par"> · Par ${par}</span>`;

  header.appendChild(title);
  return header;
}

/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — hole header ("Hole N · Par P" + stage label).

import { STAGE_SHOTS, STAGE_PUTTS, STAGE_RESULT } from '../../app/holeFlow.js';

/**
 * @param {object} opts
 * @param {number} opts.holeIdx   0-based
 * @param {number} opts.par
 * @param {string} opts.stage     STAGE_SHOTS | STAGE_PUTTS | STAGE_RESULT
 * @param {number} opts.shotCount total shots logged so far (for "Shot N" label)
 * @returns {HTMLElement}
 */
export function renderHoleHeader({ holeIdx, par, stage, shotCount }) {
  const header = document.createElement('div');
  header.className = 'sh-hole-header';

  const title = document.createElement('div');
  title.className = 'sh-hole-title';
  title.innerHTML = `Hole ${holeIdx + 1}<span class="sh-par"> · Par ${par}</span>`;

  const stageEl = document.createElement('div');
  stageEl.className = 'sh-stage-label';

  if (stage === STAGE_SHOTS) {
    stageEl.innerHTML = `Shot <span class="sh-num">${shotCount + 1}</span>`;
  } else if (stage === STAGE_PUTTS) {
    stageEl.textContent = 'Putts';
  } else {
    stageEl.textContent = 'Complete';
  }

  header.appendChild(title);
  header.appendChild(stageEl);
  return header;
}

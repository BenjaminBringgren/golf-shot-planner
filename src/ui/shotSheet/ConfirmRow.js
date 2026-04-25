/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — confirm row (Back+Finish for putts; Edit+Next for result).

import { STAGE_PUTTS, STAGE_RESULT } from '../../app/holeFlow.js';

const ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
  <path d="M5 12H19M13 6L19 12L13 18"/>
</svg>`;

/**
 * @param {object} opts
 * @param {string}   opts.stage
 * @param {number}   opts.holeIdx       0-based
 * @param {number}   opts.totalHoles
 * @param {boolean}  opts.isLastHole
 * @param {Function} opts.onBack        () => void  (putts stage)
 * @param {Function} opts.onFinish      () => void  (putts stage)
 * @param {Function} opts.onEdit        () => void  (result stage)
 * @param {Function} opts.onNext        () => void  (result stage)
 * @returns {HTMLElement}
 */
export function renderConfirmRow({ stage, holeIdx, totalHoles, isLastHole, onBack, onFinish, onEdit, onNext }) {
  const row = document.createElement('div');
  row.className = 'sh-confirm-row';

  if (stage === STAGE_PUTTS) {
    const backBtn = document.createElement('button');
    backBtn.className = 'sh-btn-sec';
    backBtn.type = 'button';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', onBack);

    const finishBtn = document.createElement('button');
    finishBtn.className = 'sh-btn-primary';
    finishBtn.type = 'button';
    finishBtn.innerHTML = `Finish hole ${ARROW_SVG}`;
    finishBtn.addEventListener('click', onFinish);

    row.appendChild(backBtn);
    row.appendChild(finishBtn);
  } else if (stage === STAGE_RESULT) {
    const editBtn = document.createElement('button');
    editBtn.className = 'sh-btn-sec';
    editBtn.type = 'button';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', onEdit);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'sh-btn-primary';
    nextBtn.type = 'button';
    const nextLabel = isLastHole ? 'Finish round' : `Hole ${holeIdx + 2}`;
    nextBtn.innerHTML = `${nextLabel} ${ARROW_SVG}`;
    nextBtn.addEventListener('click', onNext);

    row.appendChild(editBtn);
    row.appendChild(nextBtn);
  }

  return row;
}

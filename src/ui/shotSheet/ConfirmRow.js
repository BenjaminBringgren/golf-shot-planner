/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — confirm row (Back+Finish for putts; Edit+Next for result).

import { STAGE_PUTTS, STAGE_RESULT } from '../../app/holeFlow.js';

const ARROW_SVG = `<svg viewBox="-2.000 -74.459 94.570 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M51.3672-5.95703C52.3926-5.95703 53.3691-6.34766 54.248-7.17773L79.4434-32.3242C80.3223-33.1543 80.8105-34.1797 80.8105-35.2539C80.8105-36.3281 80.3223-37.3535 79.4434-38.1836L54.248-63.3301C53.3691-64.1602 52.3926-64.5508 51.3672-64.5508C49.2188-64.5508 47.5586-62.9395 47.5586-60.7422C47.5586-59.7168 47.9004-58.6914 48.6328-58.0078L55.3711-51.0254L72.8516-35.2539L55.3711-19.4824L48.6328-12.5C47.9004-11.8164 47.5586-10.791 47.5586-9.76562C47.5586-7.56836 49.2188-5.95703 51.3672-5.95703ZM13.6719-31.2988L59.7656-31.2988L72.7539-32.2266C74.5605-32.373 75.7812-33.4473 75.7812-35.2539C75.7812-37.0605 74.5605-38.1348 72.7539-38.2812L59.7656-39.209L13.6719-39.209C11.377-39.209 9.76562-37.5488 9.76562-35.2539C9.76562-32.959 11.377-31.2988 13.6719-31.2988Z"/></svg>`;

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

/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — shot count display for STAGE_PUTTS: "shots + putts = total".

/**
 * @param {object} opts
 * @param {number} opts.shots  approach shots logged
 * @param {number} opts.putts  current putt count
 * @returns {HTMLElement}
 */
export function renderShotCountDisplay({ shots, putts }) {
  const total = shots + putts;

  const el = document.createElement('div');
  el.className = 'sh-shot-count-display';

  function _col(value, label) {
    const col = document.createElement('div');
    col.className = 'sh-scd-col';
    const num = document.createElement('div');
    num.className = 'sh-scd-num';
    num.textContent = value;
    const lbl = document.createElement('div');
    lbl.className = 'sh-scd-label';
    lbl.textContent = label;
    col.appendChild(num);
    col.appendChild(lbl);
    return col;
  }

  function _op(char) {
    const op = document.createElement('div');
    op.className = 'sh-scd-op';
    op.textContent = char;
    return op;
  }

  el.appendChild(_col(shots, 'shots'));
  el.appendChild(_op('+'));
  el.appendChild(_col(putts, 'putts'));
  el.appendChild(_op('='));

  const totalCol = _col(total, 'total');
  totalCol.classList.add('total');
  el.appendChild(totalCol);

  return el;
}

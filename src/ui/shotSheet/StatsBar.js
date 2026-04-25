/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — stats bar (vs Expected + Round score).

import { prefersReducedMotion } from '../../platform/motion.js';

/**
 * @param {object} opts
 * @param {number|null} opts.vsExpected  signed float (actual - expected). null if unavailable.
 * @param {number}      opts.roundScore  signed int vs par
 * @param {boolean}     opts.animate     flip animation on values
 * @returns {HTMLElement}
 */
export function renderStatsBar({ vsExpected, roundScore, animate }) {
  const bar = document.createElement('div');
  bar.className = 'sh-stats';

  bar.appendChild(_stat('vs Expected', _fmtExpected(vsExpected), _classExpected(vsExpected), animate));
  bar.appendChild(_stat('Round', _fmtRound(roundScore), _classRound(roundScore), animate, true));

  return bar;
}

/**
 * Updates an existing stats bar in-place. Avoids full re-render to allow animation.
 * @param {HTMLElement} bar
 * @param {object} opts  same as renderStatsBar
 */
export function updateStatsBar(bar, { vsExpected, roundScore }) {
  const cells = bar.querySelectorAll('.sh-stat-value');
  if (cells.length < 2) return;

  _animateVal(cells[0], _fmtExpected(vsExpected), _classExpected(vsExpected));
  _animateVal(cells[1], _fmtRound(roundScore),    _classRound(roundScore));
}

function _stat(label, value, cls, animate, right) {
  const cell = document.createElement('div');
  cell.className = `sh-stat${right ? ' right' : ''}`;

  const lbl = document.createElement('span');
  lbl.className = 'sh-stat-label';
  lbl.textContent = label;

  const val = document.createElement('span');
  val.className = `sh-stat-value${cls ? ' ' + cls : ''}`;
  if (animate && !prefersReducedMotion()) val.classList.add('flip');
  val.textContent = value;

  cell.appendChild(lbl);
  cell.appendChild(val);
  return cell;
}

function _animateVal(el, text, cls) {
  if (!prefersReducedMotion()) {
    el.classList.remove('flip');
    void el.offsetWidth;
    el.classList.add('flip');
  }
  el.textContent = text;
  el.className = `sh-stat-value${cls ? ' ' + cls : ''}`;
  if (!prefersReducedMotion()) el.classList.add('flip');
}

function _fmtExpected(v) {
  if (v === null || v === undefined) return '—';
  const s = v.toFixed(1);
  return v > 0 ? `+${s}` : s;
}
function _classExpected(v) {
  if (v === null || v === undefined) return '';
  return v < 0 ? 'good' : v > 0 ? 'bad' : '';
}
function _fmtRound(v) {
  if (v === 0) return 'E';
  return v > 0 ? `+${v}` : `${v}`;
}
function _classRound(v) {
  return v < 0 ? 'good' : v > 0 ? 'bad' : '';
}

/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — activity header bar (black pill, pulsing dot).

/**
 * @param {object} opts
 * @param {string} opts.courseName
 * @param {number} opts.holeIdx     0-based
 * @param {number} opts.totalHoles
 * @param {number|null} opts.roundScore  signed integer vs par (null if no holes played)
 * @returns {HTMLElement}
 */
export function renderActivityHeader({ courseName, holeIdx, totalHoles, roundScore }) {
  const bar = document.createElement('div');
  bar.className = 'sh-activity';

  const left = document.createElement('div');
  left.className = 'sh-activity-left';

  const dot = document.createElement('span');
  dot.className = 'sh-activity-dot';
  left.appendChild(dot);

  const label = document.createElement('span');
  label.textContent = `${courseName} · Round active`;
  left.appendChild(label);

  const right = document.createElement('div');
  right.className = 'sh-activity-right';

  const progress = document.createElement('span');
  progress.textContent = `${holeIdx + 1}/${totalHoles}`;
  right.appendChild(progress);

  if (roundScore !== null) {
    const score = document.createElement('span');
    score.className = 'sh-activity-score';
    const diff = roundScore;
    if (diff < 0) {
      score.textContent = `${diff}`;
      score.classList.add('good');
    } else if (diff > 0) {
      score.textContent = `+${diff}`;
      score.classList.add('bad');
    } else {
      score.textContent = 'E';
    }
    right.appendChild(score);
  }

  bar.appendChild(left);
  bar.appendChild(right);
  return bar;
}

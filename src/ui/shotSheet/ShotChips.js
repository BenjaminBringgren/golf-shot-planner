/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — shot history chips + trailing undo button.

import { prefersReducedMotion } from '../../platform/motion.js';

const LIE_CLASS = {
  tee: 'tee', fw: 'fw', rough: 'rough', sand: 'sand',
  green: 'green', penalty: 'penalty',
};
const LIE_LABEL = {
  tee: 'Tee', fw: 'FW', rough: 'Rough', sand: 'Sand',
  green: 'Green', penalty: 'Pen.',
};

/**
 * @param {object} opts
 * @param {string[]} opts.shots   lie array
 * @param {boolean}  opts.showHint  unused, kept for API compatibility
 * @param {Function} opts.onUndo  () => void — called when undo tapped
 * @returns {HTMLElement}
 */
export function renderShotChips({ shots, showHint, onUndo }) {
  const wrap = document.createElement('div');
  wrap.className = 'sh-chips';

  shots.forEach((lie, i) => {
    const chip = document.createElement('button');
    chip.className = `sh-chip ${LIE_CLASS[lie] ?? 'fw'}${i === shots.length - 1 ? ' last' : ''}`;
    if (prefersReducedMotion()) chip.style.animation = 'none';

    const numSpan = document.createElement('span');
    numSpan.className = 'sh-chip-n';
    numSpan.textContent = i + 1;
    chip.appendChild(numSpan);
    chip.appendChild(document.createTextNode(LIE_LABEL[lie] ?? lie));

    wrap.appendChild(chip);
  });

  if (onUndo) {
    const undoBtn = document.createElement('button');
    undoBtn.className = 'sh-chip-undo';
    undoBtn.type = 'button';
    undoBtn.setAttribute('aria-label', 'Undo last shot');
    undoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>
    </svg>`;
    if (shots.length <= 1) undoBtn.disabled = true;
    undoBtn.addEventListener('click', onUndo);
    wrap.appendChild(undoBtn);
  }

  return wrap;
}

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
    undoBtn.innerHTML = `<svg viewBox="-2.000 -74.459 85.830 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M40.918 1.75781C59.7656 1.75781 75-13.5254 75-32.3242C75-51.1719 59.7656-66.4062 40.918-66.4062C37.0117-66.4062 33.252-65.7715 29.7852-64.502C28.6621-64.1113 26.9531-63.3789 26.9531-61.084C26.9531-58.3008 29.6387-57.0312 31.8848-57.9102C34.7168-58.9355 37.793-59.4238 40.918-59.4238C55.8594-59.4238 67.9688-47.3145 67.9688-32.373C67.9688-17.4316 55.8594-5.37109 40.918-5.37109C25.9766-5.37109 13.8672-17.4316 13.8672-32.373C13.8672-34.3262 12.3047-35.8887 10.3516-35.8887C8.44727-35.8887 6.83594-34.3262 6.83594-32.373C6.83594-13.5254 22.0703 1.75781 40.918 1.75781ZM31.1523-61.6699L44.4336-74.7559C45.0684-75.3906 45.3613-76.3184 45.3613-77.2461C45.3613-79.248 43.8477-80.8594 41.9434-80.8594C40.8691-80.8594 40.0391-80.4199 39.4043-79.7852L23.9746-64.1602C23.3398-63.5254 22.9492-62.5977 22.9492-61.6699C22.9492-60.6445 23.291-59.8145 23.9746-59.1309L39.4043-43.7012C40.0391-43.1152 40.8691-42.7246 41.9434-42.7246C43.8477-42.7246 45.3613-44.2383 45.3613-46.2402C45.3613-47.1191 45.0684-48.0469 44.3848-48.6816Z"/></svg>`;
    if (shots.length <= 1) undoBtn.disabled = true;
    undoBtn.addEventListener('click', onUndo);
    wrap.appendChild(undoBtn);
  }

  return wrap;
}

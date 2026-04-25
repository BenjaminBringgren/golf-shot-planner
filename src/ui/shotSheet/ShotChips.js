/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — shot history chips, swipe-to-undo, long-press popover.

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
 * @param {string[]} opts.shots     lie array
 * @param {boolean}  opts.showHint  show "← swipe to undo" hint after last chip
 * @param {Function} opts.onUndo    () => void — called when undo confirmed
 * @returns {HTMLElement}
 */
export function renderShotChips({ shots, showHint, onUndo }) {
  const wrap = document.createElement('div');
  wrap.className = 'sh-chips';

  const undoReveal = document.createElement('span');
  undoReveal.className = 'sh-chip-undo-reveal';
  undoReveal.textContent = 'Undo';

  shots.forEach((lie, i) => {
    const isLast = i === shots.length - 1;
    const chip = document.createElement('button');
    chip.className = `sh-chip ${LIE_CLASS[lie] ?? 'fw'}${isLast ? ' last' : ''}`;
    if (prefersReducedMotion()) chip.style.animation = 'none';

    const numSpan = document.createElement('span');
    numSpan.className = 'sh-chip-n';
    numSpan.textContent = i + 1;
    chip.appendChild(numSpan);
    chip.appendChild(document.createTextNode(LIE_LABEL[lie] ?? lie));

    // Swipe-to-undo on the last chip via Pointer Events
    if (isLast && onUndo) {
      _wireSwipeUndo(chip, undoReveal, onUndo);
      _wireLongPress(chip, onUndo);
    } else if (onUndo) {
      // Long-press on any other chip also allows undo (accessibility)
      _wireLongPress(chip, onUndo);
    }

    wrap.appendChild(chip);
  });

  if (shots.length > 0) wrap.appendChild(undoReveal);

  if (showHint && shots.length > 0) {
    const hint = document.createElement('span');
    hint.className = 'sh-chip-hint';
    hint.textContent = '← swipe to undo';
    wrap.appendChild(hint);
  }

  return wrap;
}

// ── Swipe-to-undo (Pointer Events, works for touch + mouse) ──────────────────
function _wireSwipeUndo(chip, undoReveal, onUndo) {
  let startX = null;
  let deltaX = 0;
  const THRESHOLD = 60;

  chip.addEventListener('pointerdown', e => {
    startX = e.clientX;
    deltaX = 0;
    chip.setPointerCapture(e.pointerId);
  }, { passive: true });

  chip.addEventListener('pointermove', e => {
    if (startX === null) return;
    deltaX = startX - e.clientX; // positive = swiping left
    if (deltaX > 8) {
      const clamped = Math.min(deltaX, THRESHOLD + 20);
      chip.style.transform = `translateX(-${clamped}px)`;
      undoReveal.classList.toggle('visible', deltaX > 20);
    }
  }, { passive: true });

  chip.addEventListener('pointerup', () => {
    if (startX === null) return;
    startX = null;
    chip.style.transition = 'transform 0.2s ease';
    if (deltaX >= THRESHOLD) {
      chip.style.transform = 'translateX(-120%)';
      undoReveal.classList.remove('visible');
      setTimeout(() => onUndo(), 180);
    } else {
      chip.style.transform = '';
      undoReveal.classList.remove('visible');
    }
    setTimeout(() => { chip.style.transition = ''; }, 220);
  });

  chip.addEventListener('pointercancel', () => {
    startX = null;
    chip.style.transform = '';
    chip.style.transition = '';
    undoReveal.classList.remove('visible');
  });
}

// ── Long-press popover (accessibility fallback) ───────────────────────────────
function _wireLongPress(chip, onUndo) {
  let timer = null;

  function cancel() { clearTimeout(timer); timer = null; }

  chip.addEventListener('pointerdown', () => {
    timer = setTimeout(() => {
      timer = null;
      _showPopover(chip, onUndo);
    }, 500);
  }, { passive: true });

  chip.addEventListener('pointerup',     cancel);
  chip.addEventListener('pointercancel', cancel);
  chip.addEventListener('pointermove',   cancel);
}

function _showPopover(anchorEl, onUndo) {
  // Scrim to close on outside tap
  const scrim = document.createElement('div');
  scrim.className = 'sh-popover-scrim';

  const pop = document.createElement('div');
  pop.className = 'sh-chip-popover';

  function close() { scrim.remove(); pop.remove(); }

  const undoItem = document.createElement('div');
  undoItem.className = 'sh-popover-item danger';
  undoItem.textContent = 'Undo shot';
  undoItem.addEventListener('click', () => { close(); onUndo(); });

  const cancelItem = document.createElement('div');
  cancelItem.className = 'sh-popover-item';
  cancelItem.textContent = 'Cancel';
  cancelItem.addEventListener('click', close);

  pop.appendChild(undoItem);
  pop.appendChild(cancelItem);

  scrim.addEventListener('click', close);

  // Position below the chip
  const rect = anchorEl.getBoundingClientRect();
  pop.style.top  = `${rect.bottom + 6}px`;
  pop.style.left = `${Math.max(8, rect.left)}px`;

  document.body.appendChild(scrim);
  document.body.appendChild(pop);
}

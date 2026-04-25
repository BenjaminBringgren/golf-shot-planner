/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — 2×2 lie grid: FW / Rough / Sand / Green.
// No Tee tile — tee is auto-logged by the stage machine.

import { prefersReducedMotion } from '../../platform/motion.js';
import { commit as hapticCommit } from '../../platform/haptics.js';

const LIES = [
  {
    key: 'fw', cls: 'fw', label: 'Fairway',
    icon: `<svg viewBox="0 0 24 24" fill="currentColor" class="sh-lie-icon">
      <path d="M12 2L22 20H2Z" opacity="0.25"/>
      <path d="M12 6L19 19H5Z"/>
    </svg>`,
  },
  {
    key: 'rough', cls: 'rough', label: 'Rough',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="sh-lie-icon">
      <path d="M3 20V14M7 20V10M11 20V12M15 20V9M19 20V13"/>
    </svg>`,
  },
  {
    key: 'sand', cls: 'sand', label: 'Sand',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="sh-lie-icon">
      <path d="M3 12Q7 8 12 12T21 12"/><path d="M3 17Q7 13 12 17T21 17"/>
    </svg>`,
  },
  {
    key: 'green', cls: 'green', label: 'Green',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="sh-lie-icon">
      <path d="M5 21V4L15 8L5 12"/><circle cx="17" cy="18" r="2" fill="currentColor"/>
    </svg>`,
  },
];

/**
 * @param {object} opts
 * @param {Function} opts.onLie  (lie: string) => void
 * @returns {HTMLElement}
 */
export function renderLieGrid({ onLie }) {
  const grid = document.createElement('div');
  grid.className = 'sh-lies';

  LIES.forEach(({ key, cls, label, icon }) => {
    const btn = document.createElement('button');
    btn.className = `sh-lie ${cls}`;
    btn.type = 'button';

    btn.innerHTML = icon + `<span class="sh-lie-label">${label}</span>`;

    // Ripple element
    const ripple = document.createElement('span');
    ripple.className = 'sh-lie-ripple';
    btn.appendChild(ripple);

    btn.addEventListener('pointerdown', e => {
      // Spring scale handled by CSS :active
      if (!prefersReducedMotion()) {
        // Position ripple at touch point
        const rect = btn.getBoundingClientRect();
        ripple.style.left = `${e.clientX - rect.left}px`;
        ripple.style.top  = `${e.clientY - rect.top}px`;
      }
    });

    btn.addEventListener('click', () => {
      hapticCommit();
      if (!prefersReducedMotion()) {
        ripple.classList.remove('go');
        void ripple.offsetWidth; // force reflow
        ripple.classList.add('go');
      }
      // Brief visual feedback before committing so the animation is visible
      setTimeout(() => onLie(key), key === 'green' ? 200 : 60);
    });

    grid.appendChild(btn);
  });

  return grid;
}

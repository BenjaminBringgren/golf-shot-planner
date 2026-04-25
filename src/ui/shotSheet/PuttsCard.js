/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — putts card: big numeral, 1/2/3/4+ quick-picks, 4+ stepper.

import { tap as hapticTap } from '../../platform/haptics.js';
import { prefersReducedMotion } from '../../platform/motion.js';

/**
 * @param {object} opts
 * @param {number}   opts.putts    current putt count
 * @param {Function} opts.onChange (n: number) => void
 * @returns {HTMLElement}
 */
export function renderPuttsCard({ putts, onChange }) {
  const wrap = document.createElement('div');
  wrap.className = 'sh-putts-wrap';

  const card = document.createElement('div');
  card.className = 'sh-putts-card';

  // Big numeral
  const numEl = document.createElement('div');
  numEl.className = 'sh-putts-number';
  numEl.textContent = putts;

  const subEl = document.createElement('div');
  subEl.className = 'sh-putts-sub';
  subEl.textContent = 'putts on the green';

  // Quick-picks row
  const quickRow = document.createElement('div');
  quickRow.className = 'sh-quick-putts';

  // Stepper (hidden until 4+ selected)
  const stepperWrap = document.createElement('div');
  stepperWrap.className = 'sh-putts-stepper';

  const minusBtn = document.createElement('button');
  minusBtn.className = 'sh-stepper-btn';
  minusBtn.type = 'button';
  minusBtn.textContent = '−';

  const stepVal = document.createElement('span');
  stepVal.className = 'sh-stepper-val';
  stepVal.textContent = putts >= 4 ? putts : 5;

  const plusBtn = document.createElement('button');
  plusBtn.className = 'sh-stepper-btn';
  plusBtn.type = 'button';
  plusBtn.textContent = '+';

  stepperWrap.appendChild(minusBtn);
  stepperWrap.appendChild(stepVal);
  stepperWrap.appendChild(plusBtn);

  let stepCount = putts >= 4 ? putts : 5;
  let showingStepper = putts >= 4;

  function setNum(n, animate) {
    if (animate && !prefersReducedMotion()) {
      numEl.classList.remove('flip');
      void numEl.offsetWidth;
      numEl.classList.add('flip');
    }
    numEl.textContent = n;
  }

  function updateQuickActive(val) {
    quickBtns.forEach((b, i) => {
      const v = i < 3 ? i + 1 : '4+';
      b.classList.toggle('active', val === v || (i === 3 && val === '4+') || (typeof val === 'number' && val >= 4 && i === 3));
    });
  }

  // Build quick-pick buttons
  const labels = ['1', '2', '3', '4+'];
  const quickBtns = labels.map((lbl, idx) => {
    const btn = document.createElement('button');
    btn.className = 'sh-quick-putt';
    btn.type = 'button';
    btn.textContent = lbl;
    if ((idx < 3 && putts === idx + 1) || (idx === 3 && putts >= 4)) {
      btn.classList.add('active');
    }

    btn.addEventListener('click', () => {
      hapticTap();
      if (idx < 3) {
        // Simple quick-pick 1–3
        const n = idx + 1;
        showingStepper = false;
        stepperWrap.classList.remove('visible');
        stepCount = 5;
        stepVal.textContent = 5;
        setNum(n, true);
        quickBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(n);
      } else {
        // 4+ — show stepper
        showingStepper = true;
        stepperWrap.classList.add('visible');
        quickBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setNum(stepCount, true);
        onChange(stepCount);
      }
    });

    quickRow.appendChild(btn);
    return btn;
  });

  // Show stepper immediately if putts >= 4
  if (putts >= 4) {
    stepperWrap.classList.add('visible');
    stepCount = putts;
    stepVal.textContent = putts;
  }

  minusBtn.addEventListener('click', () => {
    if (stepCount > 4) {
      stepCount--;
      stepVal.textContent = stepCount;
      setNum(stepCount, true);
      onChange(stepCount);
      hapticTap();
    }
  });

  plusBtn.addEventListener('click', () => {
    stepCount++;
    stepVal.textContent = stepCount;
    setNum(stepCount, true);
    onChange(stepCount);
    hapticTap();
  });

  card.appendChild(numEl);
  card.appendChild(subEl);
  card.appendChild(quickRow);
  card.appendChild(stepperWrap);
  wrap.appendChild(card);
  return wrap;
}

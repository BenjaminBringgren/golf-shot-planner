/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — simple score counter.
// Mounts into the score drawer. Large number + +/- + confirm.

import { renderActivityHeader } from './ActivityHeader.js';
import { renderHoleHeader }     from './HoleHeader.js';
import { renderStatsBar }       from './StatsBar.js';
import { loadScores, saveScores, loadCourses } from '../../storage/storage.js';

let _swipeController = null;

/**
 * @param {object} opts
 * @param {string}   opts.courseId
 * @param {number}   opts.holeIdx    0-based
 * @param {number}   opts.par
 * @param {object}   opts.callbacks  buildCallbacks() object from router.js
 */
export function mountSimpleCounter({ courseId, holeIdx, par, callbacks }) {
  const drawer  = document.getElementById('scoreDrawer');
  const inner   = document.getElementById('scoreDrawerInner');
  const overlay = document.getElementById('scoreDrawerOverlay');
  if (!drawer || !inner) return;

  drawer.classList.add('sh-expanded');

  // Load initial count from saved score (fairway field = total in simple mode)
  function _savedTotal() {
    const scores = loadScores(courseId);
    const s = scores[holeIdx];
    if (s?.scoringMode === 'simple') return s.fairway ?? 0;
    return 0;
  }

  let _count = _savedTotal();

  function _save() {
    const scores = loadScores(courseId);
    scores[holeIdx] = { fairway: _count, rough: 0, putts: 0, gir: null, fir: null, scoringMode: 'simple' };
    saveScores(courseId, scores);
  }

  function _updateFab() {
    const fab = document.getElementById('scoreFab');
    if (!fab) return;
    if (_count > 0) {
      fab.textContent = String(_count);
      fab.classList.add('has-score');
    } else {
      fab.textContent = '+';
      fab.classList.remove('has-score');
    }
  }

  // ── Open / close ─────────────────────────────────────────────────────────
  function openDrawer() {
    _render();
    overlay.classList.add('visible');
    drawer.classList.add('open');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
  }

  // ── FAB ──────────────────────────────────────────────────────────────────
  const fab = document.getElementById('scoreFab');
  if (fab) {
    const newFab = fab.cloneNode(true);
    fab.parentNode.replaceChild(newFab, fab);
    newFab.classList.add('visible');
    _updateFab();
    newFab.addEventListener('click', () => {
      if (drawer.classList.contains('open')) closeDrawer();
      else openDrawer();
    });
  }

  // Close on overlay tap
  const newOverlay = overlay.cloneNode(false);
  overlay.parentNode.replaceChild(newOverlay, overlay);
  newOverlay.className = overlay.className;
  newOverlay.addEventListener('click', closeDrawer);

  _wireSwipeDown(drawer, closeDrawer);

  // ── Render ────────────────────────────────────────────────────────────────
  function _render() {
    inner.innerHTML = '';

    const courses = loadCourses();
    const course  = courses[courseId];
    if (!course) return;

    const totalHoles = course.holes.length;
    const isLastHole = holeIdx === totalHoles - 1;

    // Round score (vs par, completed holes only)
    const scores = loadScores(courseId);
    let runDiff = 0;
    scores.forEach((s, i) => {
      if (!s || i === holeIdx) return;
      const total = s.scoringMode === 'simple'
        ? (s.fairway ?? 0)
        : (s.fairway ?? 0) + (s.rough ?? 0) + (s.putts ?? 0);
      runDiff += total - (course.holes[i]?.par ?? 4);
    });

    inner.appendChild(renderActivityHeader({
      courseName: course.name ?? 'Course',
      holeIdx,
      totalHoles,
      roundScore: runDiff,
    }));

    inner.appendChild(renderHoleHeader({ holeIdx, par }));

    // ── Counter area ────────────────────────────────────────────────────
    const counterArea = document.createElement('div');
    counterArea.className = 'sh-simple-counter';

    const numEl = document.createElement('div');
    numEl.className = 'sh-shot-count';
    numEl.textContent = _count;
    counterArea.appendChild(numEl);

    const btnRow = document.createElement('div');
    btnRow.className = 'sh-simple-btn-row';

    const minusBtn = document.createElement('button');
    minusBtn.className = 'sh-simple-btn';
    minusBtn.type = 'button';
    minusBtn.textContent = '−';
    minusBtn.disabled = _count <= 0;
    minusBtn.addEventListener('click', () => {
      if (_count <= 0) return;
      _count--;
      numEl.textContent = _count;
      minusBtn.disabled = _count <= 0;
    });

    const plusBtn = document.createElement('button');
    plusBtn.className = 'sh-simple-btn';
    plusBtn.type = 'button';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      _count++;
      numEl.textContent = _count;
      minusBtn.disabled = false;
    });

    btnRow.appendChild(minusBtn);
    btnRow.appendChild(plusBtn);
    counterArea.appendChild(btnRow);
    inner.appendChild(counterArea);

    // ── Confirm row ─────────────────────────────────────────────────────
    const confirmRow = document.createElement('div');
    confirmRow.className = 'sh-confirm-row sh-confirm-row--single';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'sh-btn-primary';
    confirmBtn.type = 'button';
    const nextLabel = isLastHole ? 'Finish round' : `Save · Hole ${holeIdx + 2}`;
    confirmBtn.innerHTML = `${nextLabel} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12H19M13 6L19 12L13 18"/></svg>`;
    confirmBtn.addEventListener('click', () => {
      _save();
      _updateFab();
      closeDrawer();
      const bar = document.getElementById('playCourseBar');
      if (bar?._refreshGrid) bar._refreshGrid();
      if (isLastHole) {
        callbacks.showRoundComplete?.(courseId, holeIdx);
      } else {
        if (bar?._navigateTo) bar._navigateTo(holeIdx + 1);
      }
    });

    confirmRow.appendChild(confirmBtn);
    inner.appendChild(confirmRow);

    inner.appendChild(renderStatsBar({ vsExpected: null, roundScore: runDiff, animate: false }));

    _updateFab();
  }

  if (drawer.classList.contains('open')) _render();

  return { openDrawer, closeDrawer };
}

// ── Swipe-down to close ───────────────────────────────────────────────────────
function _wireSwipeDown(drawer, close) {
  if (_swipeController) _swipeController.abort();
  _swipeController = new AbortController();
  const signal = _swipeController.signal;

  let startY = null, cur = 0, active = false;

  drawer.addEventListener('touchstart', (e) => {
    if (e.target.closest('button, input, select')) return;
    startY = e.touches[0].clientY; cur = 0; active = false;
  }, { passive: true, signal });

  drawer.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (!active && dy > 10) { active = true; drawer.style.transition = 'none'; }
    if (!active) return;
    cur = Math.max(0, dy);
    drawer.style.transform = `translateY(${cur}px)`;
  }, { passive: true, signal });

  drawer.addEventListener('touchend', () => {
    if (startY === null) return;
    startY = null; drawer.style.transition = '';
    if (cur > 80) { close(); drawer.style.transform = ''; }
    else drawer.style.transform = '';
    active = false; cur = 0;
  }, { signal });
}

/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — shot sheet orchestrator.
// Mounts into the existing score drawer. Re-renders on stage-machine state changes.

import { STAGE_SHOTS, STAGE_PUTTS, STAGE_RESULT } from '../../app/holeFlow.js';
import { renderActivityHeader }   from './ActivityHeader.js';
import { renderHoleHeader }       from './HoleHeader.js';
import { renderShotChips }        from './ShotChips.js';
import { renderPrompt }           from './Prompt.js';
import { renderLieGrid }          from './LieGrid.js';
import { renderSecondaryActions } from './SecondaryActions.js';
import { renderPuttsCard }        from './PuttsCard.js';
import { renderShotCountDisplay } from './ShotCountDisplay.js';
import { renderConfirmRow }       from './ConfirmRow.js';
import { renderResultBar }        from './ResultBar.js';
import { renderStatsBar }         from './StatsBar.js';
import { success as hapticSuccess } from '../../platform/haptics.js';
import { loadScores, loadCourses } from '../../storage/storage.js';

/**
 * Mount the shot sheet into the score drawer inner container.
 *
 * @param {object} opts
 * @param {string}   opts.courseId
 * @param {number}   opts.holeIdx    0-based
 * @param {object}   opts.callbacks  buildCallbacks() object from router.js
 */
export function mountShotSheet({ courseId, holeIdx, callbacks }) {
  const drawer  = document.getElementById('scoreDrawer');
  const inner   = document.getElementById('scoreDrawerInner');
  const overlay = document.getElementById('scoreDrawerOverlay');
  if (!drawer || !inner) return;

  // Expand drawer for shot sheet
  drawer.classList.add('sh-expanded');

  let _unsubscribe = null;

  // ── Open / close helpers ─────────────────────────────────────────────────
  function openDrawer() {
    _render();
    overlay.classList.add('visible');
    drawer.classList.add('open');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
  }

  // ── FAB wiring ───────────────────────────────────────────────────────────
  const fab = document.getElementById('scoreFab');
  if (fab) {
    const newFab = fab.cloneNode(true);
    fab.parentNode.replaceChild(newFab, fab);
    newFab.classList.add('visible');
    _updateFab(newFab, courseId, holeIdx);

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

  // Swipe-down to close (on handle + title area)
  _wireSwipeDown(drawer, closeDrawer);

  // ── Subscribe to state machine ───────────────────────────────────────────
  if (_unsubscribe) _unsubscribe();
  _unsubscribe = callbacks.subscribeHoleFlow?.(_render) ?? null;

  // ── Main render ──────────────────────────────────────────────────────────
  function _render() {
    const state = callbacks.getHoleFlowState?.();
    if (!state) return;

    inner.innerHTML = '';

    const courses = loadCourses();
    const course  = courses[courseId];
    if (!course) return;

    const totalHoles = course.holes.length;
    const holePar    = course.holes[holeIdx]?.par ?? 4;
    const isLastHole = holeIdx === totalHoles - 1;

    // Compute round score (vs par for completed holes)
    const scores = loadScores(courseId);
    let runDiff = 0;
    scores.forEach((s, i) => {
      if (!s || i === holeIdx) return;
      const total = (s.fairway ?? 0) + (s.rough ?? 0) + (s.putts ?? 0);
      runDiff += total - (course.holes[i]?.par ?? 4);
    });
    // Add current hole contribution in putts and result stages
    if (state.stage === STAGE_PUTTS || state.stage === STAGE_RESULT) {
      runDiff += state.totalShots - holePar;
    }

    // Expected strokes for stats bar
    let vsExpected = null;
    if (state.getExpectedStrokes && state.stage !== STAGE_RESULT) {
      // Remaining ≈ 0 if on green; pass inRough flag
      const remaining = state.stage === STAGE_PUTTS ? 0 : null;
      if (remaining !== null) {
        const expected = state.getExpectedStrokes(remaining, state.inRough);
        vsExpected = state.totalShots - expected;
      }
    }
    if (state.stage === STAGE_RESULT) {
      if (state.holeExpected != null) {
        vsExpected = state.totalShots - state.holeExpected;
      } else if (state.getExpectedStrokes) {
        vsExpected = state.totalShots - state.getExpectedStrokes(0, false);
      }
    }

    // ── Activity header ─────────────────────────────────────────────────
    inner.appendChild(renderActivityHeader({
      courseName: course.name ?? 'Course',
      holeIdx,
      totalHoles,
      roundScore: runDiff,
    }));

    // ── Hole header ─────────────────────────────────────────────────────
    inner.appendChild(renderHoleHeader({
      holeIdx,
      par: holePar,
    }));

    // ── Shot chips ──────────────────────────────────────────────────────
    inner.appendChild(renderShotChips({
      shots: state.shots,
      showHint: state.stage === STAGE_SHOTS && state.shots.length > 1,
      onUndo: () => callbacks.undoLastShot?.(),
    }));

    // ── Stage-specific content ──────────────────────────────────────────
    if (state.stage === STAGE_SHOTS) {
      inner.appendChild(renderPrompt({ stage: STAGE_SHOTS, shotCount: state.shots.length }));
      inner.appendChild(renderLieGrid({
        onLie: (lie) => {
          callbacks.commitShot?.(lie);
          // Re-render is triggered by the subscriber
        },
      }));
      inner.appendChild(renderSecondaryActions({
        onPenalty:  () => callbacks.penaltyShot?.(),
        onHoledOut: () => callbacks.holeOut?.(),
      }));
      inner.appendChild(renderStatsBar({ vsExpected, roundScore: runDiff, animate: false }));

    } else if (state.stage === STAGE_PUTTS) {
      inner.appendChild(renderShotCountDisplay({ shots: state.shots.length, putts: state.putts }));
      inner.appendChild(renderPuttsCard({
        putts: state.putts,
        onChange: (n) => callbacks.setPutts?.(n),
      }));
      inner.appendChild(renderConfirmRow({
        stage: STAGE_PUTTS,
        holeIdx, totalHoles, isLastHole,
        onBack:   () => callbacks.backToPutts?.(),
        onFinish: () => {
          hapticSuccess();
          callbacks.finishHole?.();
        },
        onEdit: null, onNext: null,
      }));
      inner.appendChild(renderStatsBar({ vsExpected: null, roundScore: runDiff, animate: false }));

    } else if (state.stage === STAGE_RESULT) {
      inner.appendChild(renderResultBar({
        tier:          state.tier,
        shots:         state.shots,
        putts:         state.putts,
        par:           holePar,
        holeIdx,
        milestones:    state.milestones,
        isFirstOfType: state.isFirstOfType,
        isLastHole,
        onNext: null, // Next is always in ConfirmRow below
      }));

      // Haptic only for celebrations
      if (['celebration_birdie','celebration_eagle','celebration_albatross','celebration_hio'].includes(state.tier)) {
        hapticSuccess();
      }

      // Always show Edit + Next in result stage
      inner.appendChild(renderConfirmRow({
        stage: STAGE_RESULT,
        holeIdx, totalHoles, isLastHole,
        onBack: null, onFinish: null,
        onEdit: () => callbacks.editHole?.(),
        onNext: () => _handleNext(state, isLastHole, courseId, holeIdx, callbacks),
      }));

      inner.appendChild(renderStatsBar({ vsExpected, roundScore: runDiff, animate: true }));
    }

    // Update FAB label
    const liveFab = document.getElementById('scoreFab');
    if (liveFab) _updateFab(liveFab, courseId, holeIdx);

    // Refresh hole grid in course bar
    const bar = document.getElementById('playCourseBar');
    if (bar?._refreshGrid) bar._refreshGrid();
  }

  // Render immediately if drawer is open
  if (drawer.classList.contains('open')) _render();

  return { openDrawer, closeDrawer };
}

// ── Next hole / finish round ──────────────────────────────────────────────────
function _handleNext(state, isLastHole, courseId, holeIdx, callbacks) {
  const scores = loadScores(courseId);
  const nextIdx = callbacks.nextHole?.(scores);
  if (isLastHole) {
    // Close drawer, trigger round-complete overlay
    document.getElementById('scoreDrawer')?.classList.remove('open');
    document.getElementById('scoreDrawerOverlay')?.classList.remove('visible');
    callbacks.showRoundComplete?.(courseId, holeIdx);
  } else {
    // Navigate the course bar to the next hole
    const bar = document.getElementById('playCourseBar');
    if (bar?._navigateTo) bar._navigateTo(nextIdx ?? holeIdx + 1);
    document.getElementById('scoreDrawer')?.classList.remove('open');
    document.getElementById('scoreDrawerOverlay')?.classList.remove('visible');
  }
}

// ── FAB label update ─────────────────────────────────────────────────────────
function _updateFab(fab, courseId, holeIdx) {
  const scores = loadScores(courseId);
  const s = scores[holeIdx];
  if (s) {
    const total = (s.fairway ?? 0) + (s.rough ?? 0) + (s.putts ?? 0);
    fab.textContent = String(total);
    fab.classList.add('has-score');
  } else {
    fab.textContent = '+';
    fab.classList.remove('has-score');
  }
}

// ── Swipe-down to close (entire drawer surface) ──────────────────────────────
// Uses AbortController so re-mounting a new hole doesn't stack listeners.
let _swipeController = null;

function _wireSwipeDown(drawer, close) {
  if (_swipeController) _swipeController.abort();
  _swipeController = new AbortController();
  const signal = _swipeController.signal;

  let startY = null, cur = 0, active = false;

  drawer.addEventListener('touchstart', (e) => {
    // Don't intercept taps on interactive controls
    if (e.target.closest('button, input, select')) return;
    startY = e.touches[0].clientY;
    cur = 0; active = false;
  }, { passive: true, signal });

  drawer.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    // Require a clear downward intent before committing the gesture
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

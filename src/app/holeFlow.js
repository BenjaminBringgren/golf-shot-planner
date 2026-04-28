/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 2 — app — hole-flow stage machine.
// Manages STAGE_SHOTS → STAGE_PUTTS → STAGE_RESULT transitions.
// Imports from engine and storage only. Never imports from src/ui/.

import { detectMilestones } from '../engine/milestones.js';
import { classifyHoleResult, isFirstOfCelebrationType } from '../engine/resultTier.js';
import {
  loadScores, saveScores,
  loadHoleFlowState, saveHoleFlowState, clearHoleFlowState,
} from '../storage/storage.js';

export const STAGE_SHOTS  = 'shots';
export const STAGE_PUTTS  = 'putts';
export const STAGE_RESULT = 'result';

const ROUGH_LIES = new Set(['rough', 'sand', 'penalty']);

// ── Module state ──────────────────────────────────────────────────────────────
let _courseId  = null;
let _holeIdx   = null;
let _par       = 4;
let _stage     = STAGE_SHOTS;
let _shots     = [];   // string[] of lie names, e.g. ['tee', 'rough', 'fw', 'green']
let _putts     = 2;
let _holedFromLie = null; // lie of the shot that holed out (non-putt path)
let _milestones   = [];

// Injected callback — returns expected strokes remaining for the stats bar.
// Signature: (remaining: number, inRough: boolean) => number
let _getExpectedStrokes = null;

// Expected score for this hole captured at tee time (from the carousel's best plan).
// Used for vs-Expected at STAGE_RESULT. Locked once set so mid-hole recalculates don't overwrite it.
let _holeExpected = null;

const _listeners = [];

// ── Pub-sub ───────────────────────────────────────────────────────────────────
export function subscribe(fn) {
  _listeners.push(fn);
  return function unsubscribe() {
    const i = _listeners.indexOf(fn);
    if (i !== -1) _listeners.splice(i, 1);
  };
}

function _notify() {
  const s = getState();
  _listeners.forEach(fn => fn(s));
}

// ── Service injection ─────────────────────────────────────────────────────────
export function initHoleFlowServices({ getExpectedStrokes }) {
  _getExpectedStrokes = getExpectedStrokes;
}

// Called by router.js after computePlan(). Only locks in the first value — mid-hole
// recalculates (e.g. after a bad tee shot) must not overwrite the tee-time baseline.
export function setHoleExpected(score) {
  if (_holeExpected === null && score != null && isFinite(score)) {
    _holeExpected = score;
  }
}

// ── Init / reset for a new hole ───────────────────────────────────────────────
export function initHole(courseId, holeIdx, par, gpsShotCount) {
  _courseId = courseId;
  _holeIdx  = holeIdx;
  _par      = par;
  _milestones = [];

  // Try resuming from persisted mid-hole state first
  const saved = loadHoleFlowState(courseId, holeIdx);
  if (saved && saved.stage) {
    _stage        = saved.stage;
    _shots        = saved.shots ?? [];
    _putts        = saved.putts ?? 2;
    _holedFromLie = saved.holedFromLie ?? null;
    _milestones   = saved.milestones ?? [];
    _holeExpected = saved.holeExpected ?? null;
    _notify();
    return;
  }

  // Restore a hole that was already completed this round
  const roundScores = loadScores(courseId);
  const done = roundScores[holeIdx];
  if (done?.scoringMode === 'advanced' && Array.isArray(done.shots)) {
    _stage        = STAGE_RESULT;
    _shots        = [...done.shots];
    _putts        = done.putts ?? 0;
    _holedFromLie = done.holedFromLie ?? 'green';
    _milestones   = done.milestones ?? [];
    _notify();
    return;
  }

  // Fresh hole — auto-log Tee as shot 1
  _stage        = STAGE_SHOTS;
  _holedFromLie = null;
  _holeExpected = null;
  _shots        = ['tee'];

  // GPS pre-fill: if GPS tracked N shots, pre-fill shots 2..N as 'fw'
  if (gpsShotCount > 1) {
    for (let i = 1; i < gpsShotCount; i++) _shots.push('fw');
  }

  _putts = 2;
  _persist();
  _notify();
}

// ── Derived helpers ───────────────────────────────────────────────────────────
function _derivedFairway() { return _shots.filter(s => !ROUGH_LIES.has(s)).length; }
function _derivedRough()   { return _shots.filter(s => ROUGH_LIES.has(s)).length; }
function _autoFir() {
  if (_par <= 3 || _shots.length < 2) return null;
  return !ROUGH_LIES.has(_shots[1]);
}
function _autoGir() {
  return _shots.length <= (_par - 2);
}
function _inRough() {
  return _derivedRough() > 0;
}
function _totalShots() {
  return _shots.length + _putts;
}
function _remaining(holeLengthM) {
  // Rough approximation for stats bar — caller supplies hole length if available
  return Math.max(0, (holeLengthM ?? 0));
}

// ── Persist mid-hole state ────────────────────────────────────────────────────
function _persist() {
  if (!_courseId) return;
  saveHoleFlowState(_courseId, _holeIdx, {
    stage: _stage, shots: _shots, putts: _putts,
    holedFromLie: _holedFromLie, milestones: _milestones,
    holeExpected: _holeExpected,
  });
}

// ── Save completed hole to round scores ──────────────────────────────────────
function _commitHole(scores) {
  const fairway = _derivedFairway();
  const rough   = _derivedRough();
  const gir     = _holedFromLie != null ? (_shots.length <= (_par - 2)) : _autoGir();

  // Detect milestones against the in-progress round
  const holeRecord = {
    par: _par, shots: [..._shots], putts: _putts,
    penalties: _shots.filter(s => s === 'penalty').length,
    holedFromLie: _holedFromLie ?? _shots[_shots.length - 1] ?? 'green',
    milestones: [],
    completedAt: Date.now(),
    // Legacy fields
    fairway, rough, gir, fir: _autoFir(), scoringMode: 'advanced',
  };

  const allHoles = [...scores];
  allHoles[_holeIdx] = holeRecord;

  holeRecord.milestones = detectMilestones(allHoles, _holeIdx);
  _milestones = holeRecord.milestones;
  allHoles[_holeIdx] = holeRecord;

  saveScores(_courseId, allHoles);
  clearHoleFlowState(_courseId, _holeIdx);
  return allHoles;
}

// ── Transitions ───────────────────────────────────────────────────────────────

/** Tap a lie tile in STAGE_SHOTS. */
export function commitShot(lie) {
  if (_stage !== STAGE_SHOTS) return;
  if (lie === 'green') {
    // 'green' is the destination of the last shot, not a shot played from green.
    // Don't append to _shots — it would inflate the stroke count.
    _stage = STAGE_PUTTS;
  } else {
    _shots.push(lie);
    // stay in STAGE_SHOTS
  }
  _persist();
  _notify();
}

/** "Holed out" secondary action — chip-in / hole-in-one path. */
export function holeOut() {
  if (_stage !== STAGE_SHOTS) return;
  _holedFromLie = _shots[_shots.length - 1] ?? 'tee';
  _putts = 0;
  _stage = STAGE_RESULT;
  const scores = loadScores(_courseId);
  _commitHole(scores);
  _notify();
}

/** "Penalty" secondary action — log a penalty shot and stay in STAGE_SHOTS. */
export function penaltyShot() {
  if (_stage !== STAGE_SHOTS) return;
  _shots.push('penalty');
  _persist();
  _notify();
}

/** Set putt count in STAGE_PUTTS. */
export function setPutts(n) {
  if (_stage !== STAGE_PUTTS) return;
  _putts = Math.max(0, n);
  _persist();
  _notify();
}

/** Confirm putts and move to STAGE_RESULT. */
export function finishHole() {
  if (_stage !== STAGE_PUTTS) return;
  _holedFromLie = 'green';
  _stage = STAGE_RESULT;
  const scores = loadScores(_courseId);
  _commitHole(scores);
  _notify();
}

/** Back from STAGE_PUTTS → STAGE_SHOTS (Green shot preserved). */
export function back() {
  if (_stage !== STAGE_PUTTS) return;
  _stage = STAGE_SHOTS;
  _persist();
  _notify();
}

/** Edit from STAGE_RESULT → STAGE_SHOTS (full history preserved). */
export function edit() {
  if (_stage !== STAGE_RESULT) return;
  _stage = STAGE_SHOTS;
  _holedFromLie = null;
  _milestones   = [];
  // Re-open flow — remove persisted result so user can re-commit
  _persist();
  _notify();
}

/** Advance to next hole. Persists result, resets state. Returns next holeIdx. */
export function nextHole(currentScores) {
  if (_stage !== STAGE_RESULT) return _holeIdx + 1;
  clearHoleFlowState(_courseId, _holeIdx);
  const nextIdx = _holeIdx + 1;
  return nextIdx;
}

/** Undo the last shot. Works from STAGE_SHOTS and STAGE_PUTTS. */
export function undoLastShot() {
  if (_stage === STAGE_PUTTS) {
    // Pop the last approach shot and return to shot entry
    if (_shots.length > 1) _shots.pop();
    _stage = STAGE_SHOTS;
    _persist();
    _notify();
    return;
  }
  if (_stage !== STAGE_SHOTS) return;
  if (_shots.length <= 1) {
    _shots = ['tee'];
  } else {
    _shots.pop();
  }
  _persist();
  _notify();
}

// ── State snapshot ────────────────────────────────────────────────────────────
export function getState() {
  const totalShotsCount = _shots.length + (_stage === STAGE_PUTTS || _stage === STAGE_RESULT ? _putts : 0);
  const inRough = _inRough();

  // Expected strokes — requires hole length from calling context;
  // we return the raw function reference so UI can call it with current remaining
  let vsExpected = null;
  if (_getExpectedStrokes) {
    // Approximate: remaining ≈ 0 if on green or result, else caller provides
    vsExpected = _getExpectedStrokes;
  }

  // Build hole record for tier classification (used in STAGE_RESULT)
  const holeRecord = {
    par: _par, shots: [..._shots], putts: _putts,
    holedFromLie: _holedFromLie, milestones: _milestones,
  };

  const tier = _stage === STAGE_RESULT
    ? classifyHoleResult(holeRecord)
    : null;

  const isFirst = (_courseId && tier && ['celebration_birdie','celebration_eagle','celebration_albatross','celebration_hio'].includes(tier))
    ? (() => {
        try {
          const scores = loadScores(_courseId);
          return isFirstOfCelebrationType(scores, _holeIdx, tier);
        } catch(e) { return false; }
      })()
    : false;

  return {
    stage: _stage,
    shots: [..._shots],
    putts: _putts,
    par:   _par,
    holeIdx: _holeIdx,
    holedFromLie: _holedFromLie,
    milestones: [..._milestones],
    totalShots: totalShotsCount,
    inRough,
    tier,
    isFirstOfType: isFirst,
    getExpectedStrokes: _getExpectedStrokes,
    holeExpected: _holeExpected,
  };
}

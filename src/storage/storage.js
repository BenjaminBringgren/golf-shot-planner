/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 4 — storage — all localStorage/sessionStorage access in one place.
// This module imports from nothing — raw browser storage APIs only.
// All other modules call these functions; none write to storage directly.

// ── Key constants ─────────────────────────────────────────────────────────────
export const KEY_BAG           = 'golfBag_v2';
export const KEY_TEE           = 'golfTee_v1';
export const KEY_PROFILE       = 'golfProfile_v1';
export const KEY_COURSES       = 'golfCourses_v1';
export const KEY_ROUNDS        = 'golfRounds_v1';
export const KEY_WIND          = 'golfWind_v1';
export const KEY_WIND_ENABLED  = 'windEnabled';
export const KEY_ACTIVE_COURSE = 'activeCourse'; // sessionStorage

// ── Private key builders ──────────────────────────────────────────────────────
function _csKey(courseId)      { return 'committedStrategies_' + courseId; }
function _scoresKey(courseId)  { return 'roundScores_' + courseId; }
function _collapseKey(id)      { return 'collapse_' + id; }

// ── Bag ───────────────────────────────────────────────────────────────────────
export function loadBag() {
  try { const r = localStorage.getItem(KEY_BAG); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
export function saveBag(data) {
  try { localStorage.setItem(KEY_BAG, JSON.stringify(data)); } catch(e) {}
}

// ── Profile ───────────────────────────────────────────────────────────────────
export function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY_PROFILE)) || {}; } catch(e) { return {}; }
}
export function saveProfile(data) {
  try { localStorage.setItem(KEY_PROFILE, JSON.stringify(data)); } catch(e) {}
}
export function getScoringMode() {
  try { return JSON.parse(localStorage.getItem(KEY_PROFILE) || '{}').scoringMode || 'advanced'; } catch(e) { return 'advanced'; }
}

// ── Courses ───────────────────────────────────────────────────────────────────
export function loadCourses() {
  try { return JSON.parse(localStorage.getItem(KEY_COURSES)) || {}; } catch(e) { return {}; }
}
export function saveCourses(data) {
  try { localStorage.setItem(KEY_COURSES, JSON.stringify(data)); } catch(e) {}
}

// ── Rounds ────────────────────────────────────────────────────────────────────
export function loadRounds(courseId) {
  try { const all = JSON.parse(localStorage.getItem(KEY_ROUNDS)) || {}; return all[courseId] || []; } catch(e) { return []; }
}
export function saveRound(courseId, roundData) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY_ROUNDS)) || {};
    if (!all[courseId]) all[courseId] = [];
    all[courseId].unshift(roundData);
    localStorage.setItem(KEY_ROUNDS, JSON.stringify(all));
  } catch(e) {}
}
export function deleteRound(courseId, roundIndex) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY_ROUNDS)) || {};
    if (!all[courseId]) return;
    all[courseId].splice(roundIndex, 1);
    localStorage.setItem(KEY_ROUNDS, JSON.stringify(all));
  } catch(e) {}
}
export function deleteAllRoundsForCourse(courseId) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY_ROUNDS)) || {};
    delete all[courseId];
    localStorage.setItem(KEY_ROUNDS, JSON.stringify(all));
  } catch(e) {}
}

// ── Scores ────────────────────────────────────────────────────────────────────
// localStorage survives iOS backgrounding/app kill; sessionStorage does not.
export function loadScores(courseId) {
  try { const r = localStorage.getItem(_scoresKey(courseId)); return r ? JSON.parse(r) : Array(18).fill(null); } catch(e) { return Array(18).fill(null); }
}
export function saveScores(courseId, scores) {
  try { localStorage.setItem(_scoresKey(courseId), JSON.stringify(scores)); } catch(e) {}
}
export function clearScores(courseId) {
  try { localStorage.removeItem(_scoresKey(courseId)); } catch(e) {}
}

// ── Committed strategies (per-course, per-hole) ───────────────────────────────
export function getActiveCourseId() {
  try { const s = sessionStorage.getItem(KEY_ACTIVE_COURSE); return s ? JSON.parse(s).id : null; } catch(e) { return null; }
}
export function getCommittedStrategies(courseId) {
  const id = courseId || getActiveCourseId(); if (!id) return {};
  try { return JSON.parse(localStorage.getItem(_csKey(id))) || {}; } catch(e) { return {}; }
}
export function setCommittedStrategies(courseId, obj) {
  const id = courseId || getActiveCourseId(); if (!id) return;
  try { localStorage.setItem(_csKey(id), JSON.stringify(obj)); } catch(e) {}
}
export function removeCommittedStrategies(courseId) {
  const id = courseId || getActiveCourseId(); if (!id) return;
  try { localStorage.removeItem(_csKey(id)); } catch(e) {}
}

// ── Active course (sessionStorage) ────────────────────────────────────────────
// Safari aggressively purges sessionStorage when backgrounded >~30s.
// Read patterns below must be preserved exactly to handle null gracefully.
export function loadActiveCourse() {
  try { return JSON.parse(sessionStorage.getItem(KEY_ACTIVE_COURSE) || '{}'); } catch(e) { return {}; }
}
export function saveActiveCourse(id, holeIdx) {
  try { sessionStorage.setItem(KEY_ACTIVE_COURSE, JSON.stringify({ id, holeIdx })); } catch(e) {}
}
export function clearActiveCourse() {
  try { sessionStorage.removeItem(KEY_ACTIVE_COURSE); } catch(e) {}
}

// ── Wind ──────────────────────────────────────────────────────────────────────
export function loadWindEnabled() {
  return localStorage.getItem(KEY_WIND_ENABLED);
}
export function saveWindEnabled(enabled) {
  try { localStorage.setItem(KEY_WIND_ENABLED, enabled); } catch(e) {}
}
export function loadWindPrefs() {
  try { return JSON.parse(localStorage.getItem(KEY_WIND)) || {}; } catch(e) { return {}; }
}
export function saveWindPrefs(holeDeg) {
  try { localStorage.setItem(KEY_WIND, JSON.stringify({ holeDeg })); } catch(e) {}
}

// ── GPS / Tee state ───────────────────────────────────────────────────────────
export function loadTeeState() {
  try { const r = localStorage.getItem(KEY_TEE); return r ? JSON.parse(r) : null; } catch(e) { return null; }
}
export function saveTeeState(data) {
  try { localStorage.setItem(KEY_TEE, JSON.stringify(data)); } catch(e) {}
}
export function clearTeeState() {
  try { localStorage.removeItem(KEY_TEE); } catch(e) {}
}

// ── Collapsible section state ─────────────────────────────────────────────────
export function loadCollapseState(sectionId) {
  return localStorage.getItem(_collapseKey(sectionId));
}
export function saveCollapseState(sectionId, value) {
  try { localStorage.setItem(_collapseKey(sectionId), value); } catch(e) {}
}

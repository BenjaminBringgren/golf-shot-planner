/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 2 — app — entry point. Bootstraps the Play tab and My Golf tab.
// ES modules are deferred; DOM is ready when this executes.

import {
  loadBag, saveBag as _saveBag,
  loadTeeState, saveTeeState as _saveTeeState, clearTeeState,
  loadWindEnabled, saveWindEnabled, loadWindPrefs, saveWindPrefs as _saveWindPrefs,
  loadActiveCourse, saveActiveCourse, clearActiveCourse, getActiveCourseId,
  getCommittedStrategies, setCommittedStrategies, removeCommittedStrategies,
  loadCourses, loadScores, loadRounds, loadAllRounds, loadProfile, loadWidgetPrefs,
  loadInProgressRound, clearInProgressRound,
  saveProfile, getScoringMode,
  loadCollapseState, saveCollapseState,
  loadPersonalCal, savePersonalCal,
  exportAllData, importAllData,
  KEY_HERO_IMG_IDX, KEY_HERO_QUOTE_IDX,
} from '../storage/storage.js';
import {
  teeMarked, completedShots,
  clearGpsState, markTeePosition, recordShot, restoreGpsState, getGpsSnapshot,
  averagedPosition,
} from '../platform/gps.js';
import { fetchWind, fetchLocationName } from '../platform/weather.js';
import {
  clubs, clubOrder, idx7, idxPW, clubMap, getRollFactor,
} from '../engine/clubs.js';
import {
  WIND_ADJ, ALT_FACTORS, EXPECTED_STROKES, altFactor,
  windCategory, windAdjustedRoll, applyWind, tempCarryFactor,
  interpolate, expectedStrokesRemaining,
  getValidTeeClubs, findBestContinuation, calcPar3,
  decodeStrategy, strategyDisplayName,
  analyzeHoleStrategies, analyzeApproachDistances,
} from '../engine/calculations.js';
import { renderPlan, updateWindSectionStatus as _uwss, updateWindBreakdown as _uwbd,
         syncChipRow, wireChipRow, crosswindSide } from '../ui/carousel.js';
import { openClubPicker, closeClubPicker,
         openCoursePicker, closeCoursePicker, wireCoursePickerEvents } from '../ui/sheets.js';
import { renderPlayCourseBar, renderScoreEntry, showRoundCompleteOverlay, renderSavedRoundDetail,
         hideScorefab, getInRough, resetInRough } from '../ui/scorecard.js';
import {
  computeHoleBaseline, blendedScore,
  applyHoleToPlay, loadCourseIntoPlay, resumeRoundInPlay,
  deleteCourse, renderCourseList, openEditor,
  initServices,
} from './courses.js';
import {
  showMgSub, showMgHub, refreshMgHub,
  renderMgCarryBars, renderSavedRounds, refreshHomeStats,
  initRoundsServices, computePreRoundFocus, renderMgStrokeLossBreakdown,
  computePersonalCalibration,
} from './rounds.js';
import {
  initHoleFlowServices, setHoleExpected,
  commitShot, holeOut, penaltyShot, penaltyRelief, pickUp, setPutts, finishHole,
  back as _flowBack, edit as _flowEdit, nextHole, undoLastShot,
  addApproachShot, removeApproachShot,
  getState as getHoleFlowState, subscribe as subscribeHoleFlow,
} from './holeFlow.js';

// ── Persistence ────────────────────────────────────────────────────────────
// Club order before hybrids/2i/3i/48° were added — used to migrate old index-based checked arrays.
const _LEGACY_CLUB_ORDER = ['driver','fw3','fw5','fw7','u2','u3','u4','4i','5i','6i','7i','8i','9i','pw','50','52','54','56','58','60'];

function _resolveChecked(checkedData, key) {
  if (!checkedData) return false;
  if (Array.isArray(checkedData)) {
    const legacyIdx = _LEGACY_CLUB_ORDER.indexOf(key);
    return legacyIdx >= 0 ? (checkedData[legacyIdx] ?? false) : false;
  }
  return checkedData[key] ?? false;
}

function saveBag() {
  const checked = {};
  clubs.forEach(c => { checked[c.key] = document.getElementById('cb_' + c.key)?.checked ?? !!c.checked; });
  const data = {
    checked,
    driver:     document.getElementById('driverCarry').value,
    i7:         document.getElementById('i7Carry').value,
    pw:         document.getElementById('pwCarry').value,
    conditions: document.getElementById('conditions').value,
  };
  _saveBag(data);
}


// ── Club list UI ───────────────────────────────────────────────────────────
function getCarryInputs() {
  return {
    driver: Number(document.getElementById('driverCarry').value) || 0,
    i7:     Number(document.getElementById('i7Carry').value)     || 0,
    pw:     Number(document.getElementById('pwCarry').value)     || 0,
  };
}

function _readHandicap() {
  try {
    const _hv = parseFloat(loadProfile()?.handicap);
    return (!isNaN(_hv) && _hv >= 0) ? _hv : null;
  } catch(e) { return null; }
}

function updateCarryLabels() {
  const { driver, i7, pw } = getCarryInputs();
  const cond = document.getElementById('conditions').value;
  clubs.forEach(c => {
    const span = document.getElementById('carry_' + c.key);
    if (!span) return;
    if (!driver) { span.textContent = ''; return; }
    const carry = interpolate(driver, i7, pw, c.key);
    const baseRoll = getRollFactor(c.key, cond);
    const roll  = windAdjustedRoll(baseRoll, c.key, windState, _readHandicap());
    const total = carry * roll;
    span.textContent = isFinite(carry) && carry > 0
      ? (roll > 1.00 ? `${carry.toFixed(0)}→${total.toFixed(0)}m` : `${carry.toFixed(0)}m`)
      : '';
  });
}

function buildClubUI(saved) {
  const container = document.getElementById('clubContainer');
  clubs.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'club-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = c.key;
    cb.id = 'cb_' + c.key;
    cb.checked = saved ? (_resolveChecked(saved.checked, c.key) ?? !!c.checked) : !!c.checked;
    cb.addEventListener('change', saveBag);

    const lbl = document.createElement('label');
    lbl.htmlFor = 'cb_' + c.key;
    lbl.textContent = c.label;

    const dots = document.createElement('span');
    dots.className = 'club-dots';

    const carrySpan = document.createElement('span');
    carrySpan.id = 'carry_' + c.key;
    carrySpan.className = 'carry-tag';

    div.appendChild(cb);
    div.appendChild(lbl);
    div.appendChild(dots);
    div.appendChild(carrySpan);
    container.appendChild(div);
  });
}

// ── Club selection for planning ────────────────────────────────────────────
function getClubs(driver, i7, pw, windState) {
  const cond = document.getElementById('conditions').value;
  return [...document.querySelectorAll('#clubContainer input:checked')]
    .map(cb => {
      const key = cb.value;
      if (!(key in clubMap)) return null;
      const baseCarry = interpolate(driver, i7, pw, key);
      if (!isFinite(baseCarry) || baseCarry <= 0) return null;
      const idx   = clubOrder.indexOf(key);
      const carry    = applyWind(baseCarry, key, windState, _readHandicap());
      const baseRoll = getRollFactor(key, cond);
      const roll     = windAdjustedRoll(baseRoll, key, windState, _readHandicap());
      return { key, carry, baseCarry, total: carry * roll, roll, idx };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);
}

// Returns 'left', 'right', or 'none' relative to the hole playing direction.
// Wind FROM dirDeg blowing INTO holeDeg. Cross component = sin(wind-hole).
// Positive sin → wind pushes ball rightward (cross from left); negative → from right.


function bearingLabel(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function windDirectionLabel(fromDeg) {
  // Wind FROM direction — e.g. "from SW" means wind is blowing NE
  return bearingLabel((fromDeg + 180) % 360);
}

// Format elapsed time since a timestamp
function timeAgo(ts) {
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 60)  return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  return `${Math.floor(sec/3600)}h ago`;
}


// ── App state ──────────────────────────────────────────────────────────────
// Per-hole HCP adjustment — set by calculate() using refined WHS model when
// course has CR/Slope/SI and player has handicap index. Falls back to flat model.
let _holeHcpAdj  = null; // null = use flat model inside expectedStrokesRemaining
let _personalCal = null; // personal approach calibration — computed at startup, refreshed after round save

function computeAndCachePersonalCal() {
  const cal = computePersonalCalibration(loadAllRounds());
  savePersonalCal(cal);
  return cal;
}
export function refreshPersonalCal() {
  _personalCal = computeAndCachePersonalCal();
}
// Rough lie flag — set true when GPS ball mark is in rough, adds penalty to expected strokes
// _inRough is owned by scorecard.js; read via getInRough(), reset via resetInRough()

const teeOverrides = {};
const shot2Overrides = {}; // user-selected second-shot club per strategy type
const approachOverrides = {}; // user-selected approach club per strategy type (1-shot plans)
const gpsShot2Overrides = {}; // user-selected next club after GPS ball mark

function clearAllOverrides() {
  Object.keys(teeOverrides).forEach(k => delete teeOverrides[k]);
  Object.keys(shot2Overrides).forEach(k => delete shot2Overrides[k]);
  Object.keys(approachOverrides).forEach(k => delete approachOverrides[k]);
  Object.keys(gpsShot2Overrides).forEach(k => delete gpsShot2Overrides[k]);
}
function clearRoundOverrides() {
  Object.keys(shot2Overrides).forEach(k => delete shot2Overrides[k]);
  Object.keys(approachOverrides).forEach(k => delete approachOverrides[k]);
  Object.keys(gpsShot2Overrides).forEach(k => delete gpsShot2Overrides[k]);
}
function clearGpsOverrides() {
  Object.keys(gpsShot2Overrides).forEach(k => delete gpsShot2Overrides[k]);
}
const par3ClubOverrides = {};

// ── Callbacks factory ─────────────────────────────────────────────────────
// Builds the callbacks object passed to UI functions. calculate is wrapped in
// an arrow so the closure captures the variable binding, not the initial value
// (calculate is reassigned to a wrapped version later in this module).
function buildCallbacks() {
  return {
    clearGpsOverrides,
    clearRoundOverrides,
    clearAllOverrides,
    applyHoleToPlay,
    renderScoreEntry: (id, hIdx, scores) => renderScoreEntry(id, hIdx, scores, buildCallbacks()),
    updateHoleCardMode,
    gpsTeeSetState,
    gpsBallSetState,
    calculate:                () => calculate(),
    renderSavedRounds: () => { refreshPersonalCal(); renderSavedRounds(); },
    updateLoadCourseBtn,
    updateCalcButtonVisibility,
    navigateHome: () => switchTab('home'),
    // Shot-sheet / hole-flow callbacks
    commitShot:        (lie)    => commitShot(lie),
    holeOut:           ()       => holeOut(),
    penaltyShot:       ()       => penaltyShot(),
    penaltyRelief:     ()       => penaltyRelief(),
    pickUp:            (max)   => pickUp(max),
    setPutts:          (n)      => setPutts(n),
    finishHole:        ()       => finishHole(),
    backToPutts:       ()       => _flowBack(),
    editHole:          ()       => _flowEdit(),
    nextHole:          (scores) => nextHole(scores),
    undoLastShot:      ()       => undoLastShot(),
    addApproachShot:   (lie)    => addApproachShot(lie),
    removeApproachShot: ()      => removeApproachShot(),
    getHoleFlowState:  ()       => getHoleFlowState(),
    subscribeHoleFlow: (fn)     => subscribeHoleFlow(fn),
    showRoundComplete: (cId, hIdx) => showRoundCompleteOverlay(cId, hIdx, buildCallbacks()),
  };
}
// Expected strokes callback — reads live inputs at call time, injected into holeFlow.
function _getExpectedStrokes(remaining, inRoughFlag) {
  try {
    const driver = Number(document.getElementById('driverCarry').value) || 0;
    if (!driver) return null;
    const i7 = Number(document.getElementById('i7Carry').value) || 0;
    const pw = Number(document.getElementById('pwCarry').value) || 0;
    const clubsList = getClubs(driver, i7, pw, windState);
    const dc = clubsList.find(c => c.key === 'driver');
    const driverCarry = dc ? dc.carry : driver;
    let handicap = null;
    try {
      const _ph = loadProfile();
      const _hv = parseFloat(_ph.handicap);
      if (!isNaN(_hv) && _hv > 0) handicap = _hv;
    } catch(e) {}
    return expectedStrokesRemaining(remaining, driverCarry, handicap, inRoughFlag, windState, undefined, _holeHcpAdj, _personalCal);
  } catch(e) { return null; }
}
initHoleFlowServices({ getExpectedStrokes: _getExpectedStrokes });

function par3Override() { return par3ClubOverrides[_overrideCourseId + "|" + _overrideHoleIdx] ?? null; }

// Course+hole namespace for overrides — set by calculate() each call
let _overrideHoleIdx = 0;
let _overrideCourseId = '';
// Initialise from session immediately so first calculate() call has correct namespace
(function() {
  const _s = loadActiveCourse();
  if (_s.id) { _overrideHoleIdx = _s.holeIdx ?? 0; _overrideCourseId = _s.id ?? ''; }
})();
// Namespace key: course|hole|strategyType — prevents cross-course/cross-hole bleed
function _hk(type) { return _overrideCourseId + '|' + _overrideHoleIdx + '|' + type; }

let windState = {
  speedMs:    null,   // sustained wind speed m/s (10-min average at 10m height)
  gustMs:     null,   // gust speed m/s (max 10-min gust at 10m height)
  dirDeg:     null,   // wind FROM direction in degrees (met convention)
  holeDeg:    null,   // hole playing direction in degrees (where ball travels)
  headwind:   null,   // computed headwind component at 10m (+head, -tail)
  crosswind:  null,   // computed crosswind component (magnitude)
  active:     false,  // true when wind data + hole direction both set
  enabled:    true,   // user toggle — false disables all wind adjustments
  tempC:      null,   // air temperature °C from weather API
};

// Compute headwind and crosswind components from current windState
function computeWindComponents() {
  if (windState.speedMs === null || windState.holeDeg === null) return;
  const angleDeg = windState.dirDeg - windState.holeDeg;
  const angleRad = angleDeg * Math.PI / 180;
  windState.headwind  = windState.speedMs * Math.cos(angleRad); // + = headwind
  windState.crosswind = Math.abs(windState.speedMs * Math.sin(angleRad));
  windState.active    = true;
}

// ── Main ───────────────────────────────────────────────────────────────────

// ── My Golf bootstrap (formerly Script 1) ───────────────────────────────────

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const pane = document.getElementById('pane' + name.charAt(0).toUpperCase() + name.slice(1));
  const btn  = document.getElementById('tab'  + name.charAt(0).toUpperCase() + name.slice(1));
  if (pane) pane.classList.add('active');
  if (btn)  btn.classList.add('active');
  // Reset scroll position on tab switch
  window.scrollTo(0, 0);
  if (pane) pane.scrollTop = 0;
  if (name === 'play') {
    updateLoadCourseBtn();
    const _sess = loadActiveCourse();
    if (_sess.id) {
      try {
        renderScoreEntry(_sess.id, _sess.holeIdx ?? 0, loadScores(_sess.id), buildCallbacks());
      } catch(e) {}
    }
  }
  if (name === 'prepare') {
    // Always return to My Golf hub when switching to My Golf tab
    showMgHub();
    renderCourseList();
    refreshMgHub();
  }
  // FABs only visible on Play tab when course is active
  const courseActive = !!getActiveCourseId();
  const fab = document.getElementById('scoreFab');
  if (fab) fab.classList.toggle('visible', name === 'play' && courseActive);
  const wfab = document.getElementById('widgetFab');
  if (wfab) wfab.classList.toggle('visible', name === 'play' && courseActive);
  // Close drawers when switching tabs
  const drawer = document.getElementById('scoreDrawer');
  if (drawer) drawer.classList.remove('open');
  const overlay = document.getElementById('scoreDrawerOverlay');
  if (overlay) overlay.classList.remove('visible');
  document.getElementById('widgetDrawer')?.classList.remove('open');
  document.getElementById('widgetDrawerOverlay')?.classList.remove('visible');
  // Close scorecard page when switching tabs
  document.getElementById('scorecardPage')?.classList.remove('open');
  document.getElementById('scorecardOverlay')?.classList.remove('visible');
  document.body.style.overflow = '';
}

// ── Global press-state fix (iOS/WKWebView :active stuck state) ───────────────
// Safari and WKWebView don't reliably clear :active on touchend when the DOM
// changes during the gesture. All button feedback uses .is-pressed instead.
const _PRESS_SEL = 'button, .mg-menu-row, .gps-tile, .club-picker-item, .sh-lie, .picker-fmt-card, .mg-stat-tile.tappable, .mg-drilldown-btn, .arb-resume-btn, .home-stat-tile.tappable, .lrh-row.tappable, .rh-round-row, .rh-year-sep';
document.addEventListener('touchstart', e => {
  e.target.closest(_PRESS_SEL)?.classList.add('is-pressed');
}, { passive: true });
['touchend', 'touchcancel'].forEach(ev =>
  document.addEventListener(ev, () =>
    document.querySelectorAll('.is-pressed').forEach(el => el.classList.remove('is-pressed')),
  { passive: true })
);

document.getElementById('tabHome')?.addEventListener('click', () => switchTab('home'));
document.getElementById('tabPlay')?.addEventListener('click', () => switchTab('play'));
document.getElementById('tabPrepare')?.addEventListener('click', () => switchTab('prepare'));



// Wire sub-page nav after DOM ready (buttons exist at this point)
(function wireMgNav() {
  document.getElementById('mgNavProfile')?.addEventListener('click', () => showMgSub('mgSubProfile'));
  document.getElementById('mgNavBag')?.addEventListener('click', () => showMgSub('mgSubBag'));
  document.getElementById('mgNavStats')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgNavCourses')?.addEventListener('click', () => showMgSub('mgSubCourses'));
  document.getElementById('mgBackProfile')?.addEventListener('click', showMgHub);
  document.getElementById('mgBackBag')?.addEventListener('click', showMgHub);
  document.getElementById('mgBackStats')?.addEventListener('click', showMgHub);
  document.getElementById('mgBackScoring')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackBaseline')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackStrokeAnalysis')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackRoundsHistory')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackRoundDetail')?.addEventListener('click', () => showMgSub('mgSubRoundsHistory'));
  document.getElementById('mgBackCourses')?.addEventListener('click', showMgHub);
  // Edit bag toggle
  document.getElementById('mgEditBagBtn')?.addEventListener('click', () => {
    const form = document.getElementById('mgBagEditForm');
    const btn  = document.getElementById('mgEditBagBtn');
    if (getComputedStyle(form).display === 'none') {
      form.style.display = 'block';
      btn.textContent = 'Done editing ✓';
    } else {
      form.style.display = 'none';
      btn.textContent = 'Edit clubs & carries ›';
      renderMgCarryBars();
    }
  });
})();

// Profile save
document.getElementById('mgProfileSaveBtn')?.addEventListener('click', () => {
  const name   = document.getElementById('profileName')?.value.trim() || '';
  const hcpRaw = document.getElementById('profileHandicap')?.value;
  const home   = document.getElementById('profileHomeCourse')?.value.trim() || '';
  const hcpEl  = document.getElementById('profileHandicap');
  const hcpVal = hcpRaw !== '' ? parseFloat(hcpRaw) : '';
  if (hcpRaw !== '' && (isNaN(hcpVal) || hcpVal < 0 || hcpVal > 54)) {
    hcpEl.style.borderColor = '#a32d2d';
    return;
  }
  if (hcpEl) hcpEl.style.borderColor = '';
  saveProfile({ ...loadProfile(), name, handicap: hcpVal, homeCourse: home });
  const btn = document.getElementById('mgProfileSaveBtn');
  btn.textContent = 'Saved ✓';
  btn.style.background = '#888';
  setTimeout(() => { btn.textContent = 'Save profile'; btn.style.background = ''; showMgHub(); }, 900);
});

// Profile: pre-fill when sub-page opens (wired in showMgSub)

// Data export
document.getElementById('mgExportDataBtn')?.addEventListener('click', () => {
  const json = exportAllData();
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `golf-shot-planner-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Data import
document.getElementById('mgImportDataBtn')?.addEventListener('click', () => {
  document.getElementById('mgImportFileInput')?.click();
});

document.getElementById('mgImportFileInput')?.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      importAllData(ev.target.result);
      const btn = document.getElementById('mgImportDataBtn');
      btn.textContent = 'Imported ✓ — reload to apply';
      btn.style.color = '#1e7a45';
      btn.disabled = true;
    } catch (err) {
      alert('Could not read backup file. Make sure it was exported from this app.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

// ── New course button ─────────────────────────────────────────────────────
document.getElementById('newCourseBtn').addEventListener('click', () => {
  openEditor(null);
});

// ── Restore active course bar on load ────────────────────────────────────
(function() {
  const session = loadActiveCourse();
  if (!session.id) return;
  try {
    const { id, holeIdx } = session;
    const courses = loadCourses();
    if (!courses[id]) return;
    renderPlayCourseBar(id, buildCallbacks());
    // Restore FAB immediately on page load
    const scores = loadScores(id);
    renderScoreEntry(id, holeIdx ?? 0, scores, buildCallbacks());
    setTimeout(() => updateCalcButtonVisibility(), 0);
  } catch(e) {}
  // Sync button visibility after potential course restore
  updateLoadCourseBtn();
})();

wireCoursePickerEvents((id, fmt, hcpOn) => loadCourseIntoPlay(id, fmt, hcpOn));

// Inject app-layer services into courses.js so it can call back into the app.
// calculate is wrapped in an arrow to capture the final (wrapped) binding.
initServices({
  syncChipRow,
  switchTab,
  renderPlayCourseBar: (id) => renderPlayCourseBar(id, buildCallbacks()),
  updateCalcButtonVisibility,
  renderScoreEntry:    (id, holeIdx, scores) => renderScoreEntry(id, holeIdx, scores, buildCallbacks()),
  clearRoundOverrides,
  clearGpsOverrides,
  calculate:           () => calculate(),
  renderSavedRounds,
  showPreRoundFocus:   (id) => showPreRoundFocusUI(id),
});


// ── Play tab bootstrap (formerly Script 0 DOMContentLoaded body) ────────────

  // ── This Hole card mode toggle ──────────────────────────────────────────
  function updateHoleCardMode() {
    const card = document.getElementById('thisHoleCard');
    const bar  = document.getElementById('playCourseBar');
    if (!card) return;
    const parCondGrid    = document.getElementById('parCondGrid');
    const weatherCondRow = document.getElementById('weatherCondRow');
    if (bar) {
      card.classList.add('course-active');
      if (parCondGrid)    parCondGrid.style.display    = 'none';
      if (weatherCondRow) weatherCondRow.style.display = 'flex';
      const session = loadActiveCourse();
      const courses = loadCourses();
      const course  = courses[session.id];
      const holeIdx = session.holeIdx ?? 0;
      const hole    = course?.holes?.[holeIdx];
      const par     = hole?.par || 4;
      const length  = hole?.length ? `${hole.length}m` : '—';
      const cond    = document.getElementById('conditions')?.value === 'soft' ? 'Soft' : 'Firm';
      document.getElementById('holeCompactText').textContent =
        `Hole ${holeIdx + 1} · Par ${par} · ${length}`;
      const _hcc = document.getElementById('holeCompactConditions');
      if (_hcc) _hcc.textContent = cond;
      const noteEl = document.getElementById('holeCompactNote');
      if (noteEl) {
        const noteText = hole?.note?.trim() || '';
        noteEl.textContent = noteText;
        noteEl.style.display = noteText ? 'block' : 'none';
      }
    } else {
      card.classList.remove('course-active');
      if (parCondGrid)    parCondGrid.style.display    = '';
      if (weatherCondRow) weatherCondRow.style.display = 'none';
    }
  }
  // Show load-course button only when no course is active; hide play landing when course active
  function updateLoadCourseBtn() {
    const courseActive = !!getActiveCourseId();
    document.getElementById('loadCourseBtn')?.classList.toggle('visible', !courseActive);
    document.getElementById('playLanding')?.classList.toggle('hidden', courseActive);
    document.getElementById('playHero')?.classList.toggle('hidden', courseActive);
    const calcView = document.getElementById('calcView');
    if (calcView) calcView.classList.toggle('open', courseActive);
    document.getElementById('calcCloseBtn')?.classList.toggle('hidden', true); // close btn only shown in manual mode
  }

  const saved = loadBag();
  buildClubUI(saved);
  if (saved && Array.isArray(saved.checked)) saveBag(); // migrate index-based → key-based

  if (saved) {
    if (saved.driver)     document.getElementById('driverCarry').value = saved.driver;
    if (saved.i7)         document.getElementById('i7Carry').value     = saved.i7;
    if (saved.pw)         document.getElementById('pwCarry').value     = saved.pw;
    if (saved.conditions) {
      document.getElementById('conditions').value = saved.conditions;
      syncChipRow('condChipRow', 'conditions');
    }
  }

  ['driverCarry','i7Carry','pwCarry'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      updateCarryLabels();
      saveBag();
      if (id === 'i7Carry' || id === 'pwCarry') updateBagCompleteHint();
    });
  });

  updateCarryLabels();
  updateBagCompleteHint();

  function updateBagCompleteHint() {
    const hint = document.getElementById('bagCompleteHint');
    if (!hint) return;
    const i7 = Number(document.getElementById('i7Carry').value);
    const pw = Number(document.getElementById('pwCarry').value);
    hint.style.display = (i7 >= 50 && pw >= 50) ? 'none' : 'flex';
  }

  document.getElementById('bagCompleteHintBtn')?.addEventListener('click', () => {
    switchTab('prepare');
    showMgSub('mgSubBag');
  });

  // ── First-run splash ──────────────────────────────────────────────────
  (function() {
    const overlay = document.getElementById('splashOverlay');
    const input   = document.getElementById('splashDriverInput');
    const btn     = document.getElementById('splashStartBtn');
    if (!overlay || !input || !btn) return;

    try {
      const bagSaved = loadBag() || {};
      if (Number(bagSaved.driver) >= 50) { overlay.classList.add('hidden'); return; }
    } catch(e) {}

    function checkSplashInput() {
      const v = parseInt(input.value, 10);
      btn.disabled = !(v >= 50 && v <= 350);
    }
    input.addEventListener('input',  checkSplashInput);
    input.addEventListener('change', checkSplashInput);

    btn.addEventListener('click', () => {
      const val = parseInt(input.value, 10);
      if (!(val >= 50 && val <= 350)) return;
      document.getElementById('driverCarry').value = val;
      saveBag();
      overlay.classList.add('hidden');
      updateBagCompleteHint();
    });
  })();

  // ── Pre-round strategy brief ──────────────────────────────────────────
  function _fmtHoleList(holes) {
    if (!holes || holes.length === 0) return '';
    if (holes.length === 1) return String(holes[0]);
    if (holes.length === 2) return `${holes[0]} and ${holes[1]}`;
    return `${holes.slice(0, -1).join(', ')} and ${holes[holes.length - 1]}`;
  }

  function showPreRoundFocusUI(courseId) {
    const data = computePreRoundFocus(courseId);
    if (!data) return;

    const roundCtx = (data.rounds > 1 ? `Last ${data.rounds} rounds` : 'Last round') +
                     (data.courseName ? ` · ${data.courseName}` : '');

    const LABELS = { driving: 'Tee accuracy', approach: 'Approach play',
                     shortGame: 'Short game', putting: 'Putting', penalties: 'Penalty areas' };

    let categoryLabel, statLine, statClass, strategyText, btnText;

    if (data.category === 'strength') {
      btnText = "Let's go →";
      const sc = data.strengthCategory;
      if (sc === 'gir') {
        categoryLabel = 'Approach play';  statLine = `GIR ${data.strengthValue}%`;
        statClass = 'prf-stat prf-stat-strength';
        strategyText = `Hitting greens at ${data.strengthValue}% here is your edge today. Attack pins you can hold — don't leave birdie chances short.`;
      } else if (sc === 'fir') {
        categoryLabel = 'Tee accuracy';   statLine = `FIR ${data.strengthValue}%`;
        statClass = 'prf-stat prf-stat-strength';
        strategyText = `Finding ${data.strengthValue}% of fairways at this course gives you a head start. Commit to the same routine off the tee.`;
      } else {
        categoryLabel = 'Putting';        statLine = `${data.strengthValue} putts/hole`;
        statClass = 'prf-stat prf-stat-strength';
        strategyText = `Your putting has been dialled in here. Step up to every birdie putt expecting to make it — your speed control is the foundation.`;
      }
    } else {
      btnText       = 'Got it →';
      categoryLabel = LABELS[data.category] || data.category;
      statLine      = '+' + data.leakPerRound.toFixed(1) + (data.leakPerRound >= 1.5 ? ' strokes/round' : ' stroke/round');
      statClass     = 'prf-stat';
      const holeStr = _fmtHoleList(data.leakHoles);

      if (data.category === 'approach') {
        if (holeStr && data.scoringZone) {
          const lo = Math.round(data.scoringZone.low), hi = Math.round(data.scoringZone.high);
          strategyText = `Holes ${holeStr} have cost you most. Your scoring zone is ${lo}–${hi}m — on these holes, consider laying up to it rather than pressing for extra distance.`;
        } else if (holeStr) {
          const girStr = data.girPct !== null ? ` (GIR ${Math.round(data.girPct * 100)}% here)` : '';
          strategyText = `Holes ${holeStr} are your approach leaks${girStr}. Aim for centre green on these holes — one extra GIR per round saves around 1.5 strokes.`;
        } else {
          strategyText = `Aim for centre green, not the flag. One extra GIR per round is worth around 1.5 strokes.`;
        }
      } else if (data.category === 'driving') {
        const firStr = data.firPct !== null ? `${Math.round(data.firPct * 100)}% FIR here` : '';
        if (holeStr) {
          strategyText = `Holes ${holeStr} are your tee shot leaks${firStr ? ` (${firStr})` : ''}. Use the Controlled strategy on these — a fairway bogey beats a rough double.`;
        } else {
          strategyText = `Off-the-tee accuracy${firStr ? ` (${firStr})` : ''} is today's priority. Club down on tight holes and commit to the short grass.`;
        }
      } else if (data.category === 'shortGame') {
        if (holeStr) {
          strategyText = `Holes ${holeStr} are where missed greens hurt most. Pick your landing spot before your club — use the lowest-loft shot that reaches the putting surface.`;
        } else {
          strategyText = `Pick your landing spot before your club. Use the lowest-loft shot that reaches the putting surface and let it run out.`;
        }
      } else if (data.category === 'putting') {
        if (holeStr) {
          strategyText = `Holes ${holeStr} have produced the most 3-putts. From distance, aim for a 2-foot circle around the hole — speed control first, line second.`;
        } else {
          strategyText = `3-putts are adding up here. From distance, aim for a 2-foot circle around the hole — speed control first, line second.`;
        }
      } else if (data.category === 'penalties') {
        if (holeStr) {
          strategyText = `Holes ${holeStr} are penalty traps at this course. Know the safe bail-out line on each before you tee off — and commit to it when the aggressive line isn't comfortable.`;
        } else {
          strategyText = `Penalty areas are punishing you here. Know the safe bail-out line on risky holes before you tee off.`;
        }
      } else {
        strategyText = '';
      }
    }

    const holesHTML = data.leakHoles?.length > 0
      ? `<div class="prf-holes">${data.leakHoles.map(h => `<span class="prf-hole-pill">Hole ${h}</span>`).join('')}</div>`
      : '';

    let el = document.getElementById('preRoundFocusOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'preRoundFocusOverlay';
      document.body.appendChild(el);
    }
    el.innerHTML =
      '<div class="prf-backdrop">' +
        '<div class="prf-card">' +
          '<div class="prf-eyebrow">Today\'s strategy</div>' +
          `<div class="prf-category">${categoryLabel}</div>` +
          `<div class="${statClass}">${statLine}</div>` +
          `<div class="prf-context">${roundCtx}</div>` +
          '<div class="prf-divider"></div>' +
          holesHTML +
          `<div class="prf-strategy">${strategyText}</div>` +
          `<button class="prf-btn" type="button">${btnText}</button>` +
        '</div>' +
      '</div>';
    el.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    el.querySelector('.prf-btn').addEventListener('click', () => {
      el.style.display = 'none';
      document.body.style.overflow = '';
    });
  }

  // ── Collapsible sections ──────────────────────────────────────────────
  function initCollapsible(sectionId, toggleId, openByDefault) {
    const section = document.getElementById(sectionId);
    const toggle  = document.getElementById(toggleId);
    const stored  = loadCollapseState(sectionId);
    // Open if: explicitly stored as open, OR no stored pref and openByDefault
    const isOpen  = stored !== null ? stored === 'open' : openByDefault;
    if (isOpen) section.classList.add('open');
    toggle.addEventListener('click', (e) => {
      // Don't toggle if user clicked a button inside the header
      if (e.target.tagName === 'BUTTON') return;
      section.classList.toggle('open');
      saveCollapseState(sectionId,
        section.classList.contains('open') ? 'open' : 'closed');
    });
  }

  // Wind panel toggle
  function toggleWindPanel(e) {
    if (e && e.target) {
      var t = e.target;
      if (t.closest && (t.closest('#windRefresh') || t.closest('#windLockStrip') || t.closest('#windToggleWrap'))) return;
    }
    var section = document.getElementById('windSection');
    if (section) section.classList.toggle('open');
  }
  document.getElementById('windToggle')?.addEventListener('click', toggleWindPanel);
  (function() {
    var section = document.getElementById('windSection');
    if (section) section.classList.remove('open');
  })();

  // ── Wind section status bar ───────────────────────────────────────────
  const updateWindSectionStatus = () => _uwss(windState, lockPhase);
  const updateWindBreakdown     = () => _uwbd(windState, lockPhase);

  // ── Wind on/off toggle ───────────────────────────────────────────────
  const windEnabledCb  = document.getElementById('windEnabled');
  const windBodyEl      = document.querySelector('#windSection .collapsible-body');

  // Restore saved enabled state
  const savedWindEnabled = loadWindEnabled();
  if (savedWindEnabled === 'false') {
    windState.enabled = false;
    windEnabledCb.checked = false;
    windBodyEl.classList.add('wind-section-disabled');
    document.getElementById('windRefresh').disabled  = true;
    document.getElementById('windLockStrip').disabled = true;
  }

  windEnabledCb.addEventListener('change', (e) => {
    e.stopPropagation(); // don't collapse the panel
    windState.enabled = windEnabledCb.checked;
    saveWindEnabled(windState.enabled);
    // Dim the body and disable strip buttons when off
    windBodyEl.classList.toggle('wind-section-disabled', !windState.enabled);
    document.getElementById('windRefresh').disabled   = !windState.enabled;
    document.getElementById('windLockStrip').disabled = !windState.enabled;

    // Update button label
    const calcBtn = document.getElementById('calcButton');
    if (calcBtn && !calcBtn.classList.contains('course-active')) {
      if (!windState.enabled) {
        calcBtn.textContent = 'Calculate Shot Plan';
      } else if (windState.speedMs) {
        calcBtn.textContent = 'Calculate Shot Plan + Wind';
      }
    }

    // Recalculate if results are showing
    const out = document.getElementById('output');
    if (out.querySelector('.carousel-outer, .error') || lastParValue === 3) {
      calculate();
    }
  });

  // ── Wind UI ───────────────────────────────────────────────────────────
  const windText        = document.getElementById('windText');
  const compassLock     = null; // removed — strip button handles locking
  const windEffectNote  = document.getElementById('windEffectNote');
  const compassSvgWrap  = document.getElementById('compassSvgWrap');
  const compassDegDisplay = document.getElementById('compassDegDisplay');
  const compassDegLabel   = document.getElementById('compassDegLabel');
  const compassLiveBadge  = document.getElementById('compassLiveBadge');
  const compassLocation   = document.getElementById('compassLocation');

  // Live orientation tracking state
  let liveOrientationActive = false;
  let orientationHandler    = null;
  let _absOrientFired       = false;

  // ── Compass rotation helpers ───────────────────────────────────────────
  // The hole-view SVG is static (flag at top = hole direction).
  // We update the wind arrow's rotation to reflect wind relative to hole.
  function setCompassAngle(deg) {
    const d = ((deg % 360) + 360) % 360;
    compassDegDisplay.textContent = `${Math.round(d)}°`;
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    compassDegLabel.textContent = dirs[Math.round(d / 45) % 8];
    // Rotate wind arrow to show wind source relative to the (in-progress) hole direction
    const wcrWind      = document.getElementById('wcrWind');
    const wcrWindColor = document.getElementById('wcrWindColor');
    if (wcrWind && windState.dirDeg != null) {
      const relAngle = ((windState.dirDeg - d) % 360 + 360) % 360;
      wcrWind.setAttribute('transform', `rotate(${relAngle},0,-14)`);
      const hw = windState.speedMs * Math.cos(relAngle * Math.PI / 180);
      const windColor = hw > 1 ? '#c0392b' : hw < -1 ? '#1e7a45' : '#c07820';
      if (wcrWindColor) {
        wcrWindColor.setAttribute('stroke', windColor);
        wcrWindColor.setAttribute('fill', windColor);
      }
    }
  }

  // ── Manual drag-to-rotate ──────────────────────────────────────────────
  let dragActive = false, dragStartAngle = 0, dragStartHole = 0;

  function angleFromCenter(e) {
    const rect = compassSvgWrap.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI + 90;
  }

  function startDrag(e) {
    if (liveOrientationActive) return; // don't allow drag during live mode
    if (windState.holeDeg !== null) return; // locked — wind direction fixed, no manual rotation
    dragActive = true;
    dragStartAngle = angleFromCenter(e);
    dragStartHole  = windState.holeDeg ?? 0;
    e.preventDefault();
  }
  function moveDrag(e) {
    if (!dragActive) return;
    const delta = angleFromCenter(e) - dragStartAngle;
    const newDeg = ((dragStartHole + delta) % 360 + 360) % 360;
    windState.holeDeg = Math.round(newDeg);
    setCompassAngle(windState.holeDeg);
    e.preventDefault();
    // Live wind effect update (throttled)
    if (!moveDrag._t) {
      moveDrag._t = setTimeout(() => {
        moveDrag._t = null;
        computeWindComponents();
        updateWindEffectNote();
        updateWindStripText();
        const out = document.getElementById('output');
        if (out.querySelector('.carousel-outer, .error')) calculate();
      }, 150);
    }
  }
  function endDrag() {
    if (!dragActive) return;
    dragActive = false;
    computeWindComponents();
    updateWindEffectNote();
    updateWindStripText();
    saveWindPrefs();
    const out = document.getElementById('output');
    if (out.querySelector('.carousel-outer, .error')) calculate();
  }

  compassSvgWrap.addEventListener('mousedown',  startDrag);
  compassSvgWrap.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('mousemove',  moveDrag);
  window.addEventListener('touchmove',  moveDrag, { passive: false });
  window.addEventListener('mouseup',   endDrag);
  window.addEventListener('touchend',  endDrag);

  // ── Restore saved hole direction ───────────────────────────────────────
  const savedWind = loadWindPrefs();
  if (savedWind.holeDeg != null) {
    windState.holeDeg = savedWind.holeDeg;
    setCompassAngle(windState.holeDeg);
  } else {
    setCompassAngle(0);
  }

  function saveWindPrefs() {
    if (windState.holeDeg == null || !isFinite(windState.holeDeg)) return;
    _saveWindPrefs(windState.holeDeg);
  }

  function updateWindEffectNote() {
    if (!windEffectNote) return;
    if (!windState.active) { windEffectNote.classList.remove('visible'); return; }
    const hw  = windState.headwind;
    const cw  = windState.crosswind;
    const hwAlt = hw * altFactor('mid_iron', _readHandicap());
    let msg = '';
    if (Math.abs(hw) < 0.5 && cw < 1) {
      msg = '🟢 Near-calm — wind effect minimal';
    } else if (hw > 0) {
      msg = `🔴 ${hw.toFixed(1)} m/s headwind (${hwAlt.toFixed(1)} m/s at ball height) — carries reduced`;
    } else {
      msg = `🟢 ${Math.abs(hw).toFixed(1)} m/s tailwind (${Math.abs(hwAlt).toFixed(1)} m/s at ball height) — carries increased`;
    }
    // Gust warning — shown when gusts are significant relative to sustained
    if (windState.gustMs && windState.gustMs > windState.speedMs * 1.2) {
      const gustRatio = ((windState.gustMs / windState.speedMs - 1) * 100).toFixed(0);
      msg += ` · ⚡ Gusts ${windState.gustMs.toFixed(1)} m/s (+${gustRatio}%) — variable conditions`;
    }
    if (cw >= 4) msg += ` · ⚠ ${cw.toFixed(1)} m/s crosswind — aim into wind`;
    windEffectNote.textContent = msg;
    windEffectNote.classList.add('visible');
    if (typeof updateWindBreakdown === 'function') updateWindBreakdown();
  }

  // ── Stop live orientation ──────────────────────────────────────────────
  function stopLiveOrientation() {
    if (orientationHandler) {
      if (orientationHandler._absWrapper) {
        window.removeEventListener('deviceorientationabsolute', orientationHandler._absWrapper);
      } else {
        window.removeEventListener('deviceorientationabsolute', orientationHandler);
      }
      window.removeEventListener('deviceorientation', orientationHandler);
      orientationHandler = null;
    }
    liveOrientationActive = false;
    _absOrientFired = false;
    compassLiveBadge.classList.remove('active');
  }

  // ── Lock button — start live tracking, then lock on second tap ─────────
  let lockPhase = 'idle'; // 'idle' | 'live'

  if (compassLock) compassLock.addEventListener('click', async () => {
    if (lockPhase === 'live') {
      // Second tap — lock current heading
      stopLiveOrientation();
      lockPhase = 'idle';
      const _cll = document.getElementById('compassLockLabel'); if (_cll) _cll.textContent = `Locked: ${Math.round(windState.holeDeg)}° (${bearingLabel(windState.holeDeg)})`;
      computeWindComponents();
      updateWindEffectNote();
      updateWindStripText();
      saveWindPrefs();
      const out = document.getElementById('output');
      if (out.querySelector('.carousel-outer, .error')) calculate();
      return;
    }

    // First tap — request permission then start live tracking
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') {
          const _cll2 = document.getElementById('compassLockLabel'); if (_cll2) _cll2.textContent = 'Permission denied — drag compass instead';
          return;
        }
      } catch(e) {
        const _cll3 = document.getElementById('compassLockLabel'); if (_cll3) _cll3.textContent = 'Not supported — drag compass instead';
        return;
      }
    }

    lockPhase = 'live';
    const _cll4 = document.getElementById('compassLockLabel'); if (_cll4) _cll4.textContent = 'Tap again to lock direction';
    compassLiveBadge.classList.add('active');
    liveOrientationActive = true;

    orientationHandler = (e) => {
      const heading = e.webkitCompassHeading != null
        ? e.webkitCompassHeading
        : (360 - (e.alpha ?? 0)) % 360;
      if (heading == null || isNaN(heading)) return;
      windState.holeDeg = heading;
      setCompassAngle(heading);
      // Live wind effect update (throttled)
      if (!orientationHandler._t) {
        orientationHandler._t = setTimeout(() => {
          orientationHandler._t = null;
          computeWindComponents();
          updateWindEffectNote();
          updateWindStripText();
          const out = document.getElementById('output');
          if (out.querySelector('.carousel-outer, .error')) calculate();
        }, 150);
      }
    };

    const _absWrapper1 = (e) => { _absOrientFired = true; orientationHandler(e); };
    window.addEventListener('deviceorientationabsolute', _absWrapper1);
    orientationHandler._absWrapper = _absWrapper1;
    // Small delay before attaching standard fallback to avoid double-fire
    setTimeout(() => {
      if (liveOrientationActive && !_absOrientFired) {
        window.addEventListener('deviceorientation', orientationHandler);
      }
    }, 300);

    // 30s timeout — auto-lock if user forgets
    setTimeout(() => {
      if (lockPhase === 'live') {
        stopLiveOrientation();
        lockPhase = 'idle';
        document.getElementById('compassLockLabel').textContent = `Auto-locked: ${Math.round(windState.holeDeg)}°`;
        computeWindComponents();
        updateWindEffectNote();
        saveWindPrefs();
      }
    }, 30000);
  });

  // Update the collapsed wind strip text with a concise summary
  function updateWindStripText() {
    const el = document.getElementById('windText');
    if (!windState.speedMs) {
      el.textContent = 'Fetch local wind';
      return;
    }
    const fromLabel = windDirectionLabel(windState.dirDeg);
    const _windIcon = `<svg width="13" height="13" viewBox="-2.000 -74.459 100.290 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px;margin-right:3px;flex-shrink:0;"><path d="M48.7305-0.732422C54.7852-0.732422 59.5215-5.17578 59.5215-11.6699C59.5215-20.8984 50.2441-26.0254 32.9102-26.0254C26.0254-26.0254 18.457-24.8047 12.0117-22.5586C10.2539-21.9727 9.47266-20.459 9.91211-18.9453C10.3516-17.4316 11.8164-16.5039 13.7207-17.1875C19.7266-19.2383 26.2207-20.4102 32.9102-20.4102C46.6797-20.4102 53.9062-16.9922 53.9062-11.6699C53.9062-8.30078 51.5625-6.34766 48.7305-6.34766C45.8496-6.34766 44.2383-8.34961 43.7012-11.377C43.4082-12.9883 42.2852-14.3066 40.4297-14.1602C38.4277-14.0137 37.6953-12.3535 37.9395-10.6445C38.623-5.22461 42.627-0.732422 48.7305-0.732422Z"/><path d="M73.1445-27.8809C82.1289-27.8809 88.5742-33.6914 88.5742-41.748C88.5742-49.8535 82.4219-55.5664 74.7559-55.5664C67.7734-55.5664 62.5977-50.8301 61.6211-44.4336C61.3281-42.627 62.3047-41.2109 63.8672-40.9668C65.4785-40.7227 66.8945-41.6992 67.2852-43.7988C67.9199-47.5586 71.0938-49.9512 74.7559-49.9512C79.2969-49.9512 82.959-46.6797 82.959-41.748C82.959-36.8652 79.0527-33.4961 73.1445-33.4961C61.5723-33.4961 49.0723-40.1367 33.7891-40.1367C26.0254-40.1367 18.7988-38.9648 12.0117-36.6211C10.2539-36.0352 9.47266-34.5215 9.91211-33.0078C10.3516-31.4941 11.8164-30.5664 13.7207-31.25C19.9707-33.4473 26.416-34.5215 33.7891-34.5215C49.0723-34.5215 60.2051-27.8809 73.1445-27.8809Z"/><path d="M13.7207-46.1426C19.2871-47.8027 25-48.584 30.3223-48.584C37.1094-48.584 42.2852-47.5586 48.6816-47.5586C55.8594-47.5586 60.2051-52.4414 60.2051-58.6426C60.2051-65.1367 55.2734-69.6777 49.2188-69.6777C44.9219-69.6777 41.0645-67.0898 39.2578-63.5742C38.5254-62.1582 38.7207-60.4492 40.2344-59.6191C41.6016-58.8867 43.3594-59.2773 44.3359-61.0352C45.166-62.6953 47.1191-64.0137 49.2188-64.0137C52.1484-64.0137 54.5898-62.0117 54.5898-58.6426C54.5898-55.3223 52.2949-53.2227 48.6816-53.2227C42.6758-53.2227 37.3047-54.248 30.3223-54.248C24.0234-54.248 17.7734-53.2227 12.0117-51.5625C10.2051-51.0254 9.47266-49.4629 9.91211-47.9492C10.3516-46.4844 11.7676-45.5566 13.7207-46.1426Z"/></svg>`;
    let text = `${windState.speedMs.toFixed(1)} m/s from ${fromLabel}`;
    // Show gusts if meaningfully higher than sustained (>20% more)
    if (windState.gustMs && windState.gustMs > windState.speedMs * 1.2) {
      text += ` (gusts ${windState.gustMs.toFixed(1)})`;
    }
    if (windState.active) {
      const hw = windState.headwind;
      const cw = windState.crosswind;
      if (Math.abs(hw) >= 0.5) {
        text += hw > 0
          ? ` · ${hw.toFixed(1)}m/s head`
          : ` · ${Math.abs(hw).toFixed(1)}m/s tail`;
      }
      if (cw >= 2) text += ` · ↗ cross`;
    } else if (windState.holeDeg != null) {
      text += ` · ${bearingLabel(windState.holeDeg)} hole`;
    }
    el.innerHTML = _windIcon + text;
  }

  // ── Strip lock button — mirrors compassLock, works when panel is collapsed ─
  function setLockIcon(state, deg) {
    const btn  = document.getElementById('windLockStrip');
    const icon = document.getElementById('windLockIcon');
    const hint = document.getElementById('windLockHint');
    if (!btn || !icon) return;
    btn.classList.remove('locking', 'locked');
    if (state === 'locking') btn.classList.add('locking');
    if (state === 'locked')  btn.classList.add('locked');
    icon.style.transform = (state === 'locked' && deg != null)
      ? `rotate(${Math.round(deg)}deg)` : 'rotate(0deg)';
    if (hint) hint.style.display = state === 'locking' ? 'block' : 'none';
    if (typeof updateWindBreakdown === 'function') updateWindBreakdown();
  }

  const windLockStrip = document.getElementById('windLockStrip');
  windLockStrip.addEventListener('click', async (e) => {
    e.stopPropagation(); // don't toggle the collapsible
    // Delegate to the same lock logic by simulating a click on compassLock
    // but we manage state here to keep the strip button label in sync too
    if (lockPhase === 'live') {
      // Second tap — lock
      stopLiveOrientation();
      lockPhase = 'idle';
      const deg = Math.round(windState.holeDeg);
      const lbl = bearingLabel(deg);
      const _cll = document.getElementById('compassLockLabel'); if (_cll) _cll.textContent = `Locked: ${deg}° (${lbl})`;
      setLockIcon('locked', deg);
      computeWindComponents();
      updateWindEffectNote();
      updateWindStripText(); // restores normal wind text
      saveWindPrefs();
      const out = document.getElementById('output');
      if (out.querySelector('.carousel-outer, .error')) calculate();
      return;
    }

    // First tap — request permission and start live
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') {
          setLockIcon('idle');
          return;
        }
      } catch(e) {
        setLockIcon('idle');
        return;
      }
    }
    lockPhase = 'live';
    setLockIcon('locking');
    windText.textContent = 'Point toward hole, tap again to lock →';
    compassLiveBadge.classList.add('active');
    liveOrientationActive = true;
    orientationHandler = (e) => {
      const heading = e.webkitCompassHeading != null
        ? e.webkitCompassHeading : (360 - (e.alpha ?? 0)) % 360;
      if (heading == null || isNaN(heading)) return;
      windState.holeDeg = heading;
      setCompassAngle(heading);
      // Rotate strip icon live with phone heading instead of CSS spin
      const icon = document.getElementById('windLockIcon');
      if (icon) icon.style.transform = `rotate(${Math.round(heading)}deg)`;
    };
    const _absWrapper2 = (e) => { _absOrientFired = true; orientationHandler(e); };
    window.addEventListener('deviceorientationabsolute', _absWrapper2);
    orientationHandler._absWrapper = _absWrapper2;
    setTimeout(() => {
      if (liveOrientationActive && !_absOrientFired)
        window.addEventListener('deviceorientation', orientationHandler);
    }, 300);
  });

  // ── Shared: apply fetched or manual wind data ────────────────────────
  function applyWindData(speedMs, gustMs, dirDeg, locationLabel, tempC, feelsLike, rainPct) {
    windState.speedMs   = speedMs;
    windState.gustMs    = gustMs;
    windState.dirDeg    = dirDeg;
    if (tempC     !== undefined && tempC     !== null) windState.tempC     = tempC;
    if (feelsLike !== undefined && feelsLike !== null) windState.feelsLike = feelsLike;
    if (rainPct   !== undefined && rainPct   !== null) windState.rainPct   = rainPct;
    if (locationLabel) compassLocation.textContent = `📍 ${locationLabel}`;
    updateWindStripText();
    document.getElementById('compassSection').style.display = 'block';
    // Hide manual entry once real wind data is loaded
    var _me = document.getElementById('windManualEntry');
    if (_me) _me.classList.remove('visible');
    const calcBtn = document.getElementById('calcButton');
    if (calcBtn && !calcBtn.classList.contains('course-active')) {
      calcBtn.textContent = 'Calculate Shot Plan + Wind';
    }
    computeWindComponents();
    updateWindSectionStatus();
    updateWindEffectNote();
    const out = document.getElementById('output');
    if (out.querySelector('.carousel-outer, .error')) calculate();
  }

  // ── Show / hide offline manual entry UI ──────────────────────────────
  const windOfflineMsg   = document.getElementById('windOfflineMsg');
  const windManualEntry  = document.getElementById('windManualEntry');

  function showOfflineFallback(reason) {
    windOfflineMsg.textContent = reason;
    windOfflineMsg.classList.add('visible');
    windManualEntry.classList.add('visible');
    windText.textContent = '⚠ No wind data — set manually below';
  }

  function hideOfflineFallback() {
    windOfflineMsg.classList.remove('visible');
  }

  // ── Manual wind apply ─────────────────────────────────────────────────
  document.getElementById('windManualApply').addEventListener('click', () => {
    const speed = parseFloat(document.getElementById('windManualSpeed').value);
    const dir   = parseInt(document.getElementById('windManualDir').value, 10);
    if (isNaN(speed) || speed < 0) {
      windOfflineMsg.textContent = '⚠ Enter a valid speed (0 or more m/s)';
      return;
    }
    hideOfflineFallback();
    applyWindData(speed, null, dir, `Manual entry · ${speed} m/s from ${bearingLabel(dir)}`);
  });

  // ── Toast helper ──────────────────────────────────────────────────────
  function showToast(msg, durationMs = 2200) {
    let toast = document.getElementById('_windToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = '_windToast';
      toast.style.cssText = 'position:fixed;bottom:88px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.78);color:#fff;padding:10px 20px;border-radius:20px;font-size:15px;pointer-events:none;z-index:9999;transition:opacity 0.35s';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { toast.style.opacity = '0'; }, durationMs);
  }

  // ── Fetch wind + lock direction (point-and-shoot) ─────────────────────
  document.getElementById('windRefresh').addEventListener('click', async (e) => {
    e.stopPropagation();
    hideOfflineFallback();

    if (!navigator.onLine) {
      showOfflineFallback('📶 No internet connection — wind data unavailable offline.');
      return;
    }

    windText.textContent = '📍 Detecting location…';
    if (!navigator.geolocation) {
      windText.textContent = '⚠ GPS not available in this browser';
      return;
    }

    // Request orientation permission immediately — must be inside user gesture
    let orientPermGranted = false;
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        orientPermGranted = perm === 'granted';
      } catch(_e) { /* denied or unsupported */ }
    } else {
      orientPermGranted = typeof DeviceOrientationEvent !== 'undefined';
    }

    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      try {
        windText.textContent = '⏳ Fetching wind…';

        // Collect orientation readings for 1.5 s in parallel with wind fetch
        let orientPromise = Promise.resolve(null);
        if (orientPermGranted && !liveOrientationActive && lockPhase === 'idle') {
          orientPromise = new Promise(resolve => {
            const readings = [];
            const _h = (ev) => {
              const h = ev.webkitCompassHeading != null
                ? ev.webkitCompassHeading
                : (360 - (ev.alpha ?? 0)) % 360;
              if (h != null && !isNaN(h)) readings.push(h);
            };
            let _absFired = false;
            const _absH = (ev) => { _absFired = true; _h(ev); };
            window.addEventListener('deviceorientationabsolute', _absH);
            const _fbTimer = setTimeout(() => {
              if (!_absFired) window.addEventListener('deviceorientation', _h);
            }, 300);
            setTimeout(() => {
              clearTimeout(_fbTimer);
              window.removeEventListener('deviceorientationabsolute', _absH);
              window.removeEventListener('deviceorientation', _h);
              if (readings.length === 0) { resolve(null); return; }
              const r = readings.slice(-8).sort((a, b) => a - b);
              resolve(r[Math.floor(r.length / 2)]);
            }, 1500);
          });
        }

        const [locationName, w, heading] = await Promise.all([
          fetchLocationName(lat, lon),
          fetchWind(lat, lon),
          orientPromise,
        ]);

        if (heading !== null) {
          windState.holeDeg = Math.round(heading);
          setCompassAngle(windState.holeDeg);
          setLockIcon('locked', windState.holeDeg);
          lockPhase = 'idle';
          saveWindPrefs();
        }

        applyWindData(w.speedMs, w.gustMs, w.dirDeg, locationName, w.tempC, w.feelsLike, w.rainPct);

        if (heading !== null) {
          showToast('Wind + direction locked');
        }

      } catch(err) {
        if (!navigator.onLine || err instanceof TypeError) {
          showOfflineFallback('📶 Lost connection during fetch — set wind manually or retry when online.');
        } else {
          windText.textContent = '⚠ Wind service unavailable — try again';
          windOfflineMsg.textContent = 'Wind service returned an error. You can set wind manually:';
          windOfflineMsg.classList.add('visible');
          windManualEntry.classList.add('visible');
        }
      }
    }, (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        windText.textContent = '⚠ Location access denied — enable GPS and retry';
      } else {
        showOfflineFallback('📍 Could not get GPS location. Set wind direction and speed manually:');
      }
    }, { timeout: 8000, maximumAge: 60000 });
  });

  // Init on load if saved prefs + existing wind data available
  if (windState.holeDeg != null && windState.speedMs != null) {
    computeWindComponents();
    updateWindEffectNote();
    updateWindSectionStatus();
  }

  // ── GPS Distance Tracker ─────────────────────────────────────────────
  const gpsTeeBtn     = document.getElementById('gpsTeeBtn');
  const gpsBallBtn    = document.getElementById('gpsBallBtn');

  // ── GPS tile UI helpers ───────────────────────────────────────────────
  function gpsTeeSetState(state) {
    // state: 'idle' | 'loading' | 'set' | 'error'
    const ind = document.getElementById('gpsTeeIndicator');
    const st  = document.getElementById('gpsTeeStatus');
    if (!ind || !st) return;
    if (state === 'set')     { ind.className = 'gps-tile-indicator set';  st.textContent = 'Set';  st.className = 'gps-tile-status ready'; }
    else if (state === 'loading') { st.textContent = '…'; st.className = 'gps-tile-status'; }
    else if (state === 'error')   { ind.className = 'gps-tile-indicator idle'; st.textContent = 'Try again'; st.className = 'gps-tile-status'; }
    else { ind.className = 'gps-tile-indicator idle'; st.textContent = 'Tap to mark'; st.className = 'gps-tile-status'; }
  }
  function gpsBallSetState(state, dist, shotN) {
    // state: 'locked' | 'ready' | 'loading' | 'set' | 'error'
    const tile = document.getElementById('gpsBallBtn');
    const ind  = document.getElementById('gpsBallIndicator');
    const st   = document.getElementById('gpsBallStatus');
    const dEl  = document.getElementById('gpsBallDist');
    if (!tile) return;
    if (state === 'locked') { tile.style.opacity = '0.45'; tile.style.pointerEvents = 'none'; if (st) st.textContent = 'Mark tee first'; if (ind) ind.className = 'gps-tile-indicator idle'; if (dEl) dEl.style.display = 'none'; }
    else if (state === 'ready') { tile.style.opacity = '1'; tile.style.pointerEvents = 'auto'; if (ind) ind.className = 'gps-tile-indicator idle'; if (st) { st.textContent = shotN > 0 ? `Shot ${shotN + 1}` : 'Tap to mark'; st.className = 'gps-tile-status tap'; } if (dEl) dEl.style.display = 'none'; }
    else if (state === 'loading') { if (st) { st.textContent = '…'; st.className = 'gps-tile-status'; } }
    else if (state === 'set') { tile.style.opacity = '1'; tile.style.pointerEvents = 'auto'; if (ind) ind.className = 'gps-tile-indicator set'; if (st) { st.textContent = `Shot ${shotN}`; st.className = 'gps-tile-status ready'; } if (dEl && dist) { dEl.innerHTML = dist + '<span class="gps-tile-dist-unit">m</span>'; dEl.style.display = 'block'; } }
    else if (state === 'error') { if (st) { st.textContent = 'Try again'; st.className = 'gps-tile-status'; } }
  }
  const gpsReset      = document.getElementById('gpsReset');
  const gpsWarning    = document.getElementById('gpsWarning');

  // ── Timestamp ticker ──────────────────────────────────────────────────
  // ── Result display ────────────────────────────────────────────────────
  function renderGpsResult() {
    // Result lives in the carousel card (cc-gps-remaining block).
    // Trigger a recalculate so the card updates.
    const out = document.getElementById('output');
    if (out.querySelector('.carousel-outer, .error')) calculate();
  }

  // ── Restore state on load ─────────────────────────────────────────────
  function applyRestoredState(saved) {
    restoreGpsState(saved);

    gpsTeeSetState('set');
    gpsBallSetState('ready', null, completedShots.length);
    if (completedShots.length > 0) {
      const last = completedShots[completedShots.length - 1];
      gpsBallSetState('set', last?.dist, completedShots.length);
      gpsBallSetState('ready', null, completedShots.length);
    }
    gpsReset.style.display = 'inline';

    renderGpsResult();
  }

  const savedGps = loadTeeState();
  if (savedGps?.teeMark) applyRestoredState(savedGps);

  // ── Mark Tee ──────────────────────────────────────────────────────────
  gpsTeeBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      gpsWarning.textContent = '⚠ GPS not available in this browser';
      gpsWarning.style.display = 'block';
      return;
    }
    gpsTeeSetState('loading');
    gpsWarning.style.display = 'none';

    try {
      const pos = await averagedPosition(4);

      clearGpsState();
      Object.keys(gpsShot2Overrides).forEach(k => delete gpsShot2Overrides[k]);
      clearTeeState();
      markTeePosition(pos);
      _saveTeeState(getGpsSnapshot());

      gpsTeeSetState('set');
      gpsBallSetState('ready', null, 0);
      gpsReset.style.display = 'inline';

      if (pos.accuracy > 15) {
        gpsWarning.textContent = `⚠ GPS accuracy ±${Math.round(pos.accuracy)}m — reading may be off`;
        gpsWarning.style.display = 'block';
      } else {
        gpsWarning.style.display = 'none';
      }

      const out = document.getElementById('output');
      if (out.querySelector('.carousel-outer, .error')) calculate();

    } catch(e) {
      gpsTeeSetState('error');
      gpsWarning.textContent = '⚠ Could not get GPS fix — try again outdoors';
      gpsWarning.style.display = 'block';
    }
  });

  // ── Mark Ball ─────────────────────────────────────────────────────────
  gpsBallBtn.addEventListener('click', async () => {
    if (!teeMarked) return;
    gpsBallSetState('loading', null, 0);
    gpsWarning.style.display = 'none';

    try {
      const pos     = await averagedPosition(4);
      const holeLen = Number(document.getElementById('holeLength').value) || 0;
      const { shotDist } = recordShot(pos, holeLen);
      _saveTeeState(getGpsSnapshot());

      gpsBallSetState('set', shotDist, completedShots.length);
      gpsBallSetState('ready', null, completedShots.length);

      if (pos.accuracy > 15) {
        gpsWarning.textContent = `⚠ GPS accuracy ±${Math.round(pos.accuracy)}m — reading may be off`;
        gpsWarning.style.display = 'block';
      }

      renderGpsResult();

    } catch(e) {
      gpsBallSetState('error', null, completedShots.length);
      gpsWarning.textContent = '⚠ GPS fix failed — try again';
      gpsWarning.style.display = 'block';
    }
  });

  // ── Reset GPS ─────────────────────────────────────────────────────────
  gpsReset.addEventListener('click', () => {
    clearGpsState();
    Object.keys(gpsShot2Overrides).forEach(k => delete gpsShot2Overrides[k]);
    clearTeeState();

    try {
      const session   = loadActiveCourse();
      const holeIdx   = session.holeIdx ?? 0;
      const committed = getCommittedStrategies();
      delete committed[holeIdx];
      setCommittedStrategies(null, committed);
    } catch(e) {}

    gpsTeeSetState('idle');
    gpsBallSetState('locked', null, 0);
    gpsReset.style.display = 'none';
    gpsWarning.style.display = 'none';

    {
      const _sess2 = loadActiveCourse();
      if (_sess2.id) {
        try {
          const { id, holeIdx } = _sess2;
          const courses = loadCourses();
          if (courses[id]) renderScoreEntry(id, holeIdx, loadScores(id), buildCallbacks());
        } catch(e) {}
      }
    }

    const out = document.getElementById('output');
    if (out.querySelector('.carousel-outer, .error')) calculate();
  });

  // ── Calculate ─────────────────────────────────────────────────────────
  // Tracks the last par value a successful plan was rendered for.
  // Used to detect whether Par 3 results are currently shown without
  // fragile innerHTML string checks.
  // Exposed on window so the prepare-module can also read it.
  let lastParValue = null;


  function readInputsFromDOM() {
    const hole     = Number(document.getElementById('holeLength').value);
    const parValue = Number(document.getElementById('parSelect').value);
    const driver   = Number(document.getElementById('driverCarry').value);
    const i7       = Number(document.getElementById('i7Carry').value) || 0;
    const pw       = Number(document.getElementById('pwCarry').value) || 0;
    const conditions = document.getElementById('conditions').value;

    let sessionCourseId = null, sessionHoleIdx = null;
    try {
      const _sess = loadActiveCourse();
      if (_sess.id) {
        sessionCourseId = _sess.id     ?? null;
        sessionHoleIdx  = _sess.holeIdx ?? null;
      }
      _overrideHoleIdx  = sessionHoleIdx  ?? 0;
      _overrideCourseId = sessionCourseId ?? '';
    } catch(e) { _overrideHoleIdx = 0; _overrideCourseId = ''; }

    let _blCourseId = null, _blHoleIdx = null, _hcpAdjComputed = null;
    try {
      if (sessionCourseId !== null && sessionHoleIdx !== null) {
        const _siCourse = loadCourses()[sessionCourseId];
        _blCourseId = sessionCourseId; _blHoleIdx = sessionHoleIdx;
        const _prof = loadProfile();
        const _hcpIdx = parseFloat(_prof.handicap);
        const _cr  = parseFloat(_siCourse?.courseRating);
        const _sl  = parseInt(_siCourse?.slopeRating);
        const _par = (_siCourse?.holes || []).reduce((a, h) => a + (h.par || 4), 0);
        const _allSI = (_siCourse?.holes || []).map(h => h.si || 0);
        const _siOk = _allSI.length === 18 && _allSI.every(si => si >= 1 && si <= 18);
        if (!isNaN(_hcpIdx) && _hcpIdx > 0 && _cr > 0 && _sl > 0 && _siOk) {
          const _playingHcp = Math.round(_hcpIdx * (_sl / 113) + (_cr - _par));
          const _si = _allSI[sessionHoleIdx];
          const _fullRounds = Math.floor(_playingHcp / 18);
          const _remainder  = _playingHcp % 18;
          _hcpAdjComputed = _fullRounds + (_si <= _remainder ? 1 : 0);
        }
      }
    } catch(e) {}

    let committedStrategyStr = null;
    try {
      if (sessionHoleIdx !== null) {
        const _committed = getCommittedStrategies();
        committedStrategyStr = _committed[sessionHoleIdx] || null;
      }
    } catch(e) {}

    let handicap = null;
    try {
      const _ph = loadProfile();
      const _hv = parseFloat(_ph.handicap);
      if (!isNaN(_hv) && _hv > 0) handicap = _hv;
    } catch(e) {}

    return {
      hole, parValue, driver, i7, pw, conditions,
      teeMarked, completedShots, inRough: getInRough(),
      sessionCourseId, sessionHoleIdx,
      _blCourseId, _blHoleIdx, _hcpAdjComputed,
      committedStrategyStr, handicap,
    };
  }

  function computePlan(inputs) {
    const { hole, parValue, driver, i7, pw, conditions,
            teeMarked, completedShots, inRough,
            sessionCourseId, sessionHoleIdx,
            _blCourseId, _blHoleIdx, _hcpAdjComputed,
            committedStrategyStr, handicap } = inputs;
    const clearOverrides = inputs.clearOverrides || false;
    _holeHcpAdj = _hcpAdjComputed ?? null;

    if (!hole || hole < 50)     return { isError: true, msg: 'Please enter a valid hole length.' };
    if (!driver || driver < 50) return { isError: true, msg: 'Please enter your driver carry distance.' };

    const clubsList = getClubs(driver, i7, pw, windState);
    if (clubsList.length === 0) return { isError: true, msg: 'No clubs selected.' };

    const driverClub = clubsList.find(c => c.key === 'driver');
    const driverTotal = driverClub ? driverClub.total : driver * getRollFactor('driver', conditions);
    const driverCarry = driverClub ? driverClub.carry : driver;
    const isFirm = conditions === 'firm';

    // ── Par 3 ──────────────────────────────────────────────────────────
    if (parValue === 3) {
      const result = calcPar3(clubsList, hole);
      if (!result) return { isError: true, msg: 'No selected club reaches within the hole length. Check carry inputs or selected clubs.' };
      const par3DefaultClub = result.club;
      const par3ActiveClub  = par3Override()
        ? (clubsList.find(c => c.key === par3Override()) || par3DefaultClub)
        : par3DefaultClub;
      const s = par3ActiveClub;
      const gpsActive3 = teeMarked && completedShots?.length > 0
        && completedShots[completedShots.length - 1]?.remaining != null;
      let scoreVal3;
      if (gpsActive3) {
        const shotsTaken = completedShots.length;
        const rem = completedShots[completedShots.length - 1].remaining;
        scoreVal3 = shotsTaken + expectedStrokesRemaining(rem, driverCarry, handicap, inRough, windState, undefined, _holeHcpAdj, _personalCal);
      } else {
        const remaining = Math.max(0, hole - s.total);
        scoreVal3 = 1 + expectedStrokesRemaining(remaining, driverCarry, handicap, inRough, windState, undefined, _holeHcpAdj, _personalCal);
      }
      if (_blCourseId && _blHoleIdx !== null) {
        const bl3 = blendedScore(scoreVal3, _blCourseId, _blHoleIdx);
        scoreVal3 = bl3.score;
      }
      const diff3 = scoreVal3 - 3;
      lastParValue = 3;
      try {
        if (sessionHoleIdx !== null) {
          const _committed = getCommittedStrategies();
          const clubLabel = clubMap[s.key]?.label ?? s.key;
          _committed[sessionHoleIdx] = `Par 3 · ${clubLabel}`;
          setCommittedStrategies(null, _committed);
        }
      } catch(e) {}
      return {
        isError: false, isPar3: true,
        parValue, hole, driver, conditions, isFirm,
        clubsList, driverClub, driverCarry, driverTotal,
        teeMarked, completedShots, inRough, handicap,
        ordered: [], activePlanType: null,
        _blCourseId, _blHoleIdx,
        par3: { par3DefaultClub, par3ActiveClub, s, scoreVal3, diff3, gpsActive3 },
      };
    }

    lastParValue = parValue;
    if (clearOverrides) {
      Object.keys(teeOverrides).forEach(k => delete teeOverrides[k]);
      Object.keys(shot2Overrides).forEach(k => delete shot2Overrides[k]);
      Object.keys(approachOverrides).forEach(k => delete approachOverrides[k]);
      Object.keys(gpsShot2Overrides).forEach(k => delete gpsShot2Overrides[k]);
      par3ClubOverrides[_overrideCourseId + '|' + _overrideHoleIdx] = null;
    }

    const validTeeClubs = getValidTeeClubs(clubsList, parValue);
    if (!validTeeClubs[0]) return { isError: true, msg: 'No valid clubs for this par. Check bag setup.' };

    const STRATEGY_TYPES = ['Max distance', 'Controlled', 'Conservative'];
    const ordered = [];
    validTeeClubs.forEach((teeClub, rank) => {
      if (!teeClub) return; // category not available in this bag
      const p = findBestContinuation(teeClub, hole, driverTotal, clubsList, driverCarry, handicap, inRough, windState, _holeHcpAdj, _personalCal);
      if (!p) return;
      p.type = STRATEGY_TYPES[rank];
      ordered.push(p);
    });
    if (ordered.length === 0) return { isError: true, msg: 'No valid plans found. Check inputs or selected clubs.' };

    if (_blCourseId !== null && _blHoleIdx !== null) {
      ordered.forEach(p => {
        const bl = blendedScore(p.score, _blCourseId, _blHoleIdx);
        p.score = bl.score;
        p.blended = bl.blended;
        p.blendRounds = bl.rounds;
      });
    }

    let activePlanType = ordered.reduce(
      (best, p) => p.score < best.score ? p : best,
      ordered[0]
    ).type;

    try {
      if (committedStrategyStr) {
        const _parts = committedStrategyStr.split(' · ');
        const _committedType = _parts.length >= 2 ? _parts[0] : committedStrategyStr;
        if (_committedType && ordered.find(p => p.type === _committedType)) {
          activePlanType = _committedType;
        }
      }
    } catch(e) {}

    // Component 1: best historical strategy for this hole on this course
    let holeStrategyRec = null;
    try {
      if (sessionCourseId && sessionHoleIdx !== null) {
        holeStrategyRec = analyzeHoleStrategies(loadRounds(sessionCourseId), sessionHoleIdx);
      }
    } catch(e) {}

    // Component 2: cross-course approach distance scoring zone
    let scoringZone = null;
    try { scoringZone = analyzeApproachDistances(loadAllRounds()); } catch(e) {}

    return {
      isError: false, isPar3: false,
      parValue, hole, driver, conditions, isFirm,
      clubsList, driverClub, driverCarry, driverTotal,
      teeMarked, completedShots, inRough, handicap,
      ordered, activePlanType,
      _blCourseId, _blHoleIdx,
      holeStrategyRec, scoringZone,
      personalCal: _personalCal,
    };
  }


  function calculate(clearOverrides = false) {
    const inputs = readInputsFromDOM();
    inputs.clearOverrides = clearOverrides;
    const plan = computePlan(inputs);
    if (!plan.isError) {
      const _exp = plan.isPar3
        ? plan.par3.scoreVal3
        : (plan.ordered.find(p => p.type === plan.activePlanType) ?? plan.ordered[0])?.score;
      setHoleExpected(_exp);
    }
    renderPlan(plan, {
      windState, _holeHcpAdj, _overrideCourseId, _overrideHoleIdx,
      par3ClubOverrides, teeOverrides, shot2Overrides, approachOverrides, gpsShot2Overrides,
      par3Override, _hk,
      blendedScore:        (s, c, h) => blendedScore(s, c, h),
      computeHoleBaseline: (...a) => computeHoleBaseline(...a),
      calculate,
      openClubPicker:      (key, onSelect, constraints, title) => openClubPicker(key, onSelect, constraints, plan.clubsList, title),
      updateCalcButtonVisibility,
    });
  }



  // ── Play focus strip — hole-specific or general course tip during a round ──
  function _holeSpecificTip(course, rounds, holeIdx) {
    if (!course || !rounds.length) return null;
    const par = course.holes?.[holeIdx]?.par || 4;
    const holeScores = rounds
      .filter(r => r.scores?.[holeIdx])
      .map(r => {
        const s = r.scores[holeIdx];
        const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
        return { total, fir: s.fir, gir: s.gir, putts: s.putts || 0 };
      })
      .filter(s => s.total > 0);
    if (holeScores.length < 3) return null;

    const n        = holeScores.length;
    const avgVsPar = holeScores.reduce((a, s) => a + (s.total - par), 0) / n;
    const avgStr   = avgVsPar > 0 ? '+' + avgVsPar.toFixed(1) : avgVsPar.toFixed(1);
    const firPars  = par >= 4 ? holeScores : [];
    const firRate  = firPars.length > 0 ? firPars.filter(s => s.fir === true).length / firPars.length : null;
    const girRate  = holeScores.filter(s => s.gir === true).length / n;
    const avgPutts = holeScores.reduce((a, s) => a + s.putts, 0) / n;
    const hNum     = holeIdx + 1;

    // ── Strength tips (avg ≤ par) ──────────────────────────────────────────
    if (avgVsPar <= 0) {
      if (avgVsPar < -0.3) return `Hole ${hNum} avg ${avgStr} — this is one of your best holes. Back yourself.`;
      if (girRate > 0.6)   return `Hole ${hNum} avg ${avgStr} — your approach game is sharp here. Same routine.`;
      if (firRate !== null && firRate > 0.6) return `Hole ${hNum} avg ${avgStr} — you find the fairway here. Trust that swing.`;
      return `Hole ${hNum} avg ${avgStr} — you play this well. Stick to your plan.`;
    }

    // ── Neutral / no strong signal ─────────────────────────────────────────
    if (Math.abs(avgVsPar) < 0.4) {
      if (girRate > 0.5)   return `Hole ${hNum} avg ${avgStr} — good GIR rate here. Putt without fear.`;
      if (avgPutts < 1.8)  return `Hole ${hNum} avg ${avgStr} — solid putter on this green. Keep it simple.`;
      return null; // no useful signal, let the general tip show
    }

    // ── Weakness tips ──────────────────────────────────────────────────────
    if (firRate !== null && firRate < 0.35) {
      const pct = Math.round(firRate * 100);
      return `Hole ${hNum} avg ${avgStr} — fairway only ${pct}% of the time here. Take one club less and put it in play.`;
    }
    if (firRate !== null && firRate < 0.55 && avgVsPar > 0.5) {
      return `Hole ${hNum} avg ${avgStr} — misses off the tee are costing you. Commit to a conservative line.`;
    }
    if (girRate < 0.25) {
      const pct = Math.round(girRate * 100);
      return `Hole ${hNum} avg ${avgStr} — GIR only ${pct}% here. Pick a landing zone on the center of the green, not the flag.`;
    }
    if (girRate < 0.45 && avgVsPar > 0.5) {
      return `Hole ${hNum} avg ${avgStr} — approach shots are missing here. Leave yourself a full wedge into the green.`;
    }
    if (avgPutts > 2.3) {
      return `Hole ${hNum} avg ${avgStr} — you're averaging ${avgPutts.toFixed(1)} putts here. Your first putt is the one that matters — get it close.`;
    }
    if (avgPutts > 2.0 && avgVsPar > 0.5) {
      return `Hole ${hNum} avg ${avgStr} — three-putt risk on this green. Play your approach shot for the easy two-putt zone.`;
    }
    return `Hole ${hNum} avg ${avgStr} — this hole costs you strokes. Play conservative and take par.`;
  }

  function _updatePlayFocusStrip(courseId, holeIdx) {
    const strip = document.getElementById('playFocusStrip');
    if (!strip) return;
    if (!courseId) { strip.classList.add('hidden'); strip.dataset.tip = ''; return; }
    try {
      const courses = loadCourses();
      const course  = courses[courseId];
      const rounds  = loadRounds(courseId);
      const tip = _holeSpecificTip(course, rounds, holeIdx);
      if (tip) {
        strip.dataset.tip = tip;
        strip.classList.remove('pfs-empty');
        strip.innerHTML =
          `<div class="pfs-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg></div>` +
          `<div class="pfs-text">${tip}</div>`;
        // Respect widget pref
        const { focus } = loadWidgetPrefs();
        strip.style.display = focus ? '' : 'none';
        if (focus) strip.classList.remove('hidden');
        else strip.classList.add('hidden');
      } else {
        strip.dataset.tip = '';
        strip.classList.add('hidden', 'pfs-empty');
      }
    } catch(e) { strip.classList.add('hidden'); }
  }

  // After calculate(), render score entry if a course is active
  // renderScoreEntry / loadCourses / loadScores live in prepare-module — guard with typeof
  const _origCalculate = calculate;
  calculate = function(clearOverrides = false) {
    // On explicit button press, clear committed strategy for this hole
    if (clearOverrides) {
      try {
        const _sess = loadActiveCourse();
        if (_sess.id) {
          const { holeIdx: _hi } = _sess;
          const _committed = getCommittedStrategies();
          delete _committed[_hi];
          setCommittedStrategies(null, _committed);
        }
      } catch(e) {}
    }
    _origCalculate(clearOverrides);
    const session = loadActiveCourse();
    if (!session.id) { _updatePlayFocusStrip(null, null); return; }
    try {
      const { id, holeIdx } = session;
      const courses = loadCourses();
      if (!courses[id]) return;
      const scores = loadScores(id);
      renderScoreEntry(id, holeIdx, scores, buildCallbacks());
      _updatePlayFocusStrip(id, holeIdx);
    } catch(e) {}
    updateCalcButtonVisibility();
    updateLoadCourseBtn();
  };

  document.getElementById('calcButton').addEventListener('click', () => calculate(true));

  // ── Recalc link (shown instead of button when course is active) ───────
  document.getElementById('recalcAnchor').addEventListener('click', () => calculate(true));

  // ── Show/hide calcButton based on course state ────────────────────────
  function updateCalcButtonVisibility() {
    const btn       = document.getElementById('calcButton');
    const recalcLnk = document.getElementById('recalcLink');
    const courseActive = !!getActiveCourseId();
    btn.classList.toggle('course-active', courseActive);
    // Show recalc link only after a result is showing
    const hasResult = !!document.getElementById('output').querySelector('.carousel-outer, .error, b');
    recalcLnk.classList.toggle('visible', courseActive && hasResult);

    // Action row: show when course active + result ready; sync pill state
    const actionRow = document.getElementById('playActionRow');
    if (actionRow) {
      const _show = courseActive && hasResult;
      actionRow.style.display = _show ? 'flex' : 'none';
      if (_show) {
        const _hi = loadActiveCourse().holeIdx ?? 0;
        const _prev = document.getElementById('playNavPrev');
        const _next = document.getElementById('playNavNext');
        if (_prev) _prev.disabled = _hi === 0;
        if (_next) _next.disabled = false;
      }
    }
  }
  // ── Wire hole nav pill ──────────────────────────────────────────────────
  (function wireHoleNav() {
    const prevBtn = document.getElementById('playNavPrev');
    const nextBtn = document.getElementById('playNavNext');
    if (!prevBtn || !nextBtn) return;

    function navTo(delta) {
      const session = loadActiveCourse();
      if (!session.id) return;
      const { id, holeIdx } = session;
      const totalHoles = loadCourses()[id]?.holes?.length ?? 18;
      const lastIdx = totalHoles - 1;
      if (delta > 0 && holeIdx >= lastIdx) {
        showRoundCompleteOverlay(id, holeIdx, buildCallbacks());
        return;
      }
      const newIdx = holeIdx + delta;
      if (newIdx < 0 || newIdx >= totalHoles) return;
      const { gameFormat: _fmt = 'strokes', hcpEnabled: _hcp = true } = loadActiveCourse();
      saveActiveCourse(id, newIdx, _fmt, _hcp);
      resetInRough();
      const bar = document.getElementById('playCourseBar');
      if (bar?._navigateTo) bar._navigateTo(newIdx);
    }

    prevBtn.addEventListener('click', () => navTo(-1));
    nextBtn.addEventListener('click', () => navTo(+1));
  })();


  // Compact conditions toggle — tap to flip soft/firm when course bar is active
  // holeCompactConditions span is now display-only.
  // condChipRow chip control handles all conditions changes.

  // Re-run instantly when conditions change, but only if a result is already shown
  document.getElementById('conditions').addEventListener('change', () => {
    updateCarryLabels();
    saveBag();
    if (typeof updateHoleCardMode === 'function') updateHoleCardMode();
    syncChipRow('condChipRowWeather', 'conditions');
    const output = document.getElementById('output');
    if (output.querySelector('.carousel-outer, .error') || lastParValue === 3) {
      calculate();
    }
  });

  document.getElementById('parSelect').addEventListener('change', () => {
    const output = document.getElementById('output');
    if (output.querySelector('.carousel-outer, .error') || lastParValue === 3) {
      calculate();
    }
  });

  // Ensure load-course button visibility is correct on first paint
  updateLoadCourseBtn();


// ── Segmented control wiring ──────────────────────────────────────────
  wireChipRow('parChipRow',        'parSelect');
  wireChipRow('condChipRow',       'conditions');
  wireChipRow('condChipRowWeather','conditions');

// ── Home screen ───────────────────────────────────────────────────────────
(function initHomeScreen() {
  const HERO_IMAGES = [
    'assets/images/Green top.webp',
    'assets/images/Bunker.webp',
    'assets/images/Green top2.webp',
    'assets/images/Autumn.webp',
    'assets/images/FW1.webp',
    'assets/images/Green1.webp',
    'assets/images/Mountains1.webp',
    'assets/images/Pen green.webp',
    'assets/images/Top3.webp',
    'assets/images/Top4.webp',
  ];

  const HERO_QUOTES = [
    { text: '"Grip it and rip it."',                                                           attrib: '— John Daly' },
    { text: '"I don\'t think I\'ve ever tried to be anything I\'m not."',                      attrib: '— John Daly' },
    { text: '"I hit the ball as hard as I can. If I can find it, I hit it again."',            attrib: '— John Daly' },
    { text: '"I\'ve always played golf my way."',                                              attrib: '— John Daly' },
    { text: '"Confidence comes from not caring what people think."',                           attrib: '— John Daly' },
    { text: '"If you start thinking too much out there, you\'re done."',                       attrib: '— John Daly' },
    { text: '"I don\'t try to swing perfect—I try to swing free."',                            attrib: '— John Daly' },
    { text: '"Golf\'s hard enough without overcomplicating it."',                              attrib: '— John Daly' },
    { text: '"Some days you have it, some days you don\'t—that\'s golf."',                     attrib: '— John Daly' },
    { text: '"I like to take the aggressive line. Sometimes it works, sometimes it doesn\'t."', attrib: '— John Daly' },
    { text: '"You can\'t play scared in this game."',                                          attrib: '— John Daly' },
    { text: '"I\'ve never been a range rat—I play by feel."',                                  attrib: '— John Daly' },
    { text: '"I don\'t analyze my swing—I just hit shots."',                                   attrib: '— John Daly' },
    { text: '"When I\'m relaxed, I play my best golf."',                                       attrib: '— John Daly' },
    { text: '"I\'m not built for conservative golf."',                                         attrib: '— John Daly' },
    { text: '"You\'ve got to trust what you\'ve got that day."',                               attrib: '— John Daly' },
    { text: '"I\'m not trying to be textbook—I\'m trying to score."',                         attrib: '— John Daly' },
    { text: '"Golf is a game you can never really conquer."',                                           attrib: '— Ben Hogan' },
    { text: '"The secret is in the dirt."',                                                            attrib: '— Ben Hogan' },
    { text: '"Golf is not a game of great shots. It\'s a game of the most accurate misses."',          attrib: '— Ben Hogan' },
    { text: '"The most important shot in golf is the next one."',                                      attrib: '— Ben Hogan' },
    { text: '"Every day you don\'t practice, it takes two days to get back."',                         attrib: '— Ben Hogan' },
    { text: '"Reverse every natural instinct and do the opposite — you\'ll come close to a perfect swing."', attrib: '— Ben Hogan' },
    { text: '"Confidence is the most important single factor in this game."',                          attrib: '— Jack Nicklaus' },
    { text: '"Focus on remedies, not faults."',                                                        attrib: '— Jack Nicklaus' },
    { text: '"I never hit a shot, not even in practice, without having a sharp picture of it in my head first."', attrib: '— Jack Nicklaus' },
    { text: '"Don\'t be too proud to take lessons. I\'m not."',                                        attrib: '— Jack Nicklaus' },
    { text: '"Achievement is the product of steadily raising your own expectations."',                 attrib: '— Jack Nicklaus' },
    { text: '"Resolve never to quit, no matter what the situation."',                                  attrib: '— Jack Nicklaus' },
    { text: '"Success in golf depends almost entirely on how well you manage the course and yourself."', attrib: '— Jack Nicklaus' },
    { text: '"A perfectly straight shot with a big club is a fluke."',                                 attrib: '— Jack Nicklaus' },
    { text: '"The game of golf is 90% mental and 10% mental."',                                        attrib: '— Jack Nicklaus' },
    { text: '"Tempo is everything."',                                                                  attrib: '— Fred Couples' },
    { text: '"You don\'t have to swing hard to hit it far."',                                          attrib: '— Fred Couples' },
    { text: '"When it feels right, it usually is."',                                                   attrib: '— Fred Couples' },
    { text: '"I\'ve never worked very hard at my game — and that\'s worked for me."',                  attrib: '— Fred Couples' },
    { text: '"Golf is supposed to be fun. The moment it stops being fun, something\'s wrong."',        attrib: '— Fred Couples' },
    { text: '"I don\'t think about mechanics when I\'m playing. I just feel it."',                     attrib: '— Fred Couples' },
    { text: '"I\'ve always been a feel player. Numbers don\'t mean much to me on the course."',        attrib: '— Fred Couples' },
    { text: '"Stay loose. Golf punishes tension."',                                                    attrib: '— Fred Couples' },
    { text: '"Patience is key out there."',                                                    attrib: '— Nelly Korda' },
    { text: '"You can\'t get ahead of yourself in golf."',                                     attrib: '— Nelly Korda' },
    { text: '"The more I practice, the luckier I get."',                                       attrib: '— Annika Sörenstam' },
    { text: '"It\'s about controlling what you can control."',                                 attrib: '— Annika Sörenstam' },
    { text: '"Consistency is what separates the best from the rest."',                         attrib: '— Annika Sörenstam' },
    { text: '"I\'ve always believed in dreaming big."',                                        attrib: '— Annika Sörenstam' },
    { text: '"You have to set goals that are almost out of reach."',                           attrib: '— Annika Sörenstam' },
    { text: '"Preparation is everything."',                                                    attrib: '— Annika Sörenstam' },
    { text: '"I never wanted to be satisfied with what I\'d achieved."',                       attrib: '— Annika Sörenstam' },
    { text: '"You have to embrace the pressure — that\'s where you find out who you are."',    attrib: '— Annika Sörenstam' },
    { text: '"Focus on what you can do, not on what you can\'t."',                             attrib: '— Annika Sörenstam' },
    { text: '"I wear my heart on my sleeve — that\'s just who I am."',                         attrib: '— Shane Lowry' },
    { text: '"Golf\'s a funny game — you never know what\'s going to happen."',                attrib: '— Shane Lowry' },
    { text: '"You\'ve got to enjoy the moment. It goes fast."',                                attrib: '— Shane Lowry' },
    { text: '"The game owes you nothing."',                                                    attrib: '— Shane Lowry' },
    { text: '"When things are going well, keep your feet on the ground."',                     attrib: '— Shane Lowry' },
    { text: '"I just try to stay in the present and not get ahead of myself."',                attrib: '— Shane Lowry' },
    { text: '"There\'s nothing better than playing well in front of a big crowd."',            attrib: '— Shane Lowry' },
    { text: '"Keep it simple."',                                                               attrib: '— Ernie Els' },
    { text: '"A good swing is about rhythm and balance."',                                     attrib: '— Ernie Els' },
    { text: '"You\'ve got to stay patient and trust your swing."',                             attrib: '— Ernie Els' },
    { text: '"Golf is not a game of perfect."',                                                attrib: '— Nick Faldo' },
    { text: '"You build a swing by understanding cause and effect."',                          attrib: '— Nick Faldo' },
    { text: '"Pressure is what you feel when you don\'t know what you\'re doing."',            attrib: '— Nick Faldo' },
    { text: '"Practice doesn\'t make perfect—practice makes permanent."',                     attrib: '— Nick Faldo' },
    { text: '"You\'ve got to build your swing on solid fundamentals."',                        attrib: '— Nick Faldo' },
    { text: '"The secret of golf is turning three shots into two."',                           attrib: '— Nick Faldo' },
    { text: '"You don\'t get worse by practicing correctly."',                                 attrib: '— Nick Faldo' },
    { text: '"Every great player I\'ve seen has had a plan."',                                 attrib: '— Nick Faldo' },
    { text: '"Repetition builds confidence."',                                                 attrib: '— Nick Faldo' },
    { text: '"Your swing is only as good as your setup."',                                     attrib: '— Nick Faldo' },
    { text: '"Alignment is everything."',                                                      attrib: '— Nick Faldo' },
    { text: '"You have to understand your miss."',                                             attrib: '— Nick Faldo' },
    { text: '"Good golf is about eliminating mistakes."',                                      attrib: '— Nick Faldo' },
    { text: '"Discipline is choosing between what you want now and what you want most."',      attrib: '— Nick Faldo' },
    { text: '"You win majors by avoiding big numbers."',                                       attrib: '— Nick Faldo' },
    { text: '"A controlled swing beats a powerful one under pressure."',                       attrib: '— Nick Faldo' },
    { text: '"You can\'t fake preparation."',                                                  attrib: '— Nick Faldo' },
    { text: '"The more variables you remove, the more consistent you become."',                attrib: '— Nick Faldo' },
    { text: '"You have to play your own game—there\'s no point copying someone else."',        attrib: '— Jesper Parnevik' },
    { text: '"Golf isn\'t about perfect swings, it\'s about getting the ball in the hole."',  attrib: '— Jesper Parnevik' },
    { text: '"If you\'re afraid to miss, you\'ll miss anyway."',                               attrib: '— Jesper Parnevik' },
    { text: '"You\'ve got to be a little creative out there."',                                attrib: '— Jesper Parnevik' },
    { text: '"I\'ve never been the textbook golfer—and that\'s fine."',                        attrib: '— Jesper Parnevik' },
    { text: '"The best players are the ones who accept bad shots quickly."',                   attrib: '— Jesper Parnevik' },
    { text: '"There\'s more than one way to swing a golf club."',                              attrib: '— Jesper Parnevik' },
    { text: '"You can\'t control everything, so stop trying."',                                attrib: '— Jesper Parnevik' },
    { text: '"Confidence comes from trusting your own style."',                                attrib: '— Jesper Parnevik' },
    { text: '"Sometimes the weird shot is the right shot."',                                   attrib: '— Jesper Parnevik' },
    { text: '"You have to be comfortable doing things your own way."',                         attrib: '— Jesper Parnevik' },
    { text: '"Golf rewards commitment, not perfection."',                                      attrib: '— Jesper Parnevik' },
    { text: '"Talent is only a small part of it — hard work beats talent."',                   attrib: '— Rory McIlroy' },
    { text: '"You have to be comfortable being uncomfortable."',                               attrib: '— Rory McIlroy' },
    { text: '"The biggest thing is to believe in yourself."',                                  attrib: '— Rory McIlroy' },
    { text: '"I\'ve always believed that if you do the right work, the results will come."',   attrib: '— Rory McIlroy' },
    { text: '"You\'re never as good as you think you are, and you\'re never as bad as you think you are."', attrib: '— Rory McIlroy' },
    { text: '"It\'s a marathon, not a sprint."',                                               attrib: '— Rory McIlroy' },
    { text: '"I\'m always trying to learn and evolve."',                                       attrib: '— Rory McIlroy' },
    { text: '"You have to keep pushing yourself out of your comfort zone."',                   attrib: '— Rory McIlroy' },
    { text: '"There\'s always something to improve."',                                         attrib: '— Rory McIlroy' },
    { text: '"You\'ve got to stay patient when things aren\'t going your way."',               attrib: '— Rory McIlroy' },
    { text: '"Confidence comes from preparation."',                                            attrib: '— Rory McIlroy' },
    { text: '"I try to focus on what I can control."',                                         attrib: '— Rory McIlroy' },
    { text: '"You can\'t chase results—you have to earn them."',                               attrib: '— Rory McIlroy' },
    { text: '"Every round teaches you something."',                                            attrib: '— Rory McIlroy' },
    { text: '"It\'s about building a complete game."',                                         attrib: '— Rory McIlroy' },
    { text: '"You have to back yourself when it matters."',                                    attrib: '— Rory McIlroy' },
    { text: '"There\'s no shortcut to getting better."',                                       attrib: '— Rory McIlroy' },
    { text: '"Consistency is what separates good from great."',                                attrib: '— Rory McIlroy' },
    { text: '"The only thing you can control is your effort."',                                attrib: '— Tiger Woods' },
    { text: '"You can always become better."',                                                 attrib: '— Tiger Woods' },
    { text: '"You learn more from failure than from success."',                                attrib: '— Tiger Woods' },
    { text: '"You have to earn it every day."',                                                attrib: '— Tiger Woods' },
    { text: '"I practice until I don\'t have to think about it."',                            attrib: '— Tiger Woods' },
  ];

  function cycleQuote() {
    const lastIdx = parseInt(localStorage.getItem(KEY_HERO_QUOTE_IDX) ?? '-1', 10);
    let nextIdx;
    do { nextIdx = Math.floor(Math.random() * HERO_QUOTES.length); }
    while (nextIdx === lastIdx && HERO_QUOTES.length > 1);
    localStorage.setItem(KEY_HERO_QUOTE_IDX, nextIdx);
    const q = HERO_QUOTES[nextIdx];
    const textEl  = document.getElementById('heroQuoteText');
    const attribEl = document.getElementById('heroQuoteAttrib');
    if (textEl)   textEl.textContent  = q.text;
    if (attribEl) attribEl.textContent = q.attrib;
  }

  // Cycle hero image — runs on every HOME visit (not just page load)
  // localStorage used intentionally: sessionStorage is wiped when iOS backgrounds the app
  function cycleHeroImage() {
    const lastIdx = parseInt(localStorage.getItem(KEY_HERO_IMG_IDX) ?? '-1', 10);
    const nextIdx = (lastIdx + 1) % HERO_IMAGES.length;
    localStorage.setItem(KEY_HERO_IMG_IDX, nextIdx);
    const hero = document.getElementById('homeHero');
    if (hero) {
      let img = hero.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.alt = '';
        hero.insertBefore(img, hero.firstChild);
      }
      img.src = HERO_IMAGES[nextIdx];
    }
    const playHeroImg = document.getElementById('playHeroImg');
    if (playHeroImg) playHeroImg.src = HERO_IMAGES[nextIdx];
    const mgHeroImg = document.getElementById('mgHeroImg');
    if (mgHeroImg) mgHeroImg.src = HERO_IMAGES[nextIdx];
  }

  // ── Active round banner ────────────────────────────────────────────────────
  function _resumeHoleIdx(courseId) {
    const scores = loadScores(courseId);
    const c = loadCourses()[courseId];
    const total = c?.holes?.length ?? 18;
    let last = -1;
    scores.forEach((s, i) => { if (s != null) last = i; });
    return last < 0 ? 0 : Math.min(last + 1, total - 1);
  }

  function _renderActiveRoundBanner() {
    const homeBanner = document.getElementById('activeRoundBanner');
    const playBanner = document.getElementById('activeRoundBannerPlay');
    const ipr = loadInProgressRound();

    if (!ipr) {
      if (homeBanner) homeBanner.innerHTML = '';
      if (playBanner) playBanner.innerHTML = '';
      return;
    }

    const { courseId, gameFormat, hcpEnabled } = ipr;
    const c = loadCourses()[courseId];
    if (!c) {
      clearInProgressRound();
      if (homeBanner) homeBanner.innerHTML = '';
      if (playBanner) playBanner.innerHTML = '';
      return;
    }

    const scores = loadScores(courseId);
    const holesPlayed = scores.filter(s => s != null).length;
    const nextIdx = _resumeHoleIdx(courseId);

    // Compute running score from saved hole data
    let runDiff = 0, runPts = 0;
    scores.forEach((s, i) => {
      if (!s) return;
      const total = (s.scoringMode === 'simple')
        ? (s.fairway || 0)
        : (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
      if (!total) return;
      const par = c.holes[i]?.par || 4;
      const d = total - par;
      runDiff += d;
      if (d <= -2) runPts += 4; else if (d === -1) runPts += 3;
      else if (d === 0) runPts += 2; else if (d === 1) runPts += 1;
    });
    const scoreStr = holesPlayed === 0 ? '' : gameFormat === 'stableford'
      ? ` · ${runPts} pts`
      : ` · ${runDiff === 0 ? 'E' : runDiff > 0 ? '+' + runDiff : runDiff}`;
    const sub = holesPlayed === 0
      ? 'No holes scored yet'
      : `${holesPlayed} hole${holesPlayed !== 1 ? 's' : ''} played${scoreStr}`;

    function _wire(container) {
      container.innerHTML =
        `<div class="active-round-banner">` +
          `<div class="arb-header">Active round</div>` +
          `<div class="arb-body">` +
            `<div class="arb-text">` +
              `<div class="arb-title">${c.name || 'Course'}</div>` +
              `<div class="arb-sub">${sub}</div>` +
            `</div>` +
            `<div class="arb-resume-btn">Resume →</div>` +
          `</div>` +
        `</div>`;
      container.querySelector('.arb-resume-btn').addEventListener('click', () => {
        resumeRoundInPlay(courseId, nextIdx, gameFormat, hcpEnabled);
      });
    }

    if (homeBanner) _wire(homeBanner);

    if (playBanner) {
      if (!getActiveCourseId()) _wire(playBanner);
      else playBanner.innerHTML = '';
    }
  }

  // Patch switchTab so HOME always refreshes hero/quote/perf
  const _origSwitchTabHome = switchTab;
  switchTab = function(name) {
    _origSwitchTabHome(name);
    if (name === 'home') {
      cycleHeroImage();
      cycleQuote();
      refreshHomeStats();
      _renderActiveRoundBanner();
    } else if (name === 'play') {
      _renderActiveRoundBanner();
    }
  };

  initRoundsServices({
    switchTab,
    openRoundDetail: (courseId, roundIdx, netMode = false) => {
      const round = loadRounds(courseId)[roundIdx];
      renderSavedRoundDetail(courseId, round, roundIdx, {
        onDelete: () => { renderSavedRounds(); showMgSub('mgSubRoundsHistory'); },
        netMode,
      });
      showMgSub('mgSubRoundDetail');
    },
  });

  // Compute personal calibration from all historical rounds at startup.
  // Cached in localStorage; refreshed whenever a new round is saved.
  _personalCal = loadPersonalCal() ?? computeAndCachePersonalCal();

  // Switch to Play pane as soon as a course bar is injected into #calcView
  (function watchForCourseLoad() {
    const calcView = document.getElementById('calcView');
    if (!calcView) return;
    const observer = new MutationObserver(() => {
      if (document.getElementById('playCourseBar')) {
        switchTab('play');
        observer.disconnect();
        // Re-observe for future course loads (e.g. round complete → new round)
        setTimeout(watchForCourseLoad, 100);
      }
    });
    observer.observe(calcView, { childList: true });
  })();

  // Home screen button wiring
  document.getElementById('homeLaunchCourseBtn')?.addEventListener('click', () => {
    openCoursePicker((id, fmt, hcpOn) => loadCourseIntoPlay(id, fmt, hcpOn));
  });

  document.getElementById('homeOpenCalcBtn')?.addEventListener('click', () => {
    document.getElementById('playLanding')?.classList.add('hidden');
    document.getElementById('playHero')?.classList.add('hidden');
    document.getElementById('calcView')?.classList.add('open');
    document.getElementById('calcCloseBtn')?.classList.remove('hidden');

    // New user (no bag set) — pre-fill a demo scenario to show the wind calculation live
    const driverEl = document.getElementById('driverCarry');
    if (driverEl && !driverEl.value && !getActiveCourseId()) {
      driverEl.value = '230';
      document.getElementById('i7Carry').value = '165';
      document.getElementById('pwCarry').value = '110';
      document.getElementById('holeLength').value = '380';
      updateCarryLabels();
      windState.holeDeg = 0;
      setCompassAngle(0);
      applyWindData(10, null, 0, 'Demo · 10 m/s headwind');
      calculate();
      // Show inline banner and dismiss it if the user modifies any carry input
      const demoBanner = document.getElementById('calcDemoBanner');
      if (demoBanner) {
        demoBanner.classList.remove('hidden');
        const _dismissDemo = () => {
          demoBanner.classList.add('hidden');
          ['driverCarry','i7Carry','pwCarry'].forEach(id =>
            document.getElementById(id)?.removeEventListener('input', _dismissDemo)
          );
        };
        ['driverCarry','i7Carry','pwCarry'].forEach(id =>
          document.getElementById(id)?.addEventListener('input', _dismissDemo)
        );
      }
    }
  });

  document.getElementById('calcCloseBtn')?.addEventListener('click', () => {
    document.getElementById('calcView')?.classList.remove('open');
    document.getElementById('calcCloseBtn')?.classList.add('hidden');
    document.getElementById('playLanding')?.classList.remove('hidden');
    document.getElementById('playHero')?.classList.remove('hidden');
  });

  document.getElementById('homeViewAllBtn')?.addEventListener('click', () => {
    switchTab('prepare');
    showMgSub('mgSubStats');
  });

  // Initialise on page load
  if (getActiveCourseId()) {
    cycleHeroImage();
    switchTab('play');
  } else {
    switchTab('home');
  }
})();

// ── Pull-to-refresh (reload) ──────────────────────────────────────────────────
(function wirePullToRefresh() {
  const pill    = document.getElementById('ptrPill');
  const pane    = document.getElementById('panePlay');
  if (!pill || !pane) return;

  let startY    = null;
  let triggered = false;

  pane.addEventListener('touchstart', e => {
    if (pane.scrollTop === 0) startY = e.touches[0].clientY;
  }, { passive: true });

  pane.addEventListener('touchmove', e => {
    if (startY === null || triggered) return;
    if (pane.scrollTop > 0) { startY = null; return; }
    if (e.touches[0].clientY - startY > 70) {
      triggered = true;
      pill.classList.add('visible');
      setTimeout(() => location.reload(), 400);
    }
  }, { passive: true });

  pane.addEventListener('touchend', () => { startY = null; }, { passive: true });
})();


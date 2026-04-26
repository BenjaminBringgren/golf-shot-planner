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
  loadCourses, loadScores, loadProfile,
  saveProfile, getScoringMode,
  loadCollapseState, saveCollapseState,
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
  WIND_ADJ, ALT_FACTORS, EXPECTED_STROKES,
  windCategory, windAdjustedRoll, applyWind, tempCarryFactor,
  interpolate, expectedStrokesRemaining,
  getValidTeeClubs, findBestContinuation, calcPar3,
  decodeStrategy, strategyDisplayName,
} from '../engine/calculations.js';
import { renderPlan, updateWindSectionStatus as _uwss, updateWindBreakdown as _uwbd,
         syncChipRow, wireChipRow, crosswindSide } from '../ui/carousel.js';
import { openClubPicker, closeClubPicker,
         openCoursePicker, closeCoursePicker, wireCoursePickerEvents } from '../ui/sheets.js';
import { renderPlayCourseBar, renderScoreEntry, showRoundCompleteOverlay, hideScorefab,
         getInRough, resetInRough } from '../ui/scorecard.js';
import {
  computeHoleBaseline, blendedScore,
  applyHoleToPlay, loadCourseIntoPlay,
  deleteCourse, renderCourseList, openEditor,
  initServices,
} from './courses.js';
import {
  showMgSub, showMgHub, refreshMgHub,
  renderMgStatTiles, renderMgCarryBars, renderSavedRounds,
} from './rounds.js';
import {
  initHoleFlowServices,
  commitShot, holeOut, penaltyShot, setPutts, finishHole,
  back as _flowBack, edit as _flowEdit, nextHole, undoLastShot,
  getState as getHoleFlowState, subscribe as subscribeHoleFlow,
} from './holeFlow.js';

// ── Persistence ────────────────────────────────────────────────────────────
function saveBag() {
  const checked = clubs.map(c => document.getElementById('cb_' + c.key)?.checked ?? c.checked);
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

function updateCarryLabels() {
  const { driver, i7, pw } = getCarryInputs();
  const cond = document.getElementById('conditions').value;
  clubs.forEach(c => {
    const span = document.getElementById('carry_' + c.key);
    if (!span) return;
    if (!driver) { span.textContent = ''; return; }
    const carry = interpolate(driver, i7, pw, c.key);
    const baseRoll = getRollFactor(c.key, cond);
    const roll  = windAdjustedRoll(baseRoll, clubOrder.indexOf(c.key), windState);
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
    cb.checked = saved ? (saved.checked[i] ?? !!c.checked) : !!c.checked;
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
      const carry    = applyWind(baseCarry, idx, windState);   // wind-adjusted carry
      const baseRoll = getRollFactor(key, cond);
      const roll     = windAdjustedRoll(baseRoll, idx, windState);
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
let _holeHcpAdj = null; // null = use flat model inside expectedStrokesRemaining
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
    renderScoreEntry,
    updateHoleCardMode,
    gpsTeeSetState,
    gpsBallSetState,
    calculate:                () => calculate(),
    renderSavedRounds,
    updateLoadCourseBtn,
    updateCalcButtonVisibility,
    // Shot-sheet / hole-flow callbacks
    commitShot:        (lie)    => commitShot(lie),
    holeOut:           ()       => holeOut(),
    penaltyShot:       ()       => penaltyShot(),
    setPutts:          (n)      => setPutts(n),
    finishHole:        ()       => finishHole(),
    backToPutts:       ()       => _flowBack(),
    editHole:          ()       => _flowEdit(),
    nextHole:          (scores) => nextHole(scores),
    undoLastShot:      ()       => undoLastShot(),
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
    return expectedStrokesRemaining(remaining, driverCarry, handicap, inRoughFlag, windState, undefined, _holeHcpAdj);
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
  // FAB only visible on Play tab when course is active
  const fab = document.getElementById('scoreFab');
  if (fab) {
    const courseActive = !!getActiveCourseId();
    fab.classList.toggle('visible', name === 'play' && courseActive);
  }
  // Close drawer when switching tabs
  const drawer = document.getElementById('scoreDrawer');
  if (drawer) drawer.classList.remove('open');
  const overlay = document.getElementById('scoreDrawerOverlay');
  if (overlay) overlay.classList.remove('visible');
  // Close scorecard page when switching tabs
  document.getElementById('scorecardPage')?.classList.remove('open');
  document.getElementById('scorecardOverlay')?.classList.remove('visible');
  document.body.style.overflow = '';
}

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
  document.getElementById('mgBackScoreBreakdown')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackPuttsBreakdown')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackAvgStrokes')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackBaseline')?.addEventListener('click', () => showMgSub('mgSubAvgStrokes'));
  document.getElementById('mgBackRoundsHistory')?.addEventListener('click', () => showMgSub('mgSubStats'));
  document.getElementById('mgBackCourses')?.addEventListener('click', showMgHub);
  // Edit bag toggle
  document.getElementById('mgEditBagBtn')?.addEventListener('click', () => {
    const form = document.getElementById('mgBagEditForm');
    const btn  = document.getElementById('mgEditBagBtn');
    if (form.style.display === 'none') {
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

wireCoursePickerEvents(loadCourseIntoPlay);

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
  // Show load-course button only when no course is active
  function updateLoadCourseBtn() {
    const btn = document.getElementById('loadCourseBtn');
    if (!btn) return;
    const courseActive = !!getActiveCourseId();
    btn.classList.toggle('visible', !courseActive);
  }

  const saved = loadBag();
  buildClubUI(saved);

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
  // The SVG arrow points UP (0° = North). To show hole direction D,
  // we rotate the entire SVG disc by -D so the arrow points toward D.
  // E.g. hole going East (90°): rotate disc -90° so arrow points right.
  function setCompassAngle(deg) {
    const d = ((deg % 360) + 360) % 360;
    compassSvgWrap.querySelector('svg').style.transform = `rotate(${d}deg)`;
    compassDegDisplay.textContent = `${Math.round(d)}°`;
    const dirs = ['N','NE','E','SE','S','SW','W','NW'];
    compassDegLabel.textContent = dirs[Math.round(d / 45) % 8];
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
    if (!windState.active) { windEffectNote.classList.remove('visible'); return; }
    const hw  = windState.headwind;
    const cw  = windState.crosswind;
    // Altitude-corrected headwind at mid-iron trajectory (~22m) for display
    const hwAlt = hw * ALT_FACTORS['mid_iron'];
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
    let text = `💨 ${windState.speedMs.toFixed(1)} m/s from ${fromLabel}`;
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
    el.textContent = text;
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
    setTimeout(() => {
      if (lockPhase === 'live') {
        stopLiveOrientation();
        lockPhase = 'idle';
        const deg = Math.round(windState.holeDeg);
        const _cll5 = document.getElementById('compassLockLabel'); if (_cll5) _cll5.textContent = `Auto-locked: ${deg}°`;
        windLockStrip.classList.remove('locking');
        setLockIcon('locked', deg);
        computeWindComponents(); updateWindEffectNote(); updateWindStripText(); saveWindPrefs();
        updateWindSectionStatus();
      }
    }, 30000);
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

  // ── Fetch wind + show location ────────────────────────────────────────
  document.getElementById('windRefresh').addEventListener('click', async (e) => {
    e.stopPropagation(); // don't toggle collapsible
    hideOfflineFallback();

    // Fast offline check before attempting any network calls
    if (!navigator.onLine) {
      showOfflineFallback('📶 No internet connection — wind data unavailable offline.');
      return;
    }

    windText.textContent = '📍 Detecting location…';
    if (!navigator.geolocation) {
      windText.textContent = '⚠ GPS not available in this browser';
      return;
    }

    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      try {
        windText.textContent = '⏳ Fetching wind…';

        const [locationName, w] = await Promise.all([
          fetchLocationName(lat, lon),
          fetchWind(lat, lon),
        ]);
        applyWindData(w.speedMs, w.gustMs, w.dirDeg, locationName, w.tempC, w.feelsLike, w.rainPct);

      } catch(e) {
        // Distinguish offline (network error) from server errors
        if (!navigator.onLine || e instanceof TypeError) {
          showOfflineFallback('📶 Lost connection during fetch — set wind manually or retry when online.');
        } else {
          windText.textContent = '⚠ Wind service unavailable — try again';
          // Still offer manual entry as a fallback
          windOfflineMsg.textContent = 'Wind service returned an error. You can set wind manually:';
          windOfflineMsg.classList.add('visible');
          windManualEntry.classList.add('visible');
        }
      }
    }, (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        windText.textContent = '⚠ Location access denied — enable GPS and retry';
      } else {
        // GPS timeout or unavailable — still allow manual wind
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
        scoreVal3 = shotsTaken + expectedStrokesRemaining(rem, driverCarry, handicap, inRough, windState, undefined, _holeHcpAdj);
      } else {
        const remaining = Math.max(0, hole - s.total);
        scoreVal3 = 1 + expectedStrokesRemaining(remaining, driverCarry, handicap, inRough, windState, undefined, _holeHcpAdj);
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
    if (validTeeClubs.length === 0) return { isError: true, msg: 'No valid clubs for this par. Check bag setup.' };

    const STRATEGY_TYPES = ['Max distance', 'Controlled', 'Conservative'];
    const ordered = [];
    validTeeClubs.slice(0, 3).forEach((teeClub, rank) => {
      const p = findBestContinuation(teeClub, hole, driverTotal, clubsList, driverCarry, handicap, inRough, windState, _holeHcpAdj);
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

    return {
      isError: false, isPar3: false,
      parValue, hole, driver, conditions, isFirm,
      clubsList, driverClub, driverCarry, driverTotal,
      teeMarked, completedShots, inRough, handicap,
      ordered, activePlanType,
      _blCourseId, _blHoleIdx,
    };
  }


  function calculate(clearOverrides = false) {
    const inputs = readInputsFromDOM();
    inputs.clearOverrides = clearOverrides;
    const plan = computePlan(inputs);
    renderPlan(plan, {
      windState, _holeHcpAdj, _overrideCourseId, _overrideHoleIdx,
      par3ClubOverrides, teeOverrides, shot2Overrides, approachOverrides, gpsShot2Overrides,
      par3Override, _hk,
      blendedScore:        (s, c, h) => blendedScore(s, c, h),
      computeHoleBaseline: (...a) => computeHoleBaseline(...a),
      calculate,
      openClubPicker:      (key, onSelect, constraints) => openClubPicker(key, onSelect, constraints, plan.clubsList),
      updateCalcButtonVisibility,
    });
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
    if (!session.id) return;
    try {
      const { id, holeIdx } = session;
      const courses = loadCourses();
      if (!courses[id]) return;
      const scores = loadScores(id);
      renderScoreEntry(id, holeIdx, scores, buildCallbacks());
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

    // Action row: show when course active + result ready
    const actionRow = document.getElementById('playActionRow');
    if (actionRow) actionRow.style.display = (courseActive && hasResult) ? 'flex' : 'none';
  }
  // ── Wire action row buttons ─────────────────────────────────────────────
  (function wireActionRow() {
    const nextBtn = document.getElementById('playNextBtn');
    if (!nextBtn) return;

    nextBtn.addEventListener('click', () => {
      // Advance to next hole via course bar
      const session = loadActiveCourse();
      if (!session.id) return;
      const { id, holeIdx } = session;
      const courses = loadCourses();
      const c = courses[id];
      if (!c) return;
      if (holeIdx === 17) {
        // Last hole — show round complete overlay instead of wrapping
        showRoundCompleteOverlay(id, holeIdx, buildCallbacks());
        return;
      }
      const nextIdx = holeIdx + 1;
      saveActiveCourse(id, nextIdx);
      // Reset rough flag for new hole
      resetInRough();
      // Trigger bar refresh
      const bar = document.getElementById('playCourseBar');
      if (bar?._navigateTo) bar._navigateTo(nextIdx);
    });
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


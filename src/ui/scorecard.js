/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 5 — ui — score entry drawer, hole grid, round complete overlay.
// Rendering and event binding only. No business logic.

import {
  loadCourses, loadScores, saveScores, loadRounds, saveRound, clearScores,
  loadActiveCourse, saveActiveCourse, clearActiveCourse,
  getScoringMode,
  getCommittedStrategies, removeCommittedStrategies,
  clearTeeState,
} from '../storage/storage.js';
import { teeMarked, completedShots, clearGpsState } from '../platform/gps.js';
import { decodeStrategy } from '../engine/calculations.js';
import { initHole } from '../app/holeFlow.js';
import { mountShotSheet } from './shotSheet/index.js';

// ── Rough-lie state (read by router.js via getInRough) ────────────────────────
let _inRough = false;
export function getInRough()  { return _inRough; }
export function resetInRough() { _inRough = false; }

// ── Score CSS class helper ────────────────────────────────────────────────────
function scoreCssClass(strokes, par) {
  if (strokes == null) return '';
  const diff = strokes - par;
  if (strokes === 1 && par >= 2) return 'score-hole-in-one';
  if (diff <= -2) return 'score-eagle';
  if (diff === -1) return 'score-birdie';
  if (diff === 0)  return 'score-par';
  if (diff === 1)  return 'score-bogey';
  return 'score-double';
}

// ── Play tab course bar — hole grid + score tracking ──────────────────────
export function renderPlayCourseBar(courseId, callbacks = {}) {
  const existing = document.getElementById('playCourseBar');
  if (existing) existing.remove();

  const courses = loadCourses();
  const c = courses[courseId];
  if (!c) return;

  const session = loadActiveCourse();
  let holeIdx = session.holeIdx ?? 0;
  let scores  = loadScores(courseId);
  let summaryVisible = false;

  const bar = document.createElement('div');
  bar.id = 'playCourseBar';
  bar.className = 'course-bar';

  // ── Header row ────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'course-bar-header';
  bar.appendChild(header);

  // Grid is built dynamically inside updateBar()

  // ── Last round hint ───────────────────────────────────────
  const lastRoundHint = document.createElement('div');
  lastRoundHint.id = 'lastRoundHint';
  bar.appendChild(lastRoundHint);

  // ── Round summary (collapsible) ───────────────────────────
  const summary = document.createElement('div');
  summary.className = 'round-summary';
  bar.appendChild(summary);

  bar._navigateTo = (idx) => navigateTo(idx);

  function navigateTo(idx) {
    holeIdx = idx;
    callbacks.applyHoleToPlay?.(c, holeIdx);
    updateSession();
    updateBar();
    callbacks.updateHoleCardMode?.();

    // Reset GPS state for new hole
    clearGpsState(); clearTeeState();
    callbacks.clearGpsOverrides?.();
    const _teeBtn  = document.getElementById('gpsTeeBtn');
    const _ballBtn = document.getElementById('gpsBallBtn');
    callbacks.gpsTeeSetState?.('idle');
    callbacks.gpsBallSetState?.('locked', null, 0);
    const _gpsReset  = document.getElementById('gpsReset');
    const _gpsStatus = document.getElementById('gpsStatus');
    const _gpsResult = document.getElementById('gpsResult');
    const _gpsWarning = document.getElementById('gpsWarning');
    if (_gpsReset)   _gpsReset.style.display = 'none';
    if (_gpsStatus)  _gpsStatus.textContent = 'Stand at tee and tap Mark Tee';
    if (_gpsResult)  _gpsResult.classList.remove('visible');
    if (_gpsWarning) _gpsWarning.style.display = 'none';

    scores = loadScores(courseId);
    callbacks.renderScoreEntry?.(courseId, holeIdx, scores, callbacks);

    setTimeout(() => {
      const holeLen = Number(document.getElementById('holeLength').value);
      const driver  = Number(document.getElementById('driverCarry').value);
      if (holeLen >= 50 && driver >= 50) {
        callbacks.calculate?.();
      } else {
        callbacks.applyHoleToPlay?.(c, holeIdx);
        setTimeout(() => callbacks.calculate?.(), 50);
      }
    }, 50);
  }

  function updateBar() {
    const hole = c.holes[holeIdx];

    // ── Header ────────────────────────────────────────────
    header.innerHTML = '';

    // ── Left: course name (muted), big hole number, note, meta ──
    const nameWrap = document.createElement('div');
    nameWrap.className = 'course-bar-name-wrap';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'course-bar-name';
    nameSpan.textContent = c.name;
    nameWrap.appendChild(nameSpan);

    const holeNumEl = document.createElement('div');
    holeNumEl.className = 'course-bar-hole-num';
    holeNumEl.textContent = holeIdx + 1;
    nameWrap.appendChild(holeNumEl);

    if (hole.note) {
      const holeNote = document.createElement('div');
      holeNote.className = 'course-bar-note';
      holeNote.textContent = hole.note;
      nameWrap.appendChild(holeNote);
    }

    header.appendChild(nameWrap);

    // ── Right: action buttons + score stat ────────────────────
    const rightCol = document.createElement('div');
    rightCol.className = 'course-bar-right';

    // Action buttons row
    const actionsRow = document.createElement('div');
    actionsRow.className = 'course-bar-actions';

    const summaryBtn = document.createElement('button');
    summaryBtn.className = 'course-bar-btn'; summaryBtn.type = 'button';
    summaryBtn.textContent = '⊞';
    summaryBtn.title = 'Round summary';
    summaryBtn.addEventListener('click', () => {
      summaryVisible = !summaryVisible;
      summary.classList.toggle('visible', summaryVisible);
      if (summaryVisible) {
        scores = loadScores(courseId);
        renderSummary();
      }
    });
    actionsRow.appendChild(summaryBtn);

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'course-bar-btn dismiss'; dismissBtn.type = 'button';
    dismissBtn.textContent = '✕';
    actionsRow.appendChild(dismissBtn);
    rightCol.appendChild(actionsRow);

    // Stats row: Par · Length · Score
    const statsRow = document.createElement('div');
    statsRow.className = 'course-bar-stats';

    function statItem(label, valText, valClass) {
      const item = document.createElement('div');
      item.className = 'cbs-item';
      item.innerHTML = `<div class="cbs-label">${label}</div><div class="cbs-val${valClass ? ' ' + valClass : ''}">${valText}</div>`;
      return item;
    }
    function divider() {
      const d = document.createElement('div'); d.className = 'cbs-divider'; return d;
    }

    const holePar    = hole.par || 4;
    const holeLen    = hole.length || 0;
    let totalStrokes = 0, totalPar = 0, holesPlayed = 0;
    scores.forEach((s, i) => {
      if (!s) return;
      totalStrokes += (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
      totalPar     += c.holes[i]?.par || 4;
      holesPlayed++;
    });
    const scoreDiff = holesPlayed ? totalStrokes - totalPar : null;
    const scoreTxt  = scoreDiff === null ? 'E' : scoreDiff === 0 ? 'E' : (scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`);
    const scoreCls  = scoreDiff === null || scoreDiff === 0 ? 'score-even' : scoreDiff > 0 ? 'score-over' : 'score-under';

    // Hole meta (par · length) under the hole number in nameWrap
    const metaEl = document.createElement('div');
    metaEl.className = 'course-bar-meta';
    metaEl.textContent = `Par ${holePar}` + (holeLen ? ` · ${holeLen}m` : '');
    nameWrap.appendChild(metaEl);

    statsRow.appendChild(statItem('Score', scoreTxt, scoreCls));
    rightCol.appendChild(statsRow);
    header.appendChild(rightCol);

    dismissBtn.addEventListener('click', () => {
      const overlay = document.getElementById('cancelRoundOverlay');
      overlay.style.display = 'flex';

      document.getElementById('cancelRoundConfirm').onclick = () => {
        overlay.style.display = 'none';
        clearActiveCourse();
        // Clear in-progress scores for this course
        try {
          clearScores(courseId);
          removeCommittedStrategies(courseId);
          callbacks.clearRoundOverrides?.();
        } catch(e) {}
        // Reset GPS state + button UI
        clearGpsState();
        const _teeBtn  = document.getElementById('gpsTeeBtn');
        const _ballBtn = document.getElementById('gpsBallBtn');
        const _resetBtn = document.getElementById('gpsReset');
        const _gpsWarn  = document.getElementById('gpsWarning');
        callbacks.gpsTeeSetState?.('idle');
        callbacks.gpsBallSetState?.('locked', null, 0);
        clearTeeState();
        if (_resetBtn) _resetBtn.style.display = 'none';
        if (_gpsWarn)  _gpsWarn.style.display  = 'none';
        bar.remove();
        const se = document.getElementById('scoreEntry');
        if (se) se.remove();
        // Clear strategy output so previous hole doesn't persist
        const _out = document.getElementById('output');
        if (_out) _out.innerHTML = '';
        const _recalc = document.getElementById('recalcLink');
        if (_recalc) _recalc.classList.remove('visible');
        const _actionRow = document.getElementById('playActionRow');
        if (_actionRow) _actionRow.style.display = 'none';
        hideScorefab();
        callbacks.updateLoadCourseBtn?.();
        callbacks.updateHoleCardMode?.();
        callbacks.updateCalcButtonVisibility?.();
      };

      document.getElementById('cancelRoundAbort').onclick = () => {
        overlay.style.display = 'none';
      };


      overlay.onclick = (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      };
    });

    // ── Hole grid — 2×9 front/back with par sub-labels ──────
    // Remove existing gridWrap if present, re-insert fresh
    const existingWrap = bar.querySelector('.hole-grid-wrap');
    if (existingWrap) existingWrap.remove();

    const gridWrap = document.createElement('div');
    gridWrap.className = 'hole-grid-wrap';

    for (const half of [{start:0,end:9,label:'Front'},{start:9,end:18,label:'Back'}]) {
      const halfLbl = document.createElement('div');
      halfLbl.className = 'hole-grid-half-label';
      halfLbl.textContent = half.label;
      gridWrap.appendChild(halfLbl);

      const halfGrid = document.createElement('div');
      halfGrid.className = 'hole-grid';

      for (let i = half.start; i < half.end; i++) {
        const cell  = document.createElement('div');
        cell.className = 'hole-cell';
        const sc    = scores[i];
        const total = sc ? (sc.fairway || 0) + (sc.rough || 0) + (sc.putts || 0) : null;
        const par   = c.holes[i]?.par || 4;
        const cls   = scoreCssClass(total, par);
        if (cls) cell.classList.add(cls);
        if (i === holeIdx) cell.classList.add('current');

        const numDiv = document.createElement('div');
        numDiv.textContent = i + 1;
        cell.appendChild(numDiv);

        const parSpan = document.createElement('span');
        parSpan.className = 'hole-cell-par';
        parSpan.textContent = par;
        cell.appendChild(parSpan);

        if (total != null) {
          const scoreDiv = document.createElement('div');
          scoreDiv.style.cssText = 'font-size:11px;margin-top:1px;opacity:0.85;';
          scoreDiv.textContent = total;
          cell.appendChild(scoreDiv);
        }

        const idx = i;
        cell.addEventListener('click', () => navigateTo(idx));
        halfGrid.appendChild(cell);
      }
      gridWrap.appendChild(halfGrid);
    }

    // Insert gridWrap after header
    lastRoundHint.insertAdjacentElement('afterend', gridWrap);

    // ── Last round hint ────────────────────────────────────
    renderLastRoundHint(holeIdx);

    // ── Summary ────────────────────────────────────────────
    if (summaryVisible) renderSummary();
  }

  function pillHtml(total, par) {
    if (total == null) return '—';
    const diff = total - par;
    let cls;
    if (total === 1 && par >= 2) cls = 'hole-in-one';
    else if (diff <= -2) cls = 'eagle';
    else if (diff === -1) cls = 'birdie';
    else if (diff === 0) cls = 'par';
    else if (diff === 1) cls = 'bogey';
    else cls = 'double';
    return `<span class="sc-pill ${cls}">${total}</span>`;
  }

  function diffHtml(diff) {
    const lbl = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
    const color = diff < 0 ? '#1e7a45' : diff > 0 ? '#a32d2d' : '#555';
    return `<span style="font-weight:700;color:${color}">${lbl}</span>`;
  }

  function renderSummary() {
    scores = loadScores(courseId);
    const played = scores.map((s, i) => ({
      hole: i + 1, par: c.holes[i]?.par || 4,
      total: s ? (s.fairway || 0) + (s.rough || 0) + (s.putts || 0) : null,
      fairway: s?.fairway ?? null, rough: s?.rough ?? null, putts: s?.putts ?? null, gir: s?.gir ?? null, fir: s?.fir ?? null,
    }));

    let totalStrokes = 0, totalPar = 0, totalFW = 0, totalPutts = 0, totalGIR = 0, holesPlayed = 0;
    played.forEach(h => {
      if (h.total != null) {
        totalStrokes += h.total; totalPar += h.par;
        totalFW += h.fairway; totalPutts += h.putts;
        if (h.gir === true) totalGIR++;
        holesPlayed++;
      }
    });
    const vsPar = totalStrokes - totalPar;

    // Front 9 subtotals
    let front9Par = 0, front9Strokes = 0, front9FW = 0, front9Putts = 0, front9GIR = 0, front9Played = 0;
    played.slice(0, 9).forEach(h => {
      front9Par += h.par;
      if (h.total != null) { front9Strokes += h.total; front9FW += h.fairway; front9Putts += h.putts; if (h.gir === true) front9GIR++; front9Played++; }
    });

    // Back 9 subtotals
    let back9Par = 0, back9Strokes = 0, back9FW = 0, back9Putts = 0, back9GIR = 0, back9Played = 0;
    played.slice(9, 18).forEach(h => {
      back9Par += h.par;
      if (h.total != null) { back9Strokes += h.total; back9FW += h.fairway; back9Putts += h.putts; if (h.gir === true) back9GIR++; back9Played++; }
    });

    function sectionRows(from, to) {
      return played.slice(from, to).map(h => {
        if (h.total == null) return `
          <tr>
            <td class="sc-hole">${h.hole}</td>
            <td class="sc-par">${h.par}</td>
            <td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>
          </tr>`;
        const diff = h.total - h.par;
        const girVal = h.gir !== null ? h.gir : ((h.fairway + (h.rough || 0)) <= (h.par - 2));
        const girMark = girVal ? '<span style="color:#1e7a45;font-weight:700;">✓</span>' : '<span style="color:#ccc;">✗</span>';
        return `
          <tr>
            <td class="sc-hole">${h.hole}</td>
            <td class="sc-par">${h.par}</td>
            <td>${h.fairway}</td>
            <td>${h.putts}</td>
            <td style="text-align:center">${girMark}</td>
            <td>${pillHtml(h.total, h.par)}</td>
            <td>${diffHtml(diff)}</td>
          </tr>`;
      }).join('');
    }

    summary.innerHTML = `
      <table class="scorecard">
        <thead><tr>
          <th class="sc-th-hole">#</th>
          <th class="sc-th-par">Par</th>
          <th>🏌️</th><th>⛳</th><th>GIR</th><th>Total</th><th>+/−</th>
        </tr></thead>
        <tbody>
          <tr class="sc-section"><td class="sc-hole"></td><td colspan="6">Front 9</td></tr>
          ${sectionRows(0, 9)}
          <tr class="sc-total">
            <td class="sc-hole">Out</td>
            <td class="sc-par">${front9Par}</td>
            <td>${front9Played ? front9FW : '—'}</td>
            <td>${front9Played ? front9Putts : '—'}</td>
            <td>${front9Played ? front9GIR + '/9' : '—'}</td>
            <td>${front9Played ? pillHtml(front9Strokes, front9Par) : '—'}</td>
            <td>${front9Played ? diffHtml(front9Strokes - front9Par) : '—'}</td>
          </tr>
          <tr class="sc-section"><td class="sc-hole"></td><td colspan="6">Back 9</td></tr>
          ${sectionRows(9, 18)}
          <tr class="sc-total">
            <td class="sc-hole">In</td>
            <td class="sc-par">${back9Par}</td>
            <td>${back9Played ? back9FW : '—'}</td>
            <td>${back9Played ? back9Putts : '—'}</td>
            <td>${back9Played ? back9GIR + '/' + back9Played : '—'}</td>
            <td>${back9Played ? pillHtml(back9Strokes, back9Par) : '—'}</td>
            <td>${back9Played ? diffHtml(back9Strokes - back9Par) : '—'}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="sc-total">
            <td class="sc-hole">Total</td>
            <td class="sc-par">${(front9Played || back9Played) ? front9Par + back9Par : '—'}</td>
            <td>${(front9Played + back9Played) ? totalFW : '—'}</td>
            <td>${(front9Played + back9Played) ? totalPutts : '—'}</td>
            <td>${(front9Played + back9Played) ? totalGIR + '/' + holesPlayed + ' <span style="color:#888;font-weight:400;font-size:11px;">(' + Math.round(totalGIR/holesPlayed*100) + '%)</span>' : '—'}</td>
            <td>${(front9Played + back9Played) ? pillHtml(front9Strokes + back9Strokes, front9Par + back9Par) : '—'}</td>
            <td>${(front9Played + back9Played) ? diffHtml((front9Strokes + back9Strokes) - (front9Par + back9Par)) : '—'}</td>
          </tr>
        </tfoot>
      </table>`;

    // Save round button — only show if at least 1 hole is scored
    const existingSaveBtn = summary.querySelector('.save-round-btn');
    if (existingSaveBtn) existingSaveBtn.remove();

    if (holesPlayed > 0) {
      const saveBtn = document.createElement('button');
      saveBtn.className = 'save-round-btn';
      saveBtn.type = 'button';
      saveBtn.style.cssText = 'margin-top:10px; font-size:15px; padding:17px 14px; background:#1a1a1a; color:#fff; border:none; border-radius:7px; width:100%; cursor:pointer; font-weight:600;';
      saveBtn.textContent = '💾 Save Round';
      saveBtn.addEventListener('click', () => {
        // Collect committed strategies per hole from sessionStorage
        const committedStrategies = getCommittedStrategies();

        const roundScores = loadScores(courseId);
        const roundData = {
          date: new Date().toLocaleDateString('sv-SE'), // YYYY-MM-DD
          scores: roundScores,
          strategies: committedStrategies,
          holesPlayed,
          totalStrokes: holesPlayed ? totalStrokes : 0,
          totalPar:     holesPlayed ? totalPar     : 0,
          totalPutts:   holesPlayed ? totalPutts   : 0,
          totalGIR:     holesPlayed ? totalGIR     : 0,
        };
        saveRound(courseId, roundData);

        // Update button immediately
        saveBtn.textContent = '✓ Saved!';
        saveBtn.disabled = true;
        saveBtn.style.background = '#888';

        // Clear session scores after saving so next load starts fresh
        try {
          clearScores(courseId);
          removeCommittedStrategies(courseId);
        } catch(e) {}

        // Refresh Courses tab so round appears there
        callbacks.renderSavedRounds?.();
      });
      summary.appendChild(saveBtn);
    }
  }

  function renderLastRoundHint(idx) {
    lastRoundHint.innerHTML = '';
    const rounds = loadRounds(courseId);
    if (!rounds.length) return;

    const stratStats = {};
    rounds.forEach(round => {
      const holeScore = round.scores?.[idx];
      if (!holeScore) return;
      const par  = c.holes[idx]?.par || 4;
      const strat = round.strategies?.[idx];
      if (!strat) return;
      const diff = ((holeScore.fairway || 0) + (holeScore.rough || 0) + (holeScore.putts || 0)) - par;
      if (!stratStats[strat]) stratStats[strat] = { totalDiff: 0, count: 0 };
      stratStats[strat].totalDiff += diff;
      stratStats[strat].count++;
    });

    if (!Object.keys(stratStats).length) return;

    const best = Object.entries(stratStats)
      .map(([type, s]) => ({ type, avg: s.totalDiff / s.count, count: s.count }))
      .sort((a, b) => a.avg - b.avg)[0];

    const { type: stratType, club: stratClub } = decodeStrategy(best.type);

    const tagClass = stratType?.startsWith('Par 3') ? 'par3'
      : (stratType === 'Max distance' || stratType === 'Aggressive' || stratType === 'Long') ? 'aggressive'
      : (stratType === 'Controlled'   || stratType === 'Balanced'   || stratType === 'Medium') ? 'balanced'
      : 'safe';

    const displayName = stratType || best.type;
    const clubPart = stratClub ? ` · ${stratClub}` : '';

    const row = document.createElement('div');
    row.className = 'hint-best-row';
    row.innerHTML =
      `<span class="hint-best-label">Best here:</span>` +
      `<span class="hint-best-tag ${tagClass}"><span class="hint-best-dot"></span>${displayName}${clubPart}</span>` +
      `<span class="hint-best-rounds">${best.count} round${best.count > 1 ? 's' : ''}</span>`;
    lastRoundHint.appendChild(row);
  }

  function updateSession() {
    saveActiveCourse(courseId, holeIdx);
  }

  // Expose update function so GPS tracker and score entry can refresh the grid
  bar._refreshGrid = () => {
    scores = loadScores(courseId);
    updateBar();
    if (summaryVisible) renderSummary();
  };

  updateBar();

  const playPane = document.getElementById('panePlay');
  playPane.insertBefore(bar, playPane.firstChild);
  callbacks.updateHoleCardMode?.();
}

// ── Score FAB + drawer ────────────────────────────────────────────────────
export function renderScoreEntry(courseId, holeIdx, scores, callbacks = {}) {
  const courses = loadCourses();
  const course  = courses[courseId];
  if (!course) return;

  // Don't re-render if score drawer is currently open — avoids replacing FAB mid-interaction
  const drawer = document.getElementById('scoreDrawer');
  if (drawer && drawer.classList.contains('open')) return;

  const hole = course.holes[holeIdx];
  const par  = hole?.par || 4;

  // Advanced mode — delegate to shot sheet
  if (getScoringMode() !== 'simple') {
    initHole(courseId, holeIdx, par, completedShots.length);
    mountShotSheet({ courseId, holeIdx, callbacks });
    return;
  }

  const gpsShots  = completedShots.length;
  const gpsActive = gpsShots > 0 || teeMarked;

  const existing_score = scores[holeIdx];

  // ── Lie config ─────────────────────────────────────────────────────────
  const LIE_CFG = {
    tee:     { label: 'Tee',     short: 'TEE', bg: '#cde3f5', color: '#0d3d5c', activeBg: '#1a6090' },
    fw:      { label: 'Fairway', short: 'FW',  bg: '#bddece', color: '#0d3d22', activeBg: '#1a6040' },
    rgh:     { label: 'Rough',   short: 'RGH', bg: '#ddd0aa', color: '#3d2a08', activeBg: '#7a5510' },
    sand:    { label: 'Sand',    short: 'SND', bg: '#edddb8', color: '#3d2e08', activeBg: '#9a7010' },
    penalty: { label: 'Penalty', short: 'PEN', bg: '#e8b8b8', color: '#3d0d0d', activeBg: '#9a1a1a' },
  };
  const LIE_ORDER = ['tee', 'fw', 'rgh', 'sand', 'penalty'];
  const ROUGH_LIES = new Set(['rgh', 'sand', 'penalty']);
  // Migration: old type strings → new lie keys
  const TYPE_TO_LIE = { 'tee-fairway': 'tee', 'tee-rough': 'tee', 'tee-green': 'tee', 'fairway': 'fw', 'rough': 'rgh' };

  function buildShots(lieArr) {
    return lieArr.map((lie, i) => ({ num: i + 1, lie: LIE_CFG[lie] ? lie : (TYPE_TO_LIE[lie] || 'fw') }));
  }

  // ── State ──────────────────────────────────────────────────────────────
  let shots = [];   // [{ num: 1, lie: 'tee'|'fw'|'rgh'|'sand'|'penalty' }]
  let putts = existing_score?.putts ?? 0;
  let simpleTotal = 0;  // only used in simple mode

  // Reconstruct shots from existing advanced score
  if (existing_score && existing_score.scoringMode !== 'simple') {
    if (existing_score.shots?.length) {
      shots = buildShots(existing_score.shots);
    } else {
      const f = existing_score.fairway || 0;
      const r = existing_score.rough   || 0;
      if (f + r > 0) {
        const lieArr = ['tee'];
        for (let i = 1; i < f + r; i++) {
          lieArr.push((i === 1 && r > 0 && existing_score.fir !== false) ? 'rgh' : 'fw');
        }
        shots = buildShots(lieArr);
      }
    }
  }

  // GPS pre-fill when no existing score
  if (!existing_score && gpsActive && gpsShots > 0) {
    const lieArr = ['tee'];
    for (let i = 1; i < gpsShots; i++) lieArr.push('fw');
    shots = buildShots(lieArr);
  }

  // Simple mode init
  if (existing_score?.scoringMode === 'simple') {
    simpleTotal = existing_score.fairway || 0;
  } else if (!existing_score && gpsActive && gpsShots > 0) {
    simpleTotal = gpsShots;
  }

  // ── Derived values ──────────────────────────────────────────────────────
  function derivedFairway() { return shots.filter(s => !ROUGH_LIES.has(s.lie)).length; }
  function derivedRough()   { return shots.filter(s => ROUGH_LIES.has(s.lie)).length; }
  function autoFir() {
    if (par <= 3) return null;
    if (shots.length < 2) return null;
    return shots[1].lie === 'fw';
  }
  function autoGir() {
    if (!shots.length) return false;
    return shots.length <= (par - 2);
  }

  // ── FAB ────────────────────────────────────────────────────────────────
  const fab = document.getElementById('scoreFab');
  fab.classList.add('visible');

  // ── Drawer ─────────────────────────────────────────────────────────────
  const overlay = document.getElementById('scoreDrawerOverlay');
  const inner   = document.getElementById('scoreDrawerInner');
  const handle  = document.getElementById('scoreDrawerHandle');

  function openDrawer() {
    buildDrawerContent();
    overlay.classList.add('visible');
    drawer.classList.add('open');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('visible');
    callbacks.calculate?.();
  }

  // Remove old fab listener by replacing the node
  const newFab = fab.cloneNode(true);
  fab.parentNode.replaceChild(newFab, fab);
  newFab.classList.add('visible');
  const total0 = getScoringMode() === 'simple' ? simpleTotal : shots.length + putts;
  if (existing_score || total0 > 0) {
    newFab.classList.add('has-score');
    newFab.textContent = total0 > 0 ? String(total0) : '+';
  } else {
    newFab.classList.remove('has-score');
    newFab.textContent = '+';
  }
  newFab.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });

  // Close on overlay tap
  overlay.onclick = closeDrawer;

  // ── Swipe down to dismiss ─────────────────────────────────────────────
  let dragStartY = null;
  let dragCurrentY = 0;

  function onDragStart(e) {
    dragStartY = (e.touches ? e.touches[0].clientY : e.clientY);
    dragCurrentY = 0;
    drawer.style.transition = 'none';
  }
  function onDragMove(e) {
    if (dragStartY === null) return;
    const y = (e.touches ? e.touches[0].clientY : e.clientY);
    dragCurrentY = Math.max(0, y - dragStartY);
    drawer.style.transform = `translateY(${dragCurrentY}px)`;
  }
  function onDragEnd() {
    if (dragStartY === null) return;
    dragStartY = null;
    drawer.style.transition = '';
    if (dragCurrentY > 80) {
      closeDrawer();
      drawer.style.transform = '';
    } else {
      drawer.style.transform = '';
    }
  }

  // Remove old listeners by replacing handle
  const newHandle = handle.cloneNode(true);
  handle.parentNode.replaceChild(newHandle, handle);
  // Swipe target is the full handle-area, not just the pill
  newHandle.addEventListener('touchstart', onDragStart, { passive: true });
  newHandle.addEventListener('touchmove',  onDragMove,  { passive: true });
  newHandle.addEventListener('touchend',   onDragEnd);
  // Also allow swipe on the drawer title area
  inner.addEventListener('touchstart', (e) => {
    if (e.target.closest('.score-drawer-title')) onDragStart(e);
  }, { passive: true });
  inner.addEventListener('touchmove', (e) => {
    if (dragStartY !== null) onDragMove(e);
  }, { passive: true });
  inner.addEventListener('touchend', (e) => {
    if (dragStartY !== null) onDragEnd();
  });

  // ── Total row ──────────────────────────────────────────────────────────
  const totalRow = document.createElement('div');

  function renderTotal() {
    const total = getScoringMode() === 'simple' ? simpleTotal : shots.length + putts;
    const diff  = total - par;
    const diffLabel = diff === 0 ? 'E' : (diff > 0 ? `+${diff}` : `${diff}`);
    const scoreColor = diff < 0 ? '#1a6040' : diff > 0 ? '#9a1a1a' : '#888';
    const allScores = loadScores(courseId);
    let runTotal = 0, runPar = 0;
    allScores.forEach((s, i) => {
      if (s && i !== holeIdx) { runTotal += (s.fairway || 0) + (s.rough || 0) + (s.putts || 0); runPar += course.holes[i]?.par || 4; }
    });
    runTotal += total; runPar += par;
    const runDiff = runTotal - runPar;
    const runLabel = runDiff === 0 ? 'E' : (runDiff > 0 ? `+${runDiff}` : `${runDiff}`);
    totalRow.className = 'd2-footer';
    totalRow.innerHTML =
      `<span class="d2-footer-total">Total ${total}</span>` +
      `<span class="d2-footer-score" style="color:${scoreColor}">${diffLabel}</span>` +
      `<span class="d2-footer-running">Running ${runLabel}</span>`;
  }

  // ── saveAndRefresh ─────────────────────────────────────────────────────
  function saveAndRefresh() {
    const mode = getScoringMode();
    if (mode === 'simple') {
      scores[holeIdx] = { fairway: simpleTotal, rough: 0, putts: 0, gir: null, fir: null, scoringMode: 'simple' };
      _inRough = false;
    } else {
      scores[holeIdx] = {
        fairway: derivedFairway(), rough: derivedRough(),
        putts, gir: autoGir(), fir: autoFir(), scoringMode: 'advanced',
        shots: shots.map(s => s.lie)
      };
      _inRough = derivedRough() > 0;
    }
    saveScores(courseId, scores);
    const bar = document.getElementById('playCourseBar');
    if (bar?._refreshGrid) bar._refreshGrid();
    renderTotal();
    const f = document.getElementById('scoreFab');
    const total = getScoringMode() === 'simple' ? simpleTotal : shots.length + putts;
    f.textContent = total > 0 ? String(total) : '+';
    if (total > 0) f.classList.add('has-score');
    else f.classList.remove('has-score');
  }

  // ── makeStepperRow ─────────────────────────────────────────────────────
  function makeStepperRow(labelHtml, getValue, setValue, min, onAfterChange) {
    const row = document.createElement('div');
    row.className = 'score-row';

    const lbl = document.createElement('span');
    lbl.className = 'score-row-label';
    lbl.innerHTML = labelHtml;
    row.appendChild(lbl);

    const stepper = document.createElement('div');
    stepper.className = 'score-stepper';

    const minus = document.createElement('button');
    minus.type = 'button'; minus.className = 'score-stepper-btn'; minus.textContent = '−';
    minus.addEventListener('click', () => {
      if (getValue() > min) { setValue(getValue() - 1); valSpan.textContent = getValue(); saveAndRefresh(); if (onAfterChange) onAfterChange(); }
    });

    const valSpan = document.createElement('span');
    valSpan.className = 'score-stepper-val';
    valSpan.textContent = getValue();

    const plus = document.createElement('button');
    plus.type = 'button'; plus.className = 'score-stepper-btn'; plus.textContent = '+';
    plus.addEventListener('click', () => {
      setValue(getValue() + 1); valSpan.textContent = getValue(); saveAndRefresh(); if (onAfterChange) onAfterChange();
    });

    stepper.appendChild(minus);
    stepper.appendChild(valSpan);
    stepper.appendChild(plus);
    row.appendChild(stepper);
    return { row, valSpan };
  }

  // ── Simple mode content ────────────────────────────────────────────────
  function buildSimpleContent() {
    inner.innerHTML = '';

    const hdr = document.createElement('div');
    hdr.className = 'd2-header';
    hdr.innerHTML = `<span class="d2-header-text">HOLE ${holeIdx + 1} · PAR ${par}</span><span class="d2-header-text">SIMPLE</span>`;
    inner.appendChild(hdr);

    const tileArea = document.createElement('div');
    tileArea.className = 'd2-tile-area';

    const shotsTile = document.createElement('div');
    shotsTile.className = 'd2-putts-tile';
    shotsTile.style.cssText = 'width:180px;height:180px;margin:16px auto;';

    const minusZone = document.createElement('button');
    minusZone.type = 'button'; minusZone.className = 'd2-putts-btn'; minusZone.textContent = '−';
    minusZone.addEventListener('click', () => {
      if (simpleTotal > 0) { simpleTotal--; countEl.textContent = simpleTotal; minusZone.classList.add('flash'); setTimeout(() => minusZone.classList.remove('flash'), 220); saveAndRefresh(); }
    });

    const center = document.createElement('div');
    center.className = 'd2-putts-center';
    const countEl = document.createElement('div');
    countEl.className = 'd2-putts-count'; countEl.textContent = simpleTotal;
    const sublbl = document.createElement('div');
    sublbl.className = 'd2-putts-sublabel'; sublbl.textContent = 'SHOTS';
    center.appendChild(countEl); center.appendChild(sublbl);

    const plusZone = document.createElement('button');
    plusZone.type = 'button'; plusZone.className = 'd2-putts-btn'; plusZone.textContent = '+';
    plusZone.addEventListener('click', () => {
      simpleTotal++; countEl.textContent = simpleTotal; plusZone.classList.add('flash'); setTimeout(() => plusZone.classList.remove('flash'), 220); saveAndRefresh();
    });

    shotsTile.appendChild(minusZone); shotsTile.appendChild(center); shotsTile.appendChild(plusZone);
    tileArea.appendChild(shotsTile);
    inner.appendChild(tileArea);

    totalRow.innerHTML = ''; renderTotal(); inner.appendChild(totalRow);
  }

  function rebuildContent() { buildDrawerContent(); }

  function buildDrawerContent() {
    if (getScoringMode() === 'simple') { buildSimpleContent(); return; }

    inner.innerHTML = '';

    // Re-read GPS state fresh each time drawer opens
    const curGpsShots  = completedShots.length;
    const curGpsActive = curGpsShots > 0 || teeMarked;

    // GPS pre-fill on first open if no existing score and shots not yet started
    if (!scores[holeIdx] && curGpsActive && curGpsShots > 0 && shots.length === 0) {
      const lieArr = ['tee'];
      for (let i = 1; i < curGpsShots; i++) lieArr.push('fw');
      shots = buildShots(lieArr);
    }

    // ── Header row ───────────────────────────────────────────────────────
    const hdr = document.createElement('div');
    hdr.className = 'd2-header';
    const holeLabel = document.createElement('span');
    holeLabel.className = 'd2-header-text';
    holeLabel.textContent = `HOLE ${holeIdx + 1} · PAR ${par}`;
    const shotLabel = document.createElement('span');
    shotLabel.className = 'd2-header-text';
    shotLabel.textContent = `SHOT ${shots.length + 1}`;
    hdr.appendChild(holeLabel); hdr.appendChild(shotLabel);
    inner.appendChild(hdr);

    // ── Shot badges row ──────────────────────────────────────────────────
    const badgesRow = document.createElement('div');
    badgesRow.className = 'd2-badges';
    shots.forEach((shot, idx) => {
      const cfg = LIE_CFG[shot.lie] || LIE_CFG.fw;
      const badge = document.createElement('button');
      badge.type = 'button'; badge.className = 'd2-badge';
      badge.style.cssText = `background:${cfg.bg};color:${cfg.color};`;
      if (idx === shots.length - 1) badge.style.animation = 'popIn 0.2s ease';
      badge.innerHTML = `<span class="d2-badge-num">${shot.num}</span><span class="d2-badge-short">${cfg.short}</span>`;
      badge.addEventListener('click', () => openEditSheet(idx));
      badgesRow.appendChild(badge);
    });
    inner.appendChild(badgesRow);

    // ── Tile grid ─────────────────────────────────────────────────────────
    const tileArea = document.createElement('div');
    tileArea.className = 'd2-tile-area';

    function makeLieTile(lie) {
      const cfg = LIE_CFG[lie];
      const disabled = lie === 'tee' && shots.length > 0;
      const tile = document.createElement('button');
      tile.type = 'button'; tile.className = 'd2-tile';
      tile.style.background = disabled ? '#e8e4df' : cfg.bg;
      tile.disabled = disabled;
      if (disabled) tile.style.opacity = '0.4';
      const tileLbl = document.createElement('div');
      tileLbl.className = 'd2-tile-label';
      tileLbl.style.color = disabled ? '#c0bab3' : cfg.color;
      tileLbl.textContent = cfg.label;
      tile.appendChild(tileLbl);
      if (!disabled) {
        tile.addEventListener('click', () => {
          shots.push({ num: shots.length + 1, lie });
          tile.style.background = cfg.activeBg; tileLbl.style.color = '#fff';
          setTimeout(() => { saveAndRefresh(); rebuildContent(); }, 240);
        });
      }
      return tile;
    }

    function makePuttsTile() {
      const tile = document.createElement('div');
      tile.className = 'd2-putts-tile';
      const minusZone = document.createElement('button');
      minusZone.type = 'button'; minusZone.className = 'd2-putts-btn'; minusZone.textContent = '−';
      minusZone.addEventListener('click', () => {
        if (putts > 0) { putts--; countEl.textContent = putts; minusZone.classList.add('flash'); setTimeout(() => minusZone.classList.remove('flash'), 220); saveAndRefresh(); }
      });
      const center = document.createElement('div');
      center.className = 'd2-putts-center';
      const countEl = document.createElement('div');
      countEl.className = 'd2-putts-count'; countEl.textContent = putts;
      const pLbl = document.createElement('div');
      pLbl.className = 'd2-putts-sublabel'; pLbl.textContent = 'PUTTS';
      center.appendChild(countEl); center.appendChild(pLbl);
      const plusZone = document.createElement('button');
      plusZone.type = 'button'; plusZone.className = 'd2-putts-btn'; plusZone.textContent = '+';
      plusZone.addEventListener('click', () => {
        putts++; countEl.textContent = putts; plusZone.classList.add('flash'); setTimeout(() => plusZone.classList.remove('flash'), 220); saveAndRefresh();
      });
      tile.appendChild(minusZone); tile.appendChild(center); tile.appendChild(plusZone);
      return tile;
    }

    [['tee','fw'], ['rgh','sand'], ['penalty','_putts']].forEach(([left, right]) => {
      const tileRow = document.createElement('div');
      tileRow.className = 'd2-tile-row';
      tileRow.appendChild(makeLieTile(left));
      tileRow.appendChild(right === '_putts' ? makePuttsTile() : makeLieTile(right));
      tileArea.appendChild(tileRow);
    });

    inner.appendChild(tileArea);
    totalRow.innerHTML = ''; renderTotal(); inner.appendChild(totalRow);
  }

  // ── Edit sheet (badge tap) ───────────────────────────────────────────
  function openEditSheet(shotIdx) {
    const shot = shots[shotIdx];

    const scrim = document.createElement('div');
    scrim.className = 'd2-edit-scrim';

    const sheet = document.createElement('div');
    sheet.className = 'd2-edit-sheet';

    const handle = document.createElement('div');
    handle.className = 'd2-edit-handle';
    sheet.appendChild(handle);

    const hdr = document.createElement('div');
    hdr.className = 'd2-edit-header';
    hdr.textContent = `EDIT SHOT ${shot.num}`;
    sheet.appendChild(hdr);

    const grid = document.createElement('div');
    grid.className = 'd2-edit-grid';

    const availableLies = LIE_ORDER;
    availableLies.forEach(lie => {
      const cfg = LIE_CFG[lie];
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'd2-edit-option';
      const isSelected = lie === shot.lie;
      btn.style.cssText = isSelected ? `background:${cfg.activeBg};color:#fff;` : `background:${cfg.bg};color:${cfg.color};`;
      btn.textContent = cfg.label;
      btn.addEventListener('click', () => {
        shots[shotIdx] = { num: shot.num, lie };
        scrim.remove(); saveAndRefresh(); rebuildContent();
      });
      grid.appendChild(btn);
    });
    sheet.appendChild(grid);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button'; removeBtn.className = 'd2-edit-remove';
    removeBtn.textContent = `Remove shot ${shot.num}`;
    removeBtn.addEventListener('click', () => {
      shots.splice(shotIdx, 1);
      shots.forEach((s, i) => { s.num = i + 1; });
      scrim.remove(); saveAndRefresh(); rebuildContent();
    });
    sheet.appendChild(removeBtn);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; cancelBtn.className = 'd2-edit-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => scrim.remove());
    sheet.appendChild(cancelBtn);

    scrim.appendChild(sheet);
    scrim.addEventListener('click', (e) => { if (e.target === scrim) scrim.remove(); });
    drawer.appendChild(scrim);
  }
}

// ── Round complete overlay ─────────────────────────────────────────────────
// ── Round complete overlay ───────────────────────────────────────────
export function showRoundCompleteOverlay(courseId, fromHoleIdx, callbacks = {}) {
  const backHoleIdx = (fromHoleIdx != null) ? fromHoleIdx : 17;
  const courses = loadCourses();
  const c = courses[courseId];
  if (!c) return;

  const scores = loadScores(courseId);

  // Compute stats
  const played = scores.map((s, i) => ({
    hole: i + 1, par: c.holes[i]?.par || 4,
    total: s ? (s.fairway || 0) + (s.rough || 0) + (s.putts || 0) : null,
    fairway: s?.fairway ?? null, putts: s?.putts ?? null, gir: s?.gir ?? null,
  }));

  let totalStrokes = 0, totalPar = 0, totalFW = 0, totalPutts = 0, totalGIR = 0, totalFIR = 0, holesPlayed = 0;
  let birdies = 0, pars = 0, bogeys = 0, doubles = 0;
  played.forEach(h => {
    if (h.total != null) {
      totalStrokes += h.total; totalPar += h.par;
      totalFW += h.fairway; totalPutts += h.putts;
      if (h.gir === true) totalGIR++;
      if (h.fir === true) totalFIR++;
      holesPlayed++;
      const d = h.total - h.par;
      if (d <= -1) birdies++;
      else if (d === 0) pars++;
      else if (d === 1) bogeys++;
      else doubles++;
    }
  });

  let front9Par = 0, front9Strokes = 0, front9Putts = 0, front9Played = 0;
  played.slice(0, 9).forEach(h => {
    front9Par += h.par;
    if (h.total != null) { front9Strokes += h.total; front9Putts += h.putts; front9Played++; }
  });
  let back9Par = 0, back9Strokes = 0, back9Putts = 0, back9Played = 0;
  played.slice(9, 18).forEach(h => {
    back9Par += h.par;
    if (h.total != null) { back9Strokes += h.total; back9Putts += h.putts; back9Played++; }
  });

  const vsPar = totalStrokes - totalPar;
  const vsParStr = vsPar === 0 ? 'E' : (vsPar > 0 ? '+' + vsPar : '' + vsPar);
  const vsParColor = vsPar < 0 ? '#1e7a45' : vsPar > 0 ? '#a32d2d' : '#444';
  const puttsPerGir = totalGIR > 0 ? (totalPutts / totalGIR).toFixed(2) : '—';
  const today = new Date().toLocaleDateString('sv-SE');

  // Score breakdown dots
  function dotStrip(count, bg, shape) {
    const r = shape === 'circle' ? '50%' : '2px';
    return Array.from({ length: count }, () =>
      `<span style="display:inline-block;width:10px;height:10px;border-radius:${r};background:${bg};margin:0 2px;"></span>`
    ).join('');
  }

  // Scorecard rows
  function pillHtml2(total, par) {
    if (total == null) return '—';
    const d = total - par;
    let bg, color;
    if (d <= -1) { bg = '#e6f4ec'; color = '#1e7a45'; }
    else if (d === 0) { bg = '#f0efeb'; color = '#444'; }
    else if (d === 1) { bg = '#fff3e0'; color = '#b25000'; }
    else { bg = '#fde8e8'; color = '#a32d2d'; }
    const lbl = d === 0 ? 'E' : (d > 0 ? '+' + d : '' + d);
    return `<span style="display:inline-block;background:${bg};color:${color};font-weight:700;font-size:11px;border-radius:10px;padding:2px 6px;">${lbl}</span>`;
  }

  function scRows(from, to) {
    return played.slice(from, to).map(h => {
      if (h.total == null) return `<tr><td class="rc-hole">${h.hole}</td><td>${h.par}</td><td>—</td><td>—</td><td>—</td></tr>`;
      return `<tr><td class="rc-hole">${h.hole}</td><td>${h.par}</td><td>${h.total}</td><td>${h.putts}</td><td>${pillHtml2(h.total, h.par)}</td></tr>`;
    }).join('');
  }

  const el = document.getElementById('roundCompleteOverlay');
  el.querySelector('.rc-body').innerHTML = `
    <div class="rc-header">
      <div class="rc-header-title">Round complete</div>
      <div class="rc-header-sub">${c.name || 'Course'} · ${today}</div>
    </div>
    <div class="rc-section">
      <div class="rc-hero">
        <div class="rc-hero-score" style="color:${vsParColor}">${vsParStr}</div>
        <div class="rc-hero-sub">${totalStrokes} strokes · par ${totalPar} · ${holesPlayed} holes</div>
      </div>
      <div class="rc-stat-grid">
        <div class="rc-stat-cell"><div class="rc-stat-val">${totalGIR}</div><div class="rc-stat-lbl">GIR</div></div>
        <div class="rc-stat-cell"><div class="rc-stat-val">${totalPutts}</div><div class="rc-stat-lbl">Putts</div></div>
        <div class="rc-stat-cell"><div class="rc-stat-val">${totalFIR}</div><div class="rc-stat-lbl">FIR</div></div>
        <div class="rc-stat-cell"><div class="rc-stat-val">${puttsPerGir}</div><div class="rc-stat-lbl">Putts/GIR</div></div>
      </div>
    </div>
    <div class="rc-section" style="margin-top:10px;">
      <div class="rc-section-label">Score breakdown</div>
      ${birdies > 0 ? `<div class="rc-breakdown-row"><span class="rc-bd-label">Birdies</span><span class="rc-bd-dots">${dotStrip(birdies, '#1e7a45', 'circle')}</span><span class="rc-bd-count" style="color:#1e7a45">${birdies}</span></div>` : ''}
      ${pars > 0 ? `<div class="rc-breakdown-row"><span class="rc-bd-label">Pars</span><span class="rc-bd-dots">${dotStrip(pars, '#c8c6c0', 'square')}</span><span class="rc-bd-count">${pars}</span></div>` : ''}
      ${bogeys > 0 ? `<div class="rc-breakdown-row"><span class="rc-bd-label">Bogeys</span><span class="rc-bd-dots">${dotStrip(bogeys, '#e8a070', 'square')}</span><span class="rc-bd-count">${bogeys}</span></div>` : ''}
      ${doubles > 0 ? `<div class="rc-breakdown-row"><span class="rc-bd-label">Doubles+</span><span class="rc-bd-dots">${dotStrip(doubles, '#a32d2d', 'square')}</span><span class="rc-bd-count" style="color:#a32d2d">${doubles}</span></div>` : ''}
    </div>
    <div class="rc-section" style="margin-top:10px;padding-bottom:8px;">
      <div class="rc-section-label">Scorecard</div>
      <table class="rc-table">
        <thead><tr><th>Hole</th><th>Par</th><th>Score</th><th>Putts</th><th>+/−</th></tr></thead>
        <tbody>
          <tr class="rc-sect"><td colspan="5">Front 9</td></tr>
          ${scRows(0, 9)}
          <tr class="rc-total"><td class="rc-hole" style="background:#e5e3df">Out</td><td>${front9Par}</td><td>${front9Played ? front9Strokes : '—'}</td><td>${front9Played ? front9Putts : '—'}</td><td>${front9Played ? pillHtml2(front9Strokes, front9Par) : '—'}</td></tr>
          <tr class="rc-sect"><td colspan="5">Back 9</td></tr>
          ${scRows(9, 18)}
          <tr class="rc-total"><td class="rc-hole" style="background:#e5e3df">In</td><td>${back9Par}</td><td>${back9Played ? back9Strokes : '—'}</td><td>${back9Played ? back9Putts : '—'}</td><td>${back9Played ? pillHtml2(back9Strokes, back9Par) : '—'}</td></tr>
          <tr class="rc-total"><td class="rc-hole" style="background:#333;color:#fff">Total</td><td>${totalPar}</td><td>${totalStrokes}</td><td>${totalPutts}</td><td>${pillHtml2(totalStrokes, totalPar)}</td></tr>
        </tbody>
      </table>
    </div>
    <div class="rc-btn-row">
      <button class="rc-btn-primary" id="rcSaveBtn" type="button">Save round</button>
      <button class="rc-btn-secondary" id="rcBackBtn" type="button">Back to round</button>
    </div>
    <button class="rc-btn-delete" id="rcDeleteBtn" type="button">Delete round</button>
    <div class="rc-footnote">Saving adds this round to My Golf stats</div>
  `;

  // Wire save button
  const saveBtn = el.querySelector('#rcSaveBtn');
  saveBtn.addEventListener('click', () => {
    const committedStrategies = getCommittedStrategies();

    const roundScores = loadScores(courseId);
    const roundData = {
      date: today,
      scores: roundScores,
      strategies: committedStrategies,
      holesPlayed,
      totalStrokes: holesPlayed ? totalStrokes : 0,
      totalPar:     holesPlayed ? totalPar     : 0,
      totalPutts:   holesPlayed ? totalPutts   : 0,
      totalGIR:     holesPlayed ? totalGIR     : 0,
    };
    saveRound(courseId, roundData);

    saveBtn.textContent = 'Saved!';
    saveBtn.disabled = true;
    saveBtn.style.background = '#888';
    saveBtn.style.cursor = 'default';

    try {
      clearScores(courseId);
      removeCommittedStrategies(courseId);
    } catch(e) {}

    callbacks.renderSavedRounds?.();

    // Auto-dismiss and clean up after short delay
    setTimeout(() => _dismissRoundComplete(courseId, callbacks), 700);
  });

  // Wire back to round button
  el.querySelector('#rcBackBtn').addEventListener('click', () => {
    el.style.display = 'none';
    saveActiveCourse(courseId, backHoleIdx);
    const bar = document.getElementById('playCourseBar');
    if (bar?._navigateTo) bar._navigateTo(backHoleIdx);
  });

  // Wire delete button — inline confirmation on first tap
  const deleteBtn = el.querySelector('#rcDeleteBtn');
  let deleteArmed = false;
  deleteBtn.addEventListener('click', () => {
    if (!deleteArmed) {
      deleteArmed = true;
      deleteBtn.textContent = 'Tap again to delete — this cannot be undone';
      deleteBtn.style.background = '#c00';
      deleteBtn.style.color = '#fff';
      setTimeout(() => {
        if (deleteArmed) {
          deleteArmed = false;
          deleteBtn.textContent = 'Delete round';
          deleteBtn.style.background = '';
          deleteBtn.style.color = '';
        }
      }, 3000);
      return;
    }
    // Confirmed — discard and close
    try {
      clearScores(courseId);
      removeCommittedStrategies(courseId);
    } catch(e) {}
    _dismissRoundComplete(courseId, callbacks);
  });

  el.style.display = 'flex';
}

function _dismissRoundComplete(courseId, callbacks = {}) {
  const el = document.getElementById('roundCompleteOverlay');
  el.style.display = 'none';
  // Full round teardown (same as quit round)
  clearActiveCourse();
  try {
    callbacks.clearAllOverrides?.();
    removeCommittedStrategies(null);
  } catch(e) {}
  clearGpsState();
  clearTeeState();
  const resetBtn = document.getElementById('gpsReset');
  const gpsWarn  = document.getElementById('gpsWarning');
  if (resetBtn) resetBtn.style.display = 'none';
  if (gpsWarn)  gpsWarn.style.display  = 'none';
  callbacks.gpsTeeSetState?.('idle');
  callbacks.gpsBallSetState?.('locked', null, 0);
  const bar2 = document.getElementById('playCourseBar');
  if (bar2) bar2.remove();
  const se = document.getElementById('scoreEntry');
  if (se) se.remove();
  const out = document.getElementById('output');
  if (out) out.innerHTML = '';
  const recalc = document.getElementById('recalcLink');
  if (recalc) recalc.classList.remove('visible');
  const actionRow = document.getElementById('playActionRow');
  if (actionRow) actionRow.style.display = 'none';
  hideScorefab();
  callbacks.updateLoadCourseBtn?.();
  callbacks.updateHoleCardMode?.();
  callbacks.updateCalcButtonVisibility?.();
}

// ── Hide FAB when no course is active ─────────────────────────────────────
export function hideScorefab() {
  const fab = document.getElementById('scoreFab');
  if (fab) fab.classList.remove('visible');
  const drawer = document.getElementById('scoreDrawer');
  if (drawer) drawer.classList.remove('open');
  const overlay = document.getElementById('scoreDrawerOverlay');
  if (overlay) overlay.classList.remove('visible');
}

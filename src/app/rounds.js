/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 2 — app — My Golf stats, rounds history, carry bars, sub-page navigation.

import {
  loadCourses, loadRounds, deleteRound,
  loadBag, loadProfile, saveProfile,
  loadHomeRoundFilter, saveHomeRoundFilter,
  loadStatsRoundFilter, saveStatsRoundFilter,
} from '../storage/storage.js';
import { clubs } from '../engine/clubs.js';
import { interpolate, decodeStrategy, courseHandicap, stablefordPoints } from '../engine/calculations.js';
import { renderCourseList, computeHoleStrokeCounts } from './courses.js';

// ── Round filter state ────────────────────────────────────────────────────────
let _homeFilter   = '18';
let _statsFilter  = 'all';
let _homeNetMode  = false;
let _statsNetMode = false;

export function filterRounds(rounds, filter) {
  if (filter === '18')  return rounds.filter(r => (r.holesPlayed ?? 0) >= 18);
  if (filter === '9')   return rounds.filter(r => { const h = r.holesPlayed ?? 0; return h >= 9 && h < 18; });
  return rounds; // 'all'
}

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── My Golf sub-page navigation ───────────────────────────────────────────────
export function showMgSub(id) {
  document.getElementById('mgHub').classList.add('hidden');
  document.querySelectorAll('.mg-sub').forEach(s => s.classList.remove('active'));
  const sub = document.getElementById(id);
  if (sub) sub.classList.add('active');
  if (id === 'mgSubStats') { renderMgStatsPage(); }
  if (id === 'mgSubRoundsHistory') { renderSavedRounds(); }
  if (id === 'mgSubCourses') renderCourseList();
  if (id === 'mgSubBag') renderMgCarryBars();
  if (id === 'mgSubProfile') {
    const p = loadProfile();
    const f = document.getElementById('profileName');
    const h = document.getElementById('profileHandicap');
    const c = document.getElementById('profileHomeCourse');
    if (f) f.value = p.name || '';
    if (h) h.value = p.handicap !== undefined ? p.handicap : '';
    if (c) c.value = p.homeCourse || '';
  }
}

export function showMgHub() {
  document.querySelectorAll('.mg-sub').forEach(s => s.classList.remove('active'));
  document.getElementById('mgHub').classList.remove('hidden');
  refreshMgHub();
}

export function refreshMgHub() {
  const profile = loadProfile();

  const avatar = document.getElementById('mgAvatar');
  const nameEl = document.getElementById('mgHubName');
  if (avatar && nameEl) {
    if (profile.name) {
      const parts    = profile.name.trim().split(/\s+/);
      const initials = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].slice(0, 2).toUpperCase();
      avatar.textContent = initials;
      nameEl.textContent = profile.name;
    } else {
      avatar.textContent = '?';
      nameEl.textContent = 'My Golf';
    }
  }

  const subtitle = document.getElementById('mgHubSubtitle');
  if (subtitle) {
    const parts = [];
    if (profile.handicap !== undefined && profile.handicap !== '') parts.push('HCP ' + parseFloat(profile.handicap).toFixed(1));
    if (profile.homeCourse) parts.push(profile.homeCourse);
    subtitle.textContent = parts.length ? parts.join(' · ') : 'Tap to set up your profile';
  }

  const profileSub = document.getElementById('mgProfileSub');
  if (profileSub) {
    const bits = [];
    if (profile.name) bits.push(profile.name);
    if (profile.handicap !== undefined && profile.handicap !== '') bits.push('HCP ' + parseFloat(profile.handicap).toFixed(1));
    profileSub.textContent = bits.length ? bits.join(' · ') : 'Set your name & handicap';
  }

  const driver = document.getElementById('driverCarry')?.value;
  const bagSub = document.getElementById('mgBagSub');
  if (bagSub) bagSub.textContent = driver ? 'Driver ' + driver + 'm · tap to edit' : 'Set up clubs & carries';

  const courses    = loadCourses ? loadCourses() : {};
  const allRounds  = Object.values(courses).flatMap((_, i) => {
    const id = Object.keys(courses)[i];
    return loadRounds ? loadRounds(id) : [];
  });
  const statsSub = document.getElementById('mgStatsSub');
  if (statsSub) {
    if (!allRounds.length) {
      statsSub.textContent = 'No rounds saved yet';
    } else {
      const totalGIR   = allRounds.reduce((a, r) => a + (r.totalGIR ?? 0), 0);
      const totalHoles = allRounds.reduce((a, r) => a + (r.holesPlayed ?? 0), 0);
      const girPct     = totalHoles > 0 ? Math.round(totalGIR / totalHoles * 100) : 0;
      const _fullPuttRounds = allRounds.filter(r => (r.holesPlayed ?? 0) >= 18);
      const avgPutts = _fullPuttRounds.length > 0
        ? (_fullPuttRounds.reduce((a, r) => a + (r.totalPutts ?? 0), 0) / _fullPuttRounds.length).toFixed(1)
        : '—';
      statsSub.textContent = allRounds.length + ' rounds · GIR ' + girPct + '% · ' + avgPutts + ' putts/rnd';
    }
  }

  const coursesSub = document.getElementById('mgCoursesSub');
  if (coursesSub) {
    const n = Object.keys(courses).length;
    coursesSub.textContent = n ? n + ' course' + (n !== 1 ? 's' : '') + ' saved' : 'No courses saved yet';
  }
}

// ── Stats tiles ───────────────────────────────────────────────────────────────
export function renderMgStatTiles() {
  const el = document.getElementById('mgStatTiles');
  if (!el) return;
  const courses   = loadCourses ? loadCourses() : {};
  const allRounds = Object.keys(courses).flatMap(id =>
    (loadRounds ? loadRounds(id) : []).map(r => ({ ...r, _courseId: id }))
  );
  if (!allRounds.length) { el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>'; return; }

  const profile  = loadProfile();
  const hcpIndex = parseFloat(profile.handicap);
  const hasHcp   = !isNaN(hcpIndex) && profile.handicap !== '' && profile.handicap != null;

  const totalHoles   = allRounds.reduce((a, r) => a + (r.holesPlayed ?? 0), 0);
  const totalStrokes = allRounds.reduce((a, r) => {
    const gross = r.totalStrokes ?? 0;
    return a + ((_statsNetMode && hasHcp) ? gross - _netAdj(r, courses, hcpIndex) : gross);
  }, 0);
  const totalPar     = allRounds.reduce((a, r) => a + (r.totalPar ?? 0), 0);
  const totalGIR     = allRounds.reduce((a, r) => a + (r.totalGIR ?? 0), 0);
  const avgVsPar     = totalPar > 0 ? ((totalStrokes - totalPar) / allRounds.length).toFixed(1) : '—';
  const avgVsParStr  = avgVsPar !== '—' ? (avgVsPar > 0 ? '+' + avgVsPar : avgVsPar) : '—';
  const girPct       = totalHoles > 0 ? Math.round(totalGIR / totalHoles * 100) : 0;
  const avgPutts = (() => {
    const full  = allRounds.filter(r => (r.holesPlayed ?? 0) >= 18);
    if (!full.length) return '—';
    const total = full.reduce((a, r) => a + (r.totalPutts ?? (r.scores||[]).reduce((x,sc)=>x+(sc?.putts||0),0)), 0);
    return (total / full.length).toFixed(1);
  })();
  let bestRound = null;
  allRounds.forEach(r => {
    if ((r.holesPlayed ?? 0) < 18) return;
    const gross  = r.totalStrokes ?? 0;
    const net    = (_statsNetMode && hasHcp) ? gross - _netAdj(r, courses, hcpIndex) : gross;
    const diff   = net - (r.totalPar ?? 0);
    if (bestRound === null || diff < bestRound.diff) bestRound = { diff, net };
  });
  const bestVal    = bestRound !== null ? bestRound.net : '—';
  const fullRounds = allRounds.filter(r => (r.holesPlayed ?? 0) >= 18);
  const avgStrokes = fullRounds.length > 0
    ? (fullRounds.reduce((a, r) => {
        const gross = r.totalStrokes ?? 0;
        return a + ((_statsNetMode && hasHcp) ? gross - _netAdj(r, courses, hcpIndex) : gross);
      }, 0) / fullRounds.length).toFixed(1)
    : '—';

  const tiles = [
    { lbl: 'Rounds',       val: allRounds.length, tappable: true, id: 'mgRoundsTile' },
    { lbl: 'Best score',   val: bestVal,           tappable: true, id: 'mgBestRoundTile' },
    { lbl: 'Avg strokes',  val: avgStrokes,        tappable: true, id: 'mgAvgStrokesTile' },
    { lbl: 'Putts / round',val: avgPutts,          tappable: true, id: 'mgPuttsTile' },
  ];
  el.innerHTML = tiles.map(t =>
    '<div class="mg-stat-tile' + (t.tappable ? ' tappable' : '') + '"' + (t.id ? ' id="' + t.id + '"' : '') + '>' +
    '<div class="mg-stat-val">' + t.val + '</div>' +
    '<div class="mg-stat-lbl">' + t.lbl + '</div>' +
    '</div>'
  ).join('');

  document.getElementById('mgRoundsTile')?.addEventListener('click', () => {
    renderMgRoundsHistory();
    showMgSub('mgSubRoundsHistory');
  });
  document.getElementById('mgBestRoundTile')?.addEventListener('click', () => {
    renderMgScoreBreakdown();
    showMgSub('mgSubScoreBreakdown');
  });
  document.getElementById('mgAvgStrokesTile')?.addEventListener('click', () => {
    renderMgAvgStrokesBreakdown();
    showMgSub('mgSubAvgStrokes');
  });
  document.getElementById('mgPuttsTile')?.addEventListener('click', () => {
    renderMgPuttsBreakdown();
    showMgSub('mgSubPuttsBreakdown');
  });
}

// ── Home stats dashboard ──────────────────────────────────────────────────────
export function refreshHomeStats() {
  const bodyEl  = document.getElementById('homeStatsBody');
  const emptyEl = document.getElementById('homeStatsEmpty');
  if (!bodyEl || !emptyEl) return;

  _homeFilter = loadHomeRoundFilter();

  const courses   = loadCourses ? loadCourses() : {};
  const allRounds = Object.keys(courses).flatMap(id =>
    (loadRounds ? loadRounds(id) : []).map(r => ({ ...r, _courseId: id }))
  );
  const filtered  = filterRounds(allRounds, _homeFilter);
  filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const recent8 = filtered.slice(-8);

  if (!recent8.length) {
    bodyEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  bodyEl.classList.remove('hidden');
  emptyEl.classList.add('hidden');

  _renderHomeSparkline(recent8, courses);
  _renderHomeStatTiles(filtered, filtered, courses);
  _renderHomeInsight(courses);
  _renderHomeRecentRounds(filtered, courses);
}

// Catmull-Rom → cubic bezier for smooth curves
function _smoothPath(xs, ys) {
  const n = xs.length;
  if (n < 2) return `M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  let d = `M ${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = i > 0 ? xs[i-1] : xs[i],   y0 = i > 0 ? ys[i-1] : ys[i];
    const x1 = xs[i],   y1 = ys[i];
    const x2 = xs[i+1], y2 = ys[i+1];
    const x3 = i < n-2 ? xs[i+2] : xs[i+1], y3 = i < n-2 ? ys[i+2] : ys[i+1];
    const cp1x = (x1 + (x2 - x0) / 6).toFixed(1);
    const cp1y = (y1 + (y2 - y0) / 6).toFixed(1);
    const cp2x = (x2 - (x3 - x1) / 6).toFixed(1);
    const cp2y = (y2 - (y3 - y1) / 6).toFixed(1);
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  return d;
}

function _netAdj(r, courses, hcpIndex) {
  const course = courses[r._courseId];
  const slope  = course?.slopeRating;
  const rating = course?.courseRating;
  if (!slope || !rating) return 0;
  const totalPar = (course.holes || []).reduce((a, h) => a + (h.par || 4), 0) || 72;
  const ch = courseHandicap(hcpIndex, slope, rating, totalPar);
  return Math.round(ch * (r.holesPlayed ?? 18) / 18);
}

function _renderHomeSparkline(recent, courses) {
  const el = document.getElementById('homeSparkline');
  if (!el) return;

  const profile   = loadProfile();
  const hcpIndex  = parseFloat(profile.handicap);
  const hasHcp    = !isNaN(hcpIndex) && profile.handicap !== '' && profile.handicap != null;

  const LINE_COLOR   = '#5c5752';
  const grossStrokes = recent.map(r => r.totalStrokes ?? 0);
  const strokes = _homeNetMode && hasHcp
    ? recent.map(r => (r.totalStrokes ?? 0) - _netAdj(r, courses, hcpIndex))
    : grossStrokes;
  const diffs   = recent.map((r, i) => strokes[i] - (r.totalPar ?? 0));
  const maxS    = Math.max(...strokes);
  const range   = Math.max(Math.max(...strokes) - Math.min(...strokes), 4);

  const W = 296, H = 90, padX = 12, padY = 18;
  const scale = (H - padY * 2) / range;
  const n     = recent.length;
  const xStep = n > 1 ? (W - padX * 2) / (n - 1) : 0;
  const xs    = recent.map((_, i) => padX + i * xStep);
  const ys    = strokes.map(v => padY + (maxS - v) * scale);

  const linePath = _smoothPath(xs, ys);
  const fillPath = linePath + ` L ${xs[n-1].toFixed(1)},${(H + 4).toFixed(1)} L ${xs[0].toFixed(1)},${(H + 4).toFixed(1)} Z`;

  const avgStrokes = strokes.reduce((a, b) => a + b, 0) / strokes.length;
  const avgY       = (padY + (maxS - avgStrokes) * scale).toFixed(1);
  const avgLine    = `<line x1="${padX}" y1="${avgY}" x2="${W - padX}" y2="${avgY}" stroke="#ede9e3" stroke-width="1" stroke-dasharray="3,3"/>`;

  const LABEL_COLOR = '#2a2826';
  let dots = '', labels = '';
  recent.forEach((r, i) => {
    const x = xs[i].toFixed(1), y = ys[i].toFixed(1);
    const isLast = i === recent.length - 1;
    dots += isLast
      ? `<circle cx="${x}" cy="${y}" r="3.5" fill="${LINE_COLOR}" stroke="none"/>`
      : `<circle cx="${x}" cy="${y}" r="3.5" fill="#fff" stroke="${LINE_COLOR}" stroke-width="1.5"/>`;
    const ly = strokes[i] <= avgStrokes
      ? (parseFloat(y) - 9).toFixed(1)
      : (parseFloat(y) + 15).toFixed(1);
    labels += `<text x="${x}" y="${ly}" text-anchor="middle" font-size="11" font-weight="700" fill="${LABEL_COLOR}" font-family="system-ui">${strokes[i]}</text>`;
  });

  const best    = Math.min(...diffs);
  const avg     = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const avgStr  = avg === 0 ? 'E' : (avg > 0 ? '+' + avg.toFixed(1) : avg.toFixed(1));
  const bestStr = best === 0 ? 'E' : (best > 0 ? '+' + best : String(best));
  const trendDown  = diffs.length >= 4
    ? (diffs.slice(-3).reduce((a,b)=>a+b,0)/3) < (diffs.slice(0,3).reduce((a,b)=>a+b,0)/3)
    : best < 0;
  const trendArrow = trendDown ? '↗' : '↘';
  const trendCol   = trendDown ? '#c0392b' : '#1a1a1a';

  const chips = ['18H', '9H', 'ALL'].map(label => {
    const val = label === '18H' ? '18' : label === '9H' ? '9' : 'all';
    const active = _homeFilter === val ? ' rfc-active' : '';
    return `<button class="rfc-chip${active}" data-filter="${val}" type="button">${label}</button>`;
  }).join('');
  const netToggle = hasHcp
    ? `<span class="hsc-chip-sep">|</span><button class="rfc-chip-toggle${_homeNetMode ? ' rfc-net-active' : ''}" id="homeNetToggle" type="button">${_homeNetMode ? 'Net' : 'Gross'}</button>`
    : '';

  el.innerHTML =
    `<div class="hsc-header"><span class="hsc-title">Score history</span><div class="hsc-chips">${chips}${netToggle}</div></div>` +
    `<div style="padding:10px 12px 0;">` +
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;overflow:visible;">` +
    `<defs><linearGradient id="hsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${LINE_COLOR}" stop-opacity="0.18"/><stop offset="100%" stop-color="${LINE_COLOR}" stop-opacity="0"/></linearGradient></defs>` +
    avgLine +
    `<path d="${fillPath}" fill="url(#hsg)" stroke="none"/>` +
    `<path d="${linePath}" fill="none" stroke="${LINE_COLOR}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    dots + labels +
    `</svg></div>` +
    `<div class="mg-chart-strip">` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val">${recent.length}</div><div class="mg-chart-strip-lbl">Rounds</div></div>` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val">${bestStr}</div><div class="mg-chart-strip-lbl">Best</div></div>` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val">${Math.round(avgStrokes)}</div><div class="mg-chart-strip-lbl">Avg</div></div>` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val" style="color:${trendCol};">${trendArrow}</div><div class="mg-chart-strip-lbl">Trend</div></div>` +
    `</div>`;

  el.querySelectorAll('.rfc-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _homeFilter = btn.dataset.filter;
      saveHomeRoundFilter(_homeFilter);
      refreshHomeStats();
    });
  });
  el.querySelector('#homeNetToggle')?.addEventListener('click', () => {
    _homeNetMode = !_homeNetMode;
    refreshHomeStats();
  });
}

function _renderHomeStatTiles(allRounds, full, courses) {
  const el = document.getElementById('homeStatRow');
  if (!el) return;

  const totalHoles   = allRounds.reduce((a, r) => a + (r.holesPlayed ?? 0), 0);
  const totalGIR     = allRounds.reduce((a, r) => a + (r.totalGIR ?? 0), 0);
  const girPct       = totalHoles > 0 ? Math.round(totalGIR / totalHoles * 100) : 0;

  const profile  = loadProfile();
  const hcpIndex = parseFloat(profile.handicap);
  const hasHcp   = !isNaN(hcpIndex) && profile.handicap !== '' && profile.handicap != null;

  const totalStrokes = allRounds.reduce((a, r) => {
    const gross = r.totalStrokes ?? 0;
    if (_homeNetMode && hasHcp) return a + gross - _netAdj(r, courses, hcpIndex);
    return a + gross;
  }, 0);
  const totalPar = allRounds.reduce((a, r) => a + (r.totalPar ?? 0), 0);

  const avgVsPar    = totalPar > 0 && allRounds.length > 0
    ? ((totalStrokes - totalPar) / allRounds.length).toFixed(1)
    : null;
  const avgVsParStr = avgVsPar === null ? '—'
    : parseFloat(avgVsPar) > 0 ? '+' + avgVsPar
    : avgVsPar;
  const avgVsParCol = avgVsPar === null ? '#aaa'
    : parseFloat(avgVsPar) < 0 ? '#c0392b' : '#1a1a1a';

  // Putts/hole using per-hole data (excludes simple-mode holes)
  let totalPutts = 0, totalPuttsHoles = 0;
  Object.keys(courses).forEach(courseId => {
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _homeFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      round.scores.forEach(s => {
        if (!s) return;
        if (s.putts != null && s.scoringMode !== 'simple') {
          totalPutts += s.putts;
          totalPuttsHoles++;
        }
      });
    });
  });
  const puttsPerHole = totalPuttsHoles > 0 ? (totalPutts / totalPuttsHoles).toFixed(1) : '—';

  el.innerHTML =
    `<div class="home-stat-tile"><div class="home-stat-val">${girPct}%</div><div class="home-stat-lbl">GIR</div></div>` +
    `<div class="home-stat-tile"><div class="home-stat-val">${puttsPerHole}</div><div class="home-stat-lbl">Putts/hole</div></div>` +
    `<div class="home-stat-tile"><div class="home-stat-val" style="color:${avgVsParCol};">${avgVsParStr}</div><div class="home-stat-lbl">vs par avg</div></div>`;
}

function _renderHomeInsight(courses) {
  const el = document.getElementById('homeInsight');
  if (!el) return;

  const parData = { 3: { strokes: 0, holes: 0 }, 4: { strokes: 0, holes: 0 }, 5: { strokes: 0, holes: 0 } };
  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _homeFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      round.scores.forEach((s, i) => {
        if (!s) return;
        const par   = course.holes?.[i]?.par || 4;
        const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
        if (!total || !parData[par]) return;
        parData[par].strokes += total;
        parData[par].holes++;
      });
    });
  });

  const diffs = [3, 4, 5].map(p => {
    const d = parData[p];
    return d.holes > 0 ? { par: p, diff: d.strokes / d.holes - p, holes: d.holes } : null;
  }).filter(Boolean);

  if (!diffs.length) { el.textContent = ''; return; }

  const best  = diffs.reduce((a, b) => b.diff < a.diff ? b : a);
  const worst = diffs.reduce((a, b) => b.diff > a.diff ? b : a);

  let text = '';
  if (best.diff < -0.1) {
    const s = best.diff > 0 ? '+' + best.diff.toFixed(1) : best.diff.toFixed(1);
    text = `Par ${best.par}s: ${s} avg — your strongest hole type`;
  } else if (worst.diff > 0.1) {
    const s = '+' + worst.diff.toFixed(1);
    text = `Par ${worst.par}s: ${s} avg — needs the most work`;
  } else {
    text = 'Scoring consistently across all par types';
  }
  el.textContent = text;
}

function _renderHomeRecentRounds(allRounds, courses) {
  const el = document.getElementById('homeRecentRounds');
  if (!el) return;

  const all = [];
  Object.keys(courses).forEach(id => {
    const rounds = filterRounds(loadRounds ? loadRounds(id) : [], _homeFilter);
    rounds.forEach(r => all.push({ ...r, courseName: courses[id].name }));
  });
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const shown = all.slice(0, 3);

  if (!shown.length) { el.innerHTML = ''; return; }

  el.innerHTML = shown.map(r => {
    const diff    = (r.totalStrokes || 0) - (r.totalPar || 0);
    const diffStr = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : diff);
    const color   = diff < 0 ? '#c0392b' : '#1a1a1a';
    return '<div class="lrh-row"><div class="lrh-left"><div class="lrh-course">' + (r.courseName || '—') + '</div>' +
      '<div class="lrh-date">' + (r.date || '—') + '</div></div>' +
      '<div class="lrh-right"><div class="lrh-score">' + (r.totalStrokes || '—') + '</div>' +
      '<div class="lrh-diff" style="color:' + color + '">' + diffStr + '</div></div></div>';
  }).join('');
}

// ── Stats page (My Golf) ──────────────────────────────────────────────────────
export function renderMgStatsPage() {
  _statsFilter = loadStatsRoundFilter();
  _renderStatsFilterChips();

  const courses    = loadCourses ? loadCourses() : {};
  const rawRounds  = Object.keys(courses).flatMap(id =>
    (loadRounds ? loadRounds(id) : []).map(r => ({ ...r, _courseId: id }))
  );
  const allRounds  = filterRounds(rawRounds, _statsFilter);
  const fullRounds = allRounds.filter(r => (r.holesPlayed ?? 0) >= 18);

  const profile  = loadProfile();
  const hcpIndex = parseFloat(profile.handicap);
  const hasHcp   = !isNaN(hcpIndex) && profile.handicap !== '' && profile.handicap != null;

  // Compact summary header
  const summaryEl = document.getElementById('mgStatsSummary');
  if (summaryEl) {
    if (!allRounds.length) {
      summaryEl.textContent = 'No rounds saved yet';
    } else {
      let bestDiff = null, bestStrokes = null;
      fullRounds.forEach(r => {
        const gross   = r.totalStrokes ?? 0;
        const strokes = (_statsNetMode && hasHcp) ? gross - _netAdj(r, courses, hcpIndex) : gross;
        const d       = strokes - (r.totalPar ?? 0);
        if (bestDiff === null || d < bestDiff) { bestDiff = d; bestStrokes = strokes; }
      });
      const avgStrokes = fullRounds.length
        ? Math.round(fullRounds.reduce((a, r) => {
            const gross = r.totalStrokes ?? 0;
            return a + ((_statsNetMode && hasHcp) ? gross - _netAdj(r, courses, hcpIndex) : gross);
          }, 0) / fullRounds.length)
        : null;
      const parts = [allRounds.length + ' round' + (allRounds.length !== 1 ? 's' : '')];
      if (bestStrokes !== null) parts.push('Best ' + bestStrokes);
      if (avgStrokes  !== null) parts.push('Avg '  + avgStrokes);
      summaryEl.textContent = parts.join(' · ');
    }
  }

  // Populate drill-down subtitles
  _populateStatsDrillSubs(allRounds, courses, fullRounds);
  _wireStatsDrillButtons();
}

function _renderStatsFilterChips() {
  const row = document.getElementById('statsRoundFilter');
  if (!row) return;

  const profile  = loadProfile();
  const hcpIndex = parseFloat(profile.handicap);
  const hasHcp   = !isNaN(hcpIndex) && profile.handicap !== '' && profile.handicap != null;

  const chipsHtml = ['18H', '9H', 'ALL'].map(label => {
    const val    = label === '18H' ? '18' : label === '9H' ? '9' : 'all';
    const active = _statsFilter === val ? ' rfc-active' : '';
    return `<button class="rfc-chip${active}" data-filter="${val}" type="button">${label}</button>`;
  }).join('');

  const netToggle = hasHcp
    ? `<span class="hsc-chip-sep">|</span><button class="rfc-chip-toggle${_statsNetMode ? ' rfc-net-active' : ''}" id="statsNetToggle" type="button">${_statsNetMode ? 'Net' : 'Gross'}</button>`
    : '';

  row.innerHTML = chipsHtml + netToggle;

  row.querySelectorAll('.rfc-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _statsFilter = btn.dataset.filter;
      saveStatsRoundFilter(_statsFilter);
      renderMgStatsPage();
      renderMgStatTiles();
    });
  });

  row.querySelector('#statsNetToggle')?.addEventListener('click', () => {
    _statsNetMode = !_statsNetMode;
    renderMgStatsPage();
    renderMgStatTiles();
  });
}

function _populateStatsDrillSubs(allRounds, courses, fullRounds) {
  // Score distribution sub
  const scoreSub = document.getElementById('mgDrillScoreSub');
  if (scoreSub) {
    let birdies = 0, bogeys = 0, doubles = 0, totalHoles = 0;
    Object.keys(courses).forEach(courseId => {
      const course = courses[courseId];
      const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
      rounds.forEach(round => {
        if (!round.scores) return;
        round.scores.forEach((s, i) => {
          if (!s) return;
          const par   = course.holes?.[i]?.par || 4;
          const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
          if (!total) return;
          totalHoles++;
          const diff = total - par;
          if (diff <= -1) birdies++;
          else if (diff === 1) bogeys++;
          else if (diff >= 2) doubles++;
        });
      });
    });
    scoreSub.textContent = totalHoles
      ? `Birdies ${birdies} · Bogeys ${bogeys} · Doubles ${doubles}`
      : 'No data yet';
  }

  // Par type sub
  const parSub = document.getElementById('mgDrillParSub');
  if (parSub) {
    const parData = { 3: { strokes: 0, holes: 0 }, 4: { strokes: 0, holes: 0 }, 5: { strokes: 0, holes: 0 } };
    Object.keys(courses).forEach(courseId => {
      const course = courses[courseId];
      const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
      rounds.forEach(round => {
        if (!round.scores) return;
        round.scores.forEach((s, i) => {
          if (!s) return;
          const par   = course.holes?.[i]?.par || 4;
          const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
          if (!total || !parData[par]) return;
          parData[par].strokes += total; parData[par].holes++;
        });
      });
    });
    const parts = [3, 4, 5].map(p => {
      const d = parData[p];
      if (!d.holes) return null;
      const diff = d.strokes / d.holes - p;
      return 'Par ' + p + ': ' + (diff > 0 ? '+' : '') + diff.toFixed(1);
    }).filter(Boolean);
    parSub.textContent = parts.length ? parts.join(' · ') : 'No data yet';
  }

  // Putting sub
  const puttsSub = document.getElementById('mgDrillPuttsSub');
  if (puttsSub) {
    const avgPuttsRound = fullRounds.length > 0
      ? (fullRounds.reduce((a, r) => a + (r.totalPutts ?? (r.scores||[]).reduce((x,sc)=>x+(sc?.putts||0),0)), 0) / fullRounds.length).toFixed(1)
      : null;
    puttsSub.textContent = avgPuttsRound ? `Avg ${avgPuttsRound} putts/round` : 'No data yet';
  }

  // Baseline sub
  const baselineSub = document.getElementById('mgDrillBaselineSub');
  if (baselineSub) {
    const n = Object.keys(courses).filter(id => filterRounds(loadRounds ? loadRounds(id) : [], _statsFilter).length > 0).length;
    baselineSub.textContent = n
      ? n + ' course' + (n !== 1 ? 's' : '') + ' · hole-by-hole avg vs par'
      : 'No rounds yet';
  }

  // History sub
  const historySub = document.getElementById('mgDrillHistorySub');
  if (historySub) {
    historySub.textContent = allRounds.length
      ? allRounds.length + ' round' + (allRounds.length !== 1 ? 's' : '') + ' saved'
      : 'No rounds saved yet';
  }
}

function _wireStatsDrillButtons() {
  function wire(id, fn) {
    const el = document.getElementById(id);
    if (!el || el.dataset.wired) return;
    el.dataset.wired = '1';
    el.addEventListener('click', fn);
  }
  wire('mgStatsGotoScoreBreakdown', () => { renderMgScoreBreakdown();      showMgSub('mgSubScoreBreakdown'); });
  wire('mgStatsGotoParType',        () => { renderMgAvgStrokesBreakdown(); showMgSub('mgSubAvgStrokes'); });
  wire('mgStatsGotoPutts',          () => { renderMgPuttsBreakdown();      showMgSub('mgSubPuttsBreakdown'); });
  wire('mgStatsGotoBaseline',       () => { renderMgBaseline();            showMgSub('mgSubBaseline'); });
  wire('mgStatsGotoHistory',        () => { showMgSub('mgSubRoundsHistory'); });
}

// ── Score breakdown ───────────────────────────────────────────────────────────
export function renderMgScoreBreakdown() {
  const el = document.getElementById('mgBreakdownContent');
  if (!el) return;
  const courses   = loadCourses ? loadCourses() : {};
  const allRounds = filterRounds(Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []), _statsFilter);
  if (!allRounds.length) {
    el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>';
    return;
  }

  let counts  = { hio: 0, albatross: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0 };
  let totalHoles = 0;
  let parData = { 3: { strokes: 0, holes: 0 }, 4: { strokes: 0, holes: 0 }, 5: { strokes: 0, holes: 0 } };

  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      round.scores.forEach((s, i) => {
        if (!s) return;
        const par   = course.holes?.[i]?.par || 4;
        const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
        if (!total) return;
        const diff = total - par;
        totalHoles++;
        if (total === 1 && par >= 2) counts.hio++;
        else if (diff <= -3) counts.albatross++;
        else if (diff === -2) counts.eagle++;
        else if (diff === -1) counts.birdie++;
        else if (diff === 0)  counts.par++;
        else if (diff === 1)  counts.bogey++;
        else counts.double++;
        if (parData[par]) { parData[par].strokes += total; parData[par].holes++; }
      });
    });
  });

  const dist = [
    { label: 'Hole in one', key: 'hio',       color: '#f5c400', shape: 'circle' },
    { label: 'Albatross',   key: 'albatross', color: '#7b2fff', shape: 'circle' },
    { label: 'Eagle',       key: 'eagle',     color: '#f07020', shape: 'circle' },
    { label: 'Birdie',      key: 'birdie',    color: '#c0392b', shape: 'circle' },
    { label: 'Par',         key: 'par',       color: '#888',    shape: 'circle' },
    { label: 'Bogey',       key: 'bogey',     color: '#3a6fc4', shape: 'square' },
    { label: 'Double+',     key: 'double',    color: '#1a3a7a', shape: 'square' },
  ];
  const maxCount = Math.max(...dist.map(d => counts[d.key]), 1);

  const distRows = dist.map(d => {
    const n      = counts[d.key];
    const pct    = totalHoles > 0 ? Math.round(n / totalHoles * 100) : 0;
    const barW   = Math.round(n / maxCount * 100);
    const dotStyle = d.shape === 'square'
      ? 'width:10px;height:10px;border-radius:2px;background:' + d.color + ';flex-shrink:0;'
      : 'width:10px;height:10px;border-radius:50%;background:' + d.color + ';flex-shrink:0;';
    return '<div class="mg-breakdown-row" style="gap:9px;">' +
      '<div style="' + dotStyle + '"></div>' +
      '<div class="mg-breakdown-label">' + d.label + '</div>' +
      '<div class="mg-breakdown-bar-wrap"><div class="mg-breakdown-bar" style="width:' + barW + '%;background:' + d.color + ';"></div></div>' +
      '<div class="mg-breakdown-pct">' + pct + '%</div>' +
      '<div style="font-size:12px;color:#aaa;width:26px;text-align:right;flex-shrink:0;">' + n + '</div>' +
      '</div>';
  }).join('');

  el.innerHTML =
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">Score distribution · ' + totalHoles + ' holes</div>' +
    distRows + '</div>';
}

// ── Baseline ──────────────────────────────────────────────────────────────────
export function renderMgBaseline() {
  const el = document.getElementById('mgBaselineContent');
  if (!el) return;
  const courses   = loadCourses ? loadCourses() : {};
  const courseIds = Object.keys(courses).filter(id => filterRounds(loadRounds ? loadRounds(id) : [], _statsFilter).length > 0);
  if (!courseIds.length) {
    el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>';
    return;
  }
  el.innerHTML = courseIds.map(courseId => {
    const course    = courses[courseId];
    const rounds    = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
    const holes     = course.holes || [];
    const numHoles  = Math.max(holes.length, 18);
    const holeData  = Array.from({ length: numHoles }, () => ({ strokes: 0, par: 0, count: 0 }));
    rounds.forEach(r => {
      if (!r.scores) return;
      r.scores.forEach((s, i) => {
        if (!s || i >= numHoles) return;
        const strokes = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
        if (!strokes) return;
        const par = holes[i]?.par || 4;
        holeData[i].strokes += strokes;
        holeData[i].par     += par;
        holeData[i].count++;
      });
    });
    const dots = holeData.slice(0, 18).map((h, i) => {
      if (h.count === 0) {
        return '<div class="mg-baseline-cell"><span class="mg-baseline-num">' + (i+1) + '</span>' +
          '<div class="mg-baseline-dot none"><span class="mg-baseline-delta">—</span></div></div>';
      }
      const avgDiff = (h.strokes - h.par) / h.count;
      const cls     = avgDiff < -0.05 ? 'under' : avgDiff < 0.05 ? 'even' : avgDiff < 1.05 ? 'over1' : avgDiff < 2.05 ? 'over2' : 'over3';
      const diffStr = avgDiff < -0.05 ? (avgDiff.toFixed(1)) : avgDiff < 0.05 ? 'E' : '+' + avgDiff.toFixed(1);
      return '<div class="mg-baseline-cell"><span class="mg-baseline-num">' + (i+1) + '</span>' +
        '<div class="mg-baseline-dot ' + cls + '">' +
        '<span class="mg-baseline-delta">' + diffStr + '</span>' +
        '<span class="mg-baseline-rounds">' + h.count + 'r</span>' +
        '</div></div>';
    }).join('');
    const legend =
      '<div class="mg-baseline-legend">' +
      '<div class="mg-baseline-legend-item"><div class="mg-baseline-legend-dot" style="background:#E1F5EE;"></div><span class="mg-baseline-legend-lbl">Under par</span></div>' +
      '<div class="mg-baseline-legend-item"><div class="mg-baseline-legend-dot" style="background:#f0efeb;border:0.5px solid #e0ddd8;"></div><span class="mg-baseline-legend-lbl">Even</span></div>' +
      '<div class="mg-baseline-legend-item"><div class="mg-baseline-legend-dot" style="background:#FAEEDA;"></div><span class="mg-baseline-legend-lbl">+0–1</span></div>' +
      '<div class="mg-baseline-legend-item"><div class="mg-baseline-legend-dot" style="background:#F5C4B3;"></div><span class="mg-baseline-legend-lbl">+1–2</span></div>' +
      '<div class="mg-baseline-legend-item"><div class="mg-baseline-legend-dot" style="background:#F09595;"></div><span class="mg-baseline-legend-lbl">+2 or more</span></div>' +
      '</div>';
    return '<div class="mg-breakdown-card">' +
      '<div class="mg-breakdown-title">' + (course.name || 'Course') + '</div>' +
      '<div style="padding:6px 14px 4px;font-size:12px;color:#aaa;">' + rounds.length + ' round' + (rounds.length !== 1 ? 's' : '') + ' · avg vs par per hole</div>' +
      '<div style="padding:0 14px;">' +
      '<div class="mg-baseline-grid">' + dots + '</div>' +
      legend + '</div></div>';
  }).join('');
}

// ── Avg strokes breakdown ─────────────────────────────────────────────────────
export function renderMgAvgStrokesBreakdown() {
  const el = document.getElementById('mgAvgStrokesContent');
  if (!el) return;
  const courses   = loadCourses ? loadCourses() : {};
  const allRounds = filterRounds(Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []), _statsFilter);
  if (!allRounds.length) { el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>'; return; }

  let parData = { 3: { strokes: 0, holes: 0 }, 4: { strokes: 0, holes: 0 }, 5: { strokes: 0, holes: 0 } };
  let totalGIR = 0, totalHolesGIR = 0, totalPuttsOnGIR = 0;
  let totalPutts = 0, totalPuttsHoles = 0;

  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      round.scores.forEach((s, i) => {
        if (!s) return;
        const par   = course.holes?.[i]?.par || 4;
        const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
        if (!total) return;
        if (parData[par]) { parData[par].strokes += total; parData[par].holes++; }
        totalHolesGIR++;
        if (s.gir) { totalGIR++; if (s.putts != null) totalPuttsOnGIR += s.putts; }
        if (s.putts != null && s.scoringMode !== 'simple') { totalPutts += s.putts; totalPuttsHoles++; }
      });
    });
  });

  let totalFIR = 0, totalFIRHoles = 0;
  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      round.scores.forEach((s, i) => {
        if (!s) return;
        const par = course.holes?.[i]?.par || 4;
        if (par <= 3) return;
        totalFIRHoles++;
        if (s.fir === true) totalFIR++;
      });
    });
  });

  const girPct         = totalHolesGIR > 0 ? Math.round(totalGIR / totalHolesGIR * 100) : 0;
  const girPerRound    = allRounds.length > 0 ? (totalGIR / allRounds.length).toFixed(1) : '—';
  const avgPuttsGIR    = totalGIR > 0 ? (totalPuttsOnGIR / totalGIR).toFixed(1) : '—';
  const firPct         = totalFIRHoles > 0 ? Math.round(totalFIR / totalFIRHoles * 100) : 0;
  const firPerRound    = allRounds.length > 0 ? (totalFIR / allRounds.length).toFixed(1) : '—';
  const fullRoundsForPutts = allRounds.filter(r => (r.holesPlayed ?? 0) >= 18);
  const avgPuttsRound  = fullRoundsForPutts.length > 0
    ? (fullRoundsForPutts.reduce((a, r) => a + (r.totalPutts ?? (r.scores||[]).reduce((x,sc)=>x+(sc?.putts||0),0)), 0) / fullRoundsForPutts.length).toFixed(1)
    : '—';

  const parTiles = [3, 4, 5].map(p => {
    const d       = parData[p];
    const avg     = d.holes > 0 ? (d.strokes / d.holes).toFixed(1) : '—';
    const diff    = d.holes > 0 ? (d.strokes / d.holes - p) : null;
    const diffStr = diff === null ? '' : diff === 0 ? 'E' : (diff > 0 ? '+' : '') + diff.toFixed(1);
    const diffClass = diff === null ? '' : diff > 0 ? ' pos' : diff < 0 ? ' neg' : '';
    return '<div class="mg-par-tile"><div class="mg-par-lbl">Par ' + p + '</div>' +
      '<div class="mg-par-val">' + avg + '</div>' +
      '<div class="mg-par-sub' + diffClass + '">' + (diff !== null ? diffStr : '') + '</div></div>';
  }).join('');

  el.innerHTML =
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">Score by par type</div>' +
    '<div style="padding:10px 12px 12px;"><div class="mg-par-grid">' + parTiles + '</div></div></div>' +
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">GIR</div>' +
    '<div style="display:flex;align-items:center;gap:14px;padding:9px 14px;">' +
    '<div style="font-size:28px;font-weight:700;color:#1a1a1a;">' + girPct + '%</div>' +
    '<div style="flex:1;height:8px;background:#ede9e3;border-radius:4px;overflow:hidden;">' +
    '<div style="width:' + girPct + '%;height:100%;background:#555;border-radius:4px;"></div></div></div>' +
    '<div style="font-size:12px;color:#aaa;padding:0 14px 10px;">' + girPerRound + ' of 18 greens hit per round</div>' +
    '</div>' +
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">FIR</div>' +
    '<div style="display:flex;align-items:center;gap:14px;padding:9px 14px;">' +
    '<div style="font-size:28px;font-weight:700;color:#1a1a1a;">' + firPct + '%</div>' +
    '<div style="flex:1;height:8px;background:#ede9e3;border-radius:4px;overflow:hidden;">' +
    '<div style="width:' + firPct + '%;height:100%;background:#555;border-radius:4px;"></div></div></div>' +
    '<div style="font-size:12px;color:#aaa;padding:0 14px 10px;">' + firPerRound + ' of 14 par 4/5 fairways hit per round</div>' +
    '</div>' +
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">Putting</div>' +
    '<div class="mg-breakdown-row" style="border-bottom:0.5px solid #f2f1ee;padding-bottom:8px;margin-bottom:8px;">' +
    '<div class="mg-breakdown-label">Putts per round</div>' +
    '<div class="mg-breakdown-val">' + avgPuttsRound + '</div></div>' +
    '<div class="mg-breakdown-row">' +
    '<div class="mg-breakdown-label">Putts per GIR hole</div>' +
    '<div class="mg-breakdown-val">' + avgPuttsGIR + '</div></div>' +
    '</div>';

  const lastCard   = el.querySelector('.mg-breakdown-card:last-child');
  const baselineBtn = document.createElement('div');
  baselineBtn.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;border-top:0.5px solid rgba(0,0,0,0.06);margin-top:0;';
  baselineBtn.innerHTML =
    '<div style="width:32px;height:32px;border-radius:8px;background:#f5f4f0;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
    '</div>' +
    '<div style="flex:1;">' +
      '<div style="font-size:15px;font-weight:700;color:#1a1a1a;">Personal baseline</div>' +
      '<div style="font-size:12px;color:#888;margin-top:2px;">Your shot model for this course</div>' +
    '</div>' +
    '<div style="font-size:17px;color:#ccc;font-weight:300;">›</div>';
  baselineBtn.addEventListener('click', () => { renderMgBaseline(); showMgSub('mgSubBaseline'); });
  (lastCard || el).appendChild(baselineBtn);
}

// ── Putts breakdown ───────────────────────────────────────────────────────────
export function renderMgPuttsBreakdown() {
  const el = document.getElementById('mgPuttsContent');
  if (!el) return;
  const courses   = loadCourses ? loadCourses() : {};
  const allRounds = filterRounds(Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []), _statsFilter);
  if (!allRounds.length) {
    el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>';
    return;
  }

  let counts     = { 1: 0, 2: 0, 3: 0, more: 0 };
  let totalHoles = 0;
  Object.keys(courses).forEach(courseId => {
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      round.scores.forEach(s => {
        if (!s || s.putts == null) return;
        const p = s.putts;
        totalHoles++;
        if (p === 1) counts[1]++;
        else if (p === 2) counts[2]++;
        else if (p === 3) counts[3]++;
        else counts.more++;
      });
    });
  });

  const avgPutts = totalHoles > 0
    ? (Object.entries(counts).reduce((a, [k, v]) => a + (k === 'more' ? 4 : +k) * v, 0) / totalHoles).toFixed(2)
    : '—';
  const rows     = [
    { label: '1 putt',   key: '1',    color: '#1e7a45' },
    { label: '2 putts',  key: '2',    color: '#888' },
    { label: '3 putts',  key: '3',    color: '#c07820' },
    { label: '3+ putts', key: 'more', color: '#c0392b' },
  ];
  const maxCount = Math.max(...rows.map(r => counts[r.key]), 1);

  el.innerHTML =
    '<div class="mg-breakdown-card">' +
    '<div class="mg-breakdown-title">Putts per hole · ' + totalHoles + ' holes · avg ' + avgPutts + '</div>' +
    rows.map(r => {
      const n    = counts[r.key];
      const pct  = totalHoles > 0 ? Math.round(n / totalHoles * 100) : 0;
      const barW = Math.round(n / maxCount * 100);
      return '<div class="mg-breakdown-row">' +
        '<div class="mg-breakdown-label">' + r.label + '</div>' +
        '<div class="mg-breakdown-bar-wrap"><div class="mg-breakdown-bar" style="width:' + barW + '%;background:' + r.color + ';"></div></div>' +
        '<div class="mg-breakdown-pct">' + pct + '%</div>' +
        '</div>';
    }).join('') +
    '</div>';
}

// ── Rounds history ────────────────────────────────────────────────────────────
export function renderMgRoundsHistory() {
  ['mgRoundsHistoryContent', 'mgRoundsHistoryFull'].forEach(elId => {
    const el = document.getElementById(elId);
    if (!el) return;
    const courses = loadCourses ? loadCourses() : {};
    const all     = [];
    Object.keys(courses).forEach(id => {
      const rounds = loadRounds ? loadRounds(id) : [];
      rounds.forEach(r => all.push({ ...r, courseName: courses[id].name, courseId: id }));
    });
    if (!all.length) { el.innerHTML = '<div style="padding:16px;color:#aaa;font-size:15px;">No rounds saved yet.</div>'; return; }
    all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const limit = el.dataset.limit ? parseInt(el.dataset.limit) : all.length;
    const shown = all.slice(0, limit);
    el.innerHTML = shown.map(r => {
      // Robust stableford detection: explicit format flag OR points saved with no format (legacy)
      const isStblf = r.gameFormat === 'stableford' || ((r.totalPoints ?? 0) > 0 && !r.gameFormat);
      const diff    = (r.totalStrokes || 0) - (r.totalPar || 0);

      // Primary (17px lrh-score) — the meaningful indicator for each mode
      const pts          = r.totalPoints ?? 0;
      const ptsExpected  = (r.holesPlayed || 18) * 2;
      const diffStr      = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : diff);
      const primaryVal   = isStblf ? pts + ' pts' : diffStr;
      const primaryColor = isStblf
        ? (pts > ptsExpected ? '#c0392b' : '#1a1a1a')
        : (diff < 0 ? '#c0392b' : '#1a1a1a');

      // Secondary (13px lrh-diff) — supporting context
      const secondaryVal   = (r.totalStrokes || '—') + ' strokes';
      const secondaryColor = '#aaa';

      return '<div class="lrh-row"><div class="lrh-left"><div class="lrh-course">' + (r.courseName || '—') + '</div>' +
        '<div class="lrh-date">' + (r.date || '—') + '</div></div>' +
        '<div class="lrh-right"><div class="lrh-score" style="color:' + primaryColor + '">' + primaryVal + '</div>' +
        '<div class="lrh-diff" style="color:' + secondaryColor + '">' + secondaryVal + '</div></div></div>';
    }).join('');
  });
}

// ── Recent rounds chart ───────────────────────────────────────────────────────
export function renderMgRecentRounds() {
  const el = document.getElementById('mgRecentRounds');
  if (!el) return;
  const courses = loadCourses ? loadCourses() : {};
  const all     = [];
  Object.keys(courses).forEach(id => {
    const rounds = filterRounds(loadRounds ? loadRounds(id) : [], _statsFilter);
    rounds.forEach(r => all.push({ ...r, courseName: courses[id].name }));
  });
  all.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const full   = all.filter(r => (r.holesPlayed ?? 0) >= 18);
  const recent = full.slice(-8);
  if (!recent.length) {
    el.innerHTML = '<div style="padding:16px;color:#aaa;font-size:15px;">No full rounds yet.</div>';
    return;
  }

  const strokes = recent.map(r => r.totalStrokes ?? 0);
  const diffs   = recent.map(r => (r.totalStrokes ?? 0) - (r.totalPar ?? 0));
  const minS    = Math.min(...strokes);
  const maxS    = Math.max(...strokes);
  const range   = Math.max(maxS - minS, 4);

  const W = 312, H = 130, padX = 14, padY = 22;
  const scale = (H - padY * 2) / range;
  const n     = recent.length;
  const xStep = n > 1 ? (W - padX * 2) / (n - 1) : 0;
  const xs    = recent.map((_, i) => padX + i * xStep);
  const ys    = strokes.map(v => padY + (maxS - v) * scale);
  const pts   = xs.map((x, i) => x.toFixed(1) + ',' + ys[i].toFixed(1)).join(' ');

  const avgStrokes = strokes.reduce((a, b) => a + b, 0) / strokes.length;
  const avgY       = (padY + (maxS - avgStrokes) * scale).toFixed(1);
  const avgLine    = `<line x1="0" y1="${avgY}" x2="${W}" y2="${avgY}" stroke="#ece9e4" stroke-width="1" stroke-dasharray="3,3"/>
  <text x="2" y="${(parseFloat(avgY) - 3).toFixed(1)}" font-size="9" fill="#ccc" font-family="system-ui" font-weight="600">avg</text>`;
  const lineBase    = `<polyline points="${pts}" fill="none" stroke="#e0ddd8" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  const lineColored = `<polyline points="${pts}" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;

  let dots = '', labels = '';
  recent.forEach((r, i) => {
    const x = xs[i].toFixed(1), y = ys[i].toFixed(1);
    const d = diffs[i];
    const isLast = i === recent.length - 1;
    const col    = d < 0 ? '#c0392b' : '#1a1a1a';
    const lbl    = String(strokes[i]);
    dots   += isLast
      ? `<circle cx="${x}" cy="${y}" r="4" fill="${col}" stroke="${col}" stroke-width="2"/>`
      : `<circle cx="${x}" cy="${y}" r="4" fill="#fff" stroke="${col}" stroke-width="2"/>`;
    const ly = strokes[i] <= avgStrokes
      ? (parseFloat(y) - 10).toFixed(1)
      : (parseFloat(y) + 16).toFixed(1);
    labels += `<text x="${x}" y="${ly}" text-anchor="middle" font-size="11" font-weight="700" fill="${col}" font-family="system-ui">${lbl}</text>`;
  });

  const dateLabels = recent.map(r => {
    const d     = r.date || '';
    const parts = d.split('-');
    const mo    = parts[1] ? ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(parts[1])] || '' : '';
    const day   = parts[2] ? parseInt(parts[2]) : '';
    return `<div style="flex:1;text-align:center;font-size:11px;color:#ccc;line-height:1.4;">${mo}<br>${day}</div>`;
  }).join('');

  const best    = Math.min(...diffs);
  const avg     = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const avgStr  = avg === 0 ? 'E' : (avg > 0 ? '+' + avg.toFixed(1) : avg.toFixed(1));
  const bestStr = best === 0 ? 'E' : (best > 0 ? '+' + best : String(best));
  const trendDown  = diffs.length >= 4
    ? (diffs.slice(-3).reduce((a,b)=>a+b,0)/3) < (diffs.slice(0,3).reduce((a,b)=>a+b,0)/3)
    : best < 0;
  const trendArrow = trendDown ? '↗' : '↘';
  const trendCol   = trendDown ? '#c0392b' : '#1a1a1a';
  const bestCol    = best < 0 ? '#c0392b' : '#1a1a1a';
  const avgCol     = avg  < 0 ? '#c0392b' : '#1a1a1a';

  const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;overflow:visible;">
    ${avgLine}${lineBase}${lineColored}${dots}${labels}
  </svg>`;

  el.innerHTML =
    `<div style="padding:22px 18px 0;">${svg}` +
    `<div style="display:flex;padding:8px 0 0;">${dateLabels}</div></div>` +
    `<div class="mg-chart-strip">` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val">${recent.length}</div><div class="mg-chart-strip-lbl">Rounds</div></div>` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val" style="color:${bestCol};">${bestStr}</div><div class="mg-chart-strip-lbl">Best</div></div>` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val" style="color:${avgCol};">${avgStr}</div><div class="mg-chart-strip-lbl">Avg</div></div>` +
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val" style="color:${trendCol};">${trendArrow}</div><div class="mg-chart-strip-lbl">Trend</div></div>` +
    `</div>`;
}

// ── Carry bars ────────────────────────────────────────────────────────────────
export function renderMgCarryBars() {
  const el = document.getElementById('mgCarryBars');
  if (!el) return;
  const saved  = loadBag();
  const driver = parseFloat(saved?.driver) || 0;
  const i7     = parseFloat(saved?.i7)     || 0;
  const pw     = parseFloat(saved?.pw)     || 0;
  if (!driver || !clubs.length) {
    el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">Enter driver carry to see distances.</div>';
    return;
  }
  const activeKeys = new Set(
    saved.checked
      ? clubs.filter((c, i) => saved.checked[i]).map(c => c.key)
      : clubs.map(c => c.key)
  );
  const rows = clubs.filter(c => activeKeys.has(c.key)).map(c => {
    const carry = Math.round(interpolate(driver, i7, pw, c.key));
    const pct   = Math.round((carry / driver) * 100);
    return '<div class="mg-carry-row"><div class="mg-carry-name">' + c.label + '</div>' +
      '<div class="mg-carry-bar-wrap"><div class="mg-carry-bar" style="width:' + pct + '%"></div></div>' +
      '<div class="mg-carry-val">' + carry + 'm</div></div>';
  });
  el.innerHTML = rows.join('') || '<div style="padding:12px;color:#aaa;font-size:15px;">No clubs selected.</div>';
}

// ── Saved rounds (rounds history detail) ─────────────────────────────────────
export function renderSavedRounds() {
  const existing = document.getElementById('savedRoundsSection');
  if (existing) existing.remove();

  const courses   = loadCourses ? loadCourses() : {};
  const courseIds = Object.keys(courses);
  if (!courseIds.length) return;

  let anyRounds = false;
  courseIds.forEach(id => { if ((loadRounds ? loadRounds(id) : []).length > 0) anyRounds = true; });
  if (!anyRounds) return;

  const profile  = loadProfile();
  const hcpIndex = parseFloat(profile.handicap);
  const hasHcp   = !isNaN(hcpIndex) && profile.handicap !== '' && profile.handicap != null;

  const section = document.createElement('div');
  section.id = 'savedRoundsSection';

  function stratPillClass(s) {
    if (!s) return 'safe';
    const type = s.includes(' · ') ? s.split(' · ')[0] : s;
    if (type.startsWith('Par 3'))                                              return 'par3';
    if (type === 'Long'   || type === 'Aggressive' || type === 'Max distance') return 'aggressive';
    if (type === 'Medium' || type === 'Balanced'   || type === 'Controlled')   return 'balanced';
    if (type === 'Short'  || type === 'Safe'       || type === 'Conservative') return 'safe';
    return 'safe';
  }

  function scorePillClass(total, par) {
    const d = total - par;
    if (total === 1 && par >= 2) return 'sp-hole-in-one';
    if (d <= -2) return 'sp-eagle';
    if (d === -1) return 'sp-birdie';
    if (d === 1)  return 'sp-bogey';
    if (d >= 2)   return 'sp-double';
    return 'sp-par';
  }

  function scRowHtml(s, i, course, round, holeStrokeCounts = []) {
    if (!s) return '';
    const par   = course.holes[i]?.par || 4;
    const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
    const spCls = scorePillClass(total, par);
    const strat = round.strategies?.[i] || round.strategies?.[String(i)];
    let stratCell = '—';
    if (strat) {
      const { type: _t, club: _c } = decodeStrategy(strat);
      const displayType = _t || strat;
      const shortType   = displayType === 'Max distance' ? 'Max dist'
        : displayType === 'Conservative' ? 'Conserv.' : displayType;
      stratCell = `<span class="pill ${stratPillClass(strat)}">${escHtml(shortType)}</span>`
        + (_c ? ` <span class="strat-club-tag">${escHtml(_c)}</span>` : '');
    }
    const girCell = s.gir === true  ? '<span style="color:#1e7a45;font-weight:700;">✓</span>' : '<span style="color:#ccc;">✗</span>';
    const firCell = par <= 3
      ? '<span style="color:#ccc;">—</span>'
      : s.fir === true  ? '<span style="color:#1e7a45;font-weight:700;">✓</span>'
      : s.fir === false ? '<span style="color:#ccc;">✗</span>'
      : '<span style="color:#ccc;">—</span>';
    const isStblf = round.gameFormat === 'stableford';
    const ptsCell = isStblf
      ? `<td class="sc-pts" style="font-weight:700;color:#1e7a45">${stablefordPoints(total, par, holeStrokeCounts[i] ?? 0)}</td>`
      : '';
    return `<tr>
      <td>${i + 1}</td>
      <td>${par}</td>
      <td><span class="score-pill ${spCls}">${total}</span></td>
      <td>${s.putts}</td>
      <td style="text-align:center">${girCell}</td>
      <td style="text-align:center">${firCell}</td>
      <td class="sc-strategy">${stratCell}</td>
      ${ptsCell}
    </tr>`;
  }

  courseIds.forEach(courseId => {
    const rounds = loadRounds ? loadRounds(courseId) : [];
    const course = courses[courseId];
    if (!rounds.length) return;

    const block = document.createElement('div');
    block.style.cssText = 'background:#fff;margin-bottom:10px;';

    const allScores  = rounds.flatMap(r => (r.scores || []).map((s, i) => ({ s, i, r })));
    const played     = allScores.filter(({ s }) => s != null);
    const girTotal   = played.filter(({ s }) => s.gir === true).length;
    const girPct     = played.length > 0 ? Math.round(girTotal / played.length * 100) : null;
    const fullRounds = rounds.filter(r => (r.holesPlayed ?? 0) >= 18);
    const avgPutts   = fullRounds.length > 0
      ? (fullRounds.reduce((a, r) => a + (r.totalPutts ?? (r.scores||[]).reduce((x,s)=>x+(s?.putts||0),0)), 0) / fullRounds.length).toFixed(1)
      : null;

    const hdr = document.createElement('div');
    hdr.className = 'rh-course-hdr';
    hdr.innerHTML = `<div class="rh-course-name">${escHtml(course.name)}</div>
      <div class="rh-course-meta">${rounds.length} round${rounds.length !== 1 ? 's' : ''}${girPct !== null ? ' · GIR ' + girPct + '%' : ''}${avgPutts !== null ? ' · ⛳ ' + avgPutts + ' putts/rnd' : ''}</div>`;
    block.appendChild(hdr);

    rounds.forEach((round, ri) => {
      const rowId    = 'rh-' + courseId + '-' + ri;
      const netAdj      = (_statsNetMode && hasHcp) ? _netAdj({ ...round, _courseId: courseId }, courses, hcpIndex) : 0;
      const netScore    = (round.totalStrokes || 0) - netAdj;
      const diff        = netScore - (round.totalPar || 0);
      const diffStr     = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : String(diff));
      const diffCls     = diff < 0 ? 'under' : diff > 0 ? 'over' : 'even';
      const isStblf     = round.gameFormat === 'stableford';
      const displayStr  = isStblf ? (round.totalPoints ?? 0) + ' pts' : diffStr;
      const displayCls  = isStblf ? 'stableford' : diffCls;
      const rPutts  = round.totalPutts ?? (round.scores||[]).reduce((a,s)=>a+(s?.putts||0),0);
      const rGIR    = round.totalGIR   ?? (round.scores||[]).filter(s=>s?.gir).length;
      const rFIR    = (round.scores||[]).filter(s=>s?.fir===true).length;
      const holesP  = round.holesPlayed || 0;
      const girPctR = holesP > 0 ? Math.round(rGIR / holesP * 100) : 0;
      const firPctR = holesP > 0 ? Math.round(rFIR / holesP * 100) : 0;

      const rrow = document.createElement('div');
      rrow.className = 'round-row';
      rrow.innerHTML = `<div class="round-left">
          <div class="round-date">${escHtml(round.date || '—')}</div>
          <div class="round-meta">${holesP}H · ⛳${rPutts} · GIR ${girPctR}% · FIR ${firPctR}%</div>
        </div>
        <div class="round-right">
          <div class="round-score ${displayCls}">${displayStr}</div>
          <div class="round-arr" id="${rowId}-arr">▶</div>
        </div>`;

      const rdet = document.createElement('div');
      rdet.className = 'round-detail';
      rdet.id        = rowId + '-det';

      const statBar = document.createElement('div');
      statBar.className = 'round-stat-bar';
      statBar.innerHTML = `
        <div class="round-stat-cell"><div class="round-stat-val">${netScore || '—'}</div><div class="round-stat-lbl">${netAdj > 0 ? 'Net score' : 'Score'}</div></div>
        <div class="round-stat-cell"><div class="round-stat-val">${rPutts}</div><div class="round-stat-lbl">Putts</div></div>
        <div class="round-stat-cell"><div class="round-stat-val good">${girPctR}%</div><div class="round-stat-lbl">GIR</div></div>
        <div class="round-stat-cell"><div class="round-stat-val info">${firPctR}%</div><div class="round-stat-lbl">FIR</div></div>`;
      rdet.appendChild(statBar);

      let f9Par=0,f9S=0,f9P=0,f9G=0,f9n=0,f9F=0,f9Fa=0;
      let b9Par=0,b9S=0,b9P=0,b9G=0,b9n=0,b9F=0,b9Fa=0;
      (round.scores||[]).forEach((s,i) => {
        if (!s) return;
        const hPar  = course.holes[i]?.par || 4;
        const total = (s.fairway||0)+(s.rough||0)+(s.putts||0);
        const fir   = hPar > 3 && s.fir === true;
        const firApp = hPar > 3;
        if (i<9) { f9Par+=hPar;f9S+=total;f9P+=s.putts;if(s.gir)f9G++;f9n++;if(fir)f9F++;if(firApp)f9Fa++; }
        else     { b9Par+=hPar;b9S+=total;b9P+=s.putts;if(s.gir)b9G++;b9n++;if(fir)b9F++;if(firApp)b9Fa++; }
      });

      const isStblf2   = round.gameFormat === 'stableford';
      const hSC        = isStblf2 ? computeHoleStrokeCounts(courseId) : [];
      const colSpan    = isStblf2 ? 8 : 7;
      let f9Pts = 0, b9Pts = 0;
      if (isStblf2) {
        (round.scores||[]).slice(0,9).forEach((s,idx) => {
          if (!s) return;
          const p = course.holes[idx]?.par || 4;
          const t = (s.fairway||0)+(s.rough||0)+(s.putts||0);
          f9Pts += stablefordPoints(t, p, hSC[idx] ?? 0);
        });
        (round.scores||[]).slice(9,18).forEach((s,idx) => {
          if (!s) return;
          const p = course.holes[9+idx]?.par || 4;
          const t = (s.fairway||0)+(s.rough||0)+(s.putts||0);
          b9Pts += stablefordPoints(t, p, hSC[9+idx] ?? 0);
        });
      }

      const scWrap = document.createElement('div');
      scWrap.style.overflowX = 'auto';
      scWrap.innerHTML = `<table class="sc-table">
        <thead><tr><th>#</th><th>Par</th><th>Score</th><th>Putts</th><th>GIR</th><th>FIR</th><th class="sc-strategy">Strategy</th>${isStblf2 ? '<th class="sc-pts">Pts</th>' : ''}</tr></thead>
        <tbody>
          <tr class="sc-section"><td colspan="${colSpan}">Front 9</td></tr>
          ${(round.scores||[]).slice(0,9).map((s,i)=>scRowHtml(s,i,course,round,hSC)).join('')}
          <tr class="sc-total">
            <td class="sc-hole">Out</td><td>${f9Par}</td>
            <td>${f9n?f9S:'—'}</td><td>${f9n?f9P:'—'}</td>
            <td style="text-align:center">${f9n?f9G+'/'+f9n:'—'}</td>
            <td style="text-align:center">${f9Fa?f9F+'/'+f9Fa:'—'}</td><td></td>
            ${isStblf2 ? `<td class="sc-pts" style="font-weight:700;color:#1e7a45">${f9n?f9Pts:'—'}</td>` : ''}
          </tr>
          <tr class="sc-section"><td colspan="${colSpan}">Back 9</td></tr>
          ${(round.scores||[]).slice(9,18).map((s,i)=>scRowHtml(s,i+9,course,round,hSC)).join('')}
          <tr class="sc-total">
            <td class="sc-hole">In</td><td>${b9Par}</td>
            <td>${b9n?b9S:'—'}</td><td>${b9n?b9P:'—'}</td>
            <td style="text-align:center">${b9n?b9G+'/'+b9n:'—'}</td>
            <td style="text-align:center">${b9Fa?b9F+'/'+b9Fa:'—'}</td><td></td>
            ${isStblf2 ? `<td class="sc-pts" style="font-weight:700;color:#1e7a45">${b9n?b9Pts:'—'}</td>` : ''}
          </tr>
          <tr class="sc-total">
            <td class="sc-hole">Tot</td><td>${f9Par+b9Par}</td>
            <td>${f9n+b9n?(f9S+b9S):'—'}</td><td>${f9n+b9n?(f9P+b9P):'—'}</td>
            <td style="text-align:center">${f9n+b9n?(f9G+b9G)+'/'+(f9n+b9n):'—'}</td>
            <td style="text-align:center">${f9Fa+b9Fa?(f9F+b9F)+'/'+(f9Fa+b9Fa):'—'}</td><td></td>
            ${isStblf2 ? `<td class="sc-pts" style="font-weight:700;color:#1e7a45">${f9n+b9n?f9Pts+b9Pts:'—'}</td>` : ''}
          </tr>
        </tbody>
      </table>`;
      rdet.appendChild(scWrap);

      rrow.addEventListener('click', () => {
        const open = rdet.classList.toggle('open');
        document.getElementById(rowId + '-arr').textContent = open ? '▼' : '▶';
      });

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete round';
      delBtn.className   = 'rc-btn-delete';
      delBtn.type        = 'button';
      let delConfirm     = false;
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!delConfirm) {
          delConfirm = true;
          delBtn.textContent = 'Tap again to confirm delete';
          delBtn.style.background = '#c00';
          delBtn.style.color = '#fff';
          setTimeout(() => {
            delConfirm = false;
            delBtn.textContent = 'Delete round';
            delBtn.style.background = '';
            delBtn.style.color = '';
          }, 3000);
        } else {
          deleteRound(courseId, ri);
          renderSavedRounds();
        }
      });
      rdet.appendChild(delBtn);

      block.appendChild(rrow);
      block.appendChild(rdet);
    });

    section.appendChild(block);
  });

  const targetPane       = document.getElementById('mgSubRoundsHistory');
  const existingSection  = document.getElementById('savedRoundsSection');
  if (existingSection) existingSection.replaceWith(section);
  else if (targetPane) targetPane.appendChild(section);
}

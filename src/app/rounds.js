/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 2 — app — My Golf stats, rounds history, carry bars, sub-page navigation.
// No imports from src/ui/. Cross-layer UI calls use window.* reads (transitional).

import {
  loadCourses, loadRounds, deleteRound,
  loadBag, loadProfile, saveProfile,
} from '../storage/storage.js';
import { clubs } from '../engine/clubs.js';
import { interpolate, decodeStrategy } from '../engine/calculations.js';
import { renderCourseList } from './courses.js';

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
  if (id === 'mgSubStats') { renderMgStatTiles(); renderMgRecentRounds(); renderMgRoundsHistory(); }
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
    const curMode = p.scoringMode || 'advanced';
    function _updateModeDesc(m) {
      const d = document.getElementById('scoreModeDesc');
      if (d) d.textContent = m === 'simple'
        ? 'Total shots only. No putts, GIR or FIR.'
        : 'Shot sequence, putts, GIR & FIR tracking.';
    }
    document.querySelectorAll('.score-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === curMode);
      btn.addEventListener('click', () => {
        const prof = loadProfile();
        saveProfile({ ...prof, scoringMode: btn.dataset.mode });
        document.querySelectorAll('.score-mode-btn')
          .forEach(b => b.classList.toggle('active', b === btn));
        _updateModeDesc(btn.dataset.mode);
      });
    });
    _updateModeDesc(curMode);
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
  const allRounds = Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []);
  if (!allRounds.length) { el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>'; return; }
  const totalHoles   = allRounds.reduce((a, r) => a + (r.holesPlayed ?? 0), 0);
  const totalStrokes = allRounds.reduce((a, r) => a + (r.totalStrokes ?? 0), 0);
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
    if (!r.holesPlayed) return;
    const diff = (r.totalStrokes ?? 0) - (r.totalPar ?? 0);
    if (bestRound === null || diff < bestRound.diff) bestRound = { diff, r };
  });
  const bestVal    = bestRound !== null ? (bestRound.r.totalStrokes ?? '—') : '—';
  const fullRounds = allRounds.filter(r => (r.holesPlayed ?? 0) >= 18);
  const avgStrokes = fullRounds.length > 0 ? (fullRounds.reduce((a, r) => a + (r.totalStrokes ?? 0), 0) / fullRounds.length).toFixed(1) : '—';

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

// ── Score breakdown ───────────────────────────────────────────────────────────
export function renderMgScoreBreakdown() {
  const el = document.getElementById('mgBreakdownContent');
  if (!el) return;
  const courses   = loadCourses ? loadCourses() : {};
  const allRounds = Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []);
  if (!allRounds.length) {
    el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>';
    return;
  }

  let counts  = { hio: 0, albatross: 0, eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0 };
  let totalHoles = 0;
  let parData = { 3: { strokes: 0, holes: 0 }, 4: { strokes: 0, holes: 0 }, 5: { strokes: 0, holes: 0 } };

  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = loadRounds ? loadRounds(courseId) : [];
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
  const courseIds = Object.keys(courses).filter(id => (loadRounds ? loadRounds(id) : []).length > 0);
  if (!courseIds.length) {
    el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>';
    return;
  }
  el.innerHTML = courseIds.map(courseId => {
    const course    = courses[courseId];
    const rounds    = loadRounds ? loadRounds(courseId) : [];
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
  const allRounds = Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []);
  if (!allRounds.length) { el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>'; return; }

  let parData = { 3: { strokes: 0, holes: 0 }, 4: { strokes: 0, holes: 0 }, 5: { strokes: 0, holes: 0 } };
  let totalGIR = 0, totalHolesGIR = 0, totalPuttsOnGIR = 0;
  let totalPutts = 0, totalPuttsHoles = 0;

  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = loadRounds ? loadRounds(courseId) : [];
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
    const rounds = loadRounds ? loadRounds(courseId) : [];
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
  const allRounds = Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []);
  if (!allRounds.length) {
    el.innerHTML = '<div style="padding:12px;color:#aaa;font-size:15px;">No rounds saved yet.</div>';
    return;
  }

  let counts     = { 1: 0, 2: 0, 3: 0, more: 0 };
  let totalHoles = 0;
  Object.keys(courses).forEach(courseId => {
    const rounds = loadRounds ? loadRounds(courseId) : [];
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
      const diff    = (r.totalStrokes || 0) - (r.totalPar || 0);
      const diffStr = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : diff);
      const color   = diff < 0 ? '#1e7a45' : diff > 0 ? '#3a6fc4' : '#888';
      return '<div class="lrh-row"><div class="lrh-left"><div class="lrh-course">' + (r.courseName || '—') + '</div>' +
        '<div class="lrh-date">' + (r.date || '—') + '</div></div>' +
        '<div class="lrh-right"><div class="lrh-score">' + (r.totalStrokes || '—') + '</div>' +
        '<div class="lrh-diff" style="color:' + color + '">' + diffStr + '</div></div></div>';
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
    const rounds = loadRounds ? loadRounds(id) : [];
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
    const col    = d < 0 ? '#1e7a45' : d > 0 ? '#3a6fc4' : '#aaa';
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
  const trendCol   = trendDown ? '#1e7a45' : '#3a6fc4';
  const bestCol    = best < 0 ? '#1e7a45' : best > 0 ? '#3a6fc4' : '#aaa';
  const avgCol     = avg  < 0 ? '#1e7a45' : avg  > 0 ? '#3a6fc4' : '#aaa';

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

  function scRowHtml(s, i, course, round) {
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
    return `<tr>
      <td>${i + 1}</td>
      <td>${par}</td>
      <td><span class="score-pill ${spCls}">${total}</span></td>
      <td>${s.putts}</td>
      <td style="text-align:center">${girCell}</td>
      <td style="text-align:center">${firCell}</td>
      <td>${stratCell}</td>
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
      const rowId   = 'rh-' + courseId + '-' + ri;
      const diff    = (round.totalStrokes || 0) - (round.totalPar || 0);
      const diffStr = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : String(diff));
      const diffCls = diff < 0 ? 'under' : diff > 0 ? 'over' : 'even';
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
          <div class="round-score ${diffCls}">${diffStr}</div>
          <div class="round-arr" id="${rowId}-arr">▶</div>
        </div>`;

      const rdet = document.createElement('div');
      rdet.className = 'round-detail';
      rdet.id        = rowId + '-det';

      const statBar = document.createElement('div');
      statBar.className = 'round-stat-bar';
      statBar.innerHTML = `
        <div class="round-stat-cell"><div class="round-stat-val">${round.totalStrokes || '—'}</div><div class="round-stat-lbl">Score</div></div>
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

      const scWrap = document.createElement('div');
      scWrap.style.overflowX = 'auto';
      scWrap.innerHTML = `<table class="sc-table">
        <thead><tr><th>#</th><th>Par</th><th>Score</th><th>Putts</th><th>GIR</th><th>FIR</th><th>Strategy</th></tr></thead>
        <tbody>
          <tr class="sc-section"><td colspan="7">Front 9</td></tr>
          ${(round.scores||[]).slice(0,9).map((s,i)=>scRowHtml(s,i,course,round)).join('')}
          <tr class="sc-total">
            <td class="sc-hole">Out</td><td>${f9Par}</td>
            <td>${f9n?f9S:'—'}</td><td>${f9n?f9P:'—'}</td>
            <td style="text-align:center">${f9n?f9G+'/'+f9n:'—'}</td>
            <td style="text-align:center">${f9Fa?f9F+'/'+f9Fa:'—'}</td><td></td>
          </tr>
          <tr class="sc-section"><td colspan="7">Back 9</td></tr>
          ${(round.scores||[]).slice(9,18).map((s,i)=>scRowHtml(s,i+9,course,round)).join('')}
          <tr class="sc-total">
            <td class="sc-hole">In</td><td>${b9Par}</td>
            <td>${b9n?b9S:'—'}</td><td>${b9n?b9P:'—'}</td>
            <td style="text-align:center">${b9n?b9G+'/'+b9n:'—'}</td>
            <td style="text-align:center">${b9Fa?b9F+'/'+b9Fa:'—'}</td><td></td>
          </tr>
          <tr class="sc-total">
            <td class="sc-hole">Tot</td><td>${f9Par+b9Par}</td>
            <td>${f9n+b9n?(f9S+b9S):'—'}</td><td>${f9n+b9n?(f9P+b9P):'—'}</td>
            <td style="text-align:center">${f9n+b9n?(f9G+b9G)+'/'+(f9n+b9n):'—'}</td>
            <td style="text-align:center">${f9Fa+b9Fa?(f9F+b9F)+'/'+(f9Fa+b9Fa):'—'}</td><td></td>
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

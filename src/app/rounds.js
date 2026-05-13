/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 2 — app — My Golf stats, rounds history, carry bars, sub-page navigation.

import {
  loadCourses, loadRounds, deleteRound,
  loadBag, loadProfile, saveProfile,
  loadHomeRoundFilter, saveHomeRoundFilter,
  loadStatsRoundFilter, saveStatsRoundFilter,
  KEY_PRE_ROUND_FOCUS_IDX,
} from '../storage/storage.js';
import { clubs } from '../engine/clubs.js';
import { interpolate, decodeStrategy, courseHandicap, stablefordPoints, computeStrokeLoss } from '../engine/calculations.js';
import { renderCourseList, computeHoleStrokeCounts } from './courses.js';

// ── Services (injected by router.js) ─────────────────────────────────────────
let _switchTab = null;
let _openRoundDetail = null;
export function initRoundsServices(svc) {
  _switchTab       = svc.switchTab       ?? null;
  _openRoundDetail = svc.openRoundDetail ?? null;
}

// ── Pre-round focus prompt ─────────────────────────────────────────────────────
// Analyses last 5 rounds at this course and returns the single most important
// behavioural focus for the upcoming round, or null if no data / no clear issue.
export function computePreRoundFocus(courseId) {
  const courses = loadCourses ? loadCourses() : {};
  const course  = courses[courseId];
  const rounds  = loadRounds(courseId);
  if (!rounds.length || !course) return null;
  const recent = rounds.slice(-5);
  const n      = recent.length;

  // Aggregate stroke-loss and key stats across recent rounds
  const totals = { driving: 0, approach: 0, shortGame: 0, putting: 0, penalties: 0 };
  let validRounds = 0;
  let totalGIR = 0, totalFIR = 0, firEligHoles = 0, girHoles = 0;
  let totalPutts = 0, puttHoles = 0;

  recent.forEach(r => {
    if (!r.scores) return;
    const sl = computeStrokeLoss(r.scores, course.holes || []);
    if (!sl.holesPlayed) return;
    validRounds++;
    Object.keys(totals).forEach(k => { totals[k] += sl[k]; });
    r.scores.forEach((s, i) => {
      if (!s) return;
      const par = course.holes?.[i]?.par || 4;
      const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
      if (!total) return;
      girHoles++;
      if (s.gir === true) totalGIR++;
      if (par >= 4) { firEligHoles++; if (s.fir === true) totalFIR++; }
      if (s.putts != null) { totalPutts += s.putts; puttHoles++; }
    });
  });
  if (!validRounds) return null;

  const avgs     = {};
  Object.keys(totals).forEach(k => { avgs[k] = totals[k] / validRounds; });
  const girPct   = girHoles > 0 ? totalGIR / girHoles : null;
  const firPct   = firEligHoles > 0 ? totalFIR / firEligHoles : null;
  const avgPutts = puttHoles > 0 ? totalPutts / puttHoles : null;

  // ── Build the message pool for this round ────────────────────────────────
  const maxLeak = Math.max(...Object.values(avgs));
  let pool;

  if (maxLeak < 0.5) {
    // Everything under control — positive observation
    const strengthPool = [];
    if (girPct !== null && girPct > 0.55) {
      const pct = Math.round(girPct * 100);
      strengthPool.push(
        `Your approach game is working — GIR ${pct}% here. Keep attacking pins.`,
        `You're hitting greens at ${pct}% here. Trust your iron play and go at flags you can hold.`,
        `${pct}% GIR at this course. Your ball-striking is your edge today — use it.`,
      );
    }
    if (firPct !== null && firPct > 0.65) {
      const pct = Math.round(firPct * 100);
      strengthPool.push(
        `You're finding the fairway well here — ${pct}% FIR. That's your foundation today.`,
        `${pct}% fairways here. Off-the-tee accuracy is a real strength — commit to the same routine.`,
        `Driving has been reliable at this course (${pct}% FIR). Stay patient and let your irons do the work.`,
      );
    }
    if (avgPutts !== null && avgPutts < 1.75) {
      strengthPool.push(
        `Your putting has been excellent here. Trust your read and commit to each stroke.`,
        `You're rolling it well on these greens. Step up to every putt expecting to make it.`,
        `Fewer than ${avgPutts.toFixed(1)} putts per hole here. Your speed control is dialled in — stay aggressive on makeable putts.`,
      );
    }
    if (!strengthPool.length) return null;
    pool = strengthPool;
  } else {
    // Find the biggest leak
    const top = Object.entries(avgs)
      .filter(([, v]) => v >= 0.5)
      .sort(([, a], [, b]) => b - a)[0];
    if (!top) return null;

    const [key, val] = top;
    const perRound = '+' + val.toFixed(1) + ' stroke' + (val >= 1.5 ? 's' : '') + '/round';
    const suffix   = n > 1 ? ' over your last ' + n + ' rounds here' : ' last round here';

    const messages = {
      driving: [
        `Driving cost you ${perRound}${suffix}. Club down off the tee — a fairway bogey beats a rough double.`,
        `Off-the-tee errors have been costing ${perRound}${suffix}. Pick a smaller target and commit to it.`,
        `Your driver has been expensive here (${perRound}${suffix}). Consider a 3-wood or long iron on tight holes.`,
        `Tee shots are leaking ${perRound}${suffix}. Pick a club you can swing at 80% and put it in the short grass.`,
        `${perRound}${suffix} lost off the tee. Aim at the widest part of the fairway, not the shortest route to the pin.`,
        `Driving accuracy has been costing you here. Tee it down on par 4s if it helps you commit to a line.`,
        `The rough is punishing you at this course (${perRound}${suffix}). Play a club shorter and stay in control.`,
      ],
      approach: [
        `Approach play cost you ${perRound}${suffix}. Leave yourself a full wedge distance into greens — don't over-press.`,
        `Your approach shots have been leaking ${perRound}${suffix}. Aim for the center of the green, not the flag.`,
        `Missed greens are adding up (${perRound}${suffix}). Pick a conservative target and make clean contact.`,
        `Irons have been costing you here (${perRound}${suffix}). One club more, smooth swing, middle of the green.`,
        `${perRound}${suffix} lost on approaches. Short-siding yourself is costly — take the fat side of every pin.`,
        `Approach play is your biggest leak today (${perRound}${suffix}). Commit to your yardage and don't second-guess mid-swing.`,
        `Green misses are adding up (${perRound}${suffix}). Play to your yardage gaps — don't try to hit a club you can't fully commit to.`,
      ],
      shortGame: [
        `Short game cost you ${perRound}${suffix}. Focus on getting chips close — one putt saves the hole.`,
        `Around the green you've been losing ${perRound}${suffix}. Land the chip on the green early and let it roll.`,
        `Scrambling has been tough here (${perRound}${suffix}). Bump-and-run over lob — take the lower-risk shot.`,
        `Short game is the focus today (${perRound}${suffix}). Pick your landing spot before you pick your club.`,
        `${perRound}${suffix} lost around the greens. Get it on the putting surface first — don't try to hero the flop.`,
        `Chipping has been costing you here (${perRound}${suffix}). Use the most loft you need and no more — less spin, more predictable.`,
        `Scrambling rate has been low (${perRound}${suffix}). When you miss a green, commit to a safe chip and rely on your putter.`,
      ],
      putting: [
        `Putting cost you ${perRound}${suffix}. Lag from distance — your main goal is to avoid the three-putt.`,
        `You've been leaving strokes on the greens here (${perRound}${suffix}). Read the break early and commit to speed.`,
        `Three-putts are adding up (${perRound}${suffix}). On long putts, aim for a two-foot circle — not the hole.`,
        `Greens have been tough here (${perRound}${suffix}). Walk the full line before you putt — don't rush the read.`,
        `${perRound}${suffix} on the greens. Speed control is the priority today — distance first, line second.`,
        `Putting is your biggest leak at this course (${perRound}${suffix}). Get your first putt within tap-in range and move on.`,
        `The greens here have been costly (${perRound}${suffix}). Focus on your pre-putt routine — same process every time.`,
      ],
      penalties: [
        `Penalties cost you ${perRound}${suffix}. Play well away from trouble today — a bogey beats a double every time.`,
        `Risky shots have backfired here (${perRound}${suffix}). If it's not a comfortable carry, lay up.`,
        `Penalty strokes are expensive (${perRound}${suffix}). Add an imaginary penalty stroke before each risky shot — does it still make sense?`,
        `You've been losing ${perRound}${suffix} to penalty areas here. Know the safe bailout on every hole before you tee off.`,
        `${perRound}${suffix} in penalties. Today's goal: no doubles. Take the conservative line and let your short game rescue par.`,
        `Out-of-bounds and water have been costly here (${perRound}${suffix}). Tee up further from the trouble side and swing free.`,
        `Penalty areas are punishing you (${perRound}${suffix}). If the aggressive line requires perfection, it's not the right line.`,
      ],
    };
    pool = messages[key];
  }

  // Advance a per-category-neutral index in localStorage so each round start shows the next variant
  const stored  = parseInt(localStorage.getItem(KEY_PRE_ROUND_FOCUS_IDX) ?? '0', 10);
  const nextIdx = (stored + 1) % pool.length;
  localStorage.setItem(KEY_PRE_ROUND_FOCUS_IDX, nextIdx);
  return pool[nextIdx];
}

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
  window.scrollTo({ top: 0, behavior: 'instant' });
  const pane = document.getElementById('panePrepare');
  if (pane) pane.scrollTop = 0;
  if (id === 'mgSubStats') { renderMgStatsPage(); renderMgStatTiles(); }
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
  window.scrollTo({ top: 0, behavior: 'instant' });
  refreshMgHub();
}

export function navigateToRound(courseId, roundIdx) {
  if (_switchTab) _switchTab('prepare');
  _openRoundDetail?.(courseId, roundIdx);
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
  if (!allRounds.length) {
    const previewTiles = ['Rounds','Best score','Avg strokes','Putts / round','Scrambling','PAR%'];
    el.innerHTML =
      `<div class="stats-preview-note">Play a round to unlock your stats</div>` +
      previewTiles.map(lbl =>
        `<div class="mg-stat-tile stats-tile-preview"><div class="mg-stat-val">—</div><div class="mg-stat-lbl">${lbl}</div></div>`
      ).join('');
    return;
  }

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

  // Scrambling and PAR% — computed from raw hole scores
  let _scrambOpp = 0, _scrambMade = 0;
  let _parOrBetter = 0, _holesWithPar = 0;
  allRounds.forEach(r => {
    const course = courses[r._courseId];
    (r.scores || []).forEach((s, i) => {
      if (!s) return;
      const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
      if (!total) return;
      if (s.gir === false && s.putts != null && s.putts > 0) { _scrambOpp++; if (s.putts === 1) _scrambMade++; }
      if (course) {
        const par = course.holes[i]?.par || 4;
        _holesWithPar++;
        if (total <= par) _parOrBetter++;
      }
    });
  });
  const scrambPctAll = _scrambOpp > 0 ? Math.round(_scrambMade / _scrambOpp * 100) + '%' : '—';
  const parPctAll    = _holesWithPar > 0 ? Math.round(_parOrBetter / _holesWithPar * 100) + '%' : '—';

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
    { lbl: 'Scrambling',   val: scrambPctAll,      tappable: false },
    { lbl: 'PAR%',         val: parPctAll,         tappable: false },
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
    renderMgScoreBreakdown(); renderMgAvgStrokesBreakdown(); renderMgPuttsBreakdown();
    showMgSub('mgSubScoring');
  });
  document.getElementById('mgAvgStrokesTile')?.addEventListener('click', () => {
    renderMgScoreBreakdown(); renderMgAvgStrokesBreakdown(); renderMgPuttsBreakdown();
    showMgSub('mgSubScoring');
  });
  document.getElementById('mgPuttsTile')?.addEventListener('click', () => {
    renderMgScoreBreakdown(); renderMgAvgStrokesBreakdown(); renderMgPuttsBreakdown();
    showMgSub('mgSubScoring');
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
    emptyEl.innerHTML =
      `<div class="stats-preview-card">` +
        `<div class="stats-preview-header">` +
          `<span class="stats-preview-title">Score history</span>` +
          `<div class="stats-preview-chips"><span class="stats-preview-chip">18H</span><span class="stats-preview-chip">9H</span><span class="stats-preview-chip">ALL</span></div>` +
        `</div>` +
        `<div class="stats-preview-chart"></div>` +
        `<div class="stats-preview-strip">` +
          `<div class="stats-preview-strip-item"><div class="stats-preview-val">—</div><div class="stats-preview-lbl">Rounds</div></div>` +
          `<div class="stats-preview-strip-item"><div class="stats-preview-val">—</div><div class="stats-preview-lbl">Best</div></div>` +
          `<div class="stats-preview-strip-item"><div class="stats-preview-val">—</div><div class="stats-preview-lbl">Avg</div></div>` +
          `<div class="stats-preview-strip-item"><div class="stats-preview-val">—</div><div class="stats-preview-lbl">Trend</div></div>` +
        `</div>` +
      `</div>` +
      `<p class="stats-preview-cta">Play a round to unlock your stats</p>`;
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
  const trendArrow = trendDown ? '↘' : '↗';
  const trendLbl   = trendDown ? 'Improving' : 'Worsening';
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
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val" style="color:${trendCol};">${trendArrow}</div><div class="mg-chart-strip-lbl">${trendLbl}</div></div>` +
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
    `<div class="home-stat-tile tappable" data-nav="avgStrokes"><div class="home-stat-val">${girPct}%</div><div class="home-stat-lbl">GIR</div></div>` +
    `<div class="home-stat-tile tappable" data-nav="putts"><div class="home-stat-val">${puttsPerHole}</div><div class="home-stat-lbl">Putts/hole</div></div>` +
    `<div class="home-stat-tile tappable" data-nav="stats"><div class="home-stat-val" style="color:${avgVsParCol};">${avgVsParStr}</div><div class="home-stat-lbl">vs par avg</div></div>`;

  el.querySelectorAll('.home-stat-tile.tappable').forEach(tile => {
    tile.addEventListener('click', () => {
      if (!_switchTab) return;
      const nav = tile.dataset.nav;
      _switchTab('prepare');
      if (nav === 'avgStrokes') { renderMgScoreBreakdown(); renderMgAvgStrokesBreakdown(); renderMgPuttsBreakdown(); showMgSub('mgSubScoring'); }
      else if (nav === 'putts') { renderMgScoreBreakdown(); renderMgAvgStrokesBreakdown(); renderMgPuttsBreakdown(); showMgSub('mgSubScoring'); }
      else if (nav === 'stats') { showMgSub('mgSubStats'); }
    });
  });
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
    const allForCourse = loadRounds ? loadRounds(id) : [];
    filterRounds(allForCourse, _homeFilter).forEach(r => {
      all.push({ ...r, courseName: courses[id].name, _courseId: id, _roundIdx: allForCourse.indexOf(r) });
    });
  });
  all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const shown = all.slice(0, 3);

  if (!shown.length) { el.innerHTML = ''; return; }

  el.innerHTML = shown.map(r => {
    const diff    = (r.totalStrokes || 0) - (r.totalPar || 0);
    const diffStr = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : diff);
    const color   = diff < 0 ? '#c0392b' : '#1a1a1a';
    return '<div class="lrh-row tappable" data-course-id="' + escHtml(r._courseId) + '" data-round-idx="' + r._roundIdx + '">' +
      '<div class="lrh-left"><div class="lrh-course">' + (r.courseName || '—') + '</div>' +
      '<div class="lrh-date">' + (r.date || '—') + '</div></div>' +
      '<div class="lrh-right"><div class="lrh-score">' + (r.totalStrokes || '—') + '</div>' +
      '<div class="lrh-diff" style="color:' + color + '">' + diffStr + '</div></div></div>';
  }).join('');

  el.querySelectorAll('.lrh-row.tappable').forEach(row => {
    row.addEventListener('click', () => {
      navigateToRound(row.dataset.courseId, parseInt(row.dataset.roundIdx, 10));
    });
  });
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
  // Par type sub (used for Scoring & Putting drilldown)
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

  // Baseline sub
  const baselineSub = document.getElementById('mgDrillBaselineSub');
  if (baselineSub) {
    const n = Object.keys(courses).filter(id => filterRounds(loadRounds ? loadRounds(id) : [], _statsFilter).length > 0).length;
    baselineSub.textContent = n
      ? n + ' course' + (n !== 1 ? 's' : '') + ' · hole-by-hole avg vs par'
      : 'No rounds yet';
  }

  // Stroke-loss sub
  const slSub = document.getElementById('mgDrillStrokeLossSub');
  if (slSub) {
    const slData = _buildStrokeLossStats(courses, _statsFilter);
    if (slData) {
      const top = Object.entries(slData.avgs)
        .map(([k, v]) => ({ key: k, avg: v }))
        .filter(e => e.avg > 0.01)
        .sort((a, b) => b.avg - a.avg)[0];
      slSub.textContent = top
        ? 'Biggest leak: ' + _SL_LABELS[top.key] + ' · +' + top.avg.toFixed(1) + '/round'
        : 'No over-par strokes recorded';
    } else {
      slSub.textContent = 'No rounds saved yet';
    }
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
  wire('mgStatsGotoParType',    () => { renderMgScoreBreakdown(); renderMgAvgStrokesBreakdown(); renderMgPuttsBreakdown(); showMgSub('mgSubScoring'); });
  wire('mgStatsGotoBaseline',   () => { renderMgBaseline();            showMgSub('mgSubBaseline'); });
  wire('mgStatsGotoStrokeLoss', () => { renderMgStrokeLossBreakdown(); renderMgStrategyBreakdown(); showMgSub('mgSubStrokeAnalysis'); });
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
      const avgDiff  = (h.strokes - h.par) / h.count;
      const cls      = avgDiff < -0.05 ? 'under' : avgDiff < 0.05 ? 'even' : avgDiff < 1.05 ? 'over1' : avgDiff < 2.05 ? 'over2' : 'over3';
      const diffStr  = avgDiff < -0.05 ? (avgDiff.toFixed(1)) : avgDiff < 0.05 ? 'E' : '+' + avgDiff.toFixed(1);
      const lowCls   = h.count < 3 ? ' low-sample' : '';
      return '<div class="mg-baseline-cell"><span class="mg-baseline-num">' + (i+1) + '</span>' +
        '<div class="mg-baseline-dot ' + cls + lowCls + '">' +
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

// ── Stroke-loss breakdown (My Stats) ─────────────────────────────────────────
const _SL_LABELS = { driving: 'Driving', approach: 'Approach', shortGame: 'Short game', putting: 'Putting', penalties: 'Penalties' };
const _SL_DESC   = {
  driving:   'Over-par strokes on holes where you missed the fairway (par 4/5).',
  approach:  'Over-par strokes on holes where you missed the green.',
  shortGame: 'Over-par strokes on missed greens where you needed 2+ putts to finish.',
  putting:   'Extra putts above a two-putt standard across all holes.',
  penalties: 'Direct penalty strokes added to your score.',
};

function _buildStrokeLossStats(courses, statsFilter) {
  const totals = { driving: 0, approach: 0, shortGame: 0, putting: 0, penalties: 0 };
  let roundCount = 0;
  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], statsFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      const sl = computeStrokeLoss(round.scores, course.holes || []);
      if (!sl.holesPlayed) return;
      roundCount++;
      Object.keys(totals).forEach(k => { totals[k] += sl[k]; });
    });
  });
  if (!roundCount) return null;
  const avgs = {};
  Object.keys(totals).forEach(k => { avgs[k] = totals[k] / roundCount; });
  return { avgs, roundCount };
}

export function renderMgStrokeLossBreakdown() {
  const el = document.getElementById('mgStrokeLossContent');
  if (!el) return;
  const courses = loadCourses ? loadCourses() : {};
  const data    = _buildStrokeLossStats(courses, _statsFilter);

  if (!data) {
    el.innerHTML = '<div class="mg-breakdown-card"><div style="padding:12px 0 4px;color:#aaa;font-size:15px;">No rounds saved yet.</div></div>';
    return;
  }

  const { avgs, roundCount } = data;
  const sorted = Object.entries(_SL_LABELS)
    .map(([k, lbl]) => ({ key: k, lbl, avg: avgs[k] }))
    .filter(e => e.avg > 0.01)
    .sort((a, b) => b.avg - a.avg);

  if (!sorted.length) {
    el.innerHTML = '<div class="mg-breakdown-card"><div style="padding:12px 0 4px;color:#aaa;font-size:15px;">No over-par strokes recorded — keep it up!</div></div>';
    return;
  }

  const maxVal = sorted[0].avg;
  const rows = sorted.map((e, idx) => {
    const pct      = Math.round((e.avg / maxVal) * 100);
    const topCls   = idx === 0 ? ' sl-row--top' : '';
    const valColor = idx === 0 ? '#c0392b' : '#1a1a1a';
    return '<div class="sl-stat-row' + topCls + '">' +
      '<div class="sl-stat-header">' +
        '<span class="sl-stat-lbl">' + e.lbl + '</span>' +
        '<span class="sl-stat-val" style="color:' + valColor + '">+' + e.avg.toFixed(2) + '/round</span>' +
      '</div>' +
      '<div class="sl-bar-track"><div class="sl-bar-fill' + (idx === 0 ? ' sl-bar-fill--top' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="sl-stat-desc">' + _SL_DESC[e.key] + '</div>' +
    '</div>';
  }).join('');

  el.innerHTML =
    '<div class="mg-breakdown-card">' +
      '<div class="mg-breakdown-title">Avg stroke loss · per round · ' + roundCount + ' round' + (roundCount !== 1 ? 's' : '') + '</div>' +
      '<div style="padding:8px 14px 12px;display:flex;flex-direction:column;gap:12px;">' + rows + '</div>' +
    '</div>';
}

// ── Strategy breakdown ────────────────────────────────────────────────────────
function _stratTagClass(type) {
  if (!type) return 'safe';
  if (type === 'Max distance' || type === 'Aggressive' || type === 'Long') return 'aggressive';
  if (type === 'Controlled'   || type === 'Balanced'   || type === 'Medium') return 'balanced';
  return 'safe';
}

function _buildStrategyStats(courses, statsFilter) {
  const byPar45 = {};
  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], statsFilter);
    rounds.forEach(round => {
      if (!round.scores || !round.strategies) return;
      round.scores.forEach((s, i) => {
        if (!s) return;
        const par   = course.holes?.[i]?.par || 4;
        const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
        if (!total || par <= 3) return;
        const strat = round.strategies[i];
        if (!strat) return;
        const { type } = decodeStrategy(strat);
        const key = type || strat;
        if (!byPar45[key]) byPar45[key] = { totalDiff: 0, count: 0 };
        byPar45[key].totalDiff += total - par;
        byPar45[key].count++;
      });
    });
  });
  const par45 = Object.entries(byPar45)
    .map(([type, d]) => ({ type, avg: d.totalDiff / d.count, count: d.count }))
    .filter(d => d.count >= 3)
    .sort((a, b) => a.avg - b.avg);
  return { par45 };
}

export function renderMgStrategyBreakdown() {
  const el = document.getElementById('mgStrategyContent');
  if (!el) return;
  const courses = loadCourses ? loadCourses() : {};
  const { par45 } = _buildStrategyStats(courses, _statsFilter);

  if (!par45.length) {
    el.innerHTML = '<div class="mg-breakdown-card"><div style="padding:12px 0 4px;color:#aaa;font-size:15px;">No strategy data yet.<br>Use the shot planner during your rounds to see which approach works best for you.</div></div>';
    return;
  }

  const hdrHtml =
    '<div class="strat-table-header">' +
      '<span style="flex:1;font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.4px">Strategy</span>' +
      '<span class="strat-row-count" style="font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.4px">Holes</span>' +
      '<span class="strat-row-avg" style="font-size:13px;color:#aaa;font-weight:600;text-transform:uppercase;letter-spacing:0.4px">Avg</span>' +
    '</div>';

  const par45Html = par45.map((d, idx) => {
    const avgStr   = Math.abs(d.avg) < 0.05 ? 'E' : (d.avg > 0 ? '+' : '') + d.avg.toFixed(2);
    const avgColor = d.avg < -0.05 ? '#c0392b' : '#1a1a1a';
    const tagClass = _stratTagClass(d.type);
    const medal    = idx === 0 ? ' strat-row--best' : '';
    return '<div class="strat-row' + medal + '">' +
      '<span class="hint-best-tag ' + tagClass + '"><span class="hint-best-dot"></span>' + d.type + '</span>' +
      '<span class="strat-row-count">' + d.count + ' hole' + (d.count !== 1 ? 's' : '') + '</span>' +
      '<span class="strat-row-avg" style="color:' + avgColor + '">' + avgStr + '</span>' +
    '</div>';
  }).join('');

  el.innerHTML =
    '<div class="mg-breakdown-card">' +
      '<div class="mg-breakdown-title">Strategy vs outcome · all rounds</div>' +
      hdrHtml +
      par45Html +
      '<div style="padding:10px 14px 4px;font-size:12px;color:#aaa;">Lower avg vs par is better. Min. 3 holes per strategy shown.</div>' +
    '</div>';
}

// ── Avg strokes breakdown (GIR + FIR) ─────────────────────────────────────────
export function renderMgAvgStrokesBreakdown() {
  const el = document.getElementById('mgAvgStrokesContent');
  if (!el) return;
  const courses   = loadCourses ? loadCourses() : {};
  const allRounds = filterRounds(Object.keys(courses).flatMap(id => loadRounds ? loadRounds(id) : []), _statsFilter);
  if (!allRounds.length) { el.innerHTML = ''; return; }

  let totalGIR = 0, totalHolesGIR = 0;
  Object.keys(courses).forEach(courseId => {
    const course = courses[courseId];
    const rounds = filterRounds(loadRounds ? loadRounds(courseId) : [], _statsFilter);
    rounds.forEach(round => {
      if (!round.scores) return;
      round.scores.forEach((s, i) => {
        if (!s) return;
        const total = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
        if (!total) return;
        totalHolesGIR++;
        if (s.gir) totalGIR++;
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

  const girPct      = totalHolesGIR > 0 ? Math.round(totalGIR / totalHolesGIR * 100) : 0;
  const girPerRound = allRounds.length > 0 ? (totalGIR / allRounds.length).toFixed(1) : '—';
  const firPct      = totalFIRHoles > 0 ? Math.round(totalFIR / totalFIRHoles * 100) : 0;
  const firPerRound = allRounds.length > 0 ? (totalFIR / allRounds.length).toFixed(1) : '—';

  el.innerHTML =
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">GIR · Greens in regulation</div>' +
    '<div style="display:flex;align-items:center;gap:14px;padding:9px 14px;">' +
    '<div style="font-size:28px;font-weight:700;color:#1a1a1a;">' + girPct + '%</div>' +
    '<div style="flex:1;height:8px;background:#ede9e3;border-radius:4px;overflow:hidden;">' +
    '<div style="width:' + girPct + '%;height:100%;background:#555;border-radius:4px;"></div></div></div>' +
    '<div style="font-size:12px;color:#aaa;padding:0 14px 10px;">' + girPerRound + ' of 18 greens hit per round</div>' +
    '</div>' +
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">FIR · Fairways in regulation</div>' +
    '<div style="display:flex;align-items:center;gap:14px;padding:9px 14px;">' +
    '<div style="font-size:28px;font-weight:700;color:#1a1a1a;">' + firPct + '%</div>' +
    '<div style="flex:1;height:8px;background:#ede9e3;border-radius:4px;overflow:hidden;">' +
    '<div style="width:' + firPct + '%;height:100%;background:#555;border-radius:4px;"></div></div></div>' +
    '<div style="font-size:12px;color:#aaa;padding:0 14px 10px;">' + firPerRound + ' of par 4/5 fairways hit per round</div>' +
    '</div>';
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

  let counts = { 1: 0, 2: 0, 3: 0, more: 0 };
  let totalHoles = 0;
  let totalGIR = 0, totalPuttsOnGIR = 0;
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
        if (s.gir) { totalGIR++; totalPuttsOnGIR += p; }
      });
    });
  });

  const fullRounds    = allRounds.filter(r => (r.holesPlayed ?? 0) >= 18);
  const avgPuttsRound = fullRounds.length > 0
    ? (fullRounds.reduce((a, r) => a + (r.totalPutts ?? (r.scores||[]).reduce((x,sc)=>x+(sc?.putts||0),0)), 0) / fullRounds.length).toFixed(1)
    : '—';
  const avgPuttsGIR   = totalGIR > 0 ? (totalPuttsOnGIR / totalGIR).toFixed(1) : '—';
  const avgPutts      = totalHoles > 0
    ? (Object.entries(counts).reduce((a, [k, v]) => a + (k === 'more' ? 4 : +k) * v, 0) / totalHoles).toFixed(2)
    : '—';

  const rows = [
    { label: '1 putt',   key: '1',    color: '#1e7a45' },
    { label: '2 putts',  key: '2',    color: '#888' },
    { label: '3 putts',  key: '3',    color: '#c07820' },
    { label: '3+ putts', key: 'more', color: '#c0392b' },
  ];
  const maxCount = Math.max(...rows.map(r => counts[r.key]), 1);

  el.innerHTML =
    '<div class="mg-breakdown-card"><div class="mg-breakdown-title">Putting</div>' +
    '<div class="mg-breakdown-row" style="border-bottom:0.5px solid #f2f1ee;padding-bottom:8px;margin-bottom:8px;">' +
    '<div class="mg-breakdown-label">Putts per round</div>' +
    '<div class="mg-breakdown-val">' + avgPuttsRound + '</div></div>' +
    '<div class="mg-breakdown-row">' +
    '<div class="mg-breakdown-label">Putts per GIR hole</div>' +
    '<div class="mg-breakdown-val">' + avgPuttsGIR + '</div></div>' +
    '</div>' +
    '<div class="mg-breakdown-card">' +
    '<div class="mg-breakdown-title">Putt distribution · ' + totalHoles + ' holes · avg ' + avgPutts + '</div>' +
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
  <text x="2" y="${(parseFloat(avgY) - 3).toFixed(1)}" font-size="11" fill="#ccc" font-family="system-ui" font-weight="600">avg</text>`;
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
  const trendArrow = trendDown ? '↘' : '↗';
  const trendLbl   = trendDown ? 'Improving' : 'Worsening';
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
    `<div class="mg-chart-strip-item"><div class="mg-chart-strip-val" style="color:${trendCol};">${trendArrow}</div><div class="mg-chart-strip-lbl">${trendLbl}</div></div>` +
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

  // Collect all rounds from all courses into a flat list
  const allEntries = [];
  courseIds.forEach(courseId => {
    const rounds = loadRounds ? loadRounds(courseId) : [];
    const course = courses[courseId];
    rounds.forEach((round, roundIdx) => {
      allEntries.push({ courseId, roundIdx, round, course });
    });
  });
  if (!allEntries.length) return;

  // Sort newest first by date string (YYYY-MM-DD lexicographic)
  allEntries.sort((a, b) => (b.round.date || '').localeCompare(a.round.date || ''));

  // Group by year → month
  const byYear = new Map();
  allEntries.forEach(entry => {
    const d = entry.round.date || '';
    const year  = d.slice(0, 4) || '—';
    const month = d.length >= 7 ? parseInt(d.slice(5, 7), 10) - 1 : -1;
    if (!byYear.has(year)) byYear.set(year, new Map());
    const byMonth = byYear.get(year);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(entry);
  });

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];

  const section = document.createElement('div');
  section.id = 'savedRoundsSection';
  section.style.paddingBottom = '16px';

  // Render years descending
  Array.from(byYear.keys()).sort((a, b) => b.localeCompare(a)).forEach(year => {
    const byMonth = byYear.get(year);
    const yearBodyId = 'rh-year-body-' + year;

    // Year separator header
    const yearSep = document.createElement('div');
    yearSep.className = 'rh-year-sep';
    yearSep.innerHTML = `<span class="rh-year-label">${escHtml(year)}</span><span class="rh-year-arr" id="rh-year-arr-${year}">▼</span>`;
    section.appendChild(yearSep);

    const yearBody = document.createElement('div');
    yearBody.className = 'rh-year-body';
    yearBody.id = yearBodyId;

    yearSep.addEventListener('click', () => {
      const collapsed = yearBody.classList.toggle('rh-year-collapsed');
      document.getElementById('rh-year-arr-' + year).textContent = collapsed ? '▶' : '▼';
    });

    // Render months descending
    Array.from(byMonth.keys()).sort((a, b) => b - a).forEach(monthIdx => {
      const entries = byMonth.get(monthIdx);
      const monthName = monthIdx >= 0 ? MONTH_NAMES[monthIdx] : '—';

      const monthHdr = document.createElement('div');
      monthHdr.className = 'rh-month-hdr';
      monthHdr.textContent = monthName;
      yearBody.appendChild(monthHdr);

      entries.forEach(({ courseId, roundIdx, round, course }) => {
        const isStblf    = round.gameFormat === 'stableford' || (((round.totalPoints ?? 0) > 0) && !round.gameFormat);
        const gross      = (round.totalStrokes || 0) - (round.totalPar || 0);
        // Use hcpTotal saved at round time — frozen, not affected by later handicap changes
        const savedHcp   = round.hcpTotal ?? 0;
        const netDiff    = savedHcp > 0 ? gross - savedHcp : null;
        const diff       = netDiff !== null ? netDiff : gross;
        const diffStr    = diff === 0 ? 'E' : (diff > 0 ? '+' + diff : String(diff));
        const diffCls    = diff < 0 ? 'under' : '';
        const displayStr = diffStr;
        const displayCls = diffCls;

        const rPutts     = round.totalPutts ?? (round.scores||[]).reduce((a,s)=>a+(s?.putts||0),0);
        const rGIR       = round.totalGIR   ?? (round.scores||[]).filter(s=>s?.gir).length;
        const rFIR       = (round.scores||[]).filter(s=>s?.fir===true).length;
        const holesP     = round.holesPlayed || 0;
        const firEligR   = (round.scores||[]).filter((s, i) => s != null && (course.holes?.[i]?.par ?? 4) >= 4).length;
        const girPctR    = holesP > 0 ? Math.round(rGIR / holesP * 100) : 0;
        const firPctR    = firEligR > 0 ? Math.round(rFIR / firEligR * 100) : 0;

        const day       = (round.date || '').slice(8, 10).replace(/^0/, '') || '—';
        const shortMon  = monthIdx >= 0 ? MONTH_NAMES[monthIdx].slice(0, 3) : '';
        const tee       = course.teeName ? ' · ' + escHtml(course.teeName) : '';
        const primaryText = escHtml(day + (shortMon ? ' ' + shortMon : '')) + ', ' + escHtml(course.name || '—') + tee;

        const row = document.createElement('div');
        row.className = 'rh-round-row';
        row.innerHTML = `
          <div class="rh-round-left">
            <div class="rh-round-primary">${primaryText}</div>
            <div class="rh-round-meta">${holesP}H · ${rPutts} putts · GIR ${girPctR}% · FIR ${firPctR}%</div>
          </div>
          <div class="rh-round-score ${displayCls}">${displayStr}</div>`;

        row.addEventListener('click', () => _openRoundDetail?.(courseId, roundIdx));
        yearBody.appendChild(row);
      });
    });

    section.appendChild(yearBody);
  });

  const targetPane      = document.getElementById('mgSubRoundsHistory');
  const existingSection = document.getElementById('savedRoundsSection');
  if (existingSection) existingSection.replaceWith(section);
  else if (targetPane) targetPane.appendChild(section);
}

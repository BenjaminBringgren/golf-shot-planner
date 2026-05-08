/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 2 — app — course CRUD, course editor, personal baseline.

import {
  loadCourses, saveCourses,
  loadRounds, deleteAllRoundsForCourse,
  loadScores, saveActiveCourse, loadProfile,
  saveInProgressRound,
} from '../storage/storage.js';
import { courseHandicap } from '../engine/calculations.js';

let _svc = {};
export function initServices(svc) { _svc = svc; }

// ── Per-hole WHS stroke counts ─────────────────────────────────────────────────
// Returns array[18] where each entry = number of extra strokes received on that hole.
// Returns all-zeros when profile HCP, course slope/rating, or SI data is missing/invalid.
export function computeHoleStrokeCounts(courseId) {
  const courses  = loadCourses();
  const c        = courses[courseId];
  const prof     = loadProfile();
  const hcpIdx   = parseFloat(prof?.handicap);
  const slope    = parseInt(c?.slopeRating);
  const rating   = parseFloat(c?.courseRating);
  const totalPar = (c?.holes || []).reduce((a, h) => a + (h.par || 4), 0);
  const allSI    = (c?.holes || []).map(h => h.si || 0);
  const siOk     = allSI.length === 18 && allSI.every(si => si >= 1 && si <= 18);
  const counts   = new Array(18).fill(0);
  if (!isNaN(hcpIdx) && hcpIdx > 0 && slope > 0 && rating > 0 && siOk) {
    const ch   = courseHandicap(hcpIdx, slope, rating, totalPar);
    const full = Math.floor(ch / 18);
    const rem  = ch % 18;
    allSI.forEach((si, i) => { counts[i] = full + (si <= rem ? 1 : 0); });
  }
  return counts;
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function newCourseId() {
  const existing = Object.keys(loadCourses());
  let id;
  do {
    id = String(Math.floor(10000 + Math.random() * 90000));
  } while (existing.includes(id));
  return id;
}

// ── Personal baseline helpers ─────────────────────────────────────────────────
export function computeHoleBaseline(courseId, holeIdx) {
  const rounds  = loadRounds(courseId);
  const courses = loadCourses();
  const par     = courses[courseId]?.holes?.[holeIdx]?.par || 4;
  const data    = rounds.reduce((acc, r) => {
    const s = r.scores?.[holeIdx];
    if (!s) return acc;
    const strokes = (s.fairway || 0) + (s.rough || 0) + (s.putts || 0);
    if (!strokes) return acc;
    acc.total += strokes;
    acc.count++;
    return acc;
  }, { total: 0, count: 0 });
  if (data.count < 3) return null;
  const avgScore = data.total / data.count;
  return { avgScore, avgDiff: avgScore - par, rounds: data.count, par };
}

export function blendedScore(modelScore, courseId, holeIdx) {
  const bl = computeHoleBaseline(courseId, holeIdx);
  if (!bl) return { score: modelScore, blended: false };
  const weight = Math.min(1, (bl.rounds - 3) / 7);
  const score  = modelScore * (1 - weight) + bl.avgScore * weight;
  return { score, blended: true, rounds: bl.rounds, weight };
}

// ── Navigation helpers ────────────────────────────────────────────────────────
export function applyHoleToPlay(course, holeIdx) {
  const hole = course.holes[holeIdx];
  if (!hole) return;
  document.getElementById('holeLength').value = hole.length || '';
  const parSel = document.getElementById('parSelect');
  if (hole.par >= 3 && hole.par <= 5) {
    parSel.value = String(hole.par);
    _svc.syncChipRow?.('parChipRow', 'parSelect');
  }
}

export function loadCourseIntoPlay(id, gameFormat = 'strokes', hcpEnabled = true) {
  const courses = loadCourses();
  const c = courses[id];
  if (!c) return;
  saveActiveCourse(id, 0, gameFormat, hcpEnabled);
  saveInProgressRound(id, gameFormat, hcpEnabled);
  applyHoleToPlay(c, 0);
  _svc.switchTab?.('play');
  _svc.renderPlayCourseBar?.(id);
  _svc.updateCalcButtonVisibility?.();
  const scores = loadScores(id);
  _svc.renderScoreEntry?.(id, 0, scores);
  _svc.showPreRoundFocus?.(id);
  setTimeout(() => _svc.calculate?.(), 0);
}

export function resumeRoundInPlay(courseId, startHoleIdx, gameFormat = 'strokes', hcpEnabled = true) {
  const courses = loadCourses();
  const c = courses[courseId];
  if (!c) return;
  saveActiveCourse(courseId, startHoleIdx, gameFormat, hcpEnabled);
  applyHoleToPlay(c, startHoleIdx);
  _svc.switchTab?.('play');
  _svc.renderPlayCourseBar?.(courseId);
  _svc.updateCalcButtonVisibility?.();
  const scores = loadScores(courseId);
  _svc.renderScoreEntry?.(courseId, startHoleIdx, scores);
  setTimeout(() => _svc.calculate?.(), 0);
}

// ── Course CRUD ───────────────────────────────────────────────────────────────
export function deleteCourse(id) {
  if (!confirm('Delete this course?')) return;
  const courses = loadCourses();
  delete courses[id];
  saveCourses(courses);
  deleteAllRoundsForCourse(id);
  if (document.getElementById('courseEditor').dataset.editingId === id) {
    document.getElementById('courseEditor').style.display = 'none';
  }
  renderCourseList();
}

// ── Tee grouping ──────────────────────────────────────────────────────────────

function _groupCourses(id1, id2, groupName, teeName1, teeName2) {
  const courses = loadCourses();
  const groupId = newCourseId();
  courses[id1] = { ...courses[id1], groupId, groupName, teeName: teeName1 };
  courses[id2] = { ...courses[id2], groupId, groupName, teeName: teeName2 };
  saveCourses(courses);
  renderCourseList();
}

function _ungroupCourse(id) {
  const courses = loadCourses();
  if (!courses[id]) return;
  const { groupId, groupName, teeName, ...rest } = courses[id];
  courses[id] = rest;
  saveCourses(courses);
  renderCourseList();
}

function _renderTeeGroupSection(el, courseId, course) {
  const courses     = loadCourses();
  const otherIds    = Object.keys(courses).filter(id => id !== courseId && !courses[id].groupId);

  if (course.groupId) {
    // ── Already in a group ──────────────────────────────────────────────────
    el.innerHTML =
      `<div class="tee-group-section">` +
        `<div class="tee-group-label">TEE GROUPING</div>` +
        `<div class="tee-group-status">Part of <strong>${escHtml(course.groupName || '')}</strong></div>` +
        `<div class="tee-group-row">` +
          `<label class="tee-group-field-lbl">Tee name</label>` +
          `<input id="teeGroupTeeName" class="tee-group-input" type="text" value="${escHtml(course.teeName || '')}" placeholder="e.g. 59, White, Back"/>` +
        `</div>` +
        `<button class="tee-group-leave-btn" id="teeGroupLeaveBtn" type="button">Remove from group</button>` +
      `</div>`;
    el.querySelector('#teeGroupLeaveBtn').addEventListener('click', () => {
      _ungroupCourse(courseId);
      _renderTeeGroupSection(el, courseId, loadCourses()[courseId] || course);
    });
  } else if (otherIds.length > 0) {
    // ── Standalone, can group ───────────────────────────────────────────────
    el.innerHTML =
      `<div class="tee-group-section">` +
        `<div class="tee-group-label">TEE GROUPING</div>` +
        `<div class="tee-group-row">` +
          `<label class="tee-group-field-lbl">This tee's name</label>` +
          `<input id="teeGroupTeeName" class="tee-group-input" type="text" value="" placeholder="e.g. 59, White, Back"/>` +
        `</div>` +
        `<div class="tee-group-row">` +
          `<label class="tee-group-field-lbl">Group with</label>` +
          `<select id="teeGroupOtherCourse" class="tee-group-input">` +
            `<option value="">— select a course —</option>` +
            otherIds.map(id => `<option value="${id}">${escHtml(courses[id].name)}</option>`).join('') +
          `</select>` +
        `</div>` +
        `<div class="tee-group-row" id="teeGroupOtherNameRow" style="display:none;">` +
          `<label class="tee-group-field-lbl">Other tee's name</label>` +
          `<input id="teeGroupOtherTeeName" class="tee-group-input" type="text" value="" placeholder="e.g. 56, Yellow, Front"/>` +
        `</div>` +
        `<div class="tee-group-row" id="teeGroupGroupNameRow" style="display:none;">` +
          `<label class="tee-group-field-lbl">Group name</label>` +
          `<input id="teeGroupGroupName" class="tee-group-input" type="text" value="" placeholder="e.g. Eslövs GK"/>` +
        `</div>` +
        `<button class="tee-group-create-btn" id="teeGroupCreateBtn" type="button" style="display:none;">Create group</button>` +
      `</div>`;
    el.querySelector('#teeGroupOtherCourse').addEventListener('change', e => {
      const hasOther = !!e.target.value;
      el.querySelector('#teeGroupOtherNameRow').style.display = hasOther ? '' : 'none';
      el.querySelector('#teeGroupGroupNameRow').style.display = hasOther ? '' : 'none';
      el.querySelector('#teeGroupCreateBtn').style.display    = hasOther ? '' : 'none';
      if (hasOther && !el.querySelector('#teeGroupGroupName').value) {
        const sharedBase = courses[e.target.value]?.name?.replace(/[\s\-–]\S+$/, '').trim() || '';
        el.querySelector('#teeGroupGroupName').value = sharedBase;
      }
    });
    el.querySelector('#teeGroupCreateBtn').addEventListener('click', () => {
      const otherId    = el.querySelector('#teeGroupOtherCourse').value;
      const teeName1   = el.querySelector('#teeGroupTeeName').value.trim();
      const teeName2   = el.querySelector('#teeGroupOtherTeeName').value.trim();
      const groupName  = el.querySelector('#teeGroupGroupName').value.trim();
      if (!otherId)   { alert('Select a course to group with.'); return; }
      if (!teeName1)  { alert('Enter a name for this tee.'); return; }
      if (!teeName2)  { alert('Enter a name for the other tee.'); return; }
      if (!groupName) { alert('Enter a group name.'); return; }
      _groupCourses(courseId, otherId, groupName, teeName1, teeName2);
      _renderTeeGroupSection(el, courseId, loadCourses()[courseId] || course);
    });
  } else {
    el.innerHTML = '';
  }
}

export function renderCourseList() {
  const courses = loadCourses();
  const list    = document.getElementById('courseList');
  list.innerHTML = '';

  const ids = Object.keys(courses);
  if (ids.length === 0) {
    list.innerHTML = '<div style="color:#aaa;font-size:15px;padding:8px 0;">No courses yet — add one below.</div>';
    _svc.renderSavedRounds?.();
    return;
  }

  // Separate grouped and standalone courses
  const groupMap   = {}; // groupId → courseId[]
  const standalone = [];
  ids.forEach(id => {
    const c = courses[id];
    if (c.groupId) {
      if (!groupMap[c.groupId]) groupMap[c.groupId] = [];
      groupMap[c.groupId].push(id);
    } else {
      standalone.push(id);
    }
  });

  function _wireActions(el, id) {
    el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'edit')   openEditor(id);
        if (action === 'load')   loadCourseIntoPlay(id);
        if (action === 'delete') deleteCourse(id);
      });
    });
  }

  // ── Grouped courses ─────────────────────────────────────────────────────
  Object.values(groupMap).forEach(groupIds => {
    const groupName = courses[groupIds[0]].groupName || courses[groupIds[0]].name;
    const card = document.createElement('div');
    card.className = 'course-group-card';

    const hdr = document.createElement('div');
    hdr.className = 'course-group-header';
    hdr.innerHTML =
      `<span class="course-group-name">${escHtml(groupName)}</span>` +
      `<span class="course-group-count">${groupIds.length} tees</span>`;
    card.appendChild(hdr);

    groupIds.forEach(id => {
      const c           = courses[id];
      const filledHoles = c.holes.filter(h => h.length > 0).length;
      const totalPar    = c.holes.reduce((s, h) => s + (h.par || 0), 0);
      const teeRow = document.createElement('div');
      teeRow.className = 'course-tee-row';
      teeRow.innerHTML =
        `<div class="course-tee-info" data-id="${id}" data-action-info="edit">` +
          `<div class="course-tee-name">${escHtml(c.teeName || c.name)}</div>` +
          `<div class="course-tee-meta">${filledHoles}/18 holes · Par ${totalPar || '—'}</div>` +
        `</div>` +
        `<div class="course-item-actions">` +
          `<button class="course-action-btn" data-id="${id}" data-action="edit">Edit</button>` +
          `<button class="course-action-btn" data-id="${id}" data-action="load">▶ Play</button>` +
          `<button class="course-action-btn danger" data-id="${id}" data-action="delete">✕</button>` +
        `</div>`;
      teeRow.querySelector('[data-action-info="edit"]').addEventListener('click', () => openEditor(id));
      _wireActions(teeRow, id);
      card.appendChild(teeRow);
    });

    list.appendChild(card);
  });

  // ── Standalone courses ──────────────────────────────────────────────────
  standalone.forEach(id => {
    const c           = courses[id];
    const filledHoles = c.holes.filter(h => h.length > 0).length;
    const totalPar    = c.holes.reduce((s, h) => s + (h.par || 0), 0);

    const item = document.createElement('div');
    item.className = 'course-item';
    item.innerHTML =
      `<div class="course-item-info">` +
        `<div class="course-item-name">${escHtml(c.name)}</div>` +
        `<div class="course-item-meta">${filledHoles}/18 holes · Par ${totalPar || '—'}</div>` +
      `</div>` +
      `<div class="course-item-actions">` +
        `<button class="course-action-btn" data-id="${id}" data-action="edit">Edit</button>` +
        `<button class="course-action-btn" data-id="${id}" data-action="load">▶ Play</button>` +
        `<button class="course-action-btn danger" data-id="${id}" data-action="delete">✕</button>` +
      `</div>`;

    _wireActions(item, id);
    item.querySelector('.course-item-info').addEventListener('click', () => openEditor(id));
    list.appendChild(item);
  });

  _svc.renderSavedRounds?.();
}

// ── Course editor ─────────────────────────────────────────────────────────────
export function openEditor(id) {
  const courses  = loadCourses();
  const courseId = id || newCourseId();
  const course   = courses[courseId] || {
    name: '',
    holes: Array.from({ length: 18 }, () => ({ par: 4, length: '', note: '' }))
  };

  const editor = document.getElementById('courseEditor');
  editor.style.display = 'block';
  editor.dataset.editingId = courseId;

  document.getElementById('courseNameInput').value   = course.name;
  document.getElementById('courseRatingInput').value = course.courseRating || '';
  document.getElementById('slopeRatingInput').value  = course.slopeRating  || '';

  const tbody = document.getElementById('scorecardBody');
  tbody.innerHTML = '';

  [0, 9].forEach(start => {
    const secRow = document.createElement('tr');
    secRow.className = 'sc-section';
    secRow.innerHTML =
      `<td class="sc-hole"></td>` +
      `<td colspan="3">${start === 0 ? 'Front 9' : 'Back 9'}</td>`;
    tbody.appendChild(secRow);

    for (let i = start; i < start + 9; i++) {
      const h   = course.holes[i];
      const row = document.createElement('tr');
      row.innerHTML =
        `<td class="sc-hole">${i + 1}</td>` +
        `<td class="sc-par">
          <select class="hole-par" data-hole="${i}">
            <option value="3" ${h.par == 3 ? 'selected' : ''}>3</option>
            <option value="4" ${(h.par == 4 || !h.par) ? 'selected' : ''}>4</option>
            <option value="5" ${h.par == 5 ? 'selected' : ''}>5</option>
          </select>
        </td>` +
        `<td><input type="number" class="hole-si" data-hole="${i}"
             value="${h.si || ''}" placeholder="—" min="1" max="18" style="width:38px;"/></td>` +
        `<td><input type="number" class="hole-length" data-hole="${i}"
             value="${h.length || ''}" placeholder="—" min="50" max="700"/></td>` +
        `<td><input type="text" class="note-input hole-note" data-hole="${i}"
             value="${escHtml(h.note || '')}" placeholder="Optional note…"/></td>`;
      tbody.appendChild(row);
    }
  });

  // ── Tee grouping section ──────────────────────────────────────────────────
  let teeGroupSection = document.getElementById('teeGroupSection');
  if (!teeGroupSection) {
    teeGroupSection = document.createElement('div');
    teeGroupSection.id = 'teeGroupSection';
    document.getElementById('scorecardTable').parentElement.after(teeGroupSection);
  }
  _renderTeeGroupSection(teeGroupSection, courseId, course);

  document.getElementById('courseEditorSave').onclick = () => {
    const name = document.getElementById('courseNameInput').value.trim();
    if (!name) { alert('Please enter a course name.'); return; }

    const holes = Array.from({ length: 18 }, (_, i) => ({
      par:    Number(tbody.querySelector(`.hole-par[data-hole="${i}"]`).value),
      si:     Number(tbody.querySelector(`.hole-si[data-hole="${i}"]`).value) || 0,
      length: Number(tbody.querySelector(`.hole-length[data-hole="${i}"]`).value) || 0,
      note:   tbody.querySelector(`.hole-note[data-hole="${i}"]`).value.trim(),
    }));
    const courseRating = parseFloat(document.getElementById('courseRatingInput').value) || 0;
    const slopeRating  = parseInt(document.getElementById('slopeRatingInput').value)    || 0;

    // Read tee name from grouping section if present
    const teeNameEl = document.getElementById('teeGroupTeeName');
    const teeName   = teeNameEl ? teeNameEl.value.trim() : '';

    // Preserve existing grouping fields
    const existing = loadCourses()[courseId] || {};
    const updated  = loadCourses();
    updated[courseId] = {
      ...(existing.groupId   ? { groupId:   existing.groupId   } : {}),
      ...(existing.groupName ? { groupName: existing.groupName } : {}),
      ...(teeName            ? { teeName }
          : existing.teeName ? { teeName: existing.teeName }
          : {}),
      name, holes,
      ...(courseRating ? { courseRating } : {}),
      ...(slopeRating  ? { slopeRating  } : {}),
    };
    saveCourses(updated);

    editor.style.display = 'none';
    editor.dataset.editingId = '';
    renderCourseList();
  };

  document.getElementById('courseEditorCancel').onclick = () => {
    editor.style.display = 'none';
    editor.dataset.editingId = '';
  };

  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

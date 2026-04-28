/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 2 — app — course CRUD, course editor, personal baseline.

import {
  loadCourses, saveCourses,
  loadRounds, deleteAllRoundsForCourse,
  loadScores, saveActiveCourse,
} from '../storage/storage.js';

let _svc = {};
export function initServices(svc) { _svc = svc; }

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
  if (data.count < 5) return null;
  const avgScore = data.total / data.count;
  return { avgScore, avgDiff: avgScore - par, rounds: data.count, par };
}

export function blendedScore(modelScore, courseId, holeIdx) {
  const bl = computeHoleBaseline(courseId, holeIdx);
  if (!bl) return { score: modelScore, blended: false };
  const weight = Math.min(1, (bl.rounds - 5) / 7);
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

export function loadCourseIntoPlay(id) {
  const courses = loadCourses();
  const c = courses[id];
  if (!c) return;
  saveActiveCourse(id, 0);
  applyHoleToPlay(c, 0);
  _svc.switchTab?.('home');
  _svc.renderPlayCourseBar?.(id);
  _svc.updateCalcButtonVisibility?.();
  const scores = loadScores(id);
  _svc.renderScoreEntry?.(id, 0, scores);
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

export function renderCourseList() {
  const courses = loadCourses();
  const list    = document.getElementById('courseList');
  list.innerHTML = '';

  const ids = Object.keys(courses);
  if (ids.length === 0) {
    list.innerHTML = '<div style="color:#aaa;font-size:15px;padding:8px 0;">No courses yet — add one below.</div>';
    return;
  }

  ids.forEach(id => {
    const c           = courses[id];
    const filledHoles = c.holes.filter(h => h.length > 0).length;
    const totalPar    = c.holes.reduce((s, h) => s + (h.par || 0), 0);

    const item = document.createElement('div');
    item.className = 'course-item';
    item.innerHTML =
      `<div class="course-item-info">
        <div class="course-item-name">${escHtml(c.name)}</div>
        <div class="course-item-meta">${filledHoles}/18 holes · Par ${totalPar || '—'}</div>
      </div>
      <div class="course-item-actions">
        <button class="course-action-btn" data-id="${id}" data-action="edit">Edit</button>
        <button class="course-action-btn" data-id="${id}" data-action="load">▶ Play</button>
        <button class="course-action-btn danger" data-id="${id}" data-action="delete">✕</button>
      </div>`;

    item.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'edit')   openEditor(id);
        if (action === 'load')   loadCourseIntoPlay(id);
        if (action === 'delete') deleteCourse(id);
      });
    });

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

    const updated = loadCourses();
    updated[courseId] = {
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

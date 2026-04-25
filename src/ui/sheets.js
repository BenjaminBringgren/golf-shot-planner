/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 5 — ui — course picker bottom sheet, club picker modal.
// Rendering and event binding only. No business logic.

import { clubMap, idx7 } from '../engine/clubs.js';
import { loadCourses, loadRounds } from '../storage/storage.js';

// ── Module-level state ────────────────────────────────────────────────────────
let _cpDragCleanup = null;

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Club picker modal ─────────────────────────────────────────────────────────
export function openClubPicker(currentKey, onSelect, constraints, clubsList = []) {
  const overlay = document.getElementById('clubPickerOverlay');
  const sheet   = document.getElementById('clubPickerSheet');
  const list    = document.getElementById('clubPickerList');
  if (!overlay || !sheet || !list) return;

  function isEnabled(club) {
    if (!constraints) return true;
    if (constraints.type === 'no-driver') return club.key !== 'driver';
    if (constraints.type === 'par') {
      const pv = constraints.parValue;
      if (pv === 5) return ['driver','fw3','fw5','fw7','u2','u3'].includes(club.key);
      if (pv === 4) return club.idx <= idx7;
      return true;
    }
    if (constraints.type === 'window') {
      const bagList = constraints.clubsList;
      const defIdx  = bagList.findIndex(c => c.key === constraints.defaultKey);
      if (defIdx === -1) return true;
      const n = constraints.n ?? 2;
      const lo = Math.max(0, defIdx - n);
      const hi = Math.min(bagList.length - 1, defIdx + n);
      return bagList.slice(lo, hi + 1).some(c => c.key === club.key);
    }
    return true;
  }

  function notRecommendedReason() {
    if (!constraints) return null;
    if (constraints.type === 'par') {
      if (constraints.parValue === 5) return 'Not recommended for par 5 tee';
      if (constraints.parValue === 4) return 'Not recommended for par 4 tee';
    }
    if (constraints.type === 'window') return 'Outside recommended range';
    return null;
  }
  const reason = notRecommendedReason();

  list.innerHTML = '';
  const _clubs = clubsList;
  _clubs.forEach(club => {
    const lbl     = clubMap[club.key]?.label ?? club.key;
    const enabled = isEnabled(club);
    const isActive = club.key === currentKey;
    const item = document.createElement('div');
    item.className = 'club-picker-item' +
      (isActive && enabled ? ' active' : '') +
      (!enabled ? ' disabled' : '');
    item.innerHTML =
      `<div>
        <span class="cpi-name">${lbl}</span>` +
      (!enabled && reason ? `<div class="club-picker-not-recommended">${reason}</div>` : '') +
      `</div>
      <span class="cpi-dist">${club.total.toFixed(0)}m</span>
      <span class="cpi-check">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <polyline points="2,6 5,9 10,3" stroke="#fff" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>`;
    if (enabled) {
      item.addEventListener('click', () => { closeClubPicker(); onSelect(club.key); });
    }
    list.appendChild(item);
  });

  document.body.style.overflow = 'hidden';
  overlay.classList.add('open');
  setTimeout(() => {
    sheet.classList.add('open');
    const activeItem = list.querySelector('.club-picker-item.active');
    if (activeItem) activeItem.scrollIntoView({ block: 'center' });
  }, 10);
  overlay.onclick = closeClubPicker;

  // ── Swipe down to dismiss ─────────────────────────────────
  // Attach to the full sheet so the handle area doesn't need to be precise
  let cpDragY = null;
  let cpDragging = false;
  function cpDragStart(e) {
    // Only start drag if touch begins in the top 60px of the sheet (handle zone)
    const rect = sheet.getBoundingClientRect();
    const touchY = e.touches ? e.touches[0].clientY : e.clientY;
    if (touchY - rect.top > 60) return;
    cpDragY = touchY;
    cpDragging = false;
    sheet.style.transition = 'none';
  }
  function cpDragMove(e) {
    if (cpDragY === null) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const delta = Math.max(0, y - cpDragY);
    if (delta > 5) cpDragging = true;
    if (cpDragging) {
      sheet.style.transform = `translateY(${delta}px)`;
      if (e.cancelable) e.preventDefault();
    }
  }
  function cpDragEnd(e) {
    if (cpDragY === null) return;
    const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const delta = Math.max(0, y - cpDragY);
    cpDragY = null;
    cpDragging = false;
    sheet.style.transition = '';
    if (delta > 80) {
      // Animate off screen then close
      sheet.style.transform = 'translateY(100%)';
      setTimeout(() => closeClubPicker(), 280);
    } else {
      // Snap back
      sheet.style.transform = '';
    }
  }
  function cpDragCleanup() {
    sheet.removeEventListener('touchstart', cpDragStart);
    sheet.removeEventListener('touchmove',  cpDragMove);
    sheet.removeEventListener('touchend',   cpDragEnd);
    sheet.removeEventListener('mousedown',  cpDragStart);
    window.removeEventListener('mousemove', cpDragMove);
    window.removeEventListener('mouseup',   cpDragEnd);
  }
  _cpDragCleanup = cpDragCleanup;
  sheet.addEventListener('touchstart', cpDragStart, { passive: true });
  sheet.addEventListener('touchmove',  cpDragMove,  { passive: false });
  sheet.addEventListener('touchend',   cpDragEnd);
  sheet.addEventListener('mousedown',  cpDragStart);
  window.addEventListener('mousemove', cpDragMove);
  window.addEventListener('mouseup',   cpDragEnd);
}

export function closeClubPicker() {
  const overlay = document.getElementById('clubPickerOverlay');
  const sheet   = document.getElementById('clubPickerSheet');
  if (!overlay || !sheet) return;
  if (_cpDragCleanup) { _cpDragCleanup(); _cpDragCleanup = null; }
  sheet.style.transition = '';
  sheet.style.transform  = '';  // clear any inline drag transform
  sheet.classList.remove('open');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Course picker bottom sheet ────────────────────────────────────────────────
export function openCoursePicker(onCourseSelect) {
  const overlay = document.getElementById('coursePickerOverlay');
  const list    = document.getElementById('coursePickerList');
  if (!overlay || !list) return;

  const courses = loadCourses();
  const ids     = Object.keys(courses);
  list.innerHTML = '';

  if (!ids.length) {
    list.innerHTML = '<div class="course-picker-empty">No courses saved yet.<br>Add one in My Golf → My Courses.</div>';
  } else {
    // Sort: courses with rounds first (most recently played), then unplayed
    const withLastPlayed = ids.map(id => {
      const rounds = loadRounds(id);
      const last   = rounds.length ? rounds[0].date : null;
      return { id, course: courses[id], last };
    }).sort((a, b) => {
      if (a.last && b.last) return b.last.localeCompare(a.last);
      if (a.last) return -1;
      if (b.last) return 1;
      return 0;
    });

    withLastPlayed.forEach(({ id, course, last }) => {
      const filledHoles = course.holes.filter(h => h.length > 0).length;
      const totalPar    = course.holes.reduce((s, h) => s + (h.par || 0), 0);
      const meta        = [filledHoles + '/18 holes', totalPar ? 'Par ' + totalPar : null, last ? 'Last played ' + last : null].filter(Boolean).join(' · ');

      const row = document.createElement('div');
      row.className = 'course-picker-row';
      row.innerHTML =
        '<div class="course-picker-dot' + (last ? '' : ' unplayed') + '"></div>' +
        '<div class="course-picker-info">' +
          '<div class="course-picker-name">' + escHtml(course.name) + '</div>' +
          '<div class="course-picker-meta">' + meta + '</div>' +
        '</div>' +
        '<button class="course-picker-play" type="button">Play</button>';
      row.querySelector('.course-picker-play').addEventListener('click', () => {
        closeCoursePicker();
        onCourseSelect?.(id);
      });
      list.appendChild(row);
    });
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

export function closeCoursePicker() {
  const overlay = document.getElementById('coursePickerOverlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

export function wireCoursePickerEvents(onCourseSelect) {
  document.getElementById('loadCourseBtn')?.addEventListener('click', () => openCoursePicker(onCourseSelect));
  document.getElementById('coursePickerCancel')?.addEventListener('click', closeCoursePicker);
  document.getElementById('coursePickerOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('coursePickerOverlay')) closeCoursePicker();
  });
}

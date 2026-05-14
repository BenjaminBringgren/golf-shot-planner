/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 5 — ui — course picker bottom sheet, club picker modal.
// Rendering and event binding only. No business logic.

import { clubMap, idx7 } from '../engine/clubs.js';
import { computeHoleStrokeCounts } from '../app/courses.js';
import {
  loadCourses, loadRounds,
  loadGameFormat, saveGameFormat,
  loadHcpEnabled, saveHcpEnabled,
} from '../storage/storage.js';

// ── Module-level state ────────────────────────────────────────────────────────
let _cpDragCleanup = null;

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Club picker modal ─────────────────────────────────────────────────────────
export function openClubPicker(currentKey, onSelect, constraints, clubsList = [], title) {
  const overlay = document.getElementById('clubPickerOverlay');
  const sheet   = document.getElementById('clubPickerSheet');
  const list    = document.getElementById('clubPickerList');
  if (!overlay || !sheet || !list) return;

  const titleEl = document.getElementById('clubPickerTitle');
  if (titleEl) titleEl.textContent = title || 'Select club';

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
        <svg width="12" height="12" viewBox="-2.000 -74.459 90.620 80.459" xmlns="http://www.w3.org/2000/svg">
          <path d="M35.6445-0.878906C37.5488-0.878906 39.0625-1.70898 40.1367-3.36914L75.7324-59.668C76.5625-60.9375 76.8555-61.9629 76.8555-62.9883C76.8555-65.3809 75.293-66.9922 72.8516-66.9922C71.0938-66.9922 70.1172-66.4062 69.043-64.6973L35.4492-10.791L17.7734-34.6191C16.6504-36.1328 15.5762-36.7676 13.9648-36.7676C11.5234-36.7676 9.76562-35.0586 9.76562-32.6172C9.76562-31.5918 10.2051-30.4688 11.0352-29.3945L31.0059-3.4668C32.373-1.70898 33.7402-0.878906 35.6445-0.878906Z" fill="#fff"/>
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
  const overlay   = document.getElementById('coursePickerOverlay');
  const list      = document.getElementById('coursePickerList');
  const formatBar = document.getElementById('coursePickerFormatBar');
  if (!overlay || !list) return;

  // ── Format selector state ─────────────────────────────────────────────────
  let fmt   = loadGameFormat();
  let hcpOn = loadHcpEnabled();

  if (formatBar) {
    const svgIcon =
      '<svg width="18" height="18" viewBox="-2.000 -74.459 88.570 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M28.125-53.2227L56.4941-53.2227C58.0078-53.2227 59.1309-54.3945 59.1309-55.9082C59.1309-57.373 58.0078-58.4961 56.4941-58.4961L28.125-58.4961C26.5625-58.4961 25.4395-57.373 25.4395-55.9082C25.4395-54.3945 26.5625-53.2227 28.125-53.2227ZM28.125-39.8926L56.4941-39.8926C58.0078-39.8926 59.1309-41.1133 59.1309-42.627C59.1309-44.043 58.0078-45.2148 56.4941-45.2148L28.125-45.2148C26.5625-45.2148 25.4395-44.043 25.4395-42.627C25.4395-41.1133 26.5625-39.8926 28.125-39.8926ZM28.125-26.6602L56.4941-26.6602C58.0078-26.6602 59.1309-27.832 59.1309-29.3457C59.1309-30.8105 58.0078-31.9336 56.4941-31.9336L28.125-31.9336C26.5625-31.9336 25.4395-30.8105 25.4395-29.3457C25.4395-27.832 26.5625-26.6602 28.125-26.6602ZM28.125-13.3789L56.4941-13.3789C58.0078-13.3789 59.1309-14.502 59.1309-15.9668C59.1309-17.4805 58.0078-18.6523 56.4941-18.6523L28.125-18.6523C26.5625-18.6523 25.4395-17.4805 25.4395-15.9668C25.4395-14.502 26.5625-13.3789 28.125-13.3789ZM9.76562-6.54297C9.76562 1.80664 13.8184 5.9082 22.0215 5.9082L62.5 5.9082C70.7031 5.9082 74.8047 1.80664 74.8047-6.54297L74.8047-63.9648C74.8047-72.2656 70.7031-76.416 62.5-76.416L22.0215-76.416C13.8184-76.416 9.76562-72.2656 9.76562-63.9648ZM16.7969-6.64062L16.7969-63.8672C16.7969-67.3828 18.7012-69.3848 22.4121-69.3848L62.1582-69.3848C65.8203-69.3848 67.7246-67.3828 67.7246-63.8672L67.7246-6.64062C67.7246-3.125 65.8203-1.12305 62.1582-1.12305L22.4121-1.12305C18.7012-1.12305 16.7969-3.125 16.7969-6.64062Z"/>' +
      '<path d="M99.9023 25.1953L100-42.0898C100-50.7324 88.6719-53.9062 82.373-46.4355L34.668 10.3027L34.7168 19.4336C34.7656 25.3906 38.4766 25.1953 44.3848 25.1953Z"/>' +
      '<path d="M50.8789 15.9668L87.7441-27.9297L79.834-34.5703L42.9688 9.32617L40.1855 18.4082C39.8926 19.4336 41.0156 20.5078 42.041 20.0195ZM90.9668-31.6406L94.6777-36.0352C96.582-38.2812 96.5332-40.5273 94.4824-42.1875L92.8223-43.6035C90.8203-45.3125 88.623-44.9219 86.7188-42.7246L82.959-38.3301Z"/>' +
      '</svg>';

    const formats = [
      { id: 'strokes',    name: 'Strokes Play', desc: 'Count every stroke across all 18 holes. Lowest total wins.' },
      { id: 'stableford', name: 'Stableford',   desc: 'Points per hole based on your net score vs par — 2 for par, 3 for birdie. Highest total wins.' },
    ];

    formatBar.innerHTML =
      '<div class="picker-fmt-header">' + svgIcon + '<span>Game Format</span></div>' +
      formats.map(f =>
        '<div class="picker-fmt-card' + (fmt === f.id ? ' selected' : '') + '" data-fmt="' + f.id + '">' +
          '<div class="picker-fmt-card-info">' +
            '<div class="picker-fmt-card-name">' + f.name + '</div>' +
            '<div class="picker-fmt-card-desc">' + f.desc + '</div>' +
          '</div>' +
          '<div class="picker-fmt-radio"><div class="picker-fmt-radio-dot"></div></div>' +
        '</div>'
      ).join('') +
      '<div class="picker-hcp-row">' +
        '<span class="picker-hcp-label">Apply handicap</span>' +
        '<button class="picker-hcp-switch" id="pickerHcpToggle" type="button" role="switch"></button>' +
      '</div>';

    function _syncCards() {
      formatBar.querySelectorAll('.picker-fmt-card').forEach(c =>
        c.classList.toggle('selected', c.dataset.fmt === fmt)
      );
    }

    function _syncHcp() {
      const isStblf = fmt === 'stableford';
      const effectOn = isStblf ? true : hcpOn;
      const toggle   = formatBar.querySelector('#pickerHcpToggle');
      if (!toggle) return;
      toggle.classList.toggle('active', effectOn);
      toggle.classList.toggle('dimmed', isStblf);
    }

    _syncHcp();

    formatBar.querySelectorAll('.picker-fmt-card').forEach(card => {
      card.addEventListener('click', () => {
        fmt = card.dataset.fmt;
        saveGameFormat(fmt);
        _syncCards();
        _syncHcp();
      });
    });

    formatBar.querySelector('#pickerHcpToggle')?.addEventListener('click', () => {
      if (fmt === 'stableford') return;
      hcpOn = !hcpOn;
      saveHcpEnabled(hcpOn);
      _syncHcp();
    });
  }

  // ── Course list ───────────────────────────────────────────────────────────
  const courses = loadCourses();
  const ids     = Object.keys(courses);

  function _renderCourseList() {
    list.innerHTML = '';

    if (!ids.length) {
      list.innerHTML = '<div class="course-picker-empty">No courses saved yet.<br>Add one in My Golf → My Courses.</div>';
      return;
    }

    const coursesHdr = document.createElement('div');
    coursesHdr.className = 'picker-section-header';
    coursesHdr.textContent = 'Courses';
    list.appendChild(coursesHdr);

    // Separate grouped and standalone
    const groupMap   = {};
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

    // Last-played date for a group = most recent across all its tees
    function _lastPlayedGroup(groupIds) {
      return groupIds.reduce((best, id) => {
        const rounds = loadRounds(id);
        const last   = rounds.length ? rounds[0].date : null;
        if (!last) return best;
        return !best || last > best ? last : best;
      }, null);
    }

    // Build flat list of entries to sort by last played
    const entries = [];
    Object.entries(groupMap).forEach(([, groupIds]) => {
      const last = _lastPlayedGroup(groupIds);
      entries.push({ type: 'group', groupIds, last });
    });
    standalone.forEach(id => {
      const rounds = loadRounds(id);
      const last   = rounds.length ? rounds[0].date : null;
      entries.push({ type: 'standalone', id, last });
    });
    entries.sort((a, b) => {
      if (a.last && b.last) return b.last.localeCompare(a.last);
      if (a.last) return -1;
      if (b.last) return 1;
      return 0;
    });

    entries.forEach(entry => {
      if (entry.type === 'group') {
        const { groupIds } = entry;
        const groupName    = courses[groupIds[0]].groupName || courses[groupIds[0]].name;
        const last         = entry.last;

        const row = document.createElement('div');
        row.className = 'course-picker-row';
        row.innerHTML =
          '<div class="course-picker-dot' + (last ? '' : ' unplayed') + '"></div>' +
          '<div class="course-picker-info">' +
            '<div class="course-picker-name">' + escHtml(groupName) + '</div>' +
            '<div class="course-picker-meta">' + groupIds.length + ' tees' + (last ? ' · Last played ' + last : '') + '</div>' +
          '</div>' +
          '<button class="course-picker-play" type="button">Select tee ›</button>';
        row.querySelector('.course-picker-play').addEventListener('click', () => {
          _renderTeeList(groupIds, groupName);
        });
        list.appendChild(row);
      } else {
        const { id } = entry;
        const course  = courses[id];
        const last    = entry.last;
        const totalHoles  = course.holes.length;
        const totalPar    = course.holes.reduce((s, h) => s + (h.par || 0), 0);
        const playingHcp  = computeHoleStrokeCounts(id).reduce((a, n) => a + n, 0);
        const meta        = [totalHoles + ' holes', totalPar ? 'Par ' + totalPar : null, playingHcp > 0 ? 'HCP ' + playingHcp : null, last ? 'Last played ' + last : null].filter(Boolean).join(' · ');

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
          onCourseSelect?.(id, fmt, fmt === 'stableford' ? true : hcpOn);
        });
        list.appendChild(row);
      }
    });
  }

  function _renderTeeList(groupIds, groupName) {
    list.innerHTML = '';

    const backRow = document.createElement('div');
    backRow.className = 'picker-tee-back-row';
    backRow.innerHTML = '<button class="picker-tee-back-btn" type="button">‹ Back</button>';
    backRow.querySelector('.picker-tee-back-btn').addEventListener('click', _renderCourseList);
    list.appendChild(backRow);

    const teesHdr = document.createElement('div');
    teesHdr.className = 'picker-section-header';
    teesHdr.textContent = 'Select tee — ' + groupName;
    list.appendChild(teesHdr);

    groupIds.forEach(id => {
      const course      = courses[id];
      const rounds      = loadRounds(id);
      const last        = rounds.length ? rounds[0].date : null;
      const totalHoles  = course.holes.length;
      const totalPar    = course.holes.reduce((s, h) => s + (h.par || 0), 0);
      const playingHcp  = computeHoleStrokeCounts(id).reduce((a, n) => a + n, 0);
      const meta        = [totalHoles + ' holes', totalPar ? 'Par ' + totalPar : null, playingHcp > 0 ? 'HCP ' + playingHcp : null, last ? 'Last played ' + last : null].filter(Boolean).join(' · ');

      const row = document.createElement('div');
      row.className = 'course-picker-row';
      row.innerHTML =
        '<div class="course-picker-dot' + (last ? '' : ' unplayed') + '"></div>' +
        '<div class="course-picker-info">' +
          '<div class="course-picker-name">' + escHtml(course.teeName || course.name) + '</div>' +
          '<div class="course-picker-meta">' + meta + '</div>' +
        '</div>' +
        '<button class="course-picker-play" type="button">Play</button>';
      row.querySelector('.course-picker-play').addEventListener('click', () => {
        closeCoursePicker();
        onCourseSelect?.(id, fmt, fmt === 'stableford' ? true : hcpOn);
      });
      list.appendChild(row);
    });
  }

  _renderCourseList();

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

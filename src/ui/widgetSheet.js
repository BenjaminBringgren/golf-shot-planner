/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 1 — ui — widget drawer (weather + GPS visibility controls).

import { loadWidgetPrefs, saveWidgetPrefs } from '../storage/storage.js';

let _swipeController = null;

export function mountWidgetSheet({ courseId }) {
  const drawer  = document.getElementById('widgetDrawer');
  const inner   = document.getElementById('widgetDrawerInner');
  if (!drawer || !inner) return;

  // Apply stored prefs on every mount (persists across hole navigation)
  _applyPrefs(loadWidgetPrefs());

  // ── FAB ──────────────────────────────────────────────────────────────────
  const fab = document.getElementById('widgetFab');
  if (fab) {
    const newFab = fab.cloneNode(true);
    fab.parentNode.replaceChild(newFab, fab);
    newFab.classList.add('visible');
    newFab.addEventListener('click', () => {
      if (drawer.classList.contains('open')) _closeDrawer();
      else _openDrawer();
    });
  }

  // ── Overlay ──────────────────────────────────────────────────────────────
  const overlay = document.getElementById('widgetDrawerOverlay');
  if (overlay) {
    const newOv = overlay.cloneNode(false);
    overlay.parentNode.replaceChild(newOv, overlay);
    newOv.className = overlay.className;
    newOv.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    newOv.addEventListener('click', _closeDrawer);
  }

  _wireSwipeDown(drawer, _closeDrawer);

  function _openDrawer() {
    _render();
    document.getElementById('widgetDrawerOverlay')?.classList.add('visible');
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function _render() {
    const p = loadWidgetPrefs();
    inner.innerHTML = '';
    inner.appendChild(_buildFocusCard(p.focus));
    inner.appendChild(_buildWeatherCard(p.weather));
    inner.appendChild(_buildGpsCard(p.gps));
  }
}

export function hideWidgetFab() {
  const fab = document.getElementById('widgetFab');
  if (fab) fab.classList.remove('visible');
}

function _closeDrawer() {
  document.getElementById('widgetDrawer')?.classList.remove('open');
  document.getElementById('widgetDrawerOverlay')?.classList.remove('visible');
  document.body.style.overflow = '';
}

// ── Apply prefs to Play page sections ────────────────────────────────────────
function _applyPrefs(prefs) {
  const windSection  = document.getElementById('windSection');
  const gpsSection   = document.getElementById('gpsSection');
  const focusStrip   = document.getElementById('playFocusStrip');
  if (windSection)  windSection.style.display  = prefs.weather ? '' : 'none';
  if (gpsSection)   gpsSection.style.display   = prefs.gps     ? '' : 'none';
  if (focusStrip && !focusStrip.classList.contains('pfs-empty')) {
    focusStrip.style.display = prefs.focus ? '' : 'none';
  }
}

// ── Focus card ────────────────────────────────────────────────────────────────
function _buildFocusCard(visible) {
  const card   = document.createElement('div');
  card.className = 'wd-card';

  const header = document.createElement('div');
  header.className = 'wd-card-header';
  header.innerHTML =
    `<div class="wd-card-icon">
       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
       </svg>
     </div>
     <span class="wd-card-title">Player Focus</span>
     <span class="wd-card-hint">Show on play page</span>
     <label class="wind-toggle" style="flex-shrink:0;">
       <input type="checkbox" ${visible ? 'checked' : ''}>
       <span class="wind-toggle-slider"></span>
     </label>`;

  const body = document.createElement('div');
  body.className = 'wd-card-body';
  body.innerHTML = _focusBody();

  const toggle = header.querySelector('input');
  toggle.addEventListener('change', (e) => {
    e.stopPropagation();
    const p = loadWidgetPrefs();
    p.focus = toggle.checked;
    saveWidgetPrefs(p.weather, p.gps, p.focus);
    _applyPrefs(p);
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function _focusBody() {
  const strip = document.getElementById('playFocusStrip');
  const tip   = strip?.dataset?.tip || '';
  if (!tip) {
    return `<div class="wd-card-empty">Play more rounds to unlock your focus tips.</div>`;
  }
  return `<div class="wd-focus-body"><div class="wd-focus-text">${tip}</div></div>`;
}

// ── Weather card ──────────────────────────────────────────────────────────────
function _buildWeatherCard(visible) {
  const card   = document.createElement('div');
  card.className = 'wd-card';

  const header = document.createElement('div');
  header.className = 'wd-card-header';
  header.innerHTML =
    `<div class="wd-card-icon">
       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
       </svg>
     </div>
     <span class="wd-card-title">Weather</span>
     <span class="wd-card-hint">Show on play page</span>
     <label class="wind-toggle" style="flex-shrink:0;">
       <input type="checkbox" ${visible ? 'checked' : ''}>
       <span class="wind-toggle-slider"></span>
     </label>`;

  const body = document.createElement('div');
  body.className = 'wd-card-body';
  body.innerHTML = _weatherBody();

  const toggle = header.querySelector('input');
  toggle.addEventListener('change', (e) => {
    e.stopPropagation();
    const p = loadWidgetPrefs();
    p.weather = toggle.checked;
    saveWidgetPrefs(p.weather, p.gps, p.focus);
    _applyPrefs(p);
    body.innerHTML = _weatherBody();
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function _weatherBody() {
  const speed     = document.getElementById('wsbSpeed')?.textContent     || '';
  const detail    = document.getElementById('wsbDetail')?.textContent    || '';
  const head      = document.getElementById('wbrHead')?.textContent      || '';
  const cross     = document.getElementById('wbrCross')?.textContent     || '';
  const effect    = document.getElementById('wbrEffect')?.textContent    || '';
  const feelsLike = document.getElementById('wbrFeelsLike')?.textContent || '';
  const rain      = document.getElementById('wbrRain')?.textContent      || '';

  if (!speed || speed === '—') {
    return `<div class="wd-card-empty">Fetch wind from the Play page first.</div>`;
  }

  const rows = [
    { label: 'Wind',        val: [speed, detail].filter(Boolean).join(' · ') },
    { label: 'Head / Tail', val: head },
    { label: 'Crosswind',   val: cross },
    { label: 'Carry effect',val: effect },
    { label: 'Temp · carry',val: feelsLike },
    { label: 'Rain',        val: rain },
  ].filter(r => r.val && r.val !== '—');

  return `<div class="wd-stat-list">${
    rows.map(r =>
      `<div class="wd-stat-row">
         <span class="wd-stat-label">${r.label}</span>
         <span class="wd-stat-val">${r.val}</span>
       </div>`
    ).join('')
  }</div>`;
}

// ── GPS card ──────────────────────────────────────────────────────────────────
function _buildGpsCard(visible) {
  const card   = document.createElement('div');
  card.className = 'wd-card';

  const header = document.createElement('div');
  header.className = 'wd-card-header';
  header.innerHTML =
    `<div class="wd-card-icon">
       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
       </svg>
     </div>
     <span class="wd-card-title">GPS Tracking</span>
     <span class="wd-card-hint">Show on play page</span>
     <label class="wind-toggle" style="flex-shrink:0;">
       <input type="checkbox" ${visible ? 'checked' : ''}>
       <span class="wind-toggle-slider"></span>
     </label>`;

  const body = document.createElement('div');
  body.className = 'wd-card-body';
  body.innerHTML = _gpsBody();

  const toggle = header.querySelector('input');
  toggle.addEventListener('change', (e) => {
    e.stopPropagation();
    const p = loadWidgetPrefs();
    p.gps = toggle.checked;
    saveWidgetPrefs(p.weather, p.gps, p.focus);
    _applyPrefs(p);
    body.innerHTML = _gpsBody();
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function _gpsBody() {
  const teeStatus  = document.getElementById('gpsTeeStatus')?.textContent  || 'Tap to mark';
  const ballStatus = document.getElementById('gpsBallStatus')?.textContent || 'Mark tee first';
  const ballDist   = document.getElementById('gpsBallDist')?.textContent   || '';

  const teeMarked  = teeStatus !== 'Tap to mark';
  const ballMarked = ballDist !== '';
  const ballDisplay = ballMarked ? ballDist : ballStatus;

  return `<div class="wd-gps-row">
    <div class="wd-gps-tile ${teeMarked ? 'wd-gps-tile--marked' : ''}">
      <div class="wd-gps-dot ${teeMarked ? 'wd-gps-dot--on' : ''}"></div>
      <div>
        <div class="wd-gps-label">Tee location</div>
        <div class="wd-gps-status">${teeStatus}</div>
      </div>
    </div>
    <div class="wd-gps-tile ${!teeMarked ? 'wd-gps-tile--dim' : ballMarked ? 'wd-gps-tile--marked' : ''}">
      <div class="wd-gps-dot ${ballMarked ? 'wd-gps-dot--on' : ''}"></div>
      <div>
        <div class="wd-gps-label">Ball position</div>
        <div class="wd-gps-status">${ballDisplay}</div>
      </div>
    </div>
  </div>`;
}

// ── Swipe-down to close ───────────────────────────────────────────────────────
function _wireSwipeDown(drawer, close) {
  if (_swipeController) _swipeController.abort();
  _swipeController = new AbortController();
  const signal = _swipeController.signal;

  let startY = null, cur = 0, active = false;

  drawer.addEventListener('touchstart', (e) => {
    if (e.target.closest('button, input, label')) return;
    startY = e.touches[0].clientY; cur = 0; active = false;
  }, { passive: true, signal });

  drawer.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (!active && dy > 10) { active = true; drawer.style.transition = 'none'; }
    if (!active) return;
    cur = Math.max(0, dy);
    drawer.style.transform = `translateY(${cur}px)`;
  }, { passive: true, signal });

  drawer.addEventListener('touchend', () => {
    if (startY === null) return;
    startY = null; drawer.style.transition = '';
    if (cur > 80) { close(); drawer.style.transform = ''; }
    else drawer.style.transform = '';
    active = false; cur = 0;
  }, { signal });
}

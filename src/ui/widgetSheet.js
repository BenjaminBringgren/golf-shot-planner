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
       <svg width="15" height="15" viewBox="-2.000 -74.459 111.770 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M53.9062 1.02539C73.9258 1.02539 90.1855-15.2832 90.1855-35.3027C90.1855-55.3223 73.9258-71.6309 53.9062-71.6309C33.8379-71.6309 17.5781-55.3223 17.5781-35.3027C17.5781-15.2832 33.8379 1.02539 53.9062 1.02539ZM53.9062-6.05469C37.7441-6.05469 24.6582-19.1406 24.6582-35.3027C24.6582-51.416 37.7441-64.5508 53.9062-64.5508C70.0195-64.5508 83.1055-51.416 83.1055-35.3027C83.1055-19.1406 70.0195-6.05469 53.9062-6.05469ZM53.9062-49.9512C55.6152-49.9512 56.9824-51.3184 56.9824-53.0273L56.9824-79.1504C56.9824-80.9082 55.6152-82.2754 53.9062-82.2754C52.1484-82.2754 50.7812-80.9082 50.7812-79.1504L50.7812-53.0273C50.7812-51.3184 52.1484-49.9512 53.9062-49.9512ZM9.96094-32.0801L36.0352-32.0801C37.793-32.0801 39.1602-33.4473 39.1602-35.2051C39.1602-36.9629 37.793-38.3301 36.0352-38.3301L9.96094-38.3301C8.20312-38.3301 6.83594-36.9629 6.83594-35.2051C6.83594-33.4473 8.20312-32.0801 9.96094-32.0801ZM53.9062 11.8652C55.6152 11.8652 56.9824 10.498 56.9824 8.74023L56.9824-17.3828C56.9824-19.0918 55.6152-20.459 53.9062-20.459C52.1484-20.459 50.7812-19.0918 50.7812-17.3828L50.7812 8.74023C50.7812 10.498 52.1484 11.8652 53.9062 11.8652ZM71.7285-32.0801L97.8027-32.0801C99.5605-32.0801 100.928-33.4473 100.928-35.2051C100.928-36.9629 99.5605-38.3301 97.8027-38.3301L71.7285-38.3301C69.9707-38.3301 68.6035-36.9629 68.6035-35.2051C68.6035-33.4473 69.9707-32.0801 71.7285-32.0801Z"/></svg>
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
  return `<div class="wd-card-desc">Shows a personalised pre-round focus tip based on your recent rounds at this course — your biggest scoring leak or a strength to build on.</div>`;
}

// ── Weather card ──────────────────────────────────────────────────────────────
function _buildWeatherCard(visible) {
  const card   = document.createElement('div');
  card.className = 'wd-card';

  const header = document.createElement('div');
  header.className = 'wd-card-header';
  header.innerHTML =
    `<div class="wd-card-icon">
       <svg width="15" height="15" viewBox="-2.000 -74.459 100.290 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M48.7305-0.732422C54.7852-0.732422 59.5215-5.17578 59.5215-11.6699C59.5215-20.8984 50.2441-26.0254 32.9102-26.0254C26.0254-26.0254 18.457-24.8047 12.0117-22.5586C10.2539-21.9727 9.47266-20.459 9.91211-18.9453C10.3516-17.4316 11.8164-16.5039 13.7207-17.1875C19.7266-19.2383 26.2207-20.4102 32.9102-20.4102C46.6797-20.4102 53.9062-16.9922 53.9062-11.6699C53.9062-8.30078 51.5625-6.34766 48.7305-6.34766C45.8496-6.34766 44.2383-8.34961 43.7012-11.377C43.4082-12.9883 42.2852-14.3066 40.4297-14.1602C38.4277-14.0137 37.6953-12.3535 37.9395-10.6445C38.623-5.22461 42.627-0.732422 48.7305-0.732422Z"/><path d="M73.1445-27.8809C82.1289-27.8809 88.5742-33.6914 88.5742-41.748C88.5742-49.8535 82.4219-55.5664 74.7559-55.5664C67.7734-55.5664 62.5977-50.8301 61.6211-44.4336C61.3281-42.627 62.3047-41.2109 63.8672-40.9668C65.4785-40.7227 66.8945-41.6992 67.2852-43.7988C67.9199-47.5586 71.0938-49.9512 74.7559-49.9512C79.2969-49.9512 82.959-46.6797 82.959-41.748C82.959-36.8652 79.0527-33.4961 73.1445-33.4961C61.5723-33.4961 49.0723-40.1367 33.7891-40.1367C26.0254-40.1367 18.7988-38.9648 12.0117-36.6211C10.2539-36.0352 9.47266-34.5215 9.91211-33.0078C10.3516-31.4941 11.8164-30.5664 13.7207-31.25C19.9707-33.4473 26.416-34.5215 33.7891-34.5215C49.0723-34.5215 60.2051-27.8809 73.1445-27.8809Z"/><path d="M13.7207-46.1426C19.2871-47.8027 25-48.584 30.3223-48.584C37.1094-48.584 42.2852-47.5586 48.6816-47.5586C55.8594-47.5586 60.2051-52.4414 60.2051-58.6426C60.2051-65.1367 55.2734-69.6777 49.2188-69.6777C44.9219-69.6777 41.0645-67.0898 39.2578-63.5742C38.5254-62.1582 38.7207-60.4492 40.2344-59.6191C41.6016-58.8867 43.3594-59.2773 44.3359-61.0352C45.166-62.6953 47.1191-64.0137 49.2188-64.0137C52.1484-64.0137 54.5898-62.0117 54.5898-58.6426C54.5898-55.3223 52.2949-53.2227 48.6816-53.2227C42.6758-53.2227 37.3047-54.248 30.3223-54.248C24.0234-54.248 17.7734-53.2227 12.0117-51.5625C10.2051-51.0254 9.47266-49.4629 9.91211-47.9492C10.3516-46.4844 11.7676-45.5566 13.7207-46.1426Z"/></svg>
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
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function _weatherBody() {
  return `<div class="wd-card-desc">Shows live wind speed, direction, head/tail component, crosswind, carry effect, and temperature adjustment — fetched from your current location.</div>`;
}

// ── GPS card ──────────────────────────────────────────────────────────────────
function _buildGpsCard(visible) {
  const card   = document.createElement('div');
  card.className = 'wd-card';

  const header = document.createElement('div');
  header.className = 'wd-card-header';
  header.innerHTML =
    `<div class="wd-card-icon">
       <svg width="15" height="15" viewBox="-2.000 -74.459 95.410 80.459" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10.1562-42.7734C4.24805-40.0391 5.9082-32.0801 12.4512-32.0312L39.209-31.9336C39.6973-31.9336 39.7949-31.7871 39.7949-31.3477L39.8926-4.73633C39.9414 2.00195 47.998 3.27148 50.9277-3.02734L78.5156-62.6953C81.4453-68.9453 76.5137-73.4863 70.2148-70.5566ZM17.9688-38.8672C17.8711-38.8672 17.8223-38.9648 17.9688-39.0137L70.6543-62.9395C70.8008-63.0371 70.8984-62.9883 70.752-62.793L46.7285-10.2051C46.6797-10.0586 46.6309-10.0586 46.6309-10.2051L46.8262-35.8887C46.8262-37.7441 45.5078-39.0625 43.6523-39.0625Z"/></svg>
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
  });

  card.appendChild(header);
  card.appendChild(body);
  return card;
}

function _gpsBody() {
  return `<div class="wd-card-desc">Mark your tee and ball positions to measure exact shot distances. Distances update as you move and feed into your shot planning.</div>`;
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

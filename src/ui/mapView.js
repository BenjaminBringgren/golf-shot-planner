/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */

// LAYER 2 — ui — Map view. No business logic, no storage, no platform imports.
// All GPS/session data comes via injected callbacks from router.js.

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZ29sZm1hcCIsImEiOiJjbXBqZHE0NzgwY3JnMnJzYXdqYmwzZTdyIn0.NjQk6PyT7w2uObA_vkuc4Q';
const MAP_STYLE    = 'mapbox://styles/mapbox/satellite-streets-v12';

let _map          = null;
let _playerMarker = null;
let _teeMarker    = null;
let _isOpen       = false;
let _callbacks    = null;

let _fab, _mapPage, _mapContainer, _infoStrip;

// ── Public API ────────────────────────────────────────────────────────────────

export function setMapFabVisible(show) {
  if (_fab) _fab.classList.toggle('visible', show);
  if (!show && _isOpen) _closeInternal();
}

export function initMapView(callbacks) {
  _callbacks    = callbacks;
  _fab          = document.getElementById('mapFab');
  _mapPage      = document.getElementById('mapPage');
  _mapContainer = document.getElementById('mapboxContainer');
  _infoStrip    = document.getElementById('mapInfoStrip');
  if (!_fab) return;
  _infoStrip.addEventListener('click', (e) => {
    if (e.target.closest('.map-card-btn')) _callbacks.openScorecard?.();
  });
  _fab.addEventListener('click', () => _isOpen ? closeMapView() : openMapView());
}

export function openMapView() {
  if (_isOpen) return;
  _isOpen = true;
  _mapPage.classList.add('open');
  _fab.classList.add('map-open');
  document.body.style.overflow = 'hidden';
  _renderInfoStrip();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!_map) _initMap();
    else       _map.resize();
    _locateAndCenter();
  }));
}

export function closeMapView() {
  if (!_isOpen) return;
  _closeInternal();
  const active = !!_callbacks.getActiveCourseId?.();
  document.getElementById('scoreFab')?.classList.toggle('visible', active);
  document.getElementById('widgetFab')?.classList.toggle('visible', active);
}

// Called when switching away from play tab — caller handles FAB visibility.
export function closeMapViewIfOpen() {
  if (_isOpen) _closeInternal();
}

// Called by router whenever the active hole changes.
export function refreshMapInfoStrip() {
  if (_isOpen) _renderInfoStrip();
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _closeInternal() {
  _isOpen = false;
  _mapPage.classList.remove('open');
  _fab.classList.remove('map-open');
  document.body.style.overflow = '';
  if (_map) { _map.remove(); _map = null; }
}

function _initMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;
  _map = new mapboxgl.Map({
    container: _mapContainer,
    style:     MAP_STYLE,
    zoom:      17,
    center:    [0, 0],
    attributionControl: false,
    logoPosition: 'bottom-right',
  });
  _map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
  _map.on('error', (e) => console.error('[map] error:', e.error?.message ?? e));

  const playerEl = document.createElement('div');
  playerEl.className = 'map-player-marker';
  playerEl.innerHTML = '<div class="map-player-dot"></div><div class="map-player-ring"></div>';
  _playerMarker = new mapboxgl.Marker({ element: playerEl, anchor: 'center' }).setLngLat([0, 0]);

  const teeEl = document.createElement('div');
  teeEl.className = 'map-tee-marker';
  teeEl.innerHTML = '<div class="map-tee-pin"></div>';
  _teeMarker = new mapboxgl.Marker({ element: teeEl, anchor: 'bottom' }).setLngLat([0, 0]);
}

async function _locateAndCenter() {
  const snapshot = _callbacks.getGpsSnapshot?.();

  if (snapshot?.teeMark) {
    const { lat, lon } = snapshot.teeMark;
    _teeMarker.setLngLat([lon, lat]).addTo(_map);
  } else {
    _teeMarker.remove();
  }

  let pos = null;
  try { pos = await _callbacks.fetchCurrentPosition?.(); } catch (_) {}
  if (!pos && snapshot?.teeMark) {
    pos = { lat: snapshot.teeMark.lat, lon: snapshot.teeMark.lon };
  }
  if (!pos) return;

  _playerMarker.setLngLat([pos.lon, pos.lat]).addTo(_map);

  const h   = _mapContainer.clientHeight;
  const pad = Math.round(h * 0.55);
  _map.easeTo({
    center:   [pos.lon, pos.lat],
    zoom:     17,
    padding:  { top: pad, bottom: 0, left: 0, right: 0 },
    duration: 600,
  });

  _renderInfoStrip(pos, snapshot);
}

const _WIND_ARROW_PATH = 'M12.9883 9.13086C15.0391 9.13086 17.1875 7.95898 18.8477 6.39648L33.0566-7.22656C33.5449-7.71484 33.8867-7.95898 34.1797-7.95898C34.5215-7.95898 34.8633-7.71484 35.3516-7.22656L49.5117 6.39648C51.2207 7.95898 53.3203 9.13086 55.3711 9.13086C58.3496 9.13086 60.5957 6.39648 60.5957 3.56445C60.5957 1.80664 59.8145-0.146484 58.8867-2.63672L40.0879-51.5137C38.623-55.3223 36.6211-56.8359 34.1797-56.8359C31.7871-56.8359 29.7363-55.3223 28.2715-51.5137L9.47266-2.63672C8.54492-0.146484 7.8125 1.80664 7.8125 3.56445C7.8125 6.39648 10.0098 9.13086 12.9883 9.13086Z';

function _renderInfoStrip(pos, snapshot) {
  if (!_infoStrip) return;
  const session  = _callbacks.getActiveSession?.();
  const courseId = session?.id;
  const holeIdx  = session?.id ? (session.holeIdx ?? 0) : null;
  const holeNum  = holeIdx !== null ? holeIdx + 1 : null;

  // ── Hole info (left side) ─────────────────────────────────────────────────
  let leftHtml = '';
  if (holeNum) {
    leftHtml += `<span class="map-info-hole">Hole ${holeNum}</span>`;
    const course = courseId ? _callbacks.getCourse?.(courseId) : null;
    const hole   = course?.holes?.[holeIdx];
    if (hole?.length) leftHtml += `<span class="map-info-sep">·</span><span class="map-info-length">${hole.length}m</span>`;
    if (hole?.si)     leftHtml += `<span class="map-info-sep">·</span><span class="map-info-si">SI ${hole.si}</span>`;
    if (courseId && session?.hcpEnabled) {
      const counts = _callbacks.getStrokeCounts?.(courseId);
      const strokes = counts?.[holeIdx] ?? 0;
      if (strokes > 0) {
        leftHtml += `<span class="map-info-hcp-dots">${'●'.repeat(strokes)}</span>`;
      }
    }
  } else {
    leftHtml += `<span class="map-info-locating">Locating…</span>`;
  }

  // ── Wind + CARD (right side) ──────────────────────────────────────────────
  let rightHtml = '';
  const wind = _callbacks.getWindState?.();
  if (wind?.speedMs != null) {
    const windTo  = Math.round((wind.dirDeg + 180) % 360);
    const speedTxt = wind.speedMs < 1 ? 'Calm' : `${wind.speedMs.toFixed(1)}m/s`;
    rightHtml += `<div class="map-wind-widget">
      <svg class="map-wind-arrow" width="14" height="14" viewBox="-2.000 -74.459 72.410 80.459"
           fill="currentColor" style="transform:rotate(${windTo}deg)">
        <path d="${_WIND_ARROW_PATH}"/>
      </svg>
      <span class="map-wind-speed">${speedTxt}</span>
    </div>`;
  }
  rightHtml += `<button class="map-card-btn" type="button">CARD</button>`;

  _infoStrip.innerHTML =
    `<div class="map-info-left">${leftHtml}</div>` +
    `<div class="map-info-right">${rightHtml}</div>`;
}

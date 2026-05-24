/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */

// LAYER 2 — ui — Map view. No business logic, no storage, no platform imports.
// All GPS/session data comes via injected callbacks from router.js.

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZ29sZm1hcCIsImEiOiJjbXBqZHE0NzgwY3JnMnJzYXdqYmwzZTdyIn0.NjQk6PyT7w2uObA_vkuc4Q';
const MAP_STYLE    = 'mapbox://styles/mapbox/outdoors-v12';

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

function _renderInfoStrip(pos, snapshot) {
  if (!_infoStrip) return;
  const session = _callbacks.getActiveSession?.();
  const holeNum = session?.id ? (session.holeIdx ?? 0) + 1 : null;
  let html = '';
  if (holeNum) html += `<div class="map-info-hole">Hole ${holeNum}</div>`;
  if (pos && snapshot?.teeMark) {
    const dist = _callbacks.haversine?.(pos.lat, pos.lon, snapshot.teeMark.lat, snapshot.teeMark.lon);
    if (dist != null) html += `<div class="map-info-dist">${Math.round(dist)}<span>m to tee</span></div>`;
  } else if (!pos) {
    html += `<div class="map-info-locating">Locating…</div>`;
  }
  _infoStrip.innerHTML = html;
}

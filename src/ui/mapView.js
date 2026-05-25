/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */

// LAYER 2 — ui — Map view. No business logic, no storage, no platform imports.
// All GPS/session data comes via injected callbacks from router.js.

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZ29sZm1hcCIsImEiOiJjbXBqZHE0NzgwY3JnMnJzYXdqYmwzZTdyIn0.NjQk6PyT7w2uObA_vkuc4Q';
const MAP_STYLE    = 'mapbox://styles/mapbox/satellite-streets-v12';

const _WIND_ARROW_PATH = 'M12.9883 9.13086C15.0391 9.13086 17.1875 7.95898 18.8477 6.39648L33.0566-7.22656C33.5449-7.71484 33.8867-7.95898 34.1797-7.95898C34.5215-7.95898 34.8633-7.71484 35.3516-7.22656L49.5117 6.39648C51.2207 7.95898 53.3203 9.13086 55.3711 9.13086C58.3496 9.13086 60.5957 6.39648 60.5957 3.56445C60.5957 1.80664 59.8145-0.146484 58.8867-2.63672L40.0879-51.5137C38.623-55.3223 36.6211-56.8359 34.1797-56.8359C31.7871-56.8359 29.7363-55.3223 28.2715-51.5137L9.47266-2.63672C8.54492-0.146484 7.8125 1.80664 7.8125 3.56445C7.8125 6.39648 10.0098 9.13086 12.9883 9.13086Z';
const _SCOPE_PATH = 'M53.9062 1.02539C73.9258 1.02539 90.1855-15.2832 90.1855-35.3027C90.1855-55.3223 73.9258-71.6309 53.9062-71.6309C33.8379-71.6309 17.5781-55.3223 17.5781-35.3027C17.5781-15.2832 33.8379 1.02539 53.9062 1.02539ZM53.9062-6.05469C37.7441-6.05469 24.6582-19.1406 24.6582-35.3027C24.6582-51.416 37.7441-64.5508 53.9062-64.5508C70.0195-64.5508 83.1055-51.416 83.1055-35.3027C83.1055-19.1406 70.0195-6.05469 53.9062-6.05469ZM53.9062-49.9512C55.6152-49.9512 56.9824-51.3184 56.9824-53.0273L56.9824-79.1504C56.9824-80.9082 55.6152-82.2754 53.9062-82.2754C52.1484-82.2754 50.7812-80.9082 50.7812-79.1504L50.7812-53.0273C50.7812-51.3184 52.1484-49.9512 53.9062-49.9512ZM9.96094-32.0801L36.0352-32.0801C37.793-32.0801 39.1602-33.4473 39.1602-35.2051C39.1602-36.9629 37.793-38.3301 36.0352-38.3301L9.96094-38.3301C8.20312-38.3301 6.83594-36.9629 6.83594-35.2051C6.83594-33.4473 8.20312-32.0801 9.96094-32.0801ZM53.9062 11.8652C55.6152 11.8652 56.9824 10.498 56.9824 8.74023L56.9824-17.3828C56.9824-19.0918 55.6152-20.459 53.9062-20.459C52.1484-20.459 50.7812-19.0918 50.7812-17.3828L50.7812 8.74023C50.7812 10.498 52.1484 11.8652 53.9062 11.8652ZM71.7285-32.0801L97.8027-32.0801C99.5605-32.0801 100.928-33.4473 100.928-35.2051C100.928-36.9629 99.5605-38.3301 97.8027-38.3301L71.7285-38.3301C69.9707-38.3301 68.6035-36.9629 68.6035-35.2051C68.6035-33.4473 69.9707-32.0801 71.7285-32.0801Z';

const _STRAT_COLORS = {
  'Max distance': '#c0392b',
  'Controlled':   '#c07820',
  'Conservative': '#1e7a45',
};

const _STRATEGIES = [
  { type: 'Max distance', label: 'MAX',  color: '#c0392b' },
  { type: 'Controlled',   label: 'CTRL', color: '#c07820' },
  { type: 'Conservative', label: 'CONS', color: '#1e7a45' },
];

let _map          = null;
let _playerMarker = null;
let _teeMarker    = null;
let _isOpen       = false;
let _callbacks    = null;

let _fab, _mapPage, _mapContainer, _infoStrip, _windBtn, _windPopup, _chipsRow, _lockBtn;
let _compassAbsHandler = null;
let _compassFbHandler  = null;
let _currentHeading    = 0;
let _mapBearing        = 0;   // current map rotation (degrees)
let _liveRotate        = false; // true = map bearing follows compass in real-time
let _overlayBearing    = 0;    // bearing used to draw overlay — fixed until hole change or close

// ── Shot overlay state ────────────────────────────────────────────────────────
let _playerPos      = null;
let _shotDots       = [];
let _nominalDists   = [];
let _shotClubs      = []; // club key per segment (null for approach)
let _shotWindDeltas = []; // wind carry delta per segment (null if no wind adjustment)
let _shotMarkers    = [];
let _labelMarkers   = [];
let _activeStratColor = '#888';

// Persists dot positions the user has dragged, keyed by 'courseId|holeIdx|strategyType'.
// Survives map close/reopen within the same session.
const _dotPosCache = {};


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

  // Wind button
  _windBtn = document.createElement('button');
  _windBtn.type = 'button';
  _windBtn.id = 'mapWindBtn';
  _windBtn.className = 'map-wind-btn';
  _windBtn.innerHTML =
    `<svg class="map-wind-btn-arrow" width="22" height="22" viewBox="-2.000 -74.459 72.410 80.459" fill="currentColor"><path d="${_WIND_ARROW_PATH}"/></svg>` +
    `<span class="map-wind-btn-speed">–</span>`;
  _mapPage.appendChild(_windBtn);

  _windBtn.addEventListener('click', async () => {
    if (_windPopup) { _hideWindPopup(); return; }
    _setWindBtnLoading(true);
    try {
      const wind = await _callbacks.fetchMapWind?.();
      if (wind) { _updateWindBtn(wind); _showWindPopup(wind); }
    } catch (_) {}
    _setWindBtnLoading(false);
  });

  // Lock rotation button
  _lockBtn = document.createElement('button');
  _lockBtn.type = 'button';
  _lockBtn.className = 'map-lock-btn';
  _lockBtn.innerHTML = `<svg class="map-lock-arrow" width="20" height="20" viewBox="-2.000 -74.459 72.410 80.459" fill="currentColor"><path d="${_WIND_ARROW_PATH}"/></svg>`;
  _mapPage.appendChild(_lockBtn);
  _lockBtn.addEventListener('click', _toggleLock);

  // Strategy chips
  _chipsRow = document.createElement('div');
  _chipsRow.className = 'map-strategy-chips';
  _mapPage.appendChild(_chipsRow);

  _chipsRow.addEventListener('click', (e) => {
    const chip = e.target.closest('.map-strategy-chip');
    if (!chip) return;
    const session  = _callbacks.getActiveSession?.();
    const courseId = session?.id;
    const holeIdx  = session?.id ? (session.holeIdx ?? 0) : null;
    if (!courseId || holeIdx === null) return;
    const type    = chip.dataset.type;
    const current = _callbacks.getCommittedStrategy?.(courseId, holeIdx);
    const currentType = current?.split(' · ')[0] ?? null;
    if (currentType === type) {
      _callbacks.clearCommittedStrategy?.(courseId, holeIdx);
    } else {
      _callbacks.setCommittedStrategy?.(courseId, holeIdx, type, current);
    }
    _renderChips();
    _whenStyleLoaded(() => _renderShotOverlay());
    _callbacks.recalculate?.();
  });
}

export function openMapView() {
  if (_isOpen) return;
  _isOpen = true;
  _mapPage.classList.add('open');
  _fab.classList.add('map-open');
  document.body.style.overflow = 'hidden';

  const existingWind = _callbacks.getWindState?.();
  if (existingWind?.speedMs != null) _updateWindBtn(existingWind);

  _renderInfoStrip();
  _renderChips();
  // Ensure strategies are computed before render (covers fresh-start and resume cases).
  _callbacks.recalculate?.();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!_map) _initMap();
    else       _map.resize();
    _locateAndCenter();
    _startCompass();
    _whenStyleLoaded(() => _renderShotOverlay());
  }));
}

export function closeMapView() {
  if (!_isOpen) return;
  _closeInternal();
  const active = !!_callbacks.getActiveCourseId?.();
  document.getElementById('scoreFab')?.classList.toggle('visible', active);
  document.getElementById('widgetFab')?.classList.toggle('visible', active);
}

export function closeMapViewIfOpen() {
  if (_isOpen) _closeInternal();
}

export function refreshMapInfoStrip() {
  if (!_isOpen) return;
  _renderInfoStrip();
  _renderChips();
  _clearShotOverlay();
  _overlayBearing = _currentHeading;
  // Recalculate for the new hole so _lastPar3Plan and strategies are current
  // before the overlay renders. Without this, switching par 3 ↔ par 4/5 shows
  // stale overlay data (wrong hole's par3 flag).
  _callbacks.recalculate?.();
  if (_map) _whenStyleLoaded(() => {
    _renderShotOverlay();
    if (_shotDots.length >= 2) _fitToOverlay();
  });
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _closeInternal() {
  _isOpen = false;
  _mapPage.classList.remove('open');
  _fab.classList.remove('map-open');
  document.body.style.overflow = '';
  _hideWindPopup();
  _clearShotOverlay();
  _stopCompass();
  _playerPos     = null;
  _liveRotate     = false;
  _overlayBearing = 0;
  _mapBearing     = 0;
  _lockBtn?.classList.remove('locked');
  const arrow = _lockBtn?.querySelector('.map-lock-arrow');
  if (arrow) arrow.style.transform = '';
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
  playerEl.innerHTML =
    '<div class="map-player-dot"></div>' +
    '<div class="map-player-ring"></div>';
  _playerMarker = new mapboxgl.Marker({ element: playerEl, anchor: 'center' }).setLngLat([0, 0]);

  const teeEl = document.createElement('div');
  teeEl.className = 'map-tee-marker';
  teeEl.innerHTML = '<div class="map-tee-pin"></div>';
  _teeMarker = new mapboxgl.Marker({ element: teeEl, anchor: 'bottom' }).setLngLat([0, 0]);
}

function _whenStyleLoaded(cb) {
  if (!_map) return;
  if (_map.isStyleLoaded()) cb();
  else _map.once('style.load', cb);
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
  _playerPos = pos;
  // Face player direction on first load (compass has had time to settle during GPS averaging).
  if (_currentHeading !== 0 && _mapBearing === 0) _mapBearing = _currentHeading;
  _overlayBearing = _currentHeading;

  _whenStyleLoaded(() => {
    _renderShotOverlay();
    if (_shotDots.length >= 2) {
      _fitToOverlay();
    } else {
      // No overlay — centre on player
      const h   = _mapContainer.clientHeight;
      const pad = Math.round(h * 0.55);
      _map.easeTo({
        center:   [pos.lon, pos.lat],
        zoom:     17,
        bearing:  _mapBearing,
        padding:  { top: pad, bottom: 0, left: 0, right: 0 },
        duration: 600,
      });
    }
  });

  _renderInfoStrip(pos, snapshot);
}

// ── Lock rotation ─────────────────────────────────────────────────────────────

function _toggleLock() {
  const arrow = _lockBtn?.querySelector('.map-lock-arrow');
  if (_liveRotate) {
    // Disengage — freeze at current bearing
    _liveRotate = false;
    _lockBtn?.classList.remove('locked');
    if (arrow) arrow.style.transform = '';
  } else {
    // Engage — start live rotation and immediately snap to current heading
    _liveRotate = true;
    _mapBearing = _currentHeading;
    _map?.easeTo({ bearing: _currentHeading, duration: 300 });
    _lockBtn?.classList.add('locked');
    if (arrow) arrow.style.transform = `rotate(${Math.round(_currentHeading)}deg)`;
  }
}

// ── Compass / player direction ─────────────────────────────────────────────────

function _startCompass() {
  if (_compassAbsHandler) return;
  let absFired = false;

  _compassAbsHandler = (ev) => {
    absFired = true;
    const h = ev.webkitCompassHeading != null
      ? ev.webkitCompassHeading
      : (360 - (ev.alpha ?? 0)) % 360;
    if (h != null && !isNaN(h)) _updatePlayerCone(h);
  };
  window.addEventListener('deviceorientationabsolute', _compassAbsHandler);

  setTimeout(() => {
    if (!absFired) {
      _compassFbHandler = (ev) => {
        const h = ev.webkitCompassHeading != null
          ? ev.webkitCompassHeading
          : (360 - (ev.alpha ?? 0)) % 360;
        if (h != null && !isNaN(h)) _updatePlayerCone(h);
      };
      window.addEventListener('deviceorientation', _compassFbHandler);
    }
  }, 500);
}

function _stopCompass() {
  if (_compassAbsHandler) {
    window.removeEventListener('deviceorientationabsolute', _compassAbsHandler);
    _compassAbsHandler = null;
  }
  if (_compassFbHandler) {
    window.removeEventListener('deviceorientation', _compassFbHandler);
    _compassFbHandler = null;
  }
}

function _updatePlayerCone(heading) {
  _currentHeading = heading;
  if (_liveRotate && _map && Math.abs(heading - _mapBearing) > 0.5) {
    _mapBearing = heading;
    _map.easeTo({ bearing: heading, duration: 200, easing: t => t });
    const arrow = _lockBtn?.querySelector('.map-lock-arrow');
    if (arrow) arrow.style.transform = `rotate(${Math.round(heading)}deg)`;
  }
}

// ── Shot overlay ───────────────────────────────────────────────────────────────

function _midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
}

function _clearShotOverlay() {
  _shotMarkers.forEach(m => m.remove());
  _labelMarkers.forEach(m => m.remove());
  _shotMarkers  = [];
  _labelMarkers = [];
  _shotDots       = [];
  _nominalDists   = [];
  _shotClubs      = [];
  _shotWindDeltas = [];
  if (_map) {
    if (_map.getLayer('shot-line-layer')) _map.removeLayer('shot-line-layer');
    if (_map.getSource('shot-line'))      _map.removeSource('shot-line');
  }
}

function _setLineGeoJSON(dots) {
  if (!_map) return;
  const coords = dots.map(d => [d.lon, d.lat]);
  const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
  if (_map.getSource('shot-line')) {
    _map.getSource('shot-line').setData(data);
  } else {
    _map.addSource('shot-line', { type: 'geojson', data });
    _map.addLayer({
      id:     'shot-line-layer',
      type:   'line',
      source: 'shot-line',
      paint: {
        'line-color':   '#ffffff',
        'line-width':   1.5,
        'line-opacity': 0.92,
      },
    });
  }
}

function _formatClub(key) {
  if (!key) return '';
  if (/^\d+$/.test(key)) return `${key}°`;
  if (key === 'driver') return 'Driver';
  if (key.endsWith('i')) return key; // irons: preserve lowercase i (7i, 5i…)
  return key.toUpperCase();
}

function _labelText(dist, club, windDelta) {
  let text = `${Math.round(dist)}m`;
  if (windDelta) text += ` ${windDelta > 0 ? '+' : ''}${windDelta}`;
  if (club) text += ` · ${_formatClub(club)}`;
  return text;
}

function _addLabelMarker(pos, text, color) {
  const el = document.createElement('div');
  el.className = 'map-shot-label';
  el.textContent = text;
  if (color) el.style.background = color;
  const m = new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat([pos.lon, pos.lat])
    .addTo(_map);
  _labelMarkers.push(m);
  return m;
}


function _buildDots(strategy, teeMark, bearing) {
  const dots       = [{ lat: teeMark.lat, lon: teeMark.lon }];
  const dists      = [];
  const clubs      = [];
  const windDeltas = [];
  let b = bearing;
  for (const shot of strategy.shots) {
    const prev = dots[dots.length - 1];
    const next = _callbacks.destinationFromBearing(prev.lat, prev.lon, b, shot.total);
    dots.push(next);
    dists.push(shot.total);
    clubs.push(shot.key ?? null);
    const delta = shot.baseCarry != null ? Math.round(shot.carry - shot.baseCarry) : 0;
    windDeltas.push(delta !== 0 ? delta : null);
    b = _callbacks.getBearingBetween(prev.lat, prev.lon, next.lat, next.lon);
  }
  if (strategy.approach > 0) {
    const prev = dots[dots.length - 1];
    const next = _callbacks.destinationFromBearing(prev.lat, prev.lon, b, strategy.approach);
    dots.push(next);
    dists.push(strategy.approach);
    clubs.push(strategy.approachClubKey ?? null);
    windDeltas.push(null);
  }
  return { dots, dists, clubs, windDeltas };
}

function _fitToOverlay() {
  if (!_map || _shotDots.length < 2) return;
  const bounds = new mapboxgl.LngLatBounds();
  _shotDots.forEach(d => bounds.extend([d.lon, d.lat]));
  _map.fitBounds(bounds, {
    bearing:  _mapBearing,
    padding:  { top: 160, bottom: 100, left: 60, right: 60 },
    maxZoom:  18,
    duration: 700,
  });
}

function _renderPar3Overlay(par3, teeMark, courseId, holeIdx) {
  const club      = par3.s;
  const bearing   = _overlayBearing;
  const landing   = _callbacks.destinationFromBearing(teeMark.lat, teeMark.lon, bearing, club.total);
  const windDelta = club.baseCarry != null ? Math.round(club.carry - club.baseCarry) : 0;
  const dots      = [{ lat: teeMark.lat, lon: teeMark.lon }, landing];

  // Restore cached dragged position for this hole if available.
  const cacheKey = `${courseId}|${holeIdx}|par3`;
  const cached = _dotPosCache[cacheKey];
  if (cached?.length === 1) dots[1] = cached[0];

  _activeStratColor = '#888';
  _shotDots       = dots;
  _nominalDists   = [club.total];
  _shotClubs      = [club.key];
  _shotWindDeltas = [windDelta !== 0 ? windDelta : null];

  _setLineGeoJSON(dots);
  _addLabelMarker(
    _midpoint(dots[0], dots[1]),
    _labelText(club.total, club.key, windDelta !== 0 ? windDelta : null),
    '#888',
  );

  const dotEl = document.createElement('div');
  dotEl.className = 'map-shot-dot';
  dotEl.innerHTML = `<svg width="40" height="40" viewBox="-2 -74.459 111.77 80.459" fill="#fff"><path d="${_SCOPE_PATH}"/></svg>`;

  const marker = new mapboxgl.Marker({ element: dotEl, anchor: 'center', draggable: true })
    .setLngLat([dots[1].lon, dots[1].lat])
    .addTo(_map);

  marker.on('drag', () => {
    const { lng, lat } = marker.getLngLat();
    _shotDots[1] = { lat, lon: lng };
    _setLineGeoJSON(_shotDots);
    const d       = _callbacks.haversine(dots[0].lat, dots[0].lon, lat, lng);
    const bestKey = _callbacks.findBestClubForDist?.(d, true) ?? club.key;
    if (_labelMarkers[0]) {
      const mid = _midpoint(dots[0], { lat, lon: lng });
      _labelMarkers[0].setLngLat([mid.lon, mid.lat]);
      _labelMarkers[0].getElement().textContent = _labelText(d, bestKey, _shotWindDeltas[0]);
    }
  });
  marker.on('dragend', () => {
    const d = _callbacks.haversine(
      dots[0].lat, dots[0].lon, _shotDots[1].lat, _shotDots[1].lon
    );
    _callbacks.commitClubOverride?.([{ key: 'par3', dist: d }], null);
    _dotPosCache[cacheKey] = [_shotDots[1]];
  });
  _shotMarkers.push(marker);
}

function _renderShotOverlay() {
  _clearShotOverlay();
  if (!_map || !_map.isStyleLoaded()) return;

  const session  = _callbacks.getActiveSession?.();
  const courseId = session?.id;
  const holeIdx  = session?.id ? (session.holeIdx ?? 0) : null;
  if (!courseId || holeIdx === null) return;

  const snapshot = _callbacks.getGpsSnapshot?.();
  const teeMark  = snapshot?.teeMark ?? (_playerPos ? { lat: _playerPos.lat, lon: _playerPos.lon } : null);
  if (!teeMark) return;

  // ── Par 3 ──────────────────────────────────────────────────────────────────
  const par3 = _callbacks.getPar3Plan?.();
  if (par3) {
    _renderPar3Overlay(par3, teeMark, courseId, holeIdx);
    return;
  }

  // ── Par 4 / 5 ──────────────────────────────────────────────────────────────
  const committed = _callbacks.getCommittedStrategy?.(courseId, holeIdx);
  const committedType = committed?.split(' · ')[0] ?? null;
  // Fall back to the carousel's active/recommended plan if nothing is committed.
  const type = committedType || _callbacks.getActivePlanType?.() || null;
  if (!type) return;

  const strategies = _callbacks.getComputedStrategies?.() ?? [];
  const strategy   = strategies.find(s => s.type === type);
  if (!strategy || !strategy.shots?.length) return;

  _activeStratColor = _STRAT_COLORS[type] ?? '#888';

  const bearing = _overlayBearing;
  const { dots, dists, clubs, windDeltas } = _buildDots(strategy, teeMark, bearing);

  // Restore user-dragged positions if the dot count matches.
  const cacheKey = `${courseId}|${holeIdx}|${type}`;
  const cached = _dotPosCache[cacheKey];
  if (cached && cached.length === dots.length - 1) {
    for (let i = 1; i < dots.length; i++) dots[i] = cached[i - 1];
  }

  _shotDots       = dots;
  _nominalDists   = dists;
  _shotClubs      = clubs;
  _shotWindDeltas = windDeltas;

  _setLineGeoJSON(dots);

  for (let i = 0; i < dots.length - 1; i++) {
    _addLabelMarker(
      _midpoint(dots[i], dots[i + 1]),
      _labelText(dists[i], clubs[i], windDeltas[i]),
      _activeStratColor,
    );
  }

  for (let i = 1; i < dots.length; i++) {
    const dotEl = document.createElement('div');
    dotEl.className = 'map-shot-dot';
    dotEl.innerHTML = `<svg width="40" height="40" viewBox="-2 -74.459 111.77 80.459" fill="#fff"><path d="${_SCOPE_PATH}"/></svg>`;

    const idx         = i;
    // 'tee' for dot 1, 'shot2' for dot 2 in 2-shot plans, null for approach dot (last).
    const segmentKeys   = [null, 'tee', 'shot2'];
    const segmentKey    = i < dots.length - 1 ? (segmentKeys[i] ?? null) : null;
    const outgoingKey   = i < dots.length - 2 ? (segmentKeys[i + 1] ?? null) : null;
    const excludeDriver = (i > 1);

    const marker = new mapboxgl.Marker({ element: dotEl, anchor: 'center', draggable: true })
      .setLngLat([dots[i].lon, dots[i].lat])
      .addTo(_map);

    marker.on('drag', () => {
      const { lng, lat } = marker.getLngLat();
      _shotDots[idx] = { lat, lon: lng };
      _setLineGeoJSON(_shotDots);

      // Incoming segment — live club lookup.
      const prevDot = _shotDots[idx - 1];
      const d1      = _callbacks.haversine(prevDot.lat, prevDot.lon, lat, lng);
      if (_labelMarkers[idx - 1]) {
        const liveKey = (segmentKey && _callbacks.findBestClubForDist)
          ? (_callbacks.findBestClubForDist(d1, excludeDriver) ?? _shotClubs[idx - 1])
          : _shotClubs[idx - 1];
        const m1 = _midpoint(prevDot, { lat, lon: lng });
        _labelMarkers[idx - 1].setLngLat([m1.lon, m1.lat]);
        _labelMarkers[idx - 1].getElement().textContent = _labelText(d1, liveKey, _shotWindDeltas[idx - 1]);
      }

      // Outgoing segment — live club lookup (skip for approach segment).
      if (idx < _shotDots.length - 1 && _labelMarkers[idx]) {
        const nextDot  = _shotDots[idx + 1];
        const d2       = _callbacks.haversine(lat, lng, nextDot.lat, nextDot.lon);
        const liveKey2 = (outgoingKey && _callbacks.findBestClubForDist)
          ? (_callbacks.findBestClubForDist(d2, true) ?? _shotClubs[idx])
          : _shotClubs[idx];
        const m2 = _midpoint({ lat, lon: lng }, nextDot);
        _labelMarkers[idx].setLngLat([m2.lon, m2.lat]);
        _labelMarkers[idx].getElement().textContent = _labelText(d2, liveKey2, _shotWindDeltas[idx]);
      }
    });

    marker.on('dragend', () => {
      const segs = [];
      if (segmentKey) {
        const d1 = _callbacks.haversine(
          _shotDots[idx - 1].lat, _shotDots[idx - 1].lon, _shotDots[idx].lat, _shotDots[idx].lon
        );
        segs.push({ key: segmentKey, dist: d1 });
      }
      if (outgoingKey) {
        const d2 = _callbacks.haversine(
          _shotDots[idx].lat, _shotDots[idx].lon, _shotDots[idx + 1].lat, _shotDots[idx + 1].lon
        );
        segs.push({ key: outgoingKey, dist: d2 });
      }
      const snappedTo = segs.length ? _callbacks.commitClubOverride?.(segs, type) : null;
      _dotPosCache[cacheKey] = _shotDots.slice(1);
      // If we snapped to a different strategy, migrate dot cache and re-render.
      if (snappedTo && snappedTo !== type) {
        _dotPosCache[`${courseId}|${holeIdx}|${snappedTo}`] = _shotDots.slice(1);
        _renderChips();
        _whenStyleLoaded(() => _renderShotOverlay());
      }
    });
    _shotMarkers.push(marker);
  }

}

// ── Strategy chips ────────────────────────────────────────────────────────────

function _renderChips() {
  if (!_chipsRow) return;
  const session  = _callbacks.getActiveSession?.();
  const courseId = session?.id;
  const holeIdx  = session?.id ? (session.holeIdx ?? 0) : null;

  if (!courseId || holeIdx === null) {
    _chipsRow.innerHTML = '';
    return;
  }

  const committed  = _callbacks.getCommittedStrategy?.(courseId, holeIdx) ?? null;
  const activeType = committed?.split(' · ')[0] ?? null;

  _chipsRow.innerHTML = _STRATEGIES.map(({ type, label, color }) => {
    const isActive = activeType === type;
    const style = isActive ? `background:${color};border-color:${color};color:#fff;` : '';
    return `<button class="map-strategy-chip${isActive ? ' active' : ''}" data-type="${type}" style="${style}" type="button">${label}</button>`;
  }).join('');
}

// ── Wind button helpers ────────────────────────────────────────────────────────

function _bearingLabel(deg) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(((deg % 360) + 360) / 45) % 8];
}

function _setWindBtnLoading(loading) {
  if (!_windBtn) return;
  _windBtn.querySelector('.map-wind-btn-speed').textContent = loading ? '…' : '–';
  _windBtn.disabled = loading;
}

function _updateWindBtn(wind) {
  if (!_windBtn) return;
  const arrow = _windBtn.querySelector('.map-wind-btn-arrow');
  const label = _windBtn.querySelector('.map-wind-btn-speed');
  if (wind?.dirDeg != null) {
    const windTo = Math.round((wind.dirDeg + 180) % 360);
    arrow.style.transform = `rotate(${windTo}deg)`;
  }
  if (wind?.speedMs != null) {
    label.textContent = wind.speedMs < 1 ? 'Calm' : `${wind.speedMs.toFixed(1)}`;
  }
}

function _showWindPopup(wind) {
  if (!_windBtn || !wind) return;
  _hideWindPopup();
  _windPopup = document.createElement('div');
  _windPopup.className = 'map-wind-popup';
  const rows = [];
  if (wind.speedMs != null) {
    const dir = wind.dirDeg != null ? ` from ${_bearingLabel(wind.dirDeg)}` : '';
    const spd = wind.speedMs < 1 ? 'Calm' : `${wind.speedMs.toFixed(1)} m/s${dir}`;
    rows.push(['Wind', spd]);
  }
  if (wind.gustMs != null && wind.gustMs > (wind.speedMs ?? 0))
    rows.push(['Gust', `${wind.gustMs.toFixed(1)} m/s`]);
  if (wind.tempC != null)
    rows.push(['Temp', `${Math.round(wind.tempC)}°C`]);
  if (wind.feelsLike != null && Math.round(wind.feelsLike) !== Math.round(wind.tempC))
    rows.push(['Feels', `${Math.round(wind.feelsLike)}°C`]);
  if (wind.rainPct != null)
    rows.push(['Rain', `${Math.round(wind.rainPct)}%`]);
  _windPopup.innerHTML = rows.map(([k, v]) =>
    `<div class="map-wind-popup-row"><span class="map-wind-popup-label">${k}</span><span class="map-wind-popup-value">${v}</span></div>`
  ).join('');
  _mapPage.appendChild(_windPopup);
}

function _hideWindPopup() {
  if (_windPopup) { _windPopup.remove(); _windPopup = null; }
}

// ── Info strip ────────────────────────────────────────────────────────────────

function _renderInfoStrip(pos, snapshot) {
  if (!_infoStrip) return;
  const session  = _callbacks.getActiveSession?.();
  const courseId = session?.id;
  const holeIdx  = session?.id ? (session.holeIdx ?? 0) : null;
  const holeNum  = holeIdx !== null ? holeIdx + 1 : null;

  let leftHtml = '';
  if (holeNum) {
    leftHtml += `<span class="map-info-hole">Hole ${holeNum}</span>`;
    const course = courseId ? _callbacks.getCourse?.(courseId) : null;
    const hole   = course?.holes?.[holeIdx];
    if (hole?.length) leftHtml += `<span class="map-info-sep">·</span><span class="map-info-length">${hole.length}m</span>`;
    if (hole?.si)     leftHtml += `<span class="map-info-sep">·</span><span class="map-info-si">SI ${hole.si}</span>`;
    if (courseId && session?.hcpEnabled) {
      const counts  = _callbacks.getStrokeCounts?.(courseId);
      const strokes = counts?.[holeIdx] ?? 0;
      if (strokes > 0) leftHtml += `<span class="map-info-hcp-dots">${'●'.repeat(strokes)}</span>`;
    }
  } else {
    leftHtml += `<span class="map-info-locating">Locating…</span>`;
  }

  const rightHtml = `<button class="map-card-btn" type="button">SCORECARD</button>`;

  _infoStrip.innerHTML =
    `<div class="map-info-left">${leftHtml}</div>` +
    `<div class="map-info-right">${rightHtml}</div>`;
}

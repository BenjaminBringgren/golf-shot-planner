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
let _activeStratColor  = '#888';
let _customOverride    = false; // true after a drag that didn't snap to any named strategy
let _activeArcIdx      = 1;    // which scope dot currently shows the dispersion arc
let _shot2Collapsing   = false; // true while tee drag has pushed shot2 below collapse threshold

// Persists dot positions the user has dragged, keyed by 'courseId|holeIdx|strategyType'.
// Survives map close/reopen within the same session.
const _dotPosCache = {};

export function clearDotPosCache() {
  Object.keys(_dotPosCache).forEach(k => delete _dotPosCache[k]);
}


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
    _customOverride = false;
    if (type === 'Custom') {
      // Tapping CUST chip when already custom → no-op; otherwise ignore
    } else if (currentType === type) {
      _callbacks.clearCommittedStrategy?.(courseId, holeIdx);
      _callbacks.clearStrategyOverrides?.(type);
    } else {
      _callbacks.setCommittedStrategy?.(courseId, holeIdx, type, current);
      _callbacks.clearStrategyOverrides?.(type);
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
  _customOverride = false;
  _activeArcIdx   = 1;
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
  // Re-fetch GPS so the player dot and tee marker update for the new hole.
  // _locateAndCenter is async; it does a second render+fit once the fix completes.
  _locateAndCenter();
}

// ── Internal ──────────────────────────────────────────────────────────────────

function _closeInternal() {
  _isOpen = false;
  _customOverride = false;
  _activeArcIdx   = 1;
  _mapPage.classList.remove('open');
  _fab.classList.remove('map-open');
  document.body.style.overflow = '';
  _hideWindPopup();
  _clearShotOverlay();
  _clearArcLayer();
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
  // Always re-orient to current heading so hole switches update the map rotation.
  if (_currentHeading !== 0) _mapBearing = _currentHeading;
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

async function _toggleLock() {
  const arrow = _lockBtn?.querySelector('.map-lock-arrow');
  if (_liveRotate) {
    // Disengage — freeze at current bearing.
    _liveRotate = false;
    _lockBtn?.classList.remove('locked');
    if (arrow) arrow.style.transform = '';
    return;
  }
  // iOS 13+ requires an explicit user-gesture permission request before
  // DeviceOrientationEvent fires. Do it here so the tap qualifies.
  if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
    let result;
    try { result = await DeviceOrientationEvent.requestPermission(); } catch (_) { return; }
    if (result !== 'granted') return;
    // Restart listeners now that permission is confirmed.
    _stopCompass();
    _startCompass();
  }
  // Engage — start live rotation and immediately snap to current heading.
  _liveRotate = true;
  _mapBearing = _currentHeading;
  _map?.easeTo({ bearing: _currentHeading, duration: 300 });
  _lockBtn?.classList.add('locked');
  if (arrow) arrow.style.transform = `rotate(${Math.round(_currentHeading)}deg)`;
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
  // One-time initial orientation: snap map to player direction as soon as the
  // first compass reading arrives, without waiting for GPS to resolve.
  if (_map && _mapBearing === 0 && heading !== 0) {
    _mapBearing     = heading;
    _overlayBearing = heading;
    _map.easeTo({ bearing: heading, duration: 400 });
  }
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
  _shotDots         = [];
  _nominalDists     = [];
  _shotClubs        = [];
  _shotWindDeltas   = [];
  _shot2Collapsing  = false;
  if (_map) {
    if (_map.getLayer('shot-line-layer')) _map.removeLayer('shot-line-layer');
    if (_map.getSource('shot-line'))      _map.removeSource('shot-line');
  }
}

function _catmullRomCoords(dots, steps = 16) {
  const pts = dots.map(d => [d.lon, d.lat]);
  if (pts.length < 2) return pts;
  // Phantom endpoints via reflection so the curve reaches both terminals.
  const ext = [
    [2*pts[0][0] - pts[1][0], 2*pts[0][1] - pts[1][1]],
    ...pts,
    [2*pts[pts.length-1][0] - pts[pts.length-2][0], 2*pts[pts.length-1][1] - pts[pts.length-2][1]],
  ];
  const out = [];
  const last = ext.length - 3;
  for (let i = 1; i <= last; i++) {
    const [x0,y0] = ext[i-1], [x1,y1] = ext[i], [x2,y2] = ext[i+1], [x3,y3] = ext[i+2];
    for (let j = 0; j <= (i === last ? steps : steps - 1); j++) {
      const t = j / steps, t2 = t*t, t3 = t2*t;
      out.push([
        0.5*((2*x1)+(-x0+x2)*t+(2*x0-5*x1+4*x2-x3)*t2+(-x0+3*x1-3*x2+x3)*t3),
        0.5*((2*y1)+(-y0+y2)*t+(2*y0-5*y1+4*y2-y3)*t2+(-y0+3*y1-3*y2+y3)*t3),
      ]);
    }
  }
  return out;
}

function _metersPerPixel() {
  if (!_map) return 1;
  const c = _map.getCenter();
  return (40075016.686 * Math.cos(c.lat * Math.PI / 180)) / (256 * Math.pow(2, _map.getZoom()));
}

function _setLineGeoJSON(dots) {
  if (!_map) return;

  let geometry;
  if (dots.length < 2) {
    geometry = { type: 'LineString', coordinates: [] };
  } else {
    const allCoords = _catmullRomCoords(dots);
    const mpp = _metersPerPixel();
    // Inner circle radius ≈14 px at 52px render size; outer ring covers 14–17px.
    // Masking at the inner boundary lets the opaque outer ring hide the transition.
    const SCOPE_R = 14 * mpp;
    const APPR_R  =  8 * mpp;
    // dot[0] = tee/player (no clip); interior dots = scopes; last dot:
    //   par3 (2 dots) — last is a scope; par4/5 (3+ dots) — last is approach circle.
    const radii = dots.map((_, i) => {
      if (i === 0) return 0;
      if (i === dots.length - 1 && dots.length > 2) return APPR_R;
      return SCOPE_R;
    });
    // Squared distance (metres) from a GeoJSON coord to a dot.
    const sqDist = (coord, dot) => {
      const dx = (coord[0] - dot.lon) * 111320 * Math.cos(dot.lat * Math.PI / 180);
      const dy = (coord[1] - dot.lat) * 110574;
      return dx * dx + dy * dy;
    };
    // Mark coords that fall inside any scope/approach circle.
    const masked = allCoords.map(coord =>
      dots.some((dot, i) => radii[i] > 0 && sqDist(coord, dot) < radii[i] * radii[i])
    );
    // Split into visible segments (MultiLineString).
    const segments = [];
    let seg = [];
    for (let i = 0; i < allCoords.length; i++) {
      if (!masked[i]) {
        seg.push(allCoords[i]);
      } else {
        if (seg.length >= 2) segments.push(seg);
        seg = [];
      }
    }
    if (seg.length >= 2) segments.push(seg);
    geometry = segments.length === 1
      ? { type: 'LineString',      coordinates: segments[0] }
      : { type: 'MultiLineString', coordinates: segments };
  }

  const data = { type: 'Feature', geometry };
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
  const d = Math.round(dist);
  let text = windDelta ? `Plays like ${d - windDelta}m` : `${d}m`;
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
  if (_playerPos) bounds.extend([_playerPos.lon, _playerPos.lat]);
  _map.fitBounds(bounds, {
    bearing:  _mapBearing,
    padding:  { top: 160, bottom: 140, left: 60, right: 60 },
    maxZoom:  18,
    duration: 700,
  });
}

// ── Dispersion arc ────────────────────────────────────────────────────────────

// 95th-percentile (1.65 SD) lateral spread in metres for driver, by HCP band.
const _DRIVER_95 = [
  { maxHcp:  5, r: 33 },
  { maxHcp: 12, r: 43 },
  { maxHcp: 20, r: 54 },
  { maxHcp: 28, r: 69 },
  { maxHcp: 54, r: 92 },
];
// Lateral spread scale relative to driver, by club key.
const _DISP_SCALE = {
  driver: 1.00, fw3: 0.85, fw5: 0.80, fw7: 0.78,
  hy3: 0.75, hy4: 0.75, hy5: 0.75, hy6: 0.75,
  '2i': 0.73, u2: 0.73, u3: 0.73, u4: 0.73,
  '3i': 0.72, '4i': 0.72,
  '5i': 0.70, '6i': 0.70, '7i': 0.68, '8i': 0.68,
  '9i': 0.65, pw: 0.65,
  '48': 0.62, '50': 0.62, '52': 0.60, '54': 0.58,
  '56': 0.56, '58': 0.54, '60': 0.52,
};

function _dispersionRadius(clubKey, hcp) {
  const band = _DRIVER_95.find(b => hcp <= b.maxHcp) ?? _DRIVER_95[_DRIVER_95.length - 1];
  return band.r * (_DISP_SCALE[clubKey] ?? 0.70);
}

function _bearingDeg(from, to) {
  const φ1 = from.lat * Math.PI / 180, φ2 = to.lat * Math.PI / 180;
  const Δλ = (to.lon - from.lon) * Math.PI / 180;
  return (Math.atan2(
    Math.sin(Δλ) * Math.cos(φ2),
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  ) * 180 / Math.PI + 360) % 360;
}

function _destinationPoint(from, bearingDeg, distM) {
  const R = 6371000, δ = distM / R, θ = bearingDeg * Math.PI / 180;
  const φ1 = from.lat * Math.PI / 180, λ1 = from.lon * Math.PI / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: φ2 * 180 / Math.PI, lon: λ2 * 180 / Math.PI };
}

function _arcCoords(center, bearingDeg, radiusM, steps = 48) {
  const R = 6371000, coords = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (bearingDeg - 65 + 130 * i / steps) * Math.PI / 180;
    const δ = radiusM / R;
    const φ1 = center.lat * Math.PI / 180, λ1 = center.lon * Math.PI / 180;
    const φ2 = Math.asin(Math.sin(φ1)*Math.cos(δ) + Math.cos(φ1)*Math.sin(δ)*Math.cos(angle));
    const λ2 = λ1 + Math.atan2(Math.sin(angle)*Math.sin(δ)*Math.cos(φ1), Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));
    coords.push([λ2 * 180 / Math.PI, φ2 * 180 / Math.PI]);
  }
  return coords;
}

function _setArcGeoJSON(center, bearingDeg, radiusM, color) {
  if (!_map) return;
  const coords = _arcCoords(center, bearingDeg, radiusM);
  const data = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
  if (_map.getSource('arc-line')) {
    _map.getSource('arc-line').setData(data);
    _map.setPaintProperty('arc-line-layer', 'line-color', color);
  } else {
    _map.addSource('arc-line', { type: 'geojson', data });
    _map.addLayer({
      id: 'arc-line-layer', type: 'line', source: 'arc-line',
      paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 0.7 },
    });
  }
}

function _clearArcLayer() {
  if (_map?.getSource('arc-line')) {
    _map.getSource('arc-line').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] } });
  }
}

function _refreshArc() {
  if (!_map || _shotDots.length < 2 || _activeArcIdx < 1 || _activeArcIdx >= _shotDots.length) {
    _clearArcLayer();
    return;
  }
  const hcp     = _callbacks?.getHandicap?.() ?? 20;
  const center  = _shotDots[_activeArcIdx];
  const bearing = _bearingDeg(_shotDots[_activeArcIdx - 1], center);
  const clubKey = _shotClubs[_activeArcIdx - 1];
  if (!clubKey) { _clearArcLayer(); return; }
  _setArcGeoJSON(center, bearing, _dispersionRadius(clubKey, hcp), '#ffffff');
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
  const par3LabelDist = cached?.length === 1
    ? _callbacks.haversine(dots[0].lat, dots[0].lon, dots[1].lat, dots[1].lon)
    : club.total;
  _addLabelMarker(
    _midpoint(dots[0], dots[1]),
    _labelText(par3LabelDist, club.key, windDelta !== 0 ? windDelta : null),
    '#888',
  );

  const dotEl = document.createElement('div');
  dotEl.className = 'map-shot-dot';
  dotEl.innerHTML = `<svg width="52" height="52" viewBox="-2 -74.459 111.77 80.459" fill="#fff"><path d="${_SCOPE_PATH}"/></svg>`;

  const marker = new mapboxgl.Marker({ element: dotEl, anchor: 'center', draggable: true })
    .setLngLat([dots[1].lon, dots[1].lat])
    .addTo(_map);

  marker.on('drag', () => {
    const { lng, lat } = marker.getLngLat();
    _shotDots[1] = { lat, lon: lng };
    _setLineGeoJSON(_shotDots);
    _refreshArc();
    const d       = _callbacks.haversine(dots[0].lat, dots[0].lon, lat, lng);
    const bestKey = _callbacks.findBestClubForDist?.(d, true)?.key ?? club.key;
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
  _activeArcIdx = 1;
  _refreshArc();
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

  _activeStratColor = _customOverride ? '#888' : (_STRAT_COLORS[type] ?? '#888');

  const bearing = _overlayBearing;
  const { dots, dists, clubs, windDeltas } = _buildDots(strategy, teeMark, bearing);

  // Restore user-dragged positions if the dot count matches.
  const cacheKey = `${courseId}|${holeIdx}|${type}`;
  const cached = _dotPosCache[cacheKey];
  const hasCached = cached && cached.length === dots.length - 1;
  if (hasCached) {
    for (let i = 1; i < dots.length; i++) dots[i] = cached[i - 1];
  }

  _shotDots       = dots;
  _nominalDists   = dists;
  _shotClubs      = clubs;
  _shotWindDeltas = windDeltas;
  if (_activeArcIdx >= dots.length) _activeArcIdx = 1;

  _setLineGeoJSON(dots);

  for (let i = 0; i < dots.length - 1; i++) {
    // When cached positions are in use, recalculate the actual segment distance so
    // the label reflects the true haversine distance rather than the plan distance.
    const labelDist = hasCached
      ? _callbacks.haversine(dots[i].lat, dots[i].lon, dots[i + 1].lat, dots[i + 1].lon)
      : dists[i];
    // For the approach segment (last) with cached positions, find the club that actually
    // matches the dragged distance rather than using the engine's original calculation.
    const isApproachSeg = hasCached && i === dots.length - 2 && dots.length > 2;
    const labelClub = isApproachSeg
      ? (_callbacks.findBestClubForDist?.(labelDist, true)?.key ?? clubs[i])
      : clubs[i];
    _addLabelMarker(
      _midpoint(dots[i], dots[i + 1]),
      _labelText(labelDist, labelClub, windDeltas[i]),
      _activeStratColor,
    );
  }

  for (let i = 1; i < dots.length; i++) {
    const dotEl = document.createElement('div');
    dotEl.className = 'map-shot-dot';
    const isApproach = (i === dots.length - 1);
    dotEl.innerHTML = isApproach
      ? `<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8" fill="#fff" stroke="rgba(0,0,0,0.25)" stroke-width="1.5"/></svg>`
      : `<svg width="52" height="52" viewBox="-2 -74.459 111.77 80.459" fill="#fff"><path d="${_SCOPE_PATH}"/></svg>`;

    const idx         = i;
    // 'tee' for dot 1, 'shot2' for dot 2 in 2-shot plans, null for approach dot (last).
    const segmentKeys   = [null, 'tee', 'shot2'];
    const segmentKey    = i < dots.length - 1 ? (segmentKeys[i] ?? null) : null;
    const outgoingKey   = i < dots.length - 2 ? (segmentKeys[i + 1] ?? null) : null;
    const excludeDriver = (i > 1);

    dotEl.addEventListener('click', (e) => {
      e.stopPropagation();
      _activeArcIdx = idx;
      _refreshArc();
    });

    const marker = new mapboxgl.Marker({ element: dotEl, anchor: 'center', draggable: true })
      .setLngLat([dots[i].lon, dots[i].lat])
      .addTo(_map);

    // Fixed bearing captured at drag-start so lateral tee drags don't rotate shot2.
    let _dragBearing = null;
    marker.on('dragstart', () => {
      if (outgoingKey === 'shot2') {
        _dragBearing = _bearingDeg(_shotDots[idx], _shotDots[idx + 1]);
      }
    });

    marker.on('drag', () => {
      const { lng, lat } = marker.getLngLat();
      _shotDots[idx] = { lat, lon: lng };

      // Elastic shot2 follow with collapse detection.
      // Shot2 fades out when the tee landing is close enough that shot2 would overshoot
      // or leave less than MIN_APPROACH meters before the green (= 2-shot territory).
      if (outgoingKey === 'shot2' && _callbacks.findBestClubForDist && _dragBearing !== null) {
        const approachDot    = _shotDots[_shotDots.length - 1];
        const distToApproach = _callbacks.haversine(lat, lng, approachDot.lat, approachDot.lon);

        // Two separate concepts:
        // COLLAPSE — tee so close to green that no shot2 fits at all (< 50m remaining).
        // CLAMP    — shot2 elastic follow, but cap it so it never overshoots the green.
        const COLLAPSE_THRESHOLD = 50;
        const APPROACH_BUFFER    = 20; // minimum metres left for approach after shot2

        const shouldCollapse = distToApproach < COLLAPSE_THRESHOLD;

        if (shouldCollapse) {
          if (!_shot2Collapsing) {
            _shot2Collapsing = true;
            _shotMarkers[idx]?.getElement()?.style.setProperty('opacity', '0');
          }
          // Update the tee→approach label to show the direct remaining distance.
          if (_labelMarkers[idx]) {
            const aKey = _callbacks.findBestClubForDist?.(distToApproach, true)?.key ?? null;
            const m    = _midpoint({ lat, lon: lng }, approachDot);
            _labelMarkers[idx].setLngLat([m.lon, m.lat]);
            _labelMarkers[idx].getElement().textContent = _labelText(distToApproach, aKey, null);
          }
          // Silence the shot2→approach label.
          if (_labelMarkers[idx + 1]) _labelMarkers[idx + 1].getElement().textContent = '';
        } else {
          if (_shot2Collapsing) {
            _shot2Collapsing = false;
            _shotMarkers[idx]?.getElement()?.style.setProperty('opacity', '1');
          }
          const curShot2 = _shotDots[idx + 1];
          const d2raw    = _callbacks.haversine(lat, lng, curShot2.lat, curShot2.lon);
          const res2     = _callbacks.findBestClubForDist(d2raw, true);
          if (res2?.total) {
            // Clamp: shot2 must leave at least APPROACH_BUFFER metres before the green.
            const shot2Dist = Math.min(res2.total, distToApproach - APPROACH_BUFFER);
            if (shot2Dist > 0) {
              const newShot2 = _destinationPoint({ lat, lon: lng }, _dragBearing, shot2Dist);
              _shotDots[idx + 1] = newShot2;
              _shotMarkers[idx]?.setLngLat([newShot2.lon, newShot2.lat]);
            }
          }
        }
      }

      // Draw spline — skip the shot2 dot when collapsed so line goes tee→approach directly.
      const splineDots = (_shot2Collapsing && outgoingKey === 'shot2')
        ? [_shotDots[0], _shotDots[idx], _shotDots[_shotDots.length - 1]]
        : _shotDots;
      _setLineGeoJSON(splineDots);
      if (idx === _activeArcIdx || idx === _activeArcIdx - 1) _refreshArc();

      // Incoming segment — live club lookup.
      const prevDot = _shotDots[idx - 1];
      const d1      = _callbacks.haversine(prevDot.lat, prevDot.lon, lat, lng);
      if (_labelMarkers[idx - 1]) {
        const liveKey = (segmentKey && _callbacks.findBestClubForDist)
          ? (_callbacks.findBestClubForDist(d1, excludeDriver)?.key ?? _shotClubs[idx - 1])
          : _shotClubs[idx - 1];
        const m1 = _midpoint(prevDot, { lat, lon: lng });
        _labelMarkers[idx - 1].setLngLat([m1.lon, m1.lat]);
        _labelMarkers[idx - 1].getElement().textContent = _labelText(d1, liveKey, _shotWindDeltas[idx - 1]);
      }

      // Outgoing segment label — skipped when collapsed (collapse block handles label above).
      if (!_shot2Collapsing && idx < _shotDots.length - 1 && _labelMarkers[idx]) {
        const nextDot  = _shotDots[idx + 1];
        const d2       = _callbacks.haversine(lat, lng, nextDot.lat, nextDot.lon);
        const liveKey2 = (outgoingKey && _callbacks.findBestClubForDist)
          ? (_callbacks.findBestClubForDist(d2, true)?.key ?? _shotClubs[idx])
          : _shotClubs[idx];
        const m2 = _midpoint({ lat, lon: lng }, nextDot);
        _labelMarkers[idx].setLngLat([m2.lon, m2.lat]);
        _labelMarkers[idx].getElement().textContent = _labelText(d2, liveKey2, _shotWindDeltas[idx]);
      }

      // Approach label: reposition when shot2 moved (not applicable when collapsed).
      if (!_shot2Collapsing && outgoingKey === 'shot2' && idx + 2 < _shotDots.length && _labelMarkers[idx + 1]) {
        const shot2Dot    = _shotDots[idx + 1];
        const approachDot = _shotDots[idx + 2];
        const d3 = _callbacks.haversine(shot2Dot.lat, shot2Dot.lon, approachDot.lat, approachDot.lon);
        const m3 = _midpoint(shot2Dot, approachDot);
        _labelMarkers[idx + 1].setLngLat([m3.lon, m3.lat]);
        _labelMarkers[idx + 1].getElement().textContent = _labelText(d3, _shotClubs[idx + 1], _shotWindDeltas[idx + 1]);
      }
    });

    marker.on('dragend', () => {
      _dragBearing = null;
      const wasCollapsing = _shot2Collapsing;
      _shot2Collapsing = false;

      const segs = [];
      if (segmentKey) {
        const d1 = _callbacks.haversine(
          _shotDots[idx - 1].lat, _shotDots[idx - 1].lon, _shotDots[idx].lat, _shotDots[idx].lon
        );
        segs.push({ key: segmentKey, dist: d1 });
      }
      if (outgoingKey === 'shot2') {
        // Collapsed: signal router to clear the shot2 override so the engine picks
        // the optimal 2-shot or 3-shot continuation from the new tee landing.
        // Normal: commit the actual shot2 distance.
        segs.push({ key: 'shot2', dist: wasCollapsing ? null : _callbacks.haversine(
          _shotDots[idx].lat, _shotDots[idx].lon, _shotDots[idx + 1].lat, _shotDots[idx + 1].lon
        )});
      } else if (outgoingKey) {
        const d2 = _callbacks.haversine(
          _shotDots[idx].lat, _shotDots[idx].lon, _shotDots[idx + 1].lat, _shotDots[idx + 1].lon
        );
        segs.push({ key: outgoingKey, dist: d2 });
      }

      const snappedTo = segs.length ? _callbacks.commitClubOverride?.(segs, type) : null;
      if (segs.length) {
        if (snappedTo && snappedTo !== type) {
          delete _dotPosCache[cacheKey];
          _customOverride = false;
        } else if (snappedTo) {
          // Same-strategy snap: only cache tee landing when tee was the dragged dot,
          // so shot2 recalculates fresh. On collapse, cache only tee landing as well.
          _dotPosCache[cacheKey] = (segmentKey === 'tee' || wasCollapsing)
            ? [_shotDots[1]] : _shotDots.slice(1);
          _customOverride = false;
        } else {
          // No snap — custom or collapsed. Cache only tee landing when collapsing
          // since shot2 will be re-placed by the engine on re-render.
          _dotPosCache[cacheKey] = wasCollapsing ? [_shotDots[1]] : _shotDots.slice(1);
          _customOverride = !wasCollapsing;
        }
        _renderChips();
        _whenStyleLoaded(() => _renderShotOverlay());
      }
    });
    _shotMarkers.push(marker);
  }

  _refreshArc();
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

  const custActive = _customOverride;
  const chips = _STRATEGIES.map(({ type, label, color }) => {
    const isActive = !custActive && activeType === type;
    const style = isActive ? `background:${color};border-color:${color};color:#fff;` : '';
    return `<button class="map-strategy-chip${isActive ? ' active' : ''}" data-type="${type}" style="${style}" type="button">${label}</button>`;
  });
  chips.push(
    `<button class="map-strategy-chip${custActive ? ' active' : ''}" data-type="Custom" style="${custActive ? 'background:#888;border-color:#888;color:#fff;' : ''}" type="button">CUST</button>`
  );
  _chipsRow.innerHTML = chips.join('');
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
    arrow.style.transform = `rotate(${Math.round(wind.dirDeg)}deg)`;
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

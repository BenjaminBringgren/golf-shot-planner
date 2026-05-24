/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */

// LAYER 2 — ui — Map view. No business logic, no storage, no platform imports.
// All GPS/session data comes via injected callbacks from router.js.

const MAPBOX_TOKEN = 'pk.eyJ1IjoiZ29sZm1hcCIsImEiOiJjbXBqZHE0NzgwY3JnMnJzYXdqYmwzZTdyIn0.NjQk6PyT7w2uObA_vkuc4Q';
const MAP_STYLE    = 'mapbox://styles/mapbox/satellite-streets-v12';

const _WIND_ARROW_PATH = 'M12.9883 9.13086C15.0391 9.13086 17.1875 7.95898 18.8477 6.39648L33.0566-7.22656C33.5449-7.71484 33.8867-7.95898 34.1797-7.95898C34.5215-7.95898 34.8633-7.71484 35.3516-7.22656L49.5117 6.39648C51.2207 7.95898 53.3203 9.13086 55.3711 9.13086C58.3496 9.13086 60.5957 6.39648 60.5957 3.56445C60.5957 1.80664 59.8145-0.146484 58.8867-2.63672L40.0879-51.5137C38.623-55.3223 36.6211-56.8359 34.1797-56.8359C31.7871-56.8359 29.7363-55.3223 28.2715-51.5137L9.47266-2.63672C8.54492-0.146484 7.8125 1.80664 7.8125 3.56445C7.8125 6.39648 10.0098 9.13086 12.9883 9.13086Z';

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
let _playerConeEl = null;
let _isOpen       = false;
let _callbacks    = null;

let _fab, _mapPage, _mapContainer, _infoStrip, _windBtn, _windPopup, _chipsRow;
let _compassAbsHandler = null;
let _compassFbHandler  = null;
let _currentHeading    = 0;

// ── Shot overlay state ────────────────────────────────────────────────────────
let _shotDots    = [];   // { lat, lon } — full dot array including tee at [0]
let _nominalDists = [];  // nominal distance (m) for each segment [tee→dot1, dot1→dot2, …]
let _shotMarkers  = [];  // mapboxgl.Marker for each draggable dot (dots[1..])
let _labelMarkers = [];  // mapboxgl.Marker for each segment midpoint label
let _warnEl       = null;
let _activeStratColor = '#888';

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
    _renderShotOverlay();
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
  _whenStyleLoaded(() => _renderShotOverlay());
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
  _playerConeEl = null;
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
    '<div class="map-player-cone"></div>' +
    '<div class="map-player-dot"></div>' +
    '<div class="map-player-ring"></div>';
  _playerConeEl = playerEl.querySelector('.map-player-cone');
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
  if (!_playerConeEl) return;
  _playerConeEl.style.display = 'block';
  _playerConeEl.style.transform = `rotate(${Math.round(heading)}deg)`;
}

// ── Shot overlay ───────────────────────────────────────────────────────────────

function _dispersionLimits(nominalDist, hcp) {
  const d = 0.08 + Math.min(36, Math.max(0, hcp ?? 18)) * 0.008;
  return { short: nominalDist * (1 - d * 0.75), long: nominalDist * (1 + d * 0.25) };
}

function _midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
}

function _clearShotOverlay() {
  _shotMarkers.forEach(m => m.remove());
  _labelMarkers.forEach(m => m.remove());
  _shotMarkers  = [];
  _labelMarkers = [];
  _shotDots     = [];
  _nominalDists = [];
  if (_warnEl) { _warnEl.remove(); _warnEl = null; }
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
        'line-color':     _activeStratColor,
        'line-width':     2.5,
        'line-dasharray': [2, 1.5],
        'line-opacity':   0.9,
      },
    });
  }
}

function _addLabelMarker(pos, text) {
  const el = document.createElement('div');
  el.className = 'map-shot-label';
  el.textContent = text;
  const m = new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat([pos.lon, pos.lat])
    .addTo(_map);
  _labelMarkers.push(m);
  return m;
}

function _repositionLabels(dots, dists) {
  for (let i = 0; i < _labelMarkers.length; i++) {
    const mid = _midpoint(dots[i], dots[i + 1]);
    _labelMarkers[i].setLngLat([mid.lon, mid.lat]);
    _labelMarkers[i].getElement().textContent = `${Math.round(dists[i])}m`;
  }
}

function _showWarn(text, dotEl) {
  if (!_warnEl) {
    _warnEl = document.createElement('div');
    _warnEl.className = 'map-shot-warn';
    _mapPage.appendChild(_warnEl);
  }
  _warnEl.textContent = text;
  _warnEl.style.display = 'block';
  // Position near the dot element
  const r = dotEl.getBoundingClientRect();
  const pr = _mapPage.getBoundingClientRect();
  _warnEl.style.left = `${Math.round(r.left - pr.left - 8)}px`;
  _warnEl.style.top  = `${Math.round(r.top  - pr.top  - 32)}px`;
}

function _hideWarn() {
  if (_warnEl) _warnEl.style.display = 'none';
}

function _buildDots(strategy, teeMark, bearing) {
  const dots = [{ lat: teeMark.lat, lon: teeMark.lon }];
  const dists = [];
  let b = bearing;
  for (const shot of strategy.shots) {
    const prev = dots[dots.length - 1];
    const next = _callbacks.destinationFromBearing(prev.lat, prev.lon, b, shot.total);
    dots.push(next);
    dists.push(shot.total);
    b = _callbacks.getBearingBetween(prev.lat, prev.lon, next.lat, next.lon);
  }
  // approach landing dot
  if (strategy.approach > 0) {
    const prev = dots[dots.length - 1];
    const next = _callbacks.destinationFromBearing(prev.lat, prev.lon, b, strategy.approach);
    dots.push(next);
    dists.push(strategy.approach);
  }
  return { dots, dists };
}

function _renderShotOverlay() {
  _clearShotOverlay();
  if (!_map || !_map.isStyleLoaded()) return;

  const session  = _callbacks.getActiveSession?.();
  const courseId = session?.id;
  const holeIdx  = session?.id ? (session.holeIdx ?? 0) : null;
  if (!courseId || holeIdx === null) return;

  const committed = _callbacks.getCommittedStrategy?.(courseId, holeIdx);
  const type = committed?.split(' · ')[0] ?? null;
  if (!type) return;

  const strategies = _callbacks.getComputedStrategies?.() ?? [];
  const strategy   = strategies.find(s => s.type === type);
  if (!strategy || !strategy.shots?.length) return;

  const snapshot = _callbacks.getGpsSnapshot?.();
  const teeMark  = snapshot?.teeMark;
  if (!teeMark) return;

  _activeStratColor = _STRAT_COLORS[type] ?? '#888';

  const { dots, dists } = _buildDots(strategy, teeMark, _currentHeading);
  _shotDots     = dots;
  _nominalDists = dists;

  _setLineGeoJSON(dots);

  // Labels at each segment midpoint
  for (let i = 0; i < dots.length - 1; i++) {
    _addLabelMarker(_midpoint(dots[i], dots[i + 1]), `${Math.round(dists[i])}m`);
  }

  const hcp = _callbacks.getHandicap?.() ?? 18;

  // Draggable dots for dots[1..end]
  for (let i = 1; i < dots.length; i++) {
    const dotEl = document.createElement('div');
    dotEl.className = 'map-shot-dot';
    dotEl.style.background = _activeStratColor;

    const idx = i; // capture for closure
    const marker = new mapboxgl.Marker({ element: dotEl, anchor: 'center', draggable: true })
      .setLngLat([dots[i].lon, dots[i].lat])
      .addTo(_map);

    marker.on('drag', () => {
      const { lng, lat } = marker.getLngLat();
      _shotDots[idx] = { lat, lon: lng };

      // Actual distance from previous dot
      const actualDist = _callbacks.haversine(
        _shotDots[idx - 1].lat, _shotDots[idx - 1].lon, lat, lng
      );

      // Recalculate bearing and all downstream dots
      let b = _callbacks.getBearingBetween(
        _shotDots[idx - 1].lat, _shotDots[idx - 1].lon, lat, lng
      );
      for (let j = idx + 1; j < _shotDots.length; j++) {
        const prev = _shotDots[j - 1];
        _shotDots[j] = _callbacks.destinationFromBearing(prev.lat, prev.lon, b, _nominalDists[j - 1]);
        b = _callbacks.getBearingBetween(prev.lat, prev.lon, _shotDots[j].lat, _shotDots[j].lon);
        _shotMarkers[j - 1].setLngLat([_shotDots[j].lon, _shotDots[j].lat]);
      }

      _setLineGeoJSON(_shotDots);
      _repositionLabels(_shotDots, _nominalDists);

      // Soft dispersion warning
      const limits = _dispersionLimits(_nominalDists[idx - 1], hcp);
      if (actualDist < limits.short) {
        _showWarn('Short of typical range', dotEl);
      } else if (actualDist > limits.long) {
        _showWarn('Long of typical range', dotEl);
      } else {
        _hideWarn();
      }
    });

    marker.on('dragend', () => _hideWarn());

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

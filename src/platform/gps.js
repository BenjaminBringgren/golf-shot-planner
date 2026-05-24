/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 5 — platform — GPS state, geolocation, shot tracking.
// Imports from nothing — raw navigator.geolocation only.

// ── State ──────────────────────────────────────────────────────────────────────
export let teeMarked      = false;
export let completedShots = [];
let teeMark       = null;
let shotNumber    = 0;
let remainingDist = null;

// ── Pure math ──────────────────────────────────────────────────────────────────
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Destination point given origin, compass bearing (°), and distance (m).
export function destinationFromBearing(lat, lon, bearingDeg, distM) {
  const R  = 6371000;
  const d  = distM / R;
  const b  = bearingDeg * Math.PI / 180;
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;
  const φ2 = Math.asin(Math.sin(φ1)*Math.cos(d) + Math.cos(φ1)*Math.sin(d)*Math.cos(b));
  const λ2 = λ1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(φ1), Math.cos(d) - Math.sin(φ1)*Math.sin(φ2));
  return { lat: φ2 * 180 / Math.PI, lon: λ2 * 180 / Math.PI };
}

// Compass bearing (°, 0–360) from point A to point B.
export function getBearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const dLon  = toRad(lon2 - lon1);
  const y     = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x     = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
              - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// ── Geolocation ────────────────────────────────────────────────────────────────
// Takes N GPS readings over ~(n-1)*0.5s and returns inverse-variance weighted position.
export function averagedPosition(n = 6) {
  return new Promise((resolve, reject) => {
    const readings = [];
    let attempts  = 0;
    const opts = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 };

    function take() {
      navigator.geolocation.getCurrentPosition(pos => {
        readings.push(pos);
        attempts++;
        if (attempts < n) {
          setTimeout(take, 500);
        } else {
          const bestAcc  = Math.min(...readings.map(p => p.coords.accuracy));
          const filtered = readings.filter(p => p.coords.accuracy <= bestAcc * 3);
          const pool     = filtered.length >= 2 ? filtered : readings;

          const weights  = pool.map(p => 1 / (p.coords.accuracy ** 2));
          const totalW   = weights.reduce((s, w) => s + w, 0);
          const avgLat   = pool.reduce((s, p, i) => s + p.coords.latitude  * weights[i], 0) / totalW;
          const avgLon   = pool.reduce((s, p, i) => s + p.coords.longitude * weights[i], 0) / totalW;
          const combinedAcc = 1 / Math.sqrt(totalW);

          resolve({ lat: avgLat, lon: avgLon, accuracy: combinedAcc });
        }
      }, reject, opts);
    }
    take();
  });
}

// ── State management ───────────────────────────────────────────────────────────
export function clearGpsState() {
  teeMark = null; shotNumber = 0; remainingDist = null;
  completedShots = []; teeMarked = false;
}

export function markTeePosition(pos) {
  teeMark       = { lat: pos.lat, lon: pos.lon, accuracy: pos.accuracy, timestamp: Date.now() };
  shotNumber    = 0;
  remainingDist = null;
  completedShots = [];
  teeMarked     = true;
}

export function recordShot(pos, holeLen) {
  const shotDist     = Math.round(haversine(teeMark.lat, teeMark.lon, pos.lat, pos.lon));
  shotNumber++;
  const prevRemaining = remainingDist ?? holeLen;
  const newRemaining  = Math.max(0, Math.round(prevRemaining - shotDist));
  remainingDist = newRemaining;
  completedShots.push({
    shotNum:   shotNumber,
    dist:      shotDist,
    remaining: holeLen ? newRemaining : null,
  });
  teeMark = { lat: pos.lat, lon: pos.lon, accuracy: pos.accuracy, timestamp: Date.now() };
  return { shotDist };
}

export function restoreGpsState(saved) {
  teeMark        = saved.teeMark;
  shotNumber     = saved.shotNumber    ?? 0;
  remainingDist  = saved.remainingDist ?? null;
  completedShots = saved.completedShots ?? [];
  teeMarked      = true;
}

export function getGpsSnapshot() {
  return { teeMark, shotNumber, remainingDist, completedShots };
}

/* Copyright © 2025 Benjamin Bringgren. All rights reserved.
   Unauthorised copying or distribution is prohibited. */
// LAYER 5 — platform — weather fetch via Open-Meteo and Nominatim reverse geocode.
// Imports from nothing — raw fetch() only.

export async function fetchWind(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,apparent_temperature,precipitation_probability&wind_speed_unit=ms&forecast_days=1`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Weather fetch failed');
  const data = await resp.json();
  return {
    speedMs:   data.current.wind_speed_10m,
    gustMs:    data.current.wind_gusts_10m,
    dirDeg:    data.current.wind_direction_10m,
    tempC:     data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    rainPct:   data.current.precipitation_probability,
  };
}

export async function fetchLocationName(lat, lon) {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { 'Accept-Language': 'en' }, signal: AbortSignal.timeout(4000) }
    );
    if (!resp.ok) return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
    const data = await resp.json();
    const addr = data.address || {};
    return addr.golf || addr.leisure ||
      [addr.suburb || addr.village || addr.town, addr.city || addr.county]
      .filter(Boolean).join(', ')
      || `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  } catch(_) {
    return `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`;
  }
}

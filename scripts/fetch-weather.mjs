// Fetches the current weather for the site's location from Open-Meteo and
// writes weather.json for the page (docs/product/specs/live-weather.md). Run by the
// deploy workflow on a schedule; visitors never contact the weather service.
//
//   node scripts/fetch-weather.mjs [out=public/weather.json]
//   LIVE_WEATHER=true   switches live weather on (the kill switch: anything
//                       else publishes the file switched off)
//
// Weather data by Open-Meteo.com (CC BY 4.0).
// If the fetch fails, the existing file is left as it is and the script
// exits successfully, so a deploy never fails because of the weather.

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WEATHER_RULES } from '../src/config.js';

const LOC = WEATHER_RULES.location;

export function openMeteoUrl(loc = LOC) {
  const q = new URLSearchParams({
    latitude: String(loc.lat), longitude: String(loc.lon),
    current: 'weather_code,wind_speed_10m,wind_gusts_10m',
    daily: 'sunrise,sunset', timezone: 'Asia/Kolkata', forecast_days: '1', wind_speed_unit: 'kmh',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

// Open-Meteo response -> weather.json document, or null if it looks wrong.
export function toWeatherDoc(om, { enabled, location = LOC.name } = {}) {
  const cur = om?.current;
  if (!cur || typeof cur.time !== 'string' || !Number.isInteger(cur.weather_code)) return null;
  const offset = Number.isFinite(om.utc_offset_seconds) ? om.utc_offset_seconds : 19800;
  const observed = Date.parse(`${cur.time}Z`) - offset * 1000; // local time -> UTC
  if (!Number.isFinite(observed)) return null;
  const hhmm = (t) => (typeof t === 'string' && /T\d{2}:\d{2}/.test(t) ? t.slice(11, 16) : null);
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : 0);
  return {
    enabled: enabled === true,
    location,
    observedAt: new Date(observed).toISOString().replace('.000Z', 'Z'),
    weatherCode: cur.weather_code,
    windKmh: num(cur.wind_speed_10m),
    gustKmh: num(cur.wind_gusts_10m),
    sunrise: hhmm(om.daily?.sunrise?.[0]),
    sunset: hhmm(om.daily?.sunset?.[0]),
    source: 'Weather data by Open-Meteo.com (CC BY 4.0)',
  };
}

async function main() {
  const out = process.argv[2] || 'public/weather.json';
  const enabled = process.env.LIVE_WEATHER === 'true';
  try {
    const res = await fetch(openMeteoUrl(), { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const doc = toWeatherDoc(await res.json(), { enabled });
    if (!doc) throw new Error('unexpected response');
    writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
    console.log(`weather.json: ${doc.location}, code ${doc.weatherCode}, wind ${doc.windKmh} km/h, observed ${doc.observedAt}, ${enabled ? 'ON' : 'off'}`);
  } catch (e) {
    console.log(`weather fetch failed (${e.message}); keeping the existing ${out}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

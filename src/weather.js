// Opening scene from Kerala's weather, and the scene cycle.
// Spec: docs/spec-live-weather.md. Everything here is a pure function so it
// can be tested without a browser or network.
//
// weather.json (produced by a scheduled job, Phase B):
//   {
//     "enabled": true,                     // kill switch
//     "location": "Kochi",
//     "observedAt": "2026-10-17T08:45:00Z", // UTC
//     "weatherCode": 3,                    // WMO code
//     "windKmh": 12, "gustKmh": 20,
//     "sunrise": "06:12", "sunset": "18:05" // Kerala time (IST)
//   }

import { WEATHER_RULES } from './config.js';

const IST_OFFSET_MIN = 330; // India Standard Time, UTC+5:30, no daylight saving

// The order the scenes follow, crossing by crossing: a day moving forward.
export const CYCLE_ORDER = ['dawn', 'sunny', 'wind', 'rain', 'twilight', 'night'];
export const SCENE_NAMES = [...CYCLE_ORDER, 'overcast'];

const RAIN_CODES = (c) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95 && c <= 99);
const OVERCAST_CODES = (c) => c === 3 || c === 45 || c === 48;

// Minutes since midnight, Kerala time.
export function keralaMinutes(now) {
  return (((now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60 + IST_OFFSET_MIN) % 1440) + 1440) % 1440;
}

// Approximate sunrise and sunset (minutes since midnight, Kerala time) for a
// date and place, from the NOAA solar equations. Good to a few minutes, which
// is plenty for choosing a scene when weather data is unavailable.
export function approxSunTimes(now, lat = WEATHER_RULES.location.lat, lon = WEATHER_RULES.location.lon) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start) / 86400000);
  const g = (2 * Math.PI / 365) * (day - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const rad = Math.PI / 180;
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  const ha = Math.acos(Math.max(-1, Math.min(1, cosHa))) / rad;
  const toIst = (utcMin) => (((utcMin + IST_OFFSET_MIN) % 1440) + 1440) % 1440;
  return {
    sunrise: toIst(720 - 4 * (lon + ha) - eqTime),
    sunset: toIst(720 - 4 * (lon - ha) - eqTime),
  };
}

const hhmm = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(typeof s === 'string' ? s : '');
  if (!m) return null;
  const v = +m[1] * 60 + +m[2];
  return v >= 0 && v < 1440 ? v : null;
};

// Check a weather.json document. Returns a clean object, or null when it is
// missing, malformed, switched off or too old to describe "now".
// allowDisabled: the owner's ?weather=live preview ignores the kill switch.
export function validateWeather(doc, now, { allowDisabled = false, rules = WEATHER_RULES } = {}) {
  if (!doc || typeof doc !== 'object') return null;
  if (doc.enabled !== true && !allowDisabled) return null;
  const at = Date.parse(doc.observedAt);
  if (!Number.isFinite(at)) return null;
  const ageMin = (now.getTime() - at) / 60000;
  if (ageMin > rules.maxAgeHours * 60 || ageMin < -10) return null;
  const code = doc.weatherCode;
  if (!Number.isInteger(code) || code < 0 || code > 99) return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  return {
    code,
    windKmh: num(doc.windKmh) ?? 0,
    gustKmh: num(doc.gustKmh) ?? 0,
    sunrise: hhmm(doc.sunrise),
    sunset: hhmm(doc.sunset),
    observedAt: new Date(at),
  };
}

// The opening scene for "now" in Kerala. weather may be null (no data):
// then the choice comes from the time of day alone.
// Returns { scene, reason }.
export function chooseOpeningScene(weather, now, rules = WEATHER_RULES) {
  const t = keralaMinutes(now);
  const approx = approxSunTimes(now, rules.location.lat, rules.location.lon);
  const sunrise = weather?.sunrise ?? approx.sunrise;
  const sunset = weather?.sunset ?? approx.sunset;
  const code = weather?.code;

  if (weather && RAIN_CODES(code)) return { scene: 'rain', reason: `rain (WMO ${code})` };
  if (t > sunset + rules.nightMargin || t < sunrise - rules.nightMargin) return { scene: 'night', reason: 'after dark' };
  if (Math.abs(t - sunrise) <= rules.dawnWindow) return { scene: 'dawn', reason: 'around sunrise' };
  if (t >= sunset - rules.sunsetBefore && t <= sunset + rules.sunsetAfter) return { scene: 'twilight', reason: 'around sunset' };
  if (weather && (weather.windKmh >= rules.windKmh || weather.gustKmh >= rules.gustKmh)) {
    return { scene: 'wind', reason: `wind ${Math.round(weather.windKmh)} km/h, gusts ${Math.round(weather.gustKmh)} km/h` };
  }
  if (weather && OVERCAST_CODES(code)) return { scene: 'overcast', reason: `overcast (WMO ${code})` };
  return { scene: 'sunny', reason: weather ? `clear or partly cloudy (WMO ${code})` : 'daytime (no weather data)' };
}

// The scene after this one in the cycle. Overcast sits where Rain does.
export function nextScene(current) {
  const i = CYCLE_ORDER.indexOf(current === 'overcast' ? 'rain' : current);
  return CYCLE_ORDER[(i + 1) % CYCLE_ORDER.length];
}

// ---------------------------------------------------------------------------
// Shuffle opening (docs/stories/1.1.shuffle-and-advance-opening.md):
// a fresh visit opens on a random scene; a reload of the same tab opens on
// the scene after the one that was last on screen.
// ---------------------------------------------------------------------------
export const LAST_SCENE_KEY = 'wfn.lastScene';

// last: the scene last on screen in this tab (or null). random: () => [0, 1).
export function chooseShuffleScene(last, random = Math.random) {
  if (SCENE_NAMES.includes(last)) return { scene: nextScene(last), reason: `next after ${last}` };
  const i = Math.min(CYCLE_ORDER.length - 1, Math.floor(random() * CYCLE_ORDER.length));
  return { scene: CYCLE_ORDER[i], reason: 'random first visit' };
}

// Storage helpers: storage may be missing or throw (private mode, blocked);
// then nothing is remembered and every load is a fresh, random one.
export function readLastScene(storage) {
  try {
    const v = storage?.getItem(LAST_SCENE_KEY);
    return SCENE_NAMES.includes(v) ? v : null;
  } catch { return null; }
}

export function rememberScene(storage, name) {
  try { if (SCENE_NAMES.includes(name)) storage?.setItem(LAST_SCENE_KEY, name); } catch { /* not remembered */ }
}

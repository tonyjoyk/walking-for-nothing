// Opening scene from the weather, and the scene cycle (docs/spec-live-weather.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultConfig, validateConfig } from '../src/config.js';
import { Scene } from '../src/scene/Scene.js';
import {
  keralaMinutes, approxSunTimes, validateWeather, chooseOpeningScene, nextScene, CYCLE_ORDER,
} from '../src/weather.js';

// A Date at a given Kerala time (minutes since midnight, IST) on 17 Oct 2026.
const at = (ist, day = 17, month = 9) => new Date(Date.UTC(2026, month, day, 0, 0) + (ist - 330) * 60000);
const hm = (h, m = 0) => h * 60 + m;
const wx = (code, extra = {}) => ({ code, windKmh: 5, gustKmh: 10, sunrise: hm(6), sunset: hm(18), ...extra });

test('Kerala time is UTC+5:30', () => {
  assert.equal(keralaMinutes(new Date('2026-10-17T00:00:00Z')), 330);
  assert.equal(keralaMinutes(new Date('2026-10-17T18:30:00Z')), 0);
});

test('approximate sunrise and sunset for Pala are within the real range all year', () => {
  for (let month = 0; month < 12; month++) {
    const { sunrise, sunset } = approxSunTimes(at(hm(12), 15, month));
    assert.ok(sunrise > hm(5, 50) && sunrise < hm(6, 50), `sunrise ${sunrise} in month ${month + 1}`);
    assert.ok(sunset > hm(17, 50) && sunset < hm(18, 55), `sunset ${sunset} in month ${month + 1}`);
  }
  // mid October in Pala: about 06:10 and 18:04
  const oct = approxSunTimes(at(hm(12)));
  assert.ok(Math.abs(oct.sunrise - hm(6, 10)) < 8 && Math.abs(oct.sunset - hm(18, 4)) < 8);
});

test('the opening scene follows the rules, in priority order', () => {
  const cases = [
    // rain first, even at night
    [wx(61), hm(12), 'rain'], [wx(63), hm(23), 'rain'], [wx(80), hm(6), 'rain'], [wx(95), hm(18), 'rain'],
    // night: more than 45 min after sunset or before sunrise
    [wx(0), hm(23), 'night'], [wx(0), hm(5), 'night'], [wx(0), hm(18, 46), 'night'],
    // dawn: within 45 min of sunrise
    [wx(0), hm(5, 15), 'dawn'], [wx(0), hm(6, 45), 'dawn'], [wx(0), hm(6, 46), 'sunny'],
    // sunset: 75 min before to 45 min after
    [wx(0), hm(16, 45), 'twilight'], [wx(0), hm(16, 44), 'sunny'], [wx(0), hm(18, 45), 'twilight'],
    // wind (daytime)
    [wx(0, { windKmh: 30 }), hm(12), 'wind'], [wx(2, { gustKmh: 45 }), hm(12), 'wind'],
    [wx(0, { windKmh: 29, gustKmh: 44 }), hm(12), 'sunny'],
    // overcast and fog
    [wx(3), hm(12), 'overcast'], [wx(45), hm(12), 'overcast'], [wx(48), hm(10), 'overcast'],
    // clear and partly cloudy
    [wx(0), hm(12), 'sunny'], [wx(1), hm(12), 'sunny'], [wx(2), hm(12), 'sunny'],
  ];
  for (const [w, t, expected] of cases) {
    const { scene } = chooseOpeningScene(w, at(t));
    assert.equal(scene, expected, `code ${w.code} at ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
  }
});

test('without weather the opening scene comes from the time of day alone', () => {
  assert.equal(chooseOpeningScene(null, at(hm(12))).scene, 'sunny');
  assert.equal(chooseOpeningScene(null, at(hm(23))).scene, 'night');
  assert.equal(chooseOpeningScene(null, at(hm(6, 10))).scene, 'dawn');
  assert.equal(chooseOpeningScene(null, at(hm(17, 50))).scene, 'twilight');
  // missing sunrise/sunset in the data falls back to the computed times
  assert.equal(chooseOpeningScene(wx(0, { sunrise: null, sunset: null }), at(hm(23))).scene, 'night');
});

test('weather.json is checked: kill switch, age, and malformed fields', () => {
  const now = new Date('2026-10-17T08:00:00Z');
  const good = { enabled: true, observedAt: '2026-10-17T07:30:00Z', weatherCode: 3, windKmh: 12, gustKmh: 20, sunrise: '06:12', sunset: '18:05' };
  const v = validateWeather(good, now);
  assert.deepEqual([v.code, v.windKmh, v.gustKmh, v.sunrise, v.sunset], [3, 12, 20, hm(6, 12), hm(18, 5)]);
  assert.equal(validateWeather({ ...good, enabled: false }, now), null);
  assert.ok(validateWeather({ ...good, enabled: false }, now, { allowDisabled: true }));
  assert.equal(validateWeather({ ...good, observedAt: '2026-10-17T04:59:00Z' }, now), null, 'older than 3 hours');
  assert.equal(validateWeather({ ...good, observedAt: '2026-10-17T08:20:00Z' }, now), null, 'from the future');
  assert.equal(validateWeather({ ...good, weatherCode: 'rain' }, now), null);
  assert.equal(validateWeather({ ...good, weatherCode: 120 }, now), null);
  assert.equal(validateWeather(null, now), null);
  assert.equal(validateWeather('nope', now), null);
  const odd = validateWeather({ ...good, sunrise: '6am', windKmh: -4 }, now);
  assert.equal(odd.sunrise, null);
  assert.equal(odd.windKmh, 0);
});

test('the cycle visits every scene once and wraps; overcast sits at rain', () => {
  const seen = [];
  let s = 'dawn';
  for (let i = 0; i < 7; i++) { s = nextScene(s); seen.push(s); }
  assert.deepEqual(seen, ['sunny', 'wind', 'rain', 'twilight', 'night', 'dawn', 'sunny']);
  assert.equal(new Set(seen.slice(0, 6)).size, CYCLE_ORDER.length);
  assert.equal(nextScene('overcast'), 'twilight');
});

// Run a scene and record the scene name each time it changes.
function journey(cfgEdit, seconds) {
  const cfg = createDefaultConfig();
  cfgEdit(cfg);
  const scene = new Scene(cfg);
  scene.computeView(1920, 1080);
  scene.applyScene('dawn');
  const changes = [];
  let last = scene.sceneName;
  for (let i = 0; i < seconds * 60; i++) {
    scene.update(1 / 60);
    if (scene.sceneName !== last) { changes.push({ scene: scene.sceneName, t: i / 60, x: scene.manX }); last = scene.sceneName; }
  }
  return { scene, changes };
}

test('in the scene, each crossing moves to the next scene as he re-enters from the left', () => {
  const crossing = (1920 + 380) / 70; // seconds per crossing at the default pace
  const { changes, scene } = journey(() => {}, crossing * 7.5);
  assert.deepEqual(changes.map((c) => c.scene), ['sunny', 'wind', 'rain', 'twilight', 'night', 'dawn', 'sunny']);
  for (const c of changes) assert.ok(c.x < scene.view.x0, `changed at x ${c.x.toFixed(0)}, off the left edge`);
  // successive changes are one crossing apart
  for (let i = 1; i < changes.length; i++) assert.ok(Math.abs(changes[i].t - changes[i - 1].t - crossing) < 1);
});

test('crossings per scene and the cycle switch are respected', () => {
  const crossing = (1920 + 380) / 70;
  const two = journey((c) => { c.cycle.crossingsPerScene = 2; }, crossing * 4.5).changes;
  assert.equal(two.length, 2);
  assert.ok(Math.abs(two[1].t - two[0].t - 2 * crossing) < 1);
  assert.equal(journey((c) => { c.cycle.enabled = false; }, crossing * 3).changes.length, 0);
});

test('overcast is the rain scene with the rain switched off', () => {
  const scene = new Scene(createDefaultConfig());
  scene.applyScene('overcast');
  assert.equal(scene.config.activePreset, 'rain');
  assert.equal(scene.config.scene.rain, 0);
  assert.equal(scene.sceneName, 'overcast');
});

test('opening and cycle settings save and load, and bad values are rejected', () => {
  const cfg = createDefaultConfig();
  assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(cfg))).config, cfg);
  const bad = validateConfig({ opening: { force: 'snow', liveWeather: 'yes' }, cycle: { crossingsPerScene: 50 } });
  assert.ok(bad.warnings.includes('opening.force') && bad.warnings.includes('opening.liveWeather'));
  assert.equal(bad.config.cycle.crossingsPerScene, 6);
});

test('the weather job turns an Open-Meteo response into weather.json the page accepts', async () => {
  const { toWeatherDoc, openMeteoUrl } = await import('../scripts/fetch-weather.mjs');
  const om = {
    utc_offset_seconds: 19800,
    current: { time: '2026-10-17T22:45', interval: 900, weather_code: 51, wind_speed_10m: 5.64, wind_gusts_10m: 10.4 },
    daily: { time: ['2026-10-17'], sunrise: ['2026-10-17T06:11'], sunset: ['2026-10-17T18:05'] },
  };
  const doc = toWeatherDoc(om, { enabled: true, location: 'Pala, Kottayam' });
  assert.equal(doc.observedAt, '2026-10-17T17:15:00Z'); // 22:45 IST
  assert.deepEqual([doc.weatherCode, doc.windKmh, doc.gustKmh, doc.sunrise, doc.sunset], [51, 5.6, 10.4, '06:11', '18:05']);
  // the page accepts it and opens on rain
  const v = validateWeather(doc, new Date('2026-10-17T17:30:00Z'));
  assert.equal(chooseOpeningScene(v, new Date('2026-10-17T17:30:00Z')).scene, 'rain');
  // switched off unless LIVE_WEATHER is exactly true
  assert.equal(toWeatherDoc(om, {}).enabled, false);
  assert.equal(toWeatherDoc({}, { enabled: true }), null);
  assert.match(openMeteoUrl(), /latitude=9\.71306&longitude=76\.68331/);
});

import p5 from 'p5';
import { createDefaultConfig, WEATHER_RULES } from './config.js';
import { chooseOpeningScene, validateWeather, SCENE_NAMES } from './weather.js';
import { Scene } from './scene/Scene.js';
import { AudioManager } from './audio.js';
import './styles/main.css';

p5.disableFriendlyErrors = true; // faster; the scene does its own validation

const config = createDefaultConfig();
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
config.playback.reducedMotion = reduce.matches;

const scene = new Scene(config);
const audio = new AudioManager(config);

// ---------------------------------------------------------------------------
// Opening scene (docs/spec-live-weather.md). The first frame never waits:
// it opens on the scene for Kerala's time of day, then, if this morning's
// weather.json arrives within the time limit, eases into the weather scene.
//   ?weather=rain (or any scene name)  force that opening scene
//   ?weather=live                      use the weather even if switched off
// ---------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const weatherParam = params.get('weather');
const weatherStatus = { opening: '', source: '', detail: '' };

function forcedScene() {
  if (weatherParam && SCENE_NAMES.includes(weatherParam)) return weatherParam;
  return SCENE_NAMES.includes(config.opening.force) ? config.opening.force : null;
}

function openOn(name, reason, snap) {
  scene.applyScene(name);
  if (snap) scene.snapParams();
  weatherStatus.opening = name;
  weatherStatus.detail = reason;
}

async function chooseOpening() {
  const now = new Date();
  const forced = forcedScene();
  if (forced) { openOn(forced, 'forced', true); weatherStatus.source = 'forced'; return; }
  const local = chooseOpeningScene(null, now);
  openOn(local.scene, local.reason, true);
  weatherStatus.source = 'time of day';
  if (config.opening.force === 'time-of-day' || !config.opening.liveWeather) return;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), WEATHER_RULES.fetchTimeoutMs);
    const res = await fetch(`${import.meta.env.BASE_URL}weather.json`, { cache: 'no-cache', signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const weather = validateWeather(await res.json(), new Date(), { allowDisabled: weatherParam === 'live' });
    if (!weather) { weatherStatus.source = 'time of day (weather missing, off or stale)'; return; }
    const pick = chooseOpeningScene(weather, new Date());
    weatherStatus.source = `weather, observed ${weather.observedAt.toISOString().slice(11, 16)} UTC`;
    if (pick.scene !== scene.sceneName) openOn(pick.scene, pick.reason, false); // eases in
    else weatherStatus.detail = pick.reason;
  } catch (e) {
    weatherStatus.source = `time of day (${e.name === 'AbortError' ? 'weather too slow' : 'weather unavailable'})`;
  }
}
chooseOpening();
scene.onBirdsEnter = () => audio.chirpFlock();

const DENSITY_CAP = { low: 1, medium: 1.5, high: 2 };
let p5ref = null;
let appliedQuality = null;

function applyQuality() {
  if (!p5ref) return;
  const q = config.playback.quality;
  if (q === appliedQuality) return;
  appliedQuality = q;
  p5ref.pixelDensity(Math.min(window.devicePixelRatio || 1, DENSITY_CAP[q] || 2));
}

new p5((p) => {
  p5ref = p;
  p.setup = () => {
    const c = p.createCanvas(window.innerWidth, window.innerHeight);
    c.parent('stage');
    c.elt.setAttribute('aria-label', 'A man walking through a field in Kerala');
    c.elt.setAttribute('role', 'img');
    applyQuality();
    p.frameRate(60);
  };
  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);
  p.draw = () => {
    applyQuality();
    const dt = Math.min(p.deltaTime / 1000, 0.05);
    scene.update(dt);
    scene.render(p.drawingContext, p.width, p.height, p.pixelDensity());
    audio.update(scene.P, dt);
  };
});

// Pause everything when the tab is hidden (battery on phones).
document.addEventListener('visibilitychange', () => {
  if (!p5ref) return;
  if (document.hidden) { p5ref.noLoop(); audio.suspend(); }
  else { p5ref.loop(); audio.resume(); }
});

// Visitor-facing sound toggle. Sound only starts after this tap.
const soundBtn = document.getElementById('sound');
function syncSoundButton() {
  const on = config.audio.enabled && !config.audio.muted;
  soundBtn.setAttribute('aria-pressed', String(on));
  soundBtn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
  soundBtn.classList.toggle('on', on);
}
soundBtn.addEventListener('click', async () => {
  const turningOn = !(config.audio.enabled && !config.audio.muted);
  if (turningOn) {
    const ok = await audio.start();
    config.audio.enabled = ok;
    config.audio.muted = false;
  } else {
    config.audio.enabled = false;
  }
  syncSoundButton();
  app.onAudioChange?.();
});
syncSoundButton();

const app = { config, scene, audio, syncSoundButton, onAudioChange: null, weatherStatus, chooseOpening };
window.__landscape = app; // handy in the console while tuning

// Dev panel: loaded only with ?dev, as a separate chunk visitors never fetch.
if (new URLSearchParams(window.location.search).has('dev')) {
  import('./controls/ControlPanel.js').then((m) => m.createPanel(app));
}

import p5 from 'p5';
import { createDefaultConfig, WEATHER_RULES } from './config.js';
import { chooseOpeningScene, validateWeather, SCENE_NAMES, chooseShuffleScene, readLastScene, rememberScene } from './weather.js';
import { Scene } from './scene/Scene.js';
import { SoundDirector } from './audio/index.js';
import { createBubble } from './bubble.js';
import { initSoundControl, initScenePicker, readSceneLock, initSoundCue } from './controls/visitorControls.js';
import { initCredits } from './credits.js';
import './styles/main.css';

p5.disableFriendlyErrors = true; // faster; the scene does its own validation

const config = createDefaultConfig();
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
config.playback.reducedMotion = reduce.matches;
const isDev = new URLSearchParams(window.location.search).has('dev');

// Phones and tablets start at medium quality (fewer blades, lower pixel
// density); any device steps down further if it can't hold a smooth frame
// rate (see adaptQuality). The dev panel's own choice is always respected.
const coarse = window.matchMedia('(pointer: coarse)').matches;
if (coarse || Math.min(window.innerWidth, window.innerHeight) < 600) config.playback.quality = 'medium';

const scene = new Scene(config);
const audio = new SoundDirector(config);
const credits = initCredits(); // the one Credits link, bottom left (story 6.12)

// ---------------------------------------------------------------------------
// Opening scene. The first frame never waits. By opening.mode:
//   shuffle (default)  a fresh visit opens on a random scene, a reload on the
//                      next scene after the one last on screen
//                      (docs/stories/1.1.shuffle-and-advance-opening.md)
//   weather            Kerala's time of day, easing into the live weather if
//                      weather.json arrives in time (docs/product/specs/live-weather.md)
//   time-of-day        Kerala's time of day only
//   ?weather=rain (or any scene name)  force that opening scene
//   ?weather=live                      weather mode, even if switched off
// ---------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const weatherParam = params.get('weather');
const weatherStatus = { opening: '', source: '', detail: '' };
if (weatherParam === 'live') config.opening.mode = 'weather'; // preview live weather

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

// The tab's memory of the scene on screen (sessionStorage: survives a
// reload, cleared when the tab closes; nothing leaves the browser).
const tabStorage = (() => { try { return window.sessionStorage; } catch { return null; } })();
const lastScene = readLastScene(tabStorage);
scene.onSceneChange = (name) => rememberScene(tabStorage, name);

async function chooseOpening() {
  const now = new Date();
  const forced = forcedScene();
  if (forced) { openOn(forced, 'forced', true); weatherStatus.source = 'forced'; return; }
  // a scene the visitor picked in this tab stays, looping (story 1.3, D-1.6)
  const locked = readSceneLock(tabStorage);
  if (locked) { config.cycle.enabled = false; openOn(locked, 'picked by the visitor', true); weatherStatus.source = 'picked'; return; }
  const mode = config.opening.force === 'time-of-day' ? 'time-of-day' : config.opening.mode;
  if (mode === 'shuffle') {
    // a fresh visit opens on a random scene; a reload, on the next one
    const pick = chooseShuffleScene(lastScene);
    openOn(pick.scene, pick.reason, true);
    weatherStatus.source = 'shuffle';
    return;
  }
  const local = chooseOpeningScene(null, now);
  openOn(local.scene, local.reason, true);
  weatherStatus.source = 'time of day';
  if (mode !== 'weather') return;
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
    credits.addWeather(); // data used: credit it in the Credits list (story 6.12)
    if (pick.scene !== scene.sceneName) openOn(pick.scene, pick.reason, false); // eases in
    else weatherStatus.detail = pick.reason;
  } catch (e) {
    weatherStatus.source = `time of day (${e.name === 'AbortError' ? 'weather too slow' : 'weather unavailable'})`;
  }
}
chooseOpening();
scene.onBirdsEnter = () => audio.chirpFlock();
audio.onFlash = (strength) => scene.flash(strength); // lightning before thunder (story 6.11)

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

const bubbleEl = document.getElementById('bubble');
const updateBubble = createBubble(bubbleEl, scene);
// Minimal hand cursor while the pointer is on the man himself (D-2.9). Set in
// the pointer handler as well as each frame: browsers only redraw the cursor
// when the mouse moves, so a change made a frame later would not show until
// the next movement (the hand seemed missing when the pointer came to rest).
let cursorOnMan = false;
function updateHandCursor() {
  const onMan = !!scene.pointer && scene.hitMan(scene.pointer.x, scene.pointer.y, scene.greeting.active, false);
  if (onMan !== cursorOnMan) { cursorOnMan = onMan; document.documentElement.classList.toggle('on-man', onMan); }
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
    // know the screen before the first update, so the man starts on screen
    scene.computeView(p.width, p.height);
  };
  p.windowResized = () => p.resizeCanvas(window.innerWidth, window.innerHeight);
  p.draw = () => {
    applyQuality();
    const dt = Math.min(p.deltaTime / 1000, 0.05);
    adaptQuality(dt);
    scene.update(dt);
    scene.render(p.drawingContext, p.width, p.height, p.pixelDensity());
    updateBubble(dt);
    scenePicker.update();
    // he walks under a still pointer: keep the hand cursor in step (D-2.9)
    updateHandCursor();
    audio.update(scene.P, dt, scene.sceneName);
  };
});

// If the frame rate stays below ~40 fps for a few seconds (after a short
// warm-up), step quality down one level, at most twice. Stops adapting once
// someone picks a quality in the dev panel.
const STEPS = ['high', 'medium', 'low'];
let adaptClock = 0, slowFor = 0, expected = config.playback.quality;
function adaptQuality(dt) {
  if (config.playback.quality !== expected) return; // changed by hand: leave it
  adaptClock += dt;
  if (adaptClock < 4 || document.hidden) return;
  slowFor = scene.fps < 40 ? slowFor + dt : 0;
  const i = STEPS.indexOf(config.playback.quality);
  if (slowFor > 3 && i >= 0 && i < STEPS.length - 1) {
    config.playback.quality = expected = STEPS[i + 1];
    slowFor = 0; adaptClock = 0;
  }
}

// The greeting (docs/product/specs/greeting.md, D-2.2, D-2.7): the cursor on
// the man makes him stop; resting it there for a moment, or clicking him, makes
// him turn to the visitor. A tap on touch screens works like a click. While he
// faces the visitor, another click or tap on him sends him on his way; a click
// or tap well away from him and the bubble does too. The scene re-tests the
// hover every frame from the last pointer position, so a still cursor counts,
// and while the bubble shows, it counts as part of him.
const pointerOff = () => { scene.pointer = null; scene.hovering = false; updateHandCursor(); };
window.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  scene.pointer = { x: e.clientX, y: e.clientY };
  scene.hovering = scene.hitMan(e.clientX, e.clientY, scene.greeting.active);
  updateHandCursor(); // now, so this very movement shows the hand
});
document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) pointerOff(); });
window.addEventListener('blur', pointerOff);
window.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  if (e.target.closest && e.target.closest('button, input, select, a, .tp-dfwv, .bubble')) return; // UI or the bubble, not the scene
  if (scene.greeting.facing && scene.hitMan(e.clientX, e.clientY)) scene.greeting.dismiss(); // on him again: bye
  else if (scene.hitMan(e.clientX, e.clientY, scene.greeting.active)) scene.greetNow();
  else scene.greeting.release();
});

// Sound only while the visitor is on the page (story 6.16, D-6.17): a hidden
// tab or minimised window pauses everything (battery on phones); another app
// or window in front fades the sound out while the scene keeps moving.
const syncAway = () => audio.setAway(!document.hasFocus() || document.hidden);
window.addEventListener('blur', syncAway);
window.addEventListener('focus', syncAway);
syncAway();

// Pause everything when the tab is hidden (battery on phones).
document.addEventListener('visibilitychange', () => {
  if (!p5ref) return;
  syncAway();
  if (document.hidden) { p5ref.noLoop(); audio.suspend(); }
  else { p5ref.loop(); audio.resume(); }
});

// Visitor-facing sound button and volume slider (story 6.14). Sound only
// starts after a tap or click on them (browser autoplay rules).
const soundCtl = initSoundControl({ config, audio, onChange: () => app.onAudioChange?.() });
const syncSoundButton = soundCtl.sync;
// a small "Click for sound" cue beside the speaker while sound is off (story 6.19)
initSoundCue({ wantsSound: soundCtl.wantsSound, isPlaying: soundCtl.isPlaying });
// the time-of-day picker above it (stories 1.2, 1.3)
const scenePicker = initScenePicker({ scene, config, storage: tabStorage });

const app = { config, scene, audio, syncSoundButton, onAudioChange: null, weatherStatus, chooseOpening };
window.__landscape = app; // handy in the console while tuning

// Dev panel: loaded only with ?dev, as a separate chunk visitors never fetch.
if (isDev) {
  import('./controls/ControlPanel.js').then((m) => m.createPanel(app));
}

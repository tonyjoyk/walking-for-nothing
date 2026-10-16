import p5 from 'p5';
import { createDefaultConfig } from './config.js';
import { Scene } from './scene/Scene.js';
import { AudioManager } from './audio.js';
import './styles/main.css';

p5.disableFriendlyErrors = true; // faster; the scene does its own validation

const config = createDefaultConfig();
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
config.playback.reducedMotion = reduce.matches;

const scene = new Scene(config);
const audio = new AudioManager(config);
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

const app = { config, scene, audio, syncSoundButton, onAudioChange: null };
window.__landscape = app; // handy in the console while tuning

// Dev panel: loaded only with ?dev, as a separate chunk visitors never fetch.
if (new URLSearchParams(window.location.search).has('dev')) {
  import('./controls/ControlPanel.js').then((m) => m.createPanel(app));
}

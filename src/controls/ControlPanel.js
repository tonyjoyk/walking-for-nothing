// Temporary tuning panel. Loaded only with ?dev. The scene never imports
// this file, so removing it means deleting this file and the ?dev import
// in main.js.
import { Pane } from 'tweakpane';
import { RANGES, PRESET_LABELS, createDefaultConfig, validateConfig, assignDeep } from '../config.js';

export function createPanel(app) {
  const { config, scene, audio } = app;
  const host = document.createElement('div');
  host.id = 'devpanel';
  document.body.appendChild(host);
  const pane = new Pane({ container: host, title: 'Living landscape (dev)' });

  // Bind config[path] with the shared ranges from config.js.
  const bind = (folder, obj, key, path, extra = {}) => {
    const r = RANGES[path];
    const opts = { ...extra };
    if (r) Object.assign(opts, { min: r[0], max: r[1], step: r[2] });
    return folder.addBinding(obj, key, opts);
  };
  const S = config.scene;
  const sc = (f, key, label) => bind(f, S, key, `scene.${key}`, { label });

  const presetOptions = Object.fromEntries(Object.entries(PRESET_LABELS).map(([k, v]) => [v, k]));

  // A. Presets and playback --------------------------------------------
  const fA = pane.addFolder({ title: 'Presets and playback' });
  fA.addBinding(config, 'activePreset', { label: 'scene', options: presetOptions })
    .on('change', () => { scene.applyPreset(config.activePreset); pane.refresh(); });
  fA.addBinding(config.playback, 'playing', { label: 'play' });
  bind(fA, config.playback, 'transitionSeconds', 'playback.transitionSeconds', { label: 'transition (s)' });
  bind(fA, config.playback, 'speed', 'playback.speed', { label: 'speed' });
  fA.addBinding(config.playback, 'loop', { label: 'loop walk' });
  fA.addBinding(config.playback, 'reducedMotion', { label: 'reduced motion' });
  fA.addBinding(config.playback, 'quality', { label: 'quality', options: { low: 'low', medium: 'medium', high: 'high' } });
  fA.addBinding(config.playback, 'debug', { label: 'debug overlay' });
  fA.addButton({ title: 'Restart character' }).on('click', () => scene.restartCharacter());
  fA.addButton({ title: 'Reset to preset' }).on('click', () => { scene.resetToPreset(); pane.refresh(); });

  // B. Lighting and palette --------------------------------------------
  const fB = pane.addFolder({ title: 'Lighting and palette', expanded: false });
  sc(fB, 'skyTop', 'sky top'); sc(fB, 'skyMid', 'sky middle'); sc(fB, 'skyHorizon', 'sky horizon');
  sc(fB, 'sunAlpha', 'sun / moon'); sc(fB, 'sunX', 'sun x'); sc(fB, 'sunY', 'sun y');
  sc(fB, 'sunSize', 'sun size'); sc(fB, 'sunColor', 'sun colour');
  sc(fB, 'glow', 'glow'); sc(fB, 'glowColor', 'glow colour');
  sc(fB, 'brightness', 'brightness'); sc(fB, 'warmth', 'warm / cool');
  sc(fB, 'haze', 'haze colour'); sc(fB, 'hazeAmount', 'haze');
  sc(fB, 'mtnFar', 'far mountains'); sc(fB, 'mtnMid', 'mid mountains'); sc(fB, 'mtnNear', 'near hills');
  sc(fB, 'facet', 'facets');
  sc(fB, 'tree', 'trees'); sc(fB, 'palm', 'palms');
  sc(fB, 'fieldTop', 'field top'); sc(fB, 'fieldBottom', 'field bottom');
  sc(fB, 'grassFar', 'grass far'); sc(fB, 'grassMid', 'grass mid'); sc(fB, 'grassDark', 'grass dark');
  sc(fB, 'grassLight', 'grass light'); sc(fB, 'seedColor', 'seed heads');
  sc(fB, 'charTint', 'character tint'); sc(fB, 'charBrightness', 'character light');
  bind(fB, config.finish, 'grain', 'finish.grain', { label: 'paint grain' });
  fB.addButton({ title: 'Reset lighting to preset' }).on('click', () => { scene.resetToPreset(); pane.refresh(); });

  // C. Clouds -----------------------------------------------------------
  const fC = pane.addFolder({ title: 'Clouds', expanded: false });
  sc(fC, 'cloudAmount', 'amount'); sc(fC, 'cloudScale', 'scale'); sc(fC, 'cloudOpacity', 'opacity');
  sc(fC, 'cloudSpeed', 'drift speed');
  bind(fC, config.clouds, 'parallax', 'clouds.parallax', { label: 'parallax' });
  sc(fC, 'cloudLight', 'lit colour'); sc(fC, 'cloudShade', 'shade colour');

  // D. Field and grass --------------------------------------------------
  const G = config.grass;
  const fD = pane.addFolder({ title: 'Field and grass', expanded: false });
  bind(fD, G, 'density', 'grass.density', { label: 'density' });
  bind(fD, G, 'heightMul', 'grass.heightMul', { label: 'height' });
  bind(fD, G, 'heightVar', 'grass.heightVar', { label: 'height variation' });
  bind(fD, G, 'bladeWidth', 'grass.bladeWidth', { label: 'blade width' });
  bind(fD, G, 'swayAmp', 'grass.swayAmp', { label: 'sway' });
  bind(fD, G, 'swaySpeed', 'grass.swaySpeed', { label: 'sway speed' });
  sc(fD, 'wind', 'wind strength');
  fD.addBinding(G, 'windDir', { label: 'wind direction', options: { 'to the right': 1, 'to the left': -1 } });
  bind(fD, G, 'occlusion', 'grass.occlusion', { label: 'occlusion height' });
  bind(fD, G, 'clumping', 'grass.clumping', { label: 'clumping' });
  bind(fD, G, 'mass', 'grass.mass', { label: 'undergrowth' });
  bind(fD, G, 'seedFreq', 'grass.seedFreq', { label: 'seed heads' });
  bind(fD, G, 'seed', 'grass.seed', { label: 'layout seed' });
  fD.addButton({ title: 'New layout' }).on('click', () => { G.seed = 1 + Math.floor(Math.random() * 9998); pane.refresh(); });

  // E. Character --------------------------------------------------------
  const Ch = config.character;
  const fE = pane.addFolder({ title: 'Character', expanded: false });
  fE.addBinding(Ch, 'visible', { label: 'visible' });
  bind(fE, Ch, 'x', 'character.x', { label: 'start position' });
  bind(fE, Ch, 'scale', 'character.scale', { label: 'scale' });
  bind(fE, Ch, 'groundOffset', 'character.groundOffset', { label: 'ground offset (man + Juhu)' });
  bind(fE, Ch, 'walkSpeed', 'character.walkSpeed', { label: 'walk speed' });
  bind(fE, Ch, 'cadence', 'character.cadence', { label: 'steps (cycles/s)' });
  bind(fE, Ch, 'stride', 'character.stride', { label: 'knee lift' });
  bind(fE, Ch, 'bob', 'character.bob', { label: 'torso bob' });
  bind(fE, Ch, 'armSwing', 'character.armSwing', { label: 'arm swing' });
  bind(fE, Ch, 'fabric', 'character.fabric', { label: 'fabric motion' });
  bind(fE, G, 'occlusion', 'grass.occlusion', { label: 'grass occlusion' });

  // F. Juhu -------------------------------------------------------------
  const D = config.dog;
  const fF = pane.addFolder({ title: 'Juhu', expanded: false });
  fF.addBinding(D, 'enabled', { label: 'enabled' });
  for (const [k, label] of Object.entries(PRESET_LABELS)) fF.addBinding(D.presets, k, { label: `in ${label}` });
  bind(fF, D, 'aloneCrossings', 'dog.aloneCrossings', { label: 'crossings alone' });
  bind(fF, D, 'togetherCrossings', 'dog.togetherCrossings', { label: 'crossings together' });
  bind(fF, D, 'firstVisitDelay', 'dog.firstVisitDelay', { label: 'first visit (s)' });
  bind(fF, D, 'approachSpeed', 'dog.approachSpeed', { label: 'catch-up speed' });
  bind(fF, D, 'easeSeconds', 'dog.easeSeconds', { label: 'trot to walk (s)' });
  bind(fF, D, 'spacing', 'dog.spacing', { label: 'spacing' });
  bind(fF, D, 'scale', 'dog.scale', { label: 'scale' });
  fF.addButton({ title: 'Call Juhu now' }).on('click', () => scene.callDog());
  const dogMon = { state: '' };
  fF.addBinding(dogMon, 'state', { label: 'state', readonly: true });

  // G. Birds ------------------------------------------------------------
  const B = config.birds;
  const fG = pane.addFolder({ title: 'Birds', expanded: false });
  fG.addBinding(B, 'enabled', { label: 'enabled' });
  for (const [k, label] of Object.entries(PRESET_LABELS)) fG.addBinding(B.presets, k, { label: `in ${label}` });
  bind(fG, B, 'flockSize', 'birds.flockSize', { label: 'flock size' });
  bind(fG, B, 'interval', 'birds.interval', { label: 'every (s)' });
  bind(fG, B, 'speed', 'birds.speed', { label: 'speed' });
  bind(fG, B, 'altitude', 'birds.altitude', { label: 'altitude' });
  bind(fG, B, 'wingSpeed', 'birds.wingSpeed', { label: 'wingbeat' });
  bind(fG, B, 'scale', 'birds.scale', { label: 'scale' });
  fG.addBinding(B, 'chirps', { label: 'chirps' });
  fG.addButton({ title: 'Send birds now' }).on('click', () => scene.spawnBirds());

  // H. Weather and atmosphere ------------------------------------------
  const fH = pane.addFolder({ title: 'Weather and atmosphere', expanded: false });
  sc(fH, 'rain', 'rain'); sc(fH, 'rainAngle', 'rain angle'); sc(fH, 'rainSpeed', 'rain speed');
  bind(fH, config.weather, 'rainDensity', 'weather.rainDensity', { label: 'rain density' });
  sc(fH, 'wind', 'wind'); sc(fH, 'leaves', 'leaves'); sc(fH, 'hazeAmount', 'haze'); sc(fH, 'mist', 'mist');
  sc(fH, 'stars', 'stars'); sc(fH, 'glow', 'moon / sun glow');

  // I. Sound ------------------------------------------------------------
  const A = config.audio;
  const fI = pane.addFolder({ title: 'Sound', expanded: false });
  fI.addBinding(A, 'enabled', { label: 'sound on' }).on('change', async (ev) => {
    if (ev.value) A.enabled = await audio.start();
    app.syncSoundButton();
  });
  fI.addBinding(A, 'muted', { label: 'mute all' }).on('change', () => app.syncSoundButton());
  bind(fI, A, 'master', 'audio.master', { label: 'master' });
  fI.addBinding(A, 'windOn', { label: 'wind layer' });
  bind(fI, A, 'wind', 'audio.wind', { label: 'wind volume' });
  fI.addBinding(A, 'rainOn', { label: 'rain layer' });
  bind(fI, A, 'rain', 'audio.rain', { label: 'rain volume' });
  fI.addBinding(A, 'birdsOn', { label: 'bird layer' });
  bind(fI, A, 'birds', 'audio.birds', { label: 'bird volume' });
  app.onAudioChange = () => pane.refresh();

  // J. Save and share ---------------------------------------------------
  const fJ = pane.addFolder({ title: 'Save and share', expanded: false });
  fJ.addButton({ title: 'Download JSON' }).on('click', () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `landscape-${config.activePreset}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  fJ.addButton({ title: 'Copy JSON' }).on('click', async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(config, null, 2)); flash('Copied'); }
    catch { flash('Copy failed'); }
  });
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      applyConfig(parsed);
    } catch (e) {
      flash('Invalid JSON');
    }
    fileInput.value = '';
  });
  fJ.addButton({ title: 'Load JSON' }).on('click', () => fileInput.click());
  fJ.addButton({ title: 'Reset everything' }).on('click', () => applyConfig(createDefaultConfig()));
  const status = { message: '' };
  fJ.addBinding(status, 'message', { label: 'status', readonly: true });

  function applyConfig(input) {
    const { config: clean, warnings } = validateConfig(input);
    const wasEnabled = config.audio.enabled;
    assignDeep(config, clean);
    config.audio.enabled = wasEnabled && clean.audio.enabled; // never auto-start audio
    scene.appliedPreset = config.activePreset;
    pane.refresh();
    app.syncSoundButton();
    flash(warnings.length ? `Loaded, ${warnings.length} invalid value(s) skipped` : 'Loaded');
    if (warnings.length) console.warn('Skipped invalid config values:', warnings);
  }

  let flashTimer = 0;
  function flash(msg) {
    status.message = msg;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { status.message = ''; }, 3000);
  }

  // live monitor + keyboard toggle
  setInterval(() => {
    const d = scene.dog;
    dogMon.state = `${d.state} (gait ${d.gait.toFixed(2)})`;
  }, 200);
  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'h' || e.key === 'H') host.classList.toggle('hidden');
    if (e.key === ' ') { config.playback.playing = !config.playback.playing; pane.refresh(); e.preventDefault(); }
  });

  return pane;
}

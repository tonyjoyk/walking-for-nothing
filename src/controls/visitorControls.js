// Visitor controls in the bottom-right corner (docs/stories/6.14.volume-slider.md).
// The sound button mutes and unmutes; a small volume slider rises above it on
// hover or focus (desktop) or after a tap (touch). The level drives
// config.audio.master, which the sound director already glides to, and is
// remembered in this browser so a quiet setting sticks.

export const VOLUME_KEY = 'wfn.volume';

// The remembered level (0..1), or null. Storage can be missing or throw.
export function readVolume(storage) {
  try {
    const v = parseFloat(storage?.getItem(VOLUME_KEY));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
  } catch { return null; }
}

export function rememberVolume(storage, v) {
  try { storage?.setItem(VOLUME_KEY, String(Math.round(v * 100) / 100)); } catch { /* not remembered */ }
}

// Wire up the sound button and its slider. Returns sync() for callers that
// change config.audio elsewhere (the dev panel).
export function initSoundControl({ config, audio, onChange = () => {}, storage = safeLocalStorage() }) {
  const group = document.getElementById('sound-ctl');
  const btn = document.getElementById('sound');
  const slider = document.getElementById('volume');
  const A = config.audio;

  const saved = readVolume(storage);
  if (saved !== null) A.master = saved;

  const isOn = () => A.enabled && !A.muted && A.master > 0;
  function sync() {
    const on = isOn();
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    btn.classList.toggle('on', on);
    const pct = Math.round(A.master * 100);
    slider.value = String(pct);
    slider.setAttribute('aria-valuetext', `${pct}%`);
    slider.style.setProperty('--fill', `${pct}%`);
  }

  async function turnOn() {
    const ok = await audio.start();
    A.enabled = ok;
    A.muted = false;
    if (!ok) disable();
    return ok;
  }
  function disable() {
    btn.disabled = true;
    slider.disabled = true;
    btn.setAttribute('aria-label', 'Sound is not available in this browser');
    btn.title = 'Sound is not available in this browser';
  }

  // touch: a tap also shows the slider for a few seconds
  let openTimer = 0;
  const open = (ms) => {
    group.classList.add('open');
    clearTimeout(openTimer);
    if (ms) openTimer = setTimeout(() => group.classList.remove('open'), ms);
  };
  let lastPointer = 'mouse';
  group.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });

  btn.addEventListener('click', async () => {
    if (isOn()) A.enabled = false;
    else {
      if (A.master <= 0) { A.master = 0.6; rememberVolume(storage, A.master); }
      await turnOn();
    }
    if (lastPointer === 'touch') open(3500);
    sync();
    onChange();
  });

  slider.addEventListener('input', async () => {
    A.master = Number(slider.value) / 100;
    rememberVolume(storage, A.master);
    if (lastPointer === 'touch') open(3500);
    // raising the level while sound is off turns it on (the drag is a user gesture)
    if (A.master > 0 && !(A.enabled && !A.muted)) await turnOn();
    sync();
    onChange();
  });

  // a tap anywhere else closes a touch-opened slider
  document.addEventListener('pointerdown', (e) => { if (!group.contains(e.target)) group.classList.remove('open'); });

  sync();
  return { sync };
}

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

// ---------------------------------------------------------------------------
// Scene picker (docs/stories/1.2.scene-picker.md): one glass button showing
// the current time of day opens a small stack of six; picking one eases the
// scene there. The six are disabled while a scene change is still easing in.
// ---------------------------------------------------------------------------

export const SCENES = [
  ['dawn', 'Dawn'], ['sunny', 'Day'], ['wind', 'Windy'],
  ['rain', 'Rain'], ['twilight', 'Sunset'], ['night', 'Night'],
];

// Minimal line icons, 24 x 24, drawn with currentColor.
const ICON_PATHS = {
  dawn: '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 4l2.5 2.5"/>',
  sunny: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
  wind: '<path d="M3 9h10.5a2.75 2.75 0 1 0-2.75-2.75M3 13h14.5a2.75 2.75 0 1 1-2.75 2.75M3 17h6"/>',
  rain: '<path d="M7.5 14.5a3.8 3.8 0 0 1-.4-7.6 5.2 5.2 0 0 1 10 1.4 3.1 3.1 0 0 1-.6 6.2z"/><path d="M9 17.5l-.8 2M12.5 17.5l-.8 2M16 17.5l-.8 2"/>',
  twilight: '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 9l2.5-2.5"/>',
  night: '<path d="M18.5 14.6A7.2 7.2 0 0 1 9.4 5.5a7.2 7.2 0 1 0 9.1 9.1z"/>',
};
export const sceneIcon = (name) =>
  `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ICON_PATHS.sunny}</svg>`;

// Overcast is Rain without the rain; the picker shows it as Rain.
export const pickerScene = (name) => (name === 'overcast' ? 'rain' : SCENES.some(([n]) => n === name) ? name : 'sunny');

export function initScenePicker({ scene, config }) {
  const group = document.getElementById('scene-ctl');
  const btn = document.getElementById('scene-btn');
  const list = document.getElementById('scene-list');
  const label = Object.fromEntries(SCENES);

  list.innerHTML = SCENES.map(([name, text]) =>
    `<button class="ctl scene-opt" type="button" data-scene="${name}" aria-pressed="false" aria-label="${text}" title="${text}">${sceneIcon(name)}</button>`).join('');
  const opts = [...list.querySelectorAll('.scene-opt')];

  let shown = null, busy = null, isOpen = false;
  const setOpen = (open, focusBack = false) => {
    isOpen = open;
    group.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (!open && focusBack) btn.focus();
  };

  // keep the button and the six in step with the scene (called every frame)
  function update() {
    const now = pickerScene(scene.sceneName || config.activePreset);
    const moving = scene.transitioning;
    if (now === shown && moving === busy) return;
    if (now !== shown) {
      btn.innerHTML = sceneIcon(now);
      btn.setAttribute('aria-label', `Time of day: ${label[now]}. Change it`);
      btn.title = `Time of day: ${label[now]}`;
      for (const o of opts) o.setAttribute('aria-pressed', String(o.dataset.scene === now));
    }
    for (const o of opts) o.disabled = moving;
    shown = now; busy = moving;
  }

  btn.addEventListener('click', () => setOpen(!isOpen));
  list.addEventListener('click', (e) => {
    const o = e.target.closest('.scene-opt');
    if (!o || o.disabled) return;
    if (o.dataset.scene !== shown) scene.applyScene(o.dataset.scene);
    setOpen(false, true);
    update();
  });
  group.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) { e.stopPropagation(); setOpen(false, true); } });
  document.addEventListener('pointerdown', (e) => { if (isOpen && !group.contains(e.target)) setOpen(false); });

  update();
  return { update, close: () => setOpen(false) };
}

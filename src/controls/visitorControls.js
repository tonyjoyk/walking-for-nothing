// Visitor controls in the bottom-right corner (docs/stories/6.14.volume-slider.md).
// The sound button mutes and unmutes; a small volume slider rises above it on
// hover or focus (desktop) or after a tap (touch). The level drives
// config.audio.master, which the sound director already glides to, and is
// remembered in this browser so a quiet setting sticks.

export const VOLUME_KEY = 'wfn.volume';
export const SOUND_KEY = 'wfn.sound'; // 'on' or 'off': the visitor's choice (default on, story 6.15)
export const HINT_KEY = 'wfn.hintSeen';

// The visitor's sound choice: true (on, the default) unless they turned it off.
export function readSoundOn(storage) {
  try { return storage?.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
export function rememberSoundOn(storage, on) {
  try { storage?.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* not remembered */ }
}

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
  // Sound is on by default (story 6.15, D-6.14). Browsers only let it play
  // after the visitor's first click, tap or key, so it starts then.
  A.enabled = readSoundOn(storage);
  A.muted = false;
  let started = false, startedAt = -1e9;
  async function startOnGesture() {
    if (started || !A.enabled) return;
    // only events the browser counts as permission to play (a mouse press, the
    // end of a touch, a key), else the start could stall and never retry
    if (navigator.userActivation && !navigator.userActivation.isActive) return;
    started = true;
    startedAt = performance.now();
    if (!(await turnOn())) started = false;
    sync();
    onChange();
  }
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click']) window.addEventListener(type, startOnGesture, { capture: true, passive: true });

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
    // the click that started the sound just now isn't also a click to stop it
    if (performance.now() - startedAt < 800) { sync(); return; }
    if (isOn() && started) { A.enabled = false; rememberSoundOn(storage, false); }
    else {
      if (A.master <= 0) { A.master = 0.6; rememberVolume(storage, A.master); }
      started = true;
      if (await turnOn()) rememberSoundOn(storage, true);
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
    if (A.master > 0 && !(A.enabled && !A.muted && started)) { started = true; if (await turnOn()) rememberSoundOn(storage, true); }
    sync();
    onChange();
  });

  // a tap anywhere else closes a touch-opened slider
  document.addEventListener('pointerdown', (e) => { if (!group.contains(e.target)) group.classList.remove('open'); });

  sync();
  return { sync, isPlaying: () => started && A.enabled && !A.muted };
}

// ---------------------------------------------------------------------------
// First-visit hint (story 6.15): a small card beside the controls saying sound
// is on and where to change the volume and time of day. Once per visitor; it
// fades after a few seconds (paused while hovered or focused), or closes with
// its close button or as soon as the controls are used.
// ---------------------------------------------------------------------------
export function initHint({ storage = safeLocalStorage(), isPlaying = () => false, delay = 1500, stay = 6000 } = {}) {
  const el = document.getElementById('hint');
  const controls = document.getElementById('controls');
  if (!el) return;
  let seen = false;
  try { seen = storage?.getItem(HINT_KEY) === '1'; } catch { /* show it */ }
  if (seen) return;
  const body = el.querySelector('.hint-body');
  let left = stay, timer = 0, last = 0, paused = false, open = false, used = false;
  const markSeen = () => { try { storage?.setItem(HINT_KEY, '1'); } catch { /* shown again next time */ } };
  const close = () => {
    if (!open) { used = true; markSeen(); return; } // the controls were found before it showed: no need
    open = false; clearInterval(timer);
    el.classList.remove('show');
    setTimeout(() => { el.hidden = true; }, 400);
  };
  setTimeout(() => {
    if (used) return;
    markSeen();
    if (isPlaying()) body.textContent = 'Set the volume or time of day here.';
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    open = true; last = performance.now();
    timer = setInterval(() => {
      const now = performance.now();
      if (!paused) left -= now - last;
      last = now;
      if (isPlaying()) body.textContent = 'Set the volume or time of day here.';
      if (left <= 0) close();
    }, 200);
  }, delay);
  el.querySelector('.hint-close').addEventListener('click', close);
  el.addEventListener('pointerenter', () => { paused = true; });
  el.addEventListener('pointerleave', () => { paused = false; });
  el.addEventListener('focusin', () => { paused = true; });
  el.addEventListener('focusout', () => { paused = false; });
  // using the controls, or opening the Credits list (story 6.12), closes it:
  // on a phone the Credits list would otherwise cover the card
  for (const el2 of [controls, document.getElementById('credits')]) {
    el2?.addEventListener('pointerdown', close);
    el2?.addEventListener('keydown', close);
  }
}

function safeLocalStorage() {
  try { return window.localStorage; } catch { return null; }
}

// ---------------------------------------------------------------------------
// Time-of-day picker (docs/stories/1.3.scene-picker-labels-and-loop.md,
// D-1.6). A menu button above the speaker opens labelled options: "All
// scenes" (the journey cycles, as normal) and the six scenes. Picking a scene
// eases there and loops it; the choice is remembered for this tab. The list
// stays open until the visitor closes it (the button becomes a close icon).
// ---------------------------------------------------------------------------

export const SCENES = [
  ['dawn', 'Dawn'], ['sunny', 'Day'], ['wind', 'Windy'],
  ['rain', 'Rain'], ['twilight', 'Sunset'], ['night', 'Night'],
];
export const OPTIONS = [['all', 'All scenes'], ...SCENES];
export const LOCK_KEY = 'wfn.sceneLock';

// Minimal line icons, 24 x 24, drawn with currentColor.
const ICON_PATHS = {
  all: '<path d="M4.5 10a7.5 7.5 0 0 1 13.4-3.6M19.5 14a7.5 7.5 0 0 1-13.4 3.6"/><path d="M18.4 3.2v3.6h-3.6M5.6 20.8v-3.6h3.6"/>',
  dawn: '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 4l2.5 2.5"/>',
  sunny: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>',
  wind: '<path d="M3 9h10.5a2.75 2.75 0 1 0-2.75-2.75M3 13h14.5a2.75 2.75 0 1 1-2.75 2.75M3 17h6"/>',
  rain: '<path d="M7.5 14.5a3.8 3.8 0 0 1-.4-7.6 5.2 5.2 0 0 1 10 1.4 3.1 3.1 0 0 1-.6 6.2z"/><path d="M9 17.5l-.8 2M12.5 17.5l-.8 2M16 17.5l-.8 2"/>',
  twilight: '<path d="M3 18h18M7 18a5 5 0 0 1 10 0M12 4v5M9.5 6.5 12 9l2.5-2.5"/>',
  night: '<path d="M18.5 14.6A7.2 7.2 0 0 1 9.4 5.5a7.2 7.2 0 1 0 9.1 9.1z"/>',
  menu: '<path d="M5 7.5h14M5 12h14M5 16.5h14"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
};
export const sceneIcon = (name, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ICON_PATHS.sunny}</svg>`;

// Overcast is Rain without the rain; the picker shows it as Rain.
export const pickerScene = (name) => (name === 'overcast' ? 'rain' : SCENES.some(([n]) => n === name) ? name : 'sunny');

// The scene a visitor picked in this tab (sessionStorage), or null.
export function readSceneLock(storage) {
  try { const v = storage?.getItem(LOCK_KEY); return SCENES.some(([n]) => n === v) ? v : null; } catch { return null; }
}
export function rememberSceneLock(storage, name) {
  try { if (name) storage?.setItem(LOCK_KEY, name); else storage?.removeItem(LOCK_KEY); } catch { /* not remembered */ }
}

export function initScenePicker({ scene, config, storage = null }) {
  const group = document.getElementById('scene-ctl');
  const btn = document.getElementById('scene-btn');
  const list = document.getElementById('scene-list');

  list.innerHTML = OPTIONS.map(([name, text]) =>
    `<button class="scene-opt" type="button" data-scene="${name}" aria-pressed="false">${sceneIcon(name, 18)}<span>${text}</span></button>`).join('');
  const opts = [...list.querySelectorAll('.scene-opt')];

  let isOpen = false, shown = null;
  const setOpen = (open) => {
    isOpen = open;
    group.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close the time of day options' : 'Choose the time of day');
    btn.title = open ? 'Close' : 'Time of day';
    btn.innerHTML = sceneIcon(open ? 'close' : 'menu');
  };

  // what is selected: "All scenes" while the journey cycles, else the scene
  const selected = () => (config.cycle.enabled ? 'all' : pickerScene(scene.sceneName || config.activePreset));
  function update() {
    const now = selected();
    if (now === shown) return;
    for (const o of opts) o.setAttribute('aria-pressed', String(o.dataset.scene === now));
    shown = now;
  }

  btn.addEventListener('click', () => setOpen(!isOpen));
  list.addEventListener('click', (e) => {
    const o = e.target.closest('.scene-opt');
    if (!o) return;
    const name = o.dataset.scene;
    if (name === 'all') {
      config.cycle.enabled = true; // the journey carries on from this scene
      rememberSceneLock(storage, null);
    } else {
      config.cycle.enabled = false; // stay in this scene, looping
      if (name !== pickerScene(scene.sceneName || config.activePreset)) scene.applyScene(name);
      rememberSceneLock(storage, name);
    }
    update(); // the list stays open: the visitor closes it
  });
  group.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen) { e.stopPropagation(); setOpen(false); btn.focus(); } });

  setOpen(false);
  update();
  return { update, close: () => setOpen(false) };
}

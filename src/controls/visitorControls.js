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

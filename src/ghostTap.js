// Ghost tap (cue 15 on the Miro board "Clearer cues to try"): a soft
// white tap circle presses on the man's chest and sends out two ripples, to
// show that he can be tapped or clicked. It plays once, delay ms after the
// page opens, and not again once the visitor has greeted him (remembered in
// this browser). It lets taps through, so a tap on it is a tap on him.
// ?ghost forces it on every load, for demos.
//
// The circle follows him each frame (he keeps walking). The animation is CSS
// (main.css, .ghost-tap); with reduced motion it only fades in and out.

const SEEN_KEY = 'wfn.greeted';
const PLAY_MS = 1900; // matches the CSS animation

export function createGhostTap(el, scene, { delay = 2500, force = false, ready = () => true } = {}) {
  const store = (() => { try { return window.localStorage; } catch { return null; } })();
  const greetedBefore = () => { try { return store?.getItem(SEEN_KEY) === '1'; } catch { return false; } };
  let state = (!el || (greetedBefore() && !force)) ? 'done' : 'waiting';
  let clock = 0, playFor = 0;

  // A press anywhere ends it at once (a tap on him starts the greeting).
  window.addEventListener('pointerdown', () => { if (state === 'playing') stop(); }, { capture: true });

  function stop() {
    state = 'done';
    el.classList.remove('play');
    el.hidden = true;
  }

  // His chest on screen (CSS px): from the top of his head, about a third of
  // his height down.
  function chest() {
    const C = scene.config.character, v = scene.view;
    const head = scene.headPoint();
    const height = 285 * C.scale * v.s;
    return { x: head.x - 2 * C.scale * v.s, y: head.y + height * 0.36, size: Math.max(34, Math.min(64, height * 0.22)) };
  }

  return function update(dt) {
    // once he has turned to the visitor, never show it again
    if (scene.greeting.facing) {
      try { store?.setItem(SEEN_KEY, '1'); } catch { /* private mode */ }
      if (state !== 'done') stop();
      return;
    }
    if (state === 'done') return;
    const C = scene.config.character;
    if (!C.visible || !scene.view) return;
    if (state === 'waiting') {
      clock += dt * 1000;
      // wait out the delay and ready() (the sound cue gone, plus 3 s; D-2.12),
      // and for him to be walking (not mid-greeting)
      if (clock < delay || !ready() || scene.greeting.active) return;
      const p = chest();
      if (p.x < 40 || p.x > window.innerWidth - 40) return; // off screen: wait for him
      state = 'playing'; playFor = PLAY_MS;
      el.hidden = false;
      el.classList.remove('play');
      void el.offsetWidth; // restart the CSS animation
      el.classList.add('play');
    }
    if (state === 'playing') {
      const p = chest();
      el.style.setProperty('--size', `${Math.round(p.size)}px`);
      el.style.transform = `translate(${Math.round(p.x - p.size / 2)}px, ${Math.round(p.y - p.size / 2)}px)`;
      playFor -= dt * 1000;
      if (playFor <= 0) stop();
    }
  };
}

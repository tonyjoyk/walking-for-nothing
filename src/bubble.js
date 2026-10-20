// The speech bubble (docs/stories/2.2.speech-bubble.md, D-2.3): shown while
// the man faces the visitor, placed above his head every frame and kept on
// screen. The fade is CSS; this only moves it and switches it on and off.

const MARGIN = 16; // px from the viewport edge
const GAP = 14;    // px between the tail and his head

export function createBubble(el, scene) {
  let shown = false, fading = 0; // seconds of fade-out left
  return function update(dt) {
    const want = scene.bubbleShown;
    if (want !== shown) {
      shown = want;
      el.classList.toggle('show', shown);
      el.setAttribute('aria-hidden', String(!shown));
      if (!shown) fading = 0.8;
    }
    fading = Math.max(0, fading - dt);
    if (!shown && fading <= 0) return; // hidden: nothing to place
    const head = scene.headPoint();
    const w = el.offsetWidth, h = el.offsetHeight;
    const vw = window.innerWidth;
    const left = Math.min(Math.max(MARGIN, head.x - 48), vw - MARGIN - w);
    const top = Math.max(MARGIN, head.y - GAP - h);
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.setProperty('--tail-x', `${Math.round(Math.min(Math.max(18, head.x - left), w - 18))}px`);
  };
}

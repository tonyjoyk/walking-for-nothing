// The speech bubble (docs/stories/2.2.speech-bubble.md, D-2.3; style: story
// 2.4, D-2.5): shown while the man faces the visitor, placed above his head
// every frame and kept on screen. The fade is CSS; this moves it, switches it
// on and off, and sets the white plate behind the words to 40% or 60% from the
// sky behind them, so the dark text always has 4.5:1.

const MARGIN = 16; // px from the viewport edge
const GAP = 22;    // px between the plate and his head (the hairline sits in it)
const SAMPLE_EVERY = 0.4; // seconds between readings of the sky behind the words

// WCAG relative luminance of an sRGB colour (0-255 channels).
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
export const INK = luminance(0x17, 0x21, 0x1c); // the text colour, #17211c

const TARGET = 4.5; // WCAG AA for body text
export const PLATES = [0.4, 0.6]; // the white plate's opacity: 40%, or 60% where 40% isn't enough

// Contrast of the dark ink over the plate, judged on the darkest tenth of the
// sky behind it (px: [r, g, b] samples, blended with white at alpha).
export function plateContrast(px, alpha) {
  const lums = px.map(([r, g, b]) => luminance(r + (255 - r) * alpha, g + (255 - g) * alpha, b + (255 - b) * alpha)).sort((x, y) => x - y);
  return contrast(INK, lums[Math.floor(lums.length * 0.1)]);
}

// The lightest plate that gives the dark ink 4.5:1, or the strongest one.
export function choosePlate(px) {
  for (const alpha of PLATES) {
    const ratio = plateContrast(px, alpha);
    if (ratio >= TARGET || alpha === PLATES[PLATES.length - 1]) return { alpha, ratio };
  }
}

export function createBubble(el, scene, canvas) {
  let shown = false, fading = 0; // seconds of fade-out left
  let sinceSample = Infinity;
  const probe = document.createElement('canvas');
  probe.width = 24; probe.height = 24;
  const pctx = probe.getContext('2d', { willReadFrequently: true });

  // Read the canvas under the plate (scaled down to 24 x 24 samples).
  function readSky(left, top, w, h) {
    canvas = canvas || document.querySelector('#stage canvas'); // made by p5 after this
    if (!canvas || !canvas.width) return;
    const k = canvas.width / canvas.clientWidth;
    try {
      pctx.drawImage(canvas, left * k, top * k, w * k, h * k, 0, 0, probe.width, probe.height);
      const d = pctx.getImageData(0, 0, probe.width, probe.height).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      const pick = choosePlate(px);
      el.style.setProperty('--plate', pick.alpha);
      el.dataset.contrast = pick.ratio.toFixed(1);
      el.dataset.contrast40 = plateContrast(px, 0.4).toFixed(1);
    } catch { /* unreadable canvas: keep the current plate */ }
  }

  return function update(dt) {
    const want = scene.bubbleShown;
    if (want !== shown) {
      shown = want;
      if (shown) sinceSample = Infinity; // read the sky before it fades in
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
    el.style.setProperty('--tail-x', `${Math.round(Math.min(Math.max(8, head.x - left), w - 8))}px`);
    sinceSample += dt;
    if (shown && sinceSample >= SAMPLE_EVERY) { sinceSample = 0; readSky(left, top, w, h); }
  };
}

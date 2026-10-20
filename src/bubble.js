// The speech bubble (docs/stories/2.2.speech-bubble.md, D-2.3; style "Air",
// story 2.3, D-2.4): shown while the man faces the visitor, placed above his
// head every frame and kept on screen. The fade is CSS; this moves it, switches
// it on and off, and picks dark or light ink from the sky behind the words.

const MARGIN = 16; // px from the viewport edge
const GAP = 22;    // px between the words and his head (the hairline sits in it)
const SAMPLE_EVERY = 0.4; // seconds between readings of the sky behind the words

// WCAG relative luminance of an sRGB colour (0-255 channels).
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
export const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
export const INK = { light: luminance(255, 255, 255), dark: luminance(0x17, 0x21, 0x1c) };

const TARGET = 4.5; // WCAG AA for body text
const VEIL = { dark: [255, 255, 255], light: [16, 24, 20] }; // the veil behind dark / light ink

// The worst tenth of the backdrop for an ink: light ink is judged against the
// brightest tenth, dark ink against the darkest tenth.
function worst(px, ink, veil) {
  const v = VEIL[ink];
  const lums = px.map(([r, g, b]) => luminance(r + (v[0] - r) * veil, g + (v[1] - g) * veil, b + (v[2] - b) * veil)).sort((x, y) => x - y);
  const l = ink === 'light' ? lums[Math.floor(lums.length * 0.9)] : lums[Math.floor(lums.length * 0.1)];
  return contrast(INK[ink], l);
}

// Pick the ink with the better worst case over the backdrop (px: [r, g, b]
// samples), keeping the current one when both are close so it never flickers.
// If even the better ink is under 4.5:1, find the faintest veil that lifts it
// there.
export function chooseInk(px, current) {
  const light = worst(px, 'light', 0), dark = worst(px, 'dark', 0);
  let ink = light >= dark ? 'light' : 'dark';
  if (current === 'light' && light >= dark * 0.85) ink = 'light';
  if (current === 'dark' && dark >= light * 0.85) ink = 'dark';
  let veil = 0, ratio = ink === 'light' ? light : dark;
  while (ratio < TARGET && veil < 0.7) { veil = Math.round((veil + 0.05) * 100) / 100; ratio = worst(px, ink, veil); }
  return { ink, veil, ratio };
}

export function createBubble(el, scene, canvas) {
  let shown = false, fading = 0; // seconds of fade-out left
  let ink = 'light', sinceSample = Infinity;
  const probe = document.createElement('canvas');
  probe.width = 24; probe.height = 24;
  const pctx = probe.getContext('2d', { willReadFrequently: true });

  // Read the canvas under the words (scaled down to 24 x 24 samples).
  function readSky(left, top, w, h) {
    canvas = canvas || document.querySelector('#stage canvas'); // made by p5 after this
    if (!canvas || !canvas.width) return;
    const k = canvas.width / canvas.clientWidth;
    try {
      pctx.drawImage(canvas, left * k, top * k, w * k, h * k, 0, 0, probe.width, probe.height);
      const d = pctx.getImageData(0, 0, probe.width, probe.height).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      const pick = chooseInk(px, ink);
      ink = pick.ink;
      el.classList.toggle('ink-dark', ink === 'dark');
      el.style.setProperty('--veil', pick.veil);
      el.dataset.contrast = pick.ratio.toFixed(1);
      el.dataset.veil = pick.veil;
    } catch { /* unreadable canvas: keep the current ink */ }
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

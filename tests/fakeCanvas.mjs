// A recording stand-in for CanvasRenderingContext2D. It accepts every call,
// counts draw operations and flags any non-finite number passed to a path or
// transform method, which is how NaN geometry would show up on screen.
export function createFakeContext() {
  const stats = { calls: 0, fills: 0, strokes: 0, bad: [] };
  const gradient = { addColorStop() {} };
  const check = (name, args) => {
    for (const a of args) {
      if (typeof a === 'number' && !Number.isFinite(a)) { stats.bad.push(name); return; }
    }
  };
  const target = {
    canvas: { width: 1920, height: 1080 },
    createLinearGradient: (...a) => { check('createLinearGradient', a); return gradient; },
    createRadialGradient: (...a) => { check('createRadialGradient', a); return gradient; },
    createPattern: () => ({}),
    fill: () => { stats.fills++; },
    stroke: () => { stats.strokes++; },
    measureText: () => ({ width: 10 }),
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  };
  const ctx = new Proxy(target, {
    get(t, key) {
      if (key === 'stats') return stats;
      if (key in t) {
        const v = t[key];
        return typeof v === 'function' ? (...a) => { stats.calls++; return v(...a); } : v;
      }
      return (...args) => { stats.calls++; check(String(key), args); };
    },
    set(t, key, value) { t[key] = value; return true; },
  });
  return ctx;
}

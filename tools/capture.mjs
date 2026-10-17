// Renders the scene in headless Chrome for visual review. Needs the dev
// server running (npm run dev).
//
//   npm run capture                     # everything, into captures/
//   npm run capture -- --url http://localhost:5173 --out some/dir
//   npm run capture -- --only scenes    # scenes | walk | depth | greet
//
// Writes:
//   scenes.jpg         the six states as square crops around the man (1x)
//   scenes-vs-reference.jpg  the same grid above docs/reference/six-scenes.png
//   scene-<state>.jpg  each state, full frame (1600x900, 1x)
//   walk-full.png, walk-folded.png  one gait cycle, close up (2x), short grass
//   depth.png          the man at ground offset -20, 0 and +20 (1x)
//   greet.jpg          the greeting, start to finish (2x, short grass)
//
// Rendering is deterministic: playback is paused and the scene is stepped
// by a fixed 1/60 s, so captures of the same code are identical.

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://localhost:5180/');
const out = resolve(root, arg('out', 'captures'));
const only = arg('only', 'all');
const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- minimal Chrome DevTools Protocol client ------------------------------
async function openBrowser(width, height, scale) {
  const port = 9400 + Math.floor(Math.random() * 400);
  const profile = mkdtempSync(join(tmpdir(), 'capture-'));
  const chrome = spawn(chromePath, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 60 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
  }
  if (!targets) throw new Error(`Chrome did not start (${chromePath}). Set CHROME_PATH.`);
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled' && process.env.CAPTURE_DEBUG) console.log('  [page]', m.params.args.map((a) => a.value).join(' '));
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  await send('Page.navigate', { url });
  await sleep(2500);
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'page error');
    return r.result.result.value;
  };
  // Large results stay in the page and come back in 1 MB slices: a reply of
  // more than a few megabytes stalls the DevTools connection.
  const fetchAll = async (expression) => {
    const keys = await evaluate(`(async () => { window.__cap = await (${expression}); return Object.keys(window.__cap); })()`);
    if (process.env.CAPTURE_DEBUG) console.log('  keys', keys);
    const out = {};
    const SLICE = 1 << 20;
    for (const k of keys) {
      const ref = `window.__cap[${JSON.stringify(k)}]`;
      const len = await evaluate(`${ref}.length`);
      let value = '';
      for (let i = 0; i < len; i += SLICE) value += await evaluate(`${ref}.slice(${i}, ${i + SLICE})`);
      out[k] = value;
      if (process.env.CAPTURE_DEBUG) console.log('  fetched', k, len);
    }
    return out;
  };
  const close = () => { ws.close(); chrome.kill(); };
  return { evaluate, fetchAll, close, errors };
}

const save = (name, dataUrl) => {
  writeFileSync(join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log('  ' + join(arg('out', 'captures'), name));
};

// Shared page-side helpers, injected before each job.
const PAGE_HELPERS = `
  const { scene: S, config: cfg } = window.__landscape;
  const cv = document.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const pd = cv.width / cv.clientWidth;
  cfg.playback.playing = false;
  const step = (n) => { cfg.playback.playing = true; for (let i = 0; i < n; i++) S.update(1 / 60); cfg.playback.playing = false; };
  const render = () => { S.massCache = { far: {}, mid: {}, fore: {} }; S.render(ctx, cv.clientWidth, cv.clientHeight, pd); };
  const toScreen = (x, y) => [(x - S.view.x0) * S.view.s * pd, (y - S.view.y0) * S.view.s * pd];
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; };
  const label = (g, text, x, y, size) => {
    g.font = (size || 22) + 'px -apple-system, Helvetica, sans-serif';
    const w = g.measureText(text).width;
    g.fillStyle = 'rgba(20,20,28,0.85)'; g.fillRect(x, y, w + 16, (size || 22) + 12);
    g.fillStyle = '#fff'; g.fillText(text, x + 8, y + (size || 22) + 3);
  };
  const loadImage = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
`;

async function scenes() {
  console.log('scenes');
  const b = await openBrowser(1600, 900, 1);
  const refPath = join(root, 'docs/reference/six-scenes.png');
  // the reference goes over in its own call; one huge message can stall the protocol
  const hasRef = existsSync(refPath);
  if (hasRef) await b.evaluate(`window.__ref = ${JSON.stringify('data:image/png;base64,' + readFileSync(refPath).toString('base64'))}; 1`);
  const result = await b.fetchAll(`(async () => {
    ${PAGE_HELPERS}
    const states = [['sunny', 'Daylight'], ['twilight', 'Sunset'], ['rain', 'Rain'], ['night', 'Night'], ['dawn', 'Dawn'], ['wind', 'Windy']];
    step(1); S.callDog(); step(60 * 12);
    const tile = 512, gap = 8;
    const grid = canvas(tile * 3 + gap * 2, tile * 2 + gap);
    const gg = grid.getContext('2d');
    gg.fillStyle = '#fff'; gg.fillRect(0, 0, grid.width, grid.height);
    const out = {};
    states.forEach(([name, title], i) => {
      cfg.activePreset = name; step(60 * 7);
      render();
      out['frame-' + name] = cv.toDataURL('image/jpeg', 0.9);
      // square crop around the man, as in the reference tiles
      const side = cv.height;
      const [mx] = toScreen(S.manX, 0);
      const sx = Math.max(0, Math.min(cv.width - side, mx - side * 0.45));
      const x = (i % 3) * (tile + gap), y = Math.floor(i / 3) * (tile + gap);
      gg.drawImage(cv, sx, 0, side, side, x, y, tile, tile);
      label(gg, (i + 1) + '. ' + title, x + 10, y + 10, 20);
    });
    out.grid = grid.toDataURL('image/jpeg', 0.92);
    if (${hasRef}) {
      const img = await loadImage(window.__ref);
      const h = img.height * grid.width / img.width;
      const both = canvas(grid.width, grid.height + gap * 3 + h);
      const bg = both.getContext('2d');
      bg.fillStyle = '#fff'; bg.fillRect(0, 0, both.width, both.height);
      bg.drawImage(grid, 0, 0);
      bg.drawImage(img, 0, grid.height + gap * 3, grid.width, h);
      label(bg, 'Ours (above)  ·  Reference (below)', 10, grid.height - 44, 20);
      out.both = both.toDataURL('image/jpeg', 0.92);
    }
    return out;
  })()`);
  save('scenes.jpg', result.grid);
  if (result.both) save('scenes-vs-reference.jpg', result.both);
  for (const [k, d] of Object.entries(result)) if (k.startsWith('frame-')) save(`scene-${k.slice(6)}.jpg`, d);
  report(b);
}

async function walk() {
  console.log('walk');
  for (const length of ['full', 'folded']) {
    const b = await openBrowser(1600, 900, 2);
    const strip = await b.evaluate(`(async () => {
      ${PAGE_HELPERS}
      cfg.activePreset = 'sunny'; S.applyPreset('sunny'); S.snapParams();
      cfg.character.munduLength = '${length}';
      cfg.grass.heightMul = 0.35;
      step(1); step(60 * 3);
      const n = 8, s = S.view.s * pd, W = 200 * s, H = 300 * s;
      const out = canvas(W * n, H);
      const g = out.getContext('2d');
      const per = Math.max(1, Math.round(60 / cfg.character.cadence / n));
      for (let i = 0; i < n; i++) {
        if (i) step(per);
        render();
        const [cx, gy] = toScreen(S.manX + 10, 906 + cfg.character.groundOffset);
        g.drawImage(cv, cx - W / 2, gy - H * 0.93, W, H, i * W, 0, W, H);
        g.fillStyle = '#fff'; g.fillRect(i * W, 0, 2, H);
      }
      label(g, 'mundu: ${length}', 10, 10, 24);
      return out.toDataURL('image/png');
    })()`);
    save(`walk-${length}.png`, strip);
    report(b);
  }
}

async function depth() {
  console.log('depth');
  const b = await openBrowser(1600, 900, 1);
  const img = await b.evaluate(`(async () => {
    ${PAGE_HELPERS}
    cfg.activePreset = 'sunny'; S.applyPreset('sunny'); S.snapParams();
    step(1); S.callDog(); step(60 * 12);
    const offsets = [-20, 0, 20];
    const W = 520, H = 360;
    const out = canvas(W * offsets.length, H);
    const g = out.getContext('2d');
    offsets.forEach((o, i) => {
      cfg.character.groundOffset = o;
      step(30);
      render();
      const [cx, gy] = toScreen(S.manX, 906);
      g.drawImage(cv, cx - W / 2, gy - H * 0.72, W, H, i * W, 0, W, H);
      g.fillStyle = '#fff'; g.fillRect(i * W, 0, 3, H);
      label(g, 'ground offset ' + (o > 0 ? '+' : '') + o, i * W + 10, 10, 18);
    });
    return out.toDataURL('image/png');
  })()`);
  save('depth.png', img);
  report(b);
}

async function greet() {
  console.log('greet');
  const b = await openBrowser(1600, 900, 2);
  const result = await b.fetchAll(`(async () => {
    ${PAGE_HELPERS}
    cfg.activePreset = 'sunny'; S.applyScene('sunny'); S.snapParams();
    cfg.grass.heightMul = 0.3; cfg.cycle.enabled = false;
    step(1); step(60 * 2);
    S.greetNow();
    const G = S.greeting;
    const stepUntil = (fn, max = 20) => { for (let i = 0; i < max * 60 && !fn(); i++) step(1); };
    const wait = (sec) => step(Math.round(sec * 60));
    // frames at each beat of the greeting, whatever the stop length
    const beats = [
      ['walking', () => wait(0.3)],
      ['slowing', () => wait(0.6)],
      ['stopped', () => stepUntil(() => G.state === 'settling')],
      ['head turning', () => stepUntil(() => G.headP >= 0.45)],
      ['body following', () => stepUntil(() => G.bodyP >= 0.5)],
      ['facing', () => stepUntil(() => G.state === 'looking')],
      ['looking', () => wait(2)],
      ['smiling', () => { stepUntil(() => G.state === 'smiling'); wait(2); }],
      ['turning back', () => { stepUntil(() => G.state === 'returning'); wait(0.6); }],
      ['nearly round', () => wait(0.6)],
      ['setting off', () => stepUntil(() => G.state === 'starting')],
      ['walking on', () => { stepUntil(() => G.state === 'walking'); wait(0.5); }],
    ];
    const s = S.view.s * pd, W = 150 * s, H = 300 * s;
    const strip = canvas(W * beats.length, H), g = strip.getContext('2d');
    const out = {};
    beats.forEach(([name, go], i) => {
      go();
      render();
      const [cx, gy] = toScreen(S.manX + 3, 906 + cfg.character.groundOffset);
      g.drawImage(cv, cx - W / 2, gy - H * 0.95, W, H, i * W, 0, W, H);
      g.fillStyle = '#fff'; g.fillRect(i * W, 0, 2, H);
      label(g, name, i * W + 6, 6, 15);
    });
    out.strip = strip.toDataURL('image/jpeg', 0.92);
    return out;
  })()`);
  save('greet.jpg', result.strip);
  report(b);
}

function report(b) {
  if (b.errors.length) console.log('  page errors:', b.errors);
  b.close();
}

try {
  if (only === 'all' || only === 'scenes') await scenes();
  if (only === 'all' || only === 'walk') await walk();
  if (only === 'all' || only === 'depth') await depth();
  if (only === 'all' || only === 'greet') await greet();
} catch (e) {
  console.error(e.message);
  if (/fetch failed|ERR_CONNECTION/.test(e.message)) console.error(`Is the dev server running at ${url}?`);
  process.exit(1);
}

// Loads the recorded sound (story 6.6): the manifest, then decoded buffers
// per id. Opus in WebM where the browser plays it, AAC in M4A otherwise.
// A failure marks that id unavailable; nothing throws.

export function pickFormat(canPlay = (t) => new Audio().canPlayType(t)) {
  try { return canPlay('audio/webm; codecs=opus') ? 'webm' : 'm4a'; } catch { return 'm4a'; }
}

export class AssetLoader {
  constructor(ctx, base) {
    this.ctx = ctx;
    this.base = base;
    this.format = pickFormat();
    this.manifest = null;
    this.buffers = {};  // id -> AudioBuffer[]
    this.pending = {};  // id -> Promise
    this.failed = new Set();
  }

  async loadManifest() {
    if (this.manifest) return this.manifest;
    try {
      const r = await fetch(this.base + 'manifest.json');
      if (!r.ok) throw new Error(`manifest ${r.status}`);
      this.manifest = await r.json();
    } catch (e) {
      console.warn('Sound files unavailable, using generated sound:', e.message);
      this.manifest = { sounds: {} };
    }
    return this.manifest;
  }

  // Number of cut files per id (what the schedulers need).
  counts() {
    const out = {};
    for (const [id, s] of Object.entries(this.manifest?.sounds || {})) out[id] = s.files.length;
    return out;
  }

  get(id) { return this.buffers[id] || null; }

  load(id) {
    if (this.buffers[id]) return Promise.resolve(this.buffers[id]);
    if (this.failed.has(id)) return Promise.resolve(null);
    if (this.pending[id]) return this.pending[id];
    const s = this.manifest?.sounds?.[id];
    if (!s) { this.failed.add(id); return Promise.resolve(null); }
    this.pending[id] = Promise.all(s.files.map(async (f) => {
      const r = await fetch(this.base + f[this.format]);
      if (!r.ok) throw new Error(`${f[this.format]} ${r.status}`);
      return this.decode(await r.arrayBuffer());
    })).then((bufs) => { this.buffers[id] = bufs; return bufs; })
      .catch((e) => { console.warn(`Sound ${id} unavailable:`, e.message); this.failed.add(id); return null; })
      .finally(() => { delete this.pending[id]; });
    return this.pending[id];
  }

  // Safari's older decodeAudioData only takes callbacks.
  decode(data) {
    return new Promise((resolve, reject) => {
      const p = this.ctx.decodeAudioData(data, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }

  // Load these ids first (in order), then the rest when the browser is idle.
  async loadFirst(ids) {
    for (const id of ids) await this.load(id);
    const rest = Object.keys(this.manifest?.sounds || {}).filter((id) => !ids.includes(id));
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const next = () => {
      const id = rest.shift();
      if (!id) return;
      this.load(id).then(() => idle(next));
    };
    idle(next);
  }
}

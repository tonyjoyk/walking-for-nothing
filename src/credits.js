// The one quiet "Credits" link, bottom left (story 6.12, D-0.5, D-6.15).
// A small text button opens a short list built from public/audio/manifest.json
// (the same file the sound loads), plus Open-Meteo while live weather is on.
// A disclosure: the button says whether the list is open; Escape, the button
// again, or a click elsewhere closes it, and focus returns to the button.
import { creditsHtml } from './audio/credits.js';

export function initCredits({ base = (import.meta.env?.BASE_URL || '/'), fetchJson = defaultFetch } = {}) {
  const wrap = document.getElementById('credits');
  const btn = document.getElementById('credits-btn');
  const panel = document.getElementById('credits-list');
  const body = panel?.querySelector('.credits-body');
  if (!wrap || !btn || !panel || !body) return { addWeather() {} };
  let manifest = null, weather = false, open = false;

  const render = () => { body.innerHTML = creditsHtml(manifest || { sounds: {} }, { weather }); };
  async function load() {
    if (manifest) return;
    try { manifest = await fetchJson(`${base}audio/manifest.json`); } catch { manifest = { sounds: {} }; }
    render();
  }
  function setOpen(next, { focusButton = false } = {}) {
    open = next;
    btn.setAttribute('aria-expanded', String(open));
    if (open) {
      panel.hidden = false; load();
      requestAnimationFrame(() => requestAnimationFrame(() => { if (open) wrap.classList.add('open'); })); // fade in
    } else {
      wrap.classList.remove('open');
      setTimeout(() => { if (!open) panel.hidden = true; }, 300); // after the fade
    }
    if (!open && focusButton) btn.focus();
  }

  btn.addEventListener('click', () => setOpen(!open));
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false, { focusButton: true }); } });
  document.addEventListener('pointerdown', (e) => { if (open && !wrap.contains(e.target)) setOpen(false); });
  // the panel is page furniture, not the scene: a click on it shouldn't greet or release him
  wrap.addEventListener('pointerdown', (e) => e.stopPropagation());
  wrap.addEventListener('focusout', (e) => { if (open && e.relatedTarget && !wrap.contains(e.relatedTarget)) setOpen(false); });

  return {
    // live weather was used for the opening: credit it in the same list
    addWeather() { weather = true; if (manifest) render(); },
  };
}

async function defaultFetch(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

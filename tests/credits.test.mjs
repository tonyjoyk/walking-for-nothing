// Sound credits on the page (docs/stories/6.12.sound-credits-on-page.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creditsHtml, soundCredits, LICENCE_URLS, WEATHER_CREDIT } from '../src/audio/credits.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const manifest = JSON.parse(read('public/audio/manifest.json'));
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('6.12: every manifest recording is in the rendered list with its title, recordist, link and licence', () => {
  const html = creditsHtml(manifest);
  const items = html.match(/<li>.*?<\/li>/g);
  assert.equal(items.length, soundCredits(manifest).length);
  for (const [id, s] of Object.entries(manifest.sounds)) {
    const c = s.credit;
    const li = items.find((x) => x.includes(`href="${esc(c.url)}"`));
    assert.ok(li, `${id} is listed`);
    assert.ok(li.includes(`>${esc(c.title)}</a>`), `${id}: title`);
    assert.ok(li.includes(`by ${esc(c.recordist)}`), `${id}: recordist`);
    assert.ok(li.includes(`href="${LICENCE_URLS[c.licence]}"`) && li.includes(`>${c.licence}</a>`), `${id}: licence`);
  }
  assert.doesNotMatch(html, /Open-Meteo/, 'no weather credit unless live weather is on');
  assert.match(html, /<a href="[^"]+" target="_blank" rel="noopener">/);
});

test('6.12: the Open-Meteo credit joins the same list while live weather is on', () => {
  const html = creditsHtml(manifest, { weather: true });
  assert.match(html, /<h3>Weather<\/h3><ul><li><a href="https:\/\/open-meteo.com\/"[^>]*>Weather data<\/a> <span class="by">by Open-Meteo.com<\/span>, <a href="https:\/\/creativecommons.org\/licenses\/by\/4.0\/"/);
  assert.equal(WEATHER_CREDIT.licence, 'CC BY 4.0');
  assert.equal(creditsHtml({ sounds: {} }, { weather: true }).includes('<h3>Sounds</h3>'), false, 'no empty sound heading');
});

test('6.12: text from the manifest is escaped', () => {
  const m = { sounds: { x: { files: [{ webm: 'x.webm', m4a: 'x.m4a' }], credit: { title: '<b>"Hi" & bye</b>', recordist: "O'Neil", url: 'https://e.org/?a=1&b="2"', licence: 'CC0', edited: 'cut' } } } };
  const html = creditsHtml(m);
  assert.ok(html.includes('&lt;b&gt;&quot;Hi&quot; &amp; bye&lt;/b&gt;'));
  assert.ok(html.includes('O&#39;Neil'));
  assert.ok(html.includes('href="https://e.org/?a=1&amp;b=&quot;2&quot;"'));
  assert.doesNotMatch(html, /<b>/);
});

test('6.12: one Credits button on the page, an accessible disclosure; the old #credit link is gone', () => {
  const html = read('index.html');
  assert.equal((html.match(/>Credits</g) || []).length, 1);
  assert.doesNotMatch(html, /id="credit"/);
  assert.doesNotMatch(html, /Weather: Open-Meteo/);
  assert.match(html, /<button id="credits-btn" class="credits-btn" type="button" aria-expanded="false" aria-controls="credits-list">Credits<\/button>/);
  assert.match(html, /<section id="credits-list" class="credits-list" aria-labelledby="credits-btn" hidden>/);
  const main = read('src/main.js');
  assert.doesNotMatch(main, /getElementById\('credit'\)/);
  assert.match(main, /credits\.addWeather\(\)/);
  const css = read('src/styles/main.css');
  assert.match(css, /\.credits \{\s*position: fixed;\s*left: max\(10px, env\(safe-area-inset-left\)\);\s*bottom: max\(8px/, 'bottom left');
});

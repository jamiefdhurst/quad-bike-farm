// Searches Freesound's API for CC0 sounds and saves their previews, licence and author to .scratch/shop/ (#857). The search page
// needs JavaScript now, so the old scrapers find nothing.
//
//   node tools/freesound.mjs search "<words>" [--min 20] [--max 300] [--pages 1] [--fetch]   one line a sound; --fetch saves each too
//   node tools/freesound.mjs fetch <id> [<id> ...]                                            saves the preview and its details
//
// The token is FREESOUND_API_KEY, or CLIENT_SECRET in the main checkout's .scratch/freesound-api-creds (never printed). Freesound
// refuses requests closer than about 9 s apart, so every API request waits for 9 s after the last one, kept across runs in
// .scratch/shop/fs/last. Previews (from Freesound's CDN, not the API) are saved as .scratch/shop/fs/<id>.mp3 beside <id>.json
// (name, author, licence, link, duration, tags, description), and every result is CC0: the search is filtered on it and a fetch of
// anything else is refused.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const DIR = '.scratch/shop/fs';
const API = 'https://freesound.org/apiv2';
const GAP_MS = 9000;
const CC0 = 'Creative Commons 0';
const FIELDS = 'id,name,username,license,duration,tags,description,previews,url,samplerate,channels';

function token() {
  if (process.env.FREESOUND_API_KEY) return process.env.FREESOUND_API_KEY;
  const file = '.scratch/freesound-api-creds';
  if (!existsSync(file)) throw new Error(`no token: set FREESOUND_API_KEY, or ask Jamie for ${file}`);
  const line = readFileSync(file, 'utf8').split('\n').find((l) => /^\s*CLIENT_SECRET\s*[=:]/i.test(l));
  if (!line) throw new Error(`${file} has no CLIENT_SECRET line`);
  return line.replace(/^[^=:]*[=:]\s*/, '').replace(/["\r\s]/g, '');
}

// One API request, at least GAP_MS after the last one from any run.
async function api(path, params = {}) {
  mkdirSync(DIR, { recursive: true });
  const last = existsSync(`${DIR}/last`) ? Number(readFileSync(`${DIR}/last`, 'utf8')) : 0;
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  writeFileSync(`${DIR}/last`, String(Date.now()));
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries({ ...params, token: token() })) url.searchParams.set(k, v);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${path}: ${res.status} ${res.statusText}`);
  return res.json();
}

function details(s) {
  return {
    id: s.id,
    name: s.name,
    author: s.username,
    licence: s.license,
    link: s.url ?? `https://freesound.org/people/${s.username}/sounds/${s.id}/`,
    duration: s.duration,
    samplerate: s.samplerate,
    channels: s.channels,
    tags: s.tags,
    description: s.description,
    preview: s.previews?.['preview-hq-mp3'],
  };
}

async function save(s) {
  const d = details(s);
  if (!/creativecommons\.org\/publicdomain\/zero/.test(d.licence) && d.licence !== CC0) throw new Error(`${d.id} is not CC0 (${d.licence})`);
  if (!existsSync(`${DIR}/${d.id}.mp3`)) {
    const res = await fetch(d.preview);
    if (!res.ok) throw new Error(`${d.id} preview: ${res.status}`);
    writeFileSync(`${DIR}/${d.id}.mp3`, Buffer.from(await res.arrayBuffer()));
    await sleep(1000);
  }
  writeFileSync(`${DIR}/${d.id}.json`, JSON.stringify(d, null, 1));
  return d;
}

const line = (d) => `${String(d.id).padStart(7)} ${d.duration.toFixed(1).padStart(6)} s  ${d.author.slice(0, 18).padEnd(18)} ${d.name.slice(0, 70)} | ${(d.description ?? '').replace(/\s+/g, ' ').slice(0, 90)}`;

async function search(words, { min = 20, max = 300, pages = 1, fetchAll = false }) {
  const filter = `license:"${CC0}" duration:[${min} TO ${max}]`;
  for (let page = 1; page <= pages; page++) {
    const r = await api('/search/text/', { query: words, filter, fields: FIELDS, page_size: 30, page });
    for (const s of r.results) console.log(line(fetchAll ? await save(s) : details(s)));
    if (!r.next) break;
  }
}

const main = import.meta.url === `file://${process.argv[1]}`;
if (main) {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name, dflt) => {
    const i = rest.indexOf(`--${name}`);
    if (i < 0) return dflt;
    const v = rest[i + 1];
    rest.splice(i, typeof dflt === 'boolean' ? 1 : 2);
    return typeof dflt === 'boolean' ? true : Number(v);
  };
  if (cmd === 'search') {
    const opts = { min: flag('min', 20), max: flag('max', 300), pages: flag('pages', 1), fetchAll: flag('fetch', false) };
    await search(rest.join(' '), opts);
  } else if (cmd === 'fetch') {
    for (const id of rest) console.log(line(await save(await api(`/sounds/${id}/`, { fields: FIELDS }))));
  } else {
    console.log('node tools/freesound.mjs search "<words>" [--min 20] [--max 300] [--pages 1] [--fetch] | fetch <id> ...');
    process.exit(1);
  }
}

// The FAQ page (faq.html): the hand-written answers in faqContent.js, plus sections generated from the game's own data, so the
// controls, the vehicles, the girls, the bucket list and what's changed are always what the game really has.

import { logoSvg } from '../start/logo.js';
import { CONTROLS } from '../hud/controls.js';
import { CHARACTERS } from '../npc/characters.js';
import { ACHIEVEMENTS } from '../achievements/achievements.js';
import { FAQ_SECTIONS, VEHICLE_NOTES, GIRL_NOTES } from './faqContent.js';
import { ALL_VEHICLE_SPECS, vehicleFacts } from './facts.js';
import { parseGitLog, longDate } from './changes.js';

/* global __GIT_LOG__ */
const GIT_LOG = typeof __GIT_LOG__ === 'string' ? __GIT_LOG__ : '';

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

function qa(entry) {
  const id = slug(entry.q);
  const badge = entry.spoiler ? '<span class="badge">Spoiler</span>' : '';
  return `<details class="qa${entry.spoiler ? ' spoiler' : ''}" id="${id}"><summary>${entry.q}${badge}</summary><div class="a">${entry.a}</div></details>`;
}

function handSection(s) {
  return { id: s.id, title: s.title, html: (s.intro ? `<p class="intro">${s.intro}</p>` : '') + s.entries.map(qa).join('') };
}

function controlsSection() {
  const html = CONTROLS.map((c) => `<div class="card controls"><h3>${c.title}</h3><ul>${c.lines.map((l) => `<li>${l}</li>`).join('')}</ul></div>`).join('');
  return { id: 'controls', title: 'Controls', html: `<p class="intro">The same list as <kbd>H</kbd> in the game.</p><div class="grid">${html}</div>` };
}

function vehiclesSection() {
  const cards = ALL_VEHICLE_SPECS.map((spec) => {
    const note = VEHICLE_NOTES[spec.id] ?? { blurb: '', tips: [] };
    const facts = vehicleFacts(spec).map(([k, v]) => `<tr><th>${k}</th><td>${escapeHtml(v)}</td></tr>`).join('');
    const tips = note.tips?.length ? `<ul class="tips">${note.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';
    return `<div class="card vehicle" id="vehicle-${spec.id}"><h3><span class="swatch" style="background:${hex(spec.bodyColor ?? 0x777777)}"></span>${escapeHtml(spec.name)}</h3>
      <p>${escapeHtml(note.blurb)}</p><table class="facts">${facts}</table>${tips}</div>`;
  }).join('');
  const intro = `Each game has between four and all twelve of these, parked anywhere a quad might be. The facts come from the game's own specs.`;
  return { id: 'vehicles', title: 'The vehicles', html: `<p class="intro">${intro}</p><div class="grid">${cards}</div>` };
}

function girlsSection(hand) {
  const cards = CHARACTERS.map((c) => {
    const note = GIRL_NOTES[c.id] ?? { blurb: '', traits: [] };
    const traits = note.traits?.length ? `<ul class="tips">${note.traits.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '';
    return `<div class="card girl" id="girl-${c.id}"><h3><span class="swatch" style="background:${c.mapColour}"></span>${escapeHtml(c.name)}</h3>
      <p>${escapeHtml(note.blurb)}</p>${traits}</div>`;
  }).join('');
  return { id: hand.id, title: hand.title, html: `<div class="grid two">${cards}</div>` + hand.entries.map(qa).join('') };
}

function bucketSection() {
  const groups = new Map();
  for (const a of ACHIEVEMENTS) {
    if (!groups.has(a.group)) groups.set(a.group, []);
    groups.get(a.group).push(a);
  }
  const total = ACHIEVEMENTS.reduce((n, a) => n + a.points, 0);
  const lists = [...groups].map(([group, items]) => `<h3>${escapeHtml(group)}</h3><ul class="bucket">${items.map((a) =>
    `<li><span class="points" title="${a.points} point${a.points > 1 ? 's' : ''}">${'●'.repeat(a.points)}</span><b>${escapeHtml(a.name)}</b>: ${escapeHtml(a.hint)}</li>`).join('')}</ul>`).join('');
  const html = `<p class="intro">Press <kbd>Tab</kbd> in the game for the notebook. There are ${ACHIEVEMENTS.length} in all, worth ${total} points; the ones for
    a vehicle that isn't on the farm are left off that game's list.</p>
    <details class="qa spoiler"><summary>Show the whole list<span class="badge">Spoiler</span></summary><div class="a">${lists}</div></details>`;
  return { id: 'bucket-list', title: 'The bucket list', html };
}

function changesSection() {
  const days = parseGitLog(GIT_LOG, { limit: 40 });
  const html = days.length
    ? days.map((d) => `<h3>${longDate(d.date)}</h3><ul class="changes">${d.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`).join('')
    : '<p>Not available in this build.</p>';
  return { id: 'changes', title: 'Recently changed', html: `<p class="intro">The latest changes to the game, newest first.</p>${html}` };
}

function build() {
  const hand = Object.fromEntries(FAQ_SECTIONS.map((s) => [s.id, s]));
  const order = [
    handSection(hand.basics), controlsSection(), vehiclesSection(), handSection(hand.starting), handSection(hand.riding),
    handSection(hand.fuel), handSection(hand.mud), handSection(hand.fixing), girlsSection(hand.girls), handSection(hand.farm),
    handSection(hand.big), bucketSection(), handSection(hand.secrets), handSection(hand.tinkerers), changesSection(),
  ];
  // Any hand-written section not placed above still shows, before the changes.
  for (const s of FAQ_SECTIONS) if (!order.some((o) => o.id === s.id)) order.splice(order.length - 1, 0, handSection(s));

  document.getElementById('faq-logo').innerHTML = logoSvg({ prefix: 'faq' });
  document.getElementById('faq-nav').innerHTML = order.map((s) => `<a href="#${s.id}">${s.title}</a>`).join('');
  document.getElementById('faq-main').innerHTML = order.map((s) => `<section id="${s.id}"><h2>${s.title}</h2>${s.html}</section>`).join('');
}

/** Filter by the search box: a question or card stays if its text matches; matching answers open, except spoilers. */
function wireSearch() {
  const input = document.getElementById('faq-search');
  const items = [...document.querySelectorAll('#faq-main .qa, #faq-main .card')];
  const text = new Map(items.map((el) => [el, el.textContent.toLowerCase()]));
  const sections = [...document.querySelectorAll('#faq-main section')];
  input.addEventListener('input', () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const el of items) {
      const hit = words.every((w) => text.get(el).includes(w));
      el.hidden = words.length > 0 && !hit;
      if (el.tagName === 'DETAILS' && !el.classList.contains('spoiler')) el.open = words.length > 0 && hit;
    }
    for (const s of sections) s.hidden = words.length > 0 && !s.querySelector('.qa:not([hidden]), .card:not([hidden])');
  });
}

/** A link to a question (#its-slug) opens it. */
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (el?.tagName === 'DETAILS') {
    el.open = true;
    el.scrollIntoView();
  }
}

/** Headings jumped to land below the sticky bar, however many rows it wraps to. */
function trackNavHeight() {
  const nav = document.getElementById('faq-nav');
  const set = () => document.documentElement.style.setProperty('--nav-h', `${nav.offsetHeight}px`);
  set();
  addEventListener('resize', set);
}

build();
trackNavHeight();
wireSearch();
openFromHash();
addEventListener('hashchange', openFromHash);

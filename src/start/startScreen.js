// The start screen over the game: the logo, Continue and New farm when there's a saved farm, a tip from the FAQ that changes every
// few seconds, and a link to the FAQ page in a new tab. Loaded on its own ahead of main.js, so it shows while the game is still loading.

import './keyEditor.js';
import { logoSvg } from './logo.js';
import { faqTips } from '../faq/faqContent.js';
import { currentBuild, newSince } from './sinceLast.js';
import { browserStorage, continueInfo, wipeSave } from '../farm/farmSave.js';

/* global __GIT_LOG_HASHES__ */
const GIT_LOG = typeof __GIT_LOG_HASHES__ === 'string' ? __GIT_LOG_HASHES__ : '';
const BUILD_KEY = 'quadBikeFarmLastBuild';

const TIP_EVERY = 9; // seconds each tip stays up

document.getElementById('start-logo').innerHTML = logoSvg({ prefix: 'start' });

const tipEl = document.getElementById('start-tip');
const tips = faqTips();
let order = tips.map((t, i) => [Math.random(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
let at = 0;
function nextTip() {
  if (!tips.length) return;
  tipEl.textContent = `Tip: ${tips[order[at % order.length]]}`;
  at++;
}
nextTip();
setInterval(() => {
  if (!document.getElementById('overlay').classList.contains('hidden')) nextTip();
}, TIP_EVERY * 1000);

// Opening the FAQ mustn't count as clicking to play.
document.getElementById('start-faq').addEventListener('click', (e) => e.stopPropagation());

// The farm that remembers (farm/farmSave.js). The game behind the card is already the saved farm's next day, so Continue just plays
// (its click reaches the card like any other); New farm forgets the save and loads the page again, which deals a new farm.
const storage = browserStorage();
const saved = continueInfo({ search: location.search, storage });
if (saved) {
  document.getElementById('start-farm').hidden = false;
  document.getElementById('start-continue').textContent = `Continue: day ${saved.day}`;
  document.getElementById('start-new').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!confirm('Start a new farm? The one you have now, and everything it remembers, is gone for good.')) return;
    wipeSave(storage);
    location.reload();
  });
} else if (new URLSearchParams(location.search).has('seed')) {
  document.getElementById('overlay-play').textContent = 'Click to play. A seeded game: the farm is not saved.';
}

// Called it a day (game.js callItADay): the page has loaded again as the next day, so the card comes up out of the black the game left.
try {
  if (sessionStorage.getItem('quadBikeFarmNextDay')) {
    sessionStorage.removeItem('quadBikeFarmNextDay');
    document.getElementById('overlay').classList.add('daybreak');
  }
} catch {
  // no fade
}

// New since last time: what changed since the build you last played. The build counts as played once you click into the game (a click on
// the FAQ link or New farm stops before the card), so a load you only look at doesn't use it up.
const build = currentBuild(GIT_LOG);
let lastBuild = null;
try {
  lastBuild = localStorage.getItem(BUILD_KEY);
} catch {
  // no memory of it
}
const since = newSince(GIT_LOG, lastBuild);
const sinceEl = document.getElementById('start-since');
if (since) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  sinceEl.innerHTML = `<b>New since last time</b><ul>${since.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>${
    since.more ? `<a href="faq.html#changes" target="_blank" rel="noopener">and ${since.more} more</a>` : ''}`;
  sinceEl.hidden = false;
  sinceEl.querySelector('a')?.addEventListener('click', (e) => e.stopPropagation());
}
document.getElementById('overlay').addEventListener('click', () => {
  sinceEl.hidden = true;
  try {
    if (build) localStorage.setItem(BUILD_KEY, build);
  } catch {
    // not remembered
  }
});

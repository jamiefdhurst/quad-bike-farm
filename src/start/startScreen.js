// The start screen over the game: the logo, Continue and New farm when there's a saved farm, a tip from the FAQ that changes every
// few seconds, and a link to the FAQ page in a new tab. Loaded on its own ahead of main.js, so it shows while the game is still loading.

import { logoSvg } from './logo.js';
import { faqTips } from '../faq/faqContent.js';
import { browserStorage, continueInfo, wipeSave } from '../farm/farmSave.js';

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

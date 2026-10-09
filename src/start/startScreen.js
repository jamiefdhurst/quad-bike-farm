// The start screen over the game: the logo, a tip from the FAQ that changes every few seconds, and a link to the FAQ page in a new
// tab. Loaded on its own ahead of main.js, so it shows while the game is still loading.

import { logoSvg } from './logo.js';
import { faqTips } from '../faq/faqContent.js';

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

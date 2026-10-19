// A smoke test: run the real game in headless Chrome and fail if it throws. `npm run smoke` locally; CI runs it in the Test check (#262).
// Unit tests never build game.js, so a frame that throws (#260) is invisible to them. This clears the "Click to play" overlay so frames run,
// plays a few set-ups for about 20 s each, and fails on a page error, a console.error, a feature the frame guard caught (core/featureGuard.js),
// a girl or vehicle with a NaN position, a girl stood or walking more than 0.6 m off the ground, or a vehicle more than 2 m under it.
//
//   npm run smoke                  all set-ups      SMOKE_SECONDS=10 npm run smoke   shorter      node tools/smoke.mjs 7   only set-up number 2
//   CHROME_PATH=/path/to/chrome    to use a particular Chrome (else a system Chrome is looked for)
import { existsSync } from 'node:fs';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';

const SECONDS = Number(process.env.SMOKE_SECONDS || 20);
const SETUPS = [
  { name: 'seed 3, sunny', query: 'seed=3&weather=sunny', clockRate: 1 },
  { name: 'seed 7, snow', query: 'seed=7&weather=snow', clockRate: 1 },
  { name: 'seed 5, dusk, fast clock', query: 'seed=5&time=17', clockRate: 60 },
];
const only = process.argv[2] ? [SETUPS[Number(process.argv[2]) - 1]].filter(Boolean) : SETUPS;

const CHROMES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const executablePath = CHROMES.find((p) => p && existsSync(p));
if (!executablePath) {
  console.error('smoke: no Chrome found. Set CHROME_PATH.');
  process.exit(2);
}

const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  // software GL, so it runs on a CI runner with no GPU
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

const problems = [];
async function run(setup) {
  const seen = new Map();
  const note = (k) => seen.set(k, (seen.get(k) || 0) + 1);
  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 500 });
  page.on('pageerror', (e) => note(`page error: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' | ').trim()}`));
  page.on('console', (m) => { if (m.type() === 'error') note(`console.error: ${m.text().slice(0, 300)}`); });
  await page.evaluateOnNewDocument(() => { speechSynthesis.speak = () => {}; localStorage.clear(); });
  await page.goto(`${base}?${setup.query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.companions && document.getElementById('overlay-status')?.textContent === 'Ready', { timeout: 150000 });
  await page.evaluate((rate) => {
    const o = document.getElementById('overlay');
    o.classList.add('hidden');
    o.style.display = 'none';
    game.audioHub.params.muted = true;
    (game.daylight.p ?? game.daylight.params ?? game.daylight).clockRate = rate;
  }, setup.clockRate);
  for (let t = 0; t < SECONDS; t += 2) {
    await new Promise((r) => setTimeout(r, 2000));
    const out = await page.evaluate(() => {
      const out = [];
      for (const c of game.companions) {
        const r = c.root;
        const wp = r.getWorldPosition(new r.position.constructor());
        const st = c.fsm.name;
        if (!Number.isFinite(wp.x + wp.y + wp.z)) out.push(`${c.character.id} NaN position in ${st}`);
        else if (['idle', 'walking'].includes(st) && Math.abs(wp.y - game.world.heightAt(wp.x, wp.z)) > 0.6) out.push(`${c.character.id} ${st}: off the ground`);
      }
      for (const u of game.units) {
        const q = u.quad.position;
        if (!Number.isFinite(q.x + q.y + q.z)) out.push(`${u.id} NaN position`);
        else if (q.y < game.world.heightAt(q.x, q.z) - 2) out.push(`${u.id} under the ground`);
      }
      return out;
    });
    for (const o of out) note(`odd: ${o}`);
  }
  const guarded = await page.evaluate(() => game.guard.summary());
  for (const g of guarded) note(`feature ${g.name} threw ${g.count}x: ${g.message}`);
  const ran = await page.evaluate(() => game.firstFrameDone === true);
  if (!ran) note('no frame ever finished');
  await page.close();
  const bad = [...seen].map(([k, n]) => `${n}x ${k}`);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${setup.name}${bad.length ? '\n  ' + bad.join('\n  ') : ''}`);
  if (bad.length) problems.push(setup.name);
}

try {
  for (const s of only) await run(s);
} catch (e) {
  console.error('smoke: could not run:', e.message);
  problems.push('crashed');
} finally {
  await browser.close();
  await server.close();
}
if (problems.length) {
  console.error(`smoke failed: ${problems.join(', ')}`);
  process.exit(1);
}
console.log('smoke passed');
process.exit(0);

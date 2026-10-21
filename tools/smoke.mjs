// A smoke test: run the real game in headless Chrome and fail if it throws. `npm run smoke` locally; CI runs it in the Smoke job, which the Test check waits for (#262, #284).
// Unit tests never build game.js, so a frame that throws (#260) is invisible to them. This clears the "Click to play" overlay so frames run,
// plays one farm through a few phases (weather and time changed in the page, so the game loads once), and fails on a page error, a console.error, a feature the frame guard caught (core/featureGuard.js),
// a girl or vehicle with a NaN position, a girl stood or walking more than 0.6 m off the ground, or a vehicle more than 2 m under it.
//
// It uses the built game in dist/ if there is one (?smoke exposes window.game in a build), else the dev server (SMOKE_DEV=1 forces that).
// Drawing is skipped (the GL draw calls do nothing): on software GL the first frame alone took half a minute, and drawing finds nothing the update doesn't.
//
//   npm run smoke                  SMOKE_SECONDS=10 npm run smoke   shorter phases
//   CHROME_PATH=/path/to/chrome    to use a particular Chrome (else a system Chrome is looked for)
import { existsSync } from 'node:fs';
import { createServer, preview } from 'vite';
import puppeteer from 'puppeteer-core';

const SECONDS = Number(process.env.SMOKE_SECONDS || 20);
// One load (about 20 s here, minutes on a CI runner), then phases: sunny at the real clock, then snow with the clock fast so the evening comes in.
const QUERY = process.env.SMOKE_QUERY ?? 'seed=3&weather=sunny&time=15.5'; // SMOKE_QUERY tries another set-up, e.g. a season
const PHASES = [
  { name: 'sunny', weather: 'sunny', clockRate: 1, seconds: SECONDS / 2 },
  { name: 'snow, fast clock into dusk', weather: 'snow', clockRate: 600, seconds: SECONDS / 2 },
];

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

// The built game when there is one (CI builds first): one bundle loads far faster than hundreds of modules transformed on request.
// SMOKE_DEV=1 forces the dev server, which sees source edits without a build.
const built = existsSync('dist/index.html') && !process.env.SMOKE_DEV;
let server;
if (built) server = await preview({ preview: { port: 0, strictPort: false }, logLevel: 'error' });
else {
  server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
}
const base = server.resolvedUrls.local[0];
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  // software GL, so it runs on a CI runner with no GPU
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

const problems = [];
async function run() {
  const t0 = Date.now();
  const seen = new Map();
  const note = (k) => seen.set(k, (seen.get(k) || 0) + 1);
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 200 });
  page.on('pageerror', (e) => note(`page error: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' | ').trim()}`));
  page.on('console', (m) => { if (m.type() === 'error') note(`console.error: ${m.text().slice(0, 300)}`); });
  await page.evaluateOnNewDocument(() => { speechSynthesis.speak = () => {}; localStorage.clear();
    for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
      for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) if (C.prototype[f]) C.prototype[f] = function () {};
    }
  });
  await page.goto(`${base}?smoke&${QUERY}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.companions && document.getElementById('overlay-status')?.textContent === 'Ready', { timeout: 150000 });
  const loaded = Date.now();
  await page.evaluate(() => {
    const o = document.getElementById('overlay');
    o.classList.add('hidden');
    o.style.display = 'none';
    game.audioHub.params.muted = true;
  });
  for (const phase of PHASES) {
    await page.evaluate((ph) => {
      game.setWeatherKind(ph.weather);
      game.daylight.p.clockRate = ph.clockRate;
    }, phase);
    for (let t = 0; t < phase.seconds; t += 2) {
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
  }
  const guarded = await page.evaluate(() => game.guard.summary());
  for (const g of guarded) note(`feature ${g.name} threw ${g.count}x: ${g.message}`);
  const ran = await page.evaluate(() => game.firstFrameDone === true);
  if (!ran) note('no frame ever finished');
  await page.close();
  const bad = [...seen].map(([k, n]) => `${n}x ${k}`);
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${PHASES.map((p) => p.name).join(', then ')} (loaded in ${Math.round((loaded - t0) / 1000)} s, ${Math.round((Date.now() - loaded) / 1000)} s played)${bad.length ? '\n  ' + bad.join('\n  ') : ''}`);
  if (bad.length) problems.push('smoke');
}

try {
  await run();
} catch (e) {
  console.error('smoke: could not run:', e.message);
  problems.push('crashed');
} finally {
  await browser.close();
  await (server.close?.() ?? server.httpServer.close());
}
if (problems.length) {
  console.error(`smoke failed: ${problems.join(', ')}`);
  process.exit(1);
}
console.log('smoke passed');
process.exit(0);

// Loads a build of the game on its own in headless Chrome and measures the frame budget's spots (tools/frameBudget.mjs). CI runs it on main's
// build to have numbers to compare a PR with; locally, `node tools/frameBudget.mjs --dist dist --out numbers.json`.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { MEASURE_ARGS, measureInPage } from './frameBudget.mjs';

const CHROMES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
export const chromePath = () => CHROMES.find((p) => p && existsSync(p));

/** The page's set-up shared with the smoke test: speech silenced, a fresh farm, GL draws stubbed (renderer.info still counts them). */
export const stubDraws = () => {
  speechSynthesis.speak = () => {};
  localStorage.clear();
  for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
    for (const f of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) if (C.prototype[f]) C.prototype[f] = function () {};
  }
};

export const CHROME_ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];

/** How long a page may take to reach "Ready": one limit for the smoke test and the budget run (CI's software GL has taken 79 to 134 s, #760). */
export const LOAD_TIMEOUT_MS = 300000;

/** Records the loading screen's steps with the time each first showed, in `window.__loadSteps`, so a slow load can say where it spent its time. */
export const recordLoadSteps = () => {
  const steps = (window.__loadSteps = []);
  let last = '';
  new MutationObserver(() => {
    const s = document.getElementById('overlay-status')?.textContent;
    if (s !== last) steps.push([Math.round(performance.now()) / 1000, (last = s)]);
  }).observe(document, { subtree: true, childList: true, characterData: true });
};

/** The steps seen so far as "12.3 s  Building the farm", each once (a step that counts "3/14" is shown at its first count). */
export async function loadStepLines(page) {
  const marks = await page.evaluate(() => window.__loadSteps || []).catch(() => []);
  const seen = new Set();
  const lines = [];
  for (const [t, s] of marks) {
    const step = (s || '').replace(/\s*\d+\/\d+$/, '');
    if (!step || seen.has(step)) continue;
    seen.add(step);
    lines.push(`${t.toFixed(1).padStart(6)} s  ${s}`);
  }
  return lines;
}

/** Waits for the game object, its companions and the "Ready" status. On a timeout the error names which of the three were missing and the steps' timeline. */
export async function waitForReady(page, { timeout = LOAD_TIMEOUT_MS, polling = 250 } = {}) {
  try {
    await page.waitForFunction(() => window.game?.companions && document.getElementById('overlay-status')?.textContent === 'Ready', { timeout, polling });
  } catch (err) {
    const got = await page.evaluate(() => ({
      game: !!window.game,
      companions: !!window.game?.companions,
      status: document.getElementById('overlay-status')?.textContent,
      href: location.href,
    })).catch(() => null);
    const missing = !got ? ['the page (gone)'] : [!got.game && 'the game object', !got.companions && 'the companions', got.status !== 'Ready' && `the Ready status (it says "${got.status}")`].filter(Boolean);
    const steps = await loadStepLines(page);
    throw new Error(`still loading after ${Math.round(timeout / 1000)} s, missing: ${missing.join(', ')}${got ? ` (${got.href})` : ''}${steps.length ? `\nloading steps:\n${steps.join('\n')}` : ''}`, { cause: err });
  }
}

/** Measure the build in `dist` (the one checked out at `root`, default here): { [spot]: { calls, triangles } }. The farm is the smoke test's. */
export async function measureBuild({ dist = 'dist', root = '.', query = 'seed=3&weather=sunny&time=15.5' } = {}) {
  const executablePath = chromePath();
  if (!executablePath) throw new Error('no Chrome found. Set CHROME_PATH.');
  const server = await preview({ root: resolve(root), build: { outDir: resolve(root, dist) }, preview: { port: 0, strictPort: false }, logLevel: 'error' });
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: CHROME_ARGS });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 320, height: 200 });
    await page.evaluateOnNewDocument(stubDraws);
    await page.evaluateOnNewDocument(recordLoadSteps);
    await page.goto(`${server.resolvedUrls.local[0]}?smoke&${query}`, { waitUntil: 'load' });
    await waitForReady(page);
    await page.evaluate(() => {
      const o = document.getElementById('overlay');
      o.classList.add('hidden');
      o.style.display = 'none';
      game.audioHub.params.muted = true;
    });
    const r = await page.evaluate(measureInPage, MEASURE_ARGS);
    if (r.error) throw new Error(r.error);
    return r.spots;
  } finally {
    await browser.close();
    await (server.close?.() ?? server.httpServer.close());
  }
}

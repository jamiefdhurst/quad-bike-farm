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
    await page.goto(`${server.resolvedUrls.local[0]}?smoke&${query}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.game?.companions && document.getElementById('overlay-status')?.textContent === 'Ready', { timeout: 150000, polling: 250 });
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

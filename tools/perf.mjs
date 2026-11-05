// Measures how the game runs on this machine's real GPU, for /perf (.claude/commands/perf.md) and anyone checking a change locally:
// time to "Ready" and MB fetched, then at each of the frame budget's spots (tools/frameBudget.mjs) the draw calls, triangles, ms a frame, the
// worst frame and the slowest features. Several runs, medians kept (tools/perfReport.mjs). It builds and serves the checkout itself.
//
//   node tools/perf.mjs --out after.json                 this checkout (built first)
//   node tools/perf.mjs --main --out before.json         origin/main, in a throwaway worktree beside this checkout
//   node tools/perf.mjs --compare before.json after.json the before-and-after table, without measuring
//   --runs 3 (default 2)  --dwell 2 (seconds held on each view, default 1.5)  --no-build (reuse dist/)  --profile 10 (a CPU profile of
//   10 s at the spawn, by function; add --dev for readable names: the dev server, not a build, so compare its numbers only with --dev ones)
//
//   --stages (where each frame's JS time goes at every spot, from the game's own frame breakdown)
//   --steps (the loading steps' timeline on the first run, to see which step a slow load spends its time in)
//
// CI can't do this (software GL makes ms meaningless); it holds draw calls and triangles only, in the smoke test.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { MEASURE_ARGS, measureInPage } from './frameBudget.mjs';
import { chromePath } from './frameBudgetRun.mjs';
import { combineRuns, report } from './perfReport.mjs';

const args = process.argv.slice(2);
const arg = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

if (args.includes('--compare')) {
  const [before, after] = args.filter((a) => a.endsWith('.json'));
  console.log(report(read(after), read(before)));
  process.exit(0);
}

const here = resolve(dirname(new URL(import.meta.url).pathname), '..');
const runs = Number(arg('--runs', 2));
const dwell = Number(arg('--dwell', 1.5));
const profileSeconds = Number(arg('--profile', 0));
const dev = args.includes('--dev');
const query = arg('--query', ''); // more of the URL's query, as `body=flat`, to measure a flag
const steps = args.includes('--steps');
const git = (...a) => execFileSync('git', a, { cwd: here, encoding: 'utf8' }).trim();

// --main: origin/main checked out on its own, sharing this checkout's node_modules. Never the main checkout itself, which other sessions edit.
let root = here;
let throwaway = null;
if (args.includes('--main')) {
  git('fetch', '-q', 'origin', 'main');
  throwaway = resolve(here, '..', `${here.split('/').pop()}-perf-main`);
  if (existsSync(throwaway)) git('worktree', 'remove', '--force', throwaway);
  git('worktree', 'add', '-q', '--detach', throwaway, 'origin/main');
  symlinkSync(resolve(here, 'node_modules'), resolve(throwaway, 'node_modules'));
  root = throwaway;
}

try {
  if (!dev && (!args.includes('--no-build') || !existsSync(resolve(root, 'dist')))) {
    console.error(`perf: building ${root === here ? 'this checkout' : 'origin/main'}...`);
    execFileSync('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] });
  }
  const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const all = [];
  for (let i = 0; i < runs; i++) {
    console.error(`perf: run ${i + 1} of ${runs}...`);
    all.push(await measureOnce(root, i === 0 ? profileSeconds : 0, i === 0 && steps));
  }
  const result = { commit, dev, at: new Date().toISOString(), machine: `${process.platform} ${process.arch}`, runs, ...combineRuns(all) };
  if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(result, null, 1));
  console.log(report(result));
} finally {
  if (throwaway) {
    git('worktree', 'remove', '--force', throwaway);
    rmSync(throwaway, { recursive: true, force: true });
  }
}
process.exit(0);

/** One load of the built game in `root`: { load: { readyS, mb, heapMb }, spots }. The farm is the smoke test's: seed 3, sunny, mid-afternoon. */
async function measureOnce(root, profileFor, showSteps) {
  const executablePath = chromePath();
  if (!executablePath) throw new Error('no Chrome found. Set CHROME_PATH.');
  let server;
  if (dev) {
    server = await createServer({ root, server: { port: 0, strictPort: false }, logLevel: 'error' });
    await server.listen();
  } else server = await preview({ root, build: { outDir: resolve(root, 'dist') }, preview: { port: 0, strictPort: false }, logLevel: 'error' });
  const gpu = process.platform === 'darwin' ? ['--use-angle=metal'] : [];
  const browser = await puppeteer.launch({ executablePath, headless: 'new', args: [...gpu, '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1600,1000'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => console.error('perf: page error:', e.message));
    await page.evaluateOnNewDocument(() => {
      speechSynthesis.speak = () => {};
      localStorage.clear();
    });
    let bytes = 0;
    page.on('response', (r) => { bytes += Number(r.headers()['content-length'] || 0); });
    const t0 = Date.now();
    // The loading screen's steps as they show, so "Ready" is timed when it appears (the page's load event can come later).
    const marks = [];
    await page.exposeFunction('perfStep', (s) => marks.push([(Date.now() - t0) / 1000, s]));
    await page.evaluateOnNewDocument(() => {
      let last = '';
      new MutationObserver(() => {
        const s = document.getElementById('overlay-status')?.textContent;
        if (s !== last) window.perfStep?.((last = s));
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto(`${server.resolvedUrls.local[0]}?smoke&seed=3&weather=sunny&time=15.5${query ? `&${query}` : ''}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.game?.companions && document.getElementById('overlay-status')?.textContent === 'Ready', { timeout: 150000, polling: 50 });
    const readyS = marks.find(([, s]) => s === 'Ready')?.[0] ?? (Date.now() - t0) / 1000;
    // Each step once, at the time it first showed (a step that counts "3/14" shows once per count otherwise).
    const seen = new Set();
    for (const [t, s] of showSteps ? marks.filter(([, s]) => s) : []) {
      const step = s.replace(/\s*\d+\/\d+$/, '');
      if (!seen.has(step)) seen.add(step), console.error(`perf: ${t.toFixed(2).padStart(6)} s  ${s}`);
    }
    const heapMb = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize / 1e6 : undefined));
    await new Promise((ok) => setTimeout(ok, 5000)); // a player is on the start card for a few seconds: what the game builds behind it (shaders #372, the lane's vehicles #532) is done
    await page.evaluate(() => {
      const o = document.getElementById('overlay');
      o.classList.add('hidden');
      o.style.display = 'none';
      game.audioHub.params.muted = true;
    });
    await new Promise((ok) => setTimeout(ok, 4000)); // shaders and the first frames' building settle
    if (profileFor) await profile(page, profileFor);
    const r = await page.evaluate(measureInPage, { ...MEASURE_ARGS, frames: 10, dwell });
    if (r.error) throw new Error(r.error);
    for (const n of r.notes ?? []) console.error(`perf: ${n}`);
    if (args.includes('--stages')) for (const [spot, v] of Object.entries(r.spots)) console.error(`perf: ${spot} stages (ms): ${(v.stages ?? []).map(([n, ms]) => `${n} ${ms}`).join(', ')}`);
    return { load: { readyS, mb: bytes / 1e6, heapMb }, spots: r.spots };
  } finally {
    await browser.close();
    await (server.close?.() ?? server.httpServer.close());
  }
}

/** A CPU profile of the spawn view for `seconds`, printed by function: inclusive time in the game's code and self time anywhere. */
async function profile(page, seconds) {
  const cdp = await page.createCDPSession();
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await page.evaluate(() => { window.__frames = 0; const f = () => { window.__frames++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await cdp.send('Profiler.start');
  await new Promise((ok) => setTimeout(ok, seconds * 1000));
  const { profile: prof } = await cdp.send('Profiler.stop');
  const frames = Math.max(1, await page.evaluate(() => window.__frames));
  const byId = new Map(prof.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of prof.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const self = new Map();
  prof.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (prof.timeDeltas[i] ?? 0)));
  const key = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.replace(/.*\/(src|node_modules|assets)\//, '$1/').replace(/\?.*/, '')}:${n.callFrame.lineNumber + 1}`;
  const incl = new Map();
  const selfF = new Map();
  for (const [id, t] of self) {
    selfF.set(key(byId.get(id)), (selfF.get(key(byId.get(id))) ?? 0) + t);
    const seen = new Set();
    for (let cur = id; cur != null; cur = parent.get(cur)) {
      const k = key(byId.get(cur));
      if (!seen.has(k)) incl.set(k, (incl.get(k) ?? 0) + t), seen.add(k);
    }
  }
  const ms = (t) => `${(t / 1000 / frames).toFixed(2).padStart(6)} ms/f`;
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, t]) => `${ms(t)}  ${k}`).join('\n');
  console.error(`perf: profile of ${seconds} s at the spawn, ${frames} frames\nINCLUSIVE\n${top(incl, 40)}\n\nSELF\n${top(selfF, 25)}\n`);
}

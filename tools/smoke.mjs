// A smoke test: run the real game in headless Chrome and fail if it throws. `npm run smoke` locally; CI runs it in the Smoke job, which the Test check waits for (#262, #284).
// Unit tests never build game.js, so a frame that throws (#260) is invisible to them. This clears the "Click to play" overlay so frames run,
// plays one farm through a few phases (weather and time changed in the page, so the game loads once), and fails on a page error, a console.error, a feature the frame guard caught (core/featureGuard.js),
// a girl or vehicle with a NaN position, a girl stood or walking more than 0.6 m off the ground, or a vehicle more than 2 m under it,
// or a spot on the farm over its frame budget (draw calls and triangles; tools/frameBudget.mjs).
// The girls and the sound are made to run, as neither happens on its own in a run this short (#764): the girls are still riding the trailer when it ends unless
// they are got down, so each is asked to choose something and it fails if she doesn't; the audio runs live and silent, not muted, with a radio on within earshot,
// and it fails if the audio context isn't running or the radio's live path didn't run.
// Then it does what a player and the girls can do (#767, tools/smokeActions.mjs): every girl action for each girl who can do it, every vehicle verb on every
// vehicle, E on every prompt that offers an action (stood beside it, held ones held), a ride on every vehicle, and every scene. Each is read from the game's own
// list, so a new one is covered with nothing added, and a throw in any of them fails the run naming it. What would end the run is left out, in one list each at
// the top of smokeActions.mjs. It also fails if a list comes back empty.
// And it measures how much of the code that reached (tools/smokeCoverage.mjs): the share of game.js, of each host file and of all of src, against a floor for each
// in that file. Chrome's coverage needs a file per module, so this needs the dev server (SMOKE_DEV=1, which CI sets); on the build it says so and skips it.
// A share under its floor fails the run and says which. To raise a floor, run the Smoke job a few times, read the shares in its summary and set it 2 points
// under the lowest. A new host file needs a line there (a test fails until it has one).
//
// It uses the built game in dist/ if there is one (?smoke exposes window.game in a build), else the dev server (SMOKE_DEV=1 forces that).
// Drawing is skipped (the GL draw calls do nothing): on software GL the first frame alone took half a minute, and drawing finds nothing the update doesn't.
//
//   npm run smoke                  SMOKE_SECONDS=10 npm run smoke   shorter phases
//   CHROME_PATH=/path/to/chrome    to use a particular Chrome (else a system Chrome is looked for)
import { existsSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { createServer, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import { MEASURE_ARGS, check, measureInPage } from './frameBudget.mjs';
import { CHROME_ARGS, chromePath, loadStepLines, recordLoadSteps, stubDraws, waitForReady } from './frameBudgetRun.mjs';
import { ACTION_WAIT_MS, GIRL_ACTIONS_LEFT_OUT, PROMPTS_LEFT_OUT, RIDE_MS, VERB_WAIT_MS, VEHICLE_VERBS_LEFT_OUT, doGirlActions, doVehicleVerbs, pressPrompts, rideEach, runEveryScene } from './smokeActions.mjs';
import { bytesByFile, checkShares, sharesOf, summaryMarkdown } from './smokeCoverage.mjs';

const SECONDS = Number(process.env.SMOKE_SECONDS || 20);
const MADE_TO_RUN_SECONDS = 120; // how long the girls have to choose and the radio to be heard, on a runner that may be slow; only a failure waits this long
// One load (about 20 s here, minutes on a CI runner), then phases: sunny at the real clock, then snow with the clock fast so the evening comes in.
const QUERY = process.env.SMOKE_QUERY ?? 'seed=3&weather=sunny&time=15.5'; // SMOKE_QUERY tries another set-up, e.g. a season
const PHASES = [
  { name: 'sunny', weather: 'sunny', clockRate: 1, seconds: SECONDS / 2 },
  { name: 'snow, fast clock into dusk', weather: 'snow', clockRate: 600, seconds: SECONDS / 2 },
];

const executablePath = chromePath();
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
  args: [...CHROME_ARGS, '--mute-audio'], // software GL, so it runs on a CI runner with no GPU; and whatever the game plays, nothing comes out
});

console.log(`smoke: ${await browser.version()}, ${cpus().length} cpus, ${Math.round(totalmem() / 1e9)} GB, node ${process.version}`);
const problems = [];
async function run() {
  const t0 = Date.now();
  const seen = new Map();
  const note = (k) => seen.set(k, (seen.get(k) || 0) + 1);
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 200 });
  page.on('pageerror', (e) => note(`page error: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' | ').trim()}`));
  page.on('console', (m) => { if (m.type() === 'error') note(`console.error: ${m.text().slice(0, 300)}`); });
  await page.evaluateOnNewDocument(stubDraws);
  await page.evaluateOnNewDocument(recordLoadSteps);
  if (!built) await page.coverage.startJSCoverage({ resetOnNavigation: false }); // what the run reaches, per file (smokeCoverage.mjs)
  await page.goto(`${base}?smoke&${QUERY}`, { waitUntil: 'load' });
  try {
    await waitForReady(page);
  } catch (err) {
    // The error says what was missing and where the load had got to, so a slow runner is told from a game that threw while starting.
    if (seen.size) console.log(`smoke: seen while loading: ${[...seen.keys()].join(' // ')}`);
    throw err;
  }
  const loaded = Date.now();
  console.log(`loading steps (seconds from the page's start):\n${(await loadStepLines(page)).join('\n')}`);
  await page.evaluate(() => {
    const o = document.getElementById('overlay');
    o.classList.add('hidden');
    o.style.display = 'none';
    // Live and silent, not `muted`: muted sends the sound's code down its quiet path, where a fault in it can't show (#764).
    game.audioHub.params.masterVolume = 0;
    game.audioHub.unlock();
  });
  // The frame's budget, from fixed spots on the farm while it is still sunny at the start (tools/frameBudget.mjs); the numbers go to a file for the job summary.
  const measured = await page.evaluate(measureInPage, MEASURE_ARGS);
  if (measured.error) note(`budget: ${measured.error}`);
  else {
    const { rows, failures, missing } = check(measured.spots);
    writeFileSync(process.env.SMOKE_BUDGET_OUT ?? 'budget-pr.json', JSON.stringify(measured.spots, null, 1));
    for (const f of failures) note(`over budget: ${f}`);
    for (const m of missing) note(`budget: ${m} not measured (${measured.notes.join(', ') || 'no reason given'})`);
    console.log(rows.map((r) => `  ${r.spot.padEnd(8)} ${String(Math.round(r.calls)).padStart(5)} calls ${(r.triangles / 1e6).toFixed(2)}M triangles${r.over.length ? (r.known ? '  over (known overrun)' : '  OVER') : ''}`).join('\n'));
  }
  // The girls choose and a radio plays, then the phases run with them getting on with it.
  const madeToRun = await page.evaluate(async (limit) => {
    const g = game;
    const you = g.camera.position;
    const set = g.radioUnits().map((u) => ({ u, d: u.quad.position.distanceTo(you) })).sort((a, b) => a.d - b.d)[0].u;
    g.console.host.vehicleVerb(set.spec.id, 'start');
    set.quad.radio.set(true);
    const at = set.quad.position;
    g.player.moveTo({ x: at.x + 3, y: g.world.groundHeightAt(at.x + 3, at.z) + 0.5, z: at.z });
    for (const c of g.companions) {
      c.mind.last = null;
      g.settleGirl(c); // down off the trailer, and stood about
      c.settled.left = 0.1; // for no time at all: settling holds her own mind off
    }
    const t0 = performance.now();
    const heard = () => g.radioAudio.chains.has(set.spec.id);
    const waiting = () => g.companions.filter((c) => !c.mind.last);
    while (performance.now() - t0 < limit * 1000 && (waiting().length || !heard())) {
      for (const c of waiting()) c.mind.thinkIn = 0;
      await new Promise((r) => setTimeout(r, 250));
    }
    return {
      seconds: Math.round((performance.now() - t0) / 1000),
      audio: g.audioHub.ctx?.state ?? 'no audio context',
      radio: heard() ? set.spec.id : null,
      girls: g.companions.map((c) => ({ name: c.name, chose: c.mind.last?.key ?? null, state: c.fsm.name, waiting: c.mind.waiting })),
    };
  }, MADE_TO_RUN_SECONDS);
  console.log(`made to run in ${madeToRun.seconds} s: audio ${madeToRun.audio}, radio ${madeToRun.radio ?? 'not heard'}, ${madeToRun.girls.map((c) => `${c.name} chose ${c.chose}`).join(', ')}`);
  if (madeToRun.audio !== 'running') note(`audio context is ${madeToRun.audio}, so the sound's code did not run`);
  if (!madeToRun.radio) note(`no radio was heard in ${MADE_TO_RUN_SECONDS} s, so the radio's live path did not run`);
  for (const c of madeToRun.girls) if (!c.chose) note(`${c.name} chose nothing in ${MADE_TO_RUN_SECONDS} s (${c.state}${c.waiting ? `, ${c.waiting}` : ''})`);
  // Then everything a player and the girls can do, each read from the game's own list (tools/smokeActions.mjs).
  const stages = [
    ['girl actions', doGirlActions, { wait: ACTION_WAIT_MS, leftOut: GIRL_ACTIONS_LEFT_OUT, vehicle: 'red' }],
    ['vehicle verbs', doVehicleVerbs, { wait: VERB_WAIT_MS, leftOut: VEHICLE_VERBS_LEFT_OUT }],
    ['prompts', pressPrompts, { wait: VERB_WAIT_MS, leftOut: PROMPTS_LEFT_OUT.map((p) => p.name) }],
    ['rides', rideEach, { ms: RIDE_MS }],
    ['scenes', runEveryScene, { wait: ACTION_WAIT_MS }],
  ];
  for (const [name, fn, arg] of stages) {
    const started = Date.now();
    const r = await page.evaluate(fn, arg);
    console.log(`${name}: ${r.ran} of ${r.listed} done in ${Math.round((Date.now() - started) / 1000)} s`);
    if (!r.listed) note(`${name}: the list came back empty, so nothing of it was tried`);
    for (const p of r.problems) note(p);
  }
  await page.evaluate(() => {
    for (const c of game.companions) {
      for (const k of [...c.holds.keys()]) c.release(k);
      game.settleGirl(c);
    }
  });
  for (const phase of PHASES) {
    await page.evaluate((ph) => {
      game.weatherHost.setKind(ph.weather);
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
  if (!built) {
    const { rows, failures } = checkShares(sharesOf(bytesByFile(await page.coverage.stopJSCoverage())));
    writeFileSync(process.env.SMOKE_COVERAGE_OUT ?? 'smoke-coverage.md', summaryMarkdown(rows));
    console.log(`what the run reached, against each floor (tools/smokeCoverage.mjs):\n${rows.map((r) => `  ${r.label.padEnd(32)} ${r.share.toFixed(1).padStart(5)}%  floor ${r.floor ?? 'none'}%`).join('\n')}`);
    for (const f of failures) note(`reach: ${f}`);
  } else console.log('reached: not measured (it needs the dev server: SMOKE_DEV=1)');
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

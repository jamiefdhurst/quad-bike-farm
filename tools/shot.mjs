// Shoots something new in the running game, the one look `.claude/rules/looks.md` asks for: four sides and one close-up of its busiest face, in daylight,
// with the "Click to play" overlay cleared (and checked to be gone) and the HUD hidden, into .scratch/shots/<name>/, plus a contact sheet.
//
//   node tools/shot.mjs --name village            a named group in the scene (its `.name`, as in world/farDetail.js)
//   node tools/shot.mjs --at yard                 a console place (`tp me <place>`, src/console/gameHost.js), or "x z" in metres
//   node tools/shot.mjs --name sparesRack --fov 18 --out spares
//
//   --name <group.name>   the first group in the scene with this name; the shots frame its bounding box
//   --at <place|x z>      shoot what stands within --radius (default 8) of the place or point
//   --radius <m>          how far round --at to look (default 8)
//   --fov <deg>           the camera's field of view (default 50); a small one crops in on lettering
//   --time <hour>         the clock (default 13); --weather <name> (default sunny); --seed <n> (default 3)
//   --out <name>          the folder under .scratch/shots/ (default: the --name, or the --at)
//   --url <address>       use a dev server that is already running (else this starts its own, from this checkout)
//   --soft                software GL (swiftshader), slow but needs no GPU; the default is the GPU, as the other scratch scripts use
//
// Look at each shot at full size, and crop the original for anything small (looks.md): the contact sheet is for finding which to open.
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { CHROME_ARGS, chromePath } from './frameBudgetRun.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const NAME = opt('name');
const AT = opt('at');
if (!NAME && !AT) {
  console.error('shot: say what to shoot with --name <group.name> or --at <place|"x z">. See the top of tools/shot.mjs.');
  process.exit(2);
}
const RADIUS = Number(opt('radius', 8));
const FOV = Number(opt('fov', 50));
const OUT = opt('out', (NAME ?? AT).replace(/[^\w.-]+/g, '_'));
const dir = resolve('.scratch', 'shots', OUT);
const query = `seed=${opt('seed', 3)}&weather=${opt('weather', 'sunny')}&time=${opt('time', 13)}`;

const executablePath = chromePath();
if (!executablePath) {
  console.error('shot: no Chrome found. Set CHROME_PATH.');
  process.exit(2);
}

let server = null;
let base = opt('url');
if (!base) {
  server = await createServer({ server: { port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  base = server.resolvedUrls.local[0];
}
const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: flag('soft') ? CHROME_ARGS : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

/** Runs in the page: where the thing is and which of its four faces holds the most. Meshes are found by name, or round the player's place. */
function findTarget({ name, radius }) {
  const real = (o) => o && typeof o.type === 'string';
  const meshes = [];
  const collect = (o) => {
    if (!real(o)) return;
    if (o.isMesh && o.geometry) meshes.push(o);
    o.children?.forEach(collect);
  };
  const scene = game.scene;
  let root = null;
  if (name) {
    const walk = (o) => {
      if (root || !real(o)) return;
      if (o.name === name) root = o;
      else o.children?.forEach(walk);
    };
    walk(scene);
    if (!root) return { error: `nothing in the scene is named "${name}"` };
    collect(root);
  } else {
    collect(scene);
  }
  const p = game.player.position;
  const boxes = [];
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    const size = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    const centre = [(b.max.x + b.min.x) / 2, (b.max.y + b.min.y) / 2, (b.max.z + b.min.z) / 2];
    if (!name) {
      // Round a place: leave out the ground and the sky's big pieces, and anything beyond the radius.
      if (Math.max(...size) > 40) continue;
      if (Math.hypot(centre[0] - p.x, centre[2] - p.z) > radius) continue;
    }
    const g = m.geometry;
    const tris = (g.index ? g.index.count : g.attributes.position.count) / 3;
    boxes.push({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], centre, tris: tris * (m.isInstancedMesh ? m.count : 1) });
  }
  if (!boxes.length) return { error: name ? `"${name}" has no meshes` : `nothing is within ${radius} m of the player` };
  const min = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i])));
  const max = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i])));
  const centre = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  const extent = [0, 1, 2].map((i) => max[i] - min[i]);
  // The busiest face: the side (+x, -x, +z, -z) whose outer quarter holds the most triangles.
  const faces = [
    { side: '+x', axis: 0, dir: 1 },
    { side: '-x', axis: 0, dir: -1 },
    { side: '+z', axis: 2, dir: 1 },
    { side: '-z', axis: 2, dir: -1 },
  ].map((f) => {
    const cut = f.dir > 0 ? max[f.axis] - extent[f.axis] / 4 : min[f.axis] + extent[f.axis] / 4;
    const near = boxes.filter((b) => (f.dir > 0 ? b.centre[f.axis] >= cut : b.centre[f.axis] <= cut));
    const tris = near.reduce((s, b) => s + b.tris, 0);
    const weight = near.reduce((s, b) => s + Math.max(b.tris, 1), 0) || 1;
    const focus = [0, 1, 2].map((i) => near.reduce((s, b) => s + b.centre[i] * Math.max(b.tris, 1), 0) / weight);
    return { ...f, tris, focus };
  });
  faces.sort((a, b) => b.tris - a.tris);
  return { centre, extent, min, max, busiest: faces[0] };
}

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 700 });
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  await page.evaluateOnNewDocument(() => {
    speechSynthesis.speak = () => {};
    localStorage.clear();
  });
  await page.goto(`${base}?smoke&${query}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game?.companions && document.getElementById('overlay-status')?.textContent === 'Ready', { timeout: 180000, polling: 250 });

  // Click through the overlay, then check it really went (it kept staying up in old screenshots), and hide the HUD.
  await page.click('#overlay').catch(() => {});
  await wait(1);
  const overlayUp = await page.evaluate(() => {
    const o = document.getElementById('overlay');
    return !!o && !o.classList.contains('hidden') && getComputedStyle(o).display !== 'none' && getComputedStyle(o).visibility !== 'hidden';
  });
  if (overlayUp) throw new Error('the "Click to play" overlay is still up after clicking it, so the shots would show it');
  await page.addStyleTag({ content: '#hud { display: none !important; }' });
  await page.evaluate(() => {
    game.audioHub.unlock?.();
    game.audioHub.params.muted = true;
    for (const c of game.companions) c.params.ownMind = false;
    game.debugCamera = true; // the player's own camera stops following, so ours stays where it is put
  });

  if (AT) {
    const numbers = AT.trim().split(/[\s,]+/).map(Number);
    const line = numbers.length === 2 && numbers.every(Number.isFinite) ? `tp me ${numbers[0]} ${numbers[1]}` : `tp me ${AT}`;
    const said = await page.evaluate((l) => game.console.shell.run(l), line);
    if (said && said.ok === false) throw new Error(`"${line}" failed: ${said.text ?? JSON.stringify(said)}`);
    await wait(2); // the ground and the set pieces round the new spot draw in
  }
  const t = await page.evaluate(findTarget, { name: NAME, radius: RADIUS });
  if (t.error) throw new Error(t.error);

  mkdirSync(dir, { recursive: true });
  const shots = [];
  const take = async (label, position, look, fov = FOV) => {
    await page.evaluate(
      (pos, at, f) => {
        game.camera.fov = f;
        game.camera.updateProjectionMatrix();
        game.camera.position.set(pos[0], pos[1], pos[2]);
        game.camera.lookAt(at[0], at[1], at[2]);
      },
      position,
      look,
      fov,
    );
    await wait(1);
    const file = join(dir, `${label}.png`);
    await page.screenshot({ path: file });
    shots.push({ label, file });
  };

  // Four sides: back off far enough that the whole thing fits the view, from a little above its middle.
  const [cx, cy, cz] = t.centre;
  const reach = Math.max(t.extent[0], t.extent[2], t.extent[1] * 1.5); // the width the view must hold; a tall thing is judged by its height
  const back = Math.max(3, (reach / 2 / Math.tan((FOV / 2) * (Math.PI / 180))) * 0.85 + Math.max(t.extent[0], t.extent[2]) / 2);
  const height = Math.min(cy + t.extent[1] * 0.25 + 0.6, t.max[1] + 2);
  for (const [label, dx, dz] of [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]]) await take(label, [cx + dx * back, height, cz + dz * back], [cx, cy, cz]);

  // The close-up: in front of the busiest face, near the middle of what is on it.
  const f = t.busiest;
  const faceWidth = f.axis === 0 ? t.extent[2] : t.extent[0];
  const close = Math.max(1.5, Math.min(faceWidth * 0.5, 6));
  const eye = [f.focus[0] + (f.axis === 0 ? f.dir * close : 0), f.focus[1] + 0.3, f.focus[2] + (f.axis === 2 ? f.dir * close : 0)];
  await take(`closeup-${f.side}`, eye, f.focus);

  // The contact sheet: every shot in a grid, to find which to open at full size.
  const sheet = await browser.newPage();
  await sheet.setViewport({ width: 1500, height: 900 });
  const cell = (s) => `<figure><img src="data:image/png;base64,${readFileSync(s.file).toString('base64')}"><figcaption>${s.label}</figcaption></figure>`;
  await sheet.setContent(
    `<style>body{margin:0;background:#222;color:#eee;font:14px sans-serif;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px}figure{margin:0}img{width:100%;display:block}figcaption{padding:2px 4px}</style>${shots.map(cell).join('')}`,
  );
  const contact = join(dir, 'contact-sheet.png');
  await sheet.screenshot({ path: contact, fullPage: true });

  console.log(`shot: ${shots.length} shots and a contact sheet in ${dir}`);
  for (const s of shots) console.log(`  ${s.file}`);
  console.log(`  ${contact}`);
  if (problems.length) console.log(`page errors seen:\n  ${problems.join('\n  ')}`);
} finally {
  await browser.close();
  await server?.close();
}
process.exit(0);

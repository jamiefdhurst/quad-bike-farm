// Shoots both girls' busts to judge a change to them (#1143): each girl standing in the yard as in the game, held still, from the front, three-quarter,
// side and below, beside the same shots of the shape before. It also counts the triangles on her chest that face into her (src/npc/facing.js), on her
// body and on each garment she has on, before and after. Writes .scratch/shots/<out>/<girl>-<view>-{before,after}.png and a sheet per girl,
// <girl>.png, before on the left and after on the right.
//
//   node tools/bustReview.mjs                       bare, this checkout against origin/main
//   node tools/bustReview.mjs --query body=flat     add to this checkout's address (a flag being tried)
//   node tools/bustReview.mjs --before body=flat    the shape before from this checkout with this address instead of origin/main
//   node tools/bustReview.mjs --dress               in their clothes (as dealt), not bare; --run "<line;line>" console lines first
//   node tools/bustReview.mjs --look 16             dressed in the wardrobe scene's look 16 (src/debug/wardrobe.js: each outfit, then each layer
//                                                   over it; 1 the polo, 11 the plaid, 26 a shirt and tie, 41 the crop-top; +1 a jumper, +2 a wax jacket)
//   node tools/bustReview.mjs --look 1 --open amy:0,jess:3   and her polo's buttons undone, as many as given
//   node tools/bustReview.mjs --out bust-b          the folder under .scratch/shots/ (default bust-review)
//   --views front,three,side,below   --girls amy,jess   --soft (software GL, slow; the default is the GPU)
//
// Open the sheets at full size. The counts print at the end: 0 on her body and on every garment is the aim.
import { mkdirSync, readFileSync, writeFileSync, existsSync, symlinkSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { CHROME_ARGS, chromePath, waitForReady } from './frameBudgetRun.mjs';
import { bodyFacingIn, clothFacingIn } from '../src/npc/facing.js';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const flag = (name) => args.includes(`--${name}`);
const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(here, '.scratch', 'shots', opt('out', 'bust-review'));
const QUERY = opt('query', '');
const BEFORE = opt('before', 'main');
const DRESS = flag('dress') || !!opt('look');
const RUN = opt('run', '');
const LOOK = opt('look') ? Number(opt('look')) : null;
const OPEN = Object.fromEntries((opt('open') ?? '').split(',').filter(Boolean).map((p) => p.split(':')).map(([id, n]) => [id, Number(n)]));
const VIEWS = opt('views', 'front,three,side,below').split(',');
const GIRLS = opt('girls', 'amy,jess').split(',');
mkdirSync(OUT, { recursive: true });

const executablePath = chromePath();
if (!executablePath) {
  console.error('bustReview: no Chrome found. Set CHROME_PATH.');
  process.exit(2);
}
const git = (...a) => execFileSync('git', a, { cwd: here, encoding: 'utf8' }).trim();

// The shape before: origin/main in a throwaway worktree beside this checkout (never the main checkout, which other sessions edit), or this checkout.
let throwaway = null;
let beforeRoot = here;
if (BEFORE === 'main') {
  git('fetch', '-q', 'origin', 'main');
  throwaway = resolve(here, '..', `${here.split('/').pop()}-bust-main`);
  if (existsSync(throwaway)) git('worktree', 'remove', '--force', throwaway);
  git('worktree', 'add', '-q', '--detach', throwaway, 'origin/main');
  symlinkSync(resolve(here, 'node_modules'), resolve(throwaway, 'node_modules'));
  beforeRoot = throwaway;
}

const VIEW = { width: 900, height: 900 };
// Each view: the angle round her from her front, how far off, and how far above or below her chest the camera is (metres).
const ANGLES = { front: [0, 0.62, 0.04], three: [Math.PI / 4, 0.62, 0.04], side: [Math.PI / 2, 0.6, 0.0], below: [Math.PI / 6, 0.5, -0.32] };
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));

/** Runs in the page: both girls held standing side by side in the yard, bare or dressed, everything else near them hidden, the game paused. */
function standGirls({ bare, run, look, open }) {
  const g = game;
  for (const line of run.split(';').map((l) => l.trim()).filter(Boolean)) g.console.shell.run(line);
  const me = g.world.layout.yard;
  // Settled first (settling dresses her as the day dealt), then the look put on.
  for (const c of g.companions) g.settleGirl(c);
  if (look) {
    g.sceneCounters = { ...g.sceneCounters, wardrobe: look - 1 };
    g.console.shell.run('scene wardrobe');
  }
  for (const c of g.companions) if (open[c.character.id] !== undefined) c.setPoloOpen(open[c.character.id]);
  g.companions.forEach((c, i) => {
    c.params.ownMind = false;
    // Plain standing, as she is between her idles: none of them (hands clasped, an arm up to shade her eyes from the sun) and no
    // fidgets, so every run shows the same pose.
    c.character = { ...c.character, idles: [] };
    c.updateWaiting = () => {};
    c.standingIdles = null;
    c.fidget = null;
    c.fidgetTimer = 1e9;
    const x = me.x + (i === 0 ? -3 : 3);
    const z = me.z + 4;
    c.root.position.set(x, g.world.heightAt(x, z), z);
    c.heading = 0;
    c.root.rotation.y = 0;
    c.hold('scene', 'bust review');
  });
  g.audioHub.params.muted = true;
  window.__bare = bare;
}

/** Runs in the page: both girls back where standGirls put them (the wardrobe scene stands them elsewhere). */
function standAgain() {
  const g = game;
  const me = g.world.layout.yard;
  g.companions.forEach((c, i) => {
    const x = me.x + (i === 0 ? -3 : 3);
    const z = me.z + 4;
    c.root.position.set(x, g.world.heightAt(x, z), z);
    c.heading = 0;
    c.root.rotation.y = 0;
  });
}

/** Runs in the page once she has stood a while: hides what's near the girls (never the ground), and her clothes if bare, then pauses. */
function freeze() {
  const g = game;
  const roots = new Set(g.companions.map((c) => c.root));
  for (const o of g.scene.children) {
    if (roots.has(o) || !o.visible) continue;
    let near = false;
    let big = false;
    o.updateMatrixWorld(true);
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.geometry.computeBoundingSphere?.();
      const s = m.geometry.boundingSphere;
      if (!s) return;
      if (s.radius * m.matrixWorld.getMaxScaleOnAxis() > 40) big = true;
      const c = s.center.clone().applyMatrix4(m.matrixWorld);
      for (const girl of g.companions) if (c.distanceTo(girl.root.position) < 6) near = true;
    });
    if (near && !big) o.visible = false;
  }
  if (window.__bare) {
    for (const c of g.companions) {
      let body = null;
      c.rig.model.traverse((m) => {
        if (m.isSkinnedMesh && !body) body = m;
      });
      c.root.traverse((m) => {
        if (m.isMesh && m !== body) m.visible = false;
      });
    }
  }
  // The overlay up but see-through pauses the game and still draws, so she doesn't move between shots.
  const o = document.getElementById('overlay');
  o.classList.remove('hidden');
  o.style.opacity = '0';
  o.style.pointerEvents = 'none';
}

/** Runs in the page: the camera on one girl's chest from one view, the other girl hidden. */
function aim({ i, ang, dist, up }) {
  const g = game;
  const c = g.companions[i];
  g.companions.forEach((o, k) => (o.root.visible = k === i));
  let body = null;
  c.rig.model.traverse((m) => {
    if (m.isSkinnedMesh && !body) body = m;
  });
  c.root.updateMatrixWorld(true);
  const V = g.camera.position.constructor;
  const bone = (n) => new V().setFromMatrixPosition(body.skeleton.bones.find((b) => b.name === n).matrixWorld);
  const left = bone('LeftArm').sub(bone('RightArm'));
  left.y = 0;
  left.normalize();
  const fwd = new V().crossVectors(left, new V(0, 1, 0));
  const base = Math.atan2(fwd.x, fwd.z);
  const neck = bone('Neck');
  const hips = bone('Hips');
  const chest = hips.y + (neck.y - hips.y) * 0.68;
  const cx = (neck.x + hips.x) / 2;
  const cz = (neck.z + hips.z) / 2;
  g.debugCamera = true;
  g.camera.position.set(cx + Math.sin(base + ang) * dist, chest + up, cz + Math.cos(base + ang) * dist);
  g.camera.lookAt(cx + fwd.x * 0.06, chest - 0.03, cz + fwd.z * 0.06);
}

/** Runs in the page: each girl's body and garments as triangles (three corners each) in her body frame, in her bind pose, for the facing count. */
function chestTriangles() {
  return game.companions.map((c) => {
    let body = null;
    c.rig.model.traverse((m) => {
      if (m.isSkinnedMesh && !body) body = m;
    });
    const sk = body.skeleton;
    const V = game.camera.position.constructor;
    const bind = (n) => new V().setFromMatrixPosition(sk.boneInverses[sk.bones.findIndex((b) => b.name === n)].clone().invert());
    const hips = bind('Hips');
    const neck = bind('Neck');
    const unit = neck.distanceTo(hips);
    const up = neck.clone().sub(hips).normalize();
    const left = bind('LeftArm').sub(bind('RightArm'));
    left.addScaledVector(up, -left.dot(up)).normalize();
    const front = new V().crossVectors(left, up);
    const flat = (mesh) => {
      const g = mesh.geometry;
      const pos = g.attributes.position;
      const idx = g.index ? g.index.array : Array.from({ length: pos.count }, (_, k) => k);
      const out = [];
      const q = new V();
      for (const k of idx) {
        // Her garments are skinned shells made in her bind pose, so they share her body's bind space.
        q.fromBufferAttribute(pos, k).sub(hips);
        out.push(+(q.dot(left) / unit).toFixed(5), +(q.dot(up) / unit).toFixed(5), +(q.dot(front) / unit).toFixed(5));
      }
      return out;
    };
    const garments = [];
    c.root.traverse((m) => {
      if (m.isSkinnedMesh && m !== body && m.visible !== false && m.geometry.attributes.position) garments.push({ name: m.name || m.parent?.name || 'garment', tris: flat(m) });
    });
    return { id: c.name.toLowerCase(), body: flat(body), garments };
  });
}

async function shoot(root, query, side, browser) {
  const server = await createServer({ root, configFile: resolve(root, 'vite.config.js'), server: { port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  const base = server.resolvedUrls.local[0];
  const page = await browser.newPage();
  await page.setViewport(VIEW);
  page.on('pageerror', (e) => console.error(`bustReview (${side}): page error: ${e.message}`));
  await page.evaluateOnNewDocument(() => {
    speechSynthesis.speak = () => {};
  });
  const q = `seed=3&weather=sunny&time=13${query ? `&${query}` : ''}`;
  await page.goto(`${base}?${q}`, { waitUntil: 'load' });
  await waitForReady(page);
  await page.click('#overlay').catch(() => {});
  await wait(1);
  await page.addStyleTag({ content: '#hud { display: none !important; }' });
  await page.evaluate(standGirls, { bare: !DRESS, run: RUN, look: LOOK, open: OPEN });
  await wait(6);
  // The look again, now they have stood a while (getting down off something, a girl is dressed as the day dealt).
  const wearing = await page.evaluate(
    ({ look, open }) => {
      const g = game;
      if (look) {
        g.sceneCounters = { ...g.sceneCounters, wardrobe: look - 1 };
        g.console.shell.run('scene wardrobe');
      }
      for (const c of g.companions) if (open[c.character.id] !== undefined) c.setPoloOpen(open[c.character.id]);
      return g.companions.map((c) => `${c.name} in ${c.outfit.style?.kind}${c.outfit.poloOpen ? `, ${c.outfit.poloOpen} undone` : ''}`).join('; ');
    },
    { look: LOOK, open: OPEN },
  );
  console.error(`bustReview (${side}): ${wearing}`);
  await wait(2);
  await page.evaluate(standAgain);
  await wait(0.5);
  await page.evaluate(freeze);
  await wait(0.5);
  const ids = await page.evaluate(() => game.companions.map((c) => c.name.toLowerCase()));
  for (const [i, id] of ids.entries()) {
    if (!GIRLS.includes(id)) continue;
    for (const view of VIEWS) {
      const [ang, dist, up] = ANGLES[view];
      await page.evaluate(aim, { i, ang, dist, up });
      await wait(0.4);
      await page.evaluate(aim, { i, ang, dist, up });
      await wait(0.15);
      await page.screenshot({ path: resolve(OUT, `${id}-${view}-${side}.png`) });
    }
  }
  const tris = await page.evaluate(chestTriangles);
  await page.close();
  await server.close();
  return tris.map((t, i) => ({ ...t, id: ids[i] }));
}

const TRIM = /Buttons?|Placket|Logo|Pocket|Stitch|Tie(Knot)?$/i;

/** The facing counts for one side: her body, and each garment against her body. */
function counts(girls) {
  return girls.map(({ id, body, garments }) => ({
    id,
    body: bodyFacingIn(body).length,
    // Trim laid on the cloth has a back facing her by design: only the cloth is checked.
    garments: garments.filter((g) => !TRIM.test(g.name)).map((g) => [g.name, clothFacingIn(g.tris, body).length]),
  }));
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: flag('soft') ? CHROME_ARGS : ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
let report = [];
try {
  const before = await shoot(beforeRoot, BEFORE === 'main' ? '' : BEFORE, 'before', browser);
  const after = await shoot(here, QUERY, 'after', browser);
  const b = counts(before);
  const a = counts(after);
  report = a.map((x, i) => ({ id: x.id, before: b[i], after: x }));
  // A sheet per girl: before | after, a row a view.
  for (const id of GIRLS) {
    const img = (view, side) => `data:image/png;base64,${readFileSync(resolve(OUT, `${id}-${view}-${side}.png`)).toString('base64')}`;
    const rows = VIEWS.map((v) => `<tr><th>${v}</th><td><img src="${img(v, 'before')}"></td><td><img src="${img(v, 'after')}"></td></tr>`).join('');
    const html = `<html><body style="margin:0;background:#222;color:#eee;font:16px sans-serif"><table cellspacing="4"><tr><th></th><th>before (${BEFORE})</th><th>after${QUERY ? ` (${QUERY})` : ''}</th></tr>${rows}</table>
      <style>img{width:440px;height:440px;display:block}th{padding:4px}</style></body></html>`;
    const page = await browser.newPage();
    await page.setViewport({ width: 960, height: 120 + VIEWS.length * 450 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: resolve(OUT, `${id}.png`), fullPage: true });
    await page.close();
  }
} finally {
  await browser.close();
  if (throwaway) {
    git('worktree', 'remove', '--force', throwaway);
    rmSync(throwaway, { recursive: true, force: true });
  }
}
writeFileSync(resolve(OUT, 'facing.json'), JSON.stringify(report, null, 1));
for (const r of report) {
  const line = (c) => `body ${c.body}${c.garments.length ? `, ${c.garments.map(([n, k]) => `${n} ${k}`).join(', ')}` : ''}`;
  console.log(`${r.id}: facing into her, before: ${line(r.before)}; after: ${line(r.after)}`);
}
console.log(`sheets: ${GIRLS.map((id) => resolve(OUT, `${id}.png`)).join(' ')}`);
process.exit(0);

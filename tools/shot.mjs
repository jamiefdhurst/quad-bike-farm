// Shoots something new in the running game, the one look `.claude/rules/looks.md` asks for: four sides and one close-up of its main face (the largest side), in daylight,
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
//   --keep                keep what stands between the camera and the target (else it is hidden for that shot and put back, and the tool says what)
//   --soft                software GL (swiftshader), slow but needs no GPU; the default is the GPU, as the other scratch scripts use
//
// Before each shot, any mesh that is not part of the target and whose bounding box crosses the line from the camera to the target is hidden (the ground
// and the sky are never), so a wall or a hay bale in front does not fill the frame. It is put back after the shot, and the tool prints what it hid.
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
const VIEW = { width: 1100, height: 700 };
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
  window.__shotTarget = new Set();
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
    window.__shotTarget.add(m);
    boxes.push({ min: [b.min.x, b.min.y, b.min.z], max: [b.max.x, b.max.y, b.max.z], centre, tris: tris * (m.isInstancedMesh ? m.count : 1) });
  }
  if (!boxes.length) return { error: name ? `"${name}" has no meshes` : `nothing is within ${radius} m of the player` };
  const min = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i])));
  const max = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i])));
  const centre = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  const extent = [0, 1, 2].map((i) => max[i] - min[i]);
  // The main face: the side (+x, -x, +z, -z) with the largest area as the bounding box shows it (its width by the height). Sides within a tenth of
  // the largest area count as the same, and the triangles in the outer quarter choose between those (a flat thing's front and back, say).
  const faces = [
    { side: '+x', axis: 0, dir: 1 },
    { side: '-x', axis: 0, dir: -1 },
    { side: '+z', axis: 2, dir: 1 },
    { side: '-z', axis: 2, dir: -1 },
  ].map((f) => {
    const cut = f.dir > 0 ? max[f.axis] - extent[f.axis] / 4 : min[f.axis] + extent[f.axis] / 4;
    const tris = boxes.filter((b) => (f.dir > 0 ? b.centre[f.axis] >= cut : b.centre[f.axis] <= cut)).reduce((s, b) => s + b.tris, 0);
    const width = f.axis === 0 ? extent[2] : extent[0];
    return { ...f, tris, width, height: extent[1], depth: extent[f.axis], area: width * extent[1] };
  });
  const largest = Math.max(...faces.map((f) => f.area));
  faces.sort((a, b) => (a.area >= largest * 0.9 && b.area >= largest * 0.9 ? b.tris - a.tris : b.area - a.area));
  window.__shotBox = { min, max };
  return { centre, extent, min, max, main: faces[0] };
}

/**
 * Runs in the page: hides every visible mesh that is not part of the target (findTarget's set) and whose bounding box a line from `from` to the
 * target crosses: the lines go to its middle and to 26 points over its box (pulled in a tenth, so a wall it hangs on is not caught by its face),
 * which catches a bale across the bottom of the frame as well as one in the middle. The terrain, anything that spans more than 100 m (the sky,
 * the water) and anything under 0.3 m high (floors, roads, kerbs) stay. Returns what it hid, as labels with counts; `restoreHidden` puts it back.
 */
function hideInTheWay({ from, to }) {
  const real = (o) => o && typeof o.type === 'string';
  const target = window.__shotTarget ?? new Set();
  const hidden = (window.__shotHidden = []);
  const box = window.__shotBox;
  const points = [to];
  if (box) {
    const mid = [0, 1, 2].map((i) => (box.min[i] + box.max[i]) / 2);
    const at = (i, k) => mid[i] + ((box.max[i] - box.min[i]) / 2) * 0.9 * k;
    for (const kx of [-1, 0, 1]) for (const ky of [-1, 0, 1]) for (const kz of [-1, 0, 1]) points.push([at(0, kx), at(1, ky), at(2, kz)]);
  }
  const crossesLine = (min, max, end) => {
    const d = [end[0] - from[0], end[1] - from[1], end[2] - from[2]];
    // The slab test of the segment (t from 0 to 1) against the box.
    let t0 = 0;
    let t1 = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (from[i] < min[i] || from[i] > max[i]) return false;
      } else {
        const a = (min[i] - from[i]) / d[i];
        const b = (max[i] - from[i]) / d[i];
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
        if (t0 > t1) return false;
      }
    }
    return true;
  };
  const crosses = (min, max) => points.some((end) => crossesLine(min, max, end));
  const label = (m) => {
    let o = m;
    while (o && !o.name) o = o.parent;
    return `${o?.name || 'unnamed'} (${m.isInstancedMesh ? 'instanced ' : ''}${m.geometry.type})`;
  };
  const candidates = []; // every visible mesh with its world box, the target's included: the second pass looks at what a ray meets first
  const walk = (o) => {
    if (!real(o) || !o.visible) return;
    if (o.isMesh && o.geometry && o.name !== 'terrain') {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.every((x) => x && x.visible === false)) {
        o.updateWorldMatrix(true, false);
        let local;
        if (o.isInstancedMesh) {
          o.computeBoundingBox();
          local = o.boundingBox;
        } else {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          local = o.geometry.boundingBox;
        }
        if (local) {
          const b = local.clone().applyMatrix4(o.matrixWorld).expandByScalar(0.02); // a flat panel has no thickness for a line to cross
          const min = [b.min.x, b.min.y, b.min.z];
          const max = [b.max.x, b.max.y, b.max.z];
          const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
          if (span <= 100 && max[1] - min[1] >= 0.3) {
            candidates.push({ mesh: o, min, max });
            if (!target.has(o) && crosses(min, max)) {
              o.visible = false;
              hidden.push({ mesh: o, label: label(o) });
            }
          }
        }
      }
    }
    o.children?.forEach(walk);
  };
  walk(game.scene);
  // Then what still gets in the way of the target itself: along each line, the first thing met that is not the target (a thing that hangs across
  // one edge of the frame and so crosses no line to the middle) is hidden, and the line looked along again, a few times over.
  const ray = game.interaction.raycaster;
  const eye = game.camera.position.clone();
  const gone = new Set(hidden.map((h) => h.mesh));
  for (const end of points) {
    const dir = eye.clone().set(end[0] - from[0], end[1] - from[1], end[2] - from[2]);
    const dist = dir.length();
    dir.normalize();
    ray.set(eye, dir);
    ray.far = dist - 0.05;
    const near = candidates.filter((c) => crossesLine(c.min, c.max, end));
    for (let n = 0; n < 12; n++) {
      let first = null;
      for (const c of near) {
        if (gone.has(c.mesh)) continue;
        let hit = [];
        try {
          hit = ray.intersectObject(c.mesh, false);
        } catch {
          continue; // a mesh three cannot cast a ray at (a stand-in, an unusual geometry) is left alone
        }
        if (hit.length && (!first || hit[0].distance < first.distance)) first = { distance: hit[0].distance, mesh: c.mesh };
      }
      if (!first || target.has(first.mesh)) break;
      first.mesh.visible = false;
      gone.add(first.mesh);
      hidden.push({ mesh: first.mesh, label: label(first.mesh) });
    }
  }
  const counts = {};
  for (const h of hidden) counts[h.label] = (counts[h.label] ?? 0) + 1;
  return Object.entries(counts).map(([k, n]) => (n > 1 ? `${k} x${n}` : k));
}

/** Runs in the page: puts back whatever hideInTheWay hid. */
function restoreHidden() {
  for (const h of window.__shotHidden ?? []) h.mesh.visible = true;
  window.__shotHidden = [];
}

try {
  const page = await browser.newPage();
  await page.setViewport(VIEW);
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
    const hid = flag('keep') ? [] : await page.evaluate(hideInTheWay, { from: position, to: look });
    await wait(1);
    const file = join(dir, `${label}.png`);
    await page.screenshot({ path: file });
    await page.evaluate(restoreHidden);
    shots.push({ label, file, hid });
  };

  // Four sides: back off far enough that the whole thing fits the view, from a little above its middle.
  const [cx, cy, cz] = t.centre;
  const reach = Math.max(t.extent[0], t.extent[2], t.extent[1] * 1.5); // the width the view must hold; a tall thing is judged by its height
  const back = Math.max(3, (reach / 2 / Math.tan((FOV / 2) * (Math.PI / 180))) * 0.85 + Math.max(t.extent[0], t.extent[2]) / 2);
  const height = Math.min(cy + t.extent[1] * 0.25 + 0.6, t.max[1] + 2);
  for (const [label, dx, dz] of [['north', 0, -1], ['east', 1, 0], ['south', 0, 1], ['west', -1, 0]]) await take(label, [cx + dx * back, height, cz + dz * back], [cx, cy, cz]);

  // The close-up: square on to the main face, level with the middle of it, as far back as it takes for the whole face to fill the frame with a
  // margin (the view is FOV tall and as wide as the page), however big or small the thing is. hideInTheWay clears what stands in front, as above.
  const f = t.main;
  const tanHalf = Math.tan((FOV / 2) * (Math.PI / 180));
  const fit = Math.max(f.height / 2 / tanHalf, f.width / 2 / (tanHalf * (VIEW.width / VIEW.height))) * 1.15;
  const away = f.depth / 2 + fit;
  const eye = [cx + (f.axis === 0 ? f.dir * away : 0), cy, cz + (f.axis === 2 ? f.dir * away : 0)];
  await take(`closeup-${f.side}`, eye, [cx, cy, cz]);

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
  for (const s of shots) {
    console.log(`  ${s.file}`);
    console.log(`    hid ${s.hid.length ? s.hid.join(', ') : 'nothing'}`);
  }
  console.log(`  ${contact}`);
  if (problems.length) console.log(`page errors seen:\n  ${problems.join('\n  ')}`);
} finally {
  await browser.close();
  await server?.close();
}
process.exit(0);

import * as THREE from 'three';

// What years in the barn have done to the rusty quad (TODO 97), on top of its donor's finished body (rustyLook.js tints every material):
// rust patches with pits eaten through them and cracks across the plastics, set on whatever surface is there (found by ray, so any donor
// takes them), cobwebs in the corners, cracked pale tyres, a mouse nest in the open intake of the one donor that shows it (the yellow), and the tarp
// that is dragged off. The rack bars that have rusted away or hang broken are made with the model (`decay` in buildQuadModel, from
// `planDamage`). Each bench job then shows on the quad: the tyre job gives it fresh black rubber without its cracks, the carb job clears
// the nest. Procedural, no assets; the drawing uses a seeded random so a farm's rusty quad is always the same one.

/** The donors with racks (rack bars to lose) and the one whose open engine bay shows an intake to nest in. */
const RACKED = ['red', 'blue', 'green'];
const OPEN_ENGINE = ['yellow']; // (the orange's shroud hides its engine)

export const DEFAULT_RUSTY_DAMAGE = {
  patches: [16, 22], // rust patches over the paint and metal
  cracks: [7, 11], // cracks across the plastics
  webs: [6, 9], // cobwebs
};

export const RUSTY_DAMAGE_RANGES = {
  patches: [0, 40, 1],
  cracks: [0, 20, 1],
  webs: [0, 20, 1],
};

const between = (random, [a, b]) => a + Math.floor(random() * (b - a + 1));

/**
 * The seeded plan for a donor: which rack slats are gone or hanging (red, blue and green have racks), how many patches, cracks and
 * webs, and whether the intake has a nest in it. Pure.
 */
export function planDamage(random, donorId, P = DEFAULT_RUSTY_DAMAGE) {
  const racked = RACKED.includes(donorId);
  const slats = { red: { front: 5, rear: 3 }, blue: { front: 6, rear: 4 }, green: { front: 6, rear: 4 } }[donorId];
  const rack = racked
    ? {
        front: { skip: [1 + Math.floor(random() * (slats.front - 1))], hang: null },
        rear: { skip: [], hang: 1 + Math.floor(random() * (slats.rear - 1)) },
      }
    : null;
  if (rack) {
    // The front rack loses one slat and has another hanging, if it can spare two.
    const spare = [...Array(slats.front - 1).keys()].map((i) => i + 1).filter((i) => !rack.front.skip.includes(i));
    rack.front.hang = spare[Math.floor(random() * spare.length)] ?? null;
  }
  return {
    donor: donorId,
    rack,
    patches: between(random, P.patches),
    cracks: between(random, P.cracks),
    webs: between(random, P.webs),
    nest: OPEN_ENGINE.includes(donorId),
    seed: Math.floor(random() * 1e9),
  };
}

// Drawing --------------------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A rust patch: overlapping blotches of orange and brown, dark pits where it has eaten through, a ragged edge. */
function rustTexture(seed) {
  const r = rng(seed);
  return canvasTexture(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    const blot = (cx, cy, rad, col, alpha) => {
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grad.addColorStop(0, `rgba(${col},${alpha})`);
      grad.addColorStop(0.65, `rgba(${col},${alpha * 0.7})`);
      grad.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, rad, 0, Math.PI * 2);
      g.fill();
    };
    for (let i = 0; i < 9; i++) blot(S / 2 + (r() - 0.5) * S * 0.5, S / 2 + (r() - 0.5) * S * 0.5, S * (0.12 + r() * 0.18), '104,52,26', 0.8);
    for (let i = 0; i < 7; i++) blot(S / 2 + (r() - 0.5) * S * 0.45, S / 2 + (r() - 0.5) * S * 0.45, S * (0.05 + r() * 0.09), '120,64,30', 0.45);
    for (let i = 0; i < 5; i++) blot(S / 2 + (r() - 0.5) * S * 0.4, S / 2 + (r() - 0.5) * S * 0.4, S * (0.02 + r() * 0.04), '38,22,12', 0.95); // pits
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(${r() < 0.6 ? '78,40,20' : '150,86,40'},${0.3 + r() * 0.4})`;
      g.fillRect(S / 2 + (r() - 0.5) * S * 0.8, S / 2 + (r() - 0.5) * S * 0.8, 2 + r() * 6, 2 + r() * 6);
    }
  });
}

/** A crack: a jagged dark line with a pale edge and a few forks, running corner to corner. */
function crackTexture(seed) {
  const r = rng(seed);
  return canvasTexture(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    const line = (x, y, ang, len, width, depth) => {
      g.beginPath();
      g.moveTo(x, y);
      const pts = [[x, y]];
      for (let i = 0; i < 14; i++) {
        ang += (r() - 0.5) * 0.9;
        x += Math.cos(ang) * (len / 14);
        y += Math.sin(ang) * (len / 14);
        pts.push([x, y]);
        g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(214,208,196,0.55)';
      g.lineWidth = width + 2.5;
      g.stroke();
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.strokeStyle = 'rgba(16,12,9,0.95)';
      g.lineWidth = width;
      g.stroke();
      if (depth > 0) for (let k = 0; k < 2; k++) {
        const p = pts[3 + Math.floor(r() * 8)];
        line(p[0], p[1], ang + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.6), len * 0.35, width * 0.7, depth - 1);
      }
    };
    line(S * 0.08, S * (0.3 + r() * 0.4), (r() - 0.5) * 0.6, S * 0.85, 3.5, 1);
  });
}

/** A cobweb hanging from one point: spokes fanning down from the top middle, sagging rings between them, grey-white and mostly see-through. */
function webTexture(seed) {
  const r = rng(seed);
  return canvasTexture(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.strokeStyle = 'rgba(238,238,228,0.95)';
    g.lineWidth = 2.2;
    const spokes = 6 + Math.floor(r() * 3);
    const spread = 1.1; // radians either side of straight down
    const tip = (i, len) => {
      const a = Math.PI / 2 + (i / (spokes - 1) - 0.5) * 2 * spread;
      return [S / 2 + Math.cos(a) * len, Math.sin(a) * len];
    };
    for (let i = 0; i < spokes; i++) {
      const [x, y] = tip(i, S * (0.9 + r() * 0.08));
      g.beginPath();
      g.moveTo(S / 2, 0);
      g.lineTo(x, y);
      g.stroke();
    }
    for (let ring = 1; ring <= 6; ring++) {
      const len = S * 0.15 * ring * (0.9 + r() * 0.2);
      g.beginPath();
      for (let i = 0; i < spokes; i++) {
        const [x, y] = tip(i, len);
        if (i) {
          const [px, py] = tip(i - 0.5, len * 0.88); // the thread sags towards the top between spokes
          g.quadraticCurveTo(px, py, x, y);
        } else g.moveTo(x, y);
      }
      g.stroke();
    }
  });
}

/** A split in the seat's cover: a jagged dark slit with the pale foam showing in it and a frayed edge. */
function ripTexture(seed) {
  const r = rng(seed);
  return canvasTexture(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    const n = 14;
    const top = [];
    const bottom = [];
    for (let i = 0; i <= n; i++) {
      const x = S * (0.06 + (0.88 * i) / n);
      const open = Math.sin((i / n) * Math.PI) * S * (0.1 + r() * 0.05); // wide in the middle, closing at the ends
      const wob = (r() - 0.5) * S * 0.05;
      top.push([x, S / 2 - open + wob]);
      bottom.push([x + (r() - 0.5) * 8, S / 2 + open * (0.7 + r() * 0.5) + wob]);
    }
    const trace = () => {
      g.beginPath();
      top.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      bottom.slice().reverse().forEach(([x, y]) => g.lineTo(x, y));
      g.closePath();
    };
    trace();
    g.strokeStyle = 'rgba(20,14,10,0.95)';
    g.lineWidth = 9; // the torn cover's edge
    g.stroke();
    trace();
    g.fillStyle = 'rgba(28,20,12,0.97)';
    g.fill();
    for (let i = 0; i < 90; i++) { // the foam in it, crumbling and yellow-brown
      g.fillStyle = `rgba(${150 + r() * 70},${120 + r() * 50},${48 + r() * 30},${0.55 + r() * 0.4})`;
      const x = S * (0.16 + r() * 0.68);
      const y = S / 2 + (r() - 0.5) * S * 0.16 * Math.sin(((x / S - 0.06) / 0.88) * Math.PI);
      g.fillRect(x, y, 3 + r() * 9, 3 + r() * 6);
    }
    g.strokeStyle = 'rgba(190,184,170,0.7)'; // threads and frayed ends
    g.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      const p0 = top[1 + Math.floor(r() * (n - 1))];
      g.beginPath();
      g.moveTo(p0[0], p0[1]);
      g.lineTo(p0[0] + (r() - 0.5) * 24, p0[1] - 6 - r() * 16);
      g.stroke();
    }
  });
}

/**
 * Cracks across a tyre's sidewall, for a polar map (the middle of the picture is the axle, its edge the tread's shoulder): a dense ring of
 * dark, thick cracks, some running out from the rim, some round the wall, forked, each with a pale dried edge, so they read from a few metres.
 */
function sidewallTexture(seed) {
  const r = rng(seed);
  return canvasTexture(1024, (g, S) => {
    g.clearRect(0, 0, S, S);
    const c = S / 2;
    const crack = (x, y, ang, len, width, depth) => {
      const pts = [[x, y]];
      for (let i = 0; i < 9; i++) {
        ang += (r() - 0.5) * 0.7;
        x += Math.cos(ang) * (len / 9);
        y += Math.sin(ang) * (len / 9);
        pts.push([x, y]);
      }
      const draw = (style, w) => {
        g.beginPath();
        pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
        g.strokeStyle = style;
        g.lineWidth = w;
        g.stroke();
      };
      draw('rgba(188,182,166,0.6)', width + 4);
      draw('rgba(10,9,8,0.97)', width);
      if (depth > 0) for (let k = 0; k < 2; k++) {
        const p = pts[2 + Math.floor(r() * 6)];
        crack(p[0], p[1], ang + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.6), len * 0.45, width * 0.7, depth - 1);
      }
    };
    for (let i = 0; i < 95; i++) { // out from the rim, across the wall
      const a = r() * Math.PI * 2;
      const r0 = S * (0.27 + r() * 0.12);
      crack(c + Math.cos(a) * r0, c + Math.sin(a) * r0, a + (r() - 0.5) * 0.5, S * (0.07 + r() * 0.12), 3.5 + r() * 2.5, 1);
    }
    for (let i = 0; i < 34; i++) { // round the wall
      const a = r() * Math.PI * 2;
      const r0 = S * (0.3 + r() * 0.16);
      crack(c + Math.cos(a) * r0, c + Math.sin(a) * r0, a + Math.PI / 2, S * (0.06 + r() * 0.1), 3.5 + r() * 2.5, 0);
    }
  });
}

// Placing --------------------------------------------------------------------

const _ray = new THREE.Raycaster();

function isScenery(o) {
  for (let p = o; p; p = p.parent) {
    if (p.userData?.rustyDamage || p.name === 'tarp' || /^wheel_/.test(p.name)) return true;
  }
  return false;
}

/** The body's own meshes a patch may sit on (the seat is only for its rips): everything visible but the wheels, the tarp and the damage. */
function bodyMeshes(root, { seat = false } = {}) {
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || isScenery(o)) return;
    const isSeat = o.name === 'seat' || o.name === 'pillionSeat';
    if (seat ? isSeat : !isSeat) meshes.push(o);
  });
  return meshes;
}

/** The first of `meshes` a ray hits, in world space: { point, normal, distance } (the normal turned to face the ray) or null. */
function rayHit(meshes, origin, dir, far) {
  _ray.set(origin, dir);
  _ray.far = far;
  const hit = _ray.intersectObjects(meshes, false).find((h) => h.face);
  if (!hit) return null;
  const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  if (normal.dot(dir) > 0) normal.negate();
  return { point: hit.point, normal, distance: hit.distance };
}

/**
 * A decal that follows the surface instead of lying flat on it: a grid of points over the patch, each dropped onto the body along
 * `-normal` and kept only if it lands close and facing the same way; a triangle is kept only if all three corners landed. So a patch that
 * reaches the edge of a fender stops at it, and one over a crease bends with it, and nothing hangs in the air over a tyre. Returns the mesh
 * (in `parent`'s frame) or null if too little of it found a surface.
 */
function projectedPatch(parent, meshes, origin, normal, { size, aspect = 1, spin = 0, material, name, lift = 0.0015, n = 7, reach = 0.09 }) {
  const up = Math.abs(normal.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t = new THREE.Vector3().crossVectors(up, normal).normalize();
  t.applyAxisAngle(normal, spin);
  const b = new THREE.Vector3().crossVectors(normal, t);
  const dir = normal.clone().negate();
  const grid = [];
  let found = 0;
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = (i / n - 0.5) * size;
      const v = (j / n - 0.5) * size * aspect;
      const from = origin.clone().addScaledVector(t, u).addScaledVector(b, v).addScaledVector(normal, 0.05);
      const hit = rayHit(meshes, from, dir, 0.05 + reach);
      const ok = hit && hit.normal.dot(normal) > 0.5;
      if (ok) found++;
      grid.push(ok ? hit.point.addScaledVector(hit.normal, lift) : null);
    }
  }
  if (found < (n + 1) * (n + 1) * 0.55) return null;
  const pos = [];
  const uv = [];
  const index = [];
  const slot = new Map();
  const vert = (k) => {
    if (!slot.has(k)) {
      const p = parent.worldToLocal(grid[k].clone());
      slot.set(k, pos.length / 3);
      pos.push(p.x, p.y, p.z);
      uv.push((k % (n + 1)) / n, Math.floor(k / (n + 1)) / n);
    }
    return slot.get(k);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * (n + 1) + i;
      const q = [k, k + 1, k + n + 1, k + n + 2];
      if (q.some((x) => !grid[x])) continue;
      index.push(vert(q[0]), vert(q[1]), vert(q[2]), vert(q[1]), vert(q[3]), vert(q[2]));
    }
  }
  if (!index.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = name;
  mesh.userData.rustyDamage = true;
  parent.add(mesh);
  return mesh;
}

const decalMat = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.85, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });

/** Sample sites to find surfaces at, as world rays: down onto the tops and sideways onto the flanks, over the body's usual extent. */
function sampleSites(root, random, count, { flanks = 0.45 } = {}) {
  const sites = [];
  for (let i = 0; i < count; i++) {
    const side = random() < 0.5 ? -1 : 1;
    const z = -0.95 + random() * 1.85;
    const down = random() >= flanks;
    const from = down ? new THREE.Vector3(side * (0.15 + random() * 0.45), 1.4, z) : new THREE.Vector3(side * 0.9, 0.38 + random() * 0.42, z);
    const dir = down ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(-side, 0, 0);
    sites.push({ from: root.localToWorld(from), dir: dir.transformDirection(root.matrixWorld) });
  }
  return sites;
}

// The whole look ----------------------------------------------------------------

/**
 * What the barn find looks like and what its jobs change. Build one with `applyDamage` once the model has its materials weathered, call
 * `sync` when the jobs change (or the farm loads) and `step` each frame.
 */
export class RustyLook {
  constructor() {
    this.tarp = null;
    this.tyres = []; // { mesh, perished, fresh, ring }
    this.nest = null;
    this.tarpOffFor = 0; // seconds since the tarp came off, or -1 not yet
    this.tyresFresh = false;
  }

  /** Brings what shows in line with what is done (a loaded farm too: instantly, no tarp to drag). */
  sync(find, { instant = false } = {}) {
    if (!find) return;
    if (find.tarpOff && this.tarp?.visible) {
      if (instant) this.tarp.visible = false;
      else if (this.tarpOffFor < 0) this.tarpOffFor = 0;
    }
    if (!find.tarpOff && this.tarp) {
      this.tarp.visible = true;
      this.tarpOffFor = -1;
      this.resetTarp();
    }
    this.setTyresFresh(!!find.isDone?.('tyre'));
    if (this.nest) this.nest.visible = !find.isDone?.('carb');
  }

  /** The tarp slides off the side and slumps, then is gone. */
  step(dt) {
    if (!this.tarp || this.tarpOffFor < 0 || !this.tarp.visible) return;
    this.tarpOffFor += dt;
    const k = Math.min(1, this.tarpOffFor / 1.3);
    const e = k * k * (3 - 2 * k);
    this.tarp.position.set(this.tarpHome.x + 1.9 * e, this.tarpHome.y - 0.18 * e, this.tarpHome.z - 0.2 * e);
    this.tarp.rotation.z = -0.5 * e;
    this.tarp.scale.set(1 - 0.15 * e, 1 - 0.45 * e, 1);
    if (k >= 1) this.tarp.visible = false;
  }

  resetTarp() {
    if (!this.tarp) return;
    this.tarp.position.copy(this.tarpHome);
    this.tarp.rotation.z = 0;
    this.tarp.scale.set(1, 1, 1);
  }

  setTyresFresh(fresh) {
    if (fresh === this.tyresFresh) return;
    this.tyresFresh = fresh;
    for (const t of this.tyres) {
      t.mesh.material = fresh ? t.fresh : t.perished;
      for (const ring of t.rings) ring.visible = !fresh;
    }
  }
}

/**
 * Puts the damage on a donor's model (its `bodyRoot`), after `weatherModel` has tinted the materials: patches, cracks, webs, rips in the
 * seat, rust on the wheels' centres, the nest, the tyres' cracks and their two materials, and the tarp. Returns the RustyLook that keeps
 * them in step with the jobs.
 */
export function applyDamage(model, plan, tarp = null) {
  const look = new RustyLook();
  const root = model.getObjectByName('bodyRoot');
  if (!root) return look;
  model.updateMatrixWorld(true);
  const random = rng(plan.seed);
  const patchMaps = [rustTexture(plan.seed + 1), rustTexture(plan.seed + 2), rustTexture(plan.seed + 3)];
  const crackMaps = [crackTexture(plan.seed + 4), crackTexture(plan.seed + 5)];
  const webMaps = [webTexture(plan.seed + 6), webTexture(plan.seed + 7)];
  const meshes = bodyMeshes(root);

  // Rust patches and cracks, following the surface they land on.
  const lay = (count, kind, maps, tries, lo, hi, sizeOf) => {
    let placed = 0;
    for (const site of sampleSites(root, random, count * tries, { flanks: kind === 'rustPatch' ? 0.45 : 0.35 })) {
      if (placed >= count) break;
      const hit = rayHit(meshes, site.from, site.dir, 3);
      const y = hit ? root.worldToLocal(hit.point.clone()).y : 0;
      if (!hit || y < lo || y > hi) continue;
      const size = sizeOf();
      const aspect = 0.7 + random() * 0.6;
      const m = projectedPatch(root, meshes, hit.point, hit.normal, { size, aspect, spin: random() * Math.PI * 2, material: decalMat(maps[placed % maps.length]), name: kind, lift: kind === 'crack' ? 0.002 : 0.0015 });
      if (m) placed++;
    }
  };
  lay(plan.patches, 'rustPatch', patchMaps, 4, 0.3, 1.0, () => 0.1 + random() * 0.17);
  lay(plan.cracks, 'crack', crackMaps, 4, 0.4, 0.95, () => 0.12 + random() * 0.14);

  // Rips in the seats' covers, with the foam showing.
  const seatMeshes = bodyMeshes(root, { seat: true });
  const ripMaps = [ripTexture(plan.seed + 9), ripTexture(plan.seed + 10)];
  let rips = 0;
  for (const seat of seatMeshes) {
    const box = new THREE.Box3().setFromObject(seat);
    const want = seat.name === 'seat' ? 3 : 2;
    let placed = 0;
    for (let tries = 0; tries < want * 6 && placed < want; tries++) {
      const x = box.min.x + (0.2 + random() * 0.6) * (box.max.x - box.min.x);
      const z = box.min.z + (0.12 + random() * 0.76) * (box.max.z - box.min.z);
      const hit = rayHit([seat], new THREE.Vector3(x, box.max.y + 0.3, z), new THREE.Vector3(0, -1, 0), 1);
      if (!hit || hit.normal.y < 0.5) continue;
      const m = projectedPatch(root, [seat], hit.point, hit.normal, { size: 0.2 + random() * 0.09, aspect: 0.55, spin: random() * 1.2 - 0.6, material: decalMat(ripMaps[placed % 2]), name: 'seatRip', lift: 0.0025, n: 8 });
      if (m) {
        placed++;
        rips++;
      }
    }
  }
  look.rips = rips;

  // Cobwebs, hanging from something: the grips' ends, the racks' front and back rails, the underside of the seat's edge. Each is a plane
  // standing upright with its top corner on the thing it hangs from, so it falls straight down.
  const spots = [];
  const bars = model.getObjectByName('handlebars');
  if (bars) {
    const at = root.worldToLocal(bars.getWorldPosition(new THREE.Vector3()));
    for (const s of [-1, 1]) spots.push({ p: new THREE.Vector3(at.x + s * 0.27, at.y + 0.03, at.z - 0.04), n: new THREE.Vector3(0, 0, 1) });
  }
  if (model.getObjectByName('rackAnchor')) {
    const front = model.getObjectByName('rackAnchor').position;
    for (const s of [-1, 1]) spots.push({ p: new THREE.Vector3(s * 0.4, front.y + 0.02, front.z + 0.32), n: new THREE.Vector3(0, 0, 1) }, { p: new THREE.Vector3(s * 0.4, 0.93, -1.0), n: new THREE.Vector3(0, 0, -1) });
  }
  for (const seat of seatMeshes.slice(0, 1)) {
    const box = new THREE.Box3().setFromObject(seat);
    for (const s of [-1, 1]) spots.push({ p: root.worldToLocal(new THREE.Vector3(s > 0 ? box.max.x : box.min.x, box.min.y + 0.01, (box.min.z + box.max.z) / 2)), n: new THREE.Vector3(s, 0, 0) });
  }
  for (let i = 0; i < Math.min(plan.webs, spots.length); i++) {
    const sp = spots[i];
    const size = 0.2 + random() * 0.16;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decalMat(webMaps[i % webMaps.length], { roughness: 1 }));
    m.geometry.translate(0, -size / 2, 0); // the top middle is the point it hangs from
    m.name = 'cobweb';
    m.userData.rustyDamage = true;
    m.position.copy(sp.p);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), sp.n); // a horizontal normal only turns it about the vertical, so the web hangs down
    m.rotateZ((random() - 0.5) * 0.5);
    root.add(m);
  }

  // The wheels: pale rubber with cracks that follow the sidewall, rusty rims, and the fresh black rubber a new tyre gets.
  const sidewall = sidewallTexture(plan.seed + 8);
  const fresh = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.93 });
  const wheels = [];
  model.traverse((o) => {
    if (/^wheel_/.test(o.name)) wheels.push(o);
  });
  const rust = new THREE.Color(0x6a3a1c);
  for (const wheel of wheels) {
    const spin = wheel.getObjectByName('spin');
    if (!spin) continue;
    let tyre = null;
    let best = 0;
    spin.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox();
      const size = o.geometry.boundingBox.getSize(new THREE.Vector3());
      if (size.y * size.z > best) {
        best = size.y * size.z;
        tyre = o;
      }
    });
    if (!tyre) continue;
    // The sidewall's profile from the tyre's own vertices: how far out it stands at each radius, so the crack ring lies on it.
    const posAttr = tyre.geometry.attributes.position;
    const rimR = (() => {
      let m = Infinity;
      for (let i = 0; i < posAttr.count; i++) m = Math.min(m, Math.hypot(posAttr.getY(i), posAttr.getZ(i)));
      return m;
    })();
    const outerR = 0.29;
    const bins = 10;
    const half = new Float32Array(bins + 1);
    for (let i = 0; i < posAttr.count; i++) {
      const r = Math.hypot(posAttr.getY(i), posAttr.getZ(i));
      if (r < rimR || r > outerR) continue;
      const k = Math.round(((r - rimR) / (outerR - rimR)) * bins);
      half[k] = Math.max(half[k], Math.abs(posAttr.getX(i)));
    }
    for (let k = 0; k <= bins; k++) if (!half[k]) half[k] = half[k - 1] ?? half[k + 1] ?? 0.1;
    const perished = tyre.material.clone();
    perished.color.lerp(new THREE.Color(0x8d8774), 0.7); // sun-bleached, dry and grey
    perished.roughness = 1;
    tyre.material = perished;
    const rings = [];
    const SEG = 56;
    for (const s of [-1, 1]) {
      const p = [];
      const uv = [];
      const index = [];
      for (let k = 0; k <= bins; k++) {
        const r = rimR + ((outerR - rimR) * k) / bins;
        for (let i = 0; i <= SEG; i++) {
          const a = (i / SEG) * Math.PI * 2;
          p.push(s * (half[k] + 0.002), Math.sin(a) * r, Math.cos(a) * r);
          const f = r / outerR;
          uv.push(0.5 + 0.5 * f * Math.cos(a), 0.5 + 0.5 * f * Math.sin(a));
        }
      }
      for (let k = 0; k < bins; k++) for (let i = 0; i < SEG; i++) {
        const q = k * (SEG + 1) + i;
        index.push(q, q + 1, q + SEG + 1, q + 1, q + SEG + 2, q + SEG + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(index);
      g.computeVertexNormals();
      const ring = new THREE.Mesh(g, decalMat(sidewall));
      ring.userData.rustyDamage = true;
      ring.name = 'tyreCracks';
      spin.add(ring);
      rings.push(ring);
    }
    look.tyres.push({ mesh: tyre, perished, fresh, rings });
    // The rim and hub rusted through their paint (the centres), with a few patches eaten into the face.
    const rimMeshes = [];
    const done = new Set();
    spin.traverse((o) => {
      if (!o.isMesh || o === tyre || o.userData.rustyDamage || !o.material || (o.material.metalness ?? 0) < 0.15 || done.has(o.material)) return;
      done.add(o.material);
      const m = o.material.clone();
      m.color.lerp(rust, 0.82);
      m.roughness = 0.92;
      m.metalness = 0.12;
      o.material = m;
    });
    spin.traverse((o) => {
      if (o.isMesh && o !== tyre && !o.userData.rustyDamage) rimMeshes.push(o);
    });
    spin.updateMatrixWorld(true);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const a = random() * Math.PI * 2;
        const rad = 0.03 + random() * 0.09;
        const from = spin.localToWorld(new THREE.Vector3(s * 0.6, Math.sin(a) * rad, Math.cos(a) * rad));
        const dir = new THREE.Vector3(-s, 0, 0).transformDirection(spin.matrixWorld);
        const hit = rayHit(rimMeshes, from, dir, 1.2);
        if (!hit || hit.normal.dot(new THREE.Vector3(s, 0, 0).transformDirection(spin.matrixWorld)) < 0.5) continue;
        projectedPatch(spin, rimMeshes, hit.point, hit.normal, { size: 0.08 + random() * 0.05, spin: random() * 6, material: decalMat(patchMaps[k % 3]), name: 'rimRust', lift: 0.002, n: 5 });
      }
    }
  }

  // The mouse nest in the open intake: shredded stuff and droppings, piled on the boot between the carb and the airbox.
  if (plan.nest) {
    const nest = new THREE.Group();
    nest.name = 'mouseNest';
    nest.userData.rustyDamage = true;
    const cols = [0x8d8472, 0xb5a98d, 0x5c5346, 0x9a8f7a];
    for (let i = 0; i < 16; i++) {
      const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.014 + random() * 0.016, 0), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 1, flatShading: true }));
      lump.position.set((random() - 0.5) * 0.11, (random() - 0.2) * 0.04, (random() - 0.5) * 0.1);
      lump.scale.set(1 + random() * 0.8, 0.6 + random() * 0.5, 1 + random() * 0.8);
      lump.rotation.set(random() * 3, random() * 3, random() * 3);
      nest.add(lump);
    }
    for (let i = 0; i < 6; i++) {
      const dropping = new THREE.Mesh(new THREE.CapsuleGeometry(0.003, 0.006, 2, 4), new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.9 }));
      dropping.position.set((random() - 0.5) * 0.14, 0.02 + random() * 0.01, (random() - 0.5) * 0.13);
      dropping.rotation.set(random() * 3, random() * 3, 0);
      nest.add(dropping);
    }
    const boot = model.getObjectByName('intakeBoot');
    const airbox = model.getObjectByName('airbox');
    if (boot && airbox) {
      boot.updateMatrixWorld(true);
      airbox.updateMatrixWorld(true);
      const a = root.worldToLocal(boot.getWorldPosition(new THREE.Vector3()));
      const b = root.worldToLocal(airbox.getWorldPosition(new THREE.Vector3()));
      nest.position.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.04, (a.z + b.z) / 2 + 0.1);
      root.add(nest);
      look.nest = nest;
    }
  }

  if (tarp) {
    look.tarp = tarp;
    look.tarpHome = tarp.position.clone();
    look.tarpOffFor = -1;
  }
  return look;
}

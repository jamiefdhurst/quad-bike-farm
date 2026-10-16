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

/** A cobweb in a corner: spokes from one point, sagging rings, a few torn threads, grey-white and mostly see-through. */
function webTexture(seed) {
  const r = rng(seed);
  return canvasTexture(256, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.strokeStyle = 'rgba(238,238,228,0.95)';
    g.lineWidth = 2.2;
    const spokes = 7 + Math.floor(r() * 3);
    const arc = Math.PI / 2;
    const tip = (a, len) => [Math.cos(a) * len, Math.sin(a) * len];
    for (let i = 0; i < spokes; i++) {
      const a = (i / (spokes - 1)) * arc;
      const [x, y] = tip(a, S * (0.9 + r() * 0.08));
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(x, y);
      g.stroke();
    }
    for (let ring = 1; ring <= 6; ring++) {
      const len = S * 0.15 * ring * (0.9 + r() * 0.2);
      g.beginPath();
      for (let i = 0; i < spokes; i++) {
        const a = (i / (spokes - 1)) * arc;
        const [x, y] = tip(a, len);
        if (i) {
          const [px, py] = tip(((i - 0.5) / (spokes - 1)) * arc, len * 0.9); // the thread sags towards the corner between spokes
          g.quadraticCurveTo(px, py, x, y);
        } else g.moveTo(x, y);
      }
      g.stroke();
    }
  });
}

/** Cracks across a tyre's sidewall, a ring of them: short, dark, mostly radial, with a pale dried edge. */
function sidewallTexture(seed) {
  const r = rng(seed);
  return canvasTexture(512, (g, S) => {
    g.clearRect(0, 0, S, S);
    const c = S / 2;
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2;
      const r0 = S * (0.3 + r() * 0.17);
      const len = S * (0.015 + r() * 0.045);
      const wob = (r() - 0.5) * 0.25;
      const x0 = c + Math.cos(a) * r0;
      const y0 = c + Math.sin(a) * r0;
      const x1 = c + Math.cos(a + wob * 0.2) * (r0 + len);
      const y1 = c + Math.sin(a + wob * 0.2) * (r0 + len);
      g.strokeStyle = 'rgba(176,170,156,0.5)';
      g.lineWidth = 3.4;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
      g.strokeStyle = 'rgba(14,12,10,0.9)';
      g.lineWidth = 1.6;
      g.stroke();
    }
  });
}

// Placing --------------------------------------------------------------------

const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();

function isScenery(o) {
  for (let p = o; p; p = p.parent) {
    if (p.userData?.rustyDamage || p.name === 'tarp' || /^wheel_/.test(p.name) || p.name === 'seat' || p.name === 'pillionSeat') return true;
  }
  return false;
}

/** The first body surface a ray from `from` (in `root`'s frame) along `dir` hits: { point, normal } in root's frame, or null. */
function hitSurface(root, from, dir, maxDist = 2) {
  root.updateMatrixWorld(true);
  const origin = root.localToWorld(from.clone());
  const toWorld = new THREE.Matrix3().getNormalMatrix(root.matrixWorld);
  const d = dir.clone().applyMatrix3(toWorld).normalize();
  _ray.set(origin, d);
  _ray.far = maxDist;
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && o.visible && !isScenery(o)) meshes.push(o); // (meshes only: the lamps' halo sprites want a camera to be hit)
  });
  const hit = _ray.intersectObjects(meshes, false).find((h) => h.face);
  if (!hit) return null;
  const inv = new THREE.Matrix3().getNormalMatrix(root.matrixWorld).invert();
  const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().applyMatrix3(inv).normalize();
  if (normal.dot(dir) > 0) normal.negate(); // facing the ray
  return { point: root.worldToLocal(hit.point.clone()), normal };
}

/** Lays a plane flat on a surface a millimetre or two off it, turned `spin` radians about the normal. */
function lay(root, mesh, point, normal, spin, lift = 0.0015) {
  mesh.position.copy(point).addScaledVector(normal, lift);
  _q.setFromUnitVectors(_v.set(0, 0, 1), _n.copy(normal));
  mesh.quaternion.copy(_q);
  mesh.rotateZ(spin);
  mesh.userData.rustyDamage = true;
  root.add(mesh);
}

const decalMat = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });

/** Sample points to find surfaces at: down onto the tops and sideways onto the flanks, over the body's usual extent. */
function sampleSites(random, count) {
  const sites = [];
  for (let i = 0; i < count; i++) {
    const side = random() < 0.5 ? -1 : 1;
    const z = -0.95 + random() * 1.85;
    if (random() < 0.55) sites.push({ from: new THREE.Vector3(side * (0.15 + random() * 0.4), 1.4, z), dir: new THREE.Vector3(0, -1, 0) });
    else sites.push({ from: new THREE.Vector3(side * 0.9, 0.38 + random() * 0.42, z), dir: new THREE.Vector3(-side, 0, 0) });
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
 * Puts the damage on a donor's model (its `bodyRoot`), after `weatherModel` has tinted the materials: patches, cracks, webs, the nest, the
 * tyres' cracks and their two materials, and the tarp. Returns the RustyLook that keeps them in step with the jobs.
 */
export function applyDamage(model, plan, tarp = null) {
  const look = new RustyLook();
  const root = model.getObjectByName('bodyRoot');
  if (!root) return look;
  const random = rng(plan.seed);
  const patchMaps = [rustTexture(plan.seed + 1), rustTexture(plan.seed + 2), rustTexture(plan.seed + 3)];
  const crackMaps = [crackTexture(plan.seed + 4), crackTexture(plan.seed + 5)];
  const webMaps = [webTexture(plan.seed + 6), webTexture(plan.seed + 7)];

  // Rust patches, and cracks over the fenders and panels.
  let placed = 0;
  for (const site of sampleSites(random, plan.patches * 3)) {
    if (placed >= plan.patches) break;
    const hit = hitSurface(root, site.from, site.dir);
    if (!hit || hit.point.y < 0.3 || hit.point.y > 1.0) continue;
    const size = 0.1 + random() * 0.18;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size * (0.7 + random() * 0.6)), decalMat(patchMaps[placed % patchMaps.length]));
    m.name = 'rustPatch';
    lay(root, m, hit.point, hit.normal, random() * Math.PI * 2);
    placed++;
  }
  placed = 0;
  for (const site of sampleSites(random, plan.cracks * 3)) {
    if (placed >= plan.cracks) break;
    const hit = hitSurface(root, site.from, site.dir);
    if (!hit || hit.point.y < 0.4 || hit.point.y > 0.95) continue;
    const size = 0.12 + random() * 0.14;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decalMat(crackMaps[placed % crackMaps.length]));
    m.name = 'crack';
    lay(root, m, hit.point, hit.normal, random() * Math.PI * 2, 0.002);
    placed++;
  }

  // Cobwebs: the bars' grips, the racks' corners, the arches and the seat's back, on the donors that have them.
  const spots = [];
  const bars = model.getObjectByName('handlebars');
  if (bars) {
    bars.updateMatrixWorld(true);
    const at = root.worldToLocal(bars.getWorldPosition(new THREE.Vector3()));
    for (const s of [-1, 1]) spots.push({ p: new THREE.Vector3(at.x + s * 0.3, at.y + 0.02, at.z - 0.04), n: new THREE.Vector3(0, 0, 1), s });
  }
  if (model.getObjectByName('rackAnchor')) for (const s of [-1, 1]) spots.push({ p: new THREE.Vector3(s * 0.4, 0.86, 0.88), n: new THREE.Vector3(0, 1, 0), s }, { p: new THREE.Vector3(s * 0.4, 0.95, -0.98), n: new THREE.Vector3(0, 1, 0), s });
  for (const s of [-1, 1]) spots.push({ p: new THREE.Vector3(s * 0.34, 0.55, 0.62), n: new THREE.Vector3(s, 0, 0), s }, { p: new THREE.Vector3(s * 0.34, 0.5, -0.62), n: new THREE.Vector3(s, 0, 0), s });
  spots.push({ p: new THREE.Vector3(0.3, 0.8, -0.5), n: new THREE.Vector3(0, 1, 0), s: 1 });
  for (let i = 0; i < Math.min(plan.webs, spots.length); i++) {
    const sp = spots[i];
    const size = 0.24 + random() * 0.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), decalMat(webMaps[i % webMaps.length], { side: THREE.DoubleSide, roughness: 1 }));
    m.name = 'cobweb';
    m.geometry.translate(size / 2, size / 2, 0); // so the web's corner is the point, the way a corner web hangs
    lay(root, m, sp.p, sp.n, random() * Math.PI * 2, 0);
  }

  // The tyres: pale and cracked, and the fresh black rubber a new tyre gets.
  const sidewall = sidewallTexture(plan.seed + 8);
  const fresh = new THREE.MeshStandardMaterial({ color: 0x171717, roughness: 0.93 });
  const spare = [];
  model.traverse((o) => {
    if (/^wheel_/.test(o.name)) spare.push(o);
  });
  for (const wheel of spare) {
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
    const box = tyre.geometry.boundingBox;
    const half = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
    const perished = tyre.material.clone();
    perished.color.lerp(new THREE.Color(0x77705f), 0.55); // sun-bleached, dry and grey
    perished.roughness = 1;
    tyre.material = perished;
    const rings = [];
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.28, 48), decalMat(sidewall, { side: THREE.FrontSide }));
      ring.geometry.rotateY(s * Math.PI / 2);
      ring.position.x = s * (half + 0.0015);
      ring.userData.rustyDamage = true;
      ring.name = 'tyreCracks';
      spin.add(ring);
      rings.push(ring);
    }
    look.tyres.push({ mesh: tyre, perished, fresh, rings });
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

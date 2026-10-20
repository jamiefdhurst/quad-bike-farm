import * as THREE from 'three';

// The farm's money tin: a printed biscuit tin with a hinged lid, the kind that lives on a shelf in a barn. Procedural, no assets. Metres, in its own
// frame: x from the back (towards the wall) to the front, y up from its base, z along the wall. The lid hinges on the back top edge (`lid`, turned
// about z), and what is in it grows with the balance in five steps (`setLevel`): a few coins, scattered change, stacks and a note, bundles of
// notes, notes over the rim. Pure geometry, tested in tests/moneyTin.test.js.

export const TIN = {
  long: 0.26, // along the wall
  deep: 0.17, // back to front
  high: 0.07, // the body
  wall: 0.0025, // sheet thickness
  lidHigh: 0.014, // the lid's top, over the rim
  lip: 0.012, // how far the lid's skirt drops over the body
  open: 1.65, // radians the lid turns about its hinge when it is open (a little past upright, so it leans back)
};

const mat = (color, roughness = 0.5, metalness = 0.6) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

const MATS = {
  tin: mat(0x6a1713, 0.45, 0.55), // dark red enamel, the body
  rim: mat(0xb9b2a4, 0.35, 0.85), // bare rolled steel at the edges
  liner: new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.95, metalness: 0 }), // the paper in the bottom
  gold: mat(0xc8a43a, 0.3, 0.85),
  silver: mat(0xb8bcc2, 0.3, 0.85),
  copper: mat(0x9a5a34, 0.4, 0.75),
  band: new THREE.MeshStandardMaterial({ color: 0xb02a2a, roughness: 0.6, metalness: 0 }), // a rubber band round a bundle
  noteGreen: new THREE.MeshStandardMaterial({ color: 0x7ea36f, roughness: 0.9, metalness: 0 }),
  notePurple: new THREE.MeshStandardMaterial({ color: 0x8b6fb0, roughness: 0.9, metalness: 0 }),
  noteOrange: new THREE.MeshStandardMaterial({ color: 0xd08a4e, roughness: 0.9, metalness: 0 }),
};

/** The lid's printed top: tartan stripes, a gold border, and a made-up biscuit maker's name. Drawn once on a canvas. */
export function lidTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 340;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6a1713';
  ctx.fillRect(0, 0, 512, 340);
  // Tartan: broad green and navy bands each way, thin cream lines between.
  for (let i = 0; i < 512; i += 64) {
    ctx.fillStyle = 'rgba(30,70,45,0.55)';
    ctx.fillRect(i, 0, 28, 340);
    ctx.fillStyle = 'rgba(20,30,70,0.45)';
    ctx.fillRect(i + 36, 0, 8, 340);
  }
  for (let j = 0; j < 340; j += 68) {
    ctx.fillStyle = 'rgba(30,70,45,0.45)';
    ctx.fillRect(0, j, 512, 24);
    ctx.fillStyle = 'rgba(235,225,190,0.35)';
    ctx.fillRect(0, j + 30, 512, 3);
  }
  // A cream panel with the name.
  ctx.fillStyle = '#efe5c4';
  ctx.beginPath();
  ctx.roundRect(70, 70, 372, 200, 22);
  ctx.fill();
  ctx.strokeStyle = '#a07b22';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#3a1410';
  ctx.textAlign = 'center';
  ctx.font = 'italic bold 46px Georgia, serif';
  ctx.fillText('Dales & Moor', 256, 138);
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('MIXED BISCUITS', 256, 184);
  ctx.font = '22px Georgia, serif';
  ctx.fillText('Baked in the valley · Since 1921', 256, 224);
  // A sheaf of wheat under the name.
  ctx.strokeStyle = '#a07b22';
  ctx.lineWidth = 3;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(256, 262);
    ctx.lineTo(256 + k * 9, 240);
    ctx.stroke();
  }
  // The gold border, and a scuffed worn corner.
  ctx.strokeStyle = '#c8a43a';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 484, 312);
  ctx.fillStyle = 'rgba(190,185,170,0.5)';
  for (let i = 0; i < 40; i++) ctx.fillRect(470 + ((i * 7) % 36), 300 + ((i * 11) % 36), 3, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function box(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

/** A stack of `n` coins standing on the floor of the tin at (x, z). */
function coinStack(n, r, material, x, z) {
  const h = 0.002;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * n, 18), material);
  m.position.set(x, TIN.wall + (h * n) / 2, z);
  return m;
}

/** A coin lying flat, turned a little. */
function coinFlat(r, material, x, y, z, tilt = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.002, 18), material);
  m.position.set(x, y, z);
  m.rotation.set(tilt, 0, tilt * 0.5);
  return m;
}

/** A bundle of notes: a stack of `count` flat sheets with a rubber band round the middle. */
function noteBundle(count, material, x, y, z, yaw = 0) {
  const g = new THREE.Group();
  const h = 0.0012 * count;
  g.add(box(0.108, h, 0.058, material, 0, h / 2, 0));
  g.add(box(0.012, h + 0.0008, 0.0605, MATS.band, 0, h / 2, 0));
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  return g;
}

/** A single note, curled up a little at the ends, lying at an angle. */
function note(material, x, y, z, yaw, tiltX = 0, tiltZ = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.0008, 0.058), material);
  m.position.set(x, y, z);
  m.rotation.set(tiltX, yaw, tiltZ);
  return m;
}

/** The layers of what is in the tin, from a coin or two (0) to notes over the rim (4); each one is added to the ones before it. */
function buildLayers() {
  const f = TIN.wall; // the floor
  const mid = TIN.deep / 2;
  const layers = [];
  const l0 = new THREE.Group(); // a coin or two on the paper
  l0.add(coinFlat(0.012, MATS.copper, mid - 0.03, f + 0.001, -0.05), coinFlat(0.011, MATS.silver, mid + 0.02, f + 0.001, -0.06), coinFlat(0.012, MATS.copper, mid, f + 0.003, -0.055, 0.1));
  layers.push(l0);
  const l1 = new THREE.Group(); // change scattered over the floor
  [[-0.03, 0.04, 0.012, 'silver'], [0.02, 0.06, 0.011, 'gold'], [0.04, -0.02, 0.012, 'copper'], [-0.04, -0.01, 0.0115, 'silver'], [0.0, 0.0, 0.012, 'gold'], [0.05, 0.03, 0.011, 'copper']].forEach(([dx, dz, r, m], i) =>
    l1.add(coinFlat(r, MATS[m], mid + dx, f + 0.001 + (i % 2) * 0.002, dz, (i % 3) * 0.06)),
  );
  l1.add(note(MATS.noteGreen, mid - 0.005, f + 0.0015, 0.06, 0.25, 0.03, 0));
  layers.push(l1);
  const l2 = new THREE.Group(); // stacks of coins and a note or two
  l2.add(coinStack(9, 0.0125, MATS.gold, mid - 0.04, 0.085), coinStack(6, 0.0115, MATS.silver, mid - 0.015, 0.1), coinStack(11, 0.012, MATS.copper, mid + 0.02, 0.09), coinStack(5, 0.0125, MATS.silver, mid + 0.05, 0.1));
  l2.add(note(MATS.notePurple, mid + 0.005, f + 0.003, -0.06, -0.2, 0, 0.04), note(MATS.noteOrange, mid - 0.015, f + 0.005, -0.055, 0.3, 0.02, 0));
  layers.push(l2);
  const l3 = new THREE.Group(); // bundles of notes
  l3.add(noteBundle(8, MATS.noteGreen, mid - 0.01, f, -0.045, 0.1), noteBundle(6, MATS.notePurple, mid + 0.005, f + 0.0096 + 0.001, -0.048, -0.15), noteBundle(10, MATS.noteOrange, mid + 0.01, f, 0.03, 0.2));
  layers.push(l3);
  const l4 = new THREE.Group(); // piled over the rim
  l4.add(noteBundle(14, MATS.noteGreen, mid - 0.005, f + 0.02, 0.0, -0.1), noteBundle(12, MATS.notePurple, mid + 0.008, f + 0.034, -0.03, 0.2), noteBundle(12, MATS.noteOrange, mid, f + 0.048, 0.04, -0.15));
  l4.add(note(MATS.noteGreen, mid - 0.02, f + 0.066, 0.02, 0.3, 0.2, 0.1), note(MATS.notePurple, mid + 0.025, f + 0.07, -0.02, -0.3, -0.15, 0.15), note(MATS.noteOrange, mid, f + 0.074, 0.05, 0.1, 0.1, -0.2));
  layers.push(l4);
  return layers;
}

/**
 * Builds the tin: the body (walls, base, rolled rim, paper liner), the lid on its hinge, and the contents. Returns { group, lid, layers, setLevel,
 * setOpen }. The origin is the middle of the tin's base.
 */
export function buildTin() {
  const { long, deep, high, wall, lidHigh, lip } = TIN;
  const group = new THREE.Group();
  group.name = 'money-tin';
  const body = new THREE.Group();
  body.position.x = -deep / 2; // the body's own frame runs 0..deep from the back
  group.add(body);
  // Walls: four sheets, the front and back a sheet longer so no corner is open; a base; a paper liner on the floor.
  body.add(box(deep, high, wall, MATS.tin, deep / 2, high / 2, -long / 2 + wall / 2), box(deep, high, wall, MATS.tin, deep / 2, high / 2, long / 2 - wall / 2));
  body.add(box(wall, high, long, MATS.tin, wall / 2, high / 2, 0), box(wall, high, long, MATS.tin, deep - wall / 2, high / 2, 0));
  body.add(box(deep, wall, long, MATS.tin, deep / 2, wall / 2, 0));
  body.add(box(deep - 2 * wall - 0.004, 0.0012, long - 2 * wall - 0.004, MATS.liner, deep / 2, wall + 0.0006, 0));
  // A rolled rim round the top and a bead round the base: bare steel, proud of the wall.
  const rim = 0.006;
  body.add(box(deep + 0.002, rim, rim, MATS.rim, deep / 2, high - rim / 2, -long / 2 + 0.0005), box(deep + 0.002, rim, rim, MATS.rim, deep / 2, high - rim / 2, long / 2 - 0.0005));
  body.add(box(rim, rim, long + 0.002, MATS.rim, 0.0005, high - rim / 2, 0), box(rim, rim, long + 0.002, MATS.rim, deep - 0.0005, high - rim / 2, 0));
  body.add(box(deep + 0.004, 0.005, long + 0.004, MATS.rim, deep / 2, 0.0025, 0));
  // The contents.
  const layers = buildLayers();
  for (const l of layers) body.add(l);
  // The lid: a plate with a skirt, hinged on the back top edge, printed on top.
  const lid = new THREE.Group();
  lid.name = 'tin-lid';
  lid.position.set(-deep / 2, high, 0); // the hinge
  const lidBody = new THREE.Group();
  lidBody.position.set(deep / 2, 0, 0); // the lid's frame: its middle above the hinge's front
  lid.add(lidBody);
  const topY = lidHigh - 0.003;
  lidBody.add(box(deep + 0.008, 0.003, long + 0.008, MATS.tin, 0, topY, 0));
  const skirt = 0.003;
  lidBody.add(box(deep + 0.008, lip, skirt, MATS.tin, 0, topY - lip / 2, -(long + 0.008) / 2 + skirt / 2), box(deep + 0.008, lip, skirt, MATS.tin, 0, topY - lip / 2, (long + 0.008) / 2 - skirt / 2));
  lidBody.add(box(skirt, lip, long + 0.008, MATS.tin, -(deep + 0.008) / 2 + skirt / 2, topY - lip / 2, 0), box(skirt, lip, long + 0.008, MATS.tin, (deep + 0.008) / 2 - skirt / 2, topY - lip / 2, 0));
  // The picture reads along the tin's long side, its top towards the back: the plane's x runs along -z (to your right as you face the wall), its y towards -x.
  const label = new THREE.Mesh(new THREE.PlaneGeometry(long - 0.01, deep - 0.01), new THREE.MeshStandardMaterial({ map: lidTexture(), roughness: 0.5, metalness: 0.3 }));
  label.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)));
  label.position.set(0, topY + 0.0016, 0);
  lidBody.add(label);
  lidBody.add(box(deep + 0.01, 0.002, 0.006, MATS.rim, 0, topY + 0.002, -(long + 0.008) / 2 + 0.003), box(deep + 0.01, 0.002, 0.006, MATS.rim, 0, topY + 0.002, (long + 0.008) / 2 - 0.003));
  // A hinge barrel on the back edge.
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, long * 0.6, 12), MATS.rim);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.002, 0);
  lid.add(barrel);
  group.add(lid);

  let openness = 0;
  let level = 0;
  // The contents only show once the lid has lifted (the top step is piled higher than the shut lid).
  const show = () => layers.forEach((l, i) => (l.visible = openness > 0.02 && i <= level));
  const api = {
    group,
    lid,
    layers,
    /** Sets which contents belong in the tin for a level from tinLevel(): layers 0..level (they show when the lid is up). */
    setLevel(l) {
      level = l;
      show();
    },
    /** 0 shut to 1 open. */
    setOpen(t) {
      openness = Math.max(0, Math.min(1, t));
      lid.rotation.z = openness * TIN.open;
      show();
    },
    get openness() {
      return openness;
    },
  };
  api.setLevel(0);
  return api;
}

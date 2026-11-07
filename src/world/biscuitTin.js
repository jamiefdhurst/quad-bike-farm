import * as THREE from 'three';

// The snack tin on the barn's back wall: a round cream-and-blue tin with a lid that comes up, a few biscuits inside, on a plank shelf of its
// own. The girls help themselves (npc/lunch.js). Procedural, no assets. Metres; the origin is the middle of the tin's base.

export const BISCUIT_TIN = { radius: 0.095, high: 0.13, lidHigh: 0.022, wall: 0.003 };

const mat = (color, roughness = 0.45, metalness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
const MATS = {
  blue: mat(0x2c4a73),
  cream: mat(0xe6dcc0, 0.6, 0.2),
  rim: mat(0xb9b2a4, 0.35, 0.85),
  liner: new THREE.MeshStandardMaterial({ color: 0xd8cfa8, roughness: 0.95 }),
  biscuit: new THREE.MeshStandardMaterial({ color: 0xc58b45, roughness: 0.9 }),
  biscuitDark: new THREE.MeshStandardMaterial({ color: 0x5a3820, roughness: 0.9 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6a4a2e, roughness: 0.85 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.5 }),
};

function label() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e6dcc0';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = '#2c4a73';
  g.fillRect(0, 0, 512, 12);
  g.fillRect(0, 116, 512, 12);
  g.fillStyle = '#a8322d';
  g.font = 'bold 40px serif';
  g.textAlign = 'center';
  g.fillText('FARMHOUSE', 128, 60);
  g.fillText('BISCUITS', 128, 100);
  g.fillText('FARMHOUSE', 384, 60);
  g.fillText('BISCUITS', 384, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The tin: a cream body with a blue band and printed label, rolled rims, a liner, biscuits, and a lid on a hinge. Returns { group, lid, setOpen, openness }. */
export function buildBiscuitTin() {
  const { radius: r, high, lidHigh, wall } = BISCUIT_TIN;
  const group = new THREE.Group();
  group.name = 'biscuit-tin';
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.97, high, 28, 1, true), new THREE.MeshStandardMaterial({ map: label(), roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }));
  body.position.y = high / 2;
  group.add(body);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.97, wall, 28), MATS.blue);
  base.position.y = wall / 2;
  group.add(base);
  const bead = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.985, r * 0.985, 0.008, 28), MATS.rim);
  bead.position.y = 0.004;
  group.add(bead);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.004, 8, 32), MATS.rim);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = high;
  group.add(rim);
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(r - 0.004, r - 0.004, 0.002, 28), MATS.liner);
  liner.position.y = wall + 0.002;
  group.add(liner);
  // Biscuits stacked and leaning: rounds, some with a dark edge, as many as fit.
  const biscuits = new THREE.Group();
  [[0, 0.03, 0], [0.04, -0.02, 0.1], [-0.045, -0.02, -0.12], [0.0, -0.055, 0.3], [-0.03, 0.055, -0.2]].forEach(([x, z, tilt], i) => {
    const b = new THREE.Group();
    b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.007, 16), MATS.biscuit));
    const edge = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0025, 6, 16), MATS.biscuitDark);
    edge.rotation.x = Math.PI / 2;
    b.add(edge);
    b.position.set(x, wall + 0.008 + (i % 3) * 0.008, z);
    b.rotation.set(tilt, i, tilt * 0.5);
    biscuits.add(b);
  });
  group.add(biscuits);
  // The lid, hinged on the back edge (-x), with a skirt, a rolled edge and a little knob.
  const lid = new THREE.Group();
  lid.name = 'biscuit-tin-lid';
  lid.position.set(-r, high, 0);
  const top = new THREE.Group();
  top.position.x = r;
  lid.add(top);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.004, r + 0.004, 0.004, 28), MATS.blue);
  plate.position.y = lidHigh - 0.002;
  top.add(plate);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.004, r + 0.004, lidHigh - 0.004, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x2c4a73, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide }));
  skirt.position.y = (lidHigh - 0.004) / 2;
  top.add(skirt);
  const lidRim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.004, 0.003, 8, 32), MATS.rim);
  lidRim.rotation.x = Math.PI / 2;
  lidRim.position.y = lidHigh;
  top.add(lidRim);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), MATS.rim);
  knob.position.y = lidHigh + 0.006;
  top.add(knob);
  const badge = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 24), MATS.cream);
  badge.rotation.x = -Math.PI / 2;
  badge.position.y = lidHigh + 0.0005;
  top.add(badge);
  group.add(lid);
  let openness = 0;
  biscuits.visible = false;
  return {
    group,
    lid,
    /** 0 shut to 1 open (the lid turns up about its back edge). */
    setOpen(t) {
      openness = Math.max(0, Math.min(1, t));
      lid.rotation.z = openness * 1.75;
      biscuits.visible = openness > 0.02;
    },
    get openness() {
      return openness;
    },
  };
}

/** A plank on two iron brackets against the wall, `long` along it. Returns a group whose origin is the plank's back top edge's middle (x out from the wall). */
export function buildPlankShelf(long = 0.36, deep = 0.22, thick = 0.03) {
  const g = new THREE.Group();
  g.name = 'biscuit-shelf';
  const plank = new THREE.Mesh(new THREE.BoxGeometry(deep, thick, long), MATS.wood);
  plank.position.set(deep / 2, -thick / 2, 0);
  g.add(plank);
  for (const dz of [-long * 0.35, long * 0.35]) {
    const up = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.02), MATS.iron);
    up.position.set(0.012, -thick - 0.065, dz);
    g.add(up);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.02, 0.02), MATS.iron);
    arm.position.set(0.09, -thick, dz);
    g.add(arm);
  }
  return g;
}

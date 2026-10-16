import * as THREE from 'three';

// How big each vehicle's real counterpart is (TODO 87), so the detail items (88 to 101) can bring each model into proportion and
// a test keeps it there. Millimetres, from the makers' published figures as best known; a vehicle item checks its own before
// relying on them and corrects this table if they are wrong. The game builds some vehicles a size up (the Land Rovers and cars
// at 1.15, so they don't look small beside the girls), so what is compared is shape, not size: every measure over the wheelbase.

export const REAL_SIZES = {
  red: { like: 'Honda TRX300FW Fourtrax 4x4', length: 1895, width: 1105, height: 1095, wheelbase: 1210, track: 880, tyre: 610 },
  blue: { like: 'Yamaha YFM660F Grizzly', length: 2080, width: 1180, height: 1115, wheelbase: 1250, track: 926, tyre: 635 },
  loan: { like: 'Yamaha YFM450 Kodiak (the Tamura Ursa 450)', length: 2050, width: 1170, height: 1190, wheelbase: 1250, track: 930, tyre: 635 },
  green: { like: 'Kawasaki KLF300 Bayou 4x4, winch fitted', length: 2060, width: 1100, height: 1120, wheelbase: 1175, track: 870, tyre: 610 }, // length is the book 1,930 plus the winch's fairlead and hook and a tow drawbar, which the farm's one wears
  yellow: { like: 'Yamaha YFS200 Blaster (the Tamura Hornet 200)', length: 1710, width: 1035, height: 1045, wheelbase: 1115, track: 790, tyre: 520 },
  orange: { like: 'Suzuki LT250R Quadracer (the Viper Adder 250)', length: 1830, width: 1175, height: 1105, wheelbase: 1240, track: 925, tyre: 520 },
  kids: { like: 'Suzuki LT50 (the Viper Asp 50)', length: 1250, width: 800, height: 800, wheelbase: 830, track: 600, tyre: 406 },
  moto: { like: 'Yamaha YZ65 (the Tamura TZ 65)', length: 1625, width: 750, height: 990, wheelbase: 1145, track: 0, tyre: 460 }, // read from the side photo: tyre to tyre it is 1.42 wheelbases, the bars top out at 0.86
  atc: { like: 'Honda ATC185S (the Kestrel T185)', length: 1780, width: 1040, height: 1050, wheelbase: 1145, track: 780, tyre: 600 },
  tractor: { like: 'Ferguson TE20', length: 2920, width: 1625, height: 1320, wheelbase: 1780, track: 1320, tyre: 1170 },
  utv: { like: 'Kawasaki Mule 4010', length: 3015, width: 1580, height: 1925, wheelbase: 1910, track: 1230, tyre: 650 },
  landrover: { like: 'Land Rover Series IIA 88', length: 3620, width: 1680, height: 1970, wheelbase: 2235, track: 1310, tyre: 757 },
  landrover200: { like: 'Land Rover Defender 90 200Tdi', length: 3883, width: 1790, height: 1963, wheelbase: 2360, track: 1486, tyre: 757 },
  fiesta: { like: 'Ford Fiesta Mk1', length: 3565, width: 1567, height: 1360, wheelbase: 2286, track: 1340, tyre: 537 },
  corsa: { like: 'Vauxhall Corsa B', length: 3729, width: 1608, height: 1420, wheelbase: 2443, track: 1400, tyre: 547 },
};

/** The measures compared, each over the wheelbase. */
export const PROPORTIONS = ['length', 'width', 'height', 'track', 'tyre'];

const isPart = (o) => o.isMesh && o.material?.isMeshStandardMaterial;

/**
 * A built model's sizes in metres, in its own frame before any game scale, where the ground is y = 0 (the game sinks the body by
 * its ground offset later). The body is the box round every visible lit part except the wheels and the accessories (`skip`): not the
 * headlight beams, not a bale spike. The wheels stand where the `layout` puts them (the game places them, not the model), each as
 * big as what turns in it (its `spin` group), and the length and width take them in. A three-wheeler's track is its rear pair's.
 */
export function measureModel(model, layout, { skip = /proxy|tarp|baleSpike/i } = {}) {
  model.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const local = (o) => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
  const box = new THREE.Box3();
  const part = new THREE.Box3();
  const visit = (o) => {
    if (/^wheel_/.test(o.name) || skip.test(o.name) || !o.visible) return;
    if (isPart(o)) {
      o.geometry.computeBoundingBox();
      box.union(part.copy(o.geometry.boundingBox).applyMatrix4(local(o)));
    }
    for (const c of o.children) visit(c);
  };
  visit(model);
  const tyre = new THREE.Vector3();
  model.traverse((o) => {
    if (o.name !== 'spin') return;
    const wb = new THREE.Box3();
    o.traverse((m) => {
      if (!isPart(m)) return;
      m.geometry.computeBoundingBox();
      wb.union(part.copy(m.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(o.matrixWorld).invert(), m.matrixWorld)));
    });
    if (!wb.isEmpty()) tyre.max(wb.getSize(new THREE.Vector3()));
  });
  for (const w of layout.wheels) {
    const r = w.radius ?? tyre.y / 2;
    box.expandByPoint(new THREE.Vector3(w.x + Math.sign(w.x) * tyre.x / 2, 0, w.z + r));
    box.expandByPoint(new THREE.Vector3(w.x - Math.sign(w.x) * tyre.x / 2, 0, w.z - r));
  }
  const zs = layout.wheels.map((w) => w.z);
  const xs = layout.wheels.map((w) => w.x);
  const size = box.getSize(new THREE.Vector3());
  return {
    length: size.z,
    width: size.x,
    height: box.max.y,
    wheelbase: Math.max(...zs) - Math.min(...zs),
    track: Math.max(...xs) - Math.min(...xs),
    tyre: tyre.y,
  };
}

/**
 * How far each measure is from the real one, as a fraction (0.1 = 10% too big, -0.1 = 10% too small), all over the wheelbase.
 * Measures the real table leaves at 0 (a bike's track) are left out.
 */
export function proportionErrors(measured, real) {
  const out = {};
  for (const k of PROPORTIONS) {
    if (!real[k] || !measured.wheelbase) continue;
    out[k] = measured[k] / measured.wheelbase / (real[k] / real.wheelbase) - 1;
  }
  return out;
}

/** The vehicles a detail item has brought into proportion; tests/proportions.test.js holds each within `PROPORTION_TOLERANCE`. */
export const IN_PROPORTION = ['red', 'blue', 'green', 'kids', 'moto', 'atc', 'loan'];

export const PROPORTION_TOLERANCE = 0.08;

import * as THREE from 'three';

// Real light from the vehicles' headlamps (the lenses and faked beams in quadModel.js only glow). A light per vehicle would cost every
// frame and recompile every shader whenever the count changed, so there is a fixed pool of spotlights, made at the start and never
// added to or taken away: each frame they go to the lit vehicles that matter most (the one you're on, then whichever is lighting
// the way for you, then the nearest), and the rest sit at nothing. Strength and colour follow each vehicle's own lamps, revs, flicker
// and all; by day they're faint, as headlamps are in sunshine.

export const DEFAULT_VEHICLE_LIGHT_PARAMS = {
  count: 6, // spotlights in the pool (read once, at the start)
  candela: 140, // a full-on headlamp pair, at the middle of its beam
  dayShare: 0.12, // how strong they are in full daylight, against at night
  reach: 40, // metres: the light is gone by here
  decay: 1.6, // how fast it falls away with distance (2 is real; less carries further)
  angle: 0.55, // radians: half the beam's spread
  penumbra: 0.65, // how soft the beam's edge is
  dip: 0.12, // radians the beam is aimed down from straight ahead
};

export const VEHICLE_LIGHT_PARAM_RANGES = {
  candela: [0, 1000, 5],
  dayShare: [0, 1, 0.01],
  reach: [5, 120, 1],
  decay: [0, 3, 0.05],
  angle: [0.1, 1.2, 0.01],
  penumbra: [0, 1, 0.01],
  dip: [-0.3, 0.6, 0.01],
};

/**
 * Which vehicles get a light: `cands` [{ id, level (0..1 how bright its lamps are), distance (metres from you), mine (you're on it),
 * lighting (it is lighting the way for you) }]. Lit ones only, yours first, then the one lighting for you, then nearest; at most `n`.
 * Pure.
 */
export function pickLit(cands, n) {
  return cands
    .filter((c) => c.level > 0.02)
    .sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || (b.lighting ? 1 : 0) - (a.lighting ? 1 : 0) || a.distance - b.distance)
    .slice(0, n)
    .map((c) => c.id);
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _fwd = new THREE.Vector3();

export class VehicleLights {
  constructor(scene, p = { ...DEFAULT_VEHICLE_LIGHT_PARAMS }) {
    this.p = p;
    this.pool = [];
    for (let i = 0; i < p.count; i++) {
      const light = new THREE.SpotLight(0xfff2cc, 0, p.reach, p.angle, p.penumbra, p.decay);
      light.castShadow = false;
      scene.add(light, light.target);
      this.pool.push(light);
    }
    this.lit = []; // the ids lit this frame, for the debug panel
  }

  /**
   * Each frame. `units` the vehicles (each with .id and .quad: headlightLevel, headlightColour, headlightReach, userData.beams on its
   * model); `from` where you are; `mine` the unit you're on (or null); `lighting` the unit lighting the way for you (or null);
   * `darkness` 0 day to 1 night.
   */
  update(units, from, mine, lighting, darkness) {
    const p = this.p;
    const cands = [];
    for (const u of units) {
      const q = u.quad;
      if (!q.model?.userData.beams?.length) continue;
      cands.push({ id: u.id, unit: u, level: q.headlightLevel ?? 0, distance: q.position.distanceTo(from), mine: u === mine, lighting: u === lighting });
    }
    this.lit = pickLit(cands, this.pool.length);
    const strength = p.dayShare + (1 - p.dayShare) * darkness;
    this.pool.forEach((light, i) => {
      const id = this.lit[i];
      const u = id && cands.find((c) => c.id === id).unit;
      if (!u) {
        light.intensity = 0;
        return;
      }
      const q = u.quad;
      // From between its lamps, the way they point.
      const beams = q.model.userData.beams.filter((o) => !o.isSprite);
      _a.set(0, 0, 0);
      for (const b of beams) _a.add(b.getWorldPosition(_b));
      _a.divideScalar(beams.length);
      beams[0].getWorldQuaternion(_q);
      _fwd.set(0, -Math.sin(p.dip), Math.cos(p.dip)).applyQuaternion(_q);
      light.position.copy(_a);
      light.target.position.copy(_a).addScaledVector(_fwd, 10);
      light.color.setHex(q.headlightColour ?? 0xfff2cc);
      const reach = q.headlightReach ?? 1;
      light.intensity = p.candela * q.headlightLevel * strength * reach;
      light.distance = p.reach * reach;
      light.angle = p.angle;
      light.penumbra = p.penumbra;
      light.decay = p.decay;
    });
  }
}

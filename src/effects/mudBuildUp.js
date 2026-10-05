// How much mud a quad is carrying. Pure logic, no Three.
//
// Every wheel in mud throws it about in proportion to how fast the tyre is
// turning over the ground (speed plus wheelspin). The tyres coat in seconds,
// the bodywork over a few laps, and puddles splash it on quickly. Rolling on
// grass slowly cleans the tyres; the bodywork keeps its mud, drying lighter.

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function createMudState() {
  return { body: 0, wheels: 0, wet: 0 };
}

/**
 * @param {object} state      { body, wheels, wet }, each 0..1, updated in place.
 * @param {number} dt
 * @param {object[]} wheels   Per wheel: { contact, mud, puddle, driven }.
 * @param {number} speed      Ground speed, m/s.
 * @param {number} spinSlip   Driven tyres' surface speed over the ground, m/s.
 * @param {object} p          Mud params.
 */
export function updateMudBuildUp(state, dt, wheels, speed, spinSlip, p) {
  let thrown = 0;
  let splash = 0;
  let onGrass = 0;
  const roll = Math.min(speed, 14);
  for (const w of wheels) {
    if (!w.contact) continue;
    const mud = Math.max(w.mud, w.puddle);
    thrown += mud * (roll + (w.driven ? spinSlip : 0));
    splash += w.puddle * roll;
    onGrass += (1 - mud) * roll;
  }
  const n = wheels.length || 1;
  thrown /= n;
  splash /= n;
  onGrass /= n;

  state.wheels += (1 - state.wheels) * Math.min(1, (thrown * p.wheelBuildRate + splash * p.puddleSplashRate) * dt);
  state.wheels -= state.wheels * Math.min(1, onGrass * p.tyreCleanRate * dt);
  state.body += (1 - state.body) * Math.min(1, (thrown * p.bodyBuildRate + splash * p.puddleSplashRate) * dt);
  // Fresh mud is wet; it dries over a few minutes.
  const fresh = thrown + splash * 4;
  state.wet = Math.min(1, Math.max(0, state.wet - dt / p.dryTime) + fresh * 0.25 * dt);
  state.body = clamp01(state.body);
  state.wheels = clamp01(state.wheels);
  state.wet = clamp01(state.wet);
  return state;
}

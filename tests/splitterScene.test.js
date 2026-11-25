import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SETUPS } from '../src/debug/sceneSetups.js';
import { SCENES } from '../src/debug/scenes.js';
import { TractorWorkHost } from '../src/items/tractorWorkHost.js';
import { LogSplitter, DEFAULT_SPLITTER_PARAMS } from '../src/items/logSplitter.js';
import { SPLITTER } from '../src/vehicle/tractorModel.js';

// A stand-in game with a tractor at the farm, the log yard and a pile of rounds, for `scene splitter` (#338).
function standIn({ tractor = true, rider = null } = {}) {
  const model = new THREE.Group();
  const beam = Object.assign(new THREE.Group(), { name: 'logSplitter' });
  model.add(beam);
  const placed = [];
  // As the real quad: placeAt moves the body (currPos, currQuat) and the model follows only on the next frame; localToWorld reads the model.
  const quad = {
    rider,
    driver: null,
    parkBrake: false,
    model,
    currPos: new THREE.Vector3(),
    currQuat: new THREE.Quaternion(),
    placeAt(x, z, yaw) {
      placed.push({ x, z, yaw });
      this.currPos.set(x, 0, z);
      this.currQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    },
    localToWorld: (x, y, z) => model.localToWorld(new THREE.Vector3(x, y, z)),
  };
  model.position.set(-300, 0, 40); // somewhere else on the farm, turned
  model.rotation.y = 1.2;
  model.updateMatrixWorld(true);
  const unit = { id: 'hartley', quad };
  const onBeam = [];
  const g = {
    world: { layout: { logYard: { park: { x: 50, z: 80, yaw: 0 } } } }, // the woodpile's parking place
    tractorUnit: tractor ? unit : null,
    units: tractor ? [unit] : [],
    logStack: {},
    trailer: { hitched: false },
    tipTrailer: { hitched: false },
    splitter: new LogSplitter({ ...DEFAULT_SPLITTER_PARAMS }),
    rounds: [{ onGround: true, gnarled: false, putOnBeam: (m) => onBeam.push(m) }],
  };
  g.tractorWork = new TractorWorkHost(g);
  const said = [];
  return { g, said, say: (line) => said.push(line), placed, beam, onBeam };
}

describe('scene splitter', () => {
  it('is in the scene list, set up by its own setup', () => {
    const scene = SCENES.find((s) => s.id === 'splitter');
    expect(scene.setup).toBe('splitter');
    expect(SETUPS.splitter).toBeTypeOf('function');
  });

  it('parks the tractor at the woodpile, fits the splitter and starts it, brake on, a round on the beam and you beside it', () => {
    const { g, said, say, placed, beam, onBeam } = standIn();
    const out = SETUPS.splitter(g, say);
    expect(placed).toEqual([{ x: 50, z: 80, yaw: 0 }]);
    expect(said.slice(0, 2)).toEqual(['farm.splitter true', 'start hartley']);
    expect(g.tractorUnit.quad.parkBrake).toBe(true);
    expect(g.splitter.loaded).toBe(true);
    expect(onBeam).toEqual([beam]);
    expect(said[2]).toBe(`tp me 51.8 ${(80 + SPLITTER.roundZ).toFixed(1)} 270`); // beside the beam, facing it
    expect(out[0]).toMatch(/round on the splitter/);
  });

  it('says why when the farm has no tractor, or someone is on it', () => {
    const none = standIn({ tractor: false });
    expect(SETUPS.splitter(none.g, none.say)[0]).toMatch(/no tractor/);
    expect(none.said).toEqual([]);
    const ridden = standIn({ rider: {} });
    expect(SETUPS.splitter(ridden.g, ridden.say)[0]).toMatch(/someone on it/);
    expect(ridden.placed).toEqual([]);
  });
});

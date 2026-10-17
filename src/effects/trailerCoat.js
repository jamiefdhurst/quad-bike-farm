import { MudCoat } from './mudCoat.js';
import { createMudState, updateMudBuildUp } from './mudBuildUp.js';
import { DEFAULT_MUD_PARAMS } from './quadMud.js';

// Mud and wear on a trailer (TODO 101): the same coat the quads wear (effects/mudCoat.js: dirt creeping up from the wheels, the wear layer's
// scuffs, rust and fading in the folds), on a trailer's model. It picks up mud as its own two wheels roll through it, at the quads' rates, so a
// trailer that has stood in the yard all week is only as dirty as it was left. Not hosed down yet.

/** What the coat needs of a vehicle: a model and the wheel groups, as a Quad has them. */
function standIn(model, wheels) {
  return { model, wheels: wheels.map((object) => ({ object })) };
}

export class TrailerCoat {
  /**
   * @param {THREE.Object3D} model  The trailer's model.
   * @param {THREE.Object3D[]} wheels  Its wheel groups (each with a `spin` child), left and right.
   * @param {number} wear  How worn it looks, 0 new to 1 derelict.
   */
  constructor(model, wheels, wear = 0.4, params = { ...DEFAULT_MUD_PARAMS }) {
    this.coat = new MudCoat(standIn(model, wheels));
    this.coat.look.wear = wear;
    this.state = createMudState();
    this.params = params;
    this.wheels = wheels;
    this._p = null;
  }

  /** One step: `speed` m/s along it, and the world's mud and water at a point (`world.mudAt`, `world.puddleAt`). */
  update(dt, speed, world, vec) {
    if (!this.wheels.length) return;
    const info = this.wheels.map((w) => {
      w.getWorldPosition(vec);
      const mud = world?.mudAt ? world.mudAt(vec.x, vec.z) : 0;
      const puddle = world?.puddleAt ? world.puddleAt(vec.x, vec.z) : 0;
      return { contact: true, mud, puddle, driven: false };
    });
    updateMudBuildUp(this.state, dt, info, Math.abs(speed), 0, this.params);
    this.coat.update(this.state);
  }

  /** One piece of the wear bake (mudCoat.js); false once it is all done. */
  bakeStep() {
    return this.coat.bakeStep();
  }
}

// Everyone whose feet make a sound: you on foot and each girl walking. Reads where they are, works out their speed from how far they moved,
// and asks the hub to play a step on the ground under them (footsteps.js decides when and how loud). No Three.js or DOM, so a stand-in hub tests it.

import { Footsteps, surfaceName, stepGain } from './footsteps.js';
import { createSurfaceSampler } from './rideEvents.js';

export class FootstepWalkers {
  /**
   * @param {object} o
   * @param {{footstep:(kind:string, level:number, at:object|null)=>void, listenerPosition?:{x:number,z:number}}} o.hub
   * @param {(x:number, z:number)=>object} o.surfaceAt  createSurfaceSampler's
   * @param {object} o.params  DEFAULT_SOUND_PARAMS (the footstep tunables)
   * @param {()=>{x:number,z:number,walking:boolean}} o.you  walking is true on foot and on the ground
   * @param {()=>{id:string,x:number,z:number,walking:boolean}[]} o.girls
   */
  constructor({ hub, surfaceAt, params, you, girls }) {
    this.hub = hub;
    this.surfaceAt = surfaceAt;
    this.params = params;
    this.you = you;
    this.girls = girls;
    this.walkers = new Map(); // id -> { feet: Footsteps, x, z }
  }

  /** The walkers for the game: you (on foot and on the ground) and each companion while she walks. */
  static forGame(game) {
    return new FootstepWalkers({
      hub: game.audioHub,
      surfaceAt: createSurfaceSampler(game.world),
      params: game.audioHub.params,
      you: () => ({ x: game.player.position.x, y: game.player.position.y, z: game.player.position.z, walking: !game.player.isRiding && game.player.grounded }),
      girls: () => game.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, y: c.root.position.y, z: c.root.position.z, walking: c.fsm.is('walking') })),
    });
  }

  update(dt) {
    if (dt <= 0) return;
    this.walk('you', this.you(), dt, false);
    for (const g of this.girls()) this.walk(g.id, g, dt, true);
  }

  walk(id, w, dt, isGirl) {
    let state = this.walkers.get(id);
    if (!state) this.walkers.set(id, (state = { feet: new Footsteps(), x: w.x, z: w.z }));
    const speed = Math.hypot(w.x - state.x, w.z - state.z) / dt;
    state.x = w.x;
    state.z = w.z;
    const step = state.feet.step(w, { walking: w.walking, speed }, this.params);
    if (!step) return;
    const l = this.hub.listenerPosition;
    const gain = stepGain(isGirl && l ? Math.hypot(w.x - l.x, w.z - l.z) : 0, isGirl, this.params);
    if (gain <= 0) return;
    this.hub.footstep(surfaceName(this.surfaceAt(w.x, w.z)), gain * step.strength, isGirl ? { x: w.x, y: w.y ?? 0, z: w.z } : null);
  }
}

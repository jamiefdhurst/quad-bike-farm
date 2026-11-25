// The farm's birds in the running game (#124): the dawn chorus from the hedges and their trees round you, and rooks going over at dusk, from the
// schedule in world/farmBirds.js, played through the wildlife's panner (audio/farmBirdsAudio.js); and the debug side's pheasant flush, the
// pheasant being a farm bird too (world/wildlife.js has its rules, game.js its notice for the girls).

import { FarmBirds, birdsDue, songSpots, DEFAULT_FARM_BIRD_PARAMS, FARM_BIRD_PARAM_RANGES } from './farmBirds.js';
import { FarmBirdsAudio } from '../audio/farmBirdsAudio.js';
import { registerTuning } from '../core/tuning.js';
import { createRandom } from '../core/random.js';

export class FarmBirdsHost {
  /** After `setUpWildlife` has made `game.wildlifeAudio`. */
  constructor(game) {
    this.game = game;
    const f = game.world.fields;
    const L = game.world.layout;
    this.params = { ...DEFAULT_FARM_BIRD_PARAMS };
    registerTuning('Farm birds', this.params, FARM_BIRD_PARAM_RANGES);
    const trees = [...(L.hill?.hedgeOaks ?? []), ...(L.fieldLandmarks ?? []).flatMap((l) => l.trees ?? [])];
    this.birds = new FarmBirds({ spots: songSpots(f.hedges, f.inGap, trees), params: this.params, random: createRandom(game.seed ^ 0xb12d5) });
    this.audio = new FarmBirdsAudio(game.wildlifeAudio, this.params);
  }

  /** Every frame: which birds are due at this hour, season and rain, and the ones that start now played from where they are. */
  update(dt) {
    const g = this.game;
    const cam = g.camera.position;
    const due = birdsDue(g.daylight.hour, g.daylight.p, { month: g.date.month, rain: g.weather.rain });
    for (const e of this.birds.update(dt, due, { x: cam.x, z: cam.z })) this.audio.play(e, (x, z) => g.world.groundHeightAt(x, z));
  }

  /** The debug panel's and console's: start the dawn chorus round you ('chorus') or send rooks over ('rooks') whatever the hour. False for anything else. */
  force(kind) {
    return this.birds.force(kind);
  }

  /** What is due and how many are singing, for the panel and the console. */
  describe() {
    return this.birds.describe();
  }

  /** The debug panel's and console's flush: the pheasant nearest you bursts out as if you had walked up to it. */
  flushPheasant() {
    const g = this.game;
    const p = g.player.position;
    const e = g.pheasants?.flush(p.x, p.z);
    if (e) g.firePheasantEvent(e);
    return !!e;
  }
}

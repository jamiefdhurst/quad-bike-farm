// The neighbour in the running game: her rig stood in her yard (the girls' model, older and greyer, in a plum jumper), her own recorded voice,
// the house's windows glowing after dark, and what the girls make of her farm. The behaviour is world/neighbourFarm.js's `Neighbour`;
// game.js builds this and calls update() inside the frame guard. The debug panel and the console use the debug* methods.

import * as THREE from 'three';
import { createRandom } from '../core/random.js';
import { registerTuning } from '../core/tuning.js';
import { Neighbour, DEFAULT_NEIGHBOUR_PARAMS, NEIGHBOUR_PARAM_RANGES } from './neighbourFarm.js';
import { NEIGHBOUR_VOICE } from '../npc/neighbourLines.js';
import { CharacterRig } from '../npc/characterRig.js';
import { applyOutfit, withJumper, OUTFITS } from '../npc/outfit.js';
import { CompanionSounds } from '../audio/companionAudio.js';

const WAVE_SECONDS = 2.4;

export class NeighbourHost {
  constructor(game) {
    this.g = game;
    this.props = game.world.props.neighbourFarm;
    this.shape = game.world.outbuildings.neighbour?.shape ?? null;
    this.params = { ...DEFAULT_NEIGHBOUR_PARAMS };
    registerTuning('Neighbour', this.params, NEIGHBOUR_PARAM_RANGES);
    this.active = !!this.shape && !!this.props;
    if (!this.active) return;
    this.random = createRandom(game.seed ^ 0x4e1b);
    this.neighbour = new Neighbour(this.shape, this.params, this.random);
    this.sounds = new CompanionSounds(game.audioHub, { voiceBank: NEIGHBOUR_VOICE.voiceBank });
    this.rig = null;
    this.said = new Map(); // line kind -> seconds since it was said
    this.lastLine = new Map(); // line kind -> the text, so it is not repeated at once
    this.wave = 0; // s of waving left
    this.inYard = false;
    this.arrivedFor = 0;
    this.lastEvent = 'nothing yet';
    this.pos = new THREE.Vector3();
    this.groundY = game.world.groundHeightAt(this.neighbour.x, this.neighbour.z);
  }

  /** Her rig, made on first use (the girls' model is shared, so it is built once the game has it). */
  ensureRig() {
    if (this.rig || !this.g.models.companion) return this.rig;
    const rig = new CharacterRig(this.g.models.companion, 1.68);
    applyOutfit(rig, withJumper({ ...OUTFITS.original, colors: { hair: '#b9b4aa' } }, '#6b4a6e'));
    rig.play('Idle', { fade: 0 });
    this.g.scene.add(rig.root);
    this.rig = rig;
    return rig;
  }

  /** The girls and you, as the behaviour sees them. */
  targets() {
    const g = this.g;
    const out = [{ kind: 'you', x: g.player.position.x, z: g.player.position.z, onFoot: !g.player.isRiding }];
    for (const c of g.companions) if (c.root.parent === g.scene) out.push({ kind: 'girl', x: c.root.position.x, z: c.root.position.z, onFoot: true });
    return out;
  }

  update(dt) {
    if (!this.active) return;
    const g = this.g;
    const n = this.neighbour;
    const dark = g.daylight?.darkness ?? 0;
    for (const [k, t] of this.said) this.said.set(k, t + dt);
    const events = n.update(dt, { targets: this.targets(), darkness: dark, rain: g.weather?.rain ?? 0 });
    for (const e of events) this.onEvent(e);
    this.props.setNight(dark, n.indoors);
    this.watchArrival(dt);
    this.sounds.ensure();
    this.show(dt);
  }

  watchArrival(dt) {
    const p = this.g.player.position;
    const inside = this.g.world.outbuildings.neighbour.inYard(p.x, p.z, -1);
    if (inside && !this.inYard) this.arrivedFor = 2.5;
    this.inYard = inside;
    if (this.arrivedFor > 0 && (this.arrivedFor -= dt) <= 0 && !this.neighbour.indoors) this.g.trafficHost.remark('neighbourFarm', this.neighbour, 0.9);
  }

  onEvent(e) {
    const g = this.g;
    const n = this.neighbour;
    const at = { x: n.x, y: this.groundY + 1.5, z: n.z };
    if (e.type === 'greet') {
      this.lastEvent = `greeted ${e.who}`;
      this.wave = WAVE_SECONDS;
      this.say(e.key);
      g.notice('traffic', at, { key: 'neighbour', strength: 1 }); // the girls look and may wave back
      g.trafficHost.later.push({ left: 3, run: () => g.trafficHost.remark('neighbourWave', n, 0.5) });
    } else if (e.type === 'chat' || e.type === 'farewell') {
      this.lastEvent = e.type;
      this.say(e.key);
    } else if (e.type === 'indoors') {
      this.lastEvent = 'went indoors for the night';
    } else if (e.type === 'outdoors') {
      this.lastEvent = 'came out';
    }
  }

  /** She says a line of this kind (not the one she said last), in her recorded voice, with the words on screen. */
  say(kind) {
    const set = NEIGHBOUR_VOICE.lines[kind];
    if (!set) return false;
    if ((this.said.get(kind) ?? Infinity) < set.cooldown) return false;
    const options = set.lines.filter((l) => l !== this.lastLine.get(kind));
    const text = options[Math.floor(this.random() * options.length)];
    this.lastLine.set(kind, text);
    this.said.set(kind, 0);
    const n = this.neighbour;
    const seconds = this.sounds.say(text, { x: n.x, y: this.groundY + 1.6, z: n.z }, 1, { rolloff: 1 });
    // Not recorded yet: the words alone, so the game works before the bank is made.
    this.g.hud.caption(text, seconds || 3);
    return true;
  }

  show(dt) {
    const rig = this.ensureRig();
    if (!rig) return;
    const n = this.neighbour;
    rig.root.visible = !n.indoors && this.props.group.visible;
    if (!rig.root.visible) return;
    this.groundY = this.g.world.groundHeightAt(n.x, n.z);
    rig.root.position.set(n.x, this.groundY, n.z);
    rig.root.rotation.set(0, n.yaw, 0);
    if (this.wave > 0) {
      this.wave -= dt;
      const env = Math.min(1, this.wave / 0.4, (WAVE_SECONDS - this.wave) / 0.3);
      rig.offsets.rightArmOut = 1.9 * env;
      rig.offsets.rightElbow = 0.6 * env * Math.sin((WAVE_SECONDS - this.wave) * 9);
    } else {
      rig.offsets.rightArmOut = 0;
      rig.offsets.rightElbow = 0;
    }
    const w = n.watching;
    rig.lookWeight = w ? 1 : 0;
    if (w) rig.lookTarget.set(w.x, this.groundY + 1.5, w.z);
    rig.update(dt);
  }

  // Debug panel and console --------------------------------------------------

  /** Makes her greet now, whoever is near (or just wave and speak if no one is). */
  debugGreet() {
    if (!this.active || this.neighbour.indoors) return false;
    this.onEvent({ type: 'greet', key: this.neighbour.metBefore ? 'greetAgain' : 'greet', who: 'you' });
    this.neighbour.metBefore = true;
    return true;
  }

  /** Puts you on foot at her gate (the console and the panel), to see the yard without riding there. False if you are on a vehicle. */
  debugGoTo() {
    const s = this.shape;
    if (!s || this.g.player.isRiding) return false;
    const x = s.gateway.x - 3;
    this.g.player.moveTo({ x, y: this.g.world.groundHeightAt(x, s.gateway.z), z: s.gateway.z });
    return true;
  }

  describe() {
    if (!this.active) return 'no neighbour on this farm';
    const n = this.neighbour;
    return `${n.indoors ? 'indoors' : `in the yard, ${n.watching ? `watching ${n.watching.kind}` : 'looking about'}`}; last: ${this.lastEvent}`;
  }
}

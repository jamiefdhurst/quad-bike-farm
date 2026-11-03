// The shepherd's hut in the running game: the stove you light and keep going, the kettle you pour a mug of tea from, and the girls' stays in it.
// The behaviour is hut.js's `Stove` and npc/hutStay.js's `HutStay`; the look is hutBuild.js and hutView.js. game.js builds this and calls
// update() inside the frame guard. The debug panel and the console use the debug* methods.

import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { Stove, DEFAULT_HUT_PARAMS, HUT_PARAM_RANGES, HUT_INSIDE } from './hut.js';
import { HutView } from './hutView.js';
import { HutDoor, wantsShut } from './hutDoor.js';
import { HutAudio } from '../audio/hutAudio.js';
import { HutStay, DEFAULT_HUT_STAY_PARAMS, HUT_STAY_PARAM_RANGES, coldness } from '../npc/hutStay.js';

const POUR_SOUND_EVERY = 0.4; // seconds between slices of the pouring sound

export class HutHost {
  constructor(game) {
    this.g = game;
    this.shape = game.world.hutShape;
    this.props = game.world.props.hut;
    this.active = !!this.shape && !!this.props;
    this.params = { ...DEFAULT_HUT_PARAMS };
    this.stove = new Stove(this.params);
    this.stay = new HutStay();
    this.door = new HutDoor(this.params);
    this.shutWhenEmpty = false; // a girl has left: she shuts the door behind her once she is clear of it, if it is wet or dark
    registerTuning('Hut stove', this.params, HUT_PARAM_RANGES);
    registerTuning('Staying in the hut', this.stay.p, HUT_STAY_PARAM_RANGES);
    this.spots = [];
    this.pouring = false; // E was held at the kettle this frame
    this.pourSound = 0;
    if (!this.active) return;
    const shape = this.shape;
    const ground = this.props.parts.ground;
    this.view = new HutView({ scene: game.scene, shape, parts: this.props.parts, heightAt: (x, z) => game.world.heightAt(x, z), params: this.params });
    this.audio = new HutAudio(game.audioHub);
    this.stovePos = new THREE.Vector3(shape.stove.x, ground + shape.floor + 0.5, shape.stove.z);
    // Rest spots for the bunk's two places: stable objects, since a girl's restSpot is compared by identity. She climbs the steps and goes in the
    // door like the loft ladder (companionResting.js's `via`), and sits with her hips on the bunk's edge.
    this.spots = shape.seatPoints.map((s, i) => ({
      id: `hut${i}`,
      kind: 'hut',
      x: s.x,
      z: s.z,
      yaw: s.yaw,
      seat: shape.floor + HUT_INSIDE.bunk.rise + 0.04,
      stand: { x: shape.footOfSteps.x, z: shape.footOfSteps.z },
      via: shape.stepsWay,
      climbSeconds: 6,
    }));
    this.addInteractions();
    this.applyDoor();
  }

  /** An invisible box at a point in the hut's frame, to look at. */
  proxy(lx, lz, y0, w, h, d) {
    const p = this.shape.toWorld(lx, lz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    m.position.set(p.x, this.props.parts.ground + y0 + h / 2, p.z);
    m.rotation.y = this.shape.yaw;
    this.g.scene.add(m);
    return m;
  }

  addInteractions() {
    const g = this.g;
    const st = HUT_INSIDE.stove;
    g.interaction.add({
      target: this.proxy(st.x, st.z, this.shape.floor, 0.7, 0.9, 0.6),
      isAvailable: () => !g.player.isRiding && !!this.stove.action,
      prompt: () => (this.stove.action === 'light' ? 'Light the stove' : 'Put a log on the stove'),
      feedback: () => (this.stove.action === 'light' ? 'own' : 'putDown'), // lighting has its own whump and the glow in the door
      interact: () => (this.stove.action === 'light' ? this.light('you') : this.stoke('you')),
    });
    const k = HUT_INSIDE.kettle;
    g.interaction.add({
      target: this.proxy(k.x + 0.05, k.z + 0.03, this.shape.floor + 0.55, 0.42, 0.34, 0.42),
      isAvailable: () => !g.player.isRiding,
      prompt: () => this.kettlePrompt(),
      feedback: 'hold',
      interact: () => {},
      hold: (dt) => this.pour(dt),
    });
    // The doorway: ask the nearest free girl up to sit with you, when the stove has nothing for you to do.
    g.interaction.add({
      target: this.proxy(0, this.shape.halfLength + 0.4, 0, 1.4, 2.2, 1.4),
      isAvailable: () => !g.player.isRiding && !!this.hutGirl(),
      prompt: () => `Sit in the hut with ${this.hutGirl().name}`,
      feedback: 'own', // she says yes and walks off
      interact: () => this.ask(this.hutGirl()),
    });
    // The door: the half-stable leaves swing and the doorway is blocked while it is shut. It wins over the doorway's ask below, which shares its space (added after it).
    g.interaction.add({
      target: this.proxy(0, this.shape.halfLength + 0.02, this.shape.floor, HUT_INSIDE.doorHalf * 2 + 0.1, 1.75, 0.3),
      priority: 1,
      isAvailable: () => !g.player.isRiding,
      prompt: () => (this.door.isOpen ? 'Shut the door' : 'Open the door'),
      feedback: 'latch',
      interact: () => this.operateDoor(!this.door.isOpen, 'you'),
    });
  }

  /** Opens or shuts the door with a click of the latch. Returns whether it moved. */
  operateDoor(open, by) {
    if (!this.door.setOpen(open)) return false;
    if (by !== 'you') this.audio.latch(this.doorPos());
    if (by === 'her') this.shutWhenEmpty = false;
    return true;
  }

  doorPos() {
    const p = this.shape.toWorld(0, this.shape.halfLength);
    return { x: p.x, y: this.props.parts.ground + this.shape.floor + 1, z: p.z };
  }

  /** Puts the leaves and the doorway's collider where the door is now. */
  applyDoor() {
    const parts = this.props.parts;
    if (parts.topLeaf?.rotation) parts.topLeaf.rotation.y = this.door.angle;
    if (parts.lowerLeaf?.rotation) parts.lowerLeaf.rotation.y = this.door.angle;
    parts.doorCollider?.setEnabled?.(this.door.blocking);
  }

  /** Whether anyone is in or at the hut's doorway, for a girl to shut it behind her. */
  doorwayBusy() {
    const d = this.doorPos();
    return this.g.companions.some((c) => this.inside(c.root.position.x, c.root.position.z) || Math.hypot(c.root.position.x - d.x, c.root.position.z - d.z) < 2.2);
  }

  kettlePrompt() {
    const s = this.stove;
    if (!s.burning && !s.boiled) return { text: 'The kettle is cold: light the stove first' };
    if (!s.boiled) return { text: 'The kettle is coming up to the boil' };
    if (this.g.handsFull) return { text: 'Put down what you are holding to pour a mug of tea' };
    return { action: 'Pour a mug of tea', hold: true };
  }

  /** Holding E at the kettle. Returns whether something is happening. */
  pour(dt) {
    if (this.g.handsFull) return false;
    const r = this.stove.pouring(dt);
    if (!r) return false;
    this.pouring = true;
    this.view.setPour(this.stove.pour / this.params.pourSeconds);
    this.pourSound -= dt;
    if (this.pourSound <= 0) {
      this.pourSound = POUR_SOUND_EVERY;
      this.audio.pour(this.stovePos);
    }
    if (r === 'done') {
      this.view.setPour(0);
      this.haveTea();
    }
    return true;
  }

  /** The mug is poured and drunk: a toast, the bucket list, and any girl sat in the hut asks whether there is one for her. */
  haveTea() {
    const g = this.g;
    g.hud.toast('A mug of tea: hot, sweet and stewed. Just the thing', 3);
    g.achievements.note('hutTea');
    this.stay.noteTea();
    const seated = g.companions.find((c) => c.isResting && c.restPhase === 'sat' && this.spots.includes(c.restSpot));
    seated?.voice.say('hutTea', { force: true });
  }

  light(by) {
    if (!this.stove.light()) return false;
    this.audio.light(this.stovePos);
    if (by === 'you') this.g.achievements.note('hutLit');
    this.g.hud.toast(by === 'you' ? 'The stove catches' : 'She lights the stove', 2.4);
    return true;
  }

  stoke(by) {
    if (!this.stove.stoke()) return false;
    if (by === 'you') this.g.hud.toast('Another log on', 1.6);
    return true;
  }

  /** The girl you'd ask up: the nearest free one close enough, with a bunk place free. */
  hutGirl() {
    const g = this.g;
    if (!this.stay.seatsLeft(this.spots.length).length) return null;
    const near = g.companions
      .filter((c) => !this.stay.sessions.has(c.character.id) && c.root.position.distanceTo(g.player.position) <= this.stay.p.askRange)
      .filter((c) => c.availability({ asked: true }).free)
      .sort((a, b) => a.root.position.distanceTo(g.player.position) - b.root.position.distanceTo(g.player.position));
    return near[0] ?? null;
  }

  ask(girl = this.hutGirl()) {
    if (!girl) return false;
    const e = this.stay.begin(girl.character.id, 'asked', this.stay.seatsLeft(this.spots.length));
    if (!e) return false;
    this.handleEvent(e);
    return true;
  }

  /** What the girls' stay needs to know to suggest it: the weather and how far each girl is from the hut. */
  stayContext() {
    const g = this.g;
    const s = this.shape;
    return {
      seats: this.stay.seatsLeft(this.spots.length).length,
      rain: g.weather.rain,
      cold: coldness(g.weather.temperature),
      darkness: g.daylight?.darkness ?? 0,
      stoveWarm: this.stove.warm,
      girls: g.companions.map((c) => ({ id: c.character.id, free: c.availability().free, distance: Math.hypot(c.root.position.x - s.x, c.root.position.z - s.z) })),
    };
  }

  /** Offers for the chooser (game.js adds them to the girls' choices). */
  offers() {
    return this.active ? this.stay.offers(this.stayContext()) : [];
  }

  take(offer) {
    this.handleEvent(this.stay.take(offer, this.stay.seatsLeft(this.spots.length)));
  }

  /** Acts on the stay: she goes up the steps, speaks, lights the stove, puts a log on, gets up. */
  handleEvent(e) {
    if (!e) return;
    const g = this.g;
    const c = g.companions.find((o) => o.character.id === e.girl);
    if (!c) return this.stay.cancel(e.girl);
    if (e.type === 'go') {
      this.operateDoor(true, 'her');
      c.hold('hut', "sitting in the shepherd's hut");
      c.voice.say(e.how === 'offer' ? 'hutOffer' : 'hutYes', { force: true });
      if (!c.goRest(this.spots[e.seat], { stay: Infinity })) {
        c.release('hut');
        this.stay.cancel(e.girl);
      }
    } else if (e.type === 'say') {
      c.voice.say(e.line, { force: true });
    } else if (e.type === 'light') {
      this.light('her');
    } else if (e.type === 'stoke') {
      this.stoke('her');
    } else if (e.type === 'end') {
      this.operateDoor(true, 'her'); // shut with her inside, she opens it to go out
      this.shutWhenEmpty = true;
      c.release('hut');
      if (c.isResting) c.leaveRest();
      if (e.why === 'done') {
        const p = this.stay.p;
        g.favour.add(e.girl, p.favour + (g.favour.mood(e.girl) === 'favoured' ? p.romanceFavour : 0) + (e.teaWith ? p.teaFavour : 0));
        g.achievements.note('hutSat');
      }
    }
  }

  /** Whether (x, z) is inside the hut's walls: out of the weather and in its warmth when the stove is going. */
  inside(x, z) {
    return this.active && this.shape.inside(x, z, 0.05);
  }

  /** Whether a girl standing at (x, z) is warmed by the stove. */
  warmsAt(x, z) {
    if (!this.active) return false;
    if (!this.door.isOpen && !this.inside(x, z)) return false; // the heat comes out of the open top of the door
    return this.stove.warms(this.inside(x, z), Math.hypot(x - this.shape.stove.x, z - this.shape.stove.z));
  }

  /** The hut, every frame: the stove burns and draws itself, you may let go of the kettle, and the girls' stays go on. */
  update(dt) {
    if (!this.active) return;
    const g = this.g;
    const w = g.weather;
    const s = this.shape;
    if (!this.pouring) {
      this.stove.stopPouring();
      this.view.setPour(0);
    }
    this.pouring = false;
    for (const e of this.stove.update(dt)) {
      if (e.type === 'out' && Math.hypot(g.player.position.x - s.x, g.player.position.z - s.z) < 40) g.hud.toast('The stove has burnt out', 3);
    }
    if (this.shutWhenEmpty && !this.doorwayBusy()) {
      this.shutWhenEmpty = false;
      if (wantsShut({ rain: w.rain, darkness: g.daylight?.darkness ?? 0 }, this.params)) this.operateDoor(false, 'her');
    }
    this.door.update(dt);
    this.applyDoor();
    this.view.update(dt, this.stove, { wind: g.wind, darkness: g.daylight?.darkness ?? 0 });
    if (this.stove.glowing) this.audio.crackle(dt, this.stovePos, this.stove.heat);
    const girls = {};
    for (const c of g.companions) {
      const id = c.character.id;
      if (!this.stay.sessions.has(id)) continue;
      const seat = this.stay.seatOf(id);
      girls[id] = {
        free: c.availability({ asked: true, mine: 'hut' }).free,
        seated: c.isResting && c.restPhase === 'sat' && c.restSpot === this.spots[seat],
        youNear: Math.hypot(c.root.position.x - g.player.position.x, c.root.position.z - g.player.position.z) < this.stay.p.youRange,
        favoured: g.favour.mood(id) === 'favoured',
      };
    }
    const events = this.stay.update(dt, {
      rain: w.rain,
      cold: coldness(w.temperature),
      darkness: g.daylight?.darkness ?? 0,
      burning: this.stove.burning,
      fuel: this.stove.fuel,
      canStoke: this.stove.canStoke,
      girls,
    });
    for (const e of events) this.handleEvent(e);
  }

  debugLight() {
    if (!this.active) return;
    if (!this.stove.burning) this.stove.light();
    this.stove.heat = 1;
    this.stove.kettle = 1;
  }

  debugDoor(open) {
    if (this.active) this.operateDoor(open, 'her');
  }

  debugPutOut() {
    this.stove.reset();
  }

  describe() {
    const s = this.stove;
    return `${s.burning ? `burning, ${Math.round(s.fuel)} s of fuel` : s.glowing ? 'glowing' : 'cold'}, ${Math.round(s.heat * 100)}% hot, kettle ${s.boiled ? 'boiled' : `${Math.round(s.kettle * 100)}%`}, door ${this.door.isOpen ? 'open' : 'shut'}`;
  }
}

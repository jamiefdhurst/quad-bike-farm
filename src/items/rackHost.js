// The loads on the rear racks in the running game: a jerry can or the toolbox set on a farm quad's rack, the strap that holds it, what it
// takes off the quad, and the slide-off when it is loose (vehicle/rackLoad.js, items/rackStrap.js). game.js builds this as `this.rackLoads`,
// keeps the cans and the toolbox themselves on itself, and calls updateRackLoads() inside the frame guard.

import * as THREE from 'three';
import { registerTuning } from '../core/tuning.js';
import { CargoHold } from '../vehicle/cargoHold.js';
import { DEFAULT_RACK_PARAMS, RACK_PARAM_RANGES, RackLoad, rackEffect, slidePush } from '../vehicle/rackLoad.js';
import { looseDrive } from '../vehicle/looseThings.js';
import { buildRackStrap } from './rackStrap.js';

export class RackHost {
  constructor(game) {
    this.g = game;
    this.params = { ...DEFAULT_RACK_PARAMS };
    this.kits = [];
  }

  /** A quad with a rear rack that takes a load: the farm quads (not the tractor, the UTV, the Land Rovers or the cars). */
  hasRackForLoad(unit) {
    const s = unit.spec;
    return !!unit.quad.mugAnchor && !s.tractor && !s.utv && !s.landRover && !s.car;
  }

  /** Which sort of load a thing is for the rack, or null when it will not go on one. */
  rackKind(item) {
    return item === this.g.toolbox ? 'toolbox' : [this.g.petrolCan, this.g.premixCan, this.g.dieselCan].includes(item) ? 'can' : null;
  }

  /** Whether this can or the toolbox is standing on a rack. */
  onRack(item) {
    return this.kits?.some((k) => k.rack.item === item) ?? false;
  }

  /** What to call a thing on the rack in a prompt. */
  rackName(item) {
    return item === this.g.toolbox ? 'toolbox' : 'jerry can';
  }

  /** The key a strapped load is kept under in the save, or null. */
  rackSave(unit) {
    const kit = this.kits?.find((k) => k.unit === unit);
    if (!kit?.rack.strapped) return null;
    return ['petrolCan', 'premixCan', 'dieselCan', 'toolbox'].find((k) => this.g[k] === kit.rack.item) ?? null;
  }

  /**
   * A place on each rack-carrying quad's rear rack for a jerry can or the toolbox, and a ratchet strap to hold it (vehicle/rackLoad.js).
   * E with one in your hands sets it on the rack; with it there, a tap on E takes it off and holding E straps it down (or, strapped,
   * undoes the strap and takes it).
   */
  setUpRackLoads() {
    registerTuning('Rack loads', this.params, RACK_PARAM_RANGES);
    for (const unit of this.g.units) {
      if (!this.hasRackForLoad(unit)) continue;
      const quad = unit.quad;
      const anchor = new THREE.Object3D();
      anchor.name = 'rackLoadAnchor';
      anchor.position.copy(quad.mugAnchor.position);
      quad.mugAnchor.parent.add(anchor);
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
      proxy.position.y = 0.2;
      anchor.add(proxy);
      const hold = new CargoHold({
        scene: this.g.scene,
        ground: (x, z) => this.g.world.heightAt(x, z),
        anchors: [anchor],
        yawFor: (item) => (item === this.g.toolbox ? 0 : Math.PI / 2),
      });
      const kit = { unit, quad, anchor, hold, rack: new RackLoad(this.params), strap: null, touched: false, prev: null };
      this.kits.push(kit);
      this.g.interaction.add({
        target: proxy,
        priority: 2, // over a can or the toolbox standing on it, whose own box would otherwise be hit first
        isAvailable: () => !this.g.player.isRiding && !quad.isTipped && (kit.rack.loaded || !!this.rackKind(this.g.heldLoad())),
        prompt: () => this.rackPrompt(kit),
        feedback: () => (kit.rack.loaded ? 'own' : 'putDown'), // the strap has its own click
        interact: () => this.rackPress(kit),
        hold: (dt) => {
          kit.touched = true;
          const done = kit.rack.hold(dt);
          if (done) this.rackDone(kit, done);
          return false;
        },
      });
      // A strapped load kept in the save is back on its rack.
      const key = this.g.farm.save?.vehicles?.[unit.id]?.rack;
      const item = ['petrolCan', 'premixCan', 'dieselCan', 'toolbox'].includes(key) ? this.g[key] : null;
      if (item && !item.held && !this.onRack(item)) {
        this.rackPut(kit, item);
        kit.rack.strapped = true;
        this.rackShowStrap(kit);
      }
    }
  }

  /** Debug panel and console: put the can or toolbox on this quad's rack (loose), strap or unstrap what is there, or clear the rack. */
  debugRack(unit, what) {
    const kit = this.kits?.find((k) => k.unit === unit);
    if (!kit) return 'it has no rack for a load';
    const { rack } = kit;
    if (what === 'clear') {
      if (!rack.loaded) return 'nothing on the rack';
      const item = rack.clear();
      this.rackHideStrap(kit);
      this.rackWeigh(kit);
      item.putDown(item.model.getWorldPosition(new THREE.Vector3()), 0); // down on the ground where it stood
      return 'rack cleared';
    }
    if (what === 'strap') {
      if (!rack.loaded) return 'nothing on the rack to strap';
      rack.strapped = !rack.strapped;
      rack.slide = 0;
      if (rack.strapped) this.rackShowStrap(kit);
      else this.rackHideStrap(kit);
      return rack.strapped ? 'strapped down' : 'strap undone';
    }
    const item = what === 'toolbox' ? this.g.toolbox : this.g.petrolCan;
    if (rack.loaded) return 'the rack is taken';
    if (item.held || this.onRack(item)) return `the ${this.rackName(item)} is in your hands or on another rack`;
    this.rackPut(kit, item);
    return `${this.rackName(item)} on the rack`;
  }

  /** For the panel and console: what is on this quad's rack. */
  rackSummary(unit) {
    const kit = this.kits?.find((k) => k.unit === unit);
    if (!kit) return 'no rack for a load';
    const { rack } = kit;
    if (!rack.loaded) return 'empty';
    return `${this.rackName(rack.item)}, ${rack.strapped ? 'strapped' : `loose (slide-off ${rack.slide.toFixed(2)})`}, ${rack.kg} kg`;
  }

  rackPrompt(kit) {
    const { rack } = kit;
    const held = this.g.heldLoad();
    if (!rack.loaded) return `Put the ${this.rackName(held)} on the rack`;
    const what = this.rackName(rack.item);
    if (Object.values(this.g.teaMugs).some((m) => m.parent === kit.quad.mugAnchor)) return { text: 'There is tea on the rack' };
    if (this.g.handsFull) return { text: `The ${what} is on the rack   ·   G put what you are holding down` };
    if (rack.strapped) return { text: `Hold E to undo the strap and take the ${what}` };
    return { text: `Hold E to strap the ${what} down`, keys: [['E', 'Tap to take it off']] };
  }

  /** E pressed on a rack: a load in your hands goes on, one already there starts a tap or a hold. */
  rackPress(kit) {
    if (!kit.rack.loaded) {
      const item = this.g.heldLoad();
      const kind = this.rackKind(item);
      if (kind && !Object.values(this.g.teaMugs).some((m) => m.parent === kit.quad.mugAnchor)) this.rackPut(kit, item);
      return;
    }
    if (!this.g.handsFull) kit.rack.press();
  }

  /** Draws every part of a load again: the far-detail pass left some out while it stood somewhere far off, and no longer looks at it once it is on a rack. */
  rackShow(item) {
    item.model.traverse((o) => o.layers.set(0));
  }

  /** Stands a held can or the toolbox on the rack, loose. */
  rackPut(kit, item) {
    this.rackShow(item);
    kit.hold.load(item);
    kit.rack.put(item, this.rackKind(item));
    kit.prev = null;
    this.rackWeigh(kit);
  }

  /** What the load takes off the quad (and the nothing it takes when the rack is bare). */
  rackWeigh(kit) {
    const kg = kit.rack.kg;
    Object.assign(kit.quad.rackLoad, { kg, ...rackEffect(kg, this.params) });
  }

  rackShowStrap(kit) {
    this.rackHideStrap(kit);
    kit.strap = buildRackStrap(kit.rack.kind);
    kit.anchor.add(kit.strap);
    const m = kit.rack.item.model;
    delete m.userData.loose; // righted, and straight, under the strap
    m.position.set(0, 0, 0);
    m.rotation.set(0, kit.hold.yawFor(kit.rack.item), 0);
  }

  rackHideStrap(kit) {
    if (kit.strap) kit.anchor.remove(kit.strap);
    kit.strap = null;
  }

  /** Takes the load off the rack into your hands. */
  rackTake(kit) {
    const item = kit.rack.clear();
    this.rackHideStrap(kit);
    this.rackWeigh(kit);
    if (!item) return;
    this.rackShow(item);
    item.pickUp(this.g.camera);
  }

  /** The hold on a rack finished: the strap is tight, or undone with the load taken. */
  rackDone(kit, what) {
    this.g.audioHub.useCue('latch');
    if (what === 'strapped') {
      this.rackShowStrap(kit);
    } else {
      this.rackTake(kit);
      this.g.audioHub.useCue('pickUp');
    }
  }

  updateRackLoads(dt, input) {
    for (const kit of this.kits ?? []) {
      const { rack, quad } = kit;
      kit.hold.update(dt);
      // Let go of E, or looked away, or the quad has gone: the press ends.
      if (rack.pressing) {
        if (!input.isDown('KeyE')) {
          if (rack.release() === 'takeOff' && !this.g.handsFull) {
            this.rackTake(kit);
            this.g.audioHub.useCue('pickUp');
          }
        } else if (!kit.touched && rack.pressed > 0) {
          rack.cancel();
        }
      }
      if (Math.abs(quad.speed) > 1) rack.cancel();
      kit.touched = false;
      if (!rack.loaded) continue;
      // How hard the quad is shoving the load: its slowing, its bounce, its shake.
      const y = quad.position.y;
      let long = 0;
      let vert = 0;
      if (kit.prev && dt > 0) {
        long = (quad.speed - kit.prev.speed) / dt;
        const vy = (y - kit.prev.y) / dt;
        vert = (vy - kit.prev.vy) / dt;
        kit.prev.vy = vy;
      } else kit.prev = { vy: 0 };
      kit.prev.speed = quad.speed;
      kit.prev.y = y;
      long = Math.max(-40, Math.min(40, long));
      vert = Math.max(-80, Math.min(80, vert));
      if (rack.strapped) continue;
      this.g.updateLooseBed(kit.hold, quad, dt);
      const shake = quad.unit?.vibration?.intensity ?? 0;
      if (rack.update(dt, slidePush(looseDrive(shake, this.g.loose.p), long, vert, this.params)) === 'slid') {
        const back = new THREE.Vector3(0, 0, -1).applyQuaternion(quad.model.getWorldQuaternion(new THREE.Quaternion()));
        back.y = 0;
        kit.hold.tipOut(back.normalize());
        rack.clear();
        this.rackWeigh(kit);
        this.g.audioHub.useCue('putDown');
      }
    }
  }
}

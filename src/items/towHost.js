// The winch, the tow rope and the tow chain in the running game: the debug buttons that hook them on, what takes them out of your hand,
// and the trunk you look at with the winch hook (items/winch.js, towRope.js, chain.js, winchAnchor.js). game.js builds this as `this.towing`,
// keeps the three items themselves on itself, and calls updateWinch(), updateChain() and updateTowRope() inside the frame guard.

import * as THREE from 'three';
import { pickTree } from './winchAnchor.js';

export class TowHost {
  constructor(game) {
    this.g = game;
  }

  /** The debug panel's winch button: the green's winch onto this vehicle (or, on the green itself, onto the nearest tree), or off again. */
  debugWinch(unit) {
    const w = this.g.winch;
    if (!w) return 'No winch in this game';
    const onIt = unit === w.unit ? !!w.anchor : w.target === unit.quad;
    if (w.state === 'hooked' && onIt) {
      w.stow();
      return 'Winch off';
    }
    w.stow();
    w.take(this.g.camera);
    if (unit !== w.unit) {
      w.hookOn(unit.quad);
      return `Winch hooked on the ${unit.label}${w.selfPull ? `: the ${w.unit.label} pulls itself up to it` : ''}`;
    }
    const at = w.quad.position;
    const tree = w.anchors.map((a) => ({ a, d: Math.hypot(a.x - at.x, a.z - at.z) })).sort((p, q) => p.d - q.d)[0];
    if (!tree || tree.d > 30) {
      w.stow();
      return 'No tree within 30 m';
    }
    w.hookTree(tree.a);
    return `Winch hooked on a tree ${Math.round(tree.d)} m away`;
  }

  /** The debug panel's tow rope button: hook the rope from the nearest utility quad onto this vehicle, or take it off again. */
  debugTowRope(unit) {
    const r = this.g.towRope;
    if (r.state === 'hooked' && r.target === unit.quad) {
      r.stow();
      return 'Tow rope off';
    }
    const near = this.g.units
      .filter((u) => u !== unit && this.ropeQuadFor(u))
      .map((u) => ({ u, d: u.quad.position.distanceTo(unit.quad.position) }))
      .sort((a, b) => a.d - b.d)[0];
    if (!near || near.d > 8) return 'No utility quad within 8 m to tow it with';
    r.stow();
    r.take(this.g.camera, near.u.quad);
    r.hookOn(unit.quad);
    return `Tow rope from the ${near.u.label} to the ${unit.label}`;
  }

  /** A quad that carries the tow rope on its rack: a utility quad, not the green (its X is the winch) and not the tractor or the Land Rover. */
  ropeQuadFor(unit) {
    return !!unit && unit !== this.g.winch?.unit && !unit.spec.tractor && !unit.spec.landRover && !unit.spec.car && !unit.spec.utv && !!unit.quad.mugAnchor;
  }

  /** The tow rope: it comes out of your hand if you go further than it reaches, or when you get on something; a snatch makes her on the dead quad shout. */
  updateTowRope() {
    const r = this.g.towRope;
    if (r.state === 'carried' && this.g.player.isRiding) r.stow();
    if (r.state === 'carried' && r.distanceFrom(this.g.player.position) > r.params.reach) {
      r.stow();
      this.g.hud.toast('The rope won\'t reach any further: the hook pulled out of your hand');
    }
    r.update();
    for (const e of r.events.splice(0)) {
      const girl = this.g.companions.find((c) => c.fsm.is('driving') && c.quad === r.target && c.drive?.towing);
      if (girl && e === 'snatch') girl.driveEvents.push('snatch');
    }
  }

  /** The tow chain: it comes out of your hand if you go further than it reaches, or when you get on something. */
  updateChain() {
    const c = this.g.chain;
    if (!c) return;
    if (c.state === 'carried' && this.g.player.isRiding) c.stow();
    if (c.state === 'carried' && c.distanceFrom(this.g.player.position) > c.params.length) {
      c.stow();
      this.g.hud.toast('The chain won\'t reach any further: the hook pulled out of your hand');
    }
    c.update();
  }

  /** The winch: the cable's reach, and winding in while X is held by the green (or on it). */
  updateWinch(dt = 0) {
    const w = this.g.winch;
    if (!w) return;
    if (w.state === 'carried' && this.g.player.isRiding) w.stow();
    if (w.state === 'carried' && w.distanceFrom(this.g.player.position) > w.params.length) {
      w.stow();
      this.g.hud.toast('The winch cable won\'t reach any further: the hook pulled out of your hand');
    }
    const onIt = this.g.boardUnit === w.unit;
    const near = !this.g.player.isRiding && w.distanceFrom(this.g.player.position) < w.params.remoteReach;
    this.g.winchReel = w.state === 'hooked' && (onIt || near) && !this.g.menu.isOpen && this.g.input.isDown('KeyX');
    w.update(dt);
  }

  /** The trunk you are looking at while you hold the winch hook (or have it on a tree), if any. */
  winchTreeLooked() {
    const w = this.g.winch;
    if (!w || this.g.player.isRiding || !(w.state === 'carried' || w.anchor)) return null;
    const origin = this.g.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.g.camera.getWorldDirection(new THREE.Vector3());
    return pickTree(w.anchors, origin, dir, 6);
  }
}

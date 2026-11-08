// The hand tools and bottles in the running game: putting each down in front of you, the jump leads, the bench's places for what you
// carry, the oil dipstick and the tank dip, and pouring coolant or anti-gel (items/jerryCan.js, toolbox.js, jumpLeads.js, oilBottle.js,
// coolantBottle.js, antiGelBottle.js, feedBucket.js). game.js builds this as `this.tools`, keeps the items themselves on itself, and
// calls updateOilChecks() inside the frame guard.

import * as THREE from 'three';
import { BOOSTER_ID } from './boosterPack.js';
import { pourStep } from './coolantBottle.js';
import { doseStep } from './antiGelBottle.js';
import { levelText } from '../engine/coolant.js';
import { bowlNeedsDraining } from '../npc/girlControls.js';
import { walkRound } from '../npc/walkRound.js';
import { WONT_LINE } from '../npc/wontRide.js';
import { readStick } from '../vehicle/sump.js';
import { readTank, dipMessage, gaugeLies } from '../vehicle/tankDip.js';
import { featuresOf } from '../vehicle/quirks.js';

export class ToolsHost {
  constructor(game) {
    this.g = game;
  }

  /** Puts a held item on the ground just behind where you face, turned by `turn` (the can lies across). */
  putInFront(item, turn = 0) {
    const p = this.g.player.position;
    const yaw = this.g.player.yaw;
    item.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw + turn);
  }

  /** Puts the jerry can on the ground just in front of the player. */
  putCanDown() {
    this.putInFront(this.g.can, Math.PI / 2);
  }

  /**
   * Stood looking at a four-stroke: Y pulls the dipstick and says where the oil is; holding it near the oil bottle (by the petrol tank)
   * pours some in, up to the top mark.
   */
  dipstick(unit, input, dt) {
    const sump = unit.quad.sump;
    if (!sump) {
      if (input.wasPressed('KeyY') && !unit.quad.engine.params.tickler) this.g.hud.toast('A two-stroke has no dipstick: its oil goes in with the petrol'); // (Y is the old bike's tickler)
      return;
    }
    if (input.wasPressed('KeyY')) {
      this.yHeld = 0;
      const { text } = readStick(sump.level, Math.random() * 2 - 1, this.g.sumpParams);
      sump.checked = true;
      this.g.achievements.note('dipstick');
      this.g.hud.toast(`Dipstick: ${text}${sump.low ? '. Hold Y beside the oil bottle to top it up' : sump.tooMuch ? '. Hold Y away from the bottle to let some out at the drain plug' : ''}`, 3);
      return;
    }
    if (!input.isDown('KeyY')) {
      this.yHeld = 0;
      return;
    }
    this.yHeld = (this.yHeld ?? 0) + dt;
    if (this.yHeld < 0.5) return;
    const bottle = this.g.oilBottle.worldPosition();
    const q = unit.quad.position;
    if (Math.hypot(q.x - bottle.x, q.z - bottle.z) > this.g.sumpParams.bottleRange) {
      // Too much in: away from the bottle, holding the key lets it out at the drain plug, down to the line.
      if (sump.tooMuch || sump.level > 1) {
        sump.drain(dt);
        this.g.hud.setStatus(`Letting oil out at the drain plug: ${readStick(sump.level, 0, this.g.sumpParams).text}`);
      } else if (this.yHeld < 0.6) this.g.hud.toast('The oil bottle is by the petrol tank: pick it up and bring it here', 2.5);
      return;
    }
    if (sump.pour(dt) > 0) {
      this.g.achievements.note('oilPoured');
      this.g.hud.setStatus(`${sump.level > 1 ? 'Too much oil' : 'Topping up the oil'}: ${readStick(sump.level, 0, this.g.sumpParams).text}`);
    } else if (this.yHeld < 0.6) this.g.hud.toast('As full as it will hold');
  }

  /** What a dip of this quad's tank shows: the stick's reading and whether it has a fuel gauge to compare with (null: none to show). */
  tankDipOf(unit) {
    const f = unit.quad.fuel;
    const reading = readTank({ litres: f.litres, capacity: f.params.tankCapacity, reserve: f.params.noTap ? 0 : f.params.reserveLitres, noise: Math.random() * 2 - 1 }, this.g.dipParams);
    const hasGauge = featuresOf(unit.spec, !!unit.quad.pod).fuelGauge;
    return { reading, shown: hasGauge ? unit.quad.shownFuel : null };
  }

  /**
   * Stood looking at a quad: U puts a stick down the tank and says what is really in it, and whether the gauge agrees. If Amy is near
   * enough to see it, a gauge that is off goes in her logbook.
   */
  dipTank(unit) {
    const { reading, shown } = this.tankDipOf(unit);
    this.g.audioHub.useCue('latch');
    this.g.hud.toast(dipMessage(reading, shown, this.g.dipParams), 3.5);
    const quirk = ['fuelSticks', 'fuelHigh'].find((k) => unit.quad.quirks.has(k));
    if (quirk && shown !== null && gaugeLies(shown, reading.share, this.g.dipParams)) this.g.notebook.note(unit, { kind: 'quirk', quirk });
  }

  /**
   * Amy walks round a quad before she rides it: squeezes the tyres, looks it over and checks the dipstick, and tops it up if it wants some,
   * saying what she finds. Jess goes straight to the starter. Once per ride. `c.walkFound` keeps what she found, for the girls to act on later.
   */
  updateOilChecks() {
    for (const c of this.g.companions) {
      const driving = c.fsm.is('driving');
      if (!driving) {
        c.oilChecked = null;
        continue;
      }
      if (!c.quad || c.oilChecked === c.quad) continue;
      c.oilChecked = c.quad;
      c.walkFound = [];
      const driven = this.g.units.find((u) => u.quad === c.quad);
      if (c.character.id !== 'amy') continue;
      if (Math.random() < this.g.walkParams.amyWalks) {
        c.walkFound = walkRound({ tyres: c.quad.tyres, faults: c.quad.faults }, this.g.walkParams);
        if (driven) c.knows.learn(driven.spec.id, c.walkFound);
        const refused = driven ? c.wontRide(c.quad) : null;
        if (refused && !this.g.eventOn()) {
          // Not on that: she says why instead of the usual remark, pulls up and gets off.
          c.voice.say(WONT_LINE[refused], { urgent: true, chance: 1 });
          c.requestStandBeside(c.quad);
          if (driven) for (const finding of c.walkFound) this.g.notebook.note(driven, { kind: 'walk', finding }, { saw: true });
          continue;
        } else {
          c.walkFound.forEach((key, i) => c.voice.say(key, { urgent: i === 0, chance: 1 }));
        }
        if (driven) for (const finding of c.walkFound) this.g.notebook.note(driven, { kind: 'walk', finding }, { saw: true });
      }
      if (driven && !c.walkFound.length && this.amyDipsTank(c, driven)) continue;
      if (driven && bowlNeedsDraining(c.quad.fuel)) {
        c.quad.fuel.drainSediment(); // she opens the drain on the tap's bowl and shuts it again
        c.voice.say('bowlDrained', { urgent: true, chance: 1 });
        continue;
      }
      const sump = c.quad.sump;
      if (!sump || Math.random() > this.g.sumpParams.amyChecks) continue;
      if (sump.tooMuch) {
        sump.drain(1e6); // she has the drain plug out and back in without ceremony
        c.voice.say('oilOver', { urgent: true, chance: 1 });
        if (driven) this.g.notebook.note(driven, { kind: 'oil' }, { saw: true });
      } else if (sump.level < this.g.sumpParams.minMark + this.g.sumpParams.amyTopUpMargin) {
        sump.fill();
        c.voice.say('oilTopUp', { urgent: true, chance: 1 });
        if (driven) this.g.notebook.note(driven, { kind: 'oil' }, { saw: true });
      } else if (!c.walkFound.length) {
        c.voice.say('oilFine', { chance: 0.35 });
      }
    }
  }

  /**
   * Amy dips the tank of a quad whose gauge she knows lies, before she rides it, and says what she finds. Returns true if she did,
   * which is her remark for the walk-round. She writes it up as she does the oil.
   */
  amyDipsTank(c, unit) {
    const quirk = ['fuelSticks', 'fuelHigh'].find((k) => c.voice.knowsQuirk(unit, k));
    if (!quirk || Math.random() > this.g.dipParams.amyDips) return false;
    const { reading, shown } = this.tankDipOf(unit);
    if (shown === null) return false;
    c.voice.say(reading.low ? 'tankDipLow' : gaugeLies(shown, reading.share, this.g.dipParams) ? 'tankDipLies' : 'tankDipFine', { urgent: true, chance: 1 });
    if (unit.quad.quirks.has(quirk)) this.g.notebook.note(unit, { kind: 'quirk', quirk }, { saw: true });
    return true;
  }

  /** E on a quad with the jump leads in hand. */
  clampLeads(quad) {
    this.g.achievements.note('leads');
    const result = this.g.leads.clamp(quad);
    if (result === 'first') this.g.hud.toast('Clamped on. Now the other end on a running quad');
    else if (result === 'joined') this.g.hud.toast('Leads on: a running quad charges a flat one. Keep them close, nose to nose');
  }

  putLeadsDown() {
    this.putInFront(this.g.leads);
  }

  /** The toolbox, jump leads or oil bottle in your hands, which the workbench has a place for: { name, item, spot }, or null. */
  benchItem() {
    const L = this.g.world.layout;
    if (this.g.toolbox.held) return { name: 'toolbox', item: this.g.toolbox, spot: L.toolbox };
    if (this.g.leads.held) return { name: 'jump leads', item: this.g.leads, spot: L.benchLeads };
    if (this.g.power.heldBattery()?.unitId === BOOSTER_ID) return { name: 'booster pack', item: this.g.power.heldBattery(), spot: L.benchPack };
    if (this.g.oilBottle.held) return { name: 'oil bottle', item: this.g.oilBottle, spot: L.benchOil };
    return null;
  }

  /** E at the workbench with the toolbox or the leads in your hands: back in their place on top of it. */
  putOnBench({ item, spot }) {
    item.putDown(new THREE.Vector3(spot.x, 0, spot.z), spot.yaw);
    item.model.position.y += this.g.world.layout.bench.height;
  }

  putCoolantBottleDown() {
    this.putInFront(this.g.coolantBottle);
  }

  /** Holding E looking at a vehicle with the coolant bottle in your hands: tops the radiator up, then flushes a stuck thermostat free (items/coolantBottle.js). True while it pours. */
  coolantTopUp(unit, dt) {
    const e = unit.engine;
    const how = pourStep(e, dt, this.g.coolantBottle.params);
    this.g.eHeld = (this.g.eHeld ?? 0) + dt;
    if (how === 'pouring') this.g.hud.setStatus(`Topping up the coolant: ${levelText(e.coolant)}`);
    else if (how === 'flushing') this.g.hud.setStatus('Flushing coolant through the engine');
    else if (how === 'freed') this.g.hud.toast('Flushed right through: the thermostat has freed up', 3);
    else if (this.g.eHeld < 0.6) {
      this.g.hud.toast(how === 'air' ? 'No radiator: that one is air-cooled' : how === 'hot' ? 'Too hot to open the cap: switch it off and let it cool' : 'The radiator is full', 2.5);
    }
    return how === 'pouring' || how === 'flushing';
  }

  putAntiGelBottleDown() {
    this.putInFront(this.g.antiGelBottle);
  }

  /** Holding E looking at a vehicle with the anti-gel in your hands: doses a diesel's tank (items/antiGelBottle.js). True while it pours. */
  antiGelDose(unit, dt) {
    const q = unit.quad;
    const how = doseStep(q.fuel, unit.engine, dt, this.g.antiGelBottle.params);
    this.g.eHeld = (this.g.eHeld ?? 0) + dt;
    if (how === 'pouring') this.g.hud.setStatus(`Treating the diesel: ${Math.round(q.fuel.antiGel * 100)}% of the tank`);
    else if (this.g.eHeld < 0.6) {
      this.g.hud.toast(how === 'petrol' ? 'That runs on petrol: it never waxes' : how === 'empty' ? 'Nothing in the tank to treat' : 'The tank is already treated', 2.5);
    }
    return how === 'pouring';
  }

  putOilBottleDown() {
    this.putInFront(this.g.oilBottle);
  }

  putToolboxDown() {
    this.putInFront(this.g.toolbox);
  }

  putFeedBucketDown() {
    this.putInFront(this.g.feedBucket);
  }
}

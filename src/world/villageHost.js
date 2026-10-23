// The village in the running game: what you can buy there, the draw distance and the glow after dark. The shapes are world/village.js's, the drawing
// villageProps.js's and the buying world/villageShop.js's; game.js builds this and calls update() inside the frame guard. The debug panel and the
// console use the debug* methods.

import * as THREE from 'three';
import { distanceToTile } from './tiles.js';
import { PARTS } from '../workshop/spares.js';
import { registerTuning } from '../core/tuning.js';
import { DEFAULT_VILLAGE_PARAMS, VILLAGE_PARAM_RANGES, SHOP_STOCK, PUMP_FUELS, GARAGE_PARTS, partWhyNot, buyPart, Till, PumpBill, pounds } from './villageShop.js';

export class VillageHost {
  constructor(game) {
    this.g = game;
    this.props = game.world.props.village ?? null;
    this.active = !!this.props;
    this.params = { ...DEFAULT_VILLAGE_PARAMS };
    if (!this.active) return;
    registerTuning('Village', this.params, VILLAGE_PARAM_RANGES);
    this.till = new Till();
    this.bill = new PumpBill();
    this.filling = null; // the pump being filled from, while E is held
    this.centre = new THREE.Vector3(150, 0, 185);
    this.lastBought = 'nothing yet';
    this.addTargets();
  }

  purseText() {
    return `£${this.g.market.purse.toLocaleString('en-GB')} in the tin`;
  }

  addTargets() {
    const g = this.g;
    for (const pump of this.props.pumpProxies) {
      const fuel = PUMP_FUELS[pump.fuel];
      g.interaction.add({
        target: pump.mesh,
        prompt: () => {
          const price = this.params[fuel.price];
          if (!g.can.held) return { text: `${fuel.label[0].toUpperCase()}${fuel.label.slice(1)}, ${pounds(price)} a litre: bring a jerry can to fill it` };
          if (g.can.space < 0.01) return { text: 'The jerry can is full' };
          if (this.bill.allow(0.1, price, g.market) < 0.1) return { text: `You can't pay for any more (${this.purseText()})` };
          return { text: `Hold E to fill the jerry can with ${fuel.label} (${g.can.litres.toFixed(1)} / ${g.can.params.capacity} L, ${pounds(price)} a litre, ${this.purseText()})` };
        },
        interact: () => {},
        hold: (dt) => this.pour(pump, dt),
      });
    }
    for (const part of this.props.partProxies) {
      g.interaction.add({
        target: part.mesh,
        isAvailable: () => !g.handsFull && !g.player.isRiding,
        prompt: () => {
          const name = this.partName(part.id);
          const why = partWhyNot(part.id, g.market.purse, g.spares, this.params, name);
          if (why) return { text: why };
          return { text: `Buy a ${name}: ${pounds(this.params[GARAGE_PARTS[part.id].price])} (${g.spares.count(part.id)} on the rack at the barn, ${this.purseText()})` };
        },
        interact: () => this.buyPart(part.id),
      });
    }
    for (const stock of this.props.shopProxies) {
      g.interaction.add({
        target: stock.mesh,
        isAvailable: () => !g.handsFull && !g.player.isRiding,
        prompt: () => {
          const item = SHOP_STOCK[stock.id];
          const why = this.till.whyNot(stock.id, g.market.purse, this.params);
          if (why) return { text: why };
          return { text: `Buy ${item.label}: ${pounds(this.params[item.price])} (${this.purseText()})` };
        },
        interact: () => this.buy(stock.id),
      });
    }
  }

  /** The garage's rack: what a part is called in the shelf's own words ("spark plug"). */
  partName(id) {
    return PARTS[id].one;
  }

  /** Buys one part at the garage: the tin pays and it goes on the barn's rack. */
  buyPart(id) {
    const g = this.g;
    const name = this.partName(id);
    const got = buyPart(id, g.market, g.spares, this.params, name);
    if (!got) return g.hud.toast(partWhyNot(id, g.market.purse, g.spares, this.params, name) ?? 'Not now', 2);
    this.lastBought = `a ${name} (${pounds(got.price)})`;
    g.sparesShelf.paintCrates();
    g.hud.toast(`A ${name}: ${pounds(got.price)}. It's on the rack at the barn. ${this.purseText()}`, 3);
  }

  /** One frame of E held at a pump with a can in your hands: fill what the tin can pay for, and bill it. */
  pour(pump, dt) {
    const g = this.g;
    const can = g.can;
    if (!can.held) return false;
    const fuel = PUMP_FUELS[pump.fuel];
    const price = this.params[fuel.price];
    if (this.filling !== pump) {
      this.filling = pump;
      this.bill.begin();
    }
    const want = this.bill.allow(can.params.fillRate * dt, price, g.market);
    if (want <= 0) return false;
    const added = can.fill(want, 0, fuel.diesel);
    if (added <= 0) return false;
    this.bill.charge(added, price, g.market);
    return true;
  }

  /** Buys at the shop's counter: the tin pays, the girls like it (favour) and a pasty warms them. */
  buy(item) {
    const g = this.g;
    const got = this.till.buy(item, g.market, this.params);
    if (!got) return g.hud.toast(this.till.whyNot(item, g.market.purse, this.params) ?? 'Not now', 2);
    for (const c of g.companions) {
      g.favour.add(c.character.id, got.favour);
      if (got.warmth) c.needs.warmth = Math.max(0, c.needs.warmth - got.warmth);
    }
    this.lastBought = `${SHOP_STOCK[item].label} (${pounds(got.price)})`;
    g.hud.toast(`${SHOP_STOCK[item].label[0].toUpperCase()}${SHOP_STOCK[item].label.slice(1)}: ${pounds(got.price)}. ${this.purseText()}`, 3);
  }

  update(dt) {
    if (!this.active) return;
    this.till.update(dt);
    const g = this.g;
    if (this.filling && !g.interaction.focused) this.filling = null;
    const dark = g.daylight?.darkness ?? 0;
    this.props.setNight(dark);
    const p = g.player.position;
    this.props.group.visible = distanceToTile(g.world.layout.village.area, p.x, p.z) < this.params.drawDistance;
  }

  /** Puts you on foot at the pub, the shop or the garage (the debug panel and the console). False if you are riding or there is no village. */
  debugGoTo(where = 'pub') {
    if (!this.active || this.g.player.isRiding) return false;
    const s = this.props.shape;
    const spots = {
      pub: { x: s.pubStop.x, z: s.pubStop.z },
      shop: { x: s.shop.x + 1.5, z: s.shop.outer.maxZ + 2.2 },
      garage: { x: s.v.garage.pumps.xs[1], z: s.v.garage.pumps.z + 1.6 },
      parts: { x: s.v.garage.x + 0.6, z: s.v.garage.z - s.v.garage.halfZ - 1.4 }, // the garage faces -z (yaw PI): its rack is 0.6 m west of the middle
    };
    const at = spots[where] ?? spots.pub;
    this.g.player.moveTo({ x: at.x, y: this.g.world.groundHeightAt(at.x, at.z), z: at.z });
    return true;
  }

  describe() {
    if (!this.active) return 'no village on this farm';
    const s = this.props.shape;
    return `${s.name}: ${s.limit} mph, last bought ${this.lastBought}; petrol ${pounds(this.params.petrolPrice)}/L, diesel ${pounds(this.params.dieselPrice)}/L`;
  }
}

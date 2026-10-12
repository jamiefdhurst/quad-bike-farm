// Jess's dares. Now and then, when she's free and you're within earshot, she dares you to do something daft: jump the ramp, take the ford
// flat out, touch the electric fence, ride the mini moto down the steepest bank (an offer, chooser.js). You just do it: no key to accept.
// Do it within `dareSeconds` and she's delighted (favour with her, a little less with Amy, who says what she thinks); let it lapse and she
// teases you for chickening out. Pure: the game says what you are doing each frame and does the talking, favour and bucket list.

export const DARE_KINDS = {
  ramp: { label: 'jump the ramp' },
  ford: { label: 'take the ford flat out' },
  fence: { label: 'touch the electric fence' },
  bank: { label: 'ride the mini moto down the steepest bank' },
};

export const DEFAULT_DARE_PARAMS = {
  startAfter: 150, // seconds into the game before she thinks of it
  weight: 0.7, // how keen she is (times her own dareWeight, and weighed against everything else she could do, chooser.js)
  cooldown: 420, // seconds after one ends before she dares you again (you can still ask from the debug panel)
  hearRange: 22, // metres: she dares you from this close, so you can hear her
  dareSeconds: 120, // how long you have to do it before she calls you chicken
  rampNear: 30, // metres from the ramp's lip that a jump counts as off the ramp
  rampMinAir: 0.5, // seconds in the air for it to count as a jump
  fordSpeed: 8, // m/s through the ford for it to count as flat out
  bankDrop: 4, // metres you have to come down the bank, on the mini moto and upright
  bankMinSpeed: 1.5, // m/s: rolling, not sitting there
  fellWithin: 8, // seconds after you've done it that a tumble still has Amy worried
  favourWin: 2, // favour from Jess for doing it
  favourAmy: -0.5, // and what Amy thinks of your doing it
};

export const DARE_PARAM_RANGES = {
  startAfter: [0, 900, 10],
  weight: [0, 3, 0.05],
  cooldown: [0, 1800, 10],
  hearRange: [5, 60, 1],
  dareSeconds: [20, 600, 5],
  rampNear: [5, 60, 1],
  rampMinAir: [0.1, 2, 0.05],
  fordSpeed: [3, 16, 0.5],
  bankDrop: [1, 6, 0.25],
  bankMinSpeed: [0.5, 8, 0.25],
  fellWithin: [0, 30, 1],
  favourWin: [0, 10, 0.1],
  favourAmy: [-5, 0, 0.1],
};

/** The steepest of the pasture's banks (the one that rises most for its width) as a box to ride down: { minX, maxX, minZ, maxZ, rise }. Clear of the gentle east end. */
export function steepestBank(hill) {
  let best = null;
  for (const b of hill.banks) if (!best || b.rise / b.width > best.rise / best.width) best = b;
  const base = hill.stream.z + hill.stream.halfWidth + best.at;
  const m = hill.stream.wander + 1.5; // the bank wanders with x
  return { minX: hill.pasture.minX, maxX: hill.gentle.fromX, minZ: base - best.width / 2 - m, maxZ: base + best.width / 2 + m, rise: best.rise };
}

export class Dares {
  /** @param {object} bank  steepestBank() of the layout. */
  constructor(bank, p = { ...DEFAULT_DARE_PARAMS }, random = Math.random) {
    this.p = p;
    this.bank = bank;
    this.random = random;
    this.clock = 0;
    this.cooldownUntil = 0;
    this.active = null; // { girl, kind, left, fell }
    this.after = null; // just done: { girl, kind, left } (a tumble still counts)
    this.last = null; // the kind she dared last, so it is not the same twice running
    this.air = null; // { time, near } while you are in the air (the ramp)
    this.top = null; // the highest you have been on the bank, on the moto
    this.zapped = false; // you caught the fence since the last update
  }

  /** The fence caught you (or the quad you are on). */
  zap() {
    this.zapped = true;
  }

  /** What she'd dare, per free girl in earshot: [{ key: 'dare', girl, kind, weight }]. `ctx`: { kinds: the dares that could be done now, girls: [{ id, free, distance, weight }] }. */
  offers(ctx) {
    const p = this.p;
    if (this.active || this.clock < p.startAfter || this.clock < this.cooldownUntil) return [];
    const kinds = ctx.kinds.filter((k) => k !== this.last);
    const pool = kinds.length ? kinds : ctx.kinds;
    if (!pool.length) return [];
    const kind = pool[Math.floor(this.random() * pool.length)];
    return ctx.girls.filter((g) => g.free && g.distance <= p.hearRange && g.weight > 0).map((g) => ({ key: 'dare', girl: g.id, kind, weight: p.weight * g.weight }));
  }

  take(o) {
    return this.begin(o.girl, o.kind);
  }

  /** She dares you (her choice, or the debug panel's). Returns { type: 'dared', girl, kind }, or null if one is on already. */
  begin(girl, kind) {
    if (this.active || !DARE_KINDS[kind]) return null;
    this.active = { girl, kind, left: this.p.dareSeconds };
    this.after = null;
    this.air = null;
    this.top = null;
    this.zapped = false;
    return { type: 'dared', girl, kind };
  }

  /** Lets it drop without a word (the girl has gone, or the debug panel cleared it). */
  cancel() {
    this.active = null;
    this.after = null;
  }

  describe() {
    const a = this.active;
    if (a) return `${a.girl} dared you to ${DARE_KINDS[a.kind].label} (${Math.ceil(a.left)} s left)`;
    return this.clock < this.cooldownUntil ? `no (again in ${Math.round(this.cooldownUntil - this.clock)} s)` : 'no';
  }

  /**
   * Every frame. `you`: null when you are on foot, else { rider (you are at the controls), moto (it is the mini moto), speed, airborne, tipped,
   * nearRamp (metres from the lip), atFord, x, y, z }. Only the fence can be done on foot.
   * Events: { type: 'done', girl, kind, fell }, { type: 'chicken', girl, kind }, { type: 'fell', girl, kind } (a tumble just after).
   */
  update(dt, you) {
    this.clock += dt;
    const zapped = this.zapped;
    this.zapped = false;
    const out = [];
    const a = this.active;
    if (this.after) {
      this.after.left -= dt;
      if (you?.tipped) {
        out.push({ type: 'fell', girl: this.after.girl, kind: this.after.kind });
        this.after = null;
      } else if (this.after.left <= 0) this.after = null;
    }
    if (!a) {
      this.air = null;
      this.top = null;
      return out;
    }
    const p = this.p;
    if (this.did(a.kind, dt, you, zapped)) {
      this.active = null;
      this.cooldownUntil = this.clock + p.cooldown;
      this.after = { girl: a.girl, kind: a.kind, left: p.fellWithin };
      const fell = !!you?.tipped;
      out.push({ type: 'done', girl: a.girl, kind: a.kind, fell });
      if (fell) this.after = null;
      return out;
    }
    a.left -= dt;
    if (a.left <= 0) {
      this.active = null;
      this.cooldownUntil = this.clock + p.cooldown;
      out.push({ type: 'chicken', girl: a.girl, kind: a.kind });
    }
    return out;
  }

  /** Whether you have just done it. */
  did(kind, dt, you, zapped) {
    const p = this.p;
    if (kind === 'fence') return zapped;
    if (!you?.rider) {
      this.air = null;
      this.top = null;
      return false;
    }
    if (kind === 'ford') return !!you.atFord && you.speed >= p.fordSpeed;
    if (kind === 'ramp') {
      if (you.airborne) {
        this.air ??= { time: 0, near: Infinity };
        this.air.time += dt;
        this.air.near = Math.min(this.air.near, you.nearRamp ?? Infinity);
        return false;
      }
      const air = this.air;
      this.air = null;
      return !!air && air.near <= p.rampNear && air.time >= p.rampMinAir;
    }
    // The bank: on the moto, in the bank's box, come down far enough from the highest you have been there, still rolling and upright.
    const b = this.bank;
    const inBox = you.moto && you.x >= b.minX && you.x <= b.maxX && you.z >= b.minZ && you.z <= b.maxZ;
    if (!inBox) {
      this.top = null;
      return false;
    }
    this.top = Math.max(this.top ?? you.y, you.y);
    return !you.tipped && you.speed >= p.bankMinSpeed && this.top - you.y >= Math.min(p.bankDrop, b.rise * 0.8);
  }
}

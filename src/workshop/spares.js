// The spares shelf in the barn: plugs, inner tubes, drive belts, jets and pistons and rings are counted, a job that fits one uses it up, and
// when the shelf is bare you order more, which the post van brings (the parcel is left at the barn door, as any other). Pure, tested.

/** The five parts. `one` and `many` are how the shelf and the toasts say them. */
export const PARTS = {
  plug: { one: 'spark plug', many: 'spark plugs' },
  tube: { one: 'inner tube', many: 'inner tubes' },
  belt: { one: 'drive belt', many: 'drive belts' },
  jet: { one: 'main jet', many: 'main jets' },
  piston: { one: 'piston and rings', many: 'pistons and rings' },
};
export const PART_IDS = Object.keys(PARTS);

/** Which part a bench job uses (on the step that has `part`), and which a toolbox quick fix uses. A plain job uses none. */
export const FIX_PARTS = { puncture: 'tube', belt: 'belt' };

export const DEFAULT_SPARES_PARAMS = {
  startPlug: 3, // spark plugs on the shelf at the start of the first day
  startTube: 2, // inner tubes
  startBelt: 2, // drive belts
  startJet: 2, // main jets (a size other than the stock one takes one; going back to stock gives it back)
  startPiston: 1, // pistons and rings
  packPlug: 4, // how many come in one order
  packTube: 2,
  packBelt: 2,
  packJet: 2,
  packPiston: 1,
  maxOnShelf: 8, // most of one part the shelf (plus what is ordered or in a parcel) will hold
  orderDelay: 75, // seconds from ordering to the post van setting off (it waits for a clear lane and daylight)
};

export const SPARES_PARAM_RANGES = {
  startPlug: [0, 10, 1],
  startTube: [0, 10, 1],
  startBelt: [0, 10, 1],
  startJet: [0, 10, 1],
  startPiston: [0, 10, 1],
  packPlug: [1, 10, 1],
  packTube: [1, 10, 1],
  packBelt: [1, 10, 1],
  packJet: [1, 10, 1],
  packPiston: [1, 10, 1],
  maxOnShelf: [1, 20, 1],
  orderDelay: [0, 600, 5],
};

const cap = (id) => id[0].toUpperCase() + id.slice(1);

/** "3 spark plugs", "1 inner tube". */
export function partCount(id, n) {
  return `${n} ${n === 1 ? PARTS[id].one : PARTS[id].many}`;
}

export class Spares {
  constructor(params = DEFAULT_SPARES_PARAMS) {
    this.p = params;
    this.counts = Object.fromEntries(PART_IDS.map((id) => [id, params[`start${cap(id)}`] ?? 0]));
    this.ordered = {}; // part -> how many are on order
    this.waiting = {}; // part -> how many are in the parcel at the barn door
    this.due = null; // seconds until the van sets off for the order, or null when none is waiting to go
  }

  count(id) {
    return this.counts[id] ?? 0;
  }

  has(id) {
    return this.count(id) > 0;
  }

  /** Uses one up; false (and nothing changes) if there is none. */
  take(id) {
    if (!this.has(id)) return false;
    this.counts[id]--;
    return true;
  }

  /** Puts one back (a jet taken out for the stock one). */
  give(id) {
    this.counts[id] = this.count(id) + 1;
  }

  get hasOrder() {
    return Object.values(this.ordered).some((n) => n > 0);
  }

  get hasParcel() {
    return Object.values(this.waiting).some((n) => n > 0);
  }

  /** How many of a part are on the shelf, ordered and in the parcel. */
  total(id) {
    return this.count(id) + (this.ordered[id] ?? 0) + (this.waiting[id] ?? 0);
  }

  pack(id) {
    return this.p[`pack${cap(id)}`] ?? 1;
  }

  /** Orders a pack. { ok, why }: it is refused if the shelf would be over full. */
  order(id) {
    if (!PARTS[id]) return { ok: false, why: 'nothing by that name' };
    if (this.total(id) + this.pack(id) > this.p.maxOnShelf) return { ok: false, why: `there is room for no more ${PARTS[id].many}` };
    this.ordered[id] = (this.ordered[id] ?? 0) + this.pack(id);
    if (this.due === null) this.due = this.p.orderDelay;
    return { ok: true, why: '' };
  }

  /**
   * Counts the wait down. `postFree`: the van could set off now (no visitor, and daylight). True once the order is due and it could:
   * the game sends the post, then calls sentOff().
   */
  update(dt, postFree) {
    if (this.due === null || !this.hasOrder) return false;
    this.due -= dt;
    return this.due <= 0 && postFree;
  }

  sentOff() {
    this.due = null;
  }

  /** The post has left a parcel: what was ordered is in it. True if it was yours. */
  deliver() {
    if (!this.hasOrder) return false;
    for (const [id, n] of Object.entries(this.ordered)) this.waiting[id] = (this.waiting[id] ?? 0) + n;
    this.ordered = {};
    this.due = null;
    return true;
  }

  /** Opens the parcel onto the shelf. Returns what came out: { id: n }. */
  collect() {
    const got = this.waiting;
    for (const [id, n] of Object.entries(got)) this.counts[id] = this.count(id) + n;
    this.waiting = {};
    return got;
  }

  /** What the shelf says about a part, for the panel: "3 on the shelf, 4 on order". */
  line(id) {
    const bits = [`${this.count(id)} on the shelf`];
    if (this.ordered[id]) bits.push(`${this.ordered[id]} on order`);
    if (this.waiting[id]) bits.push(`${this.waiting[id]} in the parcel`);
    return bits.join(', ');
  }

  /** The parts that are down to the last one or none (for what the girls remark on). */
  low() {
    return PART_IDS.filter((id) => this.count(id) <= 1 && !this.ordered[id] && !this.waiting[id]);
  }

  toJSON() {
    return { counts: { ...this.counts }, ordered: { ...this.ordered }, waiting: { ...this.waiting } };
  }

  restore(s) {
    if (!s) return;
    const n = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
    for (const id of PART_IDS) {
      if (n(s.counts?.[id]) !== null) this.counts[id] = n(s.counts[id]);
      if (n(s.ordered?.[id])) this.ordered[id] = n(s.ordered[id]);
      if (n(s.waiting?.[id])) this.waiting[id] = n(s.waiting[id]);
    }
    this.due = this.hasOrder ? this.p.orderDelay : null;
  }
}

/** Changing the jet in the toolbox: a size other than stock takes one from the shelf, going back to stock gives it back, one size to another costs nothing. */
export function jetShelfChange(before, after) {
  if (before === 0 && after !== 0) return 'take';
  if (before !== 0 && after === 0) return 'give';
  return null;
}

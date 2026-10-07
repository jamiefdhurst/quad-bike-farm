// Where the two accessory pods are: one analogue, one digital, each in the toolbox or fitted to a quad, never two on one quad.
// Pure bookkeeping; the drawing is in dashPod.js and the toolbox panel calls these.

export const POD_KINDS = ['analogue', 'digital'];
export const TOOLBOX = 'toolbox';

export class PodRack {
  /** @param {string[]} quadIds the quads present this game */
  constructor(quadIds) {
    this.quadIds = [...quadIds];
    this.at = { analogue: TOOLBOX, digital: TOOLBOX }; // pod kind -> TOOLBOX or a quad id
  }

  /**
   * Start of a game: each pod independently lands in the toolbox or on a quad that has none yet, every option equally likely.
   * `random` is the layout's seeded random, so ?seed= repeats it.
   */
  place(random) {
    this.at = { analogue: TOOLBOX, digital: TOOLBOX };
    for (const kind of POD_KINDS) {
      const options = [TOOLBOX, ...this.quadIds.filter((id) => !this.podOn(id))];
      this.at[kind] = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
    }
    return { ...this.at };
  }

  /** Lets a quad added after the pods were placed (the barn find) take one. It never starts with one, so the seeded placement is unchanged. */
  allow(quadId) {
    if (!this.quadIds.includes(quadId)) this.quadIds.push(quadId);
  }

  /** The kind of pod fitted to this quad, or null. */
  podOn(quadId) {
    return POD_KINDS.find((k) => this.at[k] === quadId) ?? null;
  }

  inToolbox(kind) {
    return this.at[kind] === TOOLBOX;
  }

  /** Fits a pod from the toolbox to a quad that has none. Returns whether it did. */
  fit(kind, quadId) {
    if (!POD_KINDS.includes(kind) || !this.quadIds.includes(quadId)) return false;
    if (!this.inToolbox(kind) || this.podOn(quadId)) return false;
    this.at[kind] = quadId;
    return true;
  }

  /** Takes a quad's pod off into the toolbox. Returns the kind, or null if it had none. */
  takeOff(quadId) {
    const kind = this.podOn(quadId);
    if (kind) this.at[kind] = TOOLBOX;
    return kind;
  }

  /** One line for the console: where each pod started. */
  describe(nameOf = (id) => id) {
    return POD_KINDS.map((k) => `${k} pod ${this.inToolbox(k) ? 'in the toolbox' : `on the ${nameOf(this.at[k])}`}`).join(', ');
  }
}

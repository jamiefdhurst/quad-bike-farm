// A girl who has bogged her quad (or tipped it) out in the field and can't get it going: she calls you to help. Pure: this keeps her
// waiting, her shouts, how long she has been left and what the help was worth; game.js feeds it the world and acts on what comes back.
// Bogged she stays up on the quad's footboards, waving; tipped she has climbed out and stands beside it, waving.

export const DEFAULT_STRANDED_PARAMS = {
  firstShout: 2.5, // seconds after she gives up before the first shout
  shoutNear: 14, // seconds between shouts while you are within hearing
  shoutFar: 45, // seconds between shouts when you are too far to hear
  hearRange: 80, // metres you are from her to hear her properly
  comeRange: 7, // metres from her quad you are within to count as having come
  freeSink: 0.3, // a bogged quad sunk less than this is out of it
  rescueFavour: 2, // her favour of you for coming...
  quickFavour: 1, // ...and this much more if you came at once, easing off to nothing at `slowAfter`
  slowAfter: 120, // seconds before a rescue is no longer quick
  leftAfter: 180, // seconds she has waited before she says she has been left (and holds it against you)
  leftFavour: -1.5, // her favour for that
  giveUpAfter: 240, // seconds with nobody coming before she gives up and gets down
  giveUpFavour: -0.5, // her favour for that, when you never came near
  pushThrottle: 0.6, // how hard she works the throttle while you push or the cable pulls
  standRaise: 0, // metres to lift her feet from where they hang when she sits, to stand on the footboards
};

export const STRANDED_RANGES = {
  firstShout: [0, 20, 0.5],
  shoutNear: [3, 60, 1],
  shoutFar: [10, 180, 5],
  hearRange: [20, 300, 5],
  comeRange: [2, 20, 0.5],
  freeSink: [0.05, 0.55, 0.01],
  rescueFavour: [0, 10, 0.1],
  quickFavour: [0, 10, 0.1],
  slowAfter: [10, 600, 10],
  leftAfter: [30, 600, 10],
  leftFavour: [-10, 0, 0.1],
  giveUpAfter: [60, 900, 10],
  giveUpFavour: [-10, 0, 0.1],
  pushThrottle: [0.1, 1, 0.05],
  standRaise: [-0.3, 0.3, 0.01],
};

/** Her favour of you for a rescue that came after `seconds`: more the sooner. */
export function rescueFavour(seconds, p = DEFAULT_STRANDED_PARAMS) {
  return p.rescueFavour + p.quickFavour * Math.max(0, 1 - seconds / p.slowAfter);
}

export class Stranded {
  /**
   * @param {'bog'|'tipped'} kind
   * @param {{x:number,z:number}} at  where her quad is
   * @param {object} p  DEFAULT_STRANDED_PARAMS
   */
  constructor(kind, at, p = DEFAULT_STRANDED_PARAMS) {
    this.kind = kind;
    this.at = { x: at.x, z: at.z };
    this.p = p;
    this.t = 0; // seconds she has been waiting
    this.shoutIn = p.firstShout;
    this.shouts = 0;
    this.came = false; // you have been within `comeRange` of her quad at some point
    this.helped = false; // right now something is pulling or pushing the quad (set by the game each frame), so she works the throttle
    this.left = false; // she has said she was left
    this.done = null; // 'rescued' or 'gaveUp' once it is over
  }

  /**
   * One step. `youDist` is how far you are from her (m), `freed` that the quad is out of the mud or upright again.
   * Returns events: { type: 'shout', near, n } (n counts from 0), { type: 'left', favour }, { type: 'rescued', seconds, favour, quick }, { type: 'gaveUp', favour }.
   */
  update(dt, { youDist, freed }) {
    const out = [];
    if (this.done) return out;
    const p = this.p;
    this.t += dt;
    if (youDist <= p.comeRange) this.came = true;
    if (freed) {
      this.done = 'rescued';
      // Out of it with nobody about (it slid out, or you were never there): she is pleased, but it is not a rescue to be thanked for.
      out.push({ type: 'rescued', seconds: this.t, came: this.came, quick: this.t < p.slowAfter, favour: this.came ? rescueFavour(this.t, p) : 0 });
      return out;
    }
    this.shoutIn -= dt;
    if (this.shoutIn <= 0) {
      const near = youDist <= p.hearRange;
      out.push({ type: 'shout', near, n: this.shouts });
      this.shouts++;
      this.shoutIn = near ? p.shoutNear : p.shoutFar;
    }
    if (!this.left && this.t >= p.leftAfter && !this.came) {
      this.left = true;
      out.push({ type: 'left', favour: p.leftFavour });
    }
    if (this.t >= p.giveUpAfter) {
      this.done = 'gaveUp';
      out.push({ type: 'gaveUp', favour: this.came ? 0 : p.giveUpFavour });
    }
    return out;
  }
}

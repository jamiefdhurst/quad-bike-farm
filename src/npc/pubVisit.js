// The girls at the village pub (#358): what the game says to the banter (banter.js) while you are stopped in its car park with them, and when you
// pull away. Pure: game.js hands in where everyone is. The lines are pubLines.js.

export const DEFAULT_PUB_PARAMS = {
  pubNear: 14, // metres from where you pull up at the pub that count as being at it, for you and for each girl
  pubStay: 8, // seconds there before pulling away counts as leaving the pub
  pubLeft: 20, // metres from the pub at which you have left, whatever you were doing
  pubMoving: 2, // m/s on a quad above which you are pulling away
};

export const PUB_PARAM_RANGES = {
  pubNear: [5, 30, 1],
  pubStay: [2, 60, 1],
  pubLeft: [10, 50, 1],
  pubMoving: [0.5, 6, 0.5],
};

export class PubVisit {
  constructor(params = DEFAULT_PUB_PARAMS) {
    this.p = params;
    this.stayed = 0; // seconds you and both girls have been at the pub this visit
  }

  /**
   * @param {number} dt
   * @param {{x:number,z:number}|null} pub  Where you pull up (null on a farm without a village)
   * @param {{x:number,z:number}} you
   * @param {number} speed  Your quad's speed, 0 on foot
   * @param {{x:number,z:number,settled:boolean}[]} girls  Each girl's place, and whether she is stood, sat or a passenger (not driving or walking off)
   * @returns {object[]} banter triggers: { when: 'atPub' } while they wait, { when: 'leavingPub', edge: true } as you pull away
   */
  triggers(dt, pub, you, speed, girls) {
    const p = this.p;
    if (!pub || girls.length < 2) return this.reset();
    const d = (o) => Math.hypot(o.x - pub.x, o.z - pub.z);
    const here = d(you) <= p.pubNear && girls.every((g) => d(g) <= p.pubNear);
    const moving = Math.abs(speed) > p.pubMoving;
    if (here && !moving) {
      this.stayed += dt;
      return girls.every((g) => g.settled) ? [{ when: 'atPub' }] : [];
    }
    const gone = d(you) > p.pubLeft || moving;
    if (!gone) return [];
    const stayed = this.stayed >= p.pubStay;
    this.stayed = 0;
    return stayed && girls.every((g) => d(g) <= p.pubLeft) ? [{ when: 'leavingPub', edge: true }] : [];
  }

  reset() {
    this.stayed = 0;
    return [];
  }
}

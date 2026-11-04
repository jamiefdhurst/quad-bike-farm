// Going home (#100): calling it a day at the wall calendar sends the girls home before the recap. Each takes her own car off the pad by the Dutch
// barn, out through the big gate and away down the public lane; a girl you gave a lift that morning (her car isn't here) goes and sits in
// your car to wait for you instead. Pure: the game says where each girl is and acts on the events; the driving is HerDrive's `park` route.
// Jess's speed on the way out is her own in carGo.js (she gives it everything), and Amy tuts at it. Tested in tests/goingHome.test.js.

export const DEFAULT_GOING_HOME_PARAMS = {
  giveUpAfter: 360, // seconds before a girl who still hasn't got away is counted gone anyway (stuck, or a very long walk to the pad)
  gateX: 200.5, // metres: the big gate in the east hedge (layout.road.gate), opened for them
  laneZ: 95, // how far down the public lane (z) her route runs: past this she is gone
  tutAfter: 1.5, // seconds after Jess sets off that Amy tuts, if Amy is still there to hear it
};

export const GOING_HOME_PARAM_RANGES = {
  giveUpAfter: [60, 900, 10],
  gateX: [190, 210, 0.5],
  laneZ: [20, 200, 5],
  tutAfter: [0, 10, 0.5],
};

/**
 * Her route out, for a car turned to face the road (the row is nosed in to the Dutch barn with no room to turn, so the game swings it round
 * to the south-east before she gets in): on to the road, along it to the big gate, through it and away down the lane. The last point is `laneZ` down it, where
 * she is gone. `slot` is where her car is parked ({ x, z }).
 */
export function leaveRoute(slot, layout, p = DEFAULT_GOING_HOME_PARAMS) {
  const lane = layout.publicLane;
  const roadZ = layout.road.z;
  return [
    { x: slot.x + 3.5, z: roadZ + 1.5 },
    { x: p.gateX - 2.5, z: roadZ + 1.5 },
    { x: p.gateX + 1.5, z: roadZ + 1.5 },
    { x: lane.x - 1.3, z: roadZ + 4.5 },
    { x: lane.x, z: roadZ + 10 },
    { x: lane.x, z: p.laneZ },
  ];
}

export class GoingHome {
  constructor(params = { ...DEFAULT_GOING_HOME_PARAMS }) {
    this.p = params;
    this.reset();
  }

  reset() {
    this.active = false;
    this.clock = 0;
    this.girls = {}; // id -> { how: 'drive' | 'lift', state: 'going' | 'gone', sentOff: clock }
    this.tutted = false;
  }

  /**
   * She calls it a day. `girls` is [{ id, how }]: 'drive' (her own car is here) or 'lift' (she came with you and waits at your car). A girl with
   * neither is not in it, and she is home as far as the day is concerned.
   */
  begin(girls) {
    this.reset();
    this.active = true;
    for (const g of girls) this.girls[g.id] = { how: g.how, state: 'going', sentOff: null };
    return Object.keys(this.girls).map((id) => ({ type: 'go', girl: id, how: this.girls[id].how }));
  }

  /** Whether everyone has got away (or there was no one to send). */
  get done() {
    return this.active && Object.values(this.girls).every((g) => g.state === 'gone');
  }

  /** Her car is off down the road: Jess's drives faster, so Amy hears her go. */
  setOff(id) {
    const g = this.girls[id];
    if (g && g.sentOff === null) g.sentOff = this.clock;
  }

  /** She has got away: her car down the lane, or she is sat in yours. */
  gone(id) {
    const g = this.girls[id];
    if (g) g.state = 'gone';
  }

  /**
   * Moves on `dt` seconds. Returns events: { type: 'tut', girl: 'amy' } once, when Jess has been away a moment and Amy is still on the farm;
   * { type: 'giveUp', girl } for each girl who has taken too long; { type: 'done' } once, when everyone has gone.
   */
  update(dt) {
    if (!this.active) return [];
    const ev = [];
    this.clock += dt;
    const jess = this.girls.jess;
    const amy = this.girls.amy;
    if (!this.tutted && jess?.how === 'drive' && jess.sentOff !== null && this.clock - jess.sentOff >= this.p.tutAfter && amy && amy.state === 'going') {
      this.tutted = true;
      ev.push({ type: 'tut', girl: 'amy' });
    }
    if (this.clock >= this.p.giveUpAfter) {
      for (const [id, g] of Object.entries(this.girls)) {
        if (g.state === 'gone') continue;
        g.state = 'gone';
        ev.push({ type: 'giveUp', girl: id });
      }
    }
    if (this.done) {
      this.active = false;
      ev.push({ type: 'done' });
    }
    return ev;
  }

  /** In a line, for the console and the Girls tab. */
  describe(names = {}) {
    if (!this.active) return 'nobody is going home';
    return Object.entries(this.girls)
      .map(([id, g]) => `${names[id] ?? id}: ${g.state === 'gone' ? 'gone' : g.how === 'lift' ? 'going to your car' : g.sentOff === null ? 'walking to her car' : 'driving off'}`)
      .join(', ');
  }
}

// The bucket list: things to do on the farm, ticked off as you do them. Nothing persists between games, and the girls don't remark on them.
// Pure logic. The game feeds it two ways: `update(dt, snap)` every frame with a small snapshot of what you're doing (this works out riding
// time, distance, jumps, doughnuts, bogs and the like itself), and `note` / `see` / `best` for one-off events (the bell rung, the oil topped up).
// An achievement is a test over the stats, so adding one is one line in ACHIEVEMENTS. A `needs` vehicle that isn't on the farm this game
// (the line-up changes every game) leaves the achievement out of the list and the total.

import { thePhrase } from '../vehicle/names.js';

export const DEFAULT_ACHIEVEMENT_PARAMS = {
  topSpeed: 14, // m/s you reach to count as up to speed
  flatOut: 22, // m/s for flat out
  farMetres: 1000, // ridden to count as a long way round
  rampNearMetres: 30, // an air time this near the ramp counts as a jump off it
  rampMinAir: 0.5, // seconds in the air for it to count as a jump
  rampBigAir: 1.2, // seconds in the air for a big one
  cleanAfter: 1.2, // seconds after landing you must be upright and on your wheels for a clean landing
  doughnutAngle: 6.28, // radians turned in one go (a full circle)
  doughnutMinSpeed: 2, // m/s, below which it's just turning round
  doughnutMinRate: 0.8, // rad/s, below which the turn has stopped
  ridingMinSpeed: 1, // m/s, to count as having ridden something
  passengerSeconds: 30, // on the back while a girl drives, to count as a passenger
  chauffeurSeconds: 20, // on the back of one girl's quad, to count as driven by her
  companySeconds: 30, // with a girl on the back of your quad
  fullLoadSeconds: 15, // with both girls on your quad
  washSeconds: 15, // spent hosing something
  rightedAfter: 1, // seconds on its side before getting it upright counts as having been rolled
};

export const ACHIEVEMENT_PARAM_RANGES = {
  topSpeed: [5, 30, 0.5],
  flatOut: [10, 40, 0.5],
  farMetres: [100, 10000, 100],
  rampNearMetres: [10, 60, 1],
  rampMinAir: [0.1, 2, 0.05],
  rampBigAir: [0.5, 4, 0.05],
  cleanAfter: [0.3, 4, 0.1],
  doughnutAngle: [3, 13, 0.1],
  doughnutMinSpeed: [0.5, 6, 0.1],
  doughnutMinRate: [0.2, 3, 0.05],
  ridingMinSpeed: [0.2, 5, 0.1],
  passengerSeconds: [5, 120, 1],
  chauffeurSeconds: [5, 120, 1],
  companySeconds: [5, 120, 1],
  fullLoadSeconds: [5, 120, 1],
  washSeconds: [3, 60, 1],
  rightedAfter: [0.2, 5, 0.1],
};

// The places worth going to, checked against where you stand (the game has the coordinates).
export const PLACES = ['ford', 'pasture', 'wood', 'dutchBarn', 'fieldShed', 'cattleGrid', 'farEnd', 'gravelPit'];

const RIDE_NAMES = {
  red: thePhrase('red'),
  blue: thePhrase('blue'),
  yellow: thePhrase('yellow'),
  green: thePhrase('green'),
  orange: thePhrase('orange'),
  kids: 'the kids\' quad',
  moto: 'the mini moto',
  atc: 'the three-wheeler',
  plover: thePhrase('plover'),
  ag200: thePhrase('ag200'),
  mower: thePhrase('mower'),
  loan: 'the loan quad',
  tractor: 'the tractor',
  utv: thePhrase('utv'),
  landrover: thePhrase('landrover'),
  landrover200: thePhrase('landrover200'),
};

const rideOf = (id) => ({ id: `ride-${id}`, group: 'Ride', name: `Ride ${RIDE_NAMES[id]}`, hint: 'Take it for a drive', points: 1, needs: id, test: (s) => s.has('rode', id) });

// Each: id, group, name, hint (what to do), points (1 easy, 2 takes a while, 3 hard), test(s) and optionally needs (a vehicle id).
export const ACHIEVEMENTS = [
  ...['red', 'blue', 'yellow', 'green', 'orange', 'kids', 'moto', 'ag200', 'mower', 'atc', 'plover', 'loan', 'tractor', 'utv', 'landrover', 'landrover200'].map(rideOf),
  { id: 'ride-three', group: 'Ride', name: 'Getting about', hint: 'Ride three different vehicles', points: 1, test: (s) => s.count('rode') >= 3 },
  { id: 'ride-all', group: 'Ride', name: 'Full set', hint: 'Ride every vehicle on the farm this game', points: 3, test: (s) => s.fleet.some((id) => id !== 'rusty' && id !== 'plover') && s.fleet.every((id) => id === 'rusty' || id === 'plover' || s.has('rode', id)) },
  { id: 'all-running', group: 'Ride', name: 'Everything going at once', hint: 'Get every quad on the farm running at the same time', points: 3, test: (s) => s.n('allRunning') > 0 },
  { id: 'up-to-speed', group: 'Ride', name: 'Up to speed', hint: 'Get a vehicle moving properly', points: 1, test: (s) => s.m('topSpeed') >= s.p.topSpeed },
  { id: 'flat-out', group: 'Ride', name: 'Flat out', hint: 'Open it right up', points: 2, test: (s) => s.m('topSpeed') >= s.p.flatOut },
  { id: 'long-way', group: 'Ride', name: 'The long way round', hint: 'Ride a kilometre in one game', points: 2, test: (s) => s.n('metres') >= s.p.farMetres },
  { id: 'rain-ride', group: 'Ride', name: 'Weatherproof', hint: 'Ride in the rain', points: 1, test: (s) => s.has('rodeIn', 'rain') },

  { id: 'jump', group: 'Tricks', name: 'Airborne', hint: 'Jump the ramp in the field', points: 1, test: (s) => s.n('rampJumps') >= 1 },
  { id: 'big-air', group: 'Tricks', name: 'Big air', hint: 'Stay in the air a good while off the ramp', points: 2, test: (s) => s.m('rampAir') >= s.p.rampBigAir },
  { id: 'clean-landing', group: 'Tricks', name: 'Stuck it', hint: 'Land the ramp jump upright and ride on', points: 2, test: (s) => s.n('rampClean') >= 1 },
  { id: 'dare-ramp', group: 'Dares', name: 'Dared and jumped', hint: 'Jump the ramp when Jess dares you to', points: 1, test: (s) => s.n('dareRamp') >= 1 },
  { id: 'dare-ford', group: 'Dares', name: 'Splash, if you dare', hint: 'Take the ford flat out when Jess dares you to', points: 1, test: (s) => s.n('dareFord') >= 1 },
  { id: 'dare-fence', group: 'Dares', name: 'Shocking behaviour', hint: 'Touch the electric fence when Jess dares you to', points: 1, test: (s) => s.n('dareFence') >= 1 },
  { id: 'dare-bank', group: 'Dares', name: 'Down the big bank', hint: 'Ride the mini moto down the steepest bank when Jess dares you to', points: 2, needs: 'moto', test: (s) => s.n('dareBank') >= 1 },
  { id: 'doughnut', group: 'Tricks', name: 'Doughnut', hint: 'Spin a full circle on the spot', points: 1, test: (s) => s.n('doughnuts') >= 1 },
  { id: 'roll', group: 'Tricks', name: 'Over she goes', hint: 'Tip a quad onto its side', points: 1, test: (s) => s.n('rolled') >= 1 },
  { id: 'righted', group: 'Tricks', name: 'Back on its wheels', hint: 'Right a tipped quad', points: 1, test: (s) => s.n('righted') >= 1 },

  { id: 'bogged', group: 'Mud', name: 'Stuck fast', hint: 'Get a quad stuck in a bog', points: 1, test: (s) => s.n('bogged') >= 1 },
  { id: 'freed', group: 'Mud', name: 'Out again', hint: 'Get a stuck quad out', points: 1, test: (s) => s.n('freed') >= 1 },
  { id: 'winched', group: 'Mud', name: 'Winched out', hint: 'Pull a bogged quad out with the RB300\'s winch', points: 2, needs: 'green', test: (s) => s.n('winchedOut') >= 1 },
  { id: 'chained', group: 'Mud', name: 'Tractor to the rescue', hint: 'Pull a bogged quad out with the tractor\'s chain', points: 2, needs: 'tractor', test: (s) => s.n('chainedOut') >= 1 },

  { id: 'passenger', group: 'Company', name: 'Passenger', hint: 'Ride on the back while a girl drives', points: 1, test: (s) => s.n('pillionSeconds') >= s.p.passengerSeconds },
  { id: 'driven-amy', group: 'Company', name: 'Amy\'s chauffeur service', hint: 'Be driven about by Amy', points: 1, test: (s) => s.n('drivenBy:amy') >= s.p.chauffeurSeconds },
  { id: 'driven-jess', group: 'Company', name: 'Jess at the wheel', hint: 'Be driven about by Jess', points: 1, test: (s) => s.n('drivenBy:jess') >= s.p.chauffeurSeconds },
  { id: 'company', group: 'Company', name: 'Passenger of your own', hint: 'Drive with a girl on the back', points: 1, test: (s) => s.n('companySeconds') >= s.p.companySeconds },
  { id: 'amy-passed', group: 'Company', name: 'Amy passed her test', hint: 'Be beside Amy in the Finch until she is ready, and see her through her driving test', points: 2, test: (s) => s.n('amyPassed') >= 1 },
  { id: 'amys-test', group: 'Company', name: 'Passed Amy\'s test', hint: 'Let Amy teach you everything she knows about driving a manual', points: 2, test: (s) => s.n('amysTest') >= 1 },
  { id: 'full-load', group: 'Company', name: 'Full load', hint: 'Carry both girls on one quad', points: 2, test: (s) => s.n('fullLoadSeconds') >= s.p.fullLoadSeconds },
  { id: 'amy-likes', group: 'Company', name: 'Amy\'s favourite', hint: 'Get Amy to like you best', points: 2, test: (s) => s.has('favoured', 'amy') },
  { id: 'jess-likes', group: 'Company', name: 'Jess\'s favourite', hint: 'Get Jess to like you best', points: 2, test: (s) => s.has('favoured', 'jess') },
  { id: 'both-like', group: 'Company', name: 'Everyone\'s friend', hint: 'Win over both girls, one after the other', points: 3, test: (s) => s.has('favoured', 'amy') && s.has('favoured', 'jess') },
  { id: 'horn', group: 'Company', name: 'Beep beep', hint: 'Sound the horn and get a beep back', points: 1, test: (s) => s.n('hornAnswered') >= 1 },
  { id: 'race', group: 'Company', name: 'On your marks', hint: 'Race one of the girls', points: 1, test: (s) => s.n('races') >= 1 },
  { id: 'race-win', group: 'Company', name: 'Beat her to it', hint: 'Win a race against a girl', points: 2, test: (s) => s.n('raceWins') >= 1 },
  { id: 'drag', group: 'Company', name: 'Quarter mile', hint: 'Drag race a girl on the strip', points: 1, test: (s) => s.n('drags') >= 1 },
  { id: 'cones', group: 'Company', name: 'Slalom', hint: 'Time a run round Amy\'s cone course (Enter by its first cones, west of the middle of the field)', points: 1, test: (s) => s.n('coneRuns') >= 1 },
  { id: 'coneClean', group: 'Company', name: 'Not a cone down', hint: 'Finish the cone course without knocking a cone over', points: 1, test: (s) => s.n('coneClean') >= 1 },
  { id: 'climb', group: 'Company', name: 'King of the hill', hint: 'Time a run up the hill pasture (Enter by the cones past the stream)', points: 1, test: (s) => s.n('climbs') >= 1 },
  { id: 'pit-climb', group: 'Company', name: 'Over the lip', hint: 'Time a run up the gravel pit\'s steep wall (Enter by the cones on its floor)', points: 2, test: (s) => s.n('pitClimbs') >= 1 },
  { id: 'record', group: 'Company', name: 'On the board', hint: 'Set a record on the chalkboard in the barn', points: 2, test: (s) => s.n('records') >= 1 },
  { id: 'drag-win', group: 'Company', name: 'Lights to flag', hint: 'Win a drag race', points: 2, test: (s) => s.n('dragWins') >= 1 },

  { id: 'ford', group: 'Places', name: 'Wet feet', hint: 'Cross the ford', points: 1, test: (s) => s.has('places', 'ford') },
  { id: 'pasture', group: 'Places', name: 'Up the hill', hint: 'Go down the lane to the hill pasture', points: 1, test: (s) => s.has('places', 'pasture') },
  { id: 'wood', group: 'Places', name: 'Into the woods', hint: 'Find the wood on the hill', points: 1, test: (s) => s.has('places', 'wood') },
  { id: 'gravel-pit', group: 'Places', name: 'Down the pit', hint: 'Find the gravel pit north of the barley field, through the gate in its hedge', points: 1, test: (s) => s.has('places', 'gravelPit') },
  { id: 'dutch-barn', group: 'Places', name: 'Dutch barn', hint: 'Go to the barn at the end of the farm road', points: 1, test: (s) => s.has('places', 'dutchBarn') },
  { id: 'field-shed', group: 'Places', name: 'Field shed', hint: 'Find the stone shed in the far corner', points: 1, test: (s) => s.has('places', 'fieldShed') },
  { id: 'cattle-grid', group: 'Places', name: 'Rattled', hint: 'Cross the cattle grid', points: 1, test: (s) => s.has('places', 'cattleGrid') },
  { id: 'far-end', group: 'Places', name: 'End of the road', hint: 'Follow the farm road all the way to the gate', points: 1, test: (s) => s.has('places', 'farEnd') },
  { id: 'explorer', group: 'Places', name: 'Explorer', hint: 'Visit every place on the list', points: 3, test: (s) => PLACES.every((p) => s.has('places', p)) },

  { id: 'show-first', group: 'Jobs', name: 'Best in show', hint: 'Win a first at the farm show, the last Sunday of a month', points: 3, test: (s) => s.n('showFirst') >= 1 },
  { id: 'bell', group: 'Jobs', name: 'Dinner bell', hint: 'Ring the bell by the barn', points: 1, test: (s) => s.n('bell') >= 1 },
  { id: 'loft', group: 'Jobs', name: 'Up the ladder', hint: 'Climb into the hayloft', points: 1, test: (s) => s.n('loft') >= 1 },
  { id: 'hide', group: 'Jobs', name: 'Hide and seek', hint: 'Hide in the hay', points: 1, test: (s) => s.n('hid') >= 1 },
  { id: 'dipstick', group: 'Jobs', name: 'Check the oil', hint: 'Pull a dipstick', points: 1, test: (s) => s.n('dipstick') >= 1 },
  { id: 'oil', group: 'Jobs', name: 'Topped up', hint: 'Put oil in a four-stroke from the bottle', points: 1, test: (s) => s.n('oilPoured') >= 1 },
  { id: 'fuel', group: 'Jobs', name: 'Filled up', hint: 'Pour petrol from a jerry can into a quad', points: 1, test: (s) => s.n('fuelPoured') >= 1 },
  { id: 'wash', group: 'Jobs', name: 'Mud off', hint: 'Wash a quad down with the hose', points: 1, test: (s) => s.n('washSeconds') >= s.p.washSeconds },
  { id: 'toolbox', group: 'Jobs', name: 'Tinkerer', hint: 'Open the toolbox on a quad', points: 1, test: (s) => s.n('toolbox') >= 1 },
  { id: 'bench', group: 'Jobs', name: 'Workbench', hint: 'Use the bench in the barn', points: 1, test: (s) => s.n('bench') >= 1 },
  { id: 'leads', group: 'Jobs', name: 'Jump start', hint: 'Clamp the jump leads onto a quad', points: 1, test: (s) => s.n('leads') >= 1 },
  { id: 'bump-start', group: 'Jobs', name: 'Bump start', hint: 'Get a manual going by rolling it and letting the clutch out', points: 2, test: (s) => s.n('bumpStart') >= 1 },
  { id: 'hitch', group: 'Jobs', name: 'Hitched', hint: 'Hook a trailer onto the tractor or a quad', points: 1, test: (s) => s.n('hitched') >= 1 },
  { id: 'tip', group: 'Jobs', name: 'Tipped out', hint: 'Tip a trailer or the Yak\'s bed', points: 1, test: (s) => s.n('tipped') >= 1 },
  { id: 'muck', group: 'Jobs', name: 'Muck spreader', hint: 'Fork muck into the little trailer and spread it on the stubble', points: 2, test: (s) => s.n('muckSpread') >= 1 },
  { id: 'hay', group: 'Jobs', name: 'Hay maker', hint: 'Mow and bale the hay patch, load the bales on the trailer and stack them in the Dutch barn', points: 3, test: (s) => s.n('hayMade') >= 1 },
  { id: 'silage', group: 'Jobs', name: 'Bale lifter', hint: 'Spike silage bales with the tractor and carry them into the Dutch barn', points: 2, test: (s) => s.n('silageMoved') >= 1 },
  { id: 'bonfire', group: 'Jobs', name: 'Firestarter', hint: 'Carry three bundles of hedge cuttings to the ring of stones and light the bonfire', points: 2, test: (s) => s.n('bonfireLit') >= 1 },
  { id: 'fire-sit', group: 'Jobs', name: 'Round the fire', hint: 'Sit by the bonfire with a girl until she has had enough', points: 2, test: (s) => s.n('fireSat') >= 1 },
  { id: 'hut-lit', group: 'Jobs', name: 'Home from home', hint: "Light the stove in the shepherd's hut on top of the hill", points: 1, test: (s) => s.n('hutLit') >= 1 },
  { id: 'hut-tea', group: 'Jobs', name: 'Put the kettle on', hint: "Pour yourself a mug of tea from the kettle in the shepherd's hut", points: 2, test: (s) => s.n('hutTea') >= 1 },
  { id: 'hut-sit', group: 'Jobs', name: 'Snug as a bug', hint: "Have a girl sit in the shepherd's hut until she has had enough", points: 2, test: (s) => s.n('hutSat') >= 1 },
  { id: 'job-board', group: 'Jobs', name: 'Board cleared', hint: 'Do everything on the chalkboard on the barn door', points: 2, test: (s) => s.n('boardCleared') >= 1 },
  { id: 'flask', group: 'Jobs', name: 'Tea at the top', hint: 'Sit on the rock at the top of the hill and share a flask of tea with a girl', points: 2, test: (s) => s.n('flask') >= 1 },
  { id: 'say-cheese', group: 'Jobs', name: 'Say cheese', hint: 'Take a photo with a girl in it (press 7)', points: 1, test: (s) => s.n('photoGirl') >= 1 },
  { id: 'caught-napping', group: 'Jobs', name: 'Caught napping', hint: 'Photograph a girl fast asleep on the bales (press 7)', points: 2, test: (s) => s.n('photoAsleep') >= 1 },
  { id: 'proper-photographer', group: 'Jobs', name: 'Proper photographer', hint: 'In photo mode (press 8), take a shot with both girls in it', points: 2, test: (s) => s.n('photoModeBoth') >= 1 },
  { id: 'gallery', group: 'Jobs', name: 'Gallery', hint: 'Have six photos pinned on the cork board in the barn', points: 2, test: (s) => s.m('photosPinned') >= 6 },
  { id: 'park-brake', group: 'Jobs', name: 'Handbrake on', hint: 'Put the parking brake on', points: 1, test: (s) => s.n('parkBrake') >= 1 },
  { id: 'map', group: 'Jobs', name: 'Where am I?', hint: 'Open the farm map', points: 1, test: (s) => s.n('map') >= 1 },
  { id: 'old-bike', group: 'Jobs', name: 'Kick it over', hint: 'Get the old bike in the barn running: tickle it, retard the spark and kick', points: 3, needs: 'plover', test: (s) => s.n('oldBike') >= 1 },
  { id: 'barn-find', group: 'Jobs', name: 'Barn find', hint: 'Get the old quad under the tarp running', points: 3, needs: 'rusty', test: (s) => s.n('barnFind') >= 1 },
];

const wrap = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

export class Achievements {
  /**
   * @param {object} opts
   * @param {string[]} [opts.fleet]  Ids of every vehicle on the farm this game ('rusty' too if the barn find is there).
   * @param {object} [opts.params]
   * @param {object[]} [opts.list]
   */
  constructor({ fleet = [], params = { ...DEFAULT_ACHIEVEMENT_PARAMS }, list = ACHIEVEMENTS } = {}) {
    this.p = params;
    this.list = list;
    this.fleet = fleet;
    this.counters = {};
    this.maxima = {};
    this.sets = {};
    this.unlocked = new Map(); // id -> seconds into the game
    this.clock = 0;
    this.listeners = [];
    this.air = null; // { time, near } while the vehicle you ride is off the ground
    this.landing = null; // { left, air } waiting to see whether you stay upright after a ramp jump
    this.spin = 0; // radians turned so far in this go
    this.lastYaw = null;
    this.stuck = new Map(); // vehicle id -> how it was got out, if at all: { pulledBy }
    this.wasTipped = new Map(); // vehicle id -> seconds it has been on its side
  }

  // Reading the stats (what the tests use) -----------------------------------------------

  n(key) {
    return this.counters[key] ?? 0;
  }

  m(key) {
    return this.maxima[key] ?? 0;
  }

  has(set, value) {
    return !!this.sets[set]?.has(value);
  }

  count(set) {
    return this.sets[set]?.size ?? 0;
  }

  // Feeding it -----------------------------------------------------------------------------

  note(key, amount = 1) {
    this.counters[key] = this.n(key) + amount;
  }

  best(key, value) {
    if (value > this.m(key)) this.maxima[key] = value;
  }

  see(set, value) {
    (this.sets[set] ??= new Set()).add(value);
  }

  onUnlock(fn) {
    this.listeners.push(fn);
  }

  /** Whether this one can be had on this farm. */
  available(a) {
    return !a.needs || this.fleet.includes(a.needs);
  }

  /**
   * Every frame. `snap`:
   *   riding: null, or { id, seat: 'rider' | 'pillion', speed, airborne, tipped, yaw, nearRamp (metres from the ramp), running, girlsOnBoard, driver (a girl's id if she is driving you) }
   *   running: ids of the vehicles with their engines going;  quadIds: ids of the quads that count for "all running"
   *   stuck: ids stuck in a bog now;  pulling: ids being winched or chained, as { id, by: 'winch' | 'chain' }
   *   tippedIds: ids of the quads on their side;  favoured: girls' ids who are clearly favoured;  places: the places you're stood in
   *   weather: its name;  rain: 0..1;  washing: true while you're hosing a quad
   */
  update(dt, snap) {
    this.clock += dt;
    const p = this.p;
    const r = snap.riding;
    if (r) this.riding(dt, r, snap);
    else this.resetRide();

    if (snap.quadIds?.length >= 3 && snap.quadIds.every((id) => snap.running?.includes(id))) this.note('allRunning');
    for (const f of snap.favoured ?? []) this.see('favoured', f);
    for (const place of snap.places ?? []) this.see('places', place);
    if (snap.washing) this.note('washSeconds', dt);

    // Bogs: how a stuck quad got out.
    const stuckNow = new Set(snap.stuck ?? []);
    for (const id of stuckNow) {
      if (!this.stuck.has(id)) {
        this.stuck.set(id, { pulledBy: null });
        this.note('bogged');
      }
    }
    for (const pull of snap.pulling ?? []) if (this.stuck.has(pull.id)) this.stuck.get(pull.id).pulledBy = pull.by;
    for (const [id, how] of [...this.stuck]) {
      if (stuckNow.has(id)) continue;
      this.stuck.delete(id);
      this.note('freed');
      if (how.pulledBy === 'winch') this.note('winchedOut');
      else if (how.pulledBy === 'chain') this.note('chainedOut');
    }

    // Tipping and righting, for any quad (a girl's counts for righting; rolling is you riding it over).
    const tipped = new Set(snap.tippedIds ?? []);
    for (const id of tipped) {
      if (!this.wasTipped.has(id) && snap.riding?.id === id) this.note('rolled');
      this.wasTipped.set(id, (this.wasTipped.get(id) ?? 0) + dt);
    }
    for (const [id, t] of [...this.wasTipped]) {
      if (tipped.has(id)) continue;
      this.wasTipped.delete(id);
      if (t >= p.rightedAfter) this.note('righted');
    }

    this.check();
  }

  resetRide() {
    this.air = null;
    this.landing = null;
    this.spin = 0;
    this.lastYaw = null;
  }

  riding(dt, r, snap) {
    const p = this.p;
    const moving = r.speed > p.ridingMinSpeed;
    if (r.seat === 'rider') {
      if (moving && r.running !== false) this.see('rode', r.id);
      this.note('metres', r.speed * dt);
      this.best('topSpeed', r.speed);
      if (moving && snap.weather && snap.rain > 0.25) this.see('rodeIn', 'rain');
      if (moving && r.girlsOnBoard >= 1) this.note('companySeconds', dt);
      if (moving && r.girlsOnBoard >= 2) this.note('fullLoadSeconds', dt);
      this.air_(dt, r);
      this.doughnut(dt, r);
    } else {
      this.resetRide();
      if (moving && r.driver) {
        this.note('pillionSeconds', dt);
        this.note(`drivenBy:${r.driver}`, dt);
      }
    }
  }

  /** Time in the air, and what the landing was like if it was off the ramp. */
  air_(dt, r) {
    const p = this.p;
    if (r.airborne) {
      this.air ??= { time: 0, near: Infinity };
      this.air.time += dt;
      this.air.near = Math.min(this.air.near, r.nearRamp ?? Infinity);
    } else if (this.air) {
      const { time, near } = this.air;
      this.air = null;
      if (near <= p.rampNearMetres && time >= p.rampMinAir) {
        this.note('rampJumps');
        this.best('rampAir', time);
        this.landing = { left: p.cleanAfter, air: time };
      }
    }
    if (this.landing && !r.airborne) {
      if (r.tipped) this.landing = null;
      else {
        this.landing.left -= dt;
        if (this.landing.left <= 0) {
          this.note('rampClean');
          this.landing = null;
        }
      }
    }
  }

  /** A full circle turned at some speed without stopping turning. */
  doughnut(dt, r) {
    const p = this.p;
    if (this.lastYaw === null || r.speed < p.doughnutMinSpeed || r.airborne) {
      this.lastYaw = r.yaw;
      this.spin = 0;
      return;
    }
    const d = wrap(r.yaw - this.lastYaw);
    this.lastYaw = r.yaw;
    const rate = Math.abs(d) / Math.max(dt, 1e-6);
    if (rate < p.doughnutMinRate || (this.spin !== 0 && Math.sign(d) !== Math.sign(this.spin))) {
      this.spin = rate < p.doughnutMinRate ? 0 : d;
      return;
    }
    this.spin += d;
    if (Math.abs(this.spin) >= p.doughnutAngle) {
      this.note('doughnuts');
      this.spin = 0;
    }
  }

  check() {
    for (const a of this.list) {
      if (this.unlocked.has(a.id) || !this.available(a)) continue;
      if (!a.test(this)) continue;
      this.unlocked.set(a.id, this.clock);
      for (const fn of this.listeners) fn(a);
    }
  }

  /** The ticks as a list of ids, for the farm's save. */
  toJSON() {
    return [...this.unlocked.keys()];
  }

  /** Ticks off what was done on earlier days (see toJSON), quietly: no toast or chime. Ids no longer on the list are dropped. */
  restore(ids) {
    if (!Array.isArray(ids)) return;
    for (const id of ids) if (this.list.some((a) => a.id === id) && !this.unlocked.has(id)) this.unlocked.set(id, -1);
  }

  // Reading it back --------------------------------------------------------------------------

  /** The list for the screen, in order: { ...achievement, done, available }. */
  entries() {
    return this.list.map((a) => ({ id: a.id, group: a.group, name: a.name, hint: a.hint, points: a.points, done: this.unlocked.has(a.id), available: this.available(a) }));
  }

  /** { points, total, count, totalCount } over what can be had on this farm. */
  score() {
    let points = 0;
    let total = 0;
    let count = 0;
    let totalCount = 0;
    for (const a of this.list) {
      if (!this.available(a)) continue;
      total += a.points;
      totalCount++;
      if (this.unlocked.has(a.id)) {
        points += a.points;
        count++;
      }
    }
    return { points, total, count, totalCount };
  }
}

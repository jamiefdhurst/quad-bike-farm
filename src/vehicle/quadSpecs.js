// The quads on the farm. Each spec overrides the default parameters so the
// bikes feel related but not identical. Spawn points come from LAYOUT.spawn.quads,
// in the same order.
//
// Each quad has its own character, the same every game: its idle, how rough it
// runs and how it shakes (its vibration block). Within that, each game picks a
// little variation evenly within these ranges (from the layout seed, so
// ?seed=N repeats them):
//   idleRange: [min, max] warm idle in rpm, at or above safeIdle.
//   safeIdle: the lowest warm idle that's safe (lower and a warm engine can
//     stall under hard braking). The toolbox's idle screw stops here.
//   roughnessRange: [min, max] how lumpy it runs once warm (baseRoughness, 0 to 1).
//     Cold, rich, lean and fouled running add to this.
//   hoursRange, odoRange: [min, max] engine hours and odometer miles the dash shows at the start.
//   wearRange: [min, max] engine wear (0 new, 1 shot) it comes with, higher the more hours it shows (history.js). tinkers: false keeps leftover
//     tinkering off it.
//   noHeadlight: true if the lamp is only for show and never lights (the orange).
//   steadyLights: true if a battery runs its headlight (the loan quad and the tractor); the others' follow the engine's revs (headlight.js).
//   topRpmRange: [min, max] full-throttle rpm (maxRpm; the redline keeps its gap below it). The toolbox's rev limiter moves it from there.
//   fuelRange: [min, max] litres in the tank at the start. Below the reserve
//     (reserveLitres) it'll only run on RESERVE.

export const QUAD_SPECS = [
  {
    // Honda-style farm quad: soft, steady, low warm idle. The original tuning.
    id: 'red',
    label: 'red quad',
    name: 'Red quad',
    bodyColor: 0xa8271f,
    style: 'utility',
    dashStyle: 'foreman',
    driveSwitch: true, // a 2WD / 4WD switch on the bars (driveMode.js)
    reverseStyle: 'bars', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'thumb', // where the choke is and what it takes to reach it
    tapStyle: 'left', // where the fuel tap sits
    hoursRange: [600, 1500], // engine hours showing when the game starts
    odoRange: [1500, 3750], // odometer miles showing when the game starts
    wearRange: [0.1, 0.35], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    // The smooth one: a steady idle and a gentle shake.
    safeIdle: 650,
    idleRange: [1050, 1150],
    roughnessRange: [0.04, 0.12],
    fuelRange: [2.5, 11], // 12 litre tank, 2 litre reserve
    topRpmRange: [5950, 6450], // full-throttle revs this game, about 4% either side of the engine's own
    manual: true, // a clutch (Shift) and a four-speed gearbox in place of the CVT (src/vehicle/manualDrivetrain.js)
    gearbox: { gears: 4, topSpeed1: 4.5, topSpeed2: 8.5, topSpeed3: 12.5, topSpeed4: 17, topSpeedReverse: 3.5, torque1: 1, torque2: 0.85, torque3: 0.7, torque4: 0.6, torqueReverse: 0.9, launchLoad1: 0.15, launchLoad2: 0.7, launchLoad3: 0.9, launchLoad4: 1, lugSpeed: 0.6 },
    fuel: {},
    engine: { loadDragRpm: 9000 }, // a manual: slowing in a high gear drags it down and stalls it (manualDrivetrain.js)
    vehicle: {},
    vibration: {
      pulseGain: 1.15,
      heaveDamping: 0.3, // settles quickly: soft and well damped
      pitchDamping: 0.28,
      barsGain: 0.13,
    },
    audio: { recIdleSource: 'quad' },
    smoke: {},
  },
  {
    // Yamaha-style: idles a bit higher, revs harder and higher (6,800 against 6,200), needs more choke
    // when cold and runs lumpier until it's warm, warms a little quicker, and
    // pulls slightly harder. Its idle comes from the other recorded machine.
    id: 'blue',
    label: 'blue quad',
    name: 'Blue quad',
    bodyColor: 0x1d4fa3,
    style: 'utility2',
    dashStyle: 'grizzly',
    driveSwitch: true,
    diffLock: true, // and a diff lock button
    reverseStyle: 'button', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'plunger', // where the choke is and what it takes to reach it
    tapStyle: 'right', // where the fuel tap sits
    hoursRange: [400, 1100], // engine hours showing when the game starts
    odoRange: [1000, 2750], // odometer miles showing when the game starts
    wearRange: [0.08, 0.3], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    // Fast, keen idle; a medium, quicker buzz.
    safeIdle: 950,
    idleRange: [1400, 1550],
    roughnessRange: [0.2, 0.3],
    fuelRange: [1.2, 8], // 11 litre tank, 1.8 litre reserve: some games it starts on its reserve
    topRpmRange: [6550, 7050], // full-throttle revs this game, about 4% either side of the engine's own
    fuel: { tankCapacity: 11, reserveLitres: 1.8 },
    engine: {
      idleRpmWarm: 1450,
      maxRpm: 6800,
      redlineRpm: 6400,
      rpmRiseRate: 8.5,
      rpmFallRate: 7,
      warmUpSeconds: 120,
      coldEnrichmentNeed: 1.1,
      chokeIdleRpm: 1300,
      chokeEnrichment: 1.5, // full choke is rich once it's warming, so this one wants it off sooner
      catchChance: 0.55,
      coldRoughness: 0.62,
      coldPowerLoss: 0.84,
    },
    vehicle: {
      mass: 290,
      maxDriveForce: 2200,
      maxSpeed: 18.5,
      maxSteerDeg: 34,
    },
    vibration: {
      pulseGain: 1.45,
      heaveFreq: 10,
      pitchFreq: 7.5,
      barsFreq: 20,
    },
    audio: {
      recIdleSource: 'rev',
      pulseRefRpm: 1450,
      recToneClosed: 7000,
      pipeLength: 1.0,
      mufflerFreqA: 185,
    },
    smoke: {
      coldDensity: 0.7,
    },
  },
  {
    // Two-stroke sport quad, Blaster-style: light, single seat, fires every
    // revolution, ring-dings at idle, weak low down then comes on hard around
    // 6,000 rpm, revs past 10,000, loads its plug up if left idling, almost no
    // engine braking, and trails blue-white oil smoke. Sounds like a two-stroke
    // dirt bike. Automatic like the others.
    id: 'yellow',
    label: 'yellow quad',
    name: 'Yellow quad',
    bodyColor: 0xe9c21b,
    style: 'sport',
    dashStyle: 'blaster',
    reverseStyle: 'none', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'thumb', // where the choke is and what it takes to reach it
    tapStyle: 'lowLeft', // where the fuel tap sits
    hoursRange: [150, 600], // engine hours showing when the game starts
    odoRange: [600, 2400], // odometer miles showing when the game starts
    wearRange: [0.1, 0.35], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    // Ring-ding idle; a fine high-frequency buzz through the bars more than the body.
    safeIdle: 900,
    idleRange: [1500, 1800],
    roughnessRange: [0.35, 0.5],
    fuelRange: [1.5, 8], // 9 litre tank, 1.5 litre reserve
    topRpmRange: [10100, 10900], // full-throttle revs this game, about 4% either side of the engine's own
    manual: true, // a clutch (Shift) and a four-speed gearbox in place of the CVT (src/vehicle/manualDrivetrain.js)
    gearbox: { gears: 4, topSpeed1: 5, topSpeed2: 9.5, topSpeed3: 14.5, topSpeed4: 20, topSpeedReverse: 3.5, torque1: 1, torque2: 0.85, torque3: 0.7, torque4: 0.6, torqueReverse: 0.9, launchLoad1: 0.15, launchLoad2: 0.7, launchLoad3: 0.9, launchLoad4: 1, lugSpeed: 0.6 },
    fuel: { tankCapacity: 9, startOil: 0.02, reserveLitres: 1.5, burnPerRev: 0.000032, idleBurnFraction: 0.45 },
    engine: {
      loadDragRpm: 32000, // a manual: slowing in a high gear drags it down and stalls it, high idle and all (manualDrivetrain.js)
      strokes: 2,
      popProne: 0.7, // two-strokes crackle and bang on the overrun
      pullStart: true, // a recoil cord as well as the starter
      idleRpmWarm: 1800,
      maxRpm: 10500,
      redlineRpm: 9500,
      rpmRiseRate: 11,
      rpmFallRate: 9,
      warmUpSeconds: 100,
      coldEnrichmentNeed: 1.05,
      chokeIdleRpm: 1200,
      catchChance: 0.5,
      coldRoughness: 0.6,
      coldPowerLoss: 0.8, // its high idle and quick revving mean it rarely stalls from braking, even cold
      skipChance: 0.35,
      skipThrottle: 0.15,
      skipRpm: 3800,
      idleFoulRate: 0.002,
      misfireRpmDrop: 160,
      boreKit: 1, // Jess's dream: a big-bore kit that fits at the bench (engine/bigBore.js)
    },
    vehicle: {
      mass: 260,
      maxDriveForce: 2500,
      maxSpeed: 20,
      maxSteerDeg: 34,
      clutchEngageRpm: 2500,
      clutchFullRpm: 4200,
      couplingRpm: 3300,
      engineBrakeForce: 60,
      powerbandRpm: 6000,
      torqueBelowBand: 0.45,
      fourWheelDrive: 0, // chain drive to a solid rear axle, so it spins up its back wheels in mud
    },
    vibration: {
      pulseGain: 1.1,
      idleRpm: 2300,
      smoothRpmRange: 2200,
      barsHighRpmFloor: 0.5,
      barsFreq: 26,
      barsGain: 0.26,
      barsRotGain: 1.3,
      heaveGain: 0.13,
      pitchGain: 0.28,
    },
    audio: {
      recBank: 'engine-bank-yellow', // a Yamaha DT 125 idling, into a Honda CR85 flat out as it revs
      pulseRevLo: 3500, // from here it blends into the CR85's own firings
      pulseRevHi: 5000,
      pulseRevGain: 1.4, // revs as loud as its old sound's
      pulseTone: 9000, // the CR85's rasp is in its top end: don't smooth it off as much as the default
      pulseRefRpm: 1800,
      pulseRevLoudness: 1.1, // a two-stroke gets louder faster as it revs
      pulseLoudnessCap: 2,
      recRevGain: 1,
      recIdleSource: 'quad',
      recBlendLo: 2600,
      recBlendHi: 3600,
      recToneClosed: 9000,
      recVolume: 0.55,
      pipeLength: 0.85,
      mufflerFreqA: 230,
      densityRefRpm: 2400,
    },
    smoke: {
      warmDensity: 0.32,
      coldDensity: 0.8,
      warmGray: 0.82,
      coldGray: 0.9,
      tint: '#dde6ff',
    },
  },
  {
    // Kawasaki-style farm workhorse: older, heavier and slower, with a big lazy
    // four-stroke that idles low and lumpy, revs slowly, pulls hard low down,
    // takes an age to warm up and wants plenty of choke. Rougher than the others,
    // and strong engine braking. It idles on a different recorded machine.
    id: 'green',
    label: 'green quad',
    name: 'Green quad',
    bodyColor: 0x2e6b30,
    style: 'utility3',
    winch: true, // its front winch works (src/items/winch.js)
    dashStyle: 'bayou',
    reverseStyle: 'knee', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'knob', // where the choke is and what it takes to reach it
    tapStyle: 'rearLeft', // where the fuel tap sits
    hoursRange: [1800, 3500], // engine hours showing when the game starts
    odoRange: [4500, 8750], // odometer miles showing when the game starts
    wearRange: [0.25, 0.55], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    // Slow and lumpy; a big slow heave, like a tractor.
    safeIdle: 800,
    idleRange: [800, 900],
    roughnessRange: [0.55, 0.7],
    fuelRange: [3, 13], // 14 litre tank, 2.5 litre reserve
    topRpmRange: [5400, 5800], // full-throttle revs this game, about 4% either side of the engine's own
    manual: true, // a clutch (Shift) and a four-speed gearbox in place of the CVT (src/vehicle/manualDrivetrain.js)
    gearbox: { gears: 4, topSpeed1: 4, topSpeed2: 7.5, topSpeed3: 11, topSpeed4: 15, topSpeedReverse: 3, torque1: 1, torque2: 0.9, torque3: 0.75, torque4: 0.65, torqueReverse: 1, launchLoad1: 0.1, launchLoad2: 0.6, launchLoad3: 0.85, launchLoad4: 1, lugSpeed: 0.6 },
    fuel: { tankCapacity: 14, reserveLitres: 2.5, burnPerRev: 0.000085 },
    engine: {
      idleRpmWarm: 1050,
      maxRpm: 5600,
      redlineRpm: 5200,
      rpmRiseRate: 5.5,
      rpmFallRate: 4.5,
      loadDragRpm: 7500, // a heavy flywheel, but a manual: slowing in a high gear still drags it down and stalls it (manualDrivetrain.js)
      warmUpSeconds: 190,
      coldEnrichmentNeed: 1.15,
      chokeIdleRpm: 1100,
      catchChance: 0.45,
      knackBlips: 0, // it used to only fire cold after the throttle had been blipped twice (set to 2 to bring that back); the girls couldn't start it
      coldRoughness: 0.7,
      coldPowerLoss: 0.85,
      roughRevFade: 0.8, // lumpy at tickover, but its firings even out as it pulls (it stuttered flat out)
      roughRevSmoothRpm: 3200,
    },
    vehicle: {
      mass: 340,
      maxDriveForce: 2350,
      maxSpeed: 15,
      maxSteerDeg: 30,
      engineBrakeForce: 480,
    },
    vibration: {
      pulseGain: 1.25,
      heaveFreq: 5.5,
      pitchFreq: 4.8,
      rollFreq: 5.5,
      heaveGain: 0.2,
      pitchGain: 0.36,
      heaveDamping: 0.2,
      barsFreq: 12,
    },
    audio: {
      recBank: 'engine-bank-green', // a Yamaha Ténéré 250 idling, into kyles's Honda ATV as it revs
      recIdleSource: 'quad',
      pulseStretch: 0.5, // its idle firings are twice as quick as its tickover: stretch them half way and leave a gap, a big lazy single
      pulseRevLo: 1600, // from here it blends into the Honda ATV's own firings
      pulseRevHi: 2600,
      pulseRevGain: 1.45, // revs as loud as its old sound's, which was fitted to real engines
      pulseRevFollow: 0.08, // reads on through the Honda's pull-away, not a firing from anywhere each time
      pulseRefRpm: 1050,
      pulseRevLoudness: 0.05, // its recorded pulses are already punchy when cut short; it hardly needs to get louder
      recVolume: 0.58, // idles as loud as it did on the CRF250
      recToneClosed: 5200,
      pipeLength: 1.3,
    },
    smoke: {
      coldDensity: 0.62,
      warmDensity: 0.2,
    },
  },
  {
    // Suzuki LT250R-style two-stroke race quad: lighter and lower than the
    // yellow, revs higher and comes on harder still, single seat (no room for
    // her), barely any engine braking, and smokes like a chimney. Its idle is a
    // different two-stroke from the yellow's.
    id: 'orange',
    noHeadlight: true, // no lighting set on the orange: its lamp never shines
    label: 'orange quad',
    name: 'Orange quad',
    bodyColor: 0xe86a12,
    style: 'sport2', // a single race seat: no room for her on the back
    dashStyle: 'quadracer',
    reverseStyle: 'none', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'knob', // where the choke is and what it takes to reach it
    tapStyle: 'lowRight', // where the fuel tap sits
    hoursRange: [100, 400], // engine hours showing when the game starts
    odoRange: [400, 1600], // odometer miles showing when the game starts
    wearRange: [0.04, 0.2], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    // A nervous, hunting idle; harsh and hard.
    safeIdle: 1600,
    idleRange: [2000, 2300],
    roughnessRange: [0.75, 0.9],
    fuelRange: [1.5, 7.5], // 8 litre tank, 1.2 litre reserve
    topRpmRange: [11050, 11950], // full-throttle revs this game, about 4% either side of the engine's own
    fuel: { tankCapacity: 8, startOil: 0.02, reserveLitres: 1.2, burnPerRev: 0.000036, idleBurnFraction: 0.45 },
    engine: {
      strokes: 2,
      popProne: 0.7, // two-strokes crackle and bang on the overrun
      waterCooled: true, // a radiator with a fan that cuts in; it never gets as hot as the air-cooled ones
      pullStart: true, // a recoil cord as well as the starter
      idleRpmWarm: 1950,
      maxRpm: 11500,
      redlineRpm: 10800,
      rpmRiseRate: 13,
      rpmFallRate: 10,
      warmUpSeconds: 90,
      coldEnrichmentNeed: 1.05,
      chokeIdleRpm: 1300,
      catchChance: 0.45,
      coldRoughness: 0.6,
      coldPowerLoss: 0.85,
      skipChance: 0.4,
      skipThrottle: 0.15,
      skipRpm: 4200,
      idleFoulRate: 0.0025,
      misfireRpmDrop: 170,
    },
    vehicle: {
      mass: 240,
      maxDriveForce: 2650,
      maxSpeed: 21.5,
      maxSteerDeg: 33,
      clutchEngageRpm: 2900,
      clutchFullRpm: 4800,
      couplingRpm: 3700,
      engineBrakeForce: 45,
      powerbandRpm: 7200,
      torqueBelowBand: 0.38,
      fourWheelDrive: 0,
    },
    vibration: {
      pulseGain: 0.95,
      idleRpm: 2400,
      smoothRpmRange: 2400,
      barsHighRpmFloor: 0.6,
      barsFreq: 24,
      barsGain: 0.24,
      heaveFreq: 11,
      pitchFreq: 9,
      heaveDamping: 0.14,
      directionJitter: 0.9,
    },
    audio: {
      recBank: 'engine-bank-2t',
      recIdleSource: 'rev',
      pulseRefRpm: 1950,
      pulseRevLoudness: 1.1,
      pulseLoudnessCap: 2,
      recRevGain: 1,
      recBlendLo: 2800,
      recBlendHi: 3800,
      recToneClosed: 9500,
      recVolume: 0.55,
      pipeLength: 0.8,
      mufflerFreqA: 240,
      densityRefRpm: 2500,
    },
    smoke: {
      warmDensity: 0.38,
      coldDensity: 0.85,
      warmGray: 0.85,
      coldGray: 0.9,
      tint: '#d8e2ff',
    },
  },
];

// Vehicles that turn up only some games (src/vehicle/fleet.js picks which). They follow the same rules as the five above.
export const EXTRA_SPECS = [
  {
    // A kids' 50cc two-stroke that Jess insists on riding. Two thirds the size of the others (scale shrinks the model and the
    // physics together), light and slow, one seat, and it revs very high and sounds like an angry wasp. Pull-start as well as the
    // starter; it runs on the same pre-mix as the yellow.
    id: 'kids',
    label: "kids' quad",
    name: "Kids' quad",
    bodyColor: 0xcf6f98, // a faded pink
    style: 'sport',
    plateNumbers: '123456890', // front plate digits it might wear, one picked each game (never the yellow's 7)
    dashStyle: 'kidsKey',
    reverseStyle: 'none', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'thumb', // where the choke is and what it takes to reach it
    tapStyle: 'left', // where the fuel tap sits
    hoursRange: [30, 200], // engine hours showing when the game starts
    odoRange: [100, 800], // odometer miles showing when the game starts
    wearRange: [0.02, 0.12], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    tinkers: false, // nobody leaves the throttle stop out on a child's quad
    scale: 0.65,
    solo: true, // no room for anyone on the back
    owner: 'jess', // Amy won't ride it, and Jess goes for it first
    // A thin, fast buzz, but a lazier tickover than the yellow's or the orange's.
    safeIdle: 800,
    idleRange: [1100, 1300],
    roughnessRange: [0.3, 0.5],
    fuelRange: [0.4, 2.2], // 2.5 litre tank, 0.4 litre reserve
    topRpmRange: [9400, 10200], // full-throttle revs this game, about 4% either side of the engine's own
    fuel: { tankCapacity: 2.5, startOil: 0.02, reserveLitres: 0.4, burnPerRev: 0.000032, idleBurnFraction: 0.45 },
    engine: {
      strokes: 2,
      popProne: 0.7, // two-strokes crackle and bang on the overrun
      pullStart: true,
      idleRpmWarm: 1200,
      maxRpm: 9800,
      redlineRpm: 9200,
      rpmRiseRate: 14,
      rpmFallRate: 11,
      warmUpSeconds: 60,
      coldEnrichmentNeed: 1.0,
      chokeIdleRpm: 1300,
      catchChance: 0.5,
      coldRoughness: 0.6,
      coldPowerLoss: 0.85,
      skipChance: 0.35,
      skipThrottle: 0.15,
      skipRpm: 4600,
      idleFoulRate: 0.0025,
      misfireRpmDrop: 150,
    },
    vehicle: {
      mass: 110,
      centreOfMassY: -0.06,
      riderTopple: 40, // a grown-up on a kids' quad is top-heavy, but the full weight would tip it at 17 degrees
      rollInertia: 20,
      pitchInertia: 35,
      yawInertia: 42,
      wheelRadius: 0.195, // 0.3 m scaled by 0.65
      suspensionRestLength: 0.156,
      maxSuspensionTravel: 0.13,
      maxSuspensionForce: 12000,
      maxDriveForce: 700,
      maxSpeed: 9.5,
      maxSteerDeg: 36,
      clutchEngageRpm: 2200,
      clutchFullRpm: 4000,
      couplingRpm: 3000,
      engineBrakeForce: 40,
      powerbandRpm: 6000,
      torqueBelowBand: 0.5,
      fourWheelDrive: 0,
    },
    vibration: {
      pulseGain: 0.8,
      idleRpm: 1300,
      barsFreq: 28,
      barsGain: 0.2,
      heaveFreq: 12,
      pitchFreq: 10,
      heaveDamping: 0.16,
    },
    audio: {
      recBank: 'engine-bank-50', // a Gilera Runner SP50 recorded close to its exhaust
      engineSound: 'pulse', // its revs from the Gilera's own rev recordings: its idle beats (it fires every other turn) are too long to build revs from
      recIdleSource: 'quad',
      pulseRefRpm: 1200,
      recBlendLo: 3200,
      recBlendHi: 4200,
      recToneClosed: 9500,
      recVolume: 0.5,
      pipeLength: 0.55, // a short pipe: thin and high
      mufflerFreqA: 300,
      densityRefRpm: 2600,
    },
    smoke: {
      warmDensity: 0.3,
      coldDensity: 0.75,
      warmGray: 0.85,
      coldGray: 0.9,
      tint: '#dde6ff',
    },
  },
  {
    // A 50cc two-stroke pit bike (the "mini moto"): two wheels, one seat, a pull-start as well as the starter, and the kids' quad's
    // sound for now. Built by miniMotoModel.js: it rides on the quad physics with two wheels and the lean model (bikeLean.js) holding it up, and
    // leaning into corners. Anyone can ride it (it's nobody's), but there's no room on the back.
    id: 'moto',
    miniMoto: true,
    label: 'mini moto',
    name: 'Mini moto',
    bodyColor: 0x3f6fa8, // a sun-faded blue
    style: 'sport', // the quad body styles are unused (the model is its own), but the spec must name one that exists
    dashStyle: 'kidsKey',
    reverseStyle: 'none', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'thumb', // where the choke is and what it takes to reach it
    tapStyle: 'left', // where the fuel tap sits
    hoursRange: [20, 150], // engine hours showing when the game starts
    odoRange: [60, 500], // odometer miles showing when the game starts
    wearRange: [0.05, 0.2], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    tinkers: false, // nobody leaves the throttle stop out on a bike this size
    solo: true, // no room for anyone on the back
    safeIdle: 1400, // a pit bike tickovers fast; it's the idle range's floor, so lower both to settle it down
    idleRange: [1800, 2200],
    roughnessRange: [0.3, 0.55],
    fuelRange: [0.4, 1.6], // 1.8 litre tank, 0.3 litre reserve
    topRpmRange: [9400, 10200], // full-throttle revs this game, about 4% either side of the engine's own
    fuel: { tankCapacity: 1.8, startOil: 0.02, reserveLitres: 0.3, burnPerRev: 0.000032, idleBurnFraction: 0.45 },
    engine: {
      strokes: 2,
      popProne: 0.7, // two-strokes crackle and bang on the overrun
      pullStart: true,
      noStarter: true, // no key start, only the cord
      idleRpmWarm: 2000,
      maxRpm: 9800,
      redlineRpm: 9200,
      rpmRiseRate: 14,
      rpmFallRate: 11,
      warmUpSeconds: 60,
      coldEnrichmentNeed: 1.0,
      chokeIdleRpm: 2300,
      catchChance: 0.5,
      coldRoughness: 0.6,
      coldPowerLoss: 0.85,
      skipChance: 0.35,
      skipThrottle: 0.15,
      skipRpm: 4600,
      idleFoulRate: 0.0025,
      misfireRpmDrop: 150,
    },
    vehicle: {
      mass: 105, // bike plus rider
      centreOfMassY: -0.22, // low, so the lean balance (bikeLean.js) has little to hold up
      riderTopple: 0, // the rider is in the mass; its tipping is the lean model's (bikeLean.js)
      suspensionStiffness: 60,
      rollInertia: 12,
      pitchInertia: 28,
      yawInertia: 30,
      wheelRadius: 0.22,
      suspensionRestLength: 0.12,
      maxSuspensionTravel: 0.1,
      maxSuspensionForce: 12000,
      maxDriveForce: 650,
      maxSpeed: 12,
      maxSteerDeg: 38,
      steerSpeedReduction: 0.02, // a bike keeps its steering at speed
      spinSideLoss: 0.5, // and the driven rear steps out when you pour the power on mid-corner
      clutchEngageRpm: 3200, // a centrifugal clutch well above the idle
      clutchFullRpm: 5000,
      couplingRpm: 3800,
      engineBrakeForce: 40,
      powerbandRpm: 6000,
      torqueBelowBand: 0.5,
      fourWheelDrive: 0,
    },
    vibration: {
      pulseGain: 0.8,
      idleRpm: 2000,
      barsFreq: 28,
      barsGain: 0.25,
      heaveFreq: 12,
      pitchFreq: 10,
      heaveDamping: 0.16,
    },
    audio: {
      recBank: 'engine-bank-moto', // a Derbi GPR 50 two-stroke, banging every other turn at idle
      engineSound: 'pulse',
      recIdleSource: 'quad',
      pulseRefRpm: 1800,
      pulseRevLoudness: 0.2, // its revs are all bangs (pulseCleanUp), loud already: grow less than the default with revs
      recBlendLo: 3200,
      recBlendHi: 4200,
      recToneClosed: 9500,
      recVolume: 0.3, // the Derbi is a close, loud recording: this idles it as loud as the kids' quad's bank did
      pipeLength: 0.55,
      mufflerFreqA: 300,
      densityRefRpm: 2600,
    },
    smoke: {
      warmDensity: 0.3,
      coldDensity: 0.75,
      warmGray: 0.85,
      coldGray: 0.9,
      tint: '#dde6ff',
    },
  },
  {
    // The neighbour's beaten-up three-wheeler, an old ATC: a 200cc two-stroke with one front wheel and two fat tyres at the back, a
    // pull-start only (no starter motor), a clutch (Shift) and a four-speed box, and a tall, narrow stance that tips if you throw it round
    // a corner. Worn out, hard to start and rough. Built by atcModel.js, with the yellow's sound until it gets its own. Solo.
    id: 'atc',
    threeWheeler: true,
    label: 'old three-wheeler',
    name: 'Old three-wheeler',
    bodyColor: 0xb4553f, // a chalky, sun-bleached Honda red
    style: 'sport', // the quad body styles are unused (the model is its own), but the spec must name one that exists
    dashStyle: 'kidsKey',
    reverseStyle: 'none', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'knob', // where the choke is and what it takes to reach it
    tapStyle: 'left', // where the fuel tap sits
    hoursRange: [800, 2400], // engine hours showing when the game starts
    odoRange: [3000, 9000], // odometer miles showing when the game starts
    wearRange: [0.35, 0.65], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    tinkers: false, // nobody leaves a throttle stop out on this
    solo: true, // no room for anyone on the back
    wheelShake: 0.9, // old and loose, so its wheels shake a bit more than the quads'
    // A lumpy two-stroke idle, between the yellow's and the kids' quad's.
    safeIdle: 900,
    idleRange: [1300, 1800],
    roughnessRange: [0.45, 0.7],
    fuelRange: [1, 5], // 6 litre tank, 1 litre reserve
    topRpmRange: [8900, 9700], // full-throttle revs this game, about 4% either side of the engine's own
    manual: true, // a clutch (Shift) and a four-speed gearbox in place of the CVT (src/vehicle/manualDrivetrain.js)
    gearbox: { gears: 4, topSpeed1: 4, topSpeed2: 8, topSpeed3: 12, topSpeed4: 16, topSpeedReverse: 3, torque1: 1, torque2: 0.85, torque3: 0.7, torque4: 0.6, torqueReverse: 0.9, launchLoad1: 0.15, launchLoad2: 0.7, launchLoad3: 0.9, launchLoad4: 1, lugSpeed: 0.6 },
    fuel: { tankCapacity: 6, startOil: 0.02, reserveLitres: 1, burnPerRev: 0.000032, idleBurnFraction: 0.45 },
    engine: {
      loadDragRpm: 28000, // a manual: slowing in a high gear drags it down and stalls it (manualDrivetrain.js)
      strokes: 2,
      popProne: 0.7, // two-strokes crackle and bang on the overrun
      pullStart: true,
      noStarter: true, // no key start, only the cord
      idleRpmWarm: 1550,
      maxRpm: 9300,
      redlineRpm: 8600,
      rpmRiseRate: 10,
      rpmFallRate: 8,
      warmUpSeconds: 110,
      coldEnrichmentNeed: 1.1,
      chokeIdleRpm: 1100,
      catchChance: 0.45,
      coldRoughness: 0.65,
      coldPowerLoss: 0.8,
      skipChance: 0.4,
      skipThrottle: 0.15,
      skipRpm: 3800,
      idleFoulRate: 0.0025,
      misfireRpmDrop: 170,
    },
    vehicle: {
      mass: 215, // bike plus rider
      centreOfMassY: -0.06, // a bit higher than the quads' -0.08 default, with the rider up on top: that, and one front wheel, is what tips it
      riderTopple: 0, // its tipping is tuned with the rider in the centre of mass already
      steerSpeedReduction: 0.12, // less lock at speed, or it trips itself on a single front wheel
      rollInertia: 38,
      pitchInertia: 70,
      yawInertia: 80,
      wheelRadius: 0.3,
      suspensionRestLength: 0.2,
      maxSuspensionTravel: 0.15,
      maxDriveForce: 1800,
      maxSpeed: 16,
      maxSteerDeg: 34,
      clutchEngageRpm: 2500,
      clutchFullRpm: 4200,
      couplingRpm: 3300,
      engineBrakeForce: 60,
      powerbandRpm: 5500,
      torqueBelowBand: 0.5,
      fourWheelDrive: 0, // the two rear wheels on a solid axle
    },
    vibration: {
      pulseGain: 1.1,
      idleRpm: 1550,
      barsFreq: 20,
      barsGain: 0.3,
      heaveGain: 0.16,
      pitchGain: 0.3,
    },
    audio: {
      recBank: 'engine-bank-atc', // a Piaggio Ape's slow lumpy tickover, with old two-stroke revs
      pulseRefRpm: 1500,
      pulseRevLoudness: 1.1, // a two-stroke gets louder faster as it revs
      pulseLoudnessCap: 2,
      recRevGain: 1,
      recIdleSource: 'quad',
      recBlendLo: 2600,
      recBlendHi: 3600,
      recToneClosed: 8000,
      recVolume: 0.42, // idles as loud as it did on the yellow's bank
      pipeLength: 0.95,
      mufflerFreqA: 210,
      densityRefRpm: 2400,
    },
    smoke: {
      warmDensity: 0.45,
      coldDensity: 0.85,
      warmGray: 0.8,
      coldGray: 0.9,
      tint: '#dde6ff',
    },
  },
  {
    // A smart new quad on loan for the day: the Yamaha's body in neutral silver, fuel injected so it hardly wants any choke, starts on
    // the button, idles smooth and quiet and has almost no wear. Full tank, and a bit more power than the old farm quads.
    id: 'loan',
    steadyLights: true, // a battery runs its headlight, so it doesn't follow the revs like the old quads' (headlight.js)
    label: 'loan quad',
    name: 'Loan quad',
    bodyColor: 0xaeb4ba, // a neutral silver
    style: 'utility2',
    dashStyle: 'kodiak',
    reverseStyle: 'button', // where the reverse is and what it takes to use it (controls.js)
    chokeStyle: 'thumb', // where the choke is and what it takes to reach it
    tapStyle: 'right', // where the fuel tap sits
    hoursRange: [2, 25], // engine hours showing when the game starts
    odoRange: [5, 60], // odometer miles showing when the game starts
    wearRange: [0, 0.04], // engine wear it comes with (0 new, 1 shot), pulled up by a high hour meter; see history.js
    // Smooth and refined; a small, quick buzz.
    safeIdle: 700,
    idleRange: [1100, 1200],
    roughnessRange: [0, 0.015],
    fuelRange: [9, 11], // 12 litre tank, brought full
    topRpmRange: [6900, 7100], // full-throttle revs this game, about 4% either side of the engine's own
    fuel: { tankCapacity: 12, reserveLitres: 1.8, burnPerRev: 0.000075 },
    engine: {
      idleRpmWarm: 1150,
      maxRpm: 7000,
      redlineRpm: 6600,
      rpmRiseRate: 9,
      rpmFallRate: 7.5,
      warmUpSeconds: 70,
      coldEnrichmentNeed: 0.45,
      chokeIdleRpm: 1200,
      catchChance: 0.9,
      coldRoughness: 0.2,
      coldPowerLoss: 0.95,
      wearPerMinute: 0.0008, // new: a fifteenth of the usual wear, it takes hours of thrashing to rough it up
    },
    vehicle: {
      mass: 295,
      maxDriveForce: 2500,
      maxSpeed: 19.5,
      maxSteerDeg: 35,
    },
    vibration: {
      pulseGain: 0.8,
      heaveDamping: 0.34,
      pitchDamping: 0.3,
      barsGain: 0.08,
    },
    audio: {
      recIdleSource: 'quad',
      recVolume: 0.45,
      pipeLength: 1.4,
      recToneClosed: 4200,
    },
    smoke: {
      warmDensity: 0.1,
      coldDensity: 0.35,
      tint: '#e8eef5',
    },
  },
];

// The tractor: always on the farm (it isn't part of the fleet, src/vehicle/fleet.js) and the girls leave it alone for now (it's TODO 8's
// own; they come to it in 11 and 14). An old diesel in the yard: heavy, slow and strong, with a clutch and a three-speed gearbox, glow
// plugs for a cold start, a hand throttle and a stop knob. Built as a QuadUnit like the rest, with its own body, wheels and drivetrain
// (QuadUnit reads `tractor`). Runs on red diesel, so it doesn't mind it. Its sound is kyles's old tractor recordings.
export const TRACTOR_SPEC = {
  id: 'tractor',
  steadyLights: true, // a battery runs its lights
  label: 'tractor',
  name: 'Tractor',
  tractor: true,
  wheelShake: 1.3, // its wheels shake with the body (a multiple of the body's own heave, pitch and roll)
  bodyColor: 0xa82a20, // a faded red bonnet
  dashStyle: 'tractor',
  hoursRange: [3500, 7500], // engine hours showing when the game starts
  odoRange: [5000, 15000], // odometer miles it has done, kept in the background (its dash has no odometer, a pod could show it); follows the hours
  handStartRange: [0.05, 0.45], // where the hand throttle is left when the game starts (the gearbox's handStart is the fallback)
  // A big lazy diesel: low, lumpy tickover and a slow heave.
  safeIdle: 400,
  idleRange: [430, 470], // a big diesel tickovers slowly
  roughnessRange: [0.05, 0.08], // a diesel ticks over steadily
  fuelRange: [12, 34], // 45 litre tank, 4 litre reserve
  topRpmRange: [2150, 2250], // full-throttle revs this game, about 4% either side of the engine's own
  fuel: { tankCapacity: 45, reserveLitres: 4, startDiesel: 1, noTap: true, startTap: 'on', burnPerRev: 0.0003, idleBurnFraction: 0.3, bowlCapacity: 0.05, bowlFillRate: 0.06 },
  engine: {
    compressionIgnition: true, // glow plugs, no choke, the key doesn't stop it, a knob does (src/engine/compression.js)
    runsOnDiesel: true,
    idleRpmWarm: 450,
    maxRpm: 2200,
    redlineRpm: 2100,
    stallRpm: 280,
    crankRpm: 220, // a heavy engine turns over slowly
    catchRpm: 1000,
    rpmRiseRate: 3.4,
    rpmFallRate: 2.8,
    loadDragRpm: 1400, // dumping the clutch in too high a gear drags it down and stalls it (manualDrivetrain.js)
    warmUpSeconds: 260,
    coldEnrichmentNeed: 0, // no mixture to enrich
    chokeIdleRpm: 0,
    catchChance: 0.85,
    catchColdFactor: 0.9,
    coldRoughness: 0.5,
    coldPowerLoss: 0.4,
    lugDepth: 0.35, // a lot of torque: it hardly sags under load
    popProne: 0,
    // Steady as a clock at idle: no hunting, wandering or stumbling, a barely uneven beat.
    roughHunt: 0,
    erraticHunt: 0,
    huntRpm: 0,
    stumbleRate: 0,
    misfireBase: 0,
    misfireRoughness: 0.02,
    cycleJitter: 0.03,
    pulseStrengthJitter: 0.1,
    coldRoughness: 0.12,
    wearPerMinute: 0.0006, // slow: it's built to be run all day
  },
  vehicle: {
    mass: 2000,
    centreOfMassY: -0.2,
    rollInertia: 650,
    pitchInertia: 1800,
    yawInertia: 1900,
    wheelRadius: 0.72, // the big rear wheels; the front ones' own radius is in TRACTOR_LAYOUT
    suspensionRestLength: 0.12,
    maxSuspensionTravel: 0.14,
    suspensionStiffness: 24,
    suspensionCompression: 3,
    suspensionRelaxation: 2.6,
    maxSuspensionForce: 90000,
    mudFrictionSlip: 0.95, // big lugged tyres
    fourWheelDrive: 0, // rear wheel drive
    maxDriveForce: 5200,
    maxSpeed: 8.5,
    maxReverseSpeed: 2.6,
    maxSteerDeg: 38,
    steerRate: 2.6,
    steerSpeedReduction: 0.08,
    idleTorque: 0.12,
    drivePowerFloor: 0.55,
    engineBrakeForce: 900,
    maxBrake: 70,
    parkingBrake: 40,
    rollingResistance: 2.5,
    cvtShiftSpeed: 1,
    launchLoad: 0.6,
    mudLoad: 0.08,
    revHoldMin: 2, // getting off never leaves it revving: the hand throttle does that
  },
  vibration: {
    firingsPerCycle: 4, // a four-cylinder: a quick, even shudder at the firing rate (15 a second at idle), not one heave a cycle
    idleRpm: 600, // and it smooths out as the revs rise
    smoothRpmRange: 1000,
    pulseGain: 1.7,
    heaveFreq: 6.5,
    pitchFreq: 5.5,
    rollFreq: 6,
    heaveGain: 0.2,
    pitchGain: 0.3,
    heaveDamping: 0.26,
    barsFreq: 14,
    barsGain: 0.12,
  },
  audio: {
    recBank: 'engine-bank-tractor',
    recIdleSource: 'quad',
    pulseRefRpm: 450,
    pulseRevLoudness: 0.15, // it's already loud and lumpy; it doesn't need to get much louder
    recVolume: 0.55,
    recToneClosed: 4200,
    pipeLength: 1.6,
    densityRefRpm: 900,
  },
  smoke: {
    opacity: 2.2,
    maxPerSecond: 110,
    lifeMax: 7,
    warmDensity: 0.5, // even at idle it's a steady dark plume
    coldDensity: 0.9,
    throttleBurst: 4, // a huge dark burst every time you blip it
    throttleDensity: 1.4, // and a thick black column whenever it's working
    throttleBlack: 0.8,
    burstBlack: 0.95,
    catchBlack: 1,
    coldGray: 0.3,
    warmGray: 0.22,
    startSize: 0.16,
    endSize: 3.6,
    exitSpeed: 3.2,
    throttleExitSpeed: 5,
    buoyancy: 0.9,
    tint: '#c9ccd0',
  },
};

// The UTV: always on the farm, parked in the yard (like the tractor it isn't in the fleet and isn't one of the girls' quads). A
// Gator-style side-by-side on red diesel: a three-cylinder with glow plugs and a key that stops it, an automatic (the quads' CVT
// drivetrain, with a forward and reverse lever on the dash), a steering wheel on the right, a bench seat for three and a tipping bed.
// Built as a QuadUnit like the rest (QuadUnit reads `utv`). Unlike the tractor it is fussy about its fuel: petrol in it soaks the
// engine the way diesel soaks the quads' (engine/diesel.js, `petrolFussy`). The girls ride in it (npc/utvRide.js) but don't drive it yet.
// Its sound borrows the tractor's recordings, played faster.
export const UTV_SPEC = {
  id: 'utv',
  label: 'UTV',
  name: 'UTV',
  utv: true,
  steadyLights: true, // a battery runs its lamps
  wheelShake: 0.9,
  bodyColor: 0x367c2b, // a deep farm green
  dashStyle: 'utv',
  reverseStyle: 'dashLever', // the forward and reverse lever on the dash wants it stopped (controls.js)
  driveSwitch: true, // the console's 2WD / 4WD switch (driveMode.js), as on the Land Rover
  diffLock: true, // and its diff lock
  hoursRange: [900, 2600], // engine hours showing when the game starts
  odoRange: [4000, 11000], // odometer miles, kept for the dash's hour meter's company (it has no odometer drum)
  safeIdle: 700,
  idleRange: [940, 1000], // about where the Gator in its sound recording ticks over (970), so the recording plays at its own speed
  roughnessRange: [0.06, 0.1], // a small diesel ticks over steadily, with a touch of rattle
  fuelRange: [10, 24], // 30 litre tank, 3 litre reserve
  topRpmRange: [3150, 3250], // full-throttle revs this game, about 2% either side of the engine's own
  fuel: { tankCapacity: 30, reserveLitres: 3, startDiesel: 1, noTap: true, startTap: 'on', burnPerRev: 0.00012, idleBurnFraction: 0.3, bowlCapacity: 0.05, bowlFillRate: 0.06 },
  engine: {
    compressionIgnition: true, // glow plugs, no choke (src/engine/compression.js)
    runsOnDiesel: true,
    keyStops: true, // the key stops it, there is no knob
    petrolFussy: true, // petrol in the tank soaks it the way diesel soaks a petrol quad
    idleRpmWarm: 970,
    maxRpm: 3200,
    redlineRpm: 3100,
    stallRpm: 450,
    loadDragRpm: 1500, // a diesel three with a heavy flywheel: a hard stop doesn't stall it warm (the quads' 4000 did, every time); stone cold it still can
    crankRpm: 260,
    catchRpm: 1300,
    rpmRiseRate: 4.2,
    rpmFallRate: 3.4,
    warmUpSeconds: 200,
    coldEnrichmentNeed: 0, // no mixture to enrich
    chokeIdleRpm: 0,
    catchChance: 0.85,
    catchColdFactor: 0.9,
    coldRoughness: 0.14,
    coldPowerLoss: 0.35,
    lugDepth: 0.3, // a lot of low-down torque: it hardly sags under load
    popProne: 0,
    roughHunt: 0,
    erraticHunt: 0,
    huntRpm: 0,
    stumbleRate: 0,
    misfireBase: 0,
    misfireRoughness: 0.02,
    cycleJitter: 0.03,
    pulseStrengthJitter: 0.1,
    wearPerMinute: 0.0007,
  },
  vehicle: {
    mass: 760, // with its driver
    centreOfMassY: -0.1,
    rollInertia: 170,
    pitchInertia: 380,
    yawInertia: 420,
    wheelRadius: 0.34,
    suspensionRestLength: 0.2,
    maxSuspensionTravel: 0.22,
    suspensionStiffness: 26,
    suspensionCompression: 2.8,
    suspensionRelaxation: 2.4,
    maxSuspensionForce: 60000,
    mudFrictionSlip: 0.85, // chunky farm tyres
    fourWheelDrive: 0, // the console's 4WD switch decides
    maxDriveForce: 4300,
    maxSpeed: 11.2, // 25 mph, what they are limited to
    maxReverseSpeed: 3.4,
    maxSteerDeg: 32,
    steerRate: 3,
    steerSpeedReduction: 0.05,
    clutchEngageRpm: 1150, // an idling diesel creeps away on the lever
    clutchFullRpm: 2100,
    couplingRpm: 1700,
    idleTorque: 0.2,
    drivePowerFloor: 0.5,
    engineBrakeForce: 700,
    maxBrake: 32,
    parkingBrake: 14,
    rollingResistance: 0.8,
    cvtShiftSpeed: 2.5,
    launchLoad: 0.6,
    mudLoad: 0.1,
    revHoldMin: 2, // getting off never leaves it revving
  },
  vibration: {
    steadiness: 0.6, // a small diesel three: a regular rock, but rougher than the Land Rover's petrol four (0.85)
    firingsPerCycle: 3, // a three-cylinder: a quick, even shudder
    idleRpm: 700,
    smoothRpmRange: 1200,
    pulseGain: 1.4,
    heaveFreq: 7,
    pitchFreq: 6,
    rollFreq: 6.5,
    heaveGain: 0.16,
    pitchGain: 0.22,
    heaveDamping: 0.3,
    barsFreq: 16,
    barsGain: 0.09,
  },
  audio: {
    recBank: 'engine-bank-utv', // a John Deere Gator's three-cylinder diesel, recorded on the vehicle
    recIdleSource: 'quad',
    pulseRefRpm: 970,
    pulseRevLoudness: 0.25,
    recVolume: 1.12, // the Gator's bank plays quieter than the tractor's did, and the boom cut takes more: this keeps its idle as loud
    recStarterVolume: 1.12, // its starter as loud against its idle as in the recording (the bank's starter gain sets that against an idle of 1)
    pulseBoomCut: 14, // Jamie's pick: the Gator was recorded on the vehicle, with a boom at 80 to 140 Hz from its body
    pulseBoomFreq: 110,
    recToneClosed: 4200,
    pipeLength: 1.2,
    densityRefRpm: 1200,
  },
  smoke: {
    opacity: 1.8,
    maxPerSecond: 90,
    lifeMax: 6,
    warmDensity: 0.25, // a faint grey at idle
    coldDensity: 0.7,
    throttleBurst: 2.5,
    throttleDensity: 1.0, // and black when it's working hard
    throttleBlack: 0.7,
    burstBlack: 0.9,
    catchBlack: 1,
    coldGray: 0.3,
    warmGray: 0.2,
    startSize: 0.12,
    endSize: 2.8,
    exitSpeed: 3,
    throttleExitSpeed: 4.5,
    buoyancy: 0.9,
    tint: '#c9ccd0',
  },
};

// The old Land Rover in the yard: a Series 88-inch pick-up with a 2.25 litre petrol four, in Bronze Green with a white cab roof. Built
// like the UTV (a unit you drive, with a bench for three across the front) but treated like a petrol quad: wear, faults, the battery, a
// choke, the toolbox. A four-speed manual with no synchromesh on first and second, a transfer lever for 2WD and 4WD and a diff lock, a
// hand throttle on the dash, a towing hitch, and a starting handle at the front for when the battery won't (vehicle/crankHandle.js).
export const LAND_ROVER_SPEC = {
  id: 'landrover',
  label: 'Series III',
  name: 'Series III',
  landRover: true,
  scale: 1.15, // the model and its physics, a size up: built to a real Series's measurements it looked small beside the girls
  steadyLights: true, // a battery runs its lamps
  wheelShake: 0.8,
  bodyColor: 0x3b4a36, // Bronze Green
  dashStyle: 'series',
  driveSwitch: true, // the yellow-knobbed transfer lever: 2WD (rear only) or 4WD (driveMode.js)
  diffLock: true, // and a diff lock
  chokeStyle: 'knob', // a pull-out knob on the dash
  hoursRange: [0, 0], // no hour meter
  odoRange: [60000, 140000], // miles on the clock
  wearRange: [0.04, 0.12], // old and well used, but four cylinders hide it: a quad's wear would make it lumpy
  safeIdle: 420,
  idleRange: [470, 510], // a 2.25 petrol ticks over slowly; the Jeep in its sound recording runs at 500 (474 to 528), so its beats play at their own pace
  roughnessRange: [0.04, 0.1],
  fuelRange: [12, 40], // 45 litre tank, 5 litre reserve
  topRpmRange: [4100, 4300],
  manual: true, // a clutch (Shift) and a four-speed gearbox (src/vehicle/manualDrivetrain.js)
  gearbox: {
    gears: 4,
    crashGears: 2, // no synchromesh on first and second: they crunch if you go into them on the move
    crashSpeed: 1,
    topSpeed1: 4.5, // about 10 mph: the gears step up evenly, about 1.75 each, like the real box's
    topSpeed2: 8,
    topSpeed3: 14,
    topSpeed4: 24, // flat out it settles just short of this, about 52 mph (the drive fades to nothing at it)
    topSpeedReverse: 2.6,
    torque1: 1,
    torque2: 0.72,
    torque3: 0.5,
    torque4: 0.38,
    torqueReverse: 0.95,
    launchLoad1: 0.15, // a heavy flywheel: it pulls away in first without any throttle
    launchLoad2: 0.45,
    launchLoad3: 0.85,
    launchLoad4: 1.1,
    lugSpeed: 0.15, // braking only drags it down below this share of the gear's top speed, where the revs would be near idle
    handStart: 0, // the hand throttle, pushed in
  },
  fuel: { tankCapacity: 45, reserveLitres: 5, noTap: true, startTap: 'on', burnPerRev: 0.0003, idleBurnFraction: 0.3 },
  engine: {
    loadDragRpm: 2200, // a manual: slowing in third or fourth with the clutch out stalls it; first and second hold on (a heavy flywheel)
    pullStart: true, // the starting handle (vehicle/crankHandle.js): a swing is the engine's pull
    crankHandle: true,
    pullSeconds: 0.7, // one swing turns it over about once
    pullRpmFactor: 0.6, // more slowly than the starter
    pullGoodMin: 0.35,
    pullGoodMax: 0.9,
    pullLateMax: 1.5,
    idleRpmWarm: 490,
    maxRpm: 4200,
    redlineRpm: 4000,
    stallRpm: 300,
    crankRpm: 170,
    catchRpm: 700,
    rpmRiseRate: 3.5, // a heavy flywheel: slow to rev up and slow to fall
    rpmFallRate: 2.8,
    warmUpSeconds: 300,
    lugDepth: 0.4, // plenty of low-down pull
    wearPerMinute: 0.0003,
    cylinders: 4, // fires four times a cycle, evenly: a misfire or a weak beat is one of four, and the others carry it
    // Each firing varies a little, but four of them a cycle average out: an old petrol four ticks over steadily, it doesn't lope.
    misfireRoughness: 0.03,
    cycleJitter: 0.04,
    pulseStrengthJitter: 0.1,
    roughHunt: 0.04,
    erraticHunt: 0.03,
    stumbleRate: 0.1,
  },
  vehicle: {
    mass: 1350, // with its driver
    centreOfMassY: -0.05,
    rollInertia: 320,
    pitchInertia: 760,
    yawInertia: 820,
    wheelRadius: 0.437, // 0.38 m tyres at the model's 1.15 scale
    suspensionRestLength: 0.23, // the model's 0.2 m at its 1.15 scale, so the tyres stand on the ground rather than in it
    maxSuspensionTravel: 0.16, // leaf springs: not much travel
    suspensionStiffness: 32,
    suspensionCompression: 3,
    suspensionRelaxation: 2.6,
    maxSuspensionForce: 90000,
    mudFrictionSlip: 0.8,
    fourWheelDrive: 0, // the transfer lever decides
    maxDriveForce: 7000,
    maxSpeed: 24,
    maxReverseSpeed: 2.6,
    maxSteerDeg: 32,
    steerRate: 2.2, // heavy steering, no power assistance
    steerSpeedReduction: 0.08, // a heavy, tall thing at 50 mph: about 11 degrees of lock
    engineBrakeForce: 1100,
    maxBrake: 48,
    parkingBrake: 22,
    parkedHoldSpeed: 0.4, // a parked one creeping slower than this is held still: heavy, it could slide on at 0.3 m/s on a slope and never be caught at the quads' 0.15
    rollingResistance: 1.0,
    revHoldMin: 2, // getting off never leaves it revving
  },
  vibration: {
    steadiness: 0.85, // an old four ticks over in a regular rock, unlike the quads' random kicks
    firingsPerCycle: 1, // the engine already fires four times a cycle (engine.cylinders): one kick each
    idleRpm: 490,
    smoothRpmRange: 1500,
    pulseGain: 1.2,
    heaveFreq: 5.5,
    pitchFreq: 5,
    rollFreq: 5.5,
    heaveGain: 0.14,
    pitchGain: 0.2,
    heaveDamping: 0.32,
    barsFreq: 14,
    barsGain: 0.1,
  },
  audio: {
    recBank: 'engine-bank-landy', // an old Jeep's four-cylinder petrol idling (craigsmith), and a car started on a handle
    recIdleSource: 'quad',
    pulseRefRpm: 490,
    pulseDivide: 3, // Jamie: at its own pace the Jeep's idle sounded far too quick for it; a third of the pace, one beat every third firing
    pulseSlowest: 0.25, // each 61 ms beat stretched to fill three firings (about 190 ms at idle) with no gap after it
    pulseRevLoudness: 0.3,
    pulsePitchFollow: 0.25, // one recorded beat per firing, at about its own speed: the beats come faster as it revs, the note barely rises
    recVolume: 0.6,
    recStarterVolume: 0.6, // as loud against its idle as the truck's starter was against its own
    recToneClosed: 5000,
    pipeLength: 1.4,
    densityRefRpm: 900,
  },
  smoke: {
    warmDensity: 0.15,
    coldDensity: 0.5,
  },
};

// The early-90s Land Rover 90 County station wagon, the 200TDi: a 2.5 litre turbo diesel, a square back with the spare on its rear door,
// a newer dash (a rev counter, a belt lamp and bong) and centre console, in a faded pastel green. Built on the Series' model and
// drive: a unit you drive with a clutch and a five-speed (synchro on all of them, unlike the Series' four), a transfer lever and a diff lock, a
// bench for three. Its engine and sound borrow the UTV's diesel (a different idle and top end, much rattlier). It has glow plugs and the key
// stops it, so no choke, no hand throttle and no starting handle.
export const DEFENDER_SPEC = {
  id: 'landrover200',
  label: '200TDi',
  name: '200TDi',
  landRover: true,
  defender: true,
  scale: 1.15,
  steadyLights: true,
  wheelShake: 0.55,
  bodyColor: 0x8aa38a, // a faded pastel green
  dashStyle: 'defender',
  driveSwitch: true,
  diffLock: true,
  hoursRange: [0, 0], // no hour meter
  odoRange: [90000, 210000],
  wearRange: [0.05, 0.14],
  safeIdle: 650,
  idleRange: [770, 830], // a 200TDi ticks over at about 800
  roughnessRange: [0.1, 0.16], // a rattly old diesel
  fuelRange: [14, 46], // 54 litre tank, 5 litre reserve
  topRpmRange: [4350, 4450],
  manual: true,
  gearbox: {
    ...LAND_ROVER_SPEC.gearbox,
    gears: 5, // the LT77: a fifth to cruise in
    crashGears: 0, // synchromesh on all of them
    topSpeed1: 5.0,
    topSpeed2: 8.6,
    topSpeed3: 13.6,
    topSpeed4: 21,
    topSpeed5: 32, // about 72 mph flat out: the gears step up about 1.55 each, the top one a little longer
    torque1: 1,
    torque2: 0.8,
    torque3: 0.6,
    torque4: 0.46,
    torque5: 0.38,
    launchLoad4: 1.15,
    launchLoad5: 1.3,
  },
  fuel: { tankCapacity: 54, reserveLitres: 5, startDiesel: 1, noTap: true, startTap: 'on', burnPerRev: 0.00022, idleBurnFraction: 0.3, bowlCapacity: 0.05, bowlFillRate: 0.06 },
  engine: {
    ...UTV_SPEC.engine,
    idleRpmWarm: 800,
    maxRpm: 4400,
    redlineRpm: 4300,
    stallRpm: 350,
    loadDragRpm: 2000, // a manual diesel: slowing in third or fourth with the clutch out stalls it
    crankRpm: 230,
    catchRpm: 1000,
    rpmRiseRate: 3.8,
    rpmFallRate: 3,
    warmUpSeconds: 240,
    misfireRoughness: 0.03,
    cycleJitter: 0.05, // rattly: each firing varies more than the UTV's
    pulseStrengthJitter: 0.16,
    wearPerMinute: 0.0005,
  },
  vehicle: {
    ...LAND_ROVER_SPEC.vehicle,
    mass: 1750,
    maxDriveForce: 8400, // a turbo diesel's torque
    maxSpeed: 32,
    engineBrakeForce: 1300,
    maxBrake: 52,
    parkingBrake: 30, // 1,750 kg to hold on a slope (the Series' 22 is for 1,350)
    suspensionStiffness: 32, // coil springs, but not bouncy: Jamie found the first go too bouncy
    suspensionCompression: 4.4, // damped harder than the Series' (3) so it settles after a bump instead of rocking
    suspensionRelaxation: 3.8, // (2.6)
    maxSuspensionTravel: 0.18,
  },
  vibration: {
    ...LAND_ROVER_SPEC.vibration,
    steadiness: 0.4, // a diesel four rattles and shakes: far less regular than the Series' petrol four
    idleRpm: 800,
    pulseGain: 1.4, // (the first go had 1.9, 0.2 and 0.26 for these three: too much body motion at idle)
    heaveGain: 0.12,
    pitchGain: 0.16,
    heaveDamping: 0.45,
  },
  // The UTV's Gator diesel for now, at its own idle pace, with a van's diesel starter. The van's idle was quiet, so its starter at the
  // van's own balance came out 5 dB over the 200TDi's rattly idle; 0.39 puts it about 2 dB under.
  audio: { ...UTV_SPEC.audio, pulseRefRpm: 800, recStarterSet: 'Tdi', recStarterVolume: 0.39 },
  smoke: { ...UTV_SPEC.smoke },
};

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
      recBank: 'engine-bank-2t',
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
      recIdleSource: 'third',
      pulseRefRpm: 1050,
      pulseRevLoudness: 0.05, // its recorded pulses are already punchy when cut short; it hardly needs to get louder
      recVolume: 0.5,
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
    // sound for now. Built by miniMotoModel.js: it rides on the quad physics with two hidden outrigger wheels to hold it upright, and
    // leans into corners for show. Anyone can ride it (it's nobody's), but there's no room on the back.
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
      centreOfMassY: -0.22, // low, and the outriggers stiff and wide, so it stays up without a rider balancing it
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
    // The kids' quad's sound until it gets its own.
    audio: {
      recBank: 'engine-bank-50',
      engineSound: 'pulse',
      recIdleSource: 'quad',
      pulseRefRpm: 1800,
      recBlendLo: 3200,
      recBlendHi: 4200,
      recToneClosed: 9500,
      recVolume: 0.5,
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
    // The yellow's sound until it gets its own.
    audio: {
      recBank: 'engine-bank-2t',
      pulseRefRpm: 1500,
      pulseRevLoudness: 1.1, // a two-stroke gets louder faster as it revs
      pulseLoudnessCap: 2,
      recRevGain: 1,
      recIdleSource: 'quad',
      recBlendLo: 2600,
      recBlendHi: 3600,
      recToneClosed: 8000,
      recVolume: 0.55,
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

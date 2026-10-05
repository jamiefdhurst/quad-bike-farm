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
    dashStyle: 'classic',
    // The smooth one: a steady idle and a gentle shake.
    safeIdle: 650,
    idleRange: [1050, 1150],
    roughnessRange: [0.04, 0.12],
    fuelRange: [2.5, 11], // 12 litre tank, 2 litre reserve
    fuel: {},
    engine: {},
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
    dashStyle: 'modern',
    // Fast, keen idle; a medium, quicker buzz.
    safeIdle: 950,
    idleRange: [1400, 1550],
    roughnessRange: [0.2, 0.3],
    fuelRange: [1.2, 8], // 11 litre tank, 1.8 litre reserve: some games it starts on its reserve
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
    dashStyle: 'sport',
    // Ring-ding idle; a fine high-frequency buzz through the bars more than the body.
    safeIdle: 900,
    idleRange: [1500, 1800],
    roughnessRange: [0.35, 0.5],
    fuelRange: [1.5, 8], // 9 litre tank, 1.5 litre reserve
    fuel: { tankCapacity: 9, startOil: 0.02, reserveLitres: 1.5, burnPerRev: 0.000032, idleBurnFraction: 0.45 },
    engine: {
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
    dashStyle: 'vintage',
    // Slow and lumpy; a big slow heave, like a tractor.
    safeIdle: 800,
    idleRange: [800, 900],
    roughnessRange: [0.55, 0.7],
    fuelRange: [3, 13], // 14 litre tank, 2.5 litre reserve
    fuel: { tankCapacity: 14, reserveLitres: 2.5, burnPerRev: 0.000085 },
    engine: {
      idleRpmWarm: 1050,
      maxRpm: 5600,
      redlineRpm: 5200,
      rpmRiseRate: 5.5,
      rpmFallRate: 4.5,
      loadDragRpm: 1700, // a heavy flywheel: braking drags it down less
      warmUpSeconds: 190,
      coldEnrichmentNeed: 1.15,
      chokeIdleRpm: 1100,
      catchChance: 0.45,
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
    dashStyle: 'race',
    // A nervous, hunting idle; harsh and hard.
    safeIdle: 1600,
    idleRange: [2000, 2300],
    roughnessRange: [0.75, 0.9],
    fuelRange: [1.5, 7.5], // 8 litre tank, 1.2 litre reserve
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
    // A kids' 50cc two-stroke that Jess insists on riding. Three quarters the size of the others (scale shrinks the model and the
    // physics together), light and slow, one seat, and it revs very high and sounds like an angry wasp. Pull-start as well as the
    // starter; it runs on the same pre-mix as the yellow.
    id: 'kids',
    label: "kids' quad",
    name: "Kids' quad",
    bodyColor: 0xdc3f8f,
    style: 'sport',
    dashStyle: 'sport',
    scale: 0.75,
    solo: true, // no room for anyone on the back
    owner: 'jess', // Amy won't ride it, and Jess goes for it first
    // A thin, fast buzz.
    safeIdle: 1500,
    idleRange: [2000, 2300],
    roughnessRange: [0.3, 0.5],
    fuelRange: [0.4, 2.2], // 2.5 litre tank, 0.4 litre reserve
    fuel: { tankCapacity: 2.5, startOil: 0.02, reserveLitres: 0.4, burnPerRev: 0.000032, idleBurnFraction: 0.45 },
    engine: {
      strokes: 2,
      popProne: 0.7, // two-strokes crackle and bang on the overrun
      pullStart: true,
      idleRpmWarm: 2100,
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
      wheelRadius: 0.225, // 0.3 m scaled by 0.75
      suspensionRestLength: 0.18,
      maxSuspensionTravel: 0.15,
      maxSuspensionForce: 12000,
      maxDriveForce: 700,
      maxSpeed: 9.5,
      maxSteerDeg: 36,
      clutchEngageRpm: 3000,
      clutchFullRpm: 4600,
      couplingRpm: 3600,
      engineBrakeForce: 40,
      powerbandRpm: 6000,
      torqueBelowBand: 0.5,
      fourWheelDrive: 0,
    },
    vibration: {
      pulseGain: 0.8,
      idleRpm: 2300,
      barsFreq: 28,
      barsGain: 0.2,
      heaveFreq: 12,
      pitchFreq: 10,
      heaveDamping: 0.16,
    },
    audio: {
      recBank: 'engine-bank-2t',
      recIdleSource: 'quad',
      pulseRefRpm: 2100,
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
    // A smart new quad on loan for the day: the Yamaha's body in deep teal, fuel injected so it hardly wants any choke, starts on
    // the button, idles smooth and quiet and has almost no wear. Full tank, and a bit more power than the old farm quads.
    id: 'loan',
    label: 'loan quad',
    name: 'Loan quad',
    bodyColor: 0x0f7f86,
    style: 'utility2',
    dashStyle: 'modern',
    // Smooth and refined; a small, quick buzz.
    safeIdle: 700,
    idleRange: [1100, 1200],
    roughnessRange: [0.01, 0.04],
    fuelRange: [9, 11], // 12 litre tank, brought full
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
      wearPerMinute: 0.003, // new: it takes a lot of thrashing to rough it up
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

// The quads on the farm. Each spec overrides the default parameters so the
// bikes feel related but not identical. Spawn points come from LAYOUT.spawn.quads,
// in the same order.
//
// Each game these are picked evenly at random within their ranges (from the
// layout seed, so ?seed=N repeats them):
//   idleRange: [min, max] warm idle in rpm. Keep the minimum at or above about
//     650 (red), 950 (blue) and 900 (yellow): lower than that and a warm engine
//     can stall under hard braking.
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
    idleRange: [650, 1200],
    roughnessRange: [0.04, 0.14],
    fuelRange: [2.5, 11], // 12 litre tank, 2 litre reserve
    fuel: {},
    engine: {},
    vehicle: {},
    vibration: {},
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
    idleRange: [950, 1550],
    roughnessRange: [0.06, 0.3],
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
    },
    audio: {
      recIdleSource: 'rev',
      pulseRefRpm: 1450,
      recToneClosed: 7000,
      pipeLength: 1.0,
      mufflerFreqA: 185,
    },
    smoke: {
      coldDensity: 0.52,
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
    idleRange: [900, 2000],
    roughnessRange: [0.1, 0.4],
    fuelRange: [1.5, 8], // 9 litre tank, 1.5 litre reserve
    fuel: { tankCapacity: 9, reserveLitres: 1.5, burnPerRev: 0.000032, idleBurnFraction: 0.45 },
    engine: {
      strokes: 2,
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
    },
    vibration: {
      pulseGain: 1.1,
      idleRpm: 2300,
      smoothRpmRange: 2200,
      barsHighRpmFloor: 0.5,
      barsFreq: 22,
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
      warmDensity: 0.22,
      coldDensity: 0.6,
      warmGray: 0.82,
      coldGray: 0.9,
      tint: '#dde6ff',
    },
  },
];

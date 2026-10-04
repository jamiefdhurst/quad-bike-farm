// The quads on the farm. Each spec overrides the default parameters so the two
// bikes feel related but not identical. Spawn points come from LAYOUT.spawn.quads,
// in the same order.

export const QUAD_SPECS = [
  {
    // Honda-style farm quad: soft, steady, low warm idle. The original tuning.
    id: 'red',
    label: 'red quad',
    name: 'Red quad',
    bodyColor: 0xa8271f,
    dashStyle: 'classic',
    fuel: { startLitres: 7 }, // about 60% of a 12 litre tank
    engine: {},
    vehicle: {},
    vibration: {},
    audio: { recIdleSource: 'quad' },
    smoke: {},
  },
  {
    // Yamaha-style: idles a bit higher, revs harder and higher, needs more choke
    // when cold and runs lumpier until it's warm, warms a little quicker, and
    // pulls slightly harder. Its idle comes from the other recorded machine.
    id: 'blue',
    label: 'blue quad',
    name: 'Blue quad',
    bodyColor: 0x1d4fa3,
    dashStyle: 'modern',
    fuel: { tankCapacity: 11, reserveLitres: 1.8, startLitres: 2.8 }, // about 25%, close to reserve
    engine: {
      idleRpmWarm: 1450,
      maxRpm: 9000,
      redlineRpm: 8000,
      rpmRiseRate: 8.5,
      rpmFallRate: 7,
      warmUpSeconds: 120,
      coldEnrichmentNeed: 1.1,
      chokeIdleRpm: 1300,
      catchChance: 0.55,
      coldRoughness: 0.62,
      coldPowerLoss: 0.84,
      baseRoughness: 0.1,
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
      recToneClosed: 7000,
      pipeLength: 1.0,
      mufflerFreqA: 185,
    },
    smoke: {
      coldDensity: 0.36,
    },
  },
];

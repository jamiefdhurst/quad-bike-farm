// The faults only the barn's shed equipment puts right (DECISIONS.md, #32): four for the compressor, four for the parts washer and four
// for the pit. They start whether or not the piece is owned (that is the reason to buy it), have no rough fix in the yard, and are put
// right by the bench jobs in workshop/shedJobs.js. Pure data: the faults themselves live in faults.js.

/** The piece of equipment that puts each right. */
export const SHED_PIECE_OF = {
  tyreLeak: 'compressor',
  tyreCold: 'compressor',
  tyreUneven: 'compressor',
  valveCore: 'compressor',
  carbGum: 'washer',
  tapClog: 'washer',
  chainGrit: 'washer',
  brakeMud: 'washer',
  exhaustHole: 'pit',
  gasket: 'pit',
  caliper: 'pit',
  bearing: 'pit',
};

export const SHED_KINDS = Object.keys(SHED_PIECE_OF);

/** The faults that sit on one wheel (faults.wheelOf says which). */
export const SHED_WHEEL_KINDS = ['tyreUneven', 'valveCore', 'caliper', 'bearing'];

export const DEFAULT_SHED_FAULT_PARAMS = {
  // How often each one starts, as the average seconds of the right kind of use per fault.
  tyreLeakEvery: 5400, // riding: a bead or a rim seam seeping air
  tyreColdEvery: 1500, // on a cold morning (below tyreColdBelow), parked or ridden: the air in the tyres contracting
  tyreUnevenEvery: 4800, // riding: one tyre left lower than the rest after a knock
  valveCoreEvery: 9000, // any time: a valve core that no longer seals
  carbGumEvery: 5400, // the engine running: varnish from old fuel building up in the jets
  tapClogEvery: 6000, // the engine running: sediment clogging the fuel tap's gauze
  chainGritEvery: 4200, // riding, on a chain-driven quad: mud and grit packed into the chain
  brakeMudEvery: 4200, // riding: mud caked in the pads and calipers
  exhaustHoleEvery: 7200, // the engine running: the silencer rusting through
  gasketEvery: 7200, // the engine running, on a four-stroke with a sump: the gasket weeping
  caliperEvery: 6000, // riding: a caliper piston sticking
  bearingEvery: 7200, // riding: a wheel bearing running dry
  // How long each takes to go from just started to as bad as it gets.
  tyreLeakSeconds: 1500,
  tyreColdSeconds: 600,
  tyreUnevenSeconds: 900,
  valveCoreSeconds: 1200,
  carbGumSeconds: 1800,
  tapClogSeconds: 1500,
  chainGritSeconds: 1200,
  brakeMudSeconds: 1200,
  exhaustHoleSeconds: 1800,
  gasketSeconds: 1800,
  caliperSeconds: 1200,
  bearingSeconds: 2400,
  // What they do at their worst.
  tyreColdBelow: 6, // degrees C under which the air has contracted enough to matter; the colder, the quicker it starts
  tyreLeakBleed: 0.002, // psi a second off every tyre
  tyreColdDrop: 1.6, // psi that the tyres cannot hold above stock
  tyreUnevenDrop: 1.8, // psi that one tyre sits under stock
  valveCoreBleed: 0.004, // psi a second off that wheel, while the vehicle stands (it seeps when parked, so it is flat in the morning)
  carbGumDirt: 0.85, // how dirty the carb runs at its worst, as a share of a fully dirty one (the usual carb job does not reach it)
  tapClogLoss: 0.5, // drive lost to a fully clogged tap at full throttle: the carb runs short
  chainGritWear: 2.5, // extra stretching, and drying of the oil, for a fully gritty chain (1 + this)
  brakeMudFade: 0.55, // braking lost to fully caked brakes
  exhaustHoleLoud: 0.8, // how loud a fully holed silencer is, as a share of one taken off
  exhaustHoleLoss: 0.12, // drive lost to a holed silencer's lost back-pressure and leaking gas
  gasketBleed: 0.0015, // sump level lost a second at the worst, while the engine runs
  caliperDrag: 0.3, // drive lost to a fully dragging caliper
  bearingDrag: 0.1, // drive lost to a fully run-dry bearing
  bearingWobble: 0.05, // radians that wheel shimmies side to side, for show
};

export const SHED_FAULT_RANGES = {
  tyreLeakEvery: [60, 20000, 60],
  tyreColdEvery: [30, 20000, 30],
  tyreUnevenEvery: [60, 20000, 60],
  valveCoreEvery: [60, 30000, 60],
  carbGumEvery: [60, 20000, 60],
  tapClogEvery: [60, 20000, 60],
  chainGritEvery: [60, 20000, 60],
  brakeMudEvery: [60, 20000, 60],
  exhaustHoleEvery: [60, 20000, 60],
  gasketEvery: [60, 20000, 60],
  caliperEvery: [60, 20000, 60],
  bearingEvery: [60, 20000, 60],
  tyreLeakSeconds: [10, 7200, 10],
  tyreColdSeconds: [10, 3600, 10],
  tyreUnevenSeconds: [10, 3600, 10],
  valveCoreSeconds: [10, 3600, 10],
  carbGumSeconds: [10, 7200, 10],
  tapClogSeconds: [10, 7200, 10],
  chainGritSeconds: [10, 7200, 10],
  brakeMudSeconds: [10, 7200, 10],
  exhaustHoleSeconds: [10, 7200, 10],
  gasketSeconds: [10, 7200, 10],
  caliperSeconds: [10, 7200, 10],
  bearingSeconds: [10, 7200, 10],
  tyreColdBelow: [-10, 20, 0.5],
  tyreLeakBleed: [0, 0.02, 0.0005],
  tyreColdDrop: [0, 4, 0.1],
  tyreUnevenDrop: [0, 4, 0.1],
  valveCoreBleed: [0, 0.03, 0.0005],
  carbGumDirt: [0, 1, 0.05],
  tapClogLoss: [0, 1, 0.01],
  chainGritWear: [0, 6, 0.1],
  brakeMudFade: [0, 1, 0.01],
  exhaustHoleLoud: [0, 1, 0.05],
  exhaustHoleLoss: [0, 0.5, 0.01],
  gasketBleed: [0, 0.02, 0.0005],
  caliperDrag: [0, 0.6, 0.01],
  bearingDrag: [0, 0.4, 0.01],
  bearingWobble: [0, 0.2, 0.005],
};

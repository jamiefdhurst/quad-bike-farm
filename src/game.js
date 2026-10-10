import * as THREE from 'three';
import { Input } from './core/input.js';
import { createRandom, startSeed } from './core/random.js';
import { randomiseQuadSpawns, randomJerryCanSpots } from './world/spawns.js';
import { registerTuning } from './core/tuning.js';
import { loadModels } from './world/assets.js';
import { World } from './world/world.js';
import { Player, PLAYER_CAPSULE } from './player/player.js';
import { DEFAULT_PLAYER_PARAMS, PLAYER_PARAM_RANGES } from './player/playerParams.js';
import { QuadUnit } from './vehicle/quadUnit.js';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC, DEFENDER_SPEC } from './vehicle/quadSpecs.js';
import { LANDY_STAND, LANDY_REAR_STAND, LANDY_REAR_SEATS } from './vehicle/landRoverModel.js';
import { DEFAULT_REAR_ACCESS_PARAMS, REAR_ACCESS_PARAM_RANGES, seatTipTargets, easeSeatTips, pickRearSeat, rearDoor } from './vehicle/rearAccess.js';
import { clearOfChassis } from './vehicle/dismount.js';
import { DEFAULT_BIKE_PARAMS, BIKE_PARAM_RANGES } from './vehicle/bikeLean.js';
import { pickFleet } from './vehicle/fleet.js';
import { applyIdle, applyTopRpm, applyVariation, pickIdle } from './vehicle/quadVariation.js';
import { AudioHub } from './audio/engineAudio.js';
import { RideWind, rideBuffers } from './audio/rideAudio.js';
import { overlayPauses } from './core/pause.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from './audio/audioParams.js';
import { Companion } from './npc/companion.js';
import { CompanionVoice } from './npc/companionVoice.js';
import { Speech, CompanionSounds } from './audio/companionAudio.js';
import { DEFAULT_COMPANION_PARAMS, COMPANION_PARAM_RANGES } from './npc/companionParams.js';
import { PILLION_PARAM_RANGES } from './npc/pillionParams.js';
import { CHARACTERS } from './npc/characters.js';
import { girlsLeftOut } from './npc/leftOut.js';
import { Favour, FAVOUR_PARAM_RANGES } from './npc/favour.js';
import { FallingOut, FALLING_OUT_PARAM_RANGES } from './npc/fallingOut.js';
import { Romance, Tryst, ROMANCE_PARAM_RANGES } from './npc/romance.js';
import { pickHistory, pickFaultChance } from './vehicle/history.js';
import { TyreSet, dealTyres, DEFAULT_TYRE_PARAMS, TYRE_PARAM_RANGES } from './vehicle/tyres.js';
import { pushDirection, localAlong } from './vehicle/controls.js';
import { RollWatch, rollReactions, DEFAULT_HANDBRAKE_PARAMS, HANDBRAKE_PARAM_RANGES } from './vehicle/handbrake.js';
import { DEFAULT_DRIVE_PARAMS, DRIVE_PARAM_RANGES, StuckWatch, forgotReaction } from './vehicle/driveMode.js';
import { HEADLIGHT_PARAMS, HEADLIGHT_PARAM_RANGES } from './vehicle/headlight.js';
import { LIGHT_SWITCH_PARAMS, LIGHT_SWITCH_PARAM_RANGES } from './vehicle/lightSwitch.js';
import { INDICATOR_PARAMS, INDICATOR_PARAM_RANGES } from './vehicle/indicators.js';
import { SEAT_BELT_PARAMS, SEAT_BELT_PARAM_RANGES } from './vehicle/seatBelts.js';
import { describeVehicle } from './debug/startReport.js';
import { QuirkSet, DEFAULT_QUIRK_PARAMS, QUIRK_PARAM_RANGES, featuresOf, pickQuirks } from './vehicle/quirks.js';
import { captureStock, tuneTarget, stockSettings, clampSettings, applyTune } from './vehicle/tuneUp.js';
import { startRunningIn } from './engine/runningIn.js';
import { WearLedger, LEDGER_PARAM_RANGES } from './engine/wearLedger.js';
import { LeftRunning, LEFT_PARAM_RANGES } from './npc/leftRunning.js';
import { CarbDrip, DRIP_PARAM_RANGES } from './vehicle/carbDrip.js';
import { pickLeak, levelText } from './engine/coolant.js';
import { Pranks, PRANK_PARAM_RANGES } from './npc/pranks.js';
import { RevOff, REVOFF_PARAM_RANGES } from './npc/revOff.js';
import { DrownOut, DROWNOUT_PARAM_RANGES } from './npc/drownOut.js';
import { Horns, HORN_PARAM_RANGES } from './npc/horns.js';
import { TractorWatch, TRACTOR_WATCH_PARAM_RANGES } from './npc/tractorWatch.js';
import { HayRide, HAYRIDE_PARAM_RANGES } from './npc/hayRide.js';
import { MudguardRide, MUDGUARD_PARAM_RANGES } from './npc/mudguardRide.js';
import { TractorMount } from './vehicle/tractorMount.js';
import { UtvMount } from './vehicle/utvMount.js';
import { BENCH_SEATS, benchDismountSpots, pickBenchSeat } from './vehicle/benchSeat.js';
import { UtvBed, UTV_BED_PARAM_RANGES } from './vehicle/utvBed.js';
import { TipTrailer, canTow, TIP_TRAILER_PARAM_RANGES } from './vehicle/tipTrailer.js';
import { DEFAULT_TOW_PARAMS, TOW_PARAM_RANGES, towLoad, towEffect } from './vehicle/towing.js';
import { TrailerRide, TRAILER_RIDE_PARAM_RANGES } from './npc/trailerRide.js';
import { poseUtvBed, BED_CARGO_SPOTS, BED_CARGO_YAWS, BED_CARGO_YAW } from './vehicle/utvModel.js';
import { CargoHold, CARGO_PARAM_RANGES } from './vehicle/cargoHold.js';
import { UtvRide, UTV_RIDE_PARAM_RANGES, DEFAULT_UTV_RIDE_PARAMS } from './npc/utvRide.js';
import { TractorGo, TRACTORGO_PARAM_RANGES } from './npc/tractorGo.js';
import { LPlates, LPLATE_PARAM_RANGES, meanSkill } from './npc/lPlates.js';
import { LPlateSet } from './vehicle/lPlateModel.js';
import { TractorRunaway, TRACTOR_RUNAWAY_PARAM_RANGES } from './npc/tractorRunaway.js';
import { DEFAULT_CREEP_PARAMS, CREEP_PARAM_RANGES } from './vehicle/creep.js';
import { DEFAULT_BRAKE_KEY_PARAMS, DEFAULT_THROTTLE_KEY_PARAMS, PEDAL_KEY_PARAM_RANGES } from './vehicle/pedalKeys.js';
import { DEFAULT_TRACTOR_GO_DRIVE, TRACTOR_GO_DRIVE_RANGES, DEFAULT_UTV_GO_DRIVE, DEFAULT_LANDY_GO_DRIVE } from './npc/companionDriving.js';
import { DEFAULT_CRANK_ATTEMPT_PARAMS, CRANK_ATTEMPT_PARAM_RANGES } from './npc/crankAttempt.js';
import { DEFAULT_PUSH_PARAMS, PUSH_PARAM_RANGES } from './npc/pushStart.js';
import { DEFAULT_TRACTOR_START_PARAMS, TRACTOR_START_PARAM_RANGES } from './npc/tractorStart.js';
import { DEFAULT_NOVICE_PARAMS, NOVICE_PARAM_RANGES } from './vehicle/autoShifter.js';
import { HAYSEAT_PARAM_RANGES, DEFAULT_HAYSEAT_PARAMS } from './npc/companionHayRide.js';
import { DEFAULT_MOVE_PARAMS, MOVE_PARAM_RANGES } from './npc/companionMoves.js';
import { DEFAULT_IDLE_POSE_PARAMS, IDLE_POSE_PARAM_RANGES } from './npc/poseMoves.js';
import { HayTrailer } from './vehicle/hayTrailer.js';
import { TRAILER_PARAM_RANGES } from './vehicle/trailer.js';
import { QuadNames, NAME_PARAM_RANGES, quadKey } from './npc/quadNames.js';
import { Ownership, OWNERSHIP_PARAM_RANGES } from './npc/ownership.js';
import { Hearing, EAR_PARAM_RANGES } from './npc/earing.js';
import { Warming, WARMING_PARAM_RANGES, isChilly } from './npc/warming.js';
import { CabShelter, CAB_SHELTER_PARAM_RANGES } from './npc/cabShelter.js';
import { Sulking, SULK_PARAM_RANGES } from './npc/sulking.js';
import { ReadyWaiting, READY_PARAM_RANGES } from './npc/readyWaiting.js';
import { WarmSit, WARMSIT_PARAM_RANGES } from './npc/warmSit.js';
import { DEFAULT_KEEPALIVE_PARAMS, KEEPALIVE_PARAM_RANGES } from './npc/keepAlive.js';
import { HeadStart, HEADSTART_PARAM_RANGES } from './npc/headStart.js';
import { Gossip, GOSSIP_PARAM_RANGES } from './npc/gossip.js';
import { ThrottleGrab, GRAB_PARAM_RANGES } from './npc/throttleGrab.js';
import { PillionCoach, PILLION_COACH_PARAM_RANGES } from './npc/pillionCoach.js';
import { dustExposure } from './world/dust.js';
import { SmokeSense, SMOKE_PARAM_RANGES } from './npc/smokeSense.js';
import { FaultShout, SHOUT_PARAM_RANGES } from './npc/shoutFault.js';
import { Haze, HAZE_PARAM_RANGES } from './world/haze.js';
import { HazeLayer } from './effects/hazeLayer.js';
import { BarnFumes, FUMES_PARAM_RANGES } from './world/barnFumes.js';
import { barnShape } from './world/barn.js';
import { Race, RACE_PARAM_RANGES, planLap, YouRun, youOnGrid } from './npc/race.js';
import { Drag, DRAG_PARAM_RANGES, onDragGrid } from './npc/drag.js';
import { buildDragStrip } from './world/dragStrip.js';
import { stripFrame, stripPoint } from './world/layout.js';
import { DashReader, READING_PARAM_RANGES } from './npc/dashReading.js';
import { Convoy, CONVOY_PARAM_RANGES } from './npc/convoy.js';
import { DoughnutWatch, DOUGHNUT_PARAM_RANGES } from './npc/doughnuts.js';
import { TarmacWatch, TARMAC_PARAM_RANGES, onTarmac } from './npc/tarmac.js';
import { squealLevel, slipAngle } from './vehicle/tyreSqueal.js';
import { DEFAULT_SHOWOFF_PARAMS, SHOWOFF_PARAM_RANGES } from './npc/showOff.js';
import { JumpWatch, JUMP_PARAM_RANGES, rampPoint } from './npc/jumps.js';
import { Nicking, NICK_PARAM_RANGES } from './npc/nicking.js';
import { DEFAULT_LINEUP_PARAMS, LINEUP_PARAM_RANGES } from './npc/lineUp.js';
import { DEFAULT_HOME_PARAMS, HOME_PARAM_RANGES } from './npc/homeParking.js';
import { Tea, TEA_PARAM_RANGES } from './npc/tea.js';
import { carryParams, CARRY_PARAM_RANGES, carryWeight } from './npc/carrying.js';
import { Jumpers, JUMPER_PARAM_RANGES, JUMPERS } from './npc/jumpers.js';
import { JumperRail } from './world/jumperRail.js';
import { DieselMistake, DIESEL_MISTAKE_PARAM_RANGES } from './npc/dieselMistake.js';
import { Mugs } from './items/mug.js';
import { Achievements, DEFAULT_ACHIEVEMENT_PARAMS, ACHIEVEMENT_PARAM_RANGES } from './achievements/achievements.js';
import { paginate } from './achievements/pages.js';
import { achievementSnapshot } from './achievements/snapshot.js';
import { buildStartLine, nearestTrackFraction } from './world/startLine.js';
import { DEFAULT_LOFT_PARAMS, LOFT_PARAM_RANGES, onLoft, Climb, Hiding, StrawDrop } from './world/loft.js';
import { StrawFall } from './effects/strawFall.js';
import { Places, PLACE_PARAM_RANGES, isFine, nearestSpot, restStay } from './npc/places.js';
import { Requests, REQUEST_PARAM_RANGES } from './npc/requests.js';
import { Skills, SKILL_PARAM_RANGES, COACHING } from './npc/skills.js';
import { Banter } from './npc/banter.js';
import { RideOffer, pickOfferer } from './npc/rideOffer.js';
import { BANTER } from './npc/banterLines.js';
import { BanterWatch } from './npc/banterWatch.js';

// Bickers where they trade digs: each adds a little friction towards falling out (fallingOut.js).
const FRICTION_BANTER = ['idle', 'favoured', 'rivals', 'watching', 'sharing', 'riding', 'corrected', 'swapped', 'stuck'];
import { JerryCan, DEFAULT_JERRY_CAN_PARAMS, JERRY_CAN_PARAM_RANGES, PREMIX_CAN_COLOURS, DIESEL_CAN_COLOURS } from './items/jerryCan.js';
import { OilBottle, OIL_BOTTLE_PARAM_RANGES } from './items/oilBottle.js';
import { ratioText } from './engine/lubrication.js';
import { walkRound, DEFAULT_WALK_PARAMS, WALK_PARAM_RANGES } from './npc/walkRound.js';
import { FaultKnowledge, DEFAULT_WONT_PARAMS, WONT_PARAM_RANGES, WONT_LINE } from './npc/wontRide.js';
import { Sump, DEFAULT_SUMP_PARAMS, SUMP_PARAM_RANGES, pickBurner, startLevel, readStick } from './vehicle/sump.js';
import { fuelText } from './engine/diesel.js';
import { FuelTank } from './items/fuelTank.js';
import { Bell } from './world/bellBuild.js';
import { BELL_PARAM_RANGES } from './world/bell.js';
import { Toolbox } from './items/toolbox.js';
import { JumpLeads, JUMP_LEAD_PARAM_RANGES } from './items/jumpLeads.js';
import { Hose, HOSE_PARAM_RANGES } from './items/hose.js';
import { Winch, WINCH_PARAM_RANGES } from './items/winch.js';
import { Chain, CHAIN_PARAM_RANGES } from './items/chain.js';
import { TRACTOR_GROUND_OFFSET } from './vehicle/tractorModel.js';
import { Weather, pickWeatherKind, pickTemperature } from './world/weather.js';
import { Rain } from './effects/rain.js';

import { washMud } from './effects/mudBuildUp.js';
import { Workshop } from './workshop/workshop.js';
import { PodRack } from './vehicle/pods.js';
import { buildPod } from './vehicle/dashPod.js';
import { pickWornGearbox } from './vehicle/manualDrivetrain.js';
import { DashClock, CLOCK_START_RANGE, pickReading, pickRelatedReading, setDashClock, dashClock } from './vehicle/dashState.js';
import { Bench } from './workshop/bench.js';
import { pickBarnFind, BarnFind, DEFAULT_BARN_FIND_PARAMS, BARN_FIND_RANGES, RUSTY_ID } from './vehicle/barnFind.js';
import { weatherModel, buildTarp } from './vehicle/rustyLook.js';
import { Notebook } from './workshop/notebook.js';
import { Interaction } from './interaction/interaction.js';
import { Wheel } from './interaction/wheel.js';
import { Hud } from './hud/hud.js';
import { MapView } from './hud/mapView.js';
import { farmMapFeatures, DEFAULT_MAP_PARAMS, MAP_PARAM_RANGES } from './hud/farmMap.js';
import { DebugGui } from './debug/debugGui.js';
import { GameConsole } from './console/gameConsole.js';

/** Stands in a bench slot's `girl` while you are in that seat, so the girls' seat picking leaves it alone. */
const YOU_ABOARD = { you: true };

const BARN_BULB = 30; // candela of the bulb in the barn, scaled by how far in you are and how gloomy the day is

const FIXED_DT = 1 / 60;
const SETTLE_SECONDS = 2; // physics run while loading so the vehicles are on their wheels before you can hear them (settleVehicles)
const MAX_FRAME_DT = 0.1;
const RACE_STAGE_BACK = 14; // metres behind the start line the girls stage before they come up to the grid

// The vehicles the girls take for a go (and are asked to start): the tractor, the UTV and the two Land Rovers.
const GO_KINDS = ['tractor', 'utv', 'landy', 'defender'];

export class Game {
  constructor(RAPIER, canvas) {
    this.RAPIER = RAPIER;
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1200);
    this.scene.add(this.camera);

    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.physics.timestep = FIXED_DT;

    this.input = new Input(canvas);
    this.hud = new Hud(document.getElementById('hud'));
    this.interaction = new Interaction();
    this.menu = new Wheel(document.getElementById('hud')); // the companion wheel
    this.timer = new THREE.Timer();
    this.accumulator = 0;
    this.girlsAuto = true; // console: girls.autonomy

    window.addEventListener('resize', () => this.onResize());
  }

  async load(report) {
    report('Loading models…');
    this.models = await loadModels((done, total) => report(`Loading models… ${done}/${total}`));
    report('Building world…');
    await new Promise((r) => setTimeout(r, 0));
    this.world = new World({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      renderer: this.renderer,
      models: this.models,
    });

    this.player = new Player({
      physics: this.physics,
      RAPIER: this.RAPIER,
      camera: this.camera,
      input: this.input,
      world: this.world,
      params: { ...DEFAULT_PLAYER_PARAMS },
    });

    this.audioHub = new AudioHub({ ...DEFAULT_SOUND_PARAMS });
    this.input.on('firstinteraction', () => this.audioHub.unlock());
    this.rideWind = new RideWind(this.audioHub);

    // Where things start varies a little each game; ?seed=N repeats a layout.
    this.seed = startSeed();
    const random = createRandom(this.seed);
    console.info(`Layout seed ${this.seed} (add ?seed=${this.seed} to the URL to repeat it)`);
    // Which vehicles are here this game (its own random stream, so the rest of a seed's layout doesn't depend on it).
    // The tractor, UTV and Land Rover are in the same pool as the quads and are dealt a place the same way, but they aren't the girls' quads (`girlUnits`).
    const isBig = (spec) => spec.tractor || spec.utv || spec.landRover;
    const chosen = pickFleet(QUAD_SPECS, [...EXTRA_SPECS, TRACTOR_SPEC, UTV_SPEC, LAND_ROVER_SPEC, DEFENDER_SPEC], createRandom(this.seed ^ 0x51ee7));
    const fleet = chosen.filter((s) => !isBig(s));
    const bigSpecs = chosen.filter(isBig);
    const { placed: spawns, home } = randomiseQuadSpawns(this.world.spawn, chosen.length, random, {
      homeCount: fleet.length,
      big: chosen.map((_, i) => i >= fleet.length),
    });
    const bigSpawn = (spec) => spawns[fleet.length + bigSpecs.indexOf(spec)];

    const plateRandom = createRandom(this.seed ^ 0x91a7e);
    this.units = fleet.map(
      (spec, i) =>
        new QuadUnit({
          spec: spec.plateNumbers ? { ...spec, plateNumber: spec.plateNumbers[Math.floor(plateRandom() * spec.plateNumbers.length)] } : spec,
          spawn: spawns[i],
          scene: this.scene,
          physics: this.physics,
          RAPIER: this.RAPIER,
          world: this.world,
          audioHub: this.audioHub,
        }),
    );
    // Each quad idles differently every game, within its spec's idleRange (same seed, same idles).
    for (const unit of this.units) {
      const range = unit.spec.idleRange ?? [unit.engine.params.idleRpmWarm, unit.engine.params.idleRpmWarm];
      unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(range, random));
    }
    // Then roughness and starting fuel, after the idles so a seed keeps its idles.
    for (const unit of this.units) {
      unit.variation = applyVariation(unit.spec, unit.engine.params, unit.quad.fuel, random);
    }
    // Each quad's top revs, on their own stream so a seed keeps everything above.
    const topRpmRandom = createRandom(this.seed ^ 0x70b5);
    for (const unit of this.units) unit.topRpm = applyTopRpm(unit.spec, unit.engine.params, topRpmRandom);
    this.units.forEach((u, i) => (u.where = spawns[i].where));
    // What the hour meters and odometers show, the dash clock, and where the two accessory pods start. Each has its own seeded
    // stream, so a seed keeps its layout and these repeat too.
    const usageRandom = createRandom(this.seed ^ 0xd45b);
    for (const unit of this.units) {
      unit.quad.usage.hours = pickReading(unit.spec.hoursRange ?? [0, 0], usageRandom);
      unit.quad.usage.odoMiles = pickReading(unit.spec.odoRange ?? [0, 0], usageRandom);
    }
    // Where each quad has been: some wear already on it, perhaps a fault starting, perhaps the last person's tinkering left in.
    this.history = { quads: {}, settingsFor: (unit) => this.workshop?.settingsFor(unit) ?? unit.leftovers?.settings ?? null };
    const historyRandom = createRandom(this.seed ^ 0x4157);
    const faultChance = pickFaultChance(historyRandom);
    for (const unit of this.units) this.applyHistory(unit, historyRandom, faultChance);
    setDashClock(new DashClock(pickReading(CLOCK_START_RANGE, createRandom(this.seed ^ 0xc10c))));
    this.podRack = new PodRack(this.units.map((u) => u.id));
    this.podRack.place(createRandom(this.seed ^ 0x90d5));
    this.pods = { analogue: buildPod('analogue'), digital: buildPod('digital') };
    for (const unit of this.units) {
      const kind = this.podRack.podOn(unit.id);
      if (kind) unit.quad.fitPod(this.pods[kind]);
    }
    // Tyres: pressures a bit off, mismatched brands, a worn rear (the toolbox's psi tunables are given to them once it exists, below).
    this.tyreParams = { ...DEFAULT_TYRE_PARAMS };
    registerTuning('Tyres', this.tyreParams, TYRE_PARAM_RANGES);
    const tyreRandom = createRandom(this.seed ^ 0x7e55);
    for (const unit of this.units) {
      unit.quad.tyres = new TyreSet(dealTyres(tyreRandom, 4, this.tyreParams), this.tyreParams);
      unit.quad.tyres.useLayout(unit.quad.layout.wheels);
    }
    // Every quad starts parked properly, with its brake on; after that it's down to whoever gets off one (vehicle/handbrake.js).
    for (const unit of this.units) unit.quad.parkBrake = true;
    this.handbrakeParams = { ...DEFAULT_HANDBRAKE_PARAMS };
    this.pushing = null; // the unit you're shoving along on foot (pushOnFoot)
    registerTuning('Handbrake', this.handbrakeParams, HANDBRAKE_PARAM_RANGES);
    this.rollWatch = new RollWatch(this.handbrakeParams);
    // The red and blue's 2WD / 4WD switch (vehicle/driveMode.js): they start in 2WD, and the girls forget it.
    registerTuning('2WD and 4WD', DEFAULT_DRIVE_PARAMS, DRIVE_PARAM_RANGES);
    this.fourWdState = new Map(); // companion -> { quad: the switched quad she's driving or null, watch }
    registerTuning('Headlights', HEADLIGHT_PARAMS, HEADLIGHT_PARAM_RANGES);
    registerTuning('UTV lights', LIGHT_SWITCH_PARAMS, LIGHT_SWITCH_PARAM_RANGES);
    registerTuning('Indicators', INDICATOR_PARAMS, INDICATOR_PARAM_RANGES);
    registerTuning('Seat belts', SEAT_BELT_PARAMS, SEAT_BELT_PARAM_RANGES);
    registerTuning('Two-wheeler lean', DEFAULT_BIKE_PARAMS, BIKE_PARAM_RANGES);
    // One to three quirks each, from the parts the quad has (a gauge quirk needs a dash or pod that shows it, so this comes after the pods).
    this.quirkParams = { ...DEFAULT_QUIRK_PARAMS };
    registerTuning('Quirks', this.quirkParams, QUIRK_PARAM_RANGES);
    const quirkRandom = createRandom(this.seed ^ 0x9a1c);
    for (const unit of this.units) {
      const kinds = pickQuirks(featuresOf(unit.spec, !!this.podRack.podOn(unit.id)), quirkRandom, this.quirkParams);
      unit.quad.quirks = new QuirkSet(kinds, this.quirkParams);
    }
    // Engine oil: each four-stroke's sump starts at its own level, and one of them burns oil this game (vehicle/sump.js).
    this.sumpParams = { ...DEFAULT_SUMP_PARAMS };
    registerTuning('Engine oil', this.sumpParams, SUMP_PARAM_RANGES);
    this.walkParams = { ...DEFAULT_WALK_PARAMS };
    registerTuning('Amy walk-round', this.walkParams, WALK_PARAM_RANGES);
    this.wontParams = { ...DEFAULT_WONT_PARAMS }; // Amy refusing a quad she knows is faulty (npc/wontRide.js)
    registerTuning('Amy won\'t ride', this.wontParams, WONT_PARAM_RANGES);
    const sumpRandom = createRandom(this.seed ^ 0x0115);
    const sumpUnits = this.units.filter((u) => u.quad.sump);
    const burnerId = pickBurner(sumpUnits.map((u) => u.spec.id), sumpRandom);
    for (const u of sumpUnits) u.quad.sump = new Sump({ level: startLevel(u.spec.id === burnerId, sumpRandom, this.sumpParams), burner: u.spec.id === burnerId, params: this.sumpParams });
    // The tractor, if it's here this game. It's a unit like the quads (you ride it, fuel it, hear it), but `girlUnits` is what the girls know about:
    // they leave it alone for now. Each of the three is null when it isn't on the farm, and everything that uses it checks.
    this.girlUnits = this.units;
    this.tractorUnit = bigSpecs.includes(TRACTOR_SPEC) ? this.addTractor(bigSpawn(TRACTOR_SPEC)) : null;
    // The diesel UTV (vehicle/quadSpecs.js UTV_SPEC): another unit that isn't one of the girls' quads, which they ride in but don't drive.
    this.utvUnit = bigSpecs.includes(UTV_SPEC) ? this.addUtv(bigSpawn(UTV_SPEC)) : null;
    // The two Land Rovers, the old Series III and the 200TDi (LAND_ROVER_SPEC, DEFENDER_SPEC), either, both or neither: units like the UTV with a
    // petrol or diesel quad's quirks, that the girls ride in and take for a go. `landys.<kind>` is { kind, spec, unit, mount, ride }.
    this.landys = {};
    for (const [kind, spec] of [['landy', LAND_ROVER_SPEC], ['defender', DEFENDER_SPEC]]) {
      this.landys[kind] = { kind, spec, unit: bigSpecs.includes(spec) ? this.addLandRover(bigSpawn(spec), spec) : null, mount: null, ride: null };
    }
    // Perhaps an old quad under a tarp at the back of the barn (vehicle/barnFind.js): a unit like the tractor, not one of the girls' quads.
    this.barnFindParams = { ...DEFAULT_BARN_FIND_PARAMS };
    registerTuning('Barn find', this.barnFindParams, BARN_FIND_RANGES);
    this.rustyUnit = this.addRusty();
    if (this.tractorUnit) this.podRack.allow(this.tractorUnit.id); // likewise the tractor, which is added after the pods are dealt
    this.achievements = new Achievements({ params: { ...DEFAULT_ACHIEVEMENT_PARAMS } }); // the bucket list; its fleet is set once every vehicle is added
    if (this.rustyUnit) this.podRack.allow(this.rustyUnit.id); // placed after the pods were dealt, but you can fit one at the bench
    // A sticky float on some of the quads (vehicle/carbDrip.js): a parked one with the tap on drips petrol and floods. Own random stream.
    this.carbDrip = new CarbDrip(this.units.filter((u) => !u.quad.fuel.params.noTap && !u.quad.engine.params.compressionIgnition).map((u) => u.id), createRandom(this.seed ^ 0x5d1f));
    registerTuning('Dripping carb', this.carbDrip.p, DRIP_PARAM_RANGES);
    this.dripPatches = new Map(); // quad id -> the dark patch on the ground where it dripped
    // The orange's coolant leaks (engine/coolant.js): how fast and how full it starts are picked from the seed, on their own stream.
    this.coolantPatches = new Map(); // quad id -> the damp patch under a leaking radiator
    const coolantRandom = createRandom(this.seed ^ 0x2b6d);
    for (const u of this.units) {
      if (!u.engine.params.waterCooled) continue;
      const pick = pickLeak(coolantRandom, u.engine.params);
      u.engine.coolantLeak = pick.leak;
      u.engine.coolant = pick.level;
      console.info(pick.leak > 0 ? `${u.name}: leaking coolant, ${levelText(pick.level)} (${pick.level.toFixed(2)}) at ${pick.leak.toFixed(2)} times the usual rate` : `${u.name}: coolant fine this game`);
    }
    this.wearGearbox();
    this.logStart();
    this.updateSmokeScale();
    // This game's weather, picked after everything else so a seed keeps its layout (?weather=rain forces one).
    const forced = new URLSearchParams(location.search).get('weather');
    const kind = forced ?? pickWeatherKind(random);
    const forcedTemp = new URLSearchParams(location.search).get('temp'); // ?temp=-3 forces the day's temperature in degrees C
    const celsius = forcedTemp !== null && forcedTemp !== '' && Number.isFinite(+forcedTemp) ? +forcedTemp : pickTemperature(kind, createRandom(this.seed ^ 0x7e3b));
    this.weather = new Weather(kind, random, celsius);
    for (const unit of this.units) unit.quad.seatFrost = this.weather.frost;
    this.world.setWeather(this.weather);
    this.rain = new Rain(this.scene);
    // Smoke hanging over the yard on a still day (world/haze.js, effects/hazeLayer.js).
    this.haze = new Haze(this.world.layout.yard);
    this.hazeLayer = new HazeLayer(this.scene, this.world.layout.yard, this.world.layout.yard.radius, createRandom(this.seed ^ 0x4a2e));
    // Fumes under the barn roof from engines run indoors (world/barnFumes.js); the same blobs, smaller and higher.
    this.barnFumes = new BarnFumes();
    const bs = barnShape(this.world.layout);
    this.barnFumesLayer = new HazeLayer(this.scene, { x: bs.x, z: bs.z }, 2.8, createRandom(this.seed ^ 0x51c3), { size: [3.5, 3], height: [2.6, 2.2], wander: 0.8 });
    console.info(`Weather: ${this.weather.name}, ${this.weather.temperature} °C (${this.weather.band}), chill ${this.weather.chill.toFixed(2)}, frost ${this.weather.frost.toFixed(2)} (add ?temp=<degrees> to the URL to force it)`);
    // She starts beside a random quad in the yard; the player starts facing it.
    this.homeUnit = this.units[home];
    this.lastUnit = this.homeUnit;

    // The companions (src/npc/characters.js), each starting beside her own quad in the yard.
    const yard = this.girlUnits.filter((u, i) => u !== this.homeUnit && spawns[i].where === spawns[home].where);
    const homes = [this.homeUnit, ...yard, ...this.girlUnits.filter((u) => u !== this.homeUnit && !yard.includes(u))];
    const floor = { left: 0, banter: false }; // so one waits for the other to finish before chattering, and both for a bicker
    this.talkFloor = floor;
    // A game without the girls (npc/leftOut.js): nobody is built, and with autonomy off nothing waits on them to start.
    const leftOut = girlsLeftOut(location.search);
    if (leftOut) this.girlsAuto = false;
    this.companions = (leftOut ? [] : CHARACTERS).map((character, i) => {
      const c = new Companion({
        scene: this.scene,
        physics: this.physics,
        RAPIER: this.RAPIER,
        world: this.world,
        quad: homes[i % homes.length].quad,
        gltf: this.models.companion,
        params: { ...DEFAULT_COMPANION_PARAMS, ...character.params },
        name: character.name,
      });
      c.character = character;
      c.quads = this.girlUnits.map((u) => u.quad);
      c.others = () => this.companions.filter((o) => o !== c);
      c.trailers = () => [this.trailer, this.tipTrailer]; // obstacles on foot and on wheels (vehicle/trailerObstacle.js)
      c.followTarget = () => this.riddenUnit?.quad ?? null;
      c.sounds = new CompanionSounds(this.audioHub, { voiceBank: character.voiceBank, rate: character.soundRate });
      c.voice = new CompanionVoice({
        companion: c,
        speech: new Speech(),
        sounds: c.sounds,
        hud: this.hud,
        params: c.params,
        soundParams: this.audioHub.params,
        lines: character.lines,
        name: CHARACTERS.length > 1 ? character.name : null,
        floor,
      });
      this.interaction.add({
        target: c.proxy,
        // While she's driving you can call her over from further away.
        range: () => (c.fsm.is('driving') ? c.params.driveTalkRange : undefined),
        prompt: () => `Talk to ${c.name}`,
        // Sat up on the tractor, she's inside its big get-on box, so she has to win over it to be asked down.
        get priority() {
          return c.fsm.is('onTrailer') ? 1 : 0;
        },
        interact: () => this.openCompanionMenu(c),
      });
      return c;
    });

    // Who you favour: each girl keeps a quiet score of how you treat her (npc/favour.js), shown in the tuning panel.
    this.favour = new Favour(CHARACTERS.map((ch) => ch.id));
    for (const c of this.companions) {
      const id = c.character.id;
      c.favourView = () => ({ mood: this.favour.mood(id), warmth: this.favour.warmth(id), sulk: this.favour.sulkDrive(id) });
    }

    // The girls falling out with each other (npc/fallingOut.js): friction from races, borrowed quads and digs.
    this.fallingOut = new FallingOut(CHARACTERS.map((ch) => ch.id));
    this.fallingOutEvents = []; // banter moments waiting to be raised: fellOut, madeUp
    this.fallingOutApartAt = {}; // girl id -> clock when she was last sent off from her friend
    for (const c of this.companions) c.fallenOut = () => this.fallingOut.active;
    // A girl who likes you a lot asks you round the back of the barn, then onto her favourite quad (npc/romance.js).
    this.romance = new Romance(CHARACTERS.map((ch) => ch.id));
    this.tryst = null; // the scene while it plays: { scene: Tryst, girl }
    this.sharedQuad = null; // the quad you're on with the girl you're locked in with, to catch the moment you tip it
    this.sharedFor = 0;
    this.sharedTipped = false;

    // What each girl is good at, and coaching her from the back (npc/skills.js); her driving reads the live levels.
    this.skills = new Skills(CHARACTERS.map((ch) => ch.id));
    for (const c of this.companions) {
      const id = c.character.id;
      c.skillLevels = this.skills.levels[id];
      c.skillMomentWindow = () => this.skills.p.momentWindow;
      c.onPractice = (skill) => {
        this.skills.practice(id, skill);
        c.voice.onPractice(skill);
      };
    }

    // Places to be: sitting on the bales or fence on a fine day, in the barn doorway when it rains (npc/places.js).
    this.places = new Places();
    this.restSpots = [
      ...this.world.layout.restSpots,
      // Inside the barn, sat on the bales out of the rain, facing the doors.
      ...(this.world.layout.barnBaleSpots ?? []).map(([x, z, yaw], i) => ({ id: `barnBale${i}`, kind: 'shelter', x, z, yaw, seat: this.world.layout.baleSeat })),
      ...this.world.layout.strawBaleSpots
        .filter(([x, z]) => this.world.track.distanceTo(x, z, 10) >= this.world.layout.trackHalfWidth + 3)
        .map(([x, z, yaw], i) => ({ id: `bale${i}`, kind: 'bale', x, z, yaw, seat: this.world.layout.baleSeat })),
    ];
    // The hayloft: she climbs the ladder (the points she passes through are heights above the barn floor) and sits on a bale at its edge.
    this.loftParams = { ...DEFAULT_LOFT_PARAMS };
    this.loft = this.world.props.barn.loft;
    const L0 = this.world.layout;
    this.loftSpot = {
      ...L0.loft.seat,
      stand: { x: this.loft.ladderFoot.x, z: this.loft.ladderFoot.z },
      via: [
        { x: this.loft.ladderTop.x, z: this.loft.ladderTop.z, rise: L0.loft.floor },
        { x: L0.loft.seat.x + 0.1, z: L0.loft.seat.z + 1.8, rise: L0.loft.floor },
      ],
      climbSeconds: 4,
    };
    this.restSpots.push(this.loftSpot);
    this.hiding = new Hiding(this.loftParams);
    this.strawDrop = new StrawDrop(this.loftParams);
    this.strawFall = new StrawFall(this.scene);
    this.climb = null; // Climb of you on the ladder, when you are
    this.hiddenFrom = null; // where you were stood before you ducked into the hay
    const fine = () => isFine(this.weather.name, this.weather.rain, this.places.p);
    const spotTaken = (spot) => this.companions.some((o) => o.currentSpot()?.id === spot.id);
    for (const c of this.companions) {
      c.restStayFor = () => restStay(this.places.p);
      c.restSpotsNear = (here) => {
        if (!fine()) return [];
        const free = this.restSpots.filter((s) => s.kind !== 'shelter' && !spotTaken(s));
        const loftFree = !spotTaken(this.loftSpot) && Math.hypot(this.loftSpot.x - here.x, this.loftSpot.z - here.z) < this.places.p.restFrom;
        if (loftFree && Math.random() < this.loftParams.girlLoftChance) return [this.loftSpot];
        const near = nearestSpot(free, ['bale', 'fence'], here, new Set(), this.places.p.restFrom);
        return near ? [near] : [];
      };
    }

    // Favours the girls ask of you: wash her quad, take her to the bales, fetch the can (npc/requests.js).
    this.requests = new Requests();
    const baleSpots = this.world.layout.strawBaleSpots.filter(([x, z]) => this.world.track.distanceTo(x, z, 10) >= this.world.layout.trackHalfWidth + 3);
    this.bales = baleSpots.map(([x, z]) => ({ x, z }));

    // Pranks: Jess meddles with a quad's tap or choke, Amy hides the can or toolbox while you're away (npc/pranks.js).
    this.pranks = new Pranks();
    // Rev-offs: blip the throttle near a girl sat on a running quad and she may blip back (npc/revOff.js).
    this.revOff = new RevOff();
    // Jess revving over Amy mid-sentence until Amy switches it off (npc/drownOut.js).
    this.drownOut = new DrownOut();
    // Horns: your beep (L) and the girls' answers and Jess's creep-up (npc/horns.js).
    this.horns = new Horns();
    // What they say about the tractor: the key that doesn't stop it, waiting for the glow plugs, it catching (npc/tractorWatch.js).
    this.tractorWatch = new TractorWatch(undefined, createRandom(this.seed ^ 0x7a7c));
    // The tractor creeping off on its own, and the girl who runs after it (npc/tractorRunaway.js, vehicle/creep.js).
    this.tractorRunaway = new TractorRunaway(undefined, createRandom(this.seed ^ 0x7c4e));
    this.runawayJob = null; // { girl, time }: she's running after it
    // The bale trailer in the yard, and the girls riding on it (vehicle/hayTrailer.js, npc/hayRide.js, npc/companionHayRide.js).
    this.trailer = new HayTrailer({ scene: this.scene, world: this.world });
    const tl = this.world.layout.trailer;
    this.trailer.addObstacle(this.physics, this.RAPIER);
    this.trailer.place(tl.x, tl.z, tl.yaw);
    this.hayRide = new HayRide(undefined, createRandom(this.seed ^ 0x4a71));
    this.haySeat = { ...DEFAULT_HAYSEAT_PARAMS };
    for (const c of this.companions) c.hay = this.haySeat;
    // How they get on and off things, and stand about (npc/companionMoves.js, npc/poseMoves.js): one set for both.
    this.moveParams = { ...DEFAULT_MOVE_PARAMS };
    this.idlePoseParams = { ...DEFAULT_IDLE_POSE_PARAMS };
    for (const c of this.companions) Object.assign(c, { moveParams: this.moveParams, idlePoseParams: this.idlePoseParams });
    // A girl on the tractor's wheel arch (npc/mudguardRide.js, vehicle/tractorMount.js); the tractor is built above.
    this.mudguard = new MudguardRide(undefined, createRandom(this.seed ^ 0x3d6a));
    this.tractorMount = this.tractorUnit ? new TractorMount(this.tractorUnit.quad, (x, z) => this.world.heightAt(x, z)) : null;
    // The UTV's tipping bed, and the girls in its seats and bed (vehicle/utvBed.js, npc/utvRide.js, vehicle/utvMount.js).
    this.utvBed = new UtvBed();
    registerTuning('UTV bed', this.utvBed.p, UTV_BED_PARAM_RANGES);
    this.utvRide = new UtvRide(undefined, createRandom(this.seed ^ 0x07c9));
    registerTuning('UTV riders', this.utvRide.p, UTV_RIDE_PARAM_RANGES);
    this.utvMount = this.utvUnit ? new UtvMount(this.utvUnit.quad, (x, z) => this.world.heightAt(x, z)) : null;
    if (this.utvUnit) this.addUtvCargo(this.utvUnit.quad);
    this.utvPetrolSaid = false; // the girls have remarked on it running badly on petrol
    // The Land Rovers' benches: the same riding as the UTV's, with no bed to ride in (vehicle/utvMount.js, npc/utvRide.js).
    for (const l of Object.values(this.landys)) {
      const series = l.kind === 'landy';
      // The 200TDi has a back bench too (LANDY_REAR_SEATS): the girls take it when the front's full, or now and then by choice.
      const rear = series ? {} : LANDY_REAR_SEATS;
      l.ride = new UtvRide({ ...DEFAULT_UTV_RIDE_PARAMS, jessBedChance: 0, amyBedChance: 0, jessBedLoseChance: 0, amyBedLoseChance: 0 }, createRandom(this.seed ^ (series ? 0x1a4d : 0x1a5d)), { rear: Object.keys(rear) });
      if (series) registerTuning('Land Rover riders', l.ride.p, UTV_RIDE_PARAM_RANGES);
      else registerTuning('200TDi riders', l.ride.p, UTV_RIDE_PARAM_RANGES);
      l.mount = l.unit ? new UtvMount(l.unit.quad, (x, z) => this.world.heightAt(x, z), { ...LANDY_STAND, ...LANDY_REAR_STAND }, rear) : null;
      if (l.unit) l.unit.quad.tipHold = { left: 0, driver: 0 }; // seconds a backrest stays tipped after you climb past it
    }
    this.rearAccess = { ...DEFAULT_REAR_ACCESS_PARAMS };
    registerTuning('200TDi back seats', this.rearAccess, REAR_ACCESS_PARAM_RANGES);
    // The little tipping trailer behind any quad with a rack (or the tractor), and the girl who rides in it (vehicle/tipTrailer.js, npc/trailerRide.js).
    this.tipTrailer = new TipTrailer({ scene: this.scene, world: this.world });
    const tt = this.world.layout.tipTrailer;
    this.tipTrailer.addObstacle(this.physics, this.RAPIER);
    this.tipTrailer.place(tt.x, tt.z, tt.yaw);
    this.tipRide = new TrailerRide(undefined, createRandom(this.seed ^ 0x71b7));
    this.towParams = { ...DEFAULT_TOW_PARAMS };
    this.tipPuller = null; // the Quad whose drive and brakes the trailer is taking from
    registerTuning('Tipping trailer', this.tipTrailer.p, TIP_TRAILER_PARAM_RANGES);
    registerTuning('Trailer tub', this.tipTrailer.bed.p, UTV_BED_PARAM_RANGES);
    registerTuning('Trailer riders', this.tipRide.p, TRAILER_RIDE_PARAM_RANGES);
    registerTuning('Towing', this.towParams, TOW_PARAM_RANGES);
    this.interaction.add({
      target: this.tipTrailer.proxy,
      priority: -1, // a can or the toolbox standing in the tub wins when you look at it
      isAvailable: () => !!this.heldLoad() || (!this.handsFull && !this.player.isRiding),
      prompt: () => this.tipTrailerPrompt(),
      interact: () => this.loadTipTrailer(),
    });    // Having a go on the tractor: Jess takes it, Amy won't until her day (npc/tractorGo.js). The girls' own numbers are shared objects.
    this.tractorGo = new TractorGo(undefined, createRandom(this.seed ^ 0x70c0));
    this.tractorDrive = { ...DEFAULT_TRACTOR_GO_DRIVE };
    this.tractorStartParams = { ...DEFAULT_TRACTOR_START_PARAMS };
    this.noviceParams = { ...DEFAULT_NOVICE_PARAMS };
    this.utvDrive = { ...DEFAULT_UTV_GO_DRIVE }; // and the same for the UTV and the Land Rover (the same ranges)
    this.landyDrive = { ...DEFAULT_LANDY_GO_DRIVE };
    this.crankParams = { ...DEFAULT_CRANK_ATTEMPT_PARAMS };
    this.pushParams = { ...DEFAULT_PUSH_PARAMS };
    this.keepParams = { ...DEFAULT_KEEPALIVE_PARAMS }; // keeping a sick one alive from the back (npc/keepAlive.js), shared by both girls
    this.goJoins = []; // the other girl on her way to climb in beside a driver: { left, girl, kind, driver }
    for (const c of this.companions) Object.assign(c, { tractorGo: this.tractorDrive, utvGo: this.utvDrive, landyGo: this.landyDrive, crankParams: this.crankParams, pushParams: this.pushParams, keepParams: this.keepParams, tractorStartParams: this.tractorStartParams, noviceParams: this.noviceParams });
    // Jess tapes L plates to Amy's quad; Amy peels them off, and once she's confident they go on the tractor (npc/lPlates.js).
    this.lPlates = new LPlates(undefined, createRandom(this.seed ^ 0x1b1a));
    this.lPlateSet = new LPlateSet();
    this.tractorSeen = {}; // girl id -> what we've already noticed about her go, for her lines
    this.hayLater = []; // lines to say in a moment: { left, girl, key }
    this.itemHome = {}; // where a hidden item was taken from, by name

    // What they call the quads, whose is whose, and placing a quad by ear (npc/quadNames.js, ownership.js, earing.js).
    this.quadNames = new QuadNames(this.girlUnits.map((u) => u.spec.id), { random: createRandom(this.seed ^ 0x6a3e) });
    this.ownership = new Ownership(undefined, createRandom(this.seed ^ 0x0c1a));
    this.hearing = new Hearing();
    this.pillionCoach = new PillionCoach(); // the girl on the back coaching the girl driving (npc/pillionCoach.js)
    this.throttleGrab = new ThrottleGrab(); // a girl on the back opening it over your hand (npc/throttleGrab.js)
    this.smokeSense = new SmokeSense(); // Amy coughs at two-stroke smoke, Jess loves it (npc/smokeSense.js)
    // Racing: the girls race a lap of the track from a start line by the yard (npc/race.js).
    this.faultShout = new FaultShout(); // a girl behind or beside you shouts what she can see wrong with your quad (npc/shoutFault.js)
    this.dashReader = new DashReader(); // the girl on the back reads the dash out (npc/dashReading.js)
    this.doughnutWatch = new DoughnutWatch(); // Amy watches Jess's doughnuts and has a go (npc/doughnuts.js)
    for (const c of this.companions) c.doughnutParams = this.doughnutWatch.p;
    this.tarmacWatch = new TarmacWatch(); // the girls ride faster on the farm road; Jess eggs you on, Amy scolds the squealing (npc/tarmac.js)
    for (const c of this.companions) c.tarmacParams = this.tarmacWatch.p;
    this.viewForward = new THREE.Vector3(); // which way your eyes point, for the girls showing off (npc/showOff.js)
    this.showOffParams = { ...DEFAULT_SHOWOFF_PARAMS };
    for (const c of this.companions) c.showOffParams = this.showOffParams;
    this.jumpWatch = new JumpWatch(); // the girls take turns at the ramp and rate each other's landings (npc/jumps.js)
    for (const c of this.companions) {
      c.jumpParams = this.jumpWatch.p;
      c.jumpClear = (ramp, jp) => this.jumpLineClear(c, ramp, jp);
    }
    this.lineUpParams = { ...DEFAULT_LINEUP_PARAMS }; // the row in front of the barn (npc/lineUp.js)
    for (const c of this.companions) c.lineUpParams = this.lineUpParams;
    for (const c of this.companions) {
      c.walkParams = this.walkParams;
      c.knows = new FaultKnowledge(Math.random, this.wontParams);
    }
    this.homeParams = { ...DEFAULT_HOME_PARAMS }; // bringing a quad back near the barn when done, and jogging (npc/homeParking.js)
    for (const c of this.companions) c.homeParams = this.homeParams;
    this.tea = new Tea(); // tea left on the rear rack (npc/tea.js)
    this.dieselMistake = new DieselMistake(); // Jess pours red diesel into a quad (npc/dieselMistake.js)
    this.dieselJob = null; // her pouring: { spec, left }
    this.mugs = new Mugs(this.scene, (x, z) => this.world.heightAt(x, z), this.tea.p.stainFor);
    this.teaMugs = {}; // girl id -> the mug on a rack
    this.jumpers = new Jumpers(); // jumpers from the barn rail on cold or wet days (npc/jumpers.js)
    this.jumperRail = new JumperRail(this.scene, this.world.layout, (x, z) => this.world.heightAt(x, z));
    this.convoy = new Convoy(); // follow the leader, swapping places (npc/convoy.js)
    this.convoyIdle = {};
    this.race = new Race();
    this.raceIdle = {}; // seconds each racer has been doing nothing about it
    this.raceStart = nearestTrackFraction(this.world.track, this.world.layout.yard.x, this.world.layout.yard.z);
    buildStartLine(this.scene, (x, z) => this.world.heightAt(x, z), this.world.track, this.raceStart, this.world.layout.trackHalfWidth);
    this.drag = new Drag(); // a drag race down the straight, against one girl (npc/drag.js)
    this.dragIdle = 0; // seconds the girl racing you has been doing nothing about it
    this.dragBlipSaid = false;
    buildDragStrip(this.scene, (x, z) => this.world.heightAt(x, z), this.world.layout.dragStrip);
    this.warming = new Warming(); // hands over an idling engine on a cold day (npc/warming.js)
    this.readyWaiting = new ReadyWaiting(undefined, createRandom(this.seed ^ 0x2ead)); // sat on a running quad, revving and tooting, while you are a minute (npc/readyWaiting.js)
    this.warmSit = new WarmSit(undefined, createRandom(this.seed ^ 0x3a2f)); // sat on your quad while it warms, for the shake (npc/warmSit.js)
    this.warmSitQuads = new Map(); // girl id -> the quad she is sitting on
    this.readyQuads = new Map(); // girl id -> the quad she is getting ready or waiting on
    this.sulking = new Sulking(undefined, createRandom(this.seed ^ 0x5011)); // a girl sitting alone in a Land Rover after a row (npc/sulking.js)
    this.cabShelter = new CabShelter(undefined, createRandom(this.seed ^ 0x0cab)); // into a Land Rover or the UTV out of the rain or cold (npc/cabShelter.js)
    this.nicking = new Nicking(undefined, createRandom(this.seed ^ 0x61c3)); // Jess taking a quad you left running (npc/nicking.js)
    this.headStart = new HeadStart(undefined, createRandom(this.seed ^ 0x4ead)); // starting your usual quad for you (npc/headStart.js)
    this.gossip = new Gossip(BANTER.filter((e) => e.when === 'gossip'), undefined, createRandom(this.seed ^ 0x6055)); // talking about you (npc/gossip.js)
    const capital = (id) => id[0].toUpperCase() + id.slice(1);
    this.ownership.assign(
      Object.fromEntries(this.companions.map((c) => [c.character.id, this.girlUnits.filter((u) => c.mayRide(u.quad) && c.voice.chatter.lines[`like${capital(u.spec.id)}`]).map((u) => u.spec.id)])),
    );
    for (const c of this.companions) {
      const id = c.character.id;
      c.claimedSpec = this.ownership.claims[id] ?? null;
      c.voice.favourite = c.claimedSpec; // the one she likes best is the one she says is hers
      const mine = this.girlUnits.find((u) => u.spec.id === c.claimedSpec);
      if (mine) c.setShirt(mine.spec.bodyColor); // and her shirt is its colour, so you can see why
      c.voice.names = this.quadNames;
      c.borrowPick = (specs) => this.ownership.borrowPick(id, specs);
    }

    // Each quad is dealt its own luck with faults this game, from the seed (vehicle/faults.js).
    this.girlUnits.forEach((u, i) => u.quad.faults.roll(createRandom(this.seed ^ (0xfa17 + i * 7919))));

    for (const unit of this.units) {
      const quad = unit.quad;
      unit.interaction = this.interaction.add({
        unit,
        target: quad.proxy,
        prompt: () => {
          if (unit.barnFind && !unit.barnFind.tarpOff) return { text: 'The rusty quad: an old shape under a tarp   ·   take it off at the workbench' };
          if (this.tooFastToMount(quad) && this.herDriving(quad) && !quad.hasBench) return `Ask ${this.herDriving(quad).name} to stop and let you on`;
          if (this.tooFastToMount(quad)) {
            return { text: `The ${unit.label} is going too fast to get on   ·   K ignition` };
          }
          if (this.leads.held) return this.leads.ends.length ? `Clamp the other end on the ${unit.label}   ·   G put the leads down` : `Clamp the jump leads on the ${unit.label}   ·   G put them down`;
          if (this.leads.ends.includes(quad)) return `Take the jump leads off the ${unit.label}`;
          const winch = this.winch;
          if (winch?.state === 'carried') {
            if (unit === winch.unit) return { text: 'X put the winch hook back' };
            return `Hook the winch cable on the ${unit.label}${quad.bog.stuck ? ' (it\'s stuck)' : ''}   ·   X put it back`;
          }
          if (winch?.state === 'hooked' && winch.target === quad) return 'Unhook the winch   ·   hold X by the green quad to wind in';
          const chain = this.chain;
          if (chain?.state === 'carried') {
            if (unit === this.tractorUnit) return { text: 'X put the tow chain back' };
            return `Hook the tractor's chain on the ${unit.label}${quad.bog.stuck ? ' (it\'s stuck)' : ''}   ·   X put it back`;
          }
          if (chain?.state === 'hooked' && chain.target === quad) return 'Unhook the tow chain';
          if (this.hose.held) {
            const muddy = Math.round(Math.max(unit.mud.state.body, unit.mud.state.wheels) * 100);
            return { text: muddy > 0 ? `Hold E to wash the ${unit.label} (${muddy}% muddy)   ·   G put the hose back` : `The ${unit.label} is clean   ·   G put the hose back` };
          }
          if (this.toolbox.held) {
            return this.workshop.prompt(unit);
          }
          if (this.can.held) {
            const pct = Math.round(quad.fuel.level * 100);
            if (quad.fuel.space < 0.01) return { text: `The ${unit.label} is full   ·   G put the can down` };
            if (this.can.litres < 0.01) return { text: 'The can is empty   ·   G put the can down' };
            return { text: `Hold E to fill the ${unit.label} (${pct}%) with ${fuelText(this.can.oil, this.can.diesel)}   ·   G put the can down` };
          }
          if (quad.crank && quad.atCrank && !this.player.isRiding) return { text: this.crankPrompt(quad) };
          if (this.sulkerIn(quad)) return { text: `${this.sulkerIn(quad).name} is sulking in the ${unit.label}   ·   E knock on the window` };
          if (quad.isTipped) return `Right the ${unit.label}`;
          if (this.canRideBench(quad)) return this.lookingAtBack(quad) ? `Get in the back (${this.herAtTheFront(quad).name}'s driving)` : `Get in beside ${this.herAtTheFront(quad).name} (she's driving)`;
          if (quad.hasBench && this.herAtTheFront(quad) && !quad.passenger && !this.benchSeatFor(quad)) return { text: `${this.herAtTheFront(quad).name}'s driving and the bench is full` };
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger && this.herOnBack(quad)) return { text: `${this.herAtTheFront(quad).name}'s driving and ${this.herOnBack(quad).name}'s on the back: no room` };
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger) return `Get on the back (${this.herAtTheFront(quad).name}'s driving)`;
          const winchKey = this.winch?.unit === unit && this.winch.state === 'stowed' ? '   X winch cable' : '';
          return {
            action: `Ride the ${unit.label}`,
            keys: quad.tractor
              ? [['K', 'Key'], ['R', 'Start'], ['Q Z', 'Hand throttle'], ['O', 'Stop knob'], ['Y', 'Dipstick'], ...(this.chain?.state === 'stowed' && !this.player.isRiding ? [['X', 'Tow chain']] : [])]
              : unit.spec.utv
                ? [['K', 'Key'], ['R', 'Start'], ['T', 'Tip the bed'], ['Y', 'Dipstick'], ...(this.canSitOnBack(quad) ? [['B', 'Sit in the passenger seat']] : [])] // the reverse lever is on the dash: only from the seat
                : unit.spec.landRover
                  ? [['K', 'Key'], ['R', 'Start'], ...(unit.spec.defender ? [] : [['Q Z', 'Choke'], ['[ ]', 'Hand throttle']]), ['Y', 'Dipstick'], ...(unit.spec.defender ? [] : [['P', 'Starting handle (at the front)']]), ...(this.canSitOnBack(quad) ? [['B', this.lookingAtBack(quad) ? 'Sit in the back' : 'Sit in the passenger seat']] : [])]
                : [['K', 'Ignition'], ...(quad.engine.params.noStarter ? [] : [['R', 'Start']]), ...(quad.engine.params.pullStart ? [['P', 'Pull-start']] : []), ['Q Z', 'Choke'], ['F', 'Fuel tap'], ...(quad.sump ? [['Y', 'Dipstick']] : []), ...(quad.reverseStyle === 'none' ? [['V', 'Push (no reverse)']] : []), ...(this.canSitOnBack(quad) ? [['B', 'Sit on the back']] : []), ...(winchKey ? [['X', 'Winch cable']] : [])],
          };
        },
        interact: () => {
          if (unit.barnFind && !unit.barnFind.tarpOff) return;
          if (this.leads.held) return this.clampLeads(quad);
          if (this.leads.ends.includes(quad)) return this.leads.unclamp(this.camera);
          if (this.winch?.state === 'carried') {
            if (unit !== this.winch.unit) this.winch.hookOn(quad);
            return;
          }
          if (this.winch?.state === 'hooked' && this.winch.target === quad) {
            this.winch.unhook(this.camera);
            return;
          }
          if (this.chain?.state === 'carried') {
            if (unit !== this.tractorUnit) this.chain.hookOn(quad);
            return;
          }
          if (this.chain?.state === 'hooked' && this.chain.target === quad) {
            this.chain.unhook(this.camera);
            return;
          }
          if (this.can.held || this.hose.held) return; // E is for pouring or spraying while you're holding those
          if (this.toolbox.held) {
            this.achievements.note('toolbox');
            return this.workshop.open(unit);
          }
          if (this.tooFastToMount(quad) && this.herDriving(quad) && !quad.hasBench) {
            // She pulls up and moves onto the back for you.
            const c = this.herDriving(quad);
            c.requestMount(quad);
            c.voice.onRequest('back');
            return;
          }
          if (this.tooFastToMount(quad)) return;
          if (this.sulkerIn(quad)) return this.knockOnWindow(this.sulkerIn(quad));
          if (quad.isTipped) quad.rightItself();
          else if (this.canRideBench(quad)) this.mountBench(unit);
          else if (quad.hasBench && this.herAtTheFront(quad)) return; // she's driving and the bench is full
          else if (this.herAtTheFront(quad) && this.herOnBack(quad)) return;
          else if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger) this.mountPillion(unit);
          else this.mount(unit);
        },
        hold: (dt) => {
          if (this.hose.held) {
            // Close enough and the jet reaches it: the mud comes off.
            const near = quad.position.distanceTo(this.player.position) < this.hose.params.washRange + 1.2;
            if (near) {
              washMud(unit.mud.state, dt, unit.mud.params);
              this.washing = unit;
              this.favourQuad(unit, this.favour.p.washPerSecond * dt);
            }
            return false;
          }
          if (!this.can.held || this.tooFastToMount(quad)) return false;
          const wanted = Math.min(this.can.params.pourRate * dt, quad.fuel.space);
          const poured = quad.fuel.add(this.can.take(wanted), this.can.oil, this.can.diesel) > 0;
          if (poured) {
            this.wrongMix = this.mixWrongFor(quad, this.can);
            this.achievements.note('fuelPoured');
          }
          return poured;
        },
      });
    }

    // Refuelling: a jerry can and the petrol tank by the barn.
    const L = this.world.layout;
    this.fuelTank = new FuelTank({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      position: L.fuelTank,
      yaw: L.fuelTank.yaw,
    });
    const [canSpot, premixSpot, dieselSpot] = randomJerryCanSpots(L, random, 3); // the three cans start in different places
    this.petrolCan = new JerryCan({
      scene: this.scene,
      world: this.world,
      position: canSpot,
      yaw: canSpot.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS },
    });
    // The yellow can of pre-mix for the two-strokes, with a bottle of oil to top it up with.
    this.premixCan = new JerryCan({
      scene: this.scene,
      world: this.world,
      position: premixSpot,
      yaw: premixSpot.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS, startLitres: 12, startOil: 0.02 },
      colours: PREMIX_CAN_COLOURS,
      name: 'premixCan',
    });
    // Red diesel for the tractor: a bowser south of the petrol tank, and a dark green can beside it. Petrol engines hate it.
    this.dieselBowser = new FuelTank({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      position: L.dieselBowser,
      yaw: L.dieselBowser.yaw,
      text: 'RED DIESEL',
      colour: 0x2d5a38,
      paper: '#b3261e',
      ink: '#f4efe0',
      scale: 0.8,
    });
    this.dieselCan = new JerryCan({
      scene: this.scene,
      world: this.world,
      position: dieselSpot,
      yaw: dieselSpot.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS, startLitres: 10, startDiesel: 1 },
      colours: DIESEL_CAN_COLOURS,
      name: 'dieselCan',
    });
    this.oilBottle = new OilBottle({ scene: this.scene, world: this.world, position: L.oilBottle, yaw: L.oilBottle.yaw });
    for (const can of [this.petrolCan, this.premixCan, this.dieselCan]) {
      this.interaction.add({
        target: can.proxy,
        isAvailable: () => !this.handsFull && !can.carried,
        prompt: () => `Pick up the ${can === this.premixCan ? 'yellow' : can === this.dieselCan ? 'dark green' : 'red'} jerry can (${can.litres.toFixed(1)} L, ${fuelText(can.oil, can.diesel)})`,
        interact: () => can.pickUp(this.camera),
      });
    }
    this.interaction.add({
      target: this.oilBottle.proxy,
      isAvailable: () => !this.oilBottle.held,
      prompt: () => {
        if (!this.handsFull) return 'Pick up the oil bottle';
        if (!this.can.held) return { text: 'Engine oil: bring a jerry can to add some to the pre-mix' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to add oil to the can (${fuelText(this.can.oil, this.can.diesel)})` };
      },
      interact: () => {
        if (!this.handsFull) this.oilBottle.pickUp(this.camera);
      },
      hold: (dt) => this.can.held && this.can.addOil(this.oilBottle.params.pourRate * dt) > 0,
    });
    this.interaction.add({
      target: this.fuelTank.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Petrol tank: bring the jerry can to fill it' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to fill the jerry can (${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${fuelText(this.can.oil, this.can.diesel)})` };
      },
      interact: () => {},
      hold: (dt) => this.can.held && this.can.fill(this.can.params.fillRate * dt) > 0,
    });
    this.interaction.add({
      target: this.dieselBowser.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Red diesel, for the tractor: bring a jerry can to fill it' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to fill the jerry can with red diesel (${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${fuelText(this.can.oil, this.can.diesel)})` };
      },
      interact: () => {},
      hold: (dt) => this.can.held && this.can.fill(this.can.params.fillRate * dt, 0, 1) > 0,
    });

    // The bell beside the barn doors: ring it and the girls come back to the barn, wherever they are.
    this.bell = new Bell({ scene: this.scene, physics: this.physics, RAPIER: this.RAPIER, world: this.world, audioHub: this.audioHub, position: L.bell, yaw: L.bell.yaw });
    this.interaction.add({
      target: this.bell.proxy,
      prompt: () => (this.recalling ? 'Ring the bell again' : 'Ring the bell to call the girls back'),
      interact: () => this.ringBell(),
    });

    // A toolbox by the petrol tank, for tinkering with the quads (see workshop.js).
    this.toolbox = new Toolbox({ scene: this.scene, world: this.world, position: L.toolbox, yaw: L.toolbox.yaw });
    this.toolbox.model.position.y += L.toolbox.lift ?? 0; // up on the barn workbench
    this.workshop = new Workshop(this);
    for (const unit of this.units) {
      unit.quad.tyres.tune = this.workshop.params; // the psi effects stay tunable in the toolbox's panel
      unit.quad.physics.tyres = unit.quad.tyres;
      unit.quad.physics.applyParams();
    }
    this.bench = new Bench(this);
    this.notebook = new Notebook(this); // Amy's logbook, on the bench
    // A hosepipe for washing the mud off.
    this.hose = new Hose({ scene: this.scene, world: this.world, position: L.hose, yaw: L.hose.yaw });
    // The green quad's winch, for pulling a stuck quad out of a bog.
    const winchUnit = this.units.find((u) => u.spec.winch);
    this.winch = winchUnit ? new Winch({ scene: this.scene, unit: winchUnit }) : null;
    this.winchReel = false;
    // The tractor's tow chain (items/chain.js), for a quad sunk too deep for the winch or a dead one to tow home.
    this.chain = this.tractorUnit ? new Chain({ scene: this.scene, tractor: this.tractorUnit.quad, anchor: (q) => q.localToWorld(0, TRACTOR_GROUND_OFFSET + 0.52, -1.5) }) : null; // no tractor, no chain
    this.interaction.add({
      target: this.hose.proxy,
      isAvailable: () => !this.handsFull,
      prompt: () => 'Pick up the hose',
      interact: () => this.hose.pickUp(this.camera),
    });
    // Jump leads, for a flat battery: a running quad charges it.
    this.leads = new JumpLeads({ scene: this.scene, world: this.world, position: L.benchLeads, yaw: L.benchLeads.yaw });
    this.leads.model.position.y += L.bench.height; // they start on the workbench
    // The farm map on M (hud/farmMap.js, mapView.js).
    this.mapParams = { ...DEFAULT_MAP_PARAMS };
    registerTuning('Map', this.mapParams, MAP_PARAM_RANGES);
    this.farmMap = new MapView(document.getElementById('hud'), farmMapFeatures(L, this.world.fields, this.world.track), this.mapParams);
    this.interaction.add({
      target: this.leads.proxy,
      isAvailable: () => !this.handsFull && !this.leads.held,
      prompt: () => 'Pick up the jump leads',
      interact: () => this.leads.pickUp(this.camera),
    });
    this.interaction.add({
      target: this.toolbox.proxy,
      priority: 1, // it sits on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.handsFull && !this.toolbox.carried,
      prompt: () => 'Pick up the toolbox',
      interact: () => this.toolbox.pickUp(this.camera),
    });
    // The workbench: jobs on a quad parked in the painted bay (workshop/bench.js).
    this.interaction.add({
      target: this.bench.proxy,
      isAvailable: () => !this.handsFull || !!this.benchItem(),
      prompt: () => (this.benchItem() ? `Put the ${this.benchItem().name} back on the bench` : this.bench.prompt()),
      interact: () => (this.benchItem() ? this.putOnBench(this.benchItem()) : (this.achievements.note('bench'), this.bench.open())),
    });
    this.interaction.add({
      target: this.notebook.proxy,
      priority: 1, // it lies on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.handsFull,
      prompt: () => this.notebook.prompt(),
      interact: () => this.notebook.open(),
    });

    // The hayloft: the ladder up and down, and the hay to hide in.
    this.interaction.add({
      target: this.loft.ladderProxy,
      isAvailable: () => !this.handsFull && !this.climb && !this.hiding.active,
      prompt: () => (this.youOnLoft() ? 'Climb down the ladder' : 'Climb up to the hayloft'),
      interact: () => this.startClimb(),
    });
    this.interaction.add({
      target: this.loft.hayProxy,
      isAvailable: () => !this.handsFull && !this.climb && !this.hiding.active && this.youOnLoft(),
      prompt: () => 'Duck into the hay and hide',
      interact: () => this.startHiding(),
    });

    // Start facing the quad she's standing by, wherever it ended up.
    const q = this.homeUnit.quad.position;
    const p = this.player.position;
    this.player.yaw = Math.atan2(-(q.x - p.x), -(q.z - p.z));

    registerTuning('Sound', this.audioHub.params, SOUND_PARAM_RANGES);
    registerTuning('Jerry can', this.petrolCan.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Pre-mix can', this.premixCan.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Diesel can', this.dieselCan.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Oil bottle', this.oilBottle.params, OIL_BOTTLE_PARAM_RANGES);
    registerTuning('Hose', this.hose.params, HOSE_PARAM_RANGES);
    registerTuning('Bell', this.bell.params, BELL_PARAM_RANGES);
    registerTuning('Favour', this.favour.p, FAVOUR_PARAM_RANGES);
    registerTuning('Achievements', this.achievements.p, ACHIEVEMENT_PARAM_RANGES);
    this.achievements.fleet = [...this.units.map((u) => u.id), ...(this.rustyUnit ? ['rusty'] : [])];
    this.achievements.onUnlock((a) => this.achievementUnlocked(a));
    registerTuning('Falling out', this.fallingOut.p, FALLING_OUT_PARAM_RANGES);
    registerTuning('Romance', this.romance.p, ROMANCE_PARAM_RANGES);
    this.wearLedger ??= new WearLedger();
    registerTuning('Who wore it out', this.wearLedger.p, LEDGER_PARAM_RANGES);
    this.leftRunning ??= new LeftRunning();
    registerTuning('Left running', this.leftRunning.p, LEFT_PARAM_RANGES);
    registerTuning('Pranks', this.pranks.p, PRANK_PARAM_RANGES);
    registerTuning('Rev-offs', this.revOff.p, REVOFF_PARAM_RANGES);
    registerTuning('Drowning out', this.drownOut.p, DROWNOUT_PARAM_RANGES);
    registerTuning('Horns', this.horns.p, HORN_PARAM_RANGES);
    registerTuning('Tractor remarks', this.tractorWatch.p, TRACTOR_WATCH_PARAM_RANGES);
    registerTuning('Tractor creep', DEFAULT_CREEP_PARAMS, CREEP_PARAM_RANGES);
    registerTuning('Throttle key', DEFAULT_THROTTLE_KEY_PARAMS, PEDAL_KEY_PARAM_RANGES);
    registerTuning('Brake key', DEFAULT_BRAKE_KEY_PARAMS, PEDAL_KEY_PARAM_RANGES);
    registerTuning('Tractor runaway', this.tractorRunaway.p, TRACTOR_RUNAWAY_PARAM_RANGES);
    registerTuning('Hay ride', this.hayRide.p, HAYRIDE_PARAM_RANGES);
    registerTuning('Mudguard ride', this.mudguard.p, MUDGUARD_PARAM_RANGES);
    registerTuning('Tractor go', this.tractorGo.p, TRACTORGO_PARAM_RANGES);
    registerTuning('L plates', this.lPlates.p, LPLATE_PARAM_RANGES);
    registerTuning('Tractor go drive', this.tractorDrive, TRACTOR_GO_DRIVE_RANGES);
    registerTuning('UTV go drive', this.utvDrive, TRACTOR_GO_DRIVE_RANGES);
    registerTuning('Land Rover go drive', this.landyDrive, TRACTOR_GO_DRIVE_RANGES);
    registerTuning('Land Rover go handle', this.crankParams, CRANK_ATTEMPT_PARAM_RANGES);
    registerTuning('Girl pushing a start', this.pushParams, PUSH_PARAM_RANGES);
    registerTuning('Keeping it alive', this.keepParams, KEEPALIVE_PARAM_RANGES);
    registerTuning('Tractor go start', this.tractorStartParams, TRACTOR_START_PARAM_RANGES);
    registerTuning('Tractor go novice', this.noviceParams, NOVICE_PARAM_RANGES);
    registerTuning('Hay ride seat', this.haySeat, HAYSEAT_PARAM_RANGES);
    registerTuning('Getting on and off', this.moveParams, MOVE_PARAM_RANGES);
    registerTuning('Standing about', this.idlePoseParams, IDLE_POSE_PARAM_RANGES);
    registerTuning('Trailer', this.trailer.p, TRAILER_PARAM_RANGES);
    registerTuning('Quad names', this.quadNames.p, NAME_PARAM_RANGES);
    registerTuning('Whose quad', this.ownership.p, OWNERSHIP_PARAM_RANGES);
    registerTuning('Hearing a quad', this.hearing.p, EAR_PARAM_RANGES);
    registerTuning('Warming hands', this.warming.p, WARMING_PARAM_RANGES);
    registerTuning('Sitting while it warms', this.warmSit.p, WARMSIT_PARAM_RANGES);
    registerTuning('Ready and waiting', this.readyWaiting.p, READY_PARAM_RANGES);
    registerTuning('Sulking in the cab', this.sulking.p, SULK_PARAM_RANGES);
    registerTuning('Shelter in a cab', this.cabShelter.p, CAB_SHELTER_PARAM_RANGES);
    registerTuning('Head start', this.headStart.p, HEADSTART_PARAM_RANGES);
    registerTuning('Talking about you', this.gossip.p, GOSSIP_PARAM_RANGES);
    registerTuning('Girls coaching each other', this.pillionCoach.p, PILLION_COACH_PARAM_RANGES);
    registerTuning('Hand on the throttle', this.throttleGrab.p, GRAB_PARAM_RANGES);
    registerTuning('Two-stroke smoke', this.smokeSense.p, SMOKE_PARAM_RANGES);
    registerTuning('Shouting a fault', this.faultShout.p, SHOUT_PARAM_RANGES);
    registerTuning('Yard haze', this.haze.p, HAZE_PARAM_RANGES);
    registerTuning('Fumes in the barn', this.barnFumes.p, FUMES_PARAM_RANGES);
    registerTuning('Racing', this.race.p, RACE_PARAM_RANGES);
    registerTuning('Drag race', this.drag.p, DRAG_PARAM_RANGES);
    registerTuning('Follow the leader', this.convoy.p, CONVOY_PARAM_RANGES);
    registerTuning('Doughnuts', this.doughnutWatch.p, DOUGHNUT_PARAM_RANGES);
    registerTuning('Tarmac', this.tarmacWatch.p, TARMAC_PARAM_RANGES);
    registerTuning('Showing off', this.showOffParams, SHOWOFF_PARAM_RANGES);
    registerTuning('The jump', this.jumpWatch.p, JUMP_PARAM_RANGES);
    registerTuning('Nicking your quad', this.nicking.p, NICK_PARAM_RANGES);
    registerTuning('Lining them up', this.lineUpParams, LINEUP_PARAM_RANGES);
    registerTuning('Home and jogging', this.homeParams, HOME_PARAM_RANGES);
    registerTuning('Tea on the rack', this.tea.p, TEA_PARAM_RANGES);
    registerTuning('Girls carrying things', carryParams, CARRY_PARAM_RANGES);
    registerTuning('Jumpers', this.jumpers.p, JUMPER_PARAM_RANGES);
    registerTuning('Red diesel mistake', this.dieselMistake.p, DIESEL_MISTAKE_PARAM_RANGES);
    registerTuning('Reading the dash', this.dashReader.p, READING_PARAM_RANGES);
    registerTuning('Jump leads', this.leads.params, JUMP_LEAD_PARAM_RANGES);
    registerTuning('Skills', this.skills.p, SKILL_PARAM_RANGES);
    registerTuning('Places', this.places.p, PLACE_PARAM_RANGES);
    registerTuning('Hayloft', this.loftParams, LOFT_PARAM_RANGES);
    registerTuning('Favours asked', this.requests.p, REQUEST_PARAM_RANGES);
    if (this.winch) registerTuning('Winch', this.winch.params, WINCH_PARAM_RANGES);
    if (this.chain) registerTuning('Tow chain', this.chain.params, CHAIN_PARAM_RANGES);
    registerTuning('Player', this.player.params, PLAYER_PARAM_RANGES);
    for (const c of this.companions) {
      registerTuning(c.name, c.params, COMPANION_PARAM_RANGES, { onChange: () => c.refreshFigure() });
      registerTuning(`${c.name} pillion`, c.pillion.params, PILLION_PARAM_RANGES);
    }
    this.debugGui = new DebugGui(this);
    this.console = new GameConsole(this);

    this.applyDebugCamera();
    if (import.meta.env.DEV) window.game = this;
    report('Settling…');
    await new Promise((r) => setTimeout(r, 0));
    this.settleVehicles();
    await this.loadSounds(report);
  }

  /**
   * Every vehicle spawns a little above the ground. Left to drop once the game starts, they all land at once, thud and knock on
   * their springs together and make a deafening crash. So the physics runs for a couple of seconds here, behind the loading screen,
   * until they're sitting on their wheels, and the thuds that queued meanwhile are thrown away.
   */
  settleVehicles(seconds = SETTLE_SECONDS) {
    for (let t = 0; t < seconds; t += FIXED_DT) this.fixedUpdate(FIXED_DT);
    for (const unit of this.units) unit.ride?.events.take();
  }

  /**
   * Every sound, loaded behind the loading screen so the game never starts silent: the engine worklet and its recorded banks, the ride
   * sounds and both girls' voices. The context starts suspended (no click yet); clicking to play only switches it on (AudioHub.unlock).
   */
  async loadSounds(report) {
    const hub = this.audioHub;
    const jobs = [];
    let done = 0;
    const total = hub.bankCount + this.companions.length + 1; // the engine banks, each girl's voice, the ride sounds
    const tick = () => report(`Loading sounds… ${done}/${total}`);
    const engine = hub.prepare(() => {
      done++;
      tick();
    });
    if (!engine) return; // no Web Audio in this browser
    await engine;
    for (const c of this.companions) {
      c.sounds.ensure();
      jobs.push(c.sounds.loading);
    }
    jobs.push(rideBuffers(hub).loading);
    tick();
    await Promise.all(jobs.map((job) => Promise.resolve(job).then(() => {
      done++;
      tick();
    })));
  }

  /** The start or pause card is up (not the small hint the tuning panel and console leave, nor the toolbox): the farm stands still. */
  isPaused() {
    const o = (this.overlayEl ??= document.getElementById('overlay'));
    return !!o && overlayPauses(o.classList, o.style.display);
  }

  /** Stops or restarts everything that runs on its own: the sound and the browser's speech (the simulation is skipped in `frame`). */
  setPaused(on) {
    this.audioHub.setPaused(on); // every frame: a click can switch the sound back on while the card is still up
    if (this.paused === on) return;
    this.paused = on;
    if (typeof speechSynthesis !== 'undefined') {
      if (on) speechSynthesis.pause();
      else speechSynthesis.resume();
    }
  }

  // The console's switches (src/console) ---------------------------------------------------------------

  /** Changes the weather to a kind at once, with the sky, the rain and the frost on the seats following. */
  setWeatherKind(kind) {
    if (!this.weather.setKind(kind)) return false;
    this.world.setWeather(this.weather);
    for (const unit of this.units) unit.quad.seatFrost = this.weather.frost;
    return true;
  }

  /** How hard it is raining now, 0 to 1 (it settles back to what the weather would do in time). */
  setRain(amount) {
    this.weather.rain = this.weather.target = Math.max(0, Math.min(1, amount));
  }

  /** The day's temperature in degrees C. */
  setTemperature(celsius) {
    this.weather.temperature = celsius;
    for (const unit of this.units) unit.quad.seatFrost = this.weather.frost;
  }

  /** On: the girls start things on their own as usual. Off: nothing new starts; they follow, ride and answer you. */
  setGirlsAuto(on) {
    this.girlsAuto = on;
    for (const c of this.companions) c.params.ownMind = on;
  }

  /** Free-fly for the player (flight.js). */
  setFlying(on) {
    if (on && this.player.isRiding) return this.hud.toast('Get off first');
    this.player.flying = on;
    this.hud.toast(on ? 'Flying: WASD, Space up, C down, Shift fast' : 'Walking', 1.6);
  }

  /** ?cam=x,y,z,yawDeg,pitchDeg places the camera, for screenshots while developing. */
  applyDebugCamera() {
    const cam = new URLSearchParams(location.search).get('cam');
    if (!cam) return;
    const [x, y, z, yaw = 0, pitch = 0] = cam.split(',').map(Number);
    this.debugCamera = true;
    this.camera.position.set(x, y, z);
    this.camera.rotation.set((pitch * Math.PI) / 180, (yaw * Math.PI) / 180, 0, 'YXZ');
  }

  start() {
    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', () => {
      this.audioHub.unlock();
      this.input.requestPointerLock();
    });
    this.input.on('lockchange', (locked) => {
      overlay.classList.toggle('hidden', locked);
      if (!locked) this.closeMenu();
    });
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** The tractor walking off on its own: they remark on it, one runs after it and stops it, or it reaches the hedge (npc/tractorRunaway.js). */
  updateTractorRunaway(dt, ridden) {
    const unit = this.tractorUnit;
    const q = unit.quad;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const stalled = q.creepStalled;
    q.creepStalled = false;
    const job = this.runawayJob;
    if (job) {
      const c = job.girl;
      job.time += dt;
      const caught = c.root.position.distanceTo(q.position) < 2.4;
      if (caught && q.creeping) {
        // Up beside the seat: the hand throttle shut, out of gear and the stop knob pulled.
        q.handSetting = 0;
        q.drivetrain.setGear(0);
        q.engine.stopKnob();
        c.voice.say('tractorRunawayStopped', { urgent: true });
      }
      if (caught || !q.creeping || ridden === unit || job.time > 40) {
        c.paceBoost = 1;
        this.runawayJob = null;
      } else if (c.fsm.is('idle')) c.fsm.transition('walking', { goal: 'stand', target: () => c.standPoint(undefined, q) });
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob,
      dist: c.root.position.distanceTo(q.position),
    }));
    // The first hedge it's heading for, through the gateways (world/fields.js), less the hedge's thickness.
    const hedge = Math.max(0, this.world.fields.hedgeAhead(q.position.x, q.position.z, q.yaw) - this.world.layout.hedgeThickness);
    const ctx = { creeping: q.creeping, stalled, trailer: this.trailer.hitched, hedge, girls };
    for (const ev of this.tractorRunaway.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'note') c.voice.say(ev.trailer ? 'tractorCreepTrailer' : 'tractorCreepNote', { urgent: true });
      else if (ev.type === 'chase' && !this.runawayJob) {
        c.paceBoost = 2.4; // running, not walking
        this.runawayJob = { girl: c, time: 0 };
        c.fsm.transition('walking', { goal: 'stand', target: () => c.standPoint(undefined, q) });
        c.voice.say('tractorRunaway', { urgent: true });
      } else if (ev.type === 'hedge') {
        c.voice.say('tractorHedge', { urgent: true });
        this.hayLater.push({ left: 2, girl: c.others()[0], key: 'tractorHedgeBlame' });
      }
    }
  }

  /** The girls' remarks on the tractor (npc/tractorWatch.js). */
  updateTractorWatch(dt) {
    const unit = this.tractorUnit;
    const e = unit.quad.engine;
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob,
      x: c.root.position.x,
      z: c.root.position.z,
    }));
    const tractor = {
      x: unit.quad.position.x,
      z: unit.quad.position.z,
      running: e.isRunning,
      keyOn: e.ignitionOn,
      glowWaiting: this.riddenUnit === unit && e.ignitionOn && !e.isRunning && !e.glowHot && e.temperature < e.params.glowWarmAbove,
      caught: e.events.some((ev) => ev.type === 'caught'),
    };
    for (const ev of this.tractorWatch.update(dt, { tractor, girls })) {
      const girl = this.companions.find((c) => c.character.id === ev.girl);
      girl?.voice.say(`tractor${ev.type[0].toUpperCase()}${ev.type.slice(1)}`, { urgent: true });
    }
  }

  /** J on the tractor or a quad with a rack: hook a trailer on when the hitch is at its ring, or take it off when you're stopped. */
  toggleHitch() {
    const unit = this.riddenUnit;
    if (!unit || !canTow(unit.quad)) return;
    const q = unit.quad;
    const tractor = !!this.tractorUnit && unit === this.tractorUnit;
    const hay = tractor ? this.trailer : null;
    const tip = this.tipTrailer;
    const mine = [hay, tip].filter(Boolean);
    if (tractor && this.chain?.state !== 'stowed') return this.hud.toast('The tow chain is on the drawbar', 2);
    const on = mine.find((t) => t.hitched && (t === hay || t.puller === q));
    if (on) {
      if (q.speed > 0.5) return this.hud.toast('Stop before you unhitch the trailer', 2);
      on.unhitch();
      return this.hud.toast('Trailer unhitched', 1.6);
    }
    const can = mine.find((t) => t.canHitch(q));
    if (can) {
      can.hitch(q);
      this.achievements.note('hitched');
      return this.hud.toast('Trailer hitched', 1.6);
    }
    const near = Math.min(...mine.filter((t) => !t.hitched).map((t) => t.gap(q)));
    this.hud.toast(near < 8 ? 'Back the hitch up to the trailer\'s ring' : 'No trailer behind you', 2);
  }

  /** The hay ride: the trailer follows the tractor, and the girls climb on, bounce about, lie back, fall off and climb down (npc/hayRide.js). */
  updateHayRide(dt, ridden) {
    const t = this.trailer;
    t.update(dt);
    const m = t.motion;
    const active = t.hitched && !!ridden && ridden === this.tractorUnit;
    const free = (c) => c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const say = (c, key) => c?.voice.say(key, { urgent: true });

    // Whoever has come off is straight after it, running, and nobody waits for the tractor to stop.
    for (const c of this.companions) {
      if (!c.hayFell || !c.fsm.is('idle')) continue;
      if (!active) c.hayFell = false;
      else if (free(c)) {
        const slot = t.freeSlot(c.root.position);
        if (slot) c.boardTrailer(t, slot, { chase: true });
      }
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: free(c) && !c.hayFell,
      aboard: c.onHayRide && c.trailer === t,
      dist: c.root.position.distanceTo(t.model.position),
      seatX: c.traSlot ? c.traSlot.side * 0.5 : 0,
    }));
    for (const ev of this.hayRide.update(dt, { active, speed: m.speed, omega: m.omega, jolt: m.jolt, girls })) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = t.freeSlot(c.root.position);
        if (slot && c.boardTrailer(t, slot)) say(c, 'hayBoard');
      } else if (ev.type === 'leave') {
        c.leaveTrailer();
        c.abortBoarding();
      } else if (ev.type === 'lie') {
        c.hayLie(true);
        say(c, 'hayLie');
      } else if (ev.type === 'sit') c.hayLie(false);
      else if (ev.type === 'bump') {
        for (const o of this.companions) o.hayFlail();
        say(c, 'hayBump');
      } else if (ev.type === 'slide') {
        if (c.slideOffTrailer(ev.side)) this.hayRide.clear(ev.girl);
      }
    }
    // A girl who has just landed says so, and the other one sees it.
    for (const c of this.companions) {
      if (!c.hayLanded || c.hayLandedSaid) c.hayLandedSaid &&= c.hayLanded;
      else {
        c.hayLandedSaid = true;
        const [own, other] = c.trailer && c.trailer === this.utvMount ? ['utvTipOut', 'utvTipLaugh'] : c.trailer === this.tipTrailer ? ['trailerTipOut', 'trailerTipLaugh'] : ['hayFall', 'hayFallOther'];
        say(c, own);
        this.hayLater.push({ left: 1.2, girl: c.others()[0], key: other });
      }
    }
    for (const l of this.hayLater) l.left -= dt;
    for (const l of this.hayLater.filter((x) => x.left <= 0)) say(l.girl, l.key);
    this.hayLater = this.hayLater.filter((x) => x.left > 0);
  }

  /** The wheel's "Tractor" slice for a girl: up on the mudguard (or down again), or a go at driving it. */
  tractorWheelOption(c) {
    const unit = this.tractorUnit;
    const children = [];
    if (c.fsm.is('onTrailer') && c.trailer === this.tractorMount) children.push({ label: 'Get down off the tractor', run: () => (this.mudguard.dismiss(c.character.id), c.leaveTrailer()) });
    else if (c.fsm.is('idle')) {
      if (!this.trailer.hitched && this.tractorMount.freeSlot(c.root.position)) children.push({ label: 'Climb up on the mudguard', run: () => this.askOntoTractor(c) });
      if (this.tractorFree() && c.canDrive(unit.quad)) children.push({ label: 'Drive it', run: () => this.askDriveTractor(c) });
      if (this.canAskStart(c, 'tractor')) children.push({ label: 'Start it', run: () => c.requestStart(unit.quad) });
    }
    return { label: 'Tractor', color: unit.spec.bodyColor, children };
  }

  /** Nobody's on the tractor or on their way to it, it's stopped, and nothing is hitched to it. */
  tractorFree() {
    if (!this.tractorUnit) return false;
    const q = this.tractorUnit.quad;
    const busy = (c) => (c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling') || (c.fsm.is('walking') && c.fsm.data?.goal === 'drive'))) || (c.onHayRide && c.trailer === this.tractorMount);
    return !q.rider && q.speed < 0.5 && !this.trailer.hitched && !this.companions.some(busy);
  }

  /** You ask her for a go on the tractor: Jess is thrilled, and Amy says no until her day has come. */
  askDriveTractor(c) {
    this.askDriveVehicle(c, 'tractor');
  }

  /** The tractor, the UTV and the two Land Rovers as the girls' goes know them: { unit, free(), ask line, refuse line }. */
  goVehicle(kind) {
    return { tractor: this.tractorUnit, utv: this.utvUnit, landy: this.landys.landy.unit, defender: this.landys.defender.unit }[kind] ?? null;
  }

  /** Which of the four this unit is, or null. */
  goKindOf(quad) {
    return GO_KINDS.find((k) => this.goVehicle(k)?.quad === quad) ?? null;
  }

  /** The seats of a UTV or Land Rover kind ('utv', 'landy', 'defender'): the mount the girls climb into. */
  mountOfKind(kind) {
    return kind === 'utv' ? this.utvMount : this.landys[kind].mount;
  }

  /** And the riding logic that goes with them. */
  rideOfKind(kind) {
    return kind === 'utv' ? this.utvRide : this.landys[kind].ride;
  }

  /** Nobody is in or on it or on their way to it, it's stopped, and (for the tractor) nothing is hitched; for the UTV the bed is down and empty. */
  goFree(kind) {
    const unit = this.goVehicle(kind);
    if (!unit) return false;
    if (kind === 'tractor') return this.tractorFree();
    const q = unit.quad;
    const mount = this.mountOfKind(kind);
    const busy = (c) => (c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling', 'cranking') || (c.fsm.is('walking') && ['drive', 'crank'].includes(c.fsm.data?.goal)))) || (c.onHayRide && c.trailer === mount);
    if (kind === 'utv' && (this.utvBed.tip > 0.02 || mount.bedBusy)) return false;
    return !q.rider && !q.driver && !q.passenger && !q.isTipped && q.speed < 0.5 && !this.companions.some(busy);
  }

  /**
   * She can be asked to start it: stood about, it isn't running and nobody's on it or going to it. Either girl will, Amy too (she won't drive
   * them until her day, but she'll start them); on the Land Rover with a flat battery that means the starting handle.
   */
  canAskStart(c, kind) {
    const q = this.goVehicle(kind)?.quad;
    return !!q && c.fsm.is('idle') && !q.engine.isRunning && this.goFree(kind);
  }

  /** You ask her for a go: Jess is thrilled, and Amy says no until her day has come. */
  askDriveVehicle(c, kind) {
    const id = c.character.id;
    const line = { tractor: ['tractorRefuse', 'tractorGoAsk'], utv: ['utvRefuse', 'utvGoAsk'], landy: ['landyRefuse', 'landyGoAsk'], defender: ['landyRefuse', 'landyGoAsk'] }[kind];
    if (this.tractorGo.ask(id) === 'refuse') return void c.voice.say(line[0], { force: true });
    this.startGo(c, kind);
    c.voice.say(line[1], { force: true });
  }

  /** Jess tapes L plates to Amy's quad, Amy peels them off, and once she's confident she tapes them to the tractor (npc/lPlates.js). */
  updateLPlates(dt) {
    const amy = this.companions.find((c) => c.character.id === 'amy');
    const jess = this.companions.find((c) => c.character.id === 'jess');
    if (!amy || !jess) return;
    const mine = this.girlUnits.find((u) => u.spec.id === amy.claimedSpec);
    const free = (c) => c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob && !c.hayFell;
    const near = mine ? Math.hypot(amy.root.position.x - mine.quad.position.x, amy.root.position.z - mine.quad.position.z) < 4 : false;
    for (const ev of this.lPlates.update(dt, {
      amyFree: free(amy),
      jessFree: free(jess),
      amyByQuad: near,
      hasQuad: !!mine,
      confidence: meanSkill(this.skills.levels.amy),
      tractorFree: this.tractorFree(),
    })) {
      if (ev.type === 'jessTape') {
        jess.voice.say('lplateTape', { force: true });
        this.hayLater.push({ left: 4, girl: amy, key: 'lplateFound' });
      } else if (ev.type === 'amyPeel') {
        amy.voice.say('lplatePeel', { force: true });
        this.hayLater.push({ left: 3.5, girl: jess, key: 'lplateCheek' });
      } else if (ev.type === 'amyStick') {
        amy.voice.say('lplateStick', { force: true });
        this.hayLater.push({ left: 4, girl: jess, key: 'lplateTractor' });
      }
    }
    const where = this.lPlates.where;
    if (where === 'tractor' && this.tractorUnit) this.lPlateSet.showOn(this.tractorUnit.quad.bodyRoot, 'tractor');
    else this.lPlateSet.showOn(where === 'quad' && mine ? mine.quad.bodyRoot : null, 'quad');
  }

  /** She walks over and has a go at starting and driving the tractor, the UTV or the Land Rover. */
  startGo(c, kind) {
    const unit = this.goVehicle(kind);
    if (!c.homeQuad && c.quad !== unit.quad) c.homeQuad = c.quad;
    this.tractorGo.started(c.character.id);
    this.tractorSeen[c.character.id] = { stalls: 0, hops: 0, crunches: 0, setOff: false, wasDriving: false, kind, joinRolled: false, joined: null };
    c.requestDrive(unit.quad);
  }

  /**
   * Jess takes one now and then, Amy has her day, and each of them says what's happening on her go (npc/tractorGo.js, tractorGoLines.js,
   * vehicleGoLines.js). On the UTV and the Land Rover the other girl may climb in beside her; on the Land Rover with a flat battery she
   * swings the starting handle first (npc/crankAttempt.js).
   */
  /** What a girl says as she pushes your vehicle for a bump-start (npc/pushStart.js, pushLines.js). */
  updatePushStart() {
    const mine = this.riddenUnit?.quad.engine;
    if (mine?.caughtBy === 'roll' && mine.events.some((ev) => ev.type === 'caught')) this.achievements.note('bumpStart');
    for (const c of this.companions) {
      for (const e of c.pushEvents.splice(0)) {
        if (e === 'start') c.voice.say('pushStart', { urgent: true });
        else if (e === 'now') c.voice.say('pushNow', { urgent: true, force: true });
        else if (e === 'caught') c.voice.say('pushCaught', { urgent: true });
        else if (e === 'tired') c.voice.say('pushTired', { urgent: true });
      }
    }
  }

  /** The wheel's "Push start" slice: you're at the controls of a manual that won't start, and she's free to push it. */
  pushStartOption(c) {
    const unit = this.riddenUnit;
    if (!unit || !c.fsm.is('idle') || !c.canPushStart(unit.quad)) return null;
    return { label: 'Push start it', run: () => c.requestPush(unit.quad) };
  }

  updateTractorGo(dt, ridden) {
    const girlsFree = {};
    for (const c of this.companions) girlsFree[c.character.id] = c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob && !c.hayFell;
    const youOn = GO_KINDS.some((k) => !!ridden && ridden === this.goVehicle(k));
    const vehicles = GO_KINDS.filter((k) => this.goFree(k) && ridden !== this.goVehicle(k));
    for (const ev of this.tractorGo.update(dt, { free: girlsFree, vehicles: youOn ? [] : vehicles })) {
      const c = this.companions.find((o) => o.character.id === ev.girl);
      const ask = { tractor: 'tractorGoAsk', utv: 'utvGoAsk', landy: 'landyGoAsk', defender: 'landyGoAsk' }[ev.vehicle];
      if (ev.type === 'amyDay') c.voice.say('tractorDay', { force: true });
      else c.voice.say(ask, { force: true });
      this.startGo(c, ev.vehicle);
    }
    for (const c of this.companions) {
      const id = c.character.id;
      const seen = (this.tractorSeen[id] ??= { stalls: 0, hops: 0, crunches: 0, setOff: false, wasDriving: false, kind: 'tractor', joinRolled: false, joined: null });
      const other = c.others()[0];
      const kind = seen.kind;
      const q = this.goVehicle(kind)?.quad;
      if (!q) continue;
      const pre = { tractor: 'tractorGo', utv: 'utvGo', landy: 'landyGo', defender: 'landyGo' }[kind];
      // The starting handle, on a flat battery.
      for (const e of c.crankEvents.splice(0)) {
        if (e === 'swing') c.voice.say('landyGoSwing', { urgent: true });
        else if (e === 'kick') {
          c.voice.say('landyGoKick', { urgent: true });
          this.hayLater.push({ left: 1.5, girl: other, key: 'landyGoKickWatch' });
        } else if (e === 'noLuck') {
          c.voice.say('landyGoNoLuck', { urgent: true });
          seen.wasDriving = false;
        }
      }
      // The other girl may climb in beside her as she gets in (the tractor's is the mudguard ride's).
      if (kind !== 'tractor' && !seen.joinRolled && c.quad === q && c.fsm.is('mounting')) {
        seen.joinRolled = true;
        const g = this.tractorGo;
        if (g.random() < g.p.joinChance && other && other.fsm.is('idle') && other.root.position.distanceTo(q.position) < 30) {
          this.goJoins.push({ left: g.p.joinDelayMin + g.random() * (g.p.joinDelayMax - g.p.joinDelayMin), girl: other, kind, driver: id });
          seen.joined = other.character.id;
        }
      }
      const driving = c.quad === q && c.fsm.is('driving');
      if (driving) {
        const d = c.drive;
        seen.wasDriving = true;
        if (d.phase === 'drive' && !seen.setOff) {
          seen.setOff = true;
          c.voice.say(`${pre}SetOff`, { urgent: true });
          this.hayLater.push({ left: 4, girl: other, key: `${pre}Watch` });
        }
        if (d.stalls > seen.stalls) {
          seen.stalls = d.stalls;
          if (kind === 'tractor') c.voice.say('tractorGoStall', { urgent: true });
        }
        if ((q.shifter.hops ?? 0) > (seen.hops ?? 0)) {
          seen.hops = q.shifter.hops;
          c.voice.say('tractorGoLurch', { urgent: true });
          if (other.root.position.distanceTo(q.position) < 30) this.hayLater.push({ left: 1.4, girl: other, key: 'tractorGoLurch' });
        }
        if ((q.shifter.crunches ?? 0) > seen.crunches) {
          seen.crunches = q.shifter.crunches;
          c.voice.say('landyGoCrunch', { urgent: true });
          if (other.root.position.distanceTo(q.position) < 30) this.hayLater.push({ left: 1.2, girl: other, key: 'landyGoCrunchWatch' });
        }
      } else if (seen.wasDriving) {
        seen.wasDriving = false;
        if (c.drive?.result !== 'gaveUp') c.voice.say(`${pre}Done`, { urgent: true });
        this.endJoin(seen, kind);
      }
      // Back to her own quad once she's off it, so everything else that looks at her quad finds one of the girls'.
      if (c.homeQuad && c.quad === q && c.fsm.is('idle')) {
        c.quad = c.homeQuad;
        c.homeQuad = null;
      }
    }
    // The other girl setting off to climb in.
    for (const j of this.goJoins) j.left -= dt;
    for (const j of this.goJoins.filter((x) => x.left <= 0)) {
      const mount = this.mountOfKind(j.kind);
      const ride = this.rideOfKind(j.kind);
      const slot = j.girl.fsm.is('idle') ? mount.freeSlot(j.girl.root.position) : null;
      if (slot && j.girl.boardTrailer(mount, slot)) {
        ride.ask(j.girl.character.id); // she stays until the driver's done
        j.girl.voice.say('utvBoard', { urgent: true });
      }
    }
    this.goJoins = this.goJoins.filter((x) => x.left > 0);
  }

  /** The driver is done: the girl who climbed in beside her climbs out. */
  endJoin(seen, kind) {
    const id = seen.joined;
    seen.joined = null;
    const c = id && this.companions.find((o) => o.character.id === id);
    const mount = this.mountOfKind(kind);
    if (!c || c.trailer !== mount) return;
    this.rideOfKind(kind).dismiss(id);
    c.leaveTrailer();
    c.abortBoarding();
  }

  /** You asked her to climb up on the tractor's wheel arch: she goes at once and stays until you ask her down. */
  askOntoTractor(c) {
    const mount = this.tractorMount;
    const slot = mount.freeSlot(c.root.position);
    if (!slot || !c.boardTrailer(mount, slot)) return this.hud.toast('She can\'t just now');
    this.mudguard.ask(c.character.id);
    c.voice.say('mudBoard', { force: true });
  }

  /** A girl on the tractor's wheel arch: she climbs up when you stop with it running, shouts across at you, and climbs down when you get off. */
  updateMudguard(dt, ridden) {
    const mount = this.tractorMount;
    mount.update(dt);
    const unit = this.tractorUnit;
    const riding = ridden === unit;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const on = (c) => c.onHayRide && c.trailer === mount;
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !c.hayFell && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob,
      aboard: on(c),
      dist: c.root.position.distanceTo(mount.model.position),
    }));
    const driver = this.companions.find((c) => c.quad === unit.quad && c.fsm.is('mounting', 'driving'));
    const settingOff = !!driver && (driver.fsm.is('mounting') || ['start', 'settle'].includes(driver.drive?.phase));
    const ctx = {
      active: riding && unit.quad.engine.isRunning,
      riding,
      parked: !riding && !unit.quad.rider && !driver,
      drivenBy: driver?.character.id ?? null,
      settingOff,
      trailer: this.trailer.hitched,
      speed: unit.quad.speed,
      girls,
    };
    for (const ev of this.mudguard.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = mount.freeSlot(c.root.position);
        if (slot && c.boardTrailer(mount, slot)) c.voice.say('mudBoard', { urgent: true });
      } else if (ev.type === 'shout') c.voice.say('mudShout', { urgent: true });
      else if (ev.type === 'leave') {
        if (ev.bored) this.mudguard.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
  }

  /** Builds the UTV, with its own seeded idle, roughness, fuel and hours, and adds it to `units` (not `girlUnits`). */
  addUtv(spawn) {
    const random = createRandom(this.seed ^ 0x07c5);
    const unit = new QuadUnit({
      spec: UTV_SPEC,
      spawn,
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      audioHub: this.audioHub,
    });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(UTV_SPEC.idleRange, random));
    unit.variation = applyVariation(UTV_SPEC, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(UTV_SPEC, unit.engine.params, createRandom(this.seed ^ 0x07c6));
    unit.quad.usage.hours = pickReading(UTV_SPEC.hoursRange, random);
    const [hoursLo, hoursHi] = UTV_SPEC.hoursRange;
    unit.quad.usage.odoMiles = pickRelatedReading(UTV_SPEC.odoRange, (unit.quad.usage.hours - hoursLo) / (hoursHi - hoursLo), random);
    unit.quad.parkBrake = true;
    this.units = [...this.units, unit];
    unit.where = spawn.where;
    return unit;
  }

  /** The UTV's tank has petrol in it, or its engine is soaked with it: worth pumping out. */
  utvTainted(unit) {
    const q = unit.quad;
    return q.engine.dieselSoak > 0.02 || (q.fuel.litres > 0.05 && q.fuel.diesel < 0.98);
  }

  /** The UTV: its tip lever and tailgate, the girls in its seats and bed, and what they say (npc/utvRide.js, vehicle/utvBed.js). */
  updateUtv(dt, ridden, input) {
    const unit = this.utvUnit;
    const q = unit.quad;
    const mount = this.utvMount;
    const bed = this.utvBed;
    mount.update(dt);
    const riding = ridden === unit;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const seatOf = (c) => (c.onHayRide && c.trailer === mount ? c.traSlot?.name ?? null : null);
    const say = (c, key) => c?.voice.say(key, { urgent: true });

    // T pulls the tip lever, from the seat or standing by the bed.
    const near = riding || (!this.player.isRiding && this.player.position.distanceTo(q.position) < 3.2);
    if (near && input.wasPressed('KeyT') && !q.isTipped && !this.handsFull) {
      const note = bed.toggle(q.speed);
      if (note) this.achievements.note('tipped');
      if (note) this.hud.toast(note, 2);
    }
    bed.update(dt, { speed: q.speed, gateDown: mount.bedBusy });
    poseUtvBed(q.model, bed);
    // Whatever is stood in the bed slides out behind once it is high enough, and goes with the UTV otherwise.
    q.model.updateMatrixWorld(true);
    if (bed.sliding && this.utvCargo.items.length) this.utvCargo.tipOut(new THREE.Vector3(0, 0, -1).transformDirection(q.model.matrixWorld).setY(0).normalize());
    this.utvCargo.update(dt);

    // The seat belts: who is in which seat, `;` for yours, and the girls do their own (vehicle/seatBelts.js).
    const youSeat = riding ? 'driver' : this.player.isRiding && q.passenger ? this.player.benchSeat : null;
    const sitting = { driver: null, mid: null, left: null };
    if (youSeat) sitting[youSeat] = 'you';
    for (const c of this.companions) {
      // Only once she is actually in the seat (not while she walks over or climbs in) does she count as sitting there.
      const seat = c.fsm.is('driving') && c.quad === q ? 'driver' : c.fsm.is('onTrailer') ? seatOf(c) : null;
      if (seat && seat in sitting) sitting[seat] = 'girl';
    }
    if (youSeat && input.wasPressed('Semicolon')) {
      q.belts.toggle(youSeat); // no message: you look at the belt and the lamp
    }
    if (q.belts.update(dt, sitting, q.engine.ignitionOn, dashClock().seconds())) this.audioHub.beltBing(q.position); // fading with distance, like its engine

    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !c.hayFell && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob,
      seat: seatOf(c),
      dist: c.root.position.distanceTo(q.position),
    }));
    const parked = !riding && !q.rider && !q.driver && !q.passenger;
    const ctx = { active: riding && q.engine.isRunning, riding, parked, playerSeat: this.player.isRiding && q.passenger ? this.player.benchSeat : null, speed: q.speed, slide: bed.sliding, girls };
    for (const ev of this.utvRide.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = mount.slots[ev.seat];
        if (!slot || slot.girl || (ev.seat === 'bed' && bed.tip > 0.02) || !c.boardTrailer(mount, slot)) continue;
        if (ev.seat === 'bed') say(c, 'utvBedGo');
        else if (ev.squabble?.winner === ev.girl) {
          say(c, 'utvMiddleWin');
          this.hayLater.push({ left: 2.6, girl: girlOf(ev.squabble.loser), key: 'utvMiddleLose' });
        } else if (!ev.squabble) say(c, 'utvBoard');
      } else if (ev.type === 'bedTell') say(c, 'utvBedTell');
      else if (ev.type === 'bedShout') say(c, 'utvBedShout');
      else if (ev.type === 'slide') {
        if (c.slideOffTrailer(1, new THREE.Vector3(0, 0, -1))) this.utvRide.clear(ev.girl);
      } else if (ev.type === 'leave') {
        if (ev.bored) this.utvRide.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
    // Petrol in the diesel: it runs badly, and whoever is near says so, once until it's been put right.
    const soaked = q.engine.dieselSoak > 0.2 && q.engine.isRunning;
    if (!soaked && q.engine.dieselSoak < 0.05) this.utvPetrolSaid = false;
    else if (soaked && !this.utvPetrolSaid) {
      const speaker = this.companions.filter((c) => c.root.position.distanceTo(q.position) < 20).sort((a, b) => a.root.position.distanceTo(q.position) - b.root.position.distanceTo(q.position))[0];
      if (speaker) {
        this.utvPetrolSaid = true;
        say(speaker, 'utvPetrol');
      }
    }
  }

  /** Whichever jerry can, the toolbox, the jump leads or the oil bottle you are holding, or null. */
  heldLoad() {
    return [this.petrolCan, this.premixCan, this.dieselCan, this.toolbox, this.leads, this.oilBottle].find((i) => i.held) ?? null;
  }

  /** What to call whatever heldLoad() found. */
  loadName(item) {
    return item === this.toolbox ? 'toolbox' : item === this.leads ? 'jump leads' : item === this.oilBottle ? 'oil bottle' : 'jerry can';
  }

  /** The UTV's bed as somewhere to stand a can, the toolbox, the leads or the oil bottle (vehicle/cargoHold.js). They tip out with the bed. */
  addUtvCargo(quad) {
    const bed = quad.model.getObjectByName('bed');
    this.utvCargo = new CargoHold({
      scene: this.scene,
      ground: (x, z) => this.world.heightAt(x, z),
      anchors: BED_CARGO_SPOTS.map((_, i) => bed.getObjectByName(`bedCargo${i}`)),
      yawFor: (item) => BED_CARGO_YAWS[item.model.name] ?? BED_CARGO_YAW,
    });
    registerTuning('UTV load', this.utvCargo.p, CARGO_PARAM_RANGES);
    this.interaction.add({
      target: bed.getObjectByName('bedProxy'),
      priority: 1, // looking into the bed with something in your hands wins over the UTV as a whole (and its tank)
      isAvailable: () => !!this.heldLoad() && !this.player.isRiding,
      prompt: () => {
        const what = this.loadName(this.heldLoad());
        if (this.utvBed.tip > 0.02) return { text: `The bed is up   ·   G put the ${what} down` };
        if (this.utvCargo.freeSpot() === null) return { text: `The bed is full   ·   G put the ${what} down` };
        return `Put the ${what} in the UTV's bed`;
      },
      interact: () => {
        const item = this.heldLoad();
        if (item && this.utvBed.tip <= 0.02) this.utvCargo.load(item);
      },
    });
  }

  tipTrailerPrompt() {
    const item = this.heldLoad();
    const t = this.tipTrailer;
    if (!item) return { text: t.cargo.length || t.bed.tip > 0.02 ? 'T to tip the trailer' : 'The little tipping trailer   ·   T to tip it' };
    const what = this.loadName(item);
    if (t.bed.tip > 0.02) return { text: `The tub is up   ·   G put the ${what} down` };
    if (t.freeCargoSpot() === null) return { text: `The trailer is full   ·   G put the ${what} down` };
    return `Put the ${what} in the trailer`;
  }

  /** E at the trailer with a can, the toolbox, the jump leads or the oil bottle in your hands: stand it in the tub. */
  loadTipTrailer() {
    const item = this.heldLoad();
    if (item) this.tipTrailer.load(item);
  }

  /** The tipping trailer: its tub, its weight on whatever pulls it, and the girl who rides in it (vehicle/tipTrailer.js, npc/trailerRide.js). */
  updateTipTrailer(dt, ridden, input) {
    const t = this.tipTrailer;
    t.update(dt);
    // What it takes from the quad (or tractor) in front of it.
    if (this.tipPuller && this.tipPuller !== t.puller) Object.assign(this.tipPuller.tow, { driveFactor: 1, brakeFactor: 1 });
    this.tipPuller = t.puller;
    if (t.puller) Object.assign(t.puller.tow, towEffect(towLoad(t.girlCount, t.cargo.length, this.towParams), !!t.puller.tractor || !!t.puller.landRover, this.towParams));

    const riding = !!ridden && t.hitched && ridden.quad === t.puller;
    // T tips the tub, from the seat of whatever pulls it or standing by it.
    const near = riding || (!this.player.isRiding && this.player.position.distanceTo(t.model.position) < 3);
    if (near && input.wasPressed('KeyT') && !this.handsFull && !(ridden && !riding) && !(riding && ridden.quad.isTipped)) {
      const note = t.toggleTip();
      if (note) this.achievements.note('tipped');
      if (note) this.hud.toast(note.replace('the bed', 'the tub'), 2);
    }

    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const say = (c, key) => c?.voice.say(key, { urgent: true });
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !c.hayFell && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob,
      aboard: c.onHayRide && c.trailer === t,
      dist: c.root.position.distanceTo(t.model.position),
    }));
    const ctx = { riding, active: riding && ridden.quad.engine.isRunning, speed: t.motion.speed, jolt: t.motion.jolt, slide: t.bed.sliding, girls };
    for (const ev of this.tipRide.update(dt, ctx)) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = t.freeSlot();
        if (slot && c.boardTrailer(t, slot)) say(c, 'trailerBoard');
      } else if (ev.type === 'tell') say(c, 'trailerTell');
      else if (ev.type === 'bump') say(c, 'trailerBump');
      else if (ev.type === 'shout') say(c, 'trailerShout');
      else if (ev.type === 'slide') {
        if (c.slideOffTrailer(1, new THREE.Vector3(0, 0, -1))) this.tipRide.clear(ev.girl);
      } else if (ev.type === 'leave') {
        if (ev.bored) this.tipRide.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
  }

  /** The wheel's "Trailer" slice for a girl: climb into the tipping trailer, or out again. */
  tipTrailerWheelOption(c) {
    const t = this.tipTrailer;
    const children = [];
    if (c.fsm.is('onTrailer') && c.trailer === t) children.push({ label: 'Get out of the trailer', run: () => (this.tipRide.dismiss(c.character.id), c.leaveTrailer()) });
    else if (c.fsm.is('idle') && t.freeSlot()) children.push({ label: 'Get in the trailer', run: () => this.askIntoTipTrailer(c) });
    return { label: 'Trailer', color: 0x9aa3a6, children };
  }

  /** You asked her into the trailer: she goes at once and stays until you ask her out. */
  askIntoTipTrailer(c) {
    const t = this.tipTrailer;
    const slot = t.freeSlot();
    if (!slot || !c.boardTrailer(t, slot)) return this.hud.toast('She can\'t just now');
    this.tipRide.ask(c.character.id);
    c.voice.say('trailerAsked', { force: true });
  }

  /** The wheel's "UTV" slice for a girl: get in (she picks her own seat), ride in the bed, or get out again. */
  utvWheelOption(c) {
    const mount = this.utvMount;
    const children = [];
    if (c.fsm.is('onTrailer') && c.trailer === mount) children.push({ label: 'Get out of the UTV', run: () => (this.utvRide.dismiss(c.character.id), c.leaveTrailer()) });
    else if (c.fsm.is('idle') && this.utvFree()) {
      if (mount.freeSlot(c.root.position)) children.push({ label: 'Get in the UTV', run: () => this.askIntoUtv(c, false) });
      if (this.goFree('utv') && c.canDrive(this.utvUnit.quad)) children.push({ label: 'Drive it', run: () => this.askDriveVehicle(c, 'utv') });
      if (this.canAskStart(c, 'utv')) children.push({ label: 'Start it', run: () => c.requestStart(this.utvUnit.quad) });
      if (!mount.bedBusy && this.utvBed.tip < 0.02) children.push({ label: 'Ride in the bed', run: () => this.askIntoUtv(c, true) });
    }
    return { label: 'UTV', color: this.utvUnit.spec.bodyColor, children };
  }

  /** Nobody is driving the UTV and it is standing still. */
  utvFree() {
    const q = this.utvUnit.quad;
    return !q.rider && !q.driver && q.speed < this.utvRide.p.stopSpeed;
  }

  /** You asked her into the UTV: she goes at once and stays until you ask her out. Amy won't ride in the bed. */
  askIntoUtv(c, inBed) {
    const mount = this.utvMount;
    if (inBed && c.character.id === 'amy') return void c.voice.say('utvBedRefuse', { force: true });
    const slot = inBed ? mount.slots.bed : mount.freeSlot(c.root.position);
    if (!slot || slot.girl || !c.boardTrailer(mount, slot)) return this.hud.toast('She can\'t just now');
    this.utvRide.ask(c.character.id);
    c.voice.say(inBed ? 'utvBedGo' : 'utvBoard', { force: true });
  }

  /** Builds a Land Rover: a unit like the UTV (not one of the girls'), with a quad's wear, faults, quirks and oil. */
  addLandRover(spawn, spec) {
    const random = createRandom(this.seed ^ (spec.defender ? 0x1a5c : 0x1a4c));
    const unit = new QuadUnit({ spec, spawn, scene: this.scene, physics: this.physics, RAPIER: this.RAPIER, world: this.world, audioHub: this.audioHub });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(spec.idleRange, random));
    unit.variation = applyVariation(spec, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(spec, unit.engine.params, createRandom(this.seed ^ (spec.defender ? 0x1a5e : 0x1a4e)));
    unit.quad.usage.odoMiles = pickReading(spec.odoRange, random);
    unit.engine.wear = spec.wearRange[0] + (spec.wearRange[1] - spec.wearRange[0]) * random();
    unit.quad.tyres = new TyreSet(dealTyres(random, 4, this.tyreParams), this.tyreParams);
    unit.quad.tyres.useLayout(unit.quad.layout.wheels);
    unit.quad.quirks = new QuirkSet(pickQuirks(featuresOf(spec, false), random, this.quirkParams), this.quirkParams);
    if (unit.quad.sump) unit.quad.sump = new Sump({ level: startLevel(false, random, this.sumpParams), burner: false, params: this.sumpParams });
    unit.quad.faults.roll(createRandom(this.seed ^ (spec.defender ? 0x1a5f : 0x1a4f)));
    unit.quad.faults.prone.belt = 0; // a clutch, not a belt
    if (spec.engine.compressionIgnition) unit.quad.faults.prone.carb = 0; // and a diesel has no carb
    unit.quad.parkBrake = true;
    this.units = [...this.units, unit];
    unit.where = spawn.where;
    return unit;
  }

  /**
   * The 200TDi's front backrests: tipped forward while a girl climbs into or out of the back past one, or for a moment after you do,
   * unless somebody's sat in it (vehicle/rearAccess.js).
   */
  updateSeatTips(dt, q, mount, sitting) {
    const moving = [];
    for (const c of this.companions) {
      const slot = c.trailer === mount ? c.traSlot : null;
      if (!slot?.rear) continue;
      const near = c.fsm.is('walking') && c.fsm.data?.goal === 'board' && c.root.position.distanceTo(mount.standPoint(slot.side, slot).position) < 1.5;
      const climbing = c.fsm.is('boarding') || (c.fsm.is('onTrailer') && (c.fsm.data.leaving || c.fsm.data.fromWorld));
      if (near || climbing) moving.push(mount.doorOf(slot));
    }
    for (const k of Object.keys(q.tipHold)) {
      q.tipHold[k] = Math.max(0, q.tipHold[k] - dt);
      if (q.tipHold[k] > 0) moving.push(k);
    }
    const occupied = Object.keys(q.seatTips).filter((s) => sitting[s]);
    easeSeatTips(q.seatTips, seatTipTargets(moving, occupied), dt, this.rearAccess.tipSpeed);
  }

  /** What standing at the Land Rover's front says: the starting handle, how you're holding it, and whether your hand still hurts. */
  crankPrompt(quad) {
    const c = quad.crank;
    if (!c.ready) return 'Your hand hurts. Give it a moment';
    const grip = c.grip === 'round' ? 'thumb round the handle' : 'thumb alongside your fingers';
    const key = quad.engine.ignitionOn ? '' : '   ·   K ignition first';
    return `Starting handle (${grip})   ·   hold P, let go to swing   ·   1 thumb round   ·   2 thumb alongside${key}`;
  }

  /** A Land Rover: where you stand for the Series' starting handle and what a kick-back gets you, and the girls on its bench (npc/utvRide.js). */
  updateLandRover(dt, ridden, input, l) {
    const unit = l.unit;
    const q = unit.quad;
    const mount = l.mount;
    mount.update(dt);
    const riding = ridden === unit;
    const girlOf = (id) => this.companions.find((c) => c.character.id === id);
    const say = (c, key) => c?.voice.say(key, { urgent: true });
    // At the front, on foot, with the starting handle's hole in reach (ground distance: you stand, it's down at the bumper).
    const hole = q.crankHole?.getWorldPosition(new THREE.Vector3());
    const me = this.player.position;
    q.atCrank = !!q.crank && !this.player.isRiding && !!hole && Math.hypot(me.x - hole.x, me.z - hole.z) < q.crank.p.reach;
    if (q.kicked) {
      q.kicked = false;
      const near = this.companions.filter((c) => c.root.position.distanceTo(q.position) < 15).sort((a, b) => a.root.position.distanceTo(q.position) - b.root.position.distanceTo(q.position))[0];
      say(near, 'landyKick');
    }

    // The seat belts, as the UTV's: `;` for yours, and the girls do their own (vehicle/seatBelts.js). The 200TDi has the lamp and the bong; the old Series has neither.
    const youSeat = riding ? 'driver' : this.player.isRiding && q.passenger ? this.player.benchSeat : null;
    const sitting = Object.fromEntries(Object.keys(q.belts.seats).map((s) => [s, null])); // every seat with a belt, the back bench's too
    if (youSeat) sitting[youSeat] = 'you';
    for (const c of this.companions) {
      const seat = c.fsm.is('driving') && c.quad === q ? 'driver' : c.fsm.is('onTrailer') && c.trailer === mount ? c.traSlot?.name ?? null : null;
      if (seat && seat in sitting) sitting[seat] = 'girl';
    }
    if (youSeat && input.wasPressed('Semicolon')) q.belts.toggle(youSeat);
    if (q.belts.update(dt, sitting, q.engine.ignitionOn, dashClock().seconds()) && unit.spec.defender) this.audioHub.beltBing(q.position);
    if (mount.rearSlots.length) this.updateSeatTips(dt, q, mount, sitting);

    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !c.hayFell && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob,
      seat: c.onHayRide && c.trailer === mount ? c.traSlot?.name ?? null : null,
      dist: c.root.position.distanceTo(q.position),
    }));
    const parked = !riding && !q.rider && !q.driver && !q.passenger;
    for (const ev of l.ride.update(dt, { active: riding && q.engine.isRunning, riding, parked, playerSeat: q.passenger ? this.player.benchSeat : null, speed: q.speed, slide: false, girls })) {
      const c = girlOf(ev.girl);
      if (ev.type === 'board') {
        const slot = mount.slots[ev.seat];
        if (!slot || slot.girl || !c.boardTrailer(mount, slot)) continue;
        if (ev.squabble?.winner === ev.girl) {
          say(c, 'utvMiddleWin');
          this.hayLater.push({ left: 2.6, girl: girlOf(ev.squabble.loser), key: 'utvMiddleLose' });
        } else if (!ev.squabble) say(c, 'utvBoard');
      } else if (ev.type === 'leave') {
        if (ev.bored) l.ride.dismiss(ev.girl);
        c.leaveTrailer();
        c.abortBoarding();
      }
    }
  }

  /** The wheel's slice for a Land Rover (`l`, from `landys`) for a girl: get in (she picks her own seat on the bench), or get out again. */
  landyWheelOption(c, l) {
    const { mount, ride, kind } = l;
    const q = l.unit.quad;
    const name = l.spec.name;
    const children = [];
    if (c.fsm.is('onTrailer') && c.trailer === mount) children.push({ label: `Get out of the ${name}`, run: () => (ride.dismiss(c.character.id), c.leaveTrailer()) });
    else if (c.fsm.is('idle') && !q.rider && !q.driver && q.speed < ride.p.stopSpeed) {
      // "Get in" takes the front if there's room and the back if not; the 200TDi's slice also lets you send her to the back.
      if (mount.freeSlot(c.root.position) || mount.freeRearSlot(c.root.position)) children.push({ label: `Get in the ${name}`, run: () => this.askIntoLandy(c, l) });
      if (mount.freeRearSlot(c.root.position)) children.push({ label: 'Get in the back', run: () => this.askIntoLandy(c, l, { back: true }) });
    }
    if (c.fsm.is('idle') && this.goFree(kind) && c.canDrive(q)) children.push({ label: 'Drive it', run: () => this.askDriveVehicle(c, kind) });
    if (this.canAskStart(c, kind)) children.push({ label: 'Start it', run: () => c.requestStart(q) });
    return { label: name, color: l.spec.bodyColor, children };
  }

  /** You asked her into a Land Rover: she goes at once and stays until you ask her out. `back`: the 200TDi's back bench. */
  askIntoLandy(c, l, { back = false } = {}) {
    const from = c.root.position;
    const slot = back ? l.mount.freeRearSlot(from) : l.mount.freeSlot(from) ?? l.mount.freeRearSlot(from);
    if (!slot || slot.girl || !c.boardTrailer(l.mount, slot)) return this.hud.toast('She can\'t just now');
    l.ride.ask(c.character.id);
    c.voice.say('utvBoard', { force: true });
  }

  /** One manual vehicle (a quad or the tractor) has a worn gearbox this game: a gear that jumps out under load on a climb. Seeded. */
  /** Hold V by a quad to shove it along its length, away from you (or backwards from the side): how you reverse one that has no reverse. */
  pushOnFoot(input, looked) {
    if (!input.isDown('KeyV') || this.handsFull) {
      this.pushing = null;
      return;
    }
    // Keep hold of the one you started on as it rolls, even when your eyes move off it.
    const unit = looked && !looked.spec.tractor ? looked : this.pushing;
    if (!unit || unit.spec.tractor || this.player.isRiding) return;
    const q = unit.quad;
    const p = q.controlsParams;
    const d = this.player.position.clone().sub(q.position);
    if (d.length() > p.pushRange + 1.5) {
      this.pushing = null;
      return;
    }
    if (q.parkBrake) {
      q.say('The parking brake is on (Space to take it off)');
      return;
    }
    this.pushing = unit;
    q.pushDir = pushDirection(localAlong(d.x, d.z, q.yaw), p);
  }

  /** An empty quad that's rolling off with its brake off: the girls near it say whose fault it was (a real tally, vehicle/handbrake.js). */
  updateHandbrake(dt) {
    const quads = this.units
      .filter((u) => !u.spec.tractor)
      .map((u) => {
        const q = u.quad;
        return { id: u.id, attended: !!(q.input || q.ghost || q.driver || q.creeping || q.towed || q.passenger || q.pushLeft > 0), braked: q.parkBrake, speed: Math.hypot(q.velocity.x, q.velocity.z), left: q.lastLeft };
      });
    for (const e of this.rollWatch.update(dt, quads)) {
      const at = this.units.find((u) => u.id === e.id).quad.position;
      const girls = this.companions.map((c) => ({ id: c.character.id, near: c.root.position.distanceTo(at) < this.handbrakeParams.hearRange && !c.fsm.is('driving') }));
      for (const r of rollReactions(e, girls)) this.companions.find((c) => c.character.id === r.girl)?.voice.say(r.situation, { force: true });
    }
  }

  /**
   * A girl taking the wheel of a quad with a 2WD / 4WD switch may remember to put it in 4WD (a per-girl chance); if she doesn't and it
   * bogs her down in 2WD, she works out why, flips it, and her friend (if near) says so (vehicle/driveMode.js).
   */
  updateFourWd(dt) {
    for (const c of this.companions) {
      const st = this.fourWdState.get(c) ?? { quad: null, watch: new StuckWatch(DEFAULT_DRIVE_PARAMS) };
      this.fourWdState.set(c, st);
      const q = c.fsm.is('driving') && c.quad.drive ? c.quad : null;
      if (q !== st.quad) {
        st.quad = q;
        st.watch.reset();
        if (q && Math.random() < c.params.remembers4wd) q.drive.engage4wd();
      }
      if (!q) continue;
      const mud = Math.max(this.world.mudAt(q.position.x, q.position.z), this.world.bogAt?.(q.position.x, q.position.z) ?? 0);
      const speed = Math.hypot(q.velocity.x, q.velocity.z);
      if (!st.watch.update(dt, { is2wd: !q.drive.frontDriven, throttle: q.throttle, mud, speed })) continue;
      q.drive.engage4wd();
      const near = this.companions.filter((o) => o === c || o.root.position.distanceTo(q.position) < DEFAULT_HANDBRAKE_PARAMS.hearRange).map((o) => o.character.id);
      for (const r of forgotReaction(c.character.id, near)) this.companions.find((o) => o.character.id === r.girl)?.voice.say(r.situation, { force: true });
    }
  }

  /** A split seat soaks up the rain, and soaks you if you sit on it wet; the nearest girl has something to say. */
  updateQuirks(dt, ridden) {
    const raining = this.weather.rain > 0.25;
    for (const u of this.units) {
      const q = u.quad;
      q.quirks.seatStep(dt, { raining, covered: !!this.world.covered?.(q.position.x, q.position.z) });
    }
    if (ridden === this.lastRiddenForSeat) return;
    this.lastRiddenForSeat = ridden;
    if (!ridden) return;
    const remark = (situation) => {
      const near = this.companions.filter((c) => c.quad.position.distanceTo(ridden.quad.position) < 10);
      near[Math.floor(Math.random() * near.length)]?.voice.say(situation, { force: true });
    };
    if (ridden.quad.seatFrost > 0.3) {
      this.hud.toast('The seat is frosted over', 2.5);
      remark('seatFrosty');
    }
    if (ridden.quad.quirks.sitOn()) {
      this.hud.toast('The seat is split and soaked: your trousers are wet through', 3);
      remark('seatSoaked');
    }
  }

  /** Gives a quad its past: wear, any starting faults and any tinkering left in (the toolbox opens on it as it is, with stock the factory's). */
  applyHistory(unit, random, faultChance) {
    const [lo, hi] = unit.spec.hoursRange ?? [0, 0];
    const h = pickHistory(unit.spec, random, { faultChance, hoursT: hi > lo ? (unit.quad.usage.hours - lo) / (hi - lo) : 0.5 });
    unit.engine.wear = h.wear;
    if (unit.engine.params.strokes === 2) unit.engine.silencerBlown = Math.min(0.6, h.wear * 0.8); // an old two-stroke's packing has started to go
    for (const f of h.faults) unit.quad.faults.leave(f.kind, f.level);
    if (h.tinker) {
      const stock = captureStock(tuneTarget(unit));
      const settings = applyTune(tuneTarget(unit), stock, clampSettings({ ...stockSettings(stock), ...h.tinker }, stock));
      unit.leftovers = { stock, settings };
    }
    this.history.quads[unit.id] = h;
  }

  /** One readable block per vehicle of everything dealt out at random at the start (debug/startReport.js). */
  logStart() {
    for (const unit of this.units) {
      const h = this.history.quads[unit.id];
      const q = unit.quad;
      const worn = q.drivetrain.worn;
      console.info(
        describeVehicle({
          name: unit.name,
          where: unit.where,
          plate: unit.spec.plateNumber,
          idle: unit.idleRpm,
          top: unit.topRpm,
          redline: unit.engine.params.redlineRpm,
          roughness: unit.variation.roughness,
          litres: unit.variation.litres,
          tap: q.fuel.tap,
          hours: q.usage.hours,
          odo: q.usage.odoMiles,
          trip: q.tripMiles,
          pod: this.podRack.podOn(unit.id),
          wear: unit.engine.wear,
          faults: h?.faults ?? [],
          tinker: h?.tinker ?? null,
          lastRider: h?.lastRider ?? null,
          hasHistory: !!h,
          quirks: q.quirks.kinds,
          sump: q.sump ? { level: q.sump.level, burner: q.sump.burner } : null,
          tyres: q.tyres,
          parkBrake: q.parkBrake,
          wornGear: worn ? { gear: worn.gear, wear: worn.wear } : null,
          hand: unit.spec.tractor ? q.handSetting : null,
        }),
      );
    }
  }

  wearGearbox() {
    const manual = this.units.filter((u) => u.quad.manual);
    const pick = pickWornGearbox(manual.map((u) => ({ id: u.id, gears: u.quad.gearbox.gears })), createRandom(this.seed ^ 0x6ea4));
    if (!pick) return;
    this.units.find((u) => u.id === pick.id).quad.drivetrain.wear(pick.gear, pick.wear);
  }

  /** Builds the tractor, with its own seeded idle, roughness, fuel and hours, and adds it to `units` (not `girlUnits`). */
  addTractor(spawn) {
    const random = createRandom(this.seed ^ 0x7ac70);
    const unit = new QuadUnit({
      spec: TRACTOR_SPEC,
      spawn,
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      audioHub: this.audioHub,
    });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(TRACTOR_SPEC.idleRange, random));
    unit.variation = applyVariation(TRACTOR_SPEC, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(TRACTOR_SPEC, unit.engine.params, createRandom(this.seed ^ 0x70b6));
    unit.quad.usage.hours = pickReading(TRACTOR_SPEC.hoursRange, random);
    // Its odometer isn't on the dash, but it counts from a start that goes with its hours (more hours, more miles).
    const [hoursLo, hoursHi] = TRACTOR_SPEC.hoursRange;
    unit.quad.usage.odoMiles = pickRelatedReading(TRACTOR_SPEC.odoRange, (unit.quad.usage.hours - hoursLo) / (hoursHi - hoursLo), random);
    unit.quad.handSetting = pickReading(TRACTOR_SPEC.handStartRange, random); // the last driver left the hand throttle wherever
    this.units = [...this.units, unit];
    unit.where = spawn.where;
    return unit;
  }

  /** The barn find, if this game has one: a brown copy of a regular quad, under a tarp, with its jobs picked from the seed. Returns its unit or null. */
  addRusty() {
    const plan = pickBarnFind(createRandom(this.seed ^ 0xba2f), QUAD_SPECS, this.barnFindParams);
    if (!plan) return null;
    const P = this.barnFindParams;
    const random = createRandom(this.seed ^ 0xba30);
    const spec = {
      ...plan.donor,
      id: RUSTY_ID,
      label: 'rusty quad',
      name: 'Rusty quad',
      bodyColor: 0x6b4426, // brown, with the rust coming through
      hoursRange: P.hours,
      odoRange: P.odoMiles,
      wearRange: P.wear,
      owner: undefined,
      plateNumber: undefined,
    };
    const unit = new QuadUnit({ spec, spawn: this.world.layout.rusty, scene: this.scene, physics: this.physics, RAPIER: this.RAPIER, world: this.world, audioHub: this.audioHub });
    unit.idleRpm = applyIdle(unit.engine.params, unit.quad.params, pickIdle(spec.idleRange ?? [unit.engine.params.idleRpmWarm, unit.engine.params.idleRpmWarm], random));
    unit.variation = applyVariation(spec, unit.engine.params, unit.quad.fuel, random);
    unit.topRpm = applyTopRpm(spec, unit.engine.params, random);
    unit.quad.usage.hours = pickReading(P.hours, random);
    unit.quad.usage.odoMiles = pickReading(P.odoMiles, random);
    unit.engine.wear = P.wear[0] + (P.wear[1] - P.wear[0]) * random();
    unit.quad.tyres = new TyreSet(dealTyres(random, 4, this.tyreParams), this.tyreParams);
    unit.quad.tyres.useLayout(unit.quad.layout.wheels);
    unit.quad.parkBrake = true;
    unit.quad.seatFrost = 0;
    unit.where = 'at the back of the barn';
    // What's wrong with it. The engine can't catch until every job is done (startBlocked); the rest shows as it would on any quad.
    unit.barnFind = new BarnFind(plan, P);
    unit.engine.startBlocked = true;
    unit.engine.battery = P.startBattery;
    if (plan.jobs.includes('tyre')) {
      unit.quad.faults.begin('puncture');
      unit.quad.faults.levels.puncture = 0.9;
      unit.quad.tyres.level(1);
    }
    if (plan.jobs.includes('fuel')) unit.engine.fouling = 0.35; // the varnish: it would only foul the plug
    if (plan.jobs.includes('carb')) {
      unit.quad.faults.begin('carb');
      unit.quad.faults.levels.carb = 0.9;
    }
    // Dust and rust, and the tarp over the lot.
    weatherModel(unit.quad.model);
    unit.tarp = buildTarp();
    unit.quad.bodyRoot.add(unit.tarp);
    this.units = [...this.units, unit];
    return unit;
  }

  /** The barn find's slow jobs: the charger going, the seized brake holding it, and the first start. */
  updateBarnFind(dt) {
    const unit = this.rustyUnit;
    const find = unit?.barnFind;
    if (!find) return;
    const e = unit.engine;
    unit.tarp.visible = !find.tarpOff;
    if (find.brakeSeized) unit.quad.parkBrake = true;
    if (find.charging && !find.charged) e.battery = Math.max(e.battery, find.batteryLevel);
    if (find.update(dt) === 'charged') {
      this.hud.toast('The charger light has gone green: the battery is full');
      this.notebook.note(unit, { kind: 'job', job: 'battery' }, { by: 'you' });
    }
    e.startBlocked = find.startBlocked;
    // Cranking it before it's ready: it tells you why.
    const cranking = e.state === 'cranking';
    if (cranking && !this.rustyWasCranking && find.startBlocked && find.tarpOff) this.hud.toast(find.blockedReason(), 3.2);
    this.rustyWasCranking = cranking;
    // The first start: smoke everywhere, and both girls cheer.
    if (e.isRunning && find.ready && !find.started) {
      find.started = true;
      startRunningIn(e); // not run for years, and now it wants running in
      find.smokeLeft = find.params.smokeSeconds;
      this.hud.toast('It runs! The first start in years');
      this.achievements.note('barnFind');
      for (const c of this.companions) c.voice.onBench('runs');
    }
    if (find.smokeLeft > 0) {
      find.smokeLeft -= dt;
      unit.smoke.burst = 1;
    }
  }

  // Which quad -------------------------------------------------------------

  /** The quad the player is riding, if any. */
  /** The quad you're at the controls of, if any. */
  get riddenUnit() {
    return this.player.isRiding && this.player.seat === 'rider' ? this.player.vehicle.unit : null;
  }

  /** The quad you're on, front or back. */
  get boardUnit() {
    return this.player.isRiding ? this.player.vehicle.unit : null;
  }

  /** The first companion (for the debug console and test scripts). */
  get companion() {
    return this.companions[0];
  }

  get voice() {
    return this.companions[0].voice;
  }

  /** The companion on the front seat of this quad (driving it, or about to), if any. */
  herAtTheFront(quad) {
    return this.companions.find((c) => c.quad === quad && (c.fsm.is('driving') || (c.fsm.is('shuffling') && c.fsm.data?.to === 'rider'))) ?? null;
  }

  /** The companion on the back of this quad (or getting on or off it there), if any. */
  herOnBack(quad) {
    return this.companions.find((c) => c.quad === quad && c.claimedSeat === 'pillion' && c.fsm.is('mounting', 'seated', 'dismounting')) ?? null;
  }

  /** The companion on this quad in any seat (or getting on or off it), if any. */
  herOn(quad) {
    return this.companions.find((c) => c.quad === quad && c.fsm.is('mounting', 'seated', 'dismounting', 'driving', 'shuffling')) ?? null;
  }

  /** You could sit on the back of this quad: it's parked, upright and nobody's on it. */
  canSitOnBack(quad) {
    return (quad.hasPillion || (quad.hasBench && !!this.benchSeatFor(quad, this.lookingAtBack(quad)))) && !quad.driver && !quad.isTipped && !quad.passenger && !quad.rider && !this.herOn(quad) && quad.speed < 0.5 && !this.handsFull;
  }

  /** Looking at the back half of a car with a back bench (the 200TDi), so B or E is for the back seats rather than the front. */
  lookingAtBack(quad) {
    const at = this.interaction.focusPoint;
    if (!quad.rearSeats?.length || !at || this.interaction.focused?.unit?.quad !== quad) return false;
    return quad.model.worldToLocal(at.clone()).z < this.rearAccess.backHalfZ;
  }

  /**
   * Sat on the back of a parked quad with nobody at the front: after a while a
   * free girl comes over and takes you for a ride (and gets off when she's bored,
   * unasked). Afterwards nobody offers again for a good while.
   */
  updateRideOffer(dt) {
    if (!this.companions.length) return;
    this.rideOffer ??= new RideOffer(this.companions[0].params);
    const offer = this.rideOffer;
    if (this.offeredBy) {
      // Wait for the ride to be over (she's off, or given up) before the rest period starts.
      if (this.offeredBy.fsm.is('walking', 'mounting', 'driving', 'shuffling')) return;
      offer.rest(this.offeredBy.params);
      this.offeredBy = null;
    }
    if (this.hiding.active) return; // they can't find you to offer
    const unit = this.boardUnit;
    const waiting = !!unit && this.player.seat === 'pillion' && !unit.quad.hasBench && unit.quad.speed < 0.5 && !this.menu.isOpen && !this.passengerPlan && !this.herOn(unit.quad);
    if (!offer.update(dt, waiting)) return;
    const girls = this.companions
      .filter((c) => c.canOfferRide(unit.quad))
      .map((c) => ({ c, distance: c.root.position.distanceTo(unit.quad.position), favour: this.favour.offerWeight(c.character.id) }));
    const pick = pickOfferer(girls);
    if (!pick) return offer.rest(); // nobody free: try again later
    pick.c.offerRide(unit.quad);
    this.offeredBy = pick.c;
  }

  /** On the back while she drives. */
  mountPillion(unit) {
    if (this.player.isRiding) return;
    this.player.mount(unit.quad, 'pillion');
    this.favourQuad(unit, this.favour.p.favouriteQuad);
    unit.quad.passenger = this.player;
    this.lastUnit = unit;
    this.input.takeWheelSteps();
    this.herAtTheFront(unit.quad)?.voice.onRequest('passengerOn');
  }

  /** The UTV's or Land Rover's seats as somewhere to ride (vehicle/utvMount.js), or null for anything else. */
  benchMountOf(quad) {
    if (quad === this.utvUnit?.quad) return this.utvMount;
    return Object.values(this.landys).find((l) => l.unit?.quad === quad)?.mount ?? null;
  }

  /**
   * The bench seat you would take, or null if it's full. Girls aboard or on their way count as taking one. `back`: one on the 200TDi's
   * back bench instead, nearest the door on your side (the driver's door only with nobody at the wheel).
   */
  benchSeatFor(quad, back = false) {
    const mount = this.benchMountOf(quad);
    if (!mount) return null;
    if (back) {
      const driverSide = quad.model.worldToLocal(this.player.position.clone()).x < 0 && !quad.driver && !quad.rider;
      return pickRearSeat(mount.rearSlots.filter((s) => s.girl).map((s) => s.name), driverSide);
    }
    return pickBenchSeat(BENCH_SEATS.filter((s) => mount.slots[s].girl));
  }

  /** You could get in beside the girl driving the UTV or Land Rover: she's at the wheel, the seat is free and you're not in the middle of something. */
  canRideBench(quad) {
    return quad.hasBench && !!this.herAtTheFront(quad) && !quad.passenger && !quad.rider && !quad.isTipped && !this.handsFull && !!this.benchSeatFor(quad, this.lookingAtBack(quad));
  }

  /** In the UTV's or Land Rover's other seat while she drives (the quads' pillion, on a bench). */
  mountBench(unit) {
    if (this.player.isRiding) return;
    const back = this.lookingAtBack(unit.quad);
    const seat = this.benchSeatFor(unit.quad, back);
    if (!seat) return;
    this.player.mount(unit.quad, 'pillion', seat);
    this.benchMountOf(unit.quad).slots[seat].girl = YOU_ABOARD;
    if (back) unit.quad.tipHold[rearDoor(seat, !!(unit.quad.driver || unit.quad.rider))] = this.rearAccess.holdSeconds; // the front seat tips as you climb past
    unit.quad.passenger = this.player;
    this.lastUnit = unit;
    this.input.takeWheelSteps();
    this.herAtTheFront(unit.quad)?.voice.onRequest('passengerOn');
  }

  /** Spraying, the hose's reach, the hiss, and her reaction if you get her wet. */
  updateHose(dt) {
    const hose = this.hose;
    if (hose.held && this.player.isRiding) hose.putBack();
    if (hose.held && hose.distanceFrom(this.player.position) > hose.params.reach) {
      hose.putBack();
      this.hud.toast('The hose won\'t reach any further: it pulled out of your hand');
    }
    hose.spraying = hose.held && !this.menu.isOpen && this.input.isDown('KeyE');
    hose.update(dt);
    this.audioHub.setSpraying(hose.spraying, !!this.washing);
    for (const c of this.companions) {
      if (this.washing) c.voice.onWash?.('quad');
      // Spraying her: she's in front of you and close.
      if (hose.spraying) {
        const to = c.voice.head.clone().sub(this.camera.position);
        const dist = to.length();
        const ahead = this.camera.getWorldDirection(to.clone()).dot(to.normalize());
        if (dist < 7 && ahead > 0.96) c.voice.onWash?.('her');
      }
    }
  }

  /** The girls bickering with each other (banter.js), when there's a moment for it. */
  updateBanter(dt, ridden) {
    if (this.companions.length < 2) return;
    this.banter ??= new Banter(BANTER);
    this.banterWatch ??= new BanterWatch();
    let triggers = this.banterWatch.triggers(dt, { companions: this.companions, ridden, you: this.camera.position, wheelOpen: this.menu.isOpen, rivalry: this.favour.rivalry() });
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    // Jess has just guessed wrong about a running quad with Amy close by: she puts her right.
    const said = byId.jess?.voice?.lastDiagnosis;
    if (said) {
      byId.jess.voice.lastDiagnosis = null;
      const amy = byId.amy;
      if (amy && !amy.fsm.is('driving', 'starting') && amy.voice.head.distanceTo(byId.jess.voice.head) < 10) {
        triggers.push({ when: 'corrected', edge: true, roles: { guesser: 'jess', corrector: 'amy', guess: said.guess, truth: said.truth } });
      }
    }
    // A race has just finished, or one of them is well ahead on wins (npc/race.js).
    if (this.raceResult) {
      triggers.push({ when: 'raced', edge: true, roles: this.raceResult });
      this.raceResult = null;
    }
    if (this.convoySwapped) {
      triggers.push({ when: 'swapped', edge: true, roles: this.convoySwapped });
      this.convoySwapped = null;
    }
    const rivals = this.race.rivalry();
    const [first, second] = this.companions;
    if (rivals && first.fsm.is('idle') && second.fsm.is('idle') && first.root.position.distanceTo(second.root.position) < 12) triggers.push({ when: 'rivals', roles: rivals });
    // Fallen out: the friendly digs stop and the bickering turns sharp.
    for (const t of this.fallingOutEvents.splice(0)) triggers.push(t);
    if (this.fallingOut.active) {
      const standingAbout = triggers.some((t) => t.when === 'idle');
      triggers = triggers.filter((t) => !['idle', 'favoured', 'rivals'].includes(t.when));
      if (standingAbout) triggers.push({ when: 'fallenOut' });
    }
    const speak = (speaker, text, opts) => (byId[speaker]?.params.voice ? byId[speaker].voice.speak(text, opts) : 0);
    const started = this.banter.update(dt, triggers, speak, this.talkFloor.left <= 0 && !this.menu.isOpen && !this.gossip.busy);
    if (started && FRICTION_BANTER.includes(started.when)) this.noteFriction('digs');
    this.talkFloor.banter = this.banter.busy || this.gossip.busy;
    this.updateGossip(dt, byId, speak);
  }

  /** Something between the girls adds friction (fallingOut.js); `fault` is the girl most to blame, if she is one of them. */
  noteFriction(kind, fault = null) {
    const girl = this.companions.some((c) => c.character.id === fault) ? fault : null;
    if (kind !== 'digs' && !girl) return;
    this.handleFallingOut(this.fallingOut.add(kind, girl));
  }

  /** They've just fallen out or made up: the row (or the apology) is raised as a moment for the banter. */
  handleFallingOut(event) {
    if (!event) return;
    if (event.type === 'fellOut') {
      this.fallingOutEvents.push({ when: 'fellOut', edge: true, roles: { kind: event.kind, fault: event.fault } });
      this.sulking.fellOut(event.kind, event.fault, this.companions.map((c) => c.character.id)); // the one who came off worse may go and sulk
      this.race.stand();
      this.convoy.stand();
    } else if (event.type === 'madeUp') this.fallingOutEvents.push({ when: 'madeUp', edge: true, roles: { sorry: event.sorry } });
  }

  /**
   * While they're fallen out: each tells you her side the first time you come close, they keep their distance, and
   * stood about together (near you) the falling out runs down faster. They make up on their own in the end.
   */
  updateFallingOut(dt) {
    const fo = this.fallingOut;
    const p = fo.p;
    if (this.companions.length < 2) return;
    const [a, b] = this.companions;
    const here = (c) => c.root.getWorldPosition(c.tmpV.clone());
    const apart = here(a).distanceTo(here(b));
    const stood = (c) => c.fsm.is('idle', 'resting');
    const you = this.player.position;
    const together = fo.active && stood(a) && stood(b) && apart < p.togetherRange && here(a).distanceTo(you) < p.togetherNearYou && here(b).distanceTo(you) < p.togetherNearYou;
    this.handleFallingOut(fo.update(dt, together));
    if (!fo.active) return;
    const floorFree = this.talkFloor.left <= 0 && !this.banter?.busy && !this.menu.isOpen;
    for (const c of this.companions) {
      const id = c.character.id;
      if (fo.wantsToTell(id) && floorFree && stood(c) && here(c).distanceTo(you) < p.sideRange) {
        fo.tell(id);
        c.voice.say(`side${fo.cause.kind[0].toUpperCase()}${fo.cause.kind.slice(1)}`, { force: true });
      }
      // Too close to her friend: she goes and stands further off (not a headlong rush, and not every frame).
      const clock = fo.clock;
      if (stood(c) && apart < p.apartRange && clock - (this.fallingOutApartAt[id] ?? -Infinity) > 8 && !c.warmingAt && !c.pendingSpot) {
        const friend = this.companions.find((o) => o !== c);
        const from = here(friend);
        const me = here(c);
        const away = new THREE.Vector3(me.x - from.x, 0, me.z - from.z);
        if (away.lengthSq() < 0.01) away.set(1, 0, 0);
        away.normalize().multiplyScalar(p.apartRange + 3);
        const target = new THREE.Vector3(me.x + away.x, 0, me.z + away.z);
        const area = this.world.fields?.areaOf(me.x, me.z);
        if (this.world.fields && area !== 'out') {
          const clamped = this.world.fields.clampToArea(area, target.x, target.z, 4);
          target.x = clamped.x;
          target.z = clamped.z;
        }
        target.y = this.world.heightAt(target.x, target.z);
        this.fallingOutApartAt[id] = clock;
        c.walkTo(target, Math.atan2(from.x - target.x, from.z - target.z));
      }
    }
  }

  // Round the back of the barn, and her quad ------------------------------------

  /** The quad she likes best, if it is one she could be sat on the back of right now with nobody else on it. */
  romanceQuad(c) {
    const unit = this.girlUnits.find((u) => u.spec.id === c.voice.favourite);
    const q = unit?.quad;
    if (!q || !q.hasPillion || q.isTipped || q.rider || q.driver || q.passenger || q.isGhostRiding || q.speed > 0.5) return null;
    if (this.herOn(q) || !c.canRidePillion(q)) return null;
    return unit;
  }

  /** Is she sat on her favourite quad and you stood on foot beside it? */
  onHerQuad(c) {
    const q = c.quad;
    return c.fsm.is('seated') && c.seatKind === 'pillion' && q.unit.spec.id === c.voice.favourite && !this.player.isRiding
      && this.player.position.distanceTo(q.position) < this.romance.p.quadRange;
  }

  updateRomance(dt) {
    this.watchTippedQuads(dt);
    if (this.tryst) return this.updateTryst(dt);
    const you = this.player.position;
    const youFree = !this.player.isRiding && !this.menu.isOpen && !this.hiding.active && !this.climb && !this.race.active && !this.drag.active && !this.recalling;
    const girls = this.companions.map((c) => {
      const id = c.character.id;
      return {
        id,
        score: this.favour.scores[id],
        favoured: this.favour.mood(id) === 'favoured',
        free: c.fsm.is('idle') && !c.warmingAt && !c.pendingSpot,
        distance: c.root.position.distanceTo(you),
        fallenOut: this.fallingOut.active,
        quadOk: !!this.romanceQuad(c),
      };
    });
    for (const e of this.romance.update(dt, { girls, youFree })) this.handleRomanceEvent(e);
  }

  /** What an invitation or a lapsed one does: she says so, and for the quad one goes to sit on it. */
  handleRomanceEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (e.type === 'invite') {
      const unit = e.kind === 'quad' ? this.romanceQuad(c) : null;
      if (e.kind === 'quad' && !unit) {
        this.romance.cancel(e.girl);
        return false;
      }
      c.voice.say(e.kind === 'quad' ? 'inviteQuad' : 'inviteBarn', { force: true });
      if (unit) this.romanceGetOnQuad(c, unit, 3);
      this.hud.toast(`${c.name} wants a word: talk to her`, 3);
    } else if (e.type === 'lapsed') {
      c.voice.say('inviteLapsed', { force: true });
      if (e.kind === 'quad' && c.fsm.is('seated', 'mounting')) c.requestStandBeside();
    }
    return true;
  }

  /** She starts her favourite quad first if it isn't running (trying again if it won't catch), then gets on the back of it. */
  romanceGetOnQuad(c, unit, tries) {
    const q = unit.quad;
    if (q.engine.isRunning) return c.requestMount(q);
    c.requestStart(q, {
      settleAt: this.romance.p.settleAt,
      then: (ran) => {
        if (!this.romance.pendingFor(c.character.id)) return; // it lapsed or you said no while she was at it
        if (!this.romanceQuad(c)) return this.romance.cancel(c.character.id); // you got on it, or it's gone over
        if (ran) c.requestMount(q);
        else if (tries > 1) this.romanceGetOnQuad(c, unit, tries - 1);
        else this.romance.cancel(c.character.id);
      },
    });
  }

  /** Her wheel options while she's asked: yes, or not now. */
  romanceWheelOptions(c) {
    const id = c.character.id;
    const ask = this.romance.pendingFor(id);
    if (!ask || this.tryst) return [];
    const no = {
      label: 'Not now',
      run: () => {
        this.romance.decline(id);
        c.voice.say('inviteDeclined', { force: true });
        if (ask.kind === 'quad' && c.fsm.is('seated', 'mounting')) c.requestStandBeside();
      },
    };
    if (ask.kind === 'barn') return [{ label: 'Go round the back of the barn', run: () => this.startTryst(c, 'barn') }, no];
    return this.onHerQuad(c) ? [{ label: 'Stand next to her on the quad', run: () => this.startTryst(c, 'quad') }, no] : [no];
  }

  startTryst(c, kind) {
    if (kind === 'barn' && !c.fsm.is('idle')) return this.hud.toast(`${c.name} is busy`, 1.6);
    this.closeMenu();
    this.romance.accept(c.character.id);
    this.tryst = { scene: new Tryst(c.character.id, kind, this.romance.p), girl: c };
    this.player.moveEnabled = false;
    this.player.lookEnabled = false;
  }

  /** Turns you to look at her. */
  lookAtHer(c) {
    const from = this.player.position;
    const to = c.root.getWorldPosition(c.tmpV.clone());
    this.player.yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z));
    this.player.pitch = 0;
  }

  updateTryst(dt) {
    const { scene, girl: c } = this.tryst;
    const id = c.character.id;
    const kind = scene.kind;
    for (const e of scene.update(dt)) {
      if (e === 'place') {
        if (kind === 'barn') {
          // Behind the barn, you facing her.
          const b = this.world.layout.barn;
          const x = b.x - b.halfX - 3.2;
          const you = { x, y: this.world.heightAt(x, b.z), z: b.z };
          this.player.moveTo(you);
          const hx = x + 1.2;
          c.root.position.set(hx, this.world.heightAt(hx, b.z), b.z);
          c.heading = -Math.PI / 2;
          c.root.rotation.y = c.heading;
        }
        this.lookAtHer(c);
      } else if (e === 'moment') {
        this.lookAtHer(c);
        c.voice.say(kind === 'quad' ? 'trystQuad' : 'trystBarn', { force: true });
      } else if (e === 'back') {
        c.voice.say(kind === 'quad' ? 'afterQuad' : 'afterBarn', { force: true });
      } else if (e === 'done') this.endTryst(c, kind);
    }
    this.hud.setFade(scene.fade);
  }

  endTryst(c, kind) {
    const id = c.character.id;
    this.tryst = null;
    this.hud.setFade(0);
    this.player.moveEnabled = true;
    this.player.lookEnabled = true;
    const friend = this.companions.find((o) => o !== c);
    const result = this.romance.complete(id);
    this.favour.add(id, 2);
    if (result.type === 'lockedIn') {
      this.favour.lock(id, this.romance.p.lockScore);
      if (friend) setTimeout(() => friend.voice.say('sulkLockedOut', { force: true }), 6000);
    } else if (friend && Math.random() < 0.6) setTimeout(() => friend.voice.say('teaseRomance', { force: true }), 8000);
    if (kind === 'quad') c.requestStandBeside();
  }

  /** The one thing she won't forgive: you tip a quad over with her on it. */
  watchTippedQuads(dt) {
    const locked = this.companions.find((c) => c.character.id === this.romance.lockedGirl);
    const q = this.riddenUnit?.quad;
    if (q && locked && !q.isTipped && this.herOn(q) === locked) {
      this.sharedQuad = q;
      this.sharedFor = 0;
    } else if (this.sharedQuad) {
      this.sharedFor += dt; // a tip throws you off first, so give it a few seconds
      if (!locked || this.sharedFor > 4) this.sharedQuad = null;
    }
    const tipped = this.sharedQuad?.isTipped;
    if (tipped && !this.sharedTipped) {
      const id = locked.character.id;
      this.romance.betray(id);
      this.favour.unlock(id, this.romance.p.betrayScore);
      locked.voice.say('betrayed', { force: true });
      this.sharedQuad = null;
    }
    this.sharedTipped = !!tipped;
  }

  /** The wheel's two extras while they're fallen out and she's told you her side: take her side, or tell her to make up. */
  fallingOutWheelOptions(c) {
    const fo = this.fallingOut;
    const id = c.character.id;
    if (!fo.active || fo.wantsToTell(id)) return [];
    const friend = this.companions.find((o) => o !== c);
    return [
      {
        label: "You're right",
        run: () => {
          if (!fo.sideWith(id)) return;
          this.favour.add(id, fo.p.sideFavour);
          if (friend) this.favour.add(friend.character.id, -fo.p.sideFavour);
          c.voice.say('sideThanks', { force: true });
        },
      },
      {
        label: 'Make it up',
        run: () => {
          const event = fo.nudge(id);
          if (event) this.handleFallingOut(event);
          else c.voice.say('nudged', { force: true });
        },
      },
    ];
  }

  /** Talking about you while they think you can't hear (npc/gossip.js). */
  updateGossip(dt, byId, speak) {
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.fsm.is('idle') && !c.warmingAt && !c.pendingSpot && !this.dieselJob,
    }));
    const loud = this.menu.isOpen || this.units.some((u) => u.quad.engine.isRunning && girls.some((g) => Math.hypot(u.quad.position.x - g.x, u.quad.position.z - g.z) < this.gossip.p.noticeRange));
    const v = this.player.velocity;
    const ctx = { you: { x: this.player.position.x, z: this.player.position.z, onFoot: !this.player.isRiding, speed: Math.hypot(v.x, v.z) }, girls, loud, floorFree: this.talkFloor.left <= 0 && !this.banter.busy };
    for (const e of this.gossip.update(dt, ctx, speak, () => this.companions.forEach((c) => c.voice.cut()))) {
      byId[e.girl]?.voice.say('gossipCaught', { urgent: true, force: true });
    }
  }

  /** Rain round you and its sound, and the wind on the exhaust smoke. */
  updateWeather(dt) {
    const w = this.weather;
    const cam = this.camera.position;
    const world = this.world;
    // The barn: no rain under its roof, the drumming of it on the tin, a dimmer light inside with the bulb on, and a room's echo.
    const indoor = world.indoor(cam.x, cam.z);
    this.rain.update(dt, this.camera, w.rain, w.wind, (x, z) => world.covered(x, z));
    this.audioHub.setRain(w.rain, indoor, world.barnParams);
    this.audioHub.room ??= { inside: (x, z) => world.inBarn(x, z), params: world.barnParams, listenerIn: false };
    this.audioHub.room.listenerIn = world.inBarn(cam.x, cam.z);
    const barn = world.props?.barn;
    if (barn) {
      world.sky.hemi.intensity *= 1 - 0.55 * indoor;
      const gloom = Math.min(1, 1.3 - w.warmth * 0.9);
      barn.light.intensity = BARN_BULB * indoor * gloom;
    }
    for (const unit of this.units) {
      const s = unit.smoke.params;
      s.baseWindX ??= s.windX;
      s.baseWindZ ??= s.windZ;
      s.windX = s.baseWindX * w.wind;
      s.windZ = s.baseWindZ * w.wind;
      // A pop's flash from the pipe shows in poor light: none on a sunny day, plenty under heavy cloud.
      unit.smoke.darkness = Math.max(0, Math.min(1, 1 - w.warmth * 1.3));
    }
  }

  /** Carrying the can, the hose, the toolbox or the winch hook. */
  /** Whichever jerry can you're holding, else the red petrol one. */
  get can() {
    return this.premixCan?.held ? this.premixCan : this.dieselCan?.held ? this.dieselCan : this.petrolCan;
  }

  /** Pouring this can into that quad is a mistake: 'straight' petrol in a two-stroke, 'premix' in a four-stroke. */
  mixWrongFor(quad, can) {
    if (quad.engine.params.petrolFussy) return can.diesel < 0.95 ? 'petrol' : null; // the UTV is a diesel too, but fussy about it
    if (quad.engine.params.runsOnDiesel) return null; // the tractor takes red diesel; what else goes in it isn't modelled
    if (can.diesel > 0.05) return 'diesel';
    if (quad.engine.params.strokes === 2) return can.oil < 0.002 ? 'straight' : null;
    return can.oil > 0.004 ? 'premix' : null;
  }

  get handsFull() {
    return this.petrolCan.held || this.premixCan.held || this.dieselCan.held || this.hose.held || this.toolbox.held || this.leads.held || this.oilBottle.held || this.winch?.state === 'carried' || this.chain?.state === 'carried';
  }

  /** The tow chain: it comes out of your hand if you go further than it reaches, or when you get on something. */
  updateChain() {
    const c = this.chain;
    if (!c) return;
    if (c.state === 'carried' && this.player.isRiding) c.stow();
    if (c.state === 'carried' && c.distanceFrom(this.player.position) > c.params.length) {
      c.stow();
      this.hud.toast('The chain won\'t reach any further: the hook pulled out of your hand');
    }
    c.update();
  }

  /** The winch: the cable's reach, and winding in while X is held by the green (or on it). */
  updateWinch() {
    const w = this.winch;
    if (!w) return;
    if (w.state === 'carried' && this.player.isRiding) w.stow();
    if (w.state === 'carried' && w.distanceFrom(this.player.position) > w.params.length) {
      w.stow();
      this.hud.toast('The winch cable won\'t reach any further: the hook pulled out of your hand');
    }
    const onIt = this.boardUnit === w.unit;
    const near = !this.player.isRiding && w.distanceFrom(this.player.position) < w.params.remoteReach;
    this.winchReel = w.state === 'hooked' && (onIt || near) && !this.menu.isOpen && this.input.isDown('KeyX');
    w.update();
  }

  /** Off the back: only once she's stopped (or nearly). */
  getOffBack() {
    const quad = this.boardUnit.quad;
    if (quad.speed > this.player.params.dismountSpeed) {
      this.hud.toast('Ask her to stop first');
      return false;
    }
    // Out of the 200TDi's back by the door you'd have come in by, its front seat tipping as you go.
    const backDoor = quad.rearSeats?.includes(this.player.benchSeat) ? rearDoor(this.player.benchSeat, !!(quad.driver || quad.rider)) : null;
    if (backDoor) quad.tipHold[backDoor] = this.rearAccess.holdSeconds;
    const spot = this.findDismountSpot(
      quad,
      quad.hasBench
        ? benchDismountSpots(backDoor === 'driver' && quad.driverStand ? quad.driverStand : quad.benchStand)
        : [
            [1.05, -0.6],
            [-1.05, -0.6],
            [0, -1.9],
          ],
    );
    if (!spot) {
      this.hud.toast('No room to get off here');
      return false;
    }
    const slot = this.benchMountOf(quad)?.slots[this.player.benchSeat];
    if (slot?.girl === YOU_ABOARD) slot.girl = null;
    quad.passenger = null;
    this.player.dismount(spot, quad.yaw + Math.PI);
    return true;
  }

  /** Your menu riding on the back: talk to her about the ride. */
  openPassengerMenu() {
    const c = this.herAtTheFront(this.boardUnit.quad) ?? this.herOn(this.boardUnit.quad);
    if (!c) return void this.getOffBack(); // sat on the back by yourself: E just gets you off
    const quad0 = this.boardUnit.quad;
    this.passengerHer = c; // who any plan below is with, even once she's off the front
    const drive = c.fsm.is('driving') ? c.drive : null;
    const stopped = !drive || drive.phase === 'parked' || drive.done;
    const actions = [];
    const ask = (kind, label, run) => actions.push({ kind, label, run: () => (run(), c.voice.onRequest(kind)) });
    if (stopped) ask('letMeOff', 'I\'ll get off here', () => this.getOffBack());
    else ask('letMeOff', 'Let me off', () => ((this.passengerPlan = 'off'), drive.park()));
    if (drive && !stopped) {
      ask('stopHere', 'Stop here', () => drive.park());
      ask('slower', 'Slow down a bit', () => drive.setCruiseScale(drive.cruiseScale * 0.75));
      ask('faster', 'Go a bit faster', () => drive.setCruiseScale(drive.cruiseScale * 1.25));
    }
    if (drive && drive.phase === 'parked') ask('goAgain', 'Off we go again', () => drive.resume());
    if (c.fsm.is('driving') && !quad0.hasBench) ask('swap', 'Let me drive', () => ((this.passengerPlan = 'swap'), drive?.park()));
    // Advice that fits what she's just got wrong (or is about to): only those are on the wheel.
    const coaching = drive && !stopped ? drive.coachable() : [];
    if (coaching.length) actions.push({ label: 'Coach her', children: coaching.map((key) => ({ label: COACHING[key].label, run: () => this.coachHer(c, key) })) });
    this.openWheel(`Ask ${c.name} to`, actions, c);
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
  }

  /** You tell her how to do something from the back. She learns if it's the right moment; at the wrong one, or again too soon, she doesn't. */
  coachHer(c, key) {
    this.applyCoaching(c, key, true);
  }

  /**
   * Coaching lands on her by the same rules whoever gives it. `byYou` earns or costs you her favour; when the other girl
   * coaches her there's no favour, and the driver answers after the coach has finished speaking.
   */
  applyCoaching(c, key, byYou) {
    const { skill } = COACHING[key];
    const id = c.character.id;
    const fitting = !!c.drive?.isMoment(skill);
    const result = this.skills.coach(id, skill, fitting);
    const say = (situation) => (byYou ? c.voice.say(situation, { force: true }) : setTimeout(() => c.voice.say(situation, { force: true }), 2500));
    if (result === 'taught') {
      if (byYou) this.favour.add(id, this.skills.p.taughtFavour);
      // She does it right away where she can.
      if (skill === 'choke' && c.quad.choke > 0) c.quad.choke = 0;
      if (skill === 'mud' && c.drive) c.drive.boost = 2;
      say(`taught_${skill}`);
    } else if (result === 'nagged') {
      if (byYou) this.favour.add(id, this.skills.p.nagFavour);
      say('coachNagged');
    } else {
      say('coachWrongTime');
    }
  }

  /** A girl on the back of a quad the other girl is driving coaches her, and it teaches by the same rules as yours. */
  updatePillionCoach(dt) {
    let share = null;
    for (const driver of this.companions) {
      if (!driver.fsm.is('driving') || !driver.drive || driver.drive.done || driver.drive.phase === 'stop') continue;
      const coach = this.companions.find((o) => o !== driver && o.quad === driver.quad && o.fsm.is('seated') && o.seatKind === 'pillion');
      if (coach) share = { coach: coach.character.id, driver: driver.character.id, moments: driver.drive.coachable(), from: coach, to: driver };
      break;
    }
    for (const e of this.pillionCoach.update(dt, share)) {
      share.from.voice.say(`coachGive_${e.key}`, { force: true });
      this.applyCoaching(share.to, e.key, false);
    }
  }

  /** Things you asked for on the back that wait until she's stopped. */
  updatePassenger() {
    const unit = this.boardUnit;
    if (!unit || this.player.seat !== 'pillion' || !this.passengerPlan) return;
    const quad = unit.quad;
    if (quad.speed > 0.3) return;
    const c = this.passengerHer;
    if (this.passengerPlan === 'off') {
      if (this.getOffBack()) this.passengerPlan = null;
    } else if (this.passengerPlan === 'swap') {
      // She gets off the front, then hops on the back once you've slid forward.
      if (c.fsm.is('driving')) {
        c.stopDriving('off', () => c.requestMount(quad));
        return;
      }
      if (c.quad === quad && c.fsm.is('dismounting')) return;
      quad.passenger = null;
      this.player.seat = 'rider';
      quad.setRider(this.player, this.input);
      this.passengerPlan = null;
    }
  }

  /** The quad the player is looking at on foot, if any. */
  get focusedUnit() {
    return this.interaction.focused?.unit ?? null;
  }

  /** The quad the HUD and tuning panel should describe: ridden, else looked at, else the last one. */
  inspectedUnit() {
    return this.riddenUnit ?? this.focusedUnit ?? this.lastUnit;
  }

  // Who you favour ----------------------------------------------------------

  /** Whichever girl likes this quad best is pleased you're on it, or washing it. */
  favourQuad(unit, amount) {
    for (const c of this.companions) if (c.voice.favourite === unit.spec.id) this.favour.add(c.character.id, amount);
  }

  /** Each frame: who's at the controls of each quad (you, or a girl's id), and the wear that lands on them. */
  updateWearLedger(dt) {
    this.wearLedger ??= new WearLedger();
    this.leftRunning ??= new LeftRunning();
    this.drivers = new Map();
    for (const unit of this.girlUnits) {
      const girl = this.companions.find((c) => c.fsm.is('driving') && c.quad === unit.quad);
      const who = unit === this.riddenUnit ? 'you' : girl ? girl.character.id : null;
      if (who) this.drivers.set(unit, who);
      this.wearLedger.record(unit.id, unit.engine.wear, who);
      // A girl having a go at starting it has it too, so when she wanders off the blame is hers.
      const starter = this.companions.find((c) => c.fsm.is('starting') && c.quad === unit.quad);
      const q = unit.quad;
      this.leftRunning.record(unit.id, dt, {
        running: unit.engine.isRunning,
        attended: !!(q.rider || q.driver || q.passenger || starter),
        who: who ?? starter?.character.id ?? null,
      });
    }
  }

  /**
   * A girl who got a sick quad going (npc/keepAlive.js) goes and sits on the back of it, instead of switching it off, while it runs with nobody
   * on it. `forced` sends her whatever she thinks of it. Returns whether she set off.
   */
  sendToKeepAlive(c, unit, forced = false) {
    const q = unit.quad;
    if (!c.fsm.is('idle') || !q.engine.isRunning || q.rider || q.driver || q.passenger || q.isTipped || !c.canRidePillion(q)) return false;
    if (forced) q.startTrouble = Math.max(q.startTrouble, this.keepParams.hardStartCranks);
    else if (!c.keepAlive.wouldGo({ sick: c.quadSickness(q).sick, running: true, unattended: true, distance: c.root.position.distanceTo(q.position) })) return false;
    c.requestMount(q);
    return true;
  }

  /** Each frame: the girl who last had a sick, running quad with nobody on it may go and sit on it to keep it going. */
  updateKeepAlive(dt) {
    for (const unit of this.girlUnits) {
      const q = unit.quad;
      const starting = this.companions.some((c) => c.fsm.is('starting') && c.quad === q);
      if (!unit.engine.isRunning && !starting) q.startTrouble = 0; // a hard start only counts while it is still running from it
    }
    if (this.menu.isOpen) return;
    for (const c of this.companions) {
      c.keepAlive.cool(dt);
      if (!c.fsm.is('idle') || Math.random() >= this.keepParams.goChance * dt) continue;
      const unit = this.girlUnits.find((u) => this.leftRunning.lastWho.get(u.id) === c.character.id);
      if (unit) this.sendToKeepAlive(c, unit);
      else if (Math.random() < (c.character.id === 'jess' ? this.keepParams.chargeGoJess : 1)) {
        // A running quad with a weak battery and nobody on it (after a jump, say) wants its revs kept up by whoever is free: Amy mostly.
        const weak = this.girlUnits.find((u) => u.engine.isRunning && u.engine.battery < this.keepParams.weakBatteryBelow && c.root.position.distanceTo(u.quad.position) <= this.keepParams.goRange);
        if (weak) this.sendToKeepAlive(c, weak);
      }
    }
  }

  /** Each frame: a parked quad with a sticky float and the tap on drips petrol (vehicle/carbDrip.js), leaving a damp patch and a flooded carb. */
  updateCarbDrip(dt) {
    for (const unit of this.units) {
      if (!this.carbDrip.state.has(unit.id)) continue;
      const q = unit.quad;
      const starter = this.companions.some((c) => c.fsm.is('starting') && c.quad === q);
      const parked = !unit.engine.isRunning && !(q.rider || q.driver || q.passenger || starter);
      const res = this.carbDrip.update(unit.id, dt, { parked, tapOpen: q.fuel.tap !== 'off', litres: q.fuel.litres });
      q.fuel.litres -= res.lost;
      if (parked) unit.engine.fouling = Math.max(unit.engine.fouling, this.carbDrip.floodFouling(unit.id));
      let patch = this.dripPatches.get(unit.id);
      if (!patch && (res.stuck || this.carbDrip.puddle(unit.id) > 0)) {
        patch = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 0.15, transparent: true, opacity: 0.65, depthWrite: false }));
        patch.renderOrder = 1;
        this.scene.add(patch);
        this.dripPatches.set(unit.id, patch);
      }
      if (!patch) continue;
      if (res.stuck) patch.position.set(q.position.x, this.world.heightAt(q.position.x, q.position.z) + 0.03, q.position.z); // where it started to drip
      const size = this.carbDrip.puddle(unit.id);
      patch.visible = size > 0.01;
      patch.scale.setScalar(0.15 + 0.85 * size);
    }
  }

  /** Each frame: a leaking radiator leaves a damp patch under a parked water-cooled quad (engine/coolant.js), where it first showed. */
  updateCoolantLeak(dt) {
    for (const unit of this.units) {
      if (!unit.engine.params.waterCooled) continue;
      const q = unit.quad;
      const size = unit.engine.coolantPuddle;
      let patch = this.coolantPatches.get(unit.id);
      if (!patch && size > 0) {
        patch = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.1, transparent: true, opacity: 0.4, depthWrite: false }));
        patch.renderOrder = 1;
        patch.userData.fresh = true;
        this.scene.add(patch);
        this.coolantPatches.set(unit.id, patch);
      }
      if (!patch) continue;
      // It drips where it stands, so the patch follows a parked quad while it's small and stays put once it's grown.
      if (size < 0.1 && !unit.engine.isRunning) patch.position.set(q.position.x, this.world.heightAt(q.position.x, q.position.z) + 0.03, q.position.z);
      patch.visible = size > 0.01;
      patch.scale.setScalar(0.12 + 0.7 * size);
    }
  }

  /** Each frame: scores fade, and the girl giving you a ride earns it while her friend, left on foot, notices. */
  updateFavour(dt, ridden) {
    this.favour.update(dt);
    const driver = ridden && this.player.seat === 'pillion' ? this.companions.find((c) => c.fsm.is('driving') && c.quad === ridden.quad) : null;
    if (!driver) return;
    this.favour.add(driver.character.id, this.favour.p.ridePerSecond * dt);
    for (const c of this.companions) if (c !== driver && c.fsm.is('idle', 'walking')) this.favour.add(c.character.id, -this.favour.p.ignoredPerSecond * dt);
  }

  // The hayloft ---------------------------------------------------------------

  youOnLoft() {
    const p = this.player.position;
    return onLoft(this.world.layout, p.x, p.y, p.z, this.loft.top - this.world.layout.loft.floor);
  }

  /** Up or down the ladder, whichever you're at the foot or top of. */
  startClimb() {
    if (this.climb || this.player.isRiding) return;
    const up = !this.youOnLoft();
    if (up) this.achievements.note('loft');
    const p = this.player.position;
    const lf = this.loft;
    const from = { x: p.x, y: p.y, z: p.z };
    const top = { x: lf.ladderTop.x, y: lf.top, z: lf.ladderTop.z };
    const foot = { x: lf.ladderFoot.x - 0.1, y: lf.ladderFoot.y, z: lf.ladderFoot.z };
    this.climb = new Climb(from, up ? top : foot, this.loftParams.climbSeconds);
    this.climbUp = up;
    this.player.moveEnabled = false;
  }

  startHiding() {
    this.achievements.note('hid');
    const h = this.world.layout.loft.hideSpot;
    const p = this.player.position;
    this.hiddenFrom = { x: p.x, y: p.y, z: p.z };
    this.player.moveTo({ x: h.x, y: this.loft.top, z: h.z });
    this.player.moveEnabled = false;
    this.player.eyeDropTarget = 1.0;
    this.hiding.hide();
  }

  stopHiding() {
    this.hiding.reveal();
    this.player.eyeDropTarget = 0;
    this.player.moveEnabled = true;
    if (this.hiddenFrom) this.player.moveTo(this.hiddenFrom);
    this.hiddenFrom = null;
  }

  /** The ladder climb, hiding in the hay, a girl up in the loft, and Jess's straw. */
  updateLoft(dt) {
    this.strawFall.update(dt);
    if (this.climb) {
      const at = this.climb.update(dt);
      this.player.moveTo(at);
      if (at.done) {
        this.climb = null;
        this.player.moveEnabled = true;
        // Climbing down puts you at the foot facing the barn; up, at the top.
      }
    }
    const girlUp = this.companions.find((c) => c.currentSpot()?.id === this.loftSpot.id && c.isResting && c.restPhase === 'sat');
    if (this.hiding.active) {
      const e = this.hiding.update(dt, { girlInLoft: !!girlUp });
      if (e) {
        const free = this.companions.filter((c) => c.fsm.is('idle', 'walking', 'resting'));
        const girl = girlUp ?? free[Math.floor(Math.random() * free.length)];
        if (e === 'found') this.stopHiding();
        girl?.voice.say(e === 'found' ? 'loftFound' : 'loftCall', { force: true });
      }
    }
    const jess = this.companions.find((c) => c.character.id === 'jess');
    const p = this.player.position;
    const jessUp = !!jess && girlUp === jess;
    if (this.strawDrop.update(dt, { jessUp, you: { x: p.x, z: p.z, below: !this.youOnLoft() && !this.player.isRiding }, jess: { x: this.loftSpot.x, z: this.loftSpot.z } })) {
      this.strawFall.drop({ x: this.loftSpot.x + this.world.layout.loft.strawDx, y: this.loft.top + 0.5, z: this.loftSpot.z }, p, this.loft.ladderFoot.y);
      for (const c of this.companions) c.voice.say('loftDrop', { force: c === jess, urgent: true });
    }
  }

  // Places to be ------------------------------------------------------------

  /** Rain sends them to the barn doorway; drying off lets them out. */
  updatePlaces(dt) {
    const ctx = {
      rain: this.weather.rain,
      spots: this.restSpots,
      girls: this.companions.map((c) => {
        const spot = c.currentSpot();
        return { id: c.character.id, x: c.root.position.x, z: c.root.position.z, spot, state: c.fsm.is('idle') ? 'idle' : c.isResting && c.restPhase === 'sat' ? 'resting' : 'busy' };
      }),
    };
    for (const a of this.places.update(dt, ctx)) {
      const c = this.companions.find((o) => o.character.id === a.girl);
      if (a.do === 'shelter') {
        const go = () => {
          if (c.goRest(a.spot)) c.selfEvents.push('restRain');
          else c.pendingSpot = null;
        };
        c.pendingSpot = a.spot; // held for her while she gets up, so her friend picks another
        if (c.isResting) c.leaveRest(go);
        else go();
      } else if (a.do === 'leave') c.leaveRest();
    }
  }

  // Favours she asks for ----------------------------------------------------

  /** What the favour logic needs to know about the farm right now. */
  requestContext(ridden) {
    const pos = this.player.position;
    return {
      you: { x: pos.x, z: pos.z, onFoot: !this.player.isRiding },
      girls: this.companions.map((c) => ({
        id: c.character.id,
        x: c.root.position.x,
        z: c.root.position.z,
        free: c.fsm.is('idle') && !this.menu.isOpen,
        favourite: c.voice.favourite,
      })),
      quads: this.girlUnits.map((u) => ({
        id: u.spec.id,
        x: u.quad.position.x,
        z: u.quad.position.z,
        muddy: Math.max(u.mud.state.body, u.mud.state.wheels),
        speed: u.quad.speed,
        ridden: u === ridden,
        hasPillion: u.quad.hasPillion,
        pillion: this.companions.find((c) => c.isSeated && c.quad === u.quad && c.seatKind !== 'rider')?.character.id ?? null,
      })),
      can: { ...this.petrolCan.model.getWorldPosition(new THREE.Vector3()), held: this.petrolCan.held }, // it may be standing in the trailer
      bales: this.bales,
    };
  }

  updateRequests(dt, ridden) {
    if (this.hiding.active) return; // nobody to ask
    const ctx = this.requestContext(ridden);
    // She asked to go to the bales and you've got on a quad: she comes and climbs on the back, rather than waiting to be told.
    const ru = ctx.quads.find((q) => q.ridden);
    const joiner = this.requests.joiner(dt, { you: ctx.you, girls: ctx.girls, ridden: ru && this.player.isRiding ? ru : null });
    if (joiner) {
      const c = this.companions.find((o) => o.character.id === joiner);
      c?.requestMount(ridden.quad);
      c?.voice.say('remindBales', { force: true });
    }
    for (const e of this.requests.update(dt, ctx)) {
      const r = e.request;
      const girl = this.companions.find((c) => c.character.id === r.girl);
      const kind = r.kind[0].toUpperCase() + r.kind.slice(1);
      if (e.type === 'ask') girl?.voice.say(`ask${kind}`, { force: true });
      else if (e.type === 'done') {
        this.favour.add(r.girl, this.requests.p.doneFavour);
        girl?.voice.say(`thanks${kind}`, { force: true });
        // The favoured one crows if her friend's close enough to hear.
        const friend = girl?.others().find((o) => o.root.position.distanceTo(girl.root.position) < 12);
        if (friend && this.favour.mood(r.girl) === 'favoured' && Math.random() < 0.6) setTimeout(() => girl.voice.say('gloatFavour', { force: true }), 4000);
      } else if (e.type === 'lapsed') this.favour.add(r.girl, this.requests.p.ignoredFavour);
    }
  }

  /** Talking to her: she reminds you of what she asked, or holds a lapsed one against you (once). */
  remindOfFavour(her) {
    const id = her.character.id;
    const open = this.requests.openFor(id);
    const grudge = this.requests.grudge(id);
    const cap = (k) => k[0].toUpperCase() + k.slice(1);
    if (open) her.voice.say(`remind${cap(open.kind)}`, { force: true });
    else if (grudge && !grudge.told) {
      grudge.told = true;
      her.voice.say(`grudge${cap(grudge.kind)}`, { force: true });
    }
  }

  // Rev-offs -----------------------------------------------------------------

  /** A girl can answer a blip from a running quad she's sat on with nobody at its controls. */
  revOffQuad(c) {
    const q = c.quad;
    return c.fsm.is('seated') && !q.rider && !q.driver && q.engine.isRunning ? q : null;
  }

  /** A girl free beside a quad her friend is sat on, running, reaches over and blips it so it rocks (Jess does; Amy doesn't). */
  updateRockPrank(dt) {
    this.rockPrank ??= { until: 0, quad: null, next: 0 };
    const r = this.rockPrank;
    r.next -= dt;
    if (r.quad) {
      if (this.revOff.clock < r.until) return;
      r.quad.helperThrottle = 0;
      r.quad = null;
    }
    if (r.next > 0 || this.menu.isOpen) return;
    for (const c of this.companions) {
      const p = c.params;
      if (!p.rockPrankChance || !c.fsm.is('idle') || Math.random() >= p.rockPrankChance * dt) continue;
      const friend = this.companions.find((o) => o !== c && this.revOffQuad(o) && !o.holdingIdle && c.root.position.distanceTo(o.quad.position) <= p.rockPrankRange);
      if (!friend) continue;
      r.quad = friend.quad;
      r.until = this.revOff.clock + 0.4;
      r.next = 120;
      friend.quad.helperThrottle = 1;
      c.voice.say('rockPrank', { force: true });
      friend.voice.say('rockPrankAmy', { force: true });
      return;
    }
  }

  /** Jess sat on a running quad blips it over Amy mid-sentence; Amy cuts off and tells her to stop, and Jess does; the engine keeps running (npc/drownOut.js). */
  updateDrownOut(dt) {
    const jess = this.companions.find((c) => c.character.id === 'jess');
    const amy = this.companions.find((c) => c.character.id === 'amy');
    if (!jess || !amy) return;
    const quad = this.revOffQuad(jess);
    const busy = this.revOff.answering('jess') || quad === this.rockPrank?.quad || jess.holdingIdle;
    const ch = amy.voice.chatter;
    const ctx = {
      jessCanRev: !!quad && !busy && !this.menu.isOpen,
      amyLeft: Math.max(0, ch.speakingUntil - ch.time),
      distance: jess.root.position.distanceTo(amy.root.position),
    };
    const events = this.drownOut.update(dt, ctx);
    if (quad && !busy) quad.helperThrottle = this.drownOut.throttleFor();
    for (const e of events) {
      if (e.type === 'rev') {
        amy.voice.cut();
        jess.voice.say('drownRev', { force: true });
      } else if (e.type === 'tellOff') {
        amy.voice.say('drownTellOff', { force: true });
        jess.voice.say('drownProtest', { force: true });
      }
    }
  }

  updateRevOff(dt, ridden) {
    const q = ridden?.quad;
    const girls = this.companions.map((c) => ({ id: c.character.id, canBlip: !!this.revOffQuad(c) && !c.holdingIdle, x: c.root.position.x, z: c.root.position.z }));
    const you = { riding: !!q && !this.menu.isOpen, running: !!q?.engine.isRunning, speed: Math.abs(q?.speed ?? 0), throttle: q?.throttle ?? 0, x: this.player.position.x, z: this.player.position.z };
    const events = this.revOff.update(dt, { you, girls });
    for (const c of this.companions) {
      const quad = this.revOffQuad(c);
      if (quad && quad !== this.rockPrank?.quad && !c.holdingIdle) quad.helperThrottle = this.revOff.throttleFor(c.character.id);
    }
    for (const e of events) {
      const girl = this.companions.find((c) => c.character.id === e.girl);
      if (!girl) continue;
      if (e.type === 'done') {
        if (girl.quad.helperThrottle > 0 && !girl.holdingIdle) girl.quad.helperThrottle = 0;
      } else if (e.type === 'answer') {
        girl.voice.say(e.round > 1 ? 'revAnswerMore' : 'revAnswer', { force: true });
      } else if (e.type === 'complain') {
        if (e.by === 'amy') this.companions.find((c) => c.character.id === 'amy')?.voice.say('revComplain', { force: true });
        else if (this.revOff.stalls(girl.quad.engine)) {
          girl.quad.engine.stall('revOff');
          girl.voice.say('revStall', { force: true });
        }
      }
    }
  }

  // Horns --------------------------------------------------------------------

  updateHorns(dt, ridden) {
    // A horn that works when it likes only sounds some of the time you hold it, and the girls only answer what they hear.
    const held = !!ridden && !this.menu.isOpen && this.input.isDown('KeyL');
    const honking = ridden ? ridden.quad.quirks.horn(dt, held) : false;
    const girls = this.companions.map((c) => {
      const driving = c.fsm.is('driving');
      return { id: c.character.id, x: c.root.position.x, z: c.root.position.z, yaw: c.quad.yaw, speed: Math.abs(c.quad.speed), driving, canHonk: driving || c.fsm.is('seated') };
    });
    const events = this.horns.update(dt, { you: { x: this.player.position.x, z: this.player.position.z, honking }, girls });
    const girl = (id) => this.companions.find((c) => c.character.id === id);
    for (const e of events) {
      if (e.type === 'answer') {
        girl(e.girl)?.voice.say('hornAnswer', { force: true });
        if (ridden) this.achievements.note('hornAnswered');
      }
      else if (e.type === 'creep') girl('jess')?.voice.say('hornJump', { force: true });
      else if (e.type === 'jump') girl(e.girl)?.voice.say('hornJump', { force: true });
    }
    for (const u of this.units) {
      const c = this.companions.find((o) => o.quad === u.quad);
      const sounding = u === ridden ? honking : u.quad.quirks.horn(dt, !!c && this.horns.beeping(c.character.id));
      u.ride.setHorn(sounding);
      u.quad.hornHeld = sounding; // a wheel pad that sinks while it sounds
      if (u.quad.signalClick) {
        this.audioHub.indicatorClick(u.quad.signalClick === 'on', u.quad.position); // the relay, fading with distance
        u.quad.signalClick = null;
      }
    }
  }

  // Names, whose quad, and hearing one ------------------------------------

  /** Who is at the controls of this quad: 'you', the girl driving it, or nobody. */
  quadUser(u, ridden) {
    if (u === ridden) return 'you';
    return this.companions.find((c) => c.quad === u.quad && c.fsm.is('driving'))?.character.id ?? null;
  }

  updateQuadTalk(dt, ridden) {
    const pos = this.player.position;
    const girls = this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.fsm.is('idle') && !this.menu.isOpen }));
    const quads = this.girlUnits.map((u) => {
      const user = this.quadUser(u, ridden);
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, user, driver: user, running: q.engine.isRunning, speed: q.speed, throttle: q.throttle, temperature: q.engine.temperature, wear: q.engine.wear };
    });
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const later = (ms, fn) => setTimeout(fn, ms);

    // Jess names a quad, and Amy won't use it.
    const jess = girls.find((g) => g.id === 'jess');
    if (jess) {
      const near = [...quads].sort((a, b) => Math.hypot(a.x - jess.x, a.z - jess.z) - Math.hypot(b.x - jess.x, b.z - jess.z)).map((q) => q.id);
      const named = this.quadNames.update(dt, { jessFree: jess.free, youNear: Math.hypot(pos.x - jess.x, pos.z - jess.z) < this.quadNames.p.nameRange, candidates: near });
      if (named) {
        byId.jess.voice.say(quadKey('nameQuad', named.specId, named.nick), { force: true });
        const amy = girls.find((g) => g.id === 'amy');
        if (amy && Math.hypot(amy.x - jess.x, amy.z - jess.z) < 15) later(3500, () => byId.amy.voice.say('nameAmy', { force: true }));
      }
    }
    // Amy slips: Jess pounces.
    if (byId.amy?.voice.slipped) {
      byId.amy.voice.slipped = false;
      later(2500, () => byId.jess?.voice.say('nameCaved', { force: true }));
    }

    // Whose is whose.
    for (const e of this.ownership.update(dt, { you: { x: pos.x, z: pos.z, onFoot: !this.player.isRiding }, girls, quads })) {
      if (e.type === 'upset') this.noteFriction('borrow', e.by);
      if (e.type === 'claim') byId[e.girl].voice.sayQuad('claim', e.spec, { urgent: true });
      else if (byId[e.girl].voice.say(`ownerUpset_${e.by}`, { force: true }) && e.by === 'jess' && Math.random() < this.ownership.p.teaseChance) {
        later(3500, () => byId.jess?.voice.say('borrowTease', { force: true }));
      }
    }

    // Hearing a quad out of sight.
    for (const e of this.hearing.update(dt, { girls, quads })) {
      byId[e.girl].voice.sayQuad(`ear${e.sound[0].toUpperCase()}${e.sound.slice(1)}`, e.spec, { urgent: true });
    }
  }

  // Sheltering in a cab --------------------------------------------------

  /** The UTV and the Land Rovers as somewhere to get in out of the weather: where each is, whether it is free to climb into, and how many seats. */
  cabContext() {
    return ['utv', 'landy', 'defender'].filter((k) => this.goVehicle(k)).map((kind) => {
      const q = this.goVehicle(kind).quad;
      const mount = this.mountOfKind(kind);
      const busy = (c) => c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling', 'cranking') || (c.fsm.is('walking') && ['drive', 'crank', 'start'].includes(c.fsm.data?.goal)));
      const open = !q.rider && !q.driver && !q.passenger && !q.isTipped && q.speed < 0.5 && !this.companions.some(busy) && !this.cabShelter.isSulkCab(kind) && !(kind === 'utv' && (this.utvBed.tip > 0.02 || mount.bedBusy));
      const seats = [mount.slots.left, mount.slots.mid].filter((s) => s && !s.girl).length;
      return { id: kind, x: q.position.x, z: q.position.z, open, seats, running: q.engine.isRunning, warm: kind !== 'utv' };
    });
  }

  /** She climbs into this cab (when she's stood about). Returns whether she set off. */
  boardCab(c, kind, { passenger = false } = {}) {
    const mount = this.mountOfKind(kind);
    const slot = passenger ? mount.slots.left : mount.freeSlot(c.root.position); // sulking, she takes the passenger's seat
    if (!slot || slot.girl || !c.boardTrailer(mount, slot)) return false;
    this.rideOfKind(kind).ask(c.character.id); // she stays until the weather turns or she's bored
    return true;
  }

  /** What the cab shelter needs to know about the girls and cabs right now. */
  cabShelterContext() {
    const cabKinds = ['utv', 'landy', 'defender'];
    return {
      rain: this.weather.rain,
      warmth: this.weather.warmth,
      cabs: this.cabContext(),
      girls: this.companions.map((c) => ({
        id: c.character.id,
        x: c.root.position.x,
        z: c.root.position.z,
        free: c.fsm.is('idle') && !c.hayFell && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob && !c.isResting,
        cab: cabKinds.find((k) => this.goVehicle(k) && c.onHayRide && c.trailer === this.mountOfKind(k)) ?? null,
      })),
    };
  }

  /** Acts on what the cab shelter decided (also the debug panel's button, through `sendToCab`). */
  handleCabEvent(e) {
    const c = this.companions.find((o) => o.character.id === e.girl);
    if (e.type === 'go') {
      const unit = this.goVehicle(e.cab);
      const go = () => {
        if (!this.boardCab(c, e.cab, { passenger: e.reason === 'sulk' })) this.cabShelter.drop(e.girl, []);
      };
      if (e.reason !== 'sulk') c.voice.say(e.reason === 'cold' ? 'cabColdGo' : 'cabRainGo', { urgent: true, chance: 0.9 });
      if (e.start) {
        c.requestStart(unit.quad, { settleAt: e.reason === 'sulk' ? 0.3 : 0.5, then: (ran) => (ran || unit.quad.engine.isRunning ? go() : this.cabShelter.drop(e.girl, [])) });
      } else go();
    } else if (e.type === 'in') {
      if (e.reason !== 'sulk') c.voice.say('cabIn', { chance: 0.8 });
    }
    else if (e.type === 'out') {
      this.rideOfKind(e.cab).dismiss(e.girl);
      c.leaveTrailer();
      if (e.reason !== 'sulk') c.voice.say('cabOut', { chance: 0.6 });
    } else if (e.type === 'switchOff') {
      const q = this.goVehicle(e.cab).quad;
      if (q.engine.isRunning && !q.rider && !q.driver && !q.passenger && !this.companions.some((o) => o.onHayRide && o.trailer === this.mountOfKind(e.cab))) q.engine.setIgnition(false);
    }
  }

  /** `quiet`: autonomy is off, so only a sulk (sent by the button) carries on; no weather sends anyone to a cab. */
  updateCabShelter(dt, quiet = false) {
    const ctx = this.cabShelterContext();
    if (quiet) Object.assign(ctx, { rain: 0, warmth: 1 });
    for (const e of this.cabShelter.update(dt, ctx)) this.handleCabEvent(e);
  }

  // Seats that ride differently -----------------------------------------------

  /** A seat slams (its spring bottomed out, or the bed threw her up): whoever is sat there reacts, now and then. */
  updateSeatSlams() {
    for (const unit of this.units) {
      const q = unit.quad;
      for (const slam of q.seatSlams) {
        for (const c of this.companions) {
          if (c.quad !== q) continue;
          const slot = c.fsm.is('onTrailer') && c.trailer?.quad === q ? c.traSlot : null;
          const kind = slot ? (slot.name === 'bed' ? 'bed' : slot.rear ? 'rear' : 'front') : c.fsm.is('seated') ? (c.seatKind === 'rack' ? 'rack' : 'pillion') : null;
          if (kind !== slam.kind || (kind === 'front' && !slot)) continue;
          const key = kind === 'bed' && slam.up ? 'seatBedAir' : { pillion: 'seatPillion', rack: 'seatRack', rear: 'seatRear', bed: 'seatBed' }[kind];
          if (key && slam.strength > 0.3) c.voice.say(key, { chance: 0.6 });
        }
      }
    }
  }

  // Ready and waiting -----------------------------------------------------

  /** The quad she'll sit on for you: your usual one, then her favourite, then the nearest, anywhere she can get on the back of. */
  readyQuadFor(c) {
    const fit = (u) => u.quad.hasPillion && !u.quad.isTipped && !u.quad.rider && !u.quad.driver && !u.quad.passenger && c.mayRide(u.quad) && c.canRidePillion(u.quad) && !this.herOn(u.quad);
    const free = this.girlUnits.filter(fit);
    const byId = (id) => free.find((u) => u.spec.id === id);
    return byId(this.headStart.usual())?.quad ?? byId(c.voice.favourite)?.quad ?? free.sort((a, b) => a.quad.position.distanceTo(c.root.position) - b.quad.position.distanceTo(c.root.position))[0]?.quad ?? null;
  }

  /** "I'll be a minute": she gets a quad going and sits on the back of it, revving and tooting, until you come. Returns whether she set off. */
  askToWait(c, forced = false) {
    const id = c.character.id;
    const q = this.readyQuadFor(c);
    this.closeMenu();
    if (!q || !c.fsm.is('idle')) {
      if (!forced) this.hud.toast(`${c.name} can't just now`);
      return false;
    }
    this.readyWaiting.begin(id);
    this.readyQuads.set(id, q);
    c.voice.say('readyGo', { force: true });
    const sit = () => (c.requestMount(q), c.seatedByChoice = false); // on the back, and she stays there until you come or give up
    if (q.engine.isRunning) sit();
    else c.requestStart(q, { settleAt: 0.3, then: (ran) => (ran || q.engine.isRunning ? sit() : this.readyWaiting.drop(id)) });
    return true;
  }

  /** Each frame: the girls who are getting a quad ready for you, or sat on one revving and tooting. */
  updateReady(dt) {
    const w = this.readyWaiting;
    const ridden = this.riddenUnit;
    for (const c of this.companions) c.readyHolding = w.waiting(c.character.id) || this.warmSit.sitting(c.character.id); // so nothing else revs her quad or she switches it off
    const girls = this.companions.filter((c) => w.has(c.character.id)).map((c) => {
      const q = this.readyQuads.get(c.character.id);
      return {
        id: c.character.id,
        ready: !!q && c.fsm.is('seated') && c.quad === q && c.seatKind === 'pillion' && q.engine.isRunning,
        youDistance: c.root.position.distanceTo(this.player.position),
        youOn: !!ridden && ridden.quad === q,
      };
    });
    for (const e of w.update(dt, { girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      const q = this.readyQuads.get(e.girl);
      if (e.type === 'rev') this.readyRev = { quad: q, left: e.seconds };
      else if (e.type === 'toot') {
        this.horns.toot(e.girl, e.length);
        c.voice.say(e.impatient ? 'readyImpatient' : 'readyToot', { force: true });
      } else if (e.type === 'here') c.voice.say('readyHere', { force: true });
      else if (e.type === 'giveUp') {
        if (e.keyOff) q.engine.setIgnition(false);
        c.voice.say('readyGiveUp', { force: true });
        c.fsm.transition('dismounting');
      }
      if (e.type === 'here' || e.type === 'giveUp' || e.type === 'lost') {
        this.readyQuads.delete(e.girl);
        if (this.readyRev?.quad === q) this.readyRev = null;
        if (q && !this.companions.some((o) => o.quad === q && o.holdingIdle)) q.helperThrottle = 0;
      }
    }
    // Sat there she keeps a little choke and throttle on while it is cold, or it dies on her (as for the sulker in the cab).
    const cared = new Set();
    for (const [id, q] of [...this.readyQuads, ...this.warmSitQuads]) {
      const c = this.companions.find((o) => o.character.id === id);
      if (c.fsm.is('starting') || !q.engine.isRunning || q.engine.temperature >= q.engine.params.warmLightThreshold) continue; // (while she is starting it she minds the choke herself)
      cared.add(q);
      if (q.choke < 0.3) q.choke = 0.3;
      if (this.readyRev?.quad !== q) q.helperThrottle = 0.15;
    }
    for (const q of this.readyCare ?? []) {
      if (!cared.has(q)) {
        q.choke = 0;
        if (this.readyRev?.quad !== q) q.helperThrottle = 0;
      }
    }
    this.readyCare = cared;
    if (this.readyRev) {
      const r = this.readyRev;
      r.left -= dt;
      if (r.left <= 0 || !r.quad.engine.isRunning) {
        r.quad.helperThrottle = 0;
        this.readyRev = null;
      } else r.quad.helperThrottle = 1;
    }
  }

  // Sulking in the cab ---------------------------------------------------

  /** The girl sulking in this vehicle (a Land Rover), if one is in it. */
  sulkerIn(quad) {
    const id = this.sulking.who;
    if (!id || !this.sulking.isIn(id)) return null;
    const c = this.companions.find((o) => o.character.id === id);
    return c && c.quad === quad ? c : null;
  }

  /** She is cross: after a row or a slight she goes and sits alone in a Land Rover, engine on (npc/sulking.js). Each frame. */
  updateSulking(dt) {
    const s = this.sulking;
    const girls = this.companions.map((c) => {
      const m = this.cabShelter.of(c.character.id);
      return {
        id: c.character.id,
        free: c.fsm.is('idle') && !c.hayFell && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob && !c.isResting,
        neglected: this.favour.mood(c.character.id) === 'neglected',
        cab: m?.reason === 'sulk' ? m.state : null,
      };
    });
    for (const e of s.update(dt, { girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'go') {
        if (this.sendToCab(e.girl, 'sulk')) c.voice.say('sulkGo', { force: true });
        else s.drop(e.girl);
      } else if (e.type === 'out') {
        const m = this.cabShelter.of(e.girl);
        if (m) {
          this.handleCabEvent({ type: 'out', girl: e.girl, cab: m.cab, reason: 'sulk' });
          this.cabShelter.drop(e.girl, []);
        }
        c.voice.say(e.why === 'round' ? 'sulkRound' : 'sulkOut', { force: true });
      } else if (e.type === 'over') {
        const m = this.cabShelter.of(e.girl);
        if (m?.reason === 'sulk') this.cabShelter.drop(e.girl, []);
      }
    }
    // She keeps a little choke and throttle on while a cold engine warms, or it dies on her once she's stopped minding it.
    const sat = this.sulking.who && this.sulking.isIn(this.sulking.who) ? this.cabShelter.of(this.sulking.who) : null;
    if (sat) {
      const q = this.goVehicle(sat.cab).quad;
      if (q.engine.isRunning && q.engine.temperature < q.engine.params.warmLightThreshold) {
        if (q.choke < 0.3) q.choke = 0.3;
        if (!this.sulkRev) q.helperThrottle = 0.15; // and a touch of throttle from the seat beside
        this.sulkChoke = q;
      } else if (this.sulkChoke === q) {
        q.choke = 0;
        if (!this.sulkRev) q.helperThrottle = 0;
        this.sulkChoke = null;
      }
    } else if (this.sulkChoke) {
      this.sulkChoke.choke = 0;
      this.sulkChoke.helperThrottle = 0;
      this.sulkChoke = null;
    }
    // Jess's revving: the engine blipped open for a moment at a time.
    if (this.sulkRev) {
      this.sulkRev.left -= dt;
      const q = this.sulkRev.quad;
      if (this.sulkRev.left <= 0 || !q.engine.isRunning) {
        q.helperThrottle = 0;
        this.sulkRev = null;
      } else q.helperThrottle = 1;
    }
  }

  /** You knock on the window of a Land Rover with a sulking girl in it. */
  knockOnWindow(c) {
    const id = c.character.id;
    const r = this.sulking.knock(id, { neglected: this.favour.mood(id) === 'neglected' });
    if (!r) return;
    this.hud.toast(r.kind === 'ignored' ? `You knock. ${c.name} doesn't look round` : 'You knock on the window', 1.5);
    if (r.kind === 'answer') c.voice.say('sulkAnswer', { force: true });
    else if (r.kind === 'rev') {
      c.voice.say('sulkAnswer', { force: true });
      this.sulkRev = { quad: c.quad, left: this.sulking.p.revSeconds };
    } else if (r.kind === 'pushed') c.voice.say('sulkPushed', { force: true });
  }

  /** The debug panel's and the console's way to send a girl to a cab now. Returns whether she set off. */
  sendToCab(id, reason = 'rain', cab = null) {
    const e = this.cabShelter.force(id, this.cabShelterContext(), reason, cab);
    if (e) this.handleCabEvent(e);
    return !!e;
  }

  // Warming their hands --------------------------------------------------

  updateWarming(dt) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt,
      warmSpec: c.warmingAt?.unit.spec.id ?? null,
    }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      const idling = q.engine.isRunning && !q.rider && !q.driver && !q.passenger && !q.isGhostRiding && q.speed < 0.3 && !this.herOn(q);
      return { id: u.spec.id, x: q.position.x, z: q.position.z, idling };
    });
    for (const e of this.warming.update(dt, { weather: this.weather, girls, quads })) {
      const c = byId[e.girl];
      if (e.type === 'go') {
        if (c.goWarm(this.girlUnits.find((u) => u.spec.id === e.spec).quad)) c.voice.say(e.join ? 'warmJoin' : 'warmGo', { urgent: true, chance: 0.8 });
      } else if (e.type === 'warm') c.voice.say('warmHands', { chance: 0.8 });
      else if (e.type === 'leave') {
        c.stopWarming();
        if (e.off) c.voice.say('warmOff', { force: true });
      }
    }
  }

  // A head start on your usual quad ----------------------------------------

  updateHeadStart(dt, ridden) {
    if (ridden) this.headStart.ride(ridden.spec.id, dt);
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob,
      mood: this.favour.mood(c.character.id),
      own: c.claimedSpec,
    }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      const claimed = this.companions.some((c) => c.quad === q && c.fsm.is('walking', 'starting'));
      const startable = !q.engine.isRunning && !q.rider && !q.driver && !q.passenger && !q.isTipped && !q.isGhostRiding && !this.herOn(q) && !claimed;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, startable };
    });
    const events = this.headStart.update(dt, { cold: isChilly(this.weather, this.warming.p), you: { x: this.player.position.x, z: this.player.position.z, onFoot: !this.player.isRiding }, girls, quads });
    for (const e of events) {
      const c = byId[e.girl];
      const quad = this.girlUnits.find((u) => u.spec.id === e.spec).quad;
      if (c.takenByOther(quad, 'rider')) continue;
      if (e.type === 'warmFor') {
        this.warmUpFor(c, quad.unit);
        continue;
      }
      c.requestStart(quad);
      c.voice.say('snubGo', { urgent: true, force: true });
    }
  }

  // Sitting on it while it warms ---------------------------------------------

  /** Where she could sit while this vehicle warms: the back of a quad, or the passenger seat of a Land Rover or the UTV. null if there is nowhere. */
  warmSitSpot(c, unit) {
    const q = unit.quad;
    const cab = ['utv', 'landy', 'defender'].find((k) => this.goVehicle(k) === unit);
    if (cab) {
      const slot = this.mountOfKind(cab).slots.left;
      return slot && !slot.girl && !q.rider && !q.driver && !q.passenger ? { cab } : null;
    }
    if (q.tractor) return null;
    return c.canRidePillion(q) ? { back: true } : null;
  }

  /** She is starting your usual vehicle for you: from beside it as ever, or (mostly) sitting on it while it warms, maybe asking first. */
  warmUpFor(c, unit, forced = false) {
    const q = unit.quad;
    const spot = this.warmSitSpot(c, unit);
    const near = c.root.position.distanceTo(this.player.position);
    const mode = forced ? (spot ? 'sit' : 'beside') : this.warmSit.decide(!!spot, near);
    if (mode === 'ask') {
      c.voice.say('warmSitAsk', { urgent: true, force: true });
      const ask = (this.warmAsk = { c, unit, spot, done: false });
      const pick = (sit) => () => {
        ask.done = true;
        if (sit) this.warmSitGo(c, unit, spot);
        else c.requestStart(q);
      };
      this.openWheel(`${c.name} asks`, [{ label: 'Go on', run: pick(true) }, { label: 'No, I\'ll take it', run: pick(false) }], null);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    c.voice.say('headStartGo', { urgent: true, force: true });
    if (mode === 'sit') this.warmSitGo(c, unit, spot);
    else c.requestStart(q);
  }

  /** She starts it (if it isn't running) and takes her seat to enjoy the warm-up. */
  warmSitGo(c, unit, spot) {
    const q = unit.quad;
    const id = c.character.id;
    if (!spot || !c.fsm.is('idle')) return c.requestStart(q);
    this.warmSit.begin(id);
    this.warmSitQuads.set(id, q);
    const sit = () => {
      if (spot.cab) {
        if (!this.boardCab(c, spot.cab, { passenger: true })) this.warmSit.drop(id);
      } else {
        c.requestMount(q);
        c.seatedByChoice = false; // and stays there until you come, or she gives up
      }
    };
    if (q.engine.isRunning) sit();
    else c.requestStart(q, { settleAt: 0.3, then: (ran) => (ran || q.engine.isRunning ? sit() : this.warmSit.drop(id)) });
  }

  /** Each frame: a girl sat on a warming vehicle. */
  updateWarmSit(dt, ridden) {
    const w = this.warmSit;
    if (this.warmAsk && !this.warmAsk.done && !this.menu.isOpen) {
      // The wheel was closed without an answer: she gets on with it as she always did.
      const { c, unit } = this.warmAsk;
      this.warmAsk.done = true;
      c.requestStart(unit.quad);
    }
    const girls = this.companions.filter((c) => w.has(c.character.id)).map((c) => {
      const id = c.character.id;
      const q = this.warmSitQuads.get(id);
      const cab = ['utv', 'landy', 'defender'].find((k) => this.goVehicle(k)?.quad === q);
      const sat = cab ? c.onHayRide && c.trailer === this.mountOfKind(cab) : c.fsm.is('seated') && c.quad === q && c.seatKind === 'pillion';
      return {
        id,
        ready: !!q && sat && q.engine.isRunning,
        temperature: q?.engine.temperature ?? 0,
        warm: !!q && q.engine.temperature >= q.engine.params.warmLightThreshold,
        youDistance: c.root.position.distanceTo(this.player.position),
        youOn: !!ridden && ridden.quad === q,
      };
    });
    for (const e of w.update(dt, { girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      const q = this.warmSitQuads.get(e.girl);
      const line = { in: 'warmSitIn', smoothing: 'warmSitSmoothing', smooth: 'warmSitSmooth', slow: 'warmSitSlow', giveUp: 'warmSitGiveUp' }[e.type];
      if (line) c.voice.say(line, { force: true });
      if (e.type === 'off' || e.type === 'giveUp') {
        const cab = ['utv', 'landy', 'defender'].find((k) => this.goVehicle(k)?.quad === q);
        if (cab) {
          this.rideOfKind(cab).dismiss(e.girl);
          c.leaveTrailer();
        } else c.fsm.transition('dismounting');
      }
      if (e.type === 'off' || e.type === 'giveUp' || e.type === 'lost') this.warmSitQuads.delete(e.girl);
    }
  }

  // Hand on the throttle ---------------------------------------------------

  updateThrottleGrab(dt, ridden) {
    const q = ridden?.quad;
    const girls = this.companions.map((c) => ({ id: c.character.id, onBack: !!q && c.quad === q && c.fsm.is('seated') && c.seatKind === 'pillion' }));
    const riding = !!q && q.engine.isRunning && !this.menu.isOpen;
    const grab = this.throttleGrab;
    for (const e of grab.update(dt, { riding, speed: Math.abs(q?.forwardSpeed ?? 0), girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'start') c.voice.say('grabGo', { force: true });
      else if (e.type === 'end') {
        // Amy apologises (her one go); Jess is pleased with herself.
        if (e.girl === 'amy' || Math.random() < 0.6) c.voice.say('grabSorry', { force: true });
      }
    }
    for (const c of this.companions) {
      const mine = grab.grab?.girl === c.character.id;
      c.pillion.throttleReach = mine ? grab.reach : 0;
    }
    if (q) q.handThrottle = grab.throttle;
    for (const u of this.girlUnits) if (u.quad !== q && u.quad.handThrottle) u.quad.handThrottle = 0;
  }

  // Two-stroke smoke ---------------------------------------------------------

  /** A quad in another's dust cloud breathes it (world/dust.js): sets how thick, for its air filter. */
  updateDustClouds() {
    const clouds = this.units.map((u) => ({ x: u.quad.position.x, z: u.quad.position.z, yaw: u.quad.yaw, dust: u.quad.dust }));
    if (!clouds.some((c) => c.dust > 0)) {
      for (const u of this.units) u.quad.dustIn = 0;
      return;
    }
    this.units.forEach((u, i) => {
      u.quad.dustIn = dustExposure(u.quad.position, clouds, this.world.dustParams, clouds[i]);
    });
  }

  updateSmokeSense(dt) {
    const smoke = this.girlUnits[0].smoke.params;
    const girls = this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.fsm.is('idle') && !this.menu.isOpen }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, yaw: q.yaw, twoStroke: q.engine.params.strokes === 2, running: q.engine.isRunning, throttle: q.throttle || q.helperThrottle, temperature: q.engine.temperature };
    });
    for (const e of this.smokeSense.update(dt, { wind: { x: smoke.windX, z: smoke.windZ }, girls, quads })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      if (e.type === 'cough') {
        c.waveOff(this.smokeSense.p.waveFor);
        c.voice.say('smokeCough', { urgent: true });
      } else c.voice.say('smokeLove', { urgent: true, chance: 0.8 });
    }
  }

  /** A girl behind or beside you sees smoke, steam, a soft tyre or a loose silencer on your quad and shouts it (npc/shoutFault.js). */
  updateFaultShout(dt) {
    const unit = this.riddenUnit;
    const q = unit?.quad;
    const e = q?.engine;
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      // Not on your quad, and not busy at the menu or climbing on or off something.
      watching: !this.menu.isOpen && !(c.quad === q && (c.isSeated || c.fsm.is('mounting'))) && c.fsm.is('idle', 'walking', 'driving', 'seated', 'resting'),
    }));
    const signs = q && e.isRunning ? { oil: e.oilRich, steam: e.steam, diesel: e.dieselSoak, tyre: q.faults.levels.puncture, hanging: e.silencerBlown } : {};
    const ctx = { quad: q && e.isRunning ? { x: q.position.x, z: q.position.z, yaw: q.yaw, speed: q.forwardSpeed } : null, signs, girls };
    for (const ev of this.faultShout.update(dt, ctx)) {
      const c = this.companions.find((o) => o.character.id === ev.girl);
      c?.voice.say(`shout${ev.what[0].toUpperCase()}${ev.what.slice(1)}`, { urgent: true });
    }
  }

  /** Idling in the yard builds a haze that still air keeps; the girls stood in it cough and wave it away. */
  updateHaze(dt) {
    const w = this.weather;
    const smoke = this.girlUnits[0].smoke.params;
    const engines = this.units.map((u) => {
      const e = u.quad.engine;
      return { x: u.quad.position.x, z: u.quad.position.z, running: e.isRunning, throttle: e.throttle, twoStroke: e.params.strokes === 2, diesel: !!e.params.runsOnDiesel };
    });
    const girls = this.companions.map((c) => ({ id: c.character.id, x: c.root.position.x, z: c.root.position.z, free: c.fsm.is('idle') && !this.menu.isOpen }));
    for (const e of this.haze.update(dt, { wind: w.wind, rain: w.rain, engines, girls })) {
      const c = this.companions.find((o) => o.character.id === e.girl);
      c.waveOff(this.haze.p.waveFor);
      c.voice.say('hazeCough', { urgent: true });
    }
    this.hazeLayer.update(dt, this.haze.level, smoke.windX, smoke.windZ, (x, z) => this.world.heightAt(x, z));
  }

  /** An engine run in the barn fills it with fumes; free girls inside cough and walk out, and Amy switches it off from the doorway (world/barnFumes.js). */
  updateBarnFumes(dt) {
    const w = this.weather;
    const bs = barnShape(this.world.layout);
    const engines = this.units.map((u) => {
      const q = u.quad;
      const e = q.engine;
      const starter = this.companions.some((c) => c.fsm.is('starting') && c.quad === q);
      return {
        id: u.id, running: e.isRunning, throttle: e.throttle, twoStroke: e.params.strokes === 2, diesel: !!e.params.runsOnDiesel,
        inside: this.world.inBarn(q.position.x, q.position.z), attended: !!(q.rider || q.driver || q.passenger || starter),
      };
    });
    const amy = this.companions.find((c) => c.character.id === 'amy');
    const girls = this.companions.map((c) => ({
      id: c.character.id, free: (c.fsm.is('idle') || c.fsm.is('resting')) && !this.menu.isOpen, inside: this.world.inBarn(c.root.position.x, c.root.position.z),
    }));
    const events = this.barnFumes.update(dt, { wind: w.wind, engines, girls, amyFree: !!amy && amy.fsm.is('idle') && !this.menu.isOpen });
    const out = new THREE.Vector3(bs.door.x + 1.4, 0, bs.z);
    for (const e of events) {
      const c = this.companions.find((o) => o.character.id === (e.girl ?? 'amy'));
      if (e.type === 'cough') {
        // Out of the barn doors and into the yard, coughing; a girl on her way to switch it off stays put.
        if (!(e.girl === 'amy' && this.barnFumes.going)) c.recall(new THREE.Vector3(out.x + 2, this.world.heightAt(out.x + 2, out.z), out.z), Math.PI / 2);
        c.voice.say('fumesCough', { urgent: true });
      } else if (e.type === 'amyGoes') {
        c.recall(new THREE.Vector3(out.x, this.world.heightAt(out.x, out.z), out.z), -Math.PI / 2);
        c.voice.say('fumesSwitchOff', { urgent: true });
      } else if (e.type === 'switchOff') {
        this.units.find((u) => u.id === e.engine)?.quad.engine.setIgnition(false);
      } else if (e.type === 'tell') c.voice.say('fumesTell', { urgent: true });
    }
    const smoke = this.girlUnits[0].smoke.params;
    this.barnFumesLayer.update(dt, this.barnFumes.level, Math.max(0, smoke.windX) + 0.3, 0, (x, z) => this.world.heightAt(x, z), 0.3);
  }

  // Reading the dash out -----------------------------------------------------

  updateDashReading(dt, ridden) {
    const q = ridden?.quad;
    const girls = this.companions.map((c) => ({ id: c.character.id, onBack: !!q && c.quad === q && c.fsm.is('seated') && c.seatKind === 'pillion' }));
    const dash = q ? { fuelLamp: !!q.lamps?.fuel, tempLamp: !!q.lamps?.temp, fuelLevel: q.fuel.level, temperature: q.engine.temperature } : {};
    const events = this.dashReader.update(dt, { riding: !!q && q.engine.isRunning && !this.menu.isOpen, girls, dash, speed: Math.abs(q?.forwardSpeed ?? 0), throttle: q?.throttle ?? 0 });
    for (const e of events) this.companions.find((c) => c.character.id === e.girl)?.voice.say(`read${e.what[0].toUpperCase()}${e.what.slice(1)}`, { force: true });
  }

  // Calling them back ------------------------------------------------------

  /** Where each girl stands when called back: in front of the barn doors, side by side. */
  recallSpot(i) {
    const b = this.world.layout.barn;
    const x = b.x + b.halfX + 3;
    const side = this.fallingOut.active ? 3.5 : 1.4; // fallen out, they keep their distance
    return { point: new THREE.Vector3(x, this.world.heightAt(x, b.z + (i === 0 ? -side : side)), b.z + (i === 0 ? -side : side)), facing: Math.PI / 2 };
  }

  /** Stop whatever they're doing and gather by the barn doors. */
  recallGirls() {
    this.race.stand();
    this.drag.stand();
    this.convoy.stand();
    this.recalling = { left: 120, spots: this.companions.map((c, i) => this.recallSpot(i)), said: false };
    this.hud.toast('Girls: stop what you are doing and come to the barn');
  }

  /**
   * The bell: they hear it anywhere on the farm. Rung while they're already on their way, it just gives them longer to get
   * there, and one who isn't there yet may tell you she heard it the first time.
   */
  ringBell() {
    this.bell.ring();
    this.achievements.note('bell');
    const r = this.recalling;
    if (!r) return this.recallGirls();
    r.left = 120;
    if (!r.said) return;
    const late = this.companions.filter((c, i) => !this.recallArrived(c, r.spots[i]));
    late[Math.floor(Math.random() * late.length)]?.voice.say('bellAgain', { chance: 0.6 });
  }

  recallArrived(c, spot) {
    return c.fsm.is('idle') && c.root.position.distanceTo(spot.point) < 2.5;
  }

  /** Keeps at it until each is there (a girl mid-change gets another nudge), or two minutes have gone. */
  updateRecall(dt) {
    const r = this.recalling;
    if (!r) return;
    r.left -= dt;
    r.nudge = (r.nudge ?? 0) - dt;
    let waiting = false;
    this.companions.forEach((c, i) => {
      if (this.recallArrived(c, r.spots[i])) return;
      waiting = true;
      if (r.nudge <= 0) c.recall(r.spots[i].point, r.spots[i].facing);
    });
    if (r.nudge <= 0) {
      r.nudge = 0.7;
      if (!r.said) {
        r.said = true;
        for (const c of this.companions) c.voice.say('recalled', { force: true });
      }
    }
    if (!waiting || r.left <= 0) this.recalling = null;
  }

  // Tea on the rack ----------------------------------------------------------

  updateTea(dt, ridden) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !c.carrying && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot, x: c.root.position.x, z: c.root.position.z }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, speed: Math.abs(q.speed), rider: u === ridden, driver: this.quadUser(u, ridden) !== 'you' ? this.quadUser(u, ridden) : null, tipped: q.isTipped, hasRack: !!q.mugAnchor };
    });
    const unitOf = (spec) => this.girlUnits.find((u) => u.spec.id === spec);
    // A girl walks to the back of the quad, pauses, and does it (the same walk-up as for a prank).
    const sendTo = (girl, spec, act) => {
      const quad = unitOf(spec).quad;
      const c = byId[girl];
      const side = c.nearSide(quad);
      const p = quad.localToWorld(side * 0.85, 0, -0.95);
      const spot = { x: p.x, z: p.z };
      if (c.sneakTo(spot, act)) return true;
      this.tea.cancel(girl);
      return false;
    };
    for (const e of this.tea.update(dt, { girls, quads })) {
      const c = byId[e.girl];
      if (e.type === 'place') {
        // She brings a mug from the house in her hand, walks round to the back of the quad and sets it on the rack.
        const colour = e.girl === 'amy' ? 0x3a6ea5 : 0xb8322a;
        const mug = this.mugs.make(colour);
        mug.position.copy(c.root.position);
        if (!c.startCarry('mug', mug, carryWeight('mug'), { inHand: true })) {
          this.mugs.remove(mug);
          this.tea.cancel(e.girl);
          continue;
        }
        const going = sendTo(e.girl, e.spec, () => {
          const u = unitOf(e.spec);
          const free = !u.quad.rider && !u.quad.driver && Math.abs(u.quad.speed) < 0.3;
          const rack = free && u.quad.mugAnchor?.getWorldPosition(new THREE.Vector3());
          if (!rack) {
            c.endCarry();
            this.mugs.remove(mug);
            return this.tea.cancel(e.girl);
          }
          c.putDownCarry(rack, 0, () => {
            if (!this.mugs.putMug(u.quad, mug)) return this.mugs.remove(mug);
            this.teaMugs[e.girl] = mug;
            this.tea.placed(e.girl, e.spec);
            c.voice.say('teaPlace', { urgent: true, chance: 0.9 });
          });
        });
        if (!going) {
          c.endCarry();
          this.mugs.remove(mug);
        }
      } else if (e.type === 'collect') {
        sendTo(e.girl, e.spec, () => {
          const u = unitOf(e.spec);
          const mug = this.teaMugs[e.girl];
          if (u.quad.rider || u.quad.driver || Math.abs(u.quad.speed) > 0.3 || !mug) return this.tea.cancel(e.girl);
          // She lifts it off the rack, has a drink, and that's the end of it.
          delete this.teaMugs[e.girl];
          this.tea.collected(e.girl);
          c.startCarry('mug', mug, carryWeight('mug'), {
            sip: true,
            onSipped: () => {
              const side = c.root.localToWorld(new THREE.Vector3(-0.35, 0, 0.3));
              c.putDownCarry(side, 0, () => this.mugs.remove(mug));
            },
          });
          c.voice.say('teaCollect', { urgent: true, chance: 0.8 });
        });
      } else if (e.type === 'fall') {
        const q = unitOf(e.spec).quad;
        this.mugs.drop(this.teaMugs[e.girl], q.velocity);
        delete this.teaMugs[e.girl];
        c.voice.say('teaFell', { force: true });
      }
    }
    this.mugs.update(dt);
  }

  // Jumpers from the barn ------------------------------------------------------

  updateJumpers(dt) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !c.carrying && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot, x: c.root.position.x, z: c.root.position.z }));
    const rail = this.world.layout.jumperRail;
    for (const e of this.jumpers.update(dt, { weather: this.weather, girls, rail })) {
      const c = byId[e.girl];
      const colour = JUMPERS.find((j) => j.id === e.jumper).color;
      const act = e.type === 'fetch'
        ? () => {
            this.jumpers.dressed(e.girl, e.jumper);
            c.setJumper(colour);
            c.voice.say('jumperOn', { urgent: true, chance: 0.9 });
            this.jumperRail.show(this.jumpers.onRail().map((j) => j.id));
          }
        : () => {
            this.jumpers.hung(e.girl);
            c.setJumper(null);
            c.voice.say('jumperOff', { urgent: true, chance: 0.8 });
            this.jumperRail.show(this.jumpers.onRail().map((j) => j.id));
          };
      // In and out through the big doors: they're on the +x side, so go through the doorway first (and back out through it after).
      const door = this.world.layout.jumperRail.door;
      if (!c.sneakTo(rail.stand, act, 2.6, { via: door.in, out: door.out })) this.jumpers.cancel(e.girl);
    }
  }

  // Red diesel by mistake ----------------------------------------------------

  /** Jess takes the diesel can to a low quad and pours it in; Amy, near enough to see, tells her off. */
  updateDieselMistake(dt, ridden) {
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const m = this.dieselMistake;
    const unitOf = (spec) => this.girlUnits.find((u) => u.spec.id === spec);
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob, x: c.root.position.x, z: c.root.position.z }));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      return { id: u.spec.id, x: q.position.x, z: q.position.z, speed: Math.abs(q.speed), rider: u === ridden, driver: this.quadUser(u, ridden) !== 'you' ? this.quadUser(u, ridden) : null, tipped: q.isTipped, space: q.fuel.space, level: q.fuel.level };
    });
    for (const e of m.update(dt, { girls, quads })) {
      const c = byId[e.girl];
      const quad = unitOf(e.spec).quad;
      const p = quad.localToWorld(c.nearSide(quad) * 0.85, 0, -0.95);
      const stay = m.p.pourSeconds + 1.6;
      const set = c.sneakTo({ x: p.x, z: p.z }, () => {
        if (quad.rider || quad.driver || Math.abs(quad.speed) > 0.3 || quad.isTipped) return m.finished();
        m.started();
        this.dieselJob = { spec: e.spec, left: m.p.pourSeconds, rate: m.p.litres / m.p.pourSeconds, girl: e.girl };
        c.voice.say('dieselPour', { urgent: true, chance: 0.9 });
        const amy = byId.amy;
        if (amy && amy !== c && amy.root.position.distanceTo(quad.position) < m.p.amyRange && Math.random() < m.p.amyChance) {
          setTimeout(() => {
            if (!this.dieselJob) return;
            if (amy.voice.say('dieselCaught', { force: true })) setTimeout(() => c.voice.say('dieselCaughtReply', { force: true }), 3500);
          }, 2500);
        }
      }, stay);
      if (!set) m.finished();
    }
    const job = this.dieselJob;
    if (job) {
      const u = unitOf(job.spec);
      const c = byId[job.girl];
      const stillThere = c.root.position.distanceTo(u.quad.position) < 3.5 && !u.quad.rider && !u.quad.driver && Math.abs(u.quad.speed) < 0.3;
      if (stillThere && job.left > 0) {
        job.left -= dt;
        u.quad.fuel.add(job.rate * dt, 0, 1);
      } else {
        this.dieselJob = null;
        m.finished();
      }
    }
  }

  // Nicking your quad ---------------------------------------------------------

  /** She takes this quad off for a while; Amy, if she sees it go, objects. */
  startNick(c, quad) {
    c.nickQuad(quad, { seconds: this.nicking.awayFor(), returnSpeed: this.nicking.p.returnSpeed });
    setTimeout(() => {
      const amy = this.companions.find((o) => o !== c && o.fsm.is('idle') && o.root.position.distanceTo(quad.position) < 60);
      amy?.voice.say('nickWatch', { urgent: true });
    }, 3000);
  }

  updateNicking(dt, ridden) {
    const np = this.nicking.p;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const quads = this.girlUnits.map((u) => {
      const q = u.quad;
      const claimed = this.companions.some((c) => c.quad === q && c.fsm.is('walking', 'starting'));
      return { id: u.spec.id, x: q.position.x, z: q.position.z, running: q.engine.isRunning, free: !q.rider && !q.driver && !q.passenger && !q.isTipped && !q.isGhostRiding && !this.herOn(q) && !claimed };
    });
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      x: c.root.position.x,
      z: c.root.position.z,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob,
      chance: c.params.nickChance ?? 0,
    }));
    const you = { x: this.player.position.x, z: this.player.position.z };
    for (const e of this.nicking.update(dt, { riding: ridden?.spec.id ?? null, you, quads, girls })) {
      const c = byId[e.girl];
      const quad = this.girlUnits.find((u) => u.spec.id === e.spec).quad;
      if (!c.takenByOther(quad, 'rider') && c.canDrive(quad)) this.startNick(c, quad);
    }
    // While she has it: tearing it up (the mud it comes back in), burning fuel, and laughing. A job that has come to nothing
    // (you got back on, or she gave up) is dropped.
    for (const c of this.companions) {
      const job = c.nickJob;
      if (!job) continue;
      if (c.fsm.is('idle', 'seated', 'resting')) {
        c.nickJob = null;
        continue;
      }
      if (job.phase !== 'away' || !c.fsm.is('driving')) continue;
      job.quad.churn = np.churn;
      job.quad.fuel.litres = Math.max(0, job.quad.fuel.litres - np.extraBurn * dt);
      job.laughed += dt;
      if (job.laughed > np.laughGap) {
        job.laughed = 0;
        c.voice.say('nickLaugh', { urgent: true, chance: 0.8 });
      }
    }
  }

  // The jump ------------------------------------------------------------------

  /** Whether the line from the run-up to well past the landing is free of parked quads, you and the other girl (not the quad she's going to take). */
  jumpLineClear(girl, ramp, jp) {
    const others = [...this.girlUnits.map((u) => u.quad.position), this.player.position, ...this.companions.filter((o) => o !== girl).map((o) => o.root.position)];
    for (let along = -jp.runUp; along <= ramp.length + 24; along += 3) {
      const pt = rampPoint(ramp, along);
      if (others.some((o) => Math.hypot(o.x - pt.x, o.z - pt.z) < 3)) return false;
    }
    return true;
  }

  updateJumps(dt) {
    const ramp = this.world.layout.jumpRamp;
    if (!ramp) return;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const jumper = this.companions.find((c) => c.fsm.is('driving') && c.drive?.jump);
    // New landings: the jumper has her own thing to say, the other girl rates it a moment later.
    for (const c of this.companions) {
      const run = c.fsm.is('driving') ? c.drive?.jump?.run : null;
      if (!run) {
        c.jumpSeen = 0;
        continue;
      }
      for (; (c.jumpSeen ?? 0) < run.results.length; c.jumpSeen = (c.jumpSeen ?? 0) + 1) {
        const r = run.results[c.jumpSeen];
        this.jumpWatch.landed(c.character.id, r.rating);
        this.lastJump = { girl: c.character.id, ...r };
        c.voice.say(`jumpLand_${r.rating}`, { urgent: true, force: r.rating === 'bail' });
      }
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt,
      distance: Math.hypot(c.root.position.x - ramp.x, c.root.position.z - ramp.z),
    }));
    for (const e of this.jumpWatch.update(dt, { jumper: jumper?.character.id ?? null, girls })) {
      const c = byId[e.girl];
      if (e.type === 'rate') c.voice.say(`jumpRate_${e.rating}`, { urgent: true });
      else if (e.type === 'turn') this.sendToRamp(c, 'jumpTurn');
    }
  }

  /** Sends a girl (who is stood about) to take a quad to the ramp. Returns whether she went. */
  sendToRamp(c, line) {
    if (!c.fsm.is('idle')) return false;
    const quads = this.girlUnits.filter((u) => c.mayRide(u.quad) && c.canDrive(u.quad) && !u.quad.tractor && !c.takenByOther(u.quad) && !this.herOn(u.quad) && u !== this.riddenUnit).map((u) => u.quad);
    quads.sort((a, b) => (c.ownsQuad(b) ? 1 : 0) - (c.ownsQuad(a) ? 1 : 0) || a.position.distanceTo(c.root.position) - b.position.distanceTo(c.root.position));
    const plan = c.jumpPlan();
    if (!quads.length || !plan) return false;
    if (line) c.voice.say(line, { force: true });
    setTimeout(() => {
      if (c.fsm.is('idle')) c.requestDrive(quads[0], { jump: plan });
    }, 2000);
    return true;
  }

  // The tarmac -----------------------------------------------------------------

  /** Jess egging you on and Amy telling you off for squealing the tyres, while you ride the farm road. */
  updateTarmac(dt) {
    const road = this.world.layout.road;
    const unit = this.riddenUnit;
    const q = unit?.quad;
    let you = null;
    if (q && road) {
      const v = q.physics.body.linvel();
      const forward = v.x * Math.sin(q.yaw) + v.z * Math.cos(q.yaw);
      const sideways = v.x * Math.cos(q.yaw) - v.z * Math.sin(q.yaw);
      const on = onTarmac(road, q.position.x, q.position.z);
      const speed = Math.abs(q.speed);
      you = { onRoad: on, speed, squeal: on ? squealLevel(this.world.squealParams, { tarmac: 1, slip: slipAngle(forward, sideways), speed, brake: q.brake ?? 0, spin: q.physics.traction?.spin ?? 0 }) : 0 };
    }
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt,
      role: c.fsm.is('driving') ? 'driving' : q && c.fsm.is('seated') && c.seatKind === 'pillion' && c.quad === q ? 'pillion' : null,
      onRoad: onTarmac(road, c.root.position.x, c.root.position.z),
      distance: q ? Math.hypot(c.root.position.x - q.position.x, c.root.position.z - q.position.z) : Infinity,
    }));
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    for (const e of this.tarmacWatch.update(dt, { you, girls })) byId[e.girl].voice.say(e.type === 'egg' ? 'roadEgg' : 'roadScold', { urgent: true });
  }

  // Doughnuts ----------------------------------------------------------------

  updateDoughnuts(dt) {
    const spinner = this.companions.find((c) => c.fsm.is('driving') && c.drive?.doughnut?.spinning);
    const girls = this.companions.map((c) => ({
      id: c.character.id,
      free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt,
      distance: spinner ? c.root.position.distanceTo(spinner.root.position) : Infinity,
    }));
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    for (const e of this.doughnutWatch.update(dt, { spinner: spinner?.character.id ?? null, girls })) {
      const c = byId[e.girl];
      if (e.type === 'watch') c.voice.say('doughnutWatch', { urgent: true });
      else if (e.type === 'join') {
        c.voice.say('doughnutJoin', { force: true });
        setTimeout(() => {
          if (!c.fsm.is('idle')) return;
          const quads = this.girlUnits.filter((u) => c.mayRide(u.quad) && c.canDrive(u.quad) && !c.takenByOther(u.quad) && !this.herOn(u.quad) && u !== this.riddenUnit).map((u) => u.quad);
          const quad = quads.find((q) => c.ownsQuad(q)) ?? quads[0];
          const plan = c.doughnutPlan(1.3);
          if (quad && plan) c.requestDrive(quad, { doughnut: plan });
        }, 2500);
      }
    }
    // The ground a quad has been torn up with stays marked for a good while, not the usual forty seconds.
    for (const u of this.girlUnits) {
      if (u.quad.churn > 0 && !u.torn) {
        u.torn = true;
        u.mud.ruts.uniforms.uGrassLife.value = 240;
        u.mud.ruts.uniforms.uGrassAlpha.value = 0.5;
      }
    }
  }

  // Follow the leader --------------------------------------------------------

  updateConvoy(dt, ridden) {
    const free = (c) => c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const girls = this.companions.map((c) => ({ id: c.character.id, free: free(c) }));
    this.updateRaceYou(dt, ridden);
    const options = {};
    for (const c of this.companions) {
      options[c.character.id] = this.girlUnits.filter((u) => u !== ridden && c.mayRide(u.quad) && c.canDrive(u.quad) && !c.takenByOther(u.quad) && !this.herOn(u.quad) && !u.quad.bog.stuck).map((u) => u.spec.id);
    }
    const cv = this.convoy;
    const later = (ms, fn) => setTimeout(fn, ms);
    // A girl who has stopped or finished driving ends it for both: nobody is left leading nobody.
    if (cv.active) {
      for (const id of Object.keys(cv.picks ?? {})) {
        const c = byId[id];
        const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling') || (cv.phase === 'forming' && c.fsm.is('dismounting'));
        this.convoyIdle[id] = busy ? 0 : (this.convoyIdle[id] ?? 0) + dt;
        const lost = c.drive?.done || this.convoyIdle[id] > 4 || (c.fsm.is('driving') && c.quad.rider);
        if (lost) {
          cv.stand();
          for (const o of this.companions) if (o.fsm.is('driving') && o.drive && !o.drive.done) o.drive.stop('bored');
          break;
        }
        if (cv.phase === 'forming') {
          const driving = c.fsm.is('driving') && c.drive && ['drive', 'settle'].includes(c.drive.phase) && (id !== cv.leader || c.drive.phase === 'drive');
          if (driving) cv.ready(id);
        }
      }
      // The follower has got ahead: they swap.
      const f = byId[cv.follower];
      if (cv.phase === 'running' && cv.passing && f?.drive?.pass?.phase === 'waiting') {
        const order = cv.passed();
        const nl = byId[order.leader];
        const ol = byId[order.follower];
        // The old leader follows the new one, who carries on in her own loops.
        ol.drive.follow = () => nl.quad;
        ol.drive.pass = null;
        ol.drive.waypoints = [];
        nl.drive.follow = null;
        nl.drive.pass = null;
        nl.drive.waypoints = [];
        nl.drive.index = 0;
        nl.drive.driveFor = 1e6;
        this.convoySwapped = { front: order.leader, back: order.follower };
      } else if (cv.phase === 'running' && cv.passing && f?.drive && !f.drive.pass) {
        cv.passFailed();
      }
    } else this.convoyIdle = {};
    for (const e of cv.update(dt, { girls, options, claims: this.ownership.claims, busy: this.race.active || this.drag.active || !!this.recalling || this.fallingOut.active })) {
      if (e.type === 'invite') {
        byId[e.leader].voice.say('convoyInvite', { force: true });
        later(3500, () => byId[e.follower]?.voice.say('convoyAccept', { force: true }));
        const quadOf = (id) => this.girlUnits.find((u) => u.spec.id === e.picks[id]).quad;
        byId[e.leader].requestDrive(quadOf(e.leader), { convoyLead: true });
        byId[e.follower].requestDrive(quadOf(e.follower), { follow: true, followWho: () => quadOf(e.leader) });
      } else if (e.type === 'swap') {
        // The follower is to overtake whoever is in front.
        const f = byId[e.follower];
        if (!f.drive?.startPass()) cv.passFailed();
      } else if (e.type === 'end') {
        for (const c of this.companions) if (c.fsm.is('driving') && c.drive && !c.drive.done) c.drive.endActivity();
      }
    }
  }

  // Racing ------------------------------------------------------------------

  /**
   * The lap as waypoints for a girl on her side of the track: a staging point `STAGE_BACK` metres behind the line (so she comes at the
   * grid along the track and ends up facing the right way), the grid point, then round the loop and back to the grid point.
   */
  raceRoute(lateral) {
    const L = this.world.layout;
    const h = this.world.heights;
    const hazards = [...this.world.bogHazards(), ...(h.puddles ?? []).map((p) => ({ x: p.x, z: p.z, radius: L.puddleRadius + 1.5 }))]; // a puddle at speed drowns the engine, so well clear
    const track = this.world.track;
    const at = (back) => {
      const s = track.sample(this.raceStart - back / track.totalLength);
      return { x: s.x - s.tz * lateral, z: s.z + s.tx * lateral };
    };
    return [at(RACE_STAGE_BACK), at(0), ...planLap(track, this.raceStart, hazards, { spacing: this.race.p.routeSpacing, margin: this.race.p.hazardMargin, lateral })];
  }

  /** Where you are for the race: on a quad or not, how near the start line, and whether you've sat still there. */
  raceYou(ridden) {
    const q = ridden?.quad;
    if (!q || !this.girlUnits.includes(ridden)) return { riding: null, near: false, still: false };
    const line = this.world.track.sample(this.raceStart);
    return {
      riding: ridden.spec.id,
      near: Math.hypot(q.position.x - line.x, q.position.z - line.z) < this.race.p.nearLine,
      still: Math.abs(q.forwardSpeed) < 1 && q.engine.isRunning,
    };
  }

  /** You ask the girls for a race, from the saddle near the start line. They start one as soon as both are free. */
  askForRace(ridden) {
    const you = this.raceYou(ridden);
    if (!you.riding) return this.hud.toast('You need to be on a quad to ask for a race', 2);
    // The two start lines can be within reach of each other: whichever you are nearer to is the one you mean.
    const lapLine = this.world.track.sample(this.raceStart);
    const q = ridden.quad;
    const toLap = Math.hypot(q.position.x - lapLine.x, q.position.z - lapLine.z);
    const strip = this.world.layout.dragStrip;
    const toStrip = Math.hypot(q.position.x - strip.x, q.position.z - strip.z);
    if (this.dragYou(ridden).near && (toStrip < toLap || !you.near)) return this.askForDrag(ridden);
    if (!you.near) return this.hud.toast('Ride up to the start line by the yard first', 2);
    if (this.race.active) return this.hud.toast('There is a race on already', 1.6);
    this.race.forced = true;
    this.hud.toast('Asking the girls for a race', 2);
  }

  /** Your part in a race: lined up on the grid, then your lap judged (npc/race.js). */
  updateRaceYou(dt, ridden) {
    const race = this.race;
    if (!race.active || !race.picks?.you) return void (this.youRun = null);
    const q = ridden?.quad;
    const line = this.world.track.sample(this.raceStart);
    const dist = q ? Math.hypot(q.position.x - line.x, q.position.z - line.z) : Infinity;
    if (race.phase === 'gather' || race.phase === 'countdown') {
      // Once lined up you may roll a little on a slope; the count-down only drops you if you really move off.
      const speed = q ? (race.ready.has('you') && Math.abs(q.forwardSpeed) < 2 ? 0 : q.forwardSpeed) : 9;
      const on = !!q && ridden.spec.id === race.picks.you && youOnGrid({ dist, speed, yaw: q.yaw }, Math.atan2(line.tx, line.tz), race.p);
      if (on && !race.ready.has('you')) {
        race.grid('you');
        this.hud.toast('On the line. Waiting for the girls', 2);
      } else if (!on) race.ungrid('you');
    } else if (race.phase === 'race') {
      this.youRun ??= new YouRun(this.raceStart, race.p);
      this.youClock = (this.youClock ?? 0) + dt;
      if (this.youClock < 0.2) return;
      const step = this.youClock;
      this.youClock = 0;
      const u = q ? nearestTrackFraction(this.world.track, q.position.x, q.position.z) : this.raceStart;
      const verdict = this.youRun.update(step, { riding: !!q && ridden.spec.id === race.picks.you, running: !!q && q.engine.isRunning, u, distToLine: dist });
      if (verdict === 'finish') race.finish('you');
      else if (verdict === 'out') race.abort('you');
    }
  }

  /**
   * The girls struggled to get onto the start line and face along it, so once one has arrived and is holding on the grid she is eased onto her
   * exact point and round to face the right way, over about a second, until the start. (Used by both the lap race and the drag race.)
   */
  helpOnGrid(dt) {
    if (!(this.race.phase === 'gather' || this.race.phase === 'countdown' || this.drag.phase === 'gather' || this.drag.phase === 'countdown')) return;
    for (const c of this.companions) {
      const race = c.drive?.race;
      if (!race || race.assistYaw === undefined || c.drive.phase !== 'grid') continue;
      const q = c.quad;
      const target = race.route[race.gridIndex];
      if (!q || !target || Math.abs(q.forwardSpeed) > 1.5) continue;
      const k = Math.min(1, dt * 2.5);
      const dx = target.x - q.position.x;
      const dz = target.z - q.position.z;
      const dist = Math.hypot(dx, dz);
      const off = Math.atan2(Math.sin(race.assistYaw - q.yaw), Math.cos(race.assistYaw - q.yaw));
      if (dist < 0.05 && Math.abs(off) < 0.02) continue;
      if (dist > 5) continue; // she's nowhere near it: not for this to fix
      q.placeAt(q.position.x + dx * k, q.position.z + dz * k, q.yaw + off * k);
    }
  }

  updateRace(dt, ridden) {
    if (this.drag.active && !this.race.active) return; // one race at a time
    const p = this.race.p;
    const free = (c) => c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot;
    const girls = this.companions.map((c) => ({ id: c.character.id, free: free(c) }));
    const options = {};
    for (const c of this.companions) {
      options[c.character.id] = this.girlUnits.filter((u) => u !== ridden && c.mayRide(u.quad) && c.canDrive(u.quad) && !c.takenByOther(u.quad) && !this.herOn(u.quad) && !u.quad.bog.stuck).map((u) => u.spec.id);
    }
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const later = (ms, fn) => setTimeout(fn, ms);
    // A racer who has stopped doing anything about it (told to do something else, say) is out, rather than holding it up.
    if (this.race.active && this.race.phase !== 'over') {
      for (const id of Object.keys(this.race.picks ?? {})) {
        const c = byId[id];
        if (!c) continue; // you
        const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling', 'dismounting') || !!c.drive?.race;
        this.raceIdle[id] = busy ? 0 : (this.raceIdle[id] ?? 0) + dt;
        if (this.raceIdle[id] > 4) this.race.abort(id);
      }
    } else this.raceIdle = {};
    for (const e of this.race.update(dt, { girls, options, claims: this.ownership.claims, you: this.raceYou(ridden) })) {
      if (e.type === 'invite') {
        byId[e.challenger].voice.say(e.youIn ? 'raceInviteYou' : 'raceInvite', { force: true });
        later(3500, () => byId[e.other]?.voice.say(e.youIn ? 'raceJoinYou' : 'raceAccept', { force: true }));
        if (e.youIn) this.hud.toast('Race: line up on the start line by the yard, pointing along the track', 4);
        let side = 1;
        for (const [id, spec] of Object.entries(e.picks)) {
          const c = byId[id];
          if (!c) continue; // you
          const quad = this.girlUnits.find((u) => u.spec.id === spec).quad;
          const confidence = c.driveConfidence ?? c.params.driveConfidence;
          const race = {
            route: this.raceRoute((e.youIn ? p.gridSpacing : 1.5) * side),
            gridIndex: 1,
            assistYaw: Math.atan2(this.world.track.sample(this.raceStart).tx, this.world.track.sample(this.raceStart).tz), // eased round on the grid (helpOnGrid), not driven round again
            cruise: p.cruiseBase + p.cruiseConfidence * confidence + (Math.random() * 2 - 1) * p.cruiseSpread,
            throttle: p.throttle,
            keepDriving: Math.random() < p.keepRidingChance,
            go: () => this.race.go(),
            alive: () => this.race.active,
            onGrid: () => this.race.grid(id),
            onFinish: () => this.race.finish(id),
            onAbort: () => this.race.abort(id),
          };
          side = -side;
          c.requestDrive(quad, { race });
        }
      } else if (e.type === 'countdown') byId[this.race.challenger]?.voice.say('raceCount', { force: true });
      else if (e.type === 'go') {
        if (this.race.picks.you) this.hud.toast('Go!', 1.2);
      } else if (e.type === 'youDropped') this.hud.toast('The girls are going without you', 2.5);
      else if (e.type === 'finish') {
        if (e.girl === 'you') {
          this.achievements.note('races');
          if (e.place === 1) this.achievements.note('raceWins');
        }
        if (e.girl === 'you') this.hud.toast(['', 'You won!', 'You came second', 'You came third'][e.place] ?? `You finished`, 3);
        else if (e.place === 1) byId[e.girl].voice.say(e.youIn ? 'raceBeatYou' : 'raceWin', { force: true });
        else later(2500, () => byId[e.girl]?.voice.say(e.ahead.includes('you') ? 'raceLoseToYou' : 'raceLose', { force: true }));
      } else if (e.type === 'out') {
        if (e.girl === 'you') this.hud.toast('You are out of the race', 2.5);
        else byId[e.girl]?.voice.say('raceOut', { force: true });
      } else if (e.type === 'result' && e.winner && e.loser) {
        this.raceResult = { winner: e.winner, loser: e.loser };
        this.noteFriction('race', e.loser);
      }
    }
  }

  // Drag racing --------------------------------------------------------------

  /** Where you are for the drag race: on a quad or not, how near the start line, how still, your throttle and which side of the strip's middle. */
  dragYou(ridden) {
    const q = ridden?.quad;
    if (!q || !this.girlUnits.includes(ridden)) return { riding: null, near: false, still: false, stalled: true, throttle: 0, across: 0 };
    const strip = this.world.layout.dragStrip;
    const f = stripFrame(strip, q.position.x, q.position.z);
    return {
      riding: ridden.spec.id,
      near: Math.hypot(f.along, f.across) < this.drag.p.nearStrip,
      still: Math.abs(q.forwardSpeed) < 1 && q.engine.isRunning,
      stalled: !q.engine.isRunning,
      throttle: q.throttle ?? 0,
      across: f.across,
    };
  }

  /** You ask one of the girls for a drag race, from the saddle near the strip's start. */
  askForDrag(ridden) {
    if (this.race.active || this.drag.active) return this.hud.toast('There is a race on already', 1.6);
    if (!this.dragYou(ridden).riding) return;
    this.drag.forced = true;
    this.hud.toast('Asking for a drag race', 2);
  }

  /** The route for a girl in the drag race: the staging point behind the line, her grid point, then down the strip and past the finish. */
  dragRoute(lane) {
    const s = this.world.layout.dragStrip;
    const back = this.drag.p.gridBack;
    return [stripPoint(s, -back - 10, lane), stripPoint(s, -back, lane), stripPoint(s, s.length + s.runOff * 0.7, lane)];
  }

  /** Your part in the drag race: lined up on your side of the grid, then how far down the strip you are. */
  updateDragYou(ridden) {
    const drag = this.drag;
    if (drag.phase !== 'gather' && drag.phase !== 'countdown') return;
    const q = ridden?.quad;
    const s = this.world.layout.dragStrip;
    const point = stripPoint(s, -drag.p.gridBack, -drag.lane * drag.p.laneOffset);
    const dist = q ? Math.hypot(q.position.x - point.x, q.position.z - point.z) : Infinity;
    // Once lined up you may roll a little on a slope; the count-down only drops you if you really move off.
    const speed = q ? (drag.ready.has('you') && Math.abs(q.forwardSpeed) < 2 ? 0 : q.forwardSpeed) : 9;
    const on = !!q && ridden.spec.id === drag.picks.you && onDragGrid({ dist, speed, yaw: q.yaw }, s.yaw, drag.p);
    if (on && !drag.ready.has('you')) {
      drag.grid('you');
      this.hud.toast('On the line. Waiting for her', 2);
    } else if (!on) drag.ungrid('you');
  }

  updateDrag(dt, ridden) {
    const drag = this.drag;
    const s = this.world.layout.dragStrip;
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const later = (ms, fn) => setTimeout(fn, ms);
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot }));
    const options = {};
    for (const c of this.companions) {
      options[c.character.id] = this.girlUnits.filter((u) => u !== ridden && c.mayRide(u.quad) && c.canDrive(u.quad) && !c.takenByOther(u.quad) && !this.herOn(u.quad) && !u.quad.bog.stuck).map((u) => u.spec.id);
    }
    // The girl racing you has stopped doing anything about it (told to do something else, say): she's out.
    if (drag.active && drag.phase !== 'over' && drag.girl) {
      const c = byId[drag.girl];
      const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling', 'dismounting') || !!c.drive?.race;
      this.dragIdle = busy ? 0 : this.dragIdle + dt;
      if (this.dragIdle > 4) drag.abort(drag.girl);
    } else this.dragIdle = 0;
    if (!drag.active) this.dragBlipSaid = false;
    else if (drag.phase === 'blip' && !this.dragBlipSaid) {
      this.dragBlipSaid = true;
      byId[drag.girl]?.voice.say('dragBlip', { force: true });
    }
    this.updateDragYou(ridden);
    const along = {};
    if (drag.phase === 'countdown' || drag.phase === 'race') {
      const mine = ridden?.quad;
      if (mine) along.you = stripFrame(s, mine.position.x, mine.position.z).along;
      const spec = drag.picks?.[drag.girl];
      const hers = this.girlUnits.find((u) => u.spec.id === spec)?.quad;
      if (hers) along[drag.girl] = stripFrame(s, hers.position.x, hers.position.z).along;
    }
    const race = (id, lane, spec) => ({
      route: this.dragRoute(lane),
      gridIndex: 1,
      assistYaw: s.yaw,
      cruise: 30, // flat out: the quad's power decides
      throttle: 1,
      keepDriving: Math.random() < this.race.p.keepRidingChance,
      go: () => drag.go(),
      alive: () => drag.active,
      onGrid: () => drag.grid(id),
      onFinish: () => drag.finish(id),
      onAbort: () => drag.abort(id),
    });
    for (const e of drag.update(dt, { girls, options, claims: this.ownership.claims, busy: this.race.active, you: this.dragYou(ridden), along, length: s.length })) {
      if (e.type === 'approach') {
        // Jess drives over to sit beside you.
        const q = ridden.quad;
        const side = { x: -Math.cos(q.yaw), z: Math.sin(q.yaw) };
        const beside = { x: q.position.x + side.x * 3.2, z: q.position.z + side.z * 3.2 };
        const quad = this.girlUnits.find((u) => u.spec.id === e.pick).quad;
        byId[e.girl].requestDrive(quad, {
          race: {
            route: [beside],
            gridIndex: 0,
            cruise: 9,
            throttle: 0.7,
            go: () => false,
            alive: () => drag.active,
            onGrid: () => drag.grid(e.girl),
            onFinish: () => {},
            onAbort: () => drag.abort(e.girl),
            blip: () => drag.blipping(),
          },
        });
      } else if (e.type === 'chicken') byId[e.girl]?.voice.say('dragChicken', { force: true });
      else if (e.type === 'invite') {
        const c = byId[e.girl];
        c.voice.say(e.blipped ? 'dragAccepted' : 'dragAsked', { force: true });
        this.hud.toast('Drag race: line up on your side of the start line, pointing along the strip', 4);
        const r = race(e.girl, e.lane * drag.p.laneOffset);
        const quad = this.girlUnits.find((u) => u.spec.id === e.picks[e.girl]).quad;
        if (c.fsm.is('driving') && c.drive && c.quad === quad) c.drive.reroute(r);
        else c.requestDrive(quad, { race: r });
      } else if (e.type === 'countdown') byId[drag.girl]?.voice.say('dragCount', { force: true });
      else if (e.type === 'falseStart') {
        byId[e.girl]?.voice.say('dragFalseStart', { force: true });
        this.hud.toast('False start. Back on the line', 2.5);
      } else if (e.type === 'go') this.hud.toast('Go!', 1.2);
      else if (e.type === 'finish') {
        if (e.id === 'you') {
          this.achievements.note('drags');
          if (e.place === 1) this.achievements.note('dragWins');
        }
        if (e.id === 'you') this.hud.toast(e.place === 1 ? 'You won!' : 'She won', 3);
        else if (e.place === 1) byId[e.id]?.voice.say('dragWin', { force: true });
        else later(2000, () => byId[e.id]?.voice.say('dragLose', { force: true }));
      } else if (e.type === 'out') {
        if (e.id === 'you') this.hud.toast('You are out of the race', 2.5);
        else byId[e.id]?.voice.say('dragOut', { force: true });
      } else if (e.type === 'cancel') this.hud.toast('Drag race called off', 2);
    }
  }

  // Pranks -----------------------------------------------------------------

  /** What the prank logic needs to know about the farm right now. */
  prankContext(ridden) {
    const at = (thing) => thing.model.getWorldPosition(new THREE.Vector3()); // it may be standing in the trailer
    const item = (thing, name) => ({ x: at(thing).x, z: at(thing).z, held: thing.held || !!thing.carried, home: this.itemHome[name] ?? thing.model.position });
    return {
      you: { x: this.player.position.x, z: this.player.position.z, riding: ridden?.spec.id ?? null },
      girls: this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !c.carrying && !this.menu.isOpen, mood: this.favour.mood(c.character.id) })),
      quads: this.girlUnits.map((u) => ({
        id: u.spec.id,
        x: u.quad.position.x,
        z: u.quad.position.z,
        taken: !!u.quad.rider || this.companions.some((c) => c.quad === u.quad && !c.fsm.is('idle')),
        running: u.quad.engine.isRunning,
        tap: u.quad.fuel.tap,
        choke: u.quad.choke,
        temperature: u.quad.engine.temperature,
      })),
      items: { can: item(this.petrolCan, 'can'), toolbox: item(this.toolbox, 'toolbox') },
      spots: this.world.layout.jerryCanSpots,
    };
  }

  updatePranks(dt, ridden) {
    for (const e of this.pranks.update(dt, this.prankContext(ridden))) {
      const a = e.prank;
      const girl = this.companions.find((c) => c.character.id === a.girl);
      if (e.type === 'start') this.startPrank(a, girl);
      else if (e.type === 'found') girl?.voice.say('prankGiggle', { force: true });
      else if (e.type === 'restore') {
        const thing = a.item === 'can' ? this.petrolCan : this.toolbox;
        const home = this.itemHome[a.item];
        if (home && !thing.held && !thing.carried) this.restoreItem(girl, thing, a.item, home);
      }
      if (e.type === 'resolved' || e.type === 'restore') delete this.itemHome[a.item];
    }
  }

  /** Time's up: she goes and fetches it back to where it was, or just puts it back if she's busy. */
  restoreItem(girl, thing, kind, home) {
    const put = () => {
      thing.putDown(home, home.yaw);
      if (home.y !== undefined) thing.model.position.y = home.y; // back on the bench, not under it
    };
    const at = thing.model.position;
    const from = girl?.root.position;
    const d = from ? Math.hypot(from.x - at.x, from.z - at.z) || 1 : 1;
    const spot = from ? { x: at.x + ((from.x - at.x) / d) * 0.55, z: at.z + ((from.z - at.z) / d) * 0.55 } : null;
    const act = () => {
      if (thing.held || thing.carried) return;
      if (!this.carryThing(girl, thing, kind, home, null)) put();
    };
    if (!girl || !spot || !girl.sneakTo(spot, act)) put();
  }

  /** She sets off to do it; it only happens if it's still fair game when she gets there. */
  startPrank(a, girl) {
    if (!girl) return this.pranks.cancel(a);
    const quad = a.quad ? this.girlUnits.find((u) => u.spec.id === a.quad).quad : null;
    const thing = a.item === 'can' ? this.petrolCan : a.item === 'toolbox' ? this.toolbox : null;
    const at = quad ? quad.position : thing.model.position;
    // Stops short of it, on her side (an arm's length from an item she's to pick up).
    const from = girl.root.position;
    const d = Math.hypot(from.x - at.x, from.z - at.z) || 1;
    const gap = quad ? 1.3 : 0.55;
    const spot = { x: at.x + ((from.x - at.x) / d) * gap, z: at.z + ((from.z - at.z) / d) * gap };
    const act = () => {
      if (quad) {
        if (quad.rider || quad.engine.isRunning) return this.pranks.cancel(a);
        if (a.kind === 'tap') quad.fuel.tap = 'off';
        else quad.choke = 1;
        this.pranks.apply(a);
        return;
      }
      if (thing.held || thing.carried) return this.pranks.cancel(a);
      this.itemHome[a.item] = { x: thing.model.position.x, z: thing.model.position.z, yaw: thing.model.rotation.y, y: thing.model.position.y };
      // She picks it up, carries it to where she's hiding it and sets it down there.
      const ok = this.carryThing(girl, thing, a.item, { x: a.spot.x, z: a.spot.z, yaw: Math.random() * Math.PI * 2 }, () => {
        if (this.pranks.active.includes(a)) this.pranks.apply(a);
        else delete this.itemHome[a.item];
      });
      if (!ok) this.pranks.cancel(a);
    };
    if (!girl.sneakTo(spot, act)) this.pranks.cancel(a);
  }

  /** The item as a girl carries it: 'can' or 'toolbox'. */
  carryWeightOf(thing, kind) {
    return kind === 'can' ? carryWeight('can', thing.litres, thing.params.capacity) : carryWeight('toolbox');
  }

  /**
   * She's at `thing` (a jerry can or the toolbox, standing on the ground): she picks it up, walks it to `dest` ({ x, z, yaw, y? }) and sets it down,
   * then `onDown()`. False if she can't take it. If she's called away on the way it's set down where she is.
   */
  carryThing(girl, thing, kind, dest, onDown) {
    const down = (pos, yaw) => {
      thing.carried = false;
      thing.putDown(pos, yaw);
      if (dest.y !== undefined && Math.hypot(pos.x - dest.x, pos.z - dest.z) < 0.01) thing.model.position.y = dest.y;
      onDown?.();
    };
    const started = girl.startCarry(kind, thing.model, this.carryWeightOf(thing, kind), {
      onLowered: down,
      onRaised: () => {
        // Walks up to it from wherever she is, stopping just short, and bends to set it down.
        const here = girl.root.position;
        const d = Math.hypot(here.x - dest.x, here.z - dest.z) || 1;
        const near = { x: dest.x + ((here.x - dest.x) / d) * 0.55, z: dest.z + ((here.z - dest.z) / d) * 0.55 };
        if (!girl.carryTo(near, () => girl.putDownCarry({ x: dest.x, y: dest.y, z: dest.z }, dest.yaw))) girl.dropCarry();
      },
    });
    if (started) thing.carried = true;
    return started;
  }

  /**
   * You ask her to do something. A neglected girl sometimes says no, but only
   * when her friend can take it on, so you're never left without: the friend
   * does it, and often gloats.
   */
  askHer(c, action) {
    const friend = c.others().find((o) => o.fsm.is('idle') && o.getActions(this.girlUnits.map((u) => u.quad)).find((x) => x.kind === action.kind && x.quad === action.quad));
    const refusable = ['giveRide', 'follow', 'drive', 'start', 'mount', 'mountRack'].includes(action.kind);
    if (friend && refusable && Math.random() < Math.max(this.favour.refuseChance(c.character.id), this.requests.refuseChance(c.character.id))) {
      c.voice.say('refuseRequest', { force: true });
      const take = friend.getActions(this.girlUnits.map((u) => u.quad)).find((x) => x.kind === action.kind && x.quad === action.quad);
      setTimeout(() => {
        take.run();
        if (Math.random() < this.favour.p.gloatChance) friend.voice.say('gloatTakeOver', { force: true });
        else friend.voice.onRequest(action.kind);
      }, 2200);
      return;
    }
    action.run();
    c.voice.onRequest(action.kind);
  }

  // Companion menu ---------------------------------------------------------

  openCompanionMenu(c) {
    // She's sat out or in the doorway: she gets up first (a moment, with a "hang on"), then you can talk.
    if (c.isResting) {
      if (c.leaveRest(() => this.openCompanionMenu(c))) c.selfEvents.push('restLeave');
      return;
    }
    if (c.isSeated && c.quad.speed > this.player.params.mountSpeed) {
      this.hud.toast('She can\'t get off while it\'s moving');
      return;
    }
    // Up on the tractor's wheel arch already: the one thing to ask is to come down.
    if (c.fsm.is('onTrailer') && this.tractorMount && c.trailer === this.tractorMount) {
      this.openWheel(`Ask ${c.name} to`, [this.tractorWheelOption(c)], c);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    if (c.fsm.is('onTrailer') && c.trailer === this.tipTrailer) {
      this.openWheel(`Ask ${c.name} to`, [this.tipTrailerWheelOption(c)], c);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    const ridingLandy = c.fsm.is('onTrailer') && Object.values(this.landys).find((l) => l.mount && l.mount === c.trailer);
    if (c.fsm.is('onTrailer') && c.trailer && (c.trailer === this.utvMount || ridingLandy)) {
      this.openWheel(`Ask ${c.name} to`, [c.trailer === this.utvMount ? this.utvWheelOption(c) : this.landyWheelOption(c, ridingLandy)], c);
      this.player.lookEnabled = false;
      this.player.moveEnabled = false;
      return;
    }
    const actions = c.getActions(this.girlUnits.map((u) => u.quad));
    if (!actions.length) {
      this.hud.toast('She\'s busy');
      return;
    }
    // She answers when you ask her something.
    const answer = (a) => () => this.askHer(c, a);
    // On the wheel: anything not about a particular quad, then a slice for each
    // quad (nearest her first) opening a ring of what she could do with it.
    const options = actions.filter((a) => !a.quad).map((a) => ({ label: a.label, run: answer(a) }));
    const push = this.pushStartOption(c);
    if (push) options.push(push);
    if (c.fsm.is('idle') && !this.readyWaiting.has(c.character.id)) options.push({ label: 'I\'ll be a minute', run: () => this.askToWait(c) });
    const tractor = this.tractorUnit && this.tractorWheelOption(c);
    if (tractor?.children.length) options.push(tractor);
    const utv = this.utvUnit && this.utvWheelOption(c);
    if (utv?.children.length) options.push(utv);
    for (const l of Object.values(this.landys)) {
      const landy = l.unit && this.landyWheelOption(c, l);
      if (landy?.children.length) options.push(landy);
    }
    const tipTrailer = this.tipTrailerWheelOption(c);
    if (tipTrailer.children.length) options.push(tipTrailer);
    for (const unit of [...new Set(actions.filter((a) => a.quad).map((a) => a.quad.unit))]) {
      const own = actions.filter((a) => a.quad === unit.quad);
      options.push({
        label: unit.name,
        color: unit.spec.bodyColor,
        hint: unit.quad === c.quad && c.isSeated ? 'she\'s on it' : null,
        children: own.map((a) => ({ label: a.short ?? a.label, run: answer(a) })),
      });
    }
    options.push(...this.fallingOutWheelOptions(c));
    options.push(...this.romanceWheelOptions(c));
    this.openWheel(`Ask ${c.name} to`, options, c);
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
  }

  /** Opens the companion wheel, putting the help away so it isn't showing through. */
  openWheel(title, options, her = null) {
    this.hud.toggleHelp(false);
    this.talkingTo = her; // only she answers, and only she stops what she was about to do
    if (her && this.banterWatch) this.banterWatch.noteTalk(her, this.companions);
    if (her) {
      // Caught out, she owns up as soon as you speak to her.
      const prank = this.pranks.unconfessed(her.character.id);
      if (prank) {
        this.pranks.confess(prank);
        her.voice.say('prankConfess', { force: true });
      } else this.remindOfFavour(her);
      this.favour.add(her.character.id, this.favour.p.talk);
      // Her friend stood there watching you talk to the other one.
      const jealous = this.banterWatch?.talked?.jealous;
      if (jealous) this.favour.add(jealous.character.id, -this.favour.p.ignored);
    }
    this.menu.open(title, options);
  }

  closeMenu() {
    if (this.menu.isOpen) this.menu.close();
    this.player.lookEnabled = true;
    this.player.moveEnabled = true;
  }

  // Riding ---------------------------------------------------------------

  toggleParkBrake(quad) {
    quad.parkBrake = !quad.parkBrake;
    if (quad.parkBrake) this.achievements.note('parkBrake');
  }

  mount(unit) {
    if (this.player.isRiding || this.tooFastToMount(unit.quad)) return;
    this.player.mount(unit.quad);
    this.favourQuad(unit, this.favour.p.favouriteQuad);
    unit.quad.setRider(this.player, this.input);
    this.lastUnit = unit;
    this.input.takeWheelSteps();
  }

  /** A moving quad you can't catch hold of (whether or not anyone is on it). */
  tooFastToMount(quad) {
    return quad.speed > this.player.params.mountSpeed;
  }

  /** The companion at the controls of this quad and still going, if any. */
  herDriving(quad) {
    return this.companions.find((c) => c.quad === quad && c.fsm.is('driving') && c.drive?.phase !== 'stop') ?? null;
  }

  tryDismount() {
    const quad = this.riddenUnit.quad;
    if (Math.abs(quad.forwardSpeed) > this.player.params.dismountSpeed) {
      this.jumpOff(quad);
      return;
    }
    const spot = this.findDismountSpot(quad);
    if (!spot) {
      this.hud.toast('No room to get off here');
      return;
    }
    const throttle = quad.throttle;
    quad.setRider(null, null);
    quad.lastLeft = { who: 'you', braked: quad.parkBrake };
    if (!quad.parkBrake && !this.handbrakeHinted) {
      this.handbrakeHinted = true;
      this.hud.toast('Space sets the parking brake, or it will roll off a slope', 3);
    }
    quad.holdRev(throttle); // still revving when you got off: it stays revving
    this.player.dismount(spot, quad.yaw + Math.PI);
  }

  /** A two-wheeler has gone down under you (bikeLean.js): thrown clear to the side it fell, the engine dead, and whoever's near has a word. */
  throwOff(unit) {
    const quad = unit.quad;
    const side = quad.bike.fallSide;
    const spot = this.findDismountSpot(quad, [[side * 1.1, -0.15], [-side * 1.1, -0.15], [0, -1.8]], 0.3);
    this.hud.toast(`You came off the ${unit.label}`, 2.5);
    if (!spot) return; // nowhere clear to land: you stay put, and T rights it
    const push = new THREE.Vector3(spot.x - quad.position.x, 0, spot.z - quad.position.z).normalize();
    const look = this.camera.getWorldDirection(new THREE.Vector3());
    const carry = quad.velocity;
    quad.setRider(null, null);
    quad.lastLeft = { who: 'you', braked: false };
    this.player.leapOff(spot, {
      yaw: Math.atan2(-look.x, -look.z),
      pitch: Math.asin(THREE.MathUtils.clamp(look.y, -1, 1)),
      carry,
      push,
      speed: Math.max(quad.speed, 6),
      collider: quad.physics.collider,
    });
    const near = this.companions.filter((c) => c.root.position.distanceTo(quad.position) < 40).sort((a, b) => a.root.position.distanceTo(quad.position) - b.root.position.distanceTo(quad.position))[0];
    near?.voice.say('youCameOff', { urgent: true });
  }

  /**
   * Getting off at speed: jump clear to the outside of the turn (or whichever
   * side is free) and let the quad carry on without you, throttle and bars
   * left where they were.
   */
  jumpOff(quad) {
    // Positive steer turns left, so the outside of the turn is the right (-x).
    const side = quad.steer > 0.02 ? -1 : 1;
    const spot = this.findDismountSpot(
      quad,
      [
        [side * 1.05, -0.15],
        [-side * 1.05, -0.15],
        [0, -1.8],
      ],
      0.3,
    );
    if (!spot) {
      this.hud.toast('No room to jump off here');
      return;
    }
    const throttle = quad.throttle;
    const speed = quad.speed;
    const carry = quad.velocity;
    const push = new THREE.Vector3(spot.x - quad.position.x, 0, spot.z - quad.position.z).normalize();
    // Keep looking wherever you were looking.
    const look = this.camera.getWorldDirection(new THREE.Vector3());
    quad.setRider(null, null);
    quad.lastLeft = { who: 'you', braked: false }; // jumped off at speed: no time for the brake
    quad.carryOn(throttle);
    this.player.leapOff(spot, {
      yaw: Math.atan2(-look.x, -look.z),
      pitch: Math.asin(THREE.MathUtils.clamp(look.y, -1, 1)),
      carry,
      push,
      speed,
      collider: quad.physics.collider,
    });
  }

  /**
   * Free spot beside the bike for the player's feet, trying each [x, z] offset
   * in chassis space in turn (default: left, right, behind, then in front).
   * `lift` raises the feet off the ground, for jumping off.
   */
  findDismountSpot(
    quad,
    candidates = [
      [1.0, -0.15],
      [-1.0, -0.15],
      [0, -1.7],
      [0, 1.8],
    ],
    lift = 0,
  ) {
    const RAPIER = this.RAPIER;
    const shape = new RAPIER.Capsule(PLAYER_CAPSULE.halfHeight, PLAYER_CAPSULE.radius);
    const terrain = this.world.terrain.collider;
    for (const c of candidates) {
      const [lx, lz] = clearOfChassis(c, quad.physics.layout?.chassis, quad.scale, PLAYER_CAPSULE.radius);
      const p = quad.localToWorld(lx, 0, lz);
      const feetY = this.world.heightAt(p.x, p.z) + 0.05 + lift;
      const centre = { x: p.x, y: feetY + PLAYER_CAPSULE.feetToCentre + 0.05, z: p.z };
      const hit = this.physics.intersectionWithShape(
        centre,
        { x: 0, y: 0, z: 0, w: 1 },
        shape,
        undefined,
        undefined,
        undefined,
        undefined,
        (collider) => collider.handle !== terrain.handle,
      );
      if (!hit) return new THREE.Vector3(p.x, feetY, p.z);
    }
    return null;
  }

  /** Puts the jerry can on the ground just in front of the player. */
  putCanDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    const spot = new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7);
    this.can.putDown(spot, yaw + Math.PI / 2);
  }

  /**
   * Stood looking at a four-stroke: Y pulls the dipstick and says where the oil is; holding it near the oil bottle (by the petrol tank)
   * pours some in, up to the top mark.
   */
  dipstick(unit, input, dt) {
    const sump = unit.quad.sump;
    if (!sump) {
      if (input.wasPressed('KeyY')) this.hud.toast('A two-stroke has no dipstick: its oil goes in with the petrol');
      return;
    }
    if (input.wasPressed('KeyY')) {
      this.yHeld = 0;
      const { text } = readStick(sump.level, Math.random() * 2 - 1, this.sumpParams);
      sump.checked = true;
      this.achievements.note('dipstick');
      this.hud.toast(`Dipstick: ${text}${sump.low ? '. Hold Y beside the oil bottle to top it up' : ''}`, 3);
      return;
    }
    if (!input.isDown('KeyY')) {
      this.yHeld = 0;
      return;
    }
    this.yHeld = (this.yHeld ?? 0) + dt;
    if (this.yHeld < 0.5) return;
    const bottle = this.oilBottle.worldPosition();
    const q = unit.quad.position;
    if (Math.hypot(q.x - bottle.x, q.z - bottle.z) > this.sumpParams.bottleRange) {
      if (this.yHeld < 0.6) this.hud.toast('The oil bottle is by the petrol tank: pick it up and bring it here', 2.5);
      return;
    }
    if (sump.pour(dt) > 0) {
      this.achievements.note('oilPoured');
      this.hud.setStatus(`Topping up the oil: ${readStick(sump.level, 0, this.sumpParams).text}`);
    } else if (this.yHeld < 0.6) this.hud.toast('Up to the top mark');
  }

  /**
   * Amy walks round a quad before she rides it: squeezes the tyres, looks it over and checks the dipstick, and tops it up if it wants some,
   * saying what she finds. Jess goes straight to the starter. Once per ride. `c.walkFound` keeps what she found, for the girls to act on later.
   */
  updateOilChecks() {
    for (const c of this.companions) {
      const driving = c.fsm.is('driving');
      if (!driving) {
        c.oilChecked = null;
        continue;
      }
      if (!c.quad || c.oilChecked === c.quad) continue;
      c.oilChecked = c.quad;
      c.walkFound = [];
      const driven = this.units.find((u) => u.quad === c.quad);
      if (c.character.id !== 'amy') continue;
      if (Math.random() < this.walkParams.amyWalks) {
        c.walkFound = walkRound({ tyres: c.quad.tyres, faults: c.quad.faults }, this.walkParams);
        if (driven) c.knows.learn(driven.spec.id, c.walkFound);
        const refused = driven ? c.wontRide(c.quad) : null;
        if (refused && !this.eventOn()) {
          // Not on that: she says why instead of the usual remark, pulls up and gets off.
          c.voice.say(WONT_LINE[refused], { urgent: true, chance: 1 });
          c.requestStandBeside(c.quad);
          if (driven) for (const finding of c.walkFound) this.notebook.note(driven, { kind: 'walk', finding }, { saw: true });
          continue;
        } else {
          c.walkFound.forEach((key, i) => c.voice.say(key, { urgent: i === 0, chance: 1 }));
        }
        if (driven) for (const finding of c.walkFound) this.notebook.note(driven, { kind: 'walk', finding }, { saw: true });
      }
      const sump = c.quad.sump;
      if (!sump || Math.random() > this.sumpParams.amyChecks) continue;
      if (sump.level < this.sumpParams.minMark + this.sumpParams.amyTopUpMargin) {
        sump.fill();
        c.voice.say('oilTopUp', { urgent: true, chance: 1 });
        if (driven) this.notebook.note(driven, { kind: 'oil' }, { saw: true });
      } else if (!c.walkFound.length) {
        c.voice.say('oilFine', { chance: 0.35 });
      }
    }
  }

  /** A race, drag race, follow the leader or recall is on, so a girl shouldn't walk out of it. */
  eventOn() {
    return this.race.active || this.drag.active || this.convoy.active || !!this.recalling;
  }

  /** E on a quad with the jump leads in hand. */
  clampLeads(quad) {
    this.achievements.note('leads');
    const result = this.leads.clamp(quad);
    if (result === 'first') this.hud.toast('Clamped on. Now the other end on a running quad');
    else if (result === 'joined') this.hud.toast('Leads on: a running quad charges a flat one. Keep them close, nose to nose');
  }

  putLeadsDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.leads.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  /** The toolbox, jump leads or oil bottle in your hands, which the workbench has a place for: { name, item, spot }, or null. */
  benchItem() {
    const L = this.world.layout;
    if (this.toolbox.held) return { name: 'toolbox', item: this.toolbox, spot: L.toolbox };
    if (this.leads.held) return { name: 'jump leads', item: this.leads, spot: L.benchLeads };
    if (this.oilBottle.held) return { name: 'oil bottle', item: this.oilBottle, spot: L.benchOil };
    return null;
  }

  /** E at the workbench with the toolbox or the leads in your hands: back in their place on top of it. */
  putOnBench({ item, spot }) {
    item.putDown(new THREE.Vector3(spot.x, 0, spot.z), spot.yaw);
    item.model.position.y += this.world.layout.bench.height;
  }

  putOilBottleDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.oilBottle.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  putToolboxDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.toolbox.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  // The bucket list ----------------------------------------------------------

  achievementUnlocked(a) {
    this.hud.toast(`\u2713 ${a.name}  (+${a.points})`, 3.5);
    this.audioHub.chime();
    if (this.hud.bucketOpen) this.showBucketList();
  }

  showBucketList() {
    this.bucketPages = paginate(this.achievements.entries());
    const shown = this.hud.showBucket(this.bucketPages, this.achievements.score(), this.bucketSpread ?? 0);
    this.bucketSpread = shown.spread;
    this.bucketSpreads = shown.count;
  }

  /** Turns the notebook's page (+1 forward, -1 back). */
  turnBucketPage(by) {
    this.bucketSpread = Math.max(0, Math.min((this.bucketSpread ?? 0) + by, (this.bucketSpreads ?? 1) - 1));
    this.showBucketList();
  }

  toggleBucketList() {
    if (this.hud.bucketOpen) this.hud.hideBucket();
    else this.showBucketList();
  }

  updateAchievements(dt, ridden) {
    this.achievements.update(dt, achievementSnapshot(this, ridden));
  }

  // Loop -----------------------------------------------------------------

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), MAX_FRAME_DT);
    const input = this.input;
    // Paused: draw the farm as it stands behind the card and nothing else, so no time passes for anything. The very first frame runs
    // regardless, so the camera is put at your eyes and everything is placed before the start screen shows the farm behind it.
    this.setPaused(this.isPaused());
    if (this.paused && this.firstFrameDone) {
      this.renderer.render(this.scene, this.camera);
      input.endFrame();
      return;
    }

    if (input.wasPressed('KeyH')) this.hud.toggleHelp();
    if (input.wasPressed('Backquote')) this.debugGui.toggle();
    if ((input.wasPressed('Backslash') || input.wasPressed('IntlBackslash')) && !this.console.visible) this.console.open();
    if (input.wasPressed('KeyJ')) this.toggleHitch();
    if (input.wasPressed('Enter') && !this.menu.isOpen && this.player.isRiding) this.askForRace(this.riddenUnit);
    if (input.wasPressed('KeyM') && !this.workshop.isOpen) {
      this.farmMap.toggle();
      this.achievements.note('map');
    }
    if (input.wasPressed('Tab')) this.toggleBucketList();
    if (this.hud.bucketOpen) {
      if (input.wasPressed('ArrowRight')) this.turnBucketPage(1);
      if (input.wasPressed('ArrowLeft')) this.turnBucketPage(-1);
    }
    if (input.wasPressed('KeyN')) {
      this.audioHub.params.muted = !this.audioHub.params.muted;
      this.hud.toast(this.audioHub.params.muted ? 'Sound off' : 'Sound on', 1.2);
    }

    for (const unit of this.units) {
      unit.quad.setRemote(null);
      unit.quad.pushDir = 0;
    }
    let pouring = false;
    this.washing = null;
    if (this.menu.isOpen) {
      this.menu.handleInput(input);
      if (!this.menu.isOpen) this.closeMenu();
    } else if (this.player.isRiding && this.player.seat === 'pillion') {
      // On the back: E to talk to her about the ride.
      this.interaction.clear();
      if (input.wasPressed('KeyE')) this.openPassengerMenu();
    } else if (this.player.isRiding) {
      this.interaction.clear();
      this.riddenUnit.quad.handleFrameInput(dt);
      if (this.riddenUnit.quad.bike?.takeFall()) this.throwOff(this.riddenUnit);
      else {
        if (input.wasPressed('Space')) this.toggleParkBrake(this.riddenUnit.quad);
        if (input.wasPressed('KeyE')) this.tryDismount();
      }
    } else if (this.workshop.isOpen) {
      this.workshop.handleInput(input);
    } else if (this.bench.isOpen) {
      this.interaction.clear();
      this.bench.handleInput(input);
    } else if (this.notebook.isOpen) {
      this.interaction.clear();
      this.notebook.handleInput(input);
    } else if (this.climb || this.tryst) {
      this.interaction.clear();
      input.takeWheelSteps();
    } else if (this.hiding.active) {
      // Hidden in the hay: any key or E gets you up again.
      this.interaction.clear();
      input.takeWheelSteps();
      if (['KeyE', 'KeyG', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].some((k) => input.wasPressed(k))) this.stopHiding();
    } else {
      input.takeWheelSteps();
      const focused = this.interaction.update(this.player, this.player.params.interactRange);
      // Looking at a quad lets you work its ignition, starter and choke from beside it.
      if (focused?.unit) {
        focused.unit.quad.setRemote(input);
        focused.unit.quad.handleFrameInput(dt);
        this.dipstick(focused.unit, input, dt);
        this.lastUnit = focused.unit;
      }
      if (focused && input.wasPressed('KeyE')) focused.interact();
      this.pushOnFoot(input, focused?.unit);
      // B: sit on the back of a quad with nobody driving; sooner or later a girl comes and takes you for a ride.
      if (focused?.unit && input.wasPressed('KeyB') && this.canSitOnBack(focused.unit.quad)) {
        if (focused.unit.quad.hasBench) this.mountBench(focused.unit);
        else this.mountPillion(focused.unit);
      }
      // Holding E pours fuel or fills the can.
      this.wrongMix = null;
      if (focused?.hold && input.isDown('KeyE') && focused.hold(dt)) pouring = true;
      // The winch: X takes the hook off the green (looking at it), or puts it back.
      if (this.winch && input.wasPressed('KeyX')) {
        const w = this.winch;
        if (w.state === 'stowed' && focused?.unit === w.unit && !this.handsFull) w.take(this.camera);
        else if (w.state === 'carried') w.stow();
      }
      // The tow chain: X takes it off the tractor's drawbar (looking at the tractor), or puts it back.
      if (input.wasPressed('KeyX') && !this.player.isRiding) {
        const c = this.chain;
        if (!c) {
          // no tractor this game
        } else if (c.state === 'stowed' && focused?.unit === this.tractorUnit && !this.handsFull) {
          if (this.trailer.hitched) this.hud.toast('Unhitch the trailer first: the chain goes on the same drawbar', 2.4);
          else c.take(this.camera);
        } else if (c.state === 'carried') c.stow();
      }
      if (this.hose.held && input.wasPressed('KeyG')) this.hose.putBack();
      else if (this.can.held && input.wasPressed('KeyG')) this.putCanDown();
      else if (this.toolbox.held && input.wasPressed('KeyG')) this.putToolboxDown();
      else if (this.leads.held && input.wasPressed('KeyG')) this.putLeadsDown();
      else if (this.oilBottle.held && input.wasPressed('KeyG')) this.putOilBottleDown();
    }

    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    const alpha = this.accumulator / FIXED_DT;

    this.updatePassenger();
    this.updateRideOffer(dt);
    for (const unit of this.units) unit.listenerOnBoard = unit === this.boardUnit;
    for (const unit of this.units) unit.update(dt, alpha);
    const ridden = this.riddenUnit;
    this.talkFloor.left = Math.max(0, this.talkFloor.left - dt);
    this.updateFavour(dt, ridden);
    this.updateWearLedger(dt);
    this.updateCarbDrip(dt);
    this.updateCoolantLeak(dt);
    this.updateQuirks(dt, ridden);
    this.updateOilChecks();
    this.updateHandbrake(dt);
    this.updateFourWd(dt);
    this.skills.update(dt);
    this.updatePillionCoach(dt);
    // With the girls' autonomy off (console: girls.autonomy) nothing new starts on their own; what is under way carries on.
    const auto = this.girlsAuto;
    if (auto) {
      this.updateRequests(dt, ridden);
      this.updatePlaces(dt);
      this.updatePranks(dt, ridden);
      this.updateRevOff(dt, ridden);
    }
    this.updateHorns(dt, ridden);
    if (this.tractorUnit) this.updateTractorWatch(dt);
    if (this.tractorUnit) this.updateTractorRunaway(dt, ridden);
    this.updateHayRide(dt, ridden);
    if (this.tractorUnit) this.updateMudguard(dt, ridden);
    if (this.utvUnit) this.updateUtv(dt, ridden, input);
    for (const l of Object.values(this.landys)) if (l.unit) this.updateLandRover(dt, ridden, input, l);
    this.updateTipTrailer(dt, ridden, input);
    if (GO_KINDS.some((k) => this.goVehicle(k)) && auto) this.updateTractorGo(dt, ridden);
    this.updateLPlates(dt);
    this.updatePushStart();
    this.updateQuadTalk(dt, ridden);
    this.updateWarming(dt);
    if (auto || this.sulking.who) this.updateCabShelter(dt, !auto);
    if (auto || this.sulking.who) this.updateSulking(dt);
    this.updateReady(dt);
    this.updateWarmSit(dt, ridden);
    this.updateSeatSlams();
    if (auto) this.updateKeepAlive(dt);
    if (auto) this.updateHeadStart(dt, ridden);
    this.updateDoughnuts(dt);
    this.updateTarmac(dt);
    this.updateJumps(dt);
    if (auto) this.updateNicking(dt, ridden);
    if (auto || this.tea.forced) this.updateTea(dt, ridden);
    if (auto) this.updateJumpers(dt);
    if (auto || this.dieselMistake.forced) this.updateDieselMistake(dt, ridden);
    this.bell.update(dt);
    this.updateRecall(dt);
    if (!this.recalling && (auto || this.convoy.active || this.convoy.forced)) this.updateConvoy(dt, ridden);
    this.updateDashReading(dt, ridden);
    if (!this.recalling && (auto || this.race.active || this.race.forced)) this.updateRace(dt, ridden);
    if (!this.recalling && (auto || this.drag.active || this.drag.forced)) this.updateDrag(dt, ridden);
    this.helpOnGrid(dt);
    this.updateSmokeSense(dt);
    this.updateDustClouds();
    this.updateFaultShout(dt);
    this.updateHaze(dt);
    this.updateBarnFumes(dt);
    this.updateThrottleGrab(dt, ridden);
    if (auto) this.updateRockPrank(dt);
    this.updateDrownOut(dt);
    if (auto || this.fallingOut.active) this.updateFallingOut(dt);
    if (auto || this.tryst) this.updateRomance(dt);
    this.updateBanter(dt, ridden);
    for (const c of this.companions) {
      c.update(dt, c.quad.unit.vibration, {
        position: this.camera.position,
        forward: this.camera.getWorldDirection(this.viewForward),
        isRiding: this.player.isRiding,
        talking: (this.menu.isOpen && this.talkingTo === c) || this.tryst?.girl === c,
      });
      c.sounds.ensure();
      c.voice.update(dt, {
        listener: this.camera.position,
        ridden,
        units: this.girlUnits,
        drivers: this.drivers,
        ledger: this.wearLedger,
        left: this.leftRunning,
        drip: this.carbDrip,
        coolantPatches: this.coolantPatches,
        history: this.history,
        menuOpen: this.menu.isOpen,
        talkingToHer: this.menu.isOpen && this.talkingTo === c,
        weather: this.weather,
        pouring,
        wrongMix: pouring ? this.wrongMix : null,
      });
    }
    const board = this.boardUnit;
    if (!this.debugCamera) this.player.update(dt, alpha, board ? board.vibration : null);
    this.can.pouring = pouring;
    this.petrolCan.update(dt);
    this.premixCan.update(dt);
    this.dieselCan.update(dt);
    this.updateHose(dt);
    this.updateWinch();
    this.updateChain();
    this.workshop.update(dt);
    this.bench.update(dt);
    this.updateBarnFind(dt);
    this.notebook.update(dt);
    this.updateLoft(dt);
    this.audioHub.setPouring(pouring, dt);
    this.audioHub.update(dt, this.camera);
    this.rideWind.update(dt, board ? board.quad.speed : 0);
    this.world.update(dt, board ? board.quad.position : this.player.position, this.camera);
    this.updateWeather(dt);
    this.updateAchievements(dt, ridden);
    this.updateHud(dt);

    this.renderer.render(this.scene, this.camera);
    input.endFrame();
    this.firstFrameDone = true;
  }

  fixedUpdate(dt) {
    this.player.fixedUpdate(dt);
    this.winch?.fixedUpdate(dt, this.winchReel);
    this.chain?.fixedUpdate(dt);
    if (this.leads.update(dt, this.camera.position) === 'pulledOff') this.hud.toast('The jump leads came off');
    for (const unit of this.units) {
      unit.quad.backRider = !!this.herOnBack(unit.quad);
      unit.fixedUpdate(dt);
    }
    this.physics.step();
    for (const unit of this.units) unit.recordTransform();
  }

  updateHud(dt) {
    const f = this.interaction.focused;
    // A prompt is either an E action (a string) or plain text ({ text }).
    let p = f ? f.prompt() : '';
    if (this.player.isRiding && this.player.seat === 'pillion' && !this.menu.isOpen) {
      const her = this.herOn(this.boardUnit.quad);
      p = { action: her ? `Talk to ${her.name}` : 'Get off', keys: [['C', 'Look back']] };
    }
    // On the back you're a passenger: no crosshair or prompt, just the view (the help panel says E and C).
    const onBack = this.player.isRiding && this.player.seat === 'pillion' && !this.menu.isOpen;
    this.hud.setCrosshairVisible(!onBack);
    if (onBack) p = '';
    this.hud.setPrompt(typeof p === 'string' ? (p ? { action: p } : null) : p.action ? p : p.text);
    // No readout for the quad: its dash is all you get.
    if (this.chain?.state === 'carried') {
      this.hud.setStatus('Tow chain\nE on a quad to hook it on, X to put it back\nThen drive the tractor off, forwards');
    } else if (this.winch?.state === 'carried') {
      this.hud.setStatus('Winch hook\nE on a quad to hook it on, X to put it back');
    } else if (this.hose.held) {
      this.hud.setStatus('Hose\nHold E to spray, G to put it back');
    } else if (this.leads.held) {
      this.hud.setStatus('Jump leads\nE on a quad to clamp one end, then another quad for the other\nG to put them down');
    } else if (this.oilBottle.held) {
      this.hud.setStatus('Oil bottle\nY at a four-stroke to top up its oil, near it\nG to put it down');
    } else if (this.toolbox.held) {
      this.hud.setStatus('Toolbox\nTake it to a quad that is switched off\nG to put it down');
    } else if (this.can.held) {
      this.hud.setStatus(`Jerry can  ${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${fuelText(this.can.oil, this.can.diesel)}\nG to put it down`);
    } else if (this.tractorUnit && this.riddenUnit === this.tractorUnit && this.trailer.canHitch(this.tractorUnit.quad)) {
      this.hud.setStatus('The drawbar is at the trailer\'s ring\nJ to hitch it on');
    } else if (this.riddenUnit && this.tipTrailer.canHitch(this.riddenUnit.quad)) {
      this.hud.setStatus('The hitch is at the trailer\'s ring\nJ to hitch it on');
    } else if (this.riddenUnit && this.tipTrailer.puller === this.riddenUnit.quad && this.riddenUnit.quad.speed < 0.8) {
      this.hud.setStatus('Trailer hitched\nT to tip it, J to unhitch');
    } else {
      this.hud.setStatus('');
    }
    // Anything the tractor has to say (the starter in gear, a gear change without the clutch) to whoever's at it.
    for (const u of this.units) {
      const note = u.quad.takeNote();
      if (note && (u === this.riddenUnit || u.quad.position.distanceTo(this.player.position) < 6)) this.hud.toast(note, 2.2);
    }
    this.hud.update(dt);
    if (this.farmMap.isOpen) this.farmMap.draw(this.mapMarkers());
  }

  /** You, the girls, the vehicles, the trailers and the things you carry about, for the farm map. */
  mapMarkers() {
    const v = this.mapVec ??= new THREE.Vector3();
    const d = this.mapDir ??= new THREE.Vector3();
    const at = (obj) => obj.getWorldPosition(v);
    const yawOf = (obj) => (obj.getWorldDirection(d), Math.atan2(d.x, d.z));
    const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
    const markers = [];
    this.camera.getWorldPosition(v);
    this.camera.getWorldDirection(d);
    markers.push({ kind: 'you', x: v.x, z: v.z, yaw: Math.atan2(d.x, d.z), label: 'You' });
    this.companions.forEach((c, i) => {
      const ch = CHARACTERS[i];
      at(c.root);
      markers.push({ kind: 'girl', x: v.x, z: v.z, colour: ch.mapColour, label: ch.name, short: ch.name[0] });
    });
    const big = new Set(['tractor', 'utv', 'landrover', 'landrover200']);
    for (const u of this.units) {
      const q = u.quad;
      const hidden = u.barnFind && !u.barnFind.tarpOff;
      markers.push({
        kind: 'vehicle', x: q.position.x, z: q.position.z, yaw: q.yaw, big: big.has(u.spec.id),
        colour: hidden ? '#8b8270' : hex(u.spec.bodyColor), label: hidden ? 'Under the tarp' : u.spec.name,
      });
    }
    for (const [t, label] of [[this.trailer, 'Bale trailer'], [this.tipTrailer, 'Tipping trailer']]) {
      at(t.model);
      markers.push({ kind: 'trailer', x: v.x, z: v.z, yaw: yawOf(t.model), colour: '#9a9a96', label });
    }
    const items = [
      [this.petrolCan, '#b8241c', 'Petrol can'],
      [this.premixCan, hex(PREMIX_CAN_COLOURS.colour), 'Pre-mix can'],
      [this.dieselCan, hex(DIESEL_CAN_COLOURS.colour), 'Diesel can'],
      [this.toolbox, '#c8452c', 'Toolbox'],
      [this.leads, '#222222', 'Jump leads'],
      [this.oilBottle, '#e8e2c8', 'Oil bottle'],
    ];
    for (const [item, colour, label] of items) {
      at(item.model);
      markers.push({ kind: 'item', x: v.x, z: v.z, colour, label });
    }
    return markers;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.updateSmokeScale();
  }

  updateSmokeScale() {
    for (const unit of this.units ?? []) unit.setViewport(window.innerHeight * this.renderer.getPixelRatio(), this.camera.fov);
  }
}

import * as THREE from 'three';
import { Input } from './core/input.js';
import { createRandom, startSeed } from './core/random.js';
import { randomiseQuadSpawns, randomJerryCanSpot } from './world/spawns.js';
import { registerTuning } from './core/tuning.js';
import { loadModels } from './world/assets.js';
import { World } from './world/world.js';
import { Player, PLAYER_CAPSULE } from './player/player.js';
import { DEFAULT_PLAYER_PARAMS, PLAYER_PARAM_RANGES } from './player/playerParams.js';
import { QuadUnit } from './vehicle/quadUnit.js';
import { QUAD_SPECS, EXTRA_SPECS, TRACTOR_SPEC } from './vehicle/quadSpecs.js';
import { pickFleet } from './vehicle/fleet.js';
import { applyIdle, applyTopRpm, applyVariation, pickIdle } from './vehicle/quadVariation.js';
import { AudioHub } from './audio/engineAudio.js';
import { RideWind } from './audio/rideAudio.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from './audio/audioParams.js';
import { Companion } from './npc/companion.js';
import { CompanionVoice } from './npc/companionVoice.js';
import { Speech, CompanionSounds } from './audio/companionAudio.js';
import { DEFAULT_COMPANION_PARAMS, COMPANION_PARAM_RANGES } from './npc/companionParams.js';
import { PILLION_PARAM_RANGES } from './npc/pillionParams.js';
import { CHARACTERS } from './npc/characters.js';
import { Favour, FAVOUR_PARAM_RANGES } from './npc/favour.js';
import { pickHistory, pickFaultChance } from './vehicle/history.js';
import { TyreSet, dealTyres, DEFAULT_TYRE_PARAMS, TYRE_PARAM_RANGES } from './vehicle/tyres.js';
import { pushDirection, localAlong } from './vehicle/controls.js';
import { RollWatch, rollReactions, DEFAULT_HANDBRAKE_PARAMS, HANDBRAKE_PARAM_RANGES } from './vehicle/handbrake.js';
import { HEADLIGHT_PARAMS, HEADLIGHT_PARAM_RANGES } from './vehicle/headlight.js';
import { describeVehicle } from './debug/startReport.js';
import { QuirkSet, DEFAULT_QUIRK_PARAMS, QUIRK_PARAM_RANGES, featuresOf, pickQuirks } from './vehicle/quirks.js';
import { captureStock, tuneTarget, stockSettings, clampSettings, applyTune } from './vehicle/tuneUp.js';
import { WearLedger, LEDGER_PARAM_RANGES } from './engine/wearLedger.js';
import { Pranks, PRANK_PARAM_RANGES } from './npc/pranks.js';
import { RevOff, REVOFF_PARAM_RANGES } from './npc/revOff.js';
import { Horns, HORN_PARAM_RANGES } from './npc/horns.js';
import { TractorWatch, TRACTOR_WATCH_PARAM_RANGES } from './npc/tractorWatch.js';
import { HayRide, HAYRIDE_PARAM_RANGES } from './npc/hayRide.js';
import { MudguardRide, MUDGUARD_PARAM_RANGES } from './npc/mudguardRide.js';
import { TractorMount } from './vehicle/tractorMount.js';
import { TractorGo, TRACTORGO_PARAM_RANGES } from './npc/tractorGo.js';
import { LPlates, LPLATE_PARAM_RANGES, meanSkill } from './npc/lPlates.js';
import { LPlateSet } from './vehicle/lPlateModel.js';
import { TractorRunaway, TRACTOR_RUNAWAY_PARAM_RANGES } from './npc/tractorRunaway.js';
import { DEFAULT_CREEP_PARAMS, CREEP_PARAM_RANGES, distanceToHedge } from './vehicle/creep.js';
import { DEFAULT_TRACTOR_GO_DRIVE, TRACTOR_GO_DRIVE_RANGES } from './npc/companionDriving.js';
import { DEFAULT_TRACTOR_START_PARAMS, TRACTOR_START_PARAM_RANGES } from './npc/tractorStart.js';
import { DEFAULT_NOVICE_PARAMS, NOVICE_PARAM_RANGES } from './vehicle/autoShifter.js';
import { HAYSEAT_PARAM_RANGES, DEFAULT_HAYSEAT_PARAMS } from './npc/companionHayRide.js';
import { HayTrailer } from './vehicle/hayTrailer.js';
import { TRAILER_PARAM_RANGES } from './vehicle/trailer.js';
import { QuadNames, NAME_PARAM_RANGES, quadKey } from './npc/quadNames.js';
import { Ownership, OWNERSHIP_PARAM_RANGES } from './npc/ownership.js';
import { Hearing, EAR_PARAM_RANGES } from './npc/earing.js';
import { Warming, WARMING_PARAM_RANGES, isChilly } from './npc/warming.js';
import { HeadStart, HEADSTART_PARAM_RANGES } from './npc/headStart.js';
import { Gossip, GOSSIP_PARAM_RANGES } from './npc/gossip.js';
import { ThrottleGrab, GRAB_PARAM_RANGES } from './npc/throttleGrab.js';
import { SmokeSense, SMOKE_PARAM_RANGES } from './npc/smokeSense.js';
import { Haze, HAZE_PARAM_RANGES } from './world/haze.js';
import { HazeLayer } from './effects/hazeLayer.js';
import { Race, RACE_PARAM_RANGES, planLap } from './npc/race.js';
import { DashReader, READING_PARAM_RANGES } from './npc/dashReading.js';
import { Convoy, CONVOY_PARAM_RANGES } from './npc/convoy.js';
import { DoughnutWatch, DOUGHNUT_PARAM_RANGES } from './npc/doughnuts.js';
import { DEFAULT_SHOWOFF_PARAMS, SHOWOFF_PARAM_RANGES } from './npc/showOff.js';
import { JumpWatch, JUMP_PARAM_RANGES, rampPoint } from './npc/jumps.js';
import { Nicking, NICK_PARAM_RANGES } from './npc/nicking.js';
import { DEFAULT_LINEUP_PARAMS, LINEUP_PARAM_RANGES } from './npc/lineUp.js';
import { DEFAULT_HOME_PARAMS, HOME_PARAM_RANGES } from './npc/homeParking.js';
import { Tea, TEA_PARAM_RANGES } from './npc/tea.js';
import { Jumpers, JUMPER_PARAM_RANGES, JUMPERS } from './npc/jumpers.js';
import { JumperRail } from './world/jumperRail.js';
import { DieselMistake, DIESEL_MISTAKE_PARAM_RANGES } from './npc/dieselMistake.js';
import { Mugs } from './items/mug.js';
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
import { JerryCan, DEFAULT_JERRY_CAN_PARAMS, JERRY_CAN_PARAM_RANGES, PREMIX_CAN_COLOURS, DIESEL_CAN_COLOURS } from './items/jerryCan.js';
import { OilBottle, OIL_BOTTLE_PARAM_RANGES } from './items/oilBottle.js';
import { ratioText } from './engine/lubrication.js';
import { fuelText } from './engine/diesel.js';
import { FuelTank } from './items/fuelTank.js';
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
import { DashClock, CLOCK_START_RANGE, pickReading, pickRelatedReading, setDashClock } from './vehicle/dashState.js';
import { Bench } from './workshop/bench.js';
import { Interaction } from './interaction/interaction.js';
import { Wheel } from './interaction/wheel.js';
import { Hud } from './hud/hud.js';
import { DebugGui } from './debug/debugGui.js';

const BARN_BULB = 30; // candela of the bulb in the barn, scaled by how far in you are and how gloomy the day is

const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.1;

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
    const fleet = pickFleet(QUAD_SPECS, EXTRA_SPECS, createRandom(this.seed ^ 0x51ee7));
    const { placed: spawns, home } = randomiseQuadSpawns(this.world.spawn, fleet.length, random);

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
    for (const unit of this.units) unit.quad.tyres = new TyreSet(dealTyres(tyreRandom, 4, this.tyreParams), this.tyreParams);
    // Every quad starts parked properly, with its brake on; after that it's down to whoever gets off one (vehicle/handbrake.js).
    for (const unit of this.units) unit.quad.parkBrake = true;
    this.handbrakeParams = { ...DEFAULT_HANDBRAKE_PARAMS };
    this.pushing = null; // the unit you're shoving along on foot (pushOnFoot)
    registerTuning('Handbrake', this.handbrakeParams, HANDBRAKE_PARAM_RANGES);
    this.rollWatch = new RollWatch(this.handbrakeParams);
    registerTuning('Headlights', HEADLIGHT_PARAMS, HEADLIGHT_PARAM_RANGES);
    // One to three quirks each, from the parts the quad has (a gauge quirk needs a dash or pod that shows it, so this comes after the pods).
    this.quirkParams = { ...DEFAULT_QUIRK_PARAMS };
    registerTuning('Quirks', this.quirkParams, QUIRK_PARAM_RANGES);
    const quirkRandom = createRandom(this.seed ^ 0x9a1c);
    for (const unit of this.units) {
      const kinds = pickQuirks(featuresOf(unit.spec, !!this.podRack.podOn(unit.id)), quirkRandom, this.quirkParams);
      unit.quad.quirks = new QuirkSet(kinds, this.quirkParams);
    }
    // The tractor stands in the yard whatever the fleet is. It's a unit like the quads (you ride it, fuel it, hear it), but `girlUnits` is what
    // the girls know about: they leave it alone for now.
    this.girlUnits = this.units;
    this.tractorUnit = this.addTractor();
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
    console.info(`Weather: ${this.weather.name}, ${this.weather.temperature} °C (${this.weather.band}), chill ${this.weather.chill.toFixed(2)}, frost ${this.weather.frost.toFixed(2)} (add ?temp=<degrees> to the URL to force it)`);
    // She starts beside a random quad in the yard; the player starts facing it.
    this.homeUnit = this.units[home];
    this.lastUnit = this.homeUnit;

    // The companions (src/npc/characters.js), each starting beside her own quad in the yard.
    const yard = this.girlUnits.filter((u, i) => u !== this.homeUnit && spawns[i].where === spawns[home].where);
    const homes = [this.homeUnit, ...yard, ...this.girlUnits.filter((u) => u !== this.homeUnit && !yard.includes(u))];
    const floor = { left: 0, banter: false }; // so one waits for the other to finish before chattering, and both for a bicker
    this.talkFloor = floor;
    this.companions = CHARACTERS.map((character, i) => {
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
    this.trailer.place(tl.x, tl.z, tl.yaw);
    this.hayRide = new HayRide(undefined, createRandom(this.seed ^ 0x4a71));
    this.haySeat = { ...DEFAULT_HAYSEAT_PARAMS };
    for (const c of this.companions) c.hay = this.haySeat;
    // A girl on the tractor's wheel arch (npc/mudguardRide.js, vehicle/tractorMount.js); the tractor is built above.
    this.mudguard = new MudguardRide(undefined, createRandom(this.seed ^ 0x3d6a));
    this.tractorMount = new TractorMount(this.tractorUnit.quad, (x, z) => this.world.heightAt(x, z));
    // Having a go on the tractor: Jess takes it, Amy won't until her day (npc/tractorGo.js). The girls' own numbers are shared objects.
    this.tractorGo = new TractorGo(undefined, createRandom(this.seed ^ 0x70c0));
    this.tractorDrive = { ...DEFAULT_TRACTOR_GO_DRIVE };
    this.tractorStartParams = { ...DEFAULT_TRACTOR_START_PARAMS };
    this.noviceParams = { ...DEFAULT_NOVICE_PARAMS };
    for (const c of this.companions) Object.assign(c, { tractorGo: this.tractorDrive, tractorStartParams: this.tractorStartParams, noviceParams: this.noviceParams });
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
    this.throttleGrab = new ThrottleGrab(); // a girl on the back opening it over your hand (npc/throttleGrab.js)
    this.smokeSense = new SmokeSense(); // Amy coughs at two-stroke smoke, Jess loves it (npc/smokeSense.js)
    // Racing: the girls race a lap of the track from a start line by the yard (npc/race.js).
    this.dashReader = new DashReader(); // the girl on the back reads the dash out (npc/dashReading.js)
    this.doughnutWatch = new DoughnutWatch(); // Amy watches Jess's doughnuts and has a go (npc/doughnuts.js)
    for (const c of this.companions) c.doughnutParams = this.doughnutWatch.p;
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
    this.warming = new Warming(); // hands over an idling engine on a cold day (npc/warming.js)
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
          if (this.tooFastToMount(quad) && this.herDriving(quad)) return `Ask ${this.herDriving(quad).name} to stop and let you on`;
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
          if (chain.state === 'carried') {
            if (unit === this.tractorUnit) return { text: 'X put the tow chain back' };
            return `Hook the tractor's chain on the ${unit.label}${quad.bog.stuck ? ' (it\'s stuck)' : ''}   ·   X put it back`;
          }
          if (chain.state === 'hooked' && chain.target === quad) return 'Unhook the tow chain';
          if (this.hose.held) {
            const muddy = Math.round(Math.max(unit.mud.state.body, unit.mud.state.wheels) * 100);
            return { text: muddy > 0 ? `Hold E to wash the ${unit.label} (${muddy}% muddy)   ·   G put the hose back` : `The ${unit.label} is clean   ·   G put the hose back` };
          }
          if (this.toolbox.held) return unit.spec.tractor ? { text: 'The toolbox is for the quads: the tractor is too much for it   ·   G put it down' } : this.workshop.prompt(unit);
          if (this.can.held) {
            const pct = Math.round(quad.fuel.level * 100);
            if (quad.fuel.space < 0.01) return { text: `The ${unit.label} is full   ·   G put the can down` };
            if (this.can.litres < 0.01) return { text: 'The can is empty   ·   G put the can down' };
            return { text: `Hold E to fill the ${unit.label} (${pct}%) with ${fuelText(this.can.oil, this.can.diesel)}   ·   G put the can down` };
          }
          if (quad.isTipped) return `Right the ${unit.label}`;
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger && this.herOnBack(quad)) return { text: `${this.herAtTheFront(quad).name}'s driving and ${this.herOnBack(quad).name}'s on the back: no room` };
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger) return `Get on the back (${this.herAtTheFront(quad).name}'s driving)`;
          const winchKey = this.winch?.unit === unit && this.winch.state === 'stowed' ? '   X winch cable' : '';
          return {
            action: `Ride the ${unit.label}`,
            keys: quad.tractor
              ? [['K', 'Key'], ['R', 'Start'], ['O', 'Stop knob'], ...(this.chain.state === 'stowed' && !this.player.isRiding ? [['X', 'Tow chain']] : [])]
              : [['K', 'Ignition'], ['R', 'Start'], ...(quad.manual ? [['Shift 1-4', 'Clutch, gears']] : []), ...(quad.engine.params.pullStart ? [['P', 'Pull-start']] : []), ['Q Z', 'Choke'], ['F', 'Fuel tap'], ...(quad.reverseStyle === 'none' ? [['V', 'Push (no reverse)']] : []), ...(this.canSitOnBack(quad) ? [['B', 'Sit on the back']] : []), ...(winchKey ? [['X', 'Winch cable']] : [])],
          };
        },
        interact: () => {
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
          if (this.chain.state === 'carried') {
            if (unit !== this.tractorUnit) this.chain.hookOn(quad);
            return;
          }
          if (this.chain.state === 'hooked' && this.chain.target === quad) {
            this.chain.unhook(this.camera);
            return;
          }
          if (this.can.held || this.hose.held) return; // E is for pouring or spraying while you're holding those
          if (this.toolbox.held) return unit.spec.tractor ? undefined : this.workshop.open(unit);
          if (this.tooFastToMount(quad) && this.herDriving(quad)) {
            // She pulls up and moves onto the back for you.
            const c = this.herDriving(quad);
            c.requestMount(quad);
            c.voice.onRequest('back');
            return;
          }
          if (this.tooFastToMount(quad)) return;
          if (quad.isTipped) quad.rightItself();
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
          if (poured) this.wrongMix = this.mixWrongFor(quad, this.can);
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
    const canSpot = randomJerryCanSpot(L, random);
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
      position: L.premixCan,
      yaw: L.premixCan.yaw,
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
      position: L.dieselCan,
      yaw: L.dieselCan.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS, startLitres: 10, startDiesel: 1 },
      colours: DIESEL_CAN_COLOURS,
      name: 'dieselCan',
    });
    this.oilBottle = new OilBottle({ scene: this.scene, world: this.world, position: L.oilBottle, yaw: L.oilBottle.yaw });
    for (const can of [this.petrolCan, this.premixCan, this.dieselCan]) {
      this.interaction.add({
        target: can.proxy,
        isAvailable: () => !this.handsFull,
        prompt: () => `Pick up the ${can === this.premixCan ? 'yellow' : can === this.dieselCan ? 'dark green' : 'red'} jerry can (${can.litres.toFixed(1)} L, ${fuelText(can.oil, can.diesel)})`,
        interact: () => can.pickUp(this.camera),
      });
    }
    this.interaction.add({
      target: this.oilBottle.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Two-stroke oil: bring a jerry can to add some' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to add oil to the can (${fuelText(this.can.oil, this.can.diesel)})` };
      },
      interact: () => {},
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
    // A hosepipe for washing the mud off.
    this.hose = new Hose({ scene: this.scene, world: this.world, position: L.hose, yaw: L.hose.yaw });
    // The green quad's winch, for pulling a stuck quad out of a bog.
    const winchUnit = this.units.find((u) => u.spec.winch);
    this.winch = winchUnit ? new Winch({ scene: this.scene, unit: winchUnit }) : null;
    this.winchReel = false;
    // The tractor's tow chain (items/chain.js), for a quad sunk too deep for the winch or a dead one to tow home.
    this.chain = new Chain({ scene: this.scene, tractor: this.tractorUnit.quad, anchor: (q) => q.localToWorld(0, TRACTOR_GROUND_OFFSET + 0.52, -1.5) });
    this.interaction.add({
      target: this.hose.proxy,
      isAvailable: () => !this.handsFull,
      prompt: () => 'Pick up the hose',
      interact: () => this.hose.pickUp(this.camera),
    });
    // Jump leads, for a flat battery: a running quad charges it.
    this.leads = new JumpLeads({ scene: this.scene, world: this.world, position: L.jumpLeads, yaw: L.jumpLeads.yaw });
    this.interaction.add({
      target: this.leads.proxy,
      isAvailable: () => !this.handsFull && !this.leads.held,
      prompt: () => 'Pick up the jump leads',
      interact: () => this.leads.pickUp(this.camera),
    });
    this.interaction.add({
      target: this.toolbox.proxy,
      priority: 1, // it sits on the bench, whose box would otherwise be hit first
      isAvailable: () => !this.handsFull,
      prompt: () => 'Pick up the toolbox',
      interact: () => this.toolbox.pickUp(this.camera),
    });
    // The workbench: jobs on a quad parked in the painted bay (workshop/bench.js).
    this.interaction.add({
      target: this.bench.proxy,
      isAvailable: () => !this.handsFull,
      prompt: () => this.bench.prompt(),
      interact: () => this.bench.open(),
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
    registerTuning('Favour', this.favour.p, FAVOUR_PARAM_RANGES);
    this.wearLedger ??= new WearLedger();
    registerTuning('Who wore it out', this.wearLedger.p, LEDGER_PARAM_RANGES);
    registerTuning('Pranks', this.pranks.p, PRANK_PARAM_RANGES);
    registerTuning('Rev-offs', this.revOff.p, REVOFF_PARAM_RANGES);
    registerTuning('Horns', this.horns.p, HORN_PARAM_RANGES);
    registerTuning('Tractor remarks', this.tractorWatch.p, TRACTOR_WATCH_PARAM_RANGES);
    registerTuning('Tractor creep', DEFAULT_CREEP_PARAMS, CREEP_PARAM_RANGES);
    registerTuning('Tractor runaway', this.tractorRunaway.p, TRACTOR_RUNAWAY_PARAM_RANGES);
    registerTuning('Hay ride', this.hayRide.p, HAYRIDE_PARAM_RANGES);
    registerTuning('Mudguard ride', this.mudguard.p, MUDGUARD_PARAM_RANGES);
    registerTuning('Tractor go', this.tractorGo.p, TRACTORGO_PARAM_RANGES);
    registerTuning('L plates', this.lPlates.p, LPLATE_PARAM_RANGES);
    registerTuning('Tractor go drive', this.tractorDrive, TRACTOR_GO_DRIVE_RANGES);
    registerTuning('Tractor go start', this.tractorStartParams, TRACTOR_START_PARAM_RANGES);
    registerTuning('Tractor go novice', this.noviceParams, NOVICE_PARAM_RANGES);
    registerTuning('Hay ride seat', this.haySeat, HAYSEAT_PARAM_RANGES);
    registerTuning('Trailer', this.trailer.p, TRAILER_PARAM_RANGES);
    registerTuning('Quad names', this.quadNames.p, NAME_PARAM_RANGES);
    registerTuning('Whose quad', this.ownership.p, OWNERSHIP_PARAM_RANGES);
    registerTuning('Hearing a quad', this.hearing.p, EAR_PARAM_RANGES);
    registerTuning('Warming hands', this.warming.p, WARMING_PARAM_RANGES);
    registerTuning('Head start', this.headStart.p, HEADSTART_PARAM_RANGES);
    registerTuning('Talking about you', this.gossip.p, GOSSIP_PARAM_RANGES);
    registerTuning('Hand on the throttle', this.throttleGrab.p, GRAB_PARAM_RANGES);
    registerTuning('Two-stroke smoke', this.smokeSense.p, SMOKE_PARAM_RANGES);
    registerTuning('Yard haze', this.haze.p, HAZE_PARAM_RANGES);
    registerTuning('Racing', this.race.p, RACE_PARAM_RANGES);
    registerTuning('Follow the leader', this.convoy.p, CONVOY_PARAM_RANGES);
    registerTuning('Doughnuts', this.doughnutWatch.p, DOUGHNUT_PARAM_RANGES);
    registerTuning('Showing off', this.showOffParams, SHOWOFF_PARAM_RANGES);
    registerTuning('The jump', this.jumpWatch.p, JUMP_PARAM_RANGES);
    registerTuning('Nicking your quad', this.nicking.p, NICK_PARAM_RANGES);
    registerTuning('Lining them up', this.lineUpParams, LINEUP_PARAM_RANGES);
    registerTuning('Home and jogging', this.homeParams, HOME_PARAM_RANGES);
    registerTuning('Tea on the rack', this.tea.p, TEA_PARAM_RANGES);
    registerTuning('Jumpers', this.jumpers.p, JUMPER_PARAM_RANGES);
    registerTuning('Red diesel mistake', this.dieselMistake.p, DIESEL_MISTAKE_PARAM_RANGES);
    registerTuning('Reading the dash', this.dashReader.p, READING_PARAM_RANGES);
    registerTuning('Jump leads', this.leads.params, JUMP_LEAD_PARAM_RANGES);
    registerTuning('Skills', this.skills.p, SKILL_PARAM_RANGES);
    registerTuning('Places', this.places.p, PLACE_PARAM_RANGES);
    registerTuning('Hayloft', this.loftParams, LOFT_PARAM_RANGES);
    registerTuning('Favours asked', this.requests.p, REQUEST_PARAM_RANGES);
    if (this.winch) registerTuning('Winch', this.winch.params, WINCH_PARAM_RANGES);
    registerTuning('Tow chain', this.chain.params, CHAIN_PARAM_RANGES);
    registerTuning('Player', this.player.params, PLAYER_PARAM_RANGES);
    for (const c of this.companions) {
      registerTuning(c.name, c.params, COMPANION_PARAM_RANGES, { onChange: () => c.refreshFigure() });
      registerTuning(`${c.name} pillion`, c.pillion.params, PILLION_PARAM_RANGES);
    }
    this.debugGui = new DebugGui(this);

    this.applyDebugCamera();
    if (import.meta.env.DEV) window.game = this;
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
    const half = this.world.layout.fieldHalf - this.world.layout.hedgeThickness;
    const ctx = { creeping: q.creeping, stalled, trailer: this.trailer.hitched, hedge: distanceToHedge(q.position.x, q.position.z, q.yaw, half), girls };
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

  /** J on the tractor: hook the trailer on when the drawbar is at its ring, or take it off when you're stopped. */
  toggleHitch() {
    const unit = this.tractorUnit;
    const t = this.trailer;
    if (this.riddenUnit !== unit) return;
    if (this.chain.state !== 'stowed') return this.hud.toast('The tow chain is on the drawbar', 2);
    if (t.hitched) {
      if (unit.quad.speed > 0.5) return this.hud.toast('Stop before you unhitch the trailer', 2);
      t.unhitch();
      return this.hud.toast('Trailer unhitched', 1.6);
    }
    if (t.canHitch(unit.quad)) {
      t.hitch(unit.quad);
      return this.hud.toast('Trailer hitched', 1.6);
    }
    this.hud.toast(t.gap(unit.quad) < 8 ? 'Back the drawbar up to the trailer\'s ring' : 'No trailer behind you', 2);
  }

  /** The hay ride: the trailer follows the tractor, and the girls climb on, bounce about, lie back, fall off and climb down (npc/hayRide.js). */
  updateHayRide(dt, ridden) {
    const t = this.trailer;
    t.update(dt);
    const m = t.motion;
    const active = t.hitched && ridden === this.tractorUnit;
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
        say(c, 'hayFall');
        this.hayLater.push({ left: 1.2, girl: c.others()[0], key: 'hayFallOther' });
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
    }
    return { label: 'Tractor', color: unit.spec.bodyColor, children };
  }

  /** Nobody's on the tractor or on their way to it, it's stopped, and nothing is hitched to it. */
  tractorFree() {
    const q = this.tractorUnit.quad;
    const busy = (c) => (c.quad === q && (c.fsm.is('driving', 'mounting', 'dismounting', 'shuffling') || (c.fsm.is('walking') && c.fsm.data?.goal === 'drive'))) || (c.onHayRide && c.trailer === this.tractorMount);
    return !q.rider && q.speed < 0.5 && !this.trailer.hitched && !this.companions.some(busy);
  }

  /** You ask her for a go on the tractor: Jess is thrilled, and Amy says no until her day has come. */
  askDriveTractor(c) {
    const id = c.character.id;
    if (this.tractorGo.ask(id) === 'refuse') return void c.voice.say('tractorRefuse', { force: true });
    this.startTractorGo(c);
    c.voice.say('tractorGoAsk', { force: true });
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
    if (where === 'tractor') this.lPlateSet.showOn(this.tractorUnit.quad.bodyRoot, 'tractor');
    else this.lPlateSet.showOn(where === 'quad' && mine ? mine.quad.bodyRoot : null, 'quad');
  }

  /** She walks over and has a go at starting and driving the tractor. */
  startTractorGo(c) {
    if (!c.homeQuad && c.quad !== this.tractorUnit.quad) c.homeQuad = c.quad;
    this.tractorGo.started(c.character.id);
    this.tractorSeen[c.character.id] = { stalls: 0, hops: 0, setOff: false, wasDriving: false };
    c.requestDrive(this.tractorUnit.quad);
  }

  /** Jess takes it now and then, Amy has her day, and each of them says what's happening on her go (npc/tractorGo.js, tractorGoLines.js). */
  updateTractorGo(dt, ridden) {
    const q = this.tractorUnit.quad;
    const girlsFree = {};
    for (const c of this.companions) girlsFree[c.character.id] = c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot && !this.dieselJob && !c.nickJob && !c.hayFell;
    for (const ev of this.tractorGo.update(dt, { free: girlsFree, tractorFree: this.tractorFree(), youOnTractor: ridden === this.tractorUnit })) {
      const c = this.companions.find((o) => o.character.id === ev.girl);
      if (ev.type === 'amyDay') c.voice.say('tractorDay', { force: true });
      else c.voice.say('tractorGoAsk', { force: true });
      this.startTractorGo(c);
    }
    for (const c of this.companions) {
      const id = c.character.id;
      const seen = (this.tractorSeen[id] ??= { stalls: 0, hops: 0, setOff: false, wasDriving: false });
      const other = c.others()[0];
      const driving = c.quad === q && c.fsm.is('driving');
      if (driving) {
        const d = c.drive;
        seen.wasDriving = true;
        if (d.phase === 'drive' && !seen.setOff) {
          seen.setOff = true;
          c.voice.say('tractorGoSetOff', { urgent: true });
          this.hayLater.push({ left: 4, girl: other, key: 'tractorGoWatch' });
        }
        if (d.stalls > seen.stalls) {
          seen.stalls = d.stalls;
          c.voice.say('tractorGoStall', { urgent: true });
        }
        if ((q.shifter.hops ?? 0) > (seen.hops ?? 0)) {
          seen.hops = q.shifter.hops;
          c.voice.say('tractorGoLurch', { urgent: true });
          if (other.root.position.distanceTo(q.position) < 30) this.hayLater.push({ left: 1.4, girl: other, key: 'tractorGoLurch' });
        }
      } else if (seen.wasDriving) {
        seen.wasDriving = false;
        if (c.drive?.result !== 'gaveUp') c.voice.say('tractorGoDone', { urgent: true });
      }
      // Back to her own quad once she's off the tractor, so everything else that looks at her quad finds one of the girls'.
      if (c.homeQuad && c.quad === q && c.fsm.is('idle')) {
        c.quad = c.homeQuad;
        c.homeQuad = null;
      }
    }
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
    const ctx = { active: riding && unit.quad.engine.isRunning, riding, trailer: this.trailer.hitched, speed: unit.quad.speed, girls };
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
  addTractor() {
    const random = createRandom(this.seed ^ 0x7ac70);
    const unit = new QuadUnit({
      spec: TRACTOR_SPEC,
      spawn: this.world.layout.tractor,
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
    unit.where = 'in the yard';
    return unit;
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
    return quad.hasPillion && !quad.isTipped && !quad.passenger && !quad.rider && !this.herOn(quad) && quad.speed < 0.5 && !this.handsFull;
  }

  /**
   * Sat on the back of a parked quad with nobody at the front: after a while a
   * free girl comes over and takes you for a ride (and gets off when she's bored,
   * unasked). Afterwards nobody offers again for a good while.
   */
  updateRideOffer(dt) {
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
    const waiting = !!unit && this.player.seat === 'pillion' && unit.quad.speed < 0.5 && !this.menu.isOpen && !this.passengerPlan && !this.herOn(unit.quad);
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
    const triggers = this.banterWatch.triggers(dt, { companions: this.companions, ridden, you: this.camera.position, wheelOpen: this.menu.isOpen, rivalry: this.favour.rivalry() });
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
    const speak = (speaker, text, opts) => (byId[speaker]?.params.voice ? byId[speaker].voice.speak(text, opts) : 0);
    this.banter.update(dt, triggers, speak, this.talkFloor.left <= 0 && !this.menu.isOpen && !this.gossip.busy);
    this.talkFloor.banter = this.banter.busy || this.gossip.busy;
    this.updateGossip(dt, byId, speak);
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
    if (quad.engine.params.runsOnDiesel) return null; // the tractor takes red diesel; what else goes in it isn't modelled
    if (can.diesel > 0.05) return 'diesel';
    if (quad.engine.params.strokes === 2) return can.oil < 0.002 ? 'straight' : null;
    return can.oil > 0.004 ? 'premix' : null;
  }

  get handsFull() {
    return this.petrolCan.held || this.premixCan.held || this.dieselCan.held || this.hose.held || this.toolbox.held || this.leads.held || this.winch?.state === 'carried' || this.chain.state === 'carried';
  }

  /** The tow chain: it comes out of your hand if you go further than it reaches, or when you get on something. */
  updateChain() {
    const c = this.chain;
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
    const spot = this.findDismountSpot(quad, [
      [1.05, -0.6],
      [-1.05, -0.6],
      [0, -1.9],
    ]);
    if (!spot) {
      this.hud.toast('No room to get off here');
      return false;
    }
    quad.passenger = null;
    this.player.dismount(spot, quad.yaw + Math.PI);
    return true;
  }

  /** Your menu riding on the back: talk to her about the ride. */
  openPassengerMenu() {
    const c = this.herAtTheFront(this.boardUnit.quad) ?? this.herOn(this.boardUnit.quad);
    if (!c) return void this.getOffBack(); // sat on the back by yourself: E just gets you off
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
    if (c.fsm.is('driving')) ask('swap', 'Let me drive', () => ((this.passengerPlan = 'swap'), drive?.park()));
    // Advice that fits what she's just got wrong (or is about to): only those are on the wheel.
    const coaching = drive && !stopped ? drive.coachable() : [];
    if (coaching.length) actions.push({ label: 'Coach her', children: coaching.map((key) => ({ label: COACHING[key].label, run: () => this.coachHer(c, key) })) });
    this.openWheel(`Ask ${c.name} to`, actions, c);
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
  }

  /** You tell her how to do something from the back. She learns if it's the right moment; at the wrong one, or again too soon, she doesn't. */
  coachHer(c, key) {
    const { skill } = COACHING[key];
    const id = c.character.id;
    const fitting = !!c.drive?.isMoment(skill);
    const result = this.skills.coach(id, skill, fitting);
    if (result === 'taught') {
      this.favour.add(id, this.skills.p.taughtFavour);
      // She does it right away where she can.
      if (skill === 'choke' && c.quad.choke > 0) c.quad.choke = 0;
      if (skill === 'mud' && c.drive) c.drive.boost = 2;
      c.voice.say(`taught_${skill}`, { force: true });
    } else if (result === 'nagged') {
      this.favour.add(id, this.skills.p.nagFavour);
      c.voice.say('coachNagged', { force: true });
    } else {
      c.voice.say('coachWrongTime', { force: true });
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
  updateWearLedger() {
    this.wearLedger ??= new WearLedger();
    this.drivers = new Map();
    for (const unit of this.girlUnits) {
      const girl = this.companions.find((c) => c.fsm.is('driving') && c.quad === unit.quad);
      const who = unit === this.riddenUnit ? 'you' : girl ? girl.character.id : null;
      if (who) this.drivers.set(unit, who);
      this.wearLedger.record(unit.id, unit.engine.wear, who);
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
      can: { x: this.petrolCan.model.position.x, z: this.petrolCan.model.position.z, held: this.petrolCan.held },
      bales: this.bales,
    };
  }

  updateRequests(dt, ridden) {
    if (this.hiding.active) return; // nobody to ask
    for (const e of this.requests.update(dt, this.requestContext(ridden))) {
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
      const friend = this.companions.find((o) => o !== c && this.revOffQuad(o) && c.root.position.distanceTo(o.quad.position) <= p.rockPrankRange);
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

  updateRevOff(dt, ridden) {
    const q = ridden?.quad;
    const girls = this.companions.map((c) => ({ id: c.character.id, canBlip: !!this.revOffQuad(c), x: c.root.position.x, z: c.root.position.z }));
    const you = { riding: !!q && !this.menu.isOpen, running: !!q?.engine.isRunning, speed: Math.abs(q?.speed ?? 0), throttle: q?.throttle ?? 0, x: this.player.position.x, z: this.player.position.z };
    const events = this.revOff.update(dt, { you, girls });
    for (const c of this.companions) {
      const quad = this.revOffQuad(c);
      if (quad && quad !== this.rockPrank?.quad) quad.helperThrottle = this.revOff.throttleFor(c.character.id);
    }
    for (const e of events) {
      const girl = this.companions.find((c) => c.character.id === e.girl);
      if (!girl) continue;
      if (e.type === 'done') {
        if (girl.quad.helperThrottle > 0) girl.quad.helperThrottle = 0;
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
      if (e.type === 'answer') girl(e.girl)?.voice.say('hornAnswer', { force: true });
      else if (e.type === 'creep') girl('jess')?.voice.say('hornJump', { force: true });
      else if (e.type === 'jump') girl(e.girl)?.voice.say('hornJump', { force: true });
    }
    for (const u of this.units) {
      const c = this.companions.find((o) => o.quad === u.quad);
      u.ride.setHorn(u === ridden ? honking : u.quad.quirks.horn(dt, !!c && this.horns.beeping(c.character.id)));
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
      c.requestStart(quad);
      c.voice.say(e.type === 'warmFor' ? 'headStartGo' : 'snubGo', { urgent: true, force: true });
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
    return { point: new THREE.Vector3(x, this.world.heightAt(x, b.z + (i === 0 ? -1.4 : 1.4)), b.z + (i === 0 ? -1.4 : 1.4)), facing: Math.PI / 2 };
  }

  /** Stop whatever they're doing and gather by the barn doors. */
  recallGirls() {
    this.race.stand();
    this.convoy.stand();
    this.recalling = { left: 120, spots: this.companions.map((c, i) => this.recallSpot(i)), said: false };
    this.hud.toast('Girls: stop what you are doing and come to the barn');
  }

  /** Keeps at it until each is there (a girl mid-change gets another nudge), or two minutes have gone. */
  updateRecall(dt) {
    const r = this.recalling;
    if (!r) return;
    r.left -= dt;
    r.nudge = (r.nudge ?? 0) - dt;
    let waiting = false;
    this.companions.forEach((c, i) => {
      const { point, facing } = r.spots[i];
      const arrived = c.fsm.is('idle') && c.root.position.distanceTo(point) < 2.5;
      if (arrived) return;
      waiting = true;
      if (r.nudge <= 0) c.recall(point, facing);
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
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot, x: c.root.position.x, z: c.root.position.z }));
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
      if (!c.sneakTo(spot, act)) this.tea.cancel(girl);
    };
    for (const e of this.tea.update(dt, { girls, quads })) {
      const c = byId[e.girl];
      if (e.type === 'place') {
        sendTo(e.girl, e.spec, () => {
          const u = unitOf(e.spec);
          const free = !u.quad.rider && !u.quad.driver && Math.abs(u.quad.speed) < 0.3;
          const mug = free ? this.mugs.put(u.quad, e.girl === 'amy' ? 0x3a6ea5 : 0xb8322a) : null;
          if (!mug) return this.tea.cancel(e.girl);
          this.teaMugs[e.girl] = mug;
          this.tea.placed(e.girl, e.spec);
          c.voice.say('teaPlace', { urgent: true, chance: 0.9 });
        });
      } else if (e.type === 'collect') {
        sendTo(e.girl, e.spec, () => {
          const u = unitOf(e.spec);
          if (u.quad.rider || u.quad.driver || Math.abs(u.quad.speed) > 0.3) return this.tea.cancel(e.girl);
          this.mugs.remove(this.teaMugs[e.girl]);
          delete this.teaMugs[e.girl];
          this.tea.collected(e.girl);
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
    const girls = this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !this.menu.isOpen && !c.warmingAt && !c.pendingSpot, x: c.root.position.x, z: c.root.position.z }));
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
    for (const e of cv.update(dt, { girls, options, claims: this.ownership.claims, busy: this.race.active || !!this.recalling })) {
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
        for (const c of this.companions) if (c.fsm.is('driving') && c.drive && !c.drive.done) c.drive.stop('bored');
      }
    }
  }

  // Racing ------------------------------------------------------------------

  /** The lap as waypoints for a girl on her side of the track: the grid point first, then round the loop and back to it. */
  raceRoute(lateral, back = 0) {
    const L = this.world.layout;
    const h = this.world.heights;
    const hazards = [...(h.bogs ?? []).map((b) => ({ x: b.x, z: b.z, radius: b.radius })), ...(h.puddles ?? []).map((p) => ({ x: p.x, z: p.z, radius: L.puddleRadius + 1.5 }))]; // a puddle at speed drowns the engine, so well clear
    // `back` metres behind the line (side by side on the grid, 3 m apart, so neither is in the other's way).
    const s = this.world.track.sample(this.raceStart - back / this.world.track.totalLength);
    const grid = { x: s.x - s.tz * lateral, z: s.z + s.tx * lateral };
    return [grid, ...planLap(this.world.track, this.raceStart, hazards, { spacing: this.race.p.routeSpacing, margin: this.race.p.hazardMargin, lateral })];
  }

  updateRace(dt, ridden) {
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
        const busy = c.fsm.is('walking', 'mounting', 'driving', 'shuffling', 'dismounting') || !!c.drive?.race;
        this.raceIdle[id] = busy ? 0 : (this.raceIdle[id] ?? 0) + dt;
        if (this.raceIdle[id] > 4) this.race.abort(id);
      }
    } else this.raceIdle = {};
    for (const e of this.race.update(dt, { girls, options, claims: this.ownership.claims })) {
      if (e.type === 'invite') {
        byId[e.challenger].voice.say('raceInvite', { force: true });
        later(3500, () => byId[e.other]?.voice.say('raceAccept', { force: true }));
        let side = 1;
        for (const [id, spec] of Object.entries(e.picks)) {
          const c = byId[id];
          const quad = this.girlUnits.find((u) => u.spec.id === spec).quad;
          const confidence = c.driveConfidence ?? c.params.driveConfidence;
          const race = {
            route: this.raceRoute(1.5 * side),
            gridIndex: 0,
            cruise: p.cruiseBase + p.cruiseConfidence * confidence + (Math.random() * 2 - 1) * p.cruiseSpread,
            throttle: p.throttle,
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
      else if (e.type === 'finish') {
        if (e.place === 1) byId[e.girl].voice.say('raceWin', { force: true });
        else later(2500, () => byId[e.girl]?.voice.say('raceLose', { force: true }));
      } else if (e.type === 'out') byId[e.girl]?.voice.say('raceOut', { force: true });
      else if (e.type === 'result' && e.winner) this.raceResult = { winner: e.winner, loser: e.loser };
    }
  }

  // Pranks -----------------------------------------------------------------

  /** What the prank logic needs to know about the farm right now. */
  prankContext(ridden) {
    const item = (thing, name) => ({ x: thing.model.position.x, z: thing.model.position.z, held: thing.held, home: this.itemHome[name] ?? thing.model.position });
    return {
      you: { x: this.player.position.x, z: this.player.position.z, riding: ridden?.spec.id ?? null },
      girls: this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !this.menu.isOpen, mood: this.favour.mood(c.character.id) })),
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
        if (home && !thing.held) thing.putDown(home, home.yaw);
      }
      if (e.type === 'resolved' || e.type === 'restore') delete this.itemHome[a.item];
    }
  }

  /** She sets off to do it; it only happens if it's still fair game when she gets there. */
  startPrank(a, girl) {
    if (!girl) return this.pranks.cancel(a);
    const quad = a.quad ? this.girlUnits.find((u) => u.spec.id === a.quad).quad : null;
    const thing = a.item === 'can' ? this.petrolCan : a.item === 'toolbox' ? this.toolbox : null;
    const at = quad ? quad.position : thing.model.position;
    // Stops short of it, on her side.
    const from = girl.root.position;
    const d = Math.hypot(from.x - at.x, from.z - at.z) || 1;
    const spot = { x: at.x + ((from.x - at.x) / d) * 1.3, z: at.z + ((from.z - at.z) / d) * 1.3 };
    const act = () => {
      if (quad) {
        if (quad.rider || quad.engine.isRunning) return this.pranks.cancel(a);
        if (a.kind === 'tap') quad.fuel.tap = 'off';
        else quad.choke = 1;
      } else {
        if (thing.held) return this.pranks.cancel(a);
        this.itemHome[a.item] = { x: thing.model.position.x, z: thing.model.position.z, yaw: thing.model.rotation.y };
        thing.putDown(a.spot, Math.random() * Math.PI * 2);
      }
      this.pranks.apply(a);
    };
    if (!girl.sneakTo(spot, act)) this.pranks.cancel(a);
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
    if (c.fsm.is('onTrailer') && c.trailer === this.tractorMount) {
      this.openWheel(`Ask ${c.name} to`, [this.tractorWheelOption(c)], c);
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
    const tractor = this.tractorWheelOption(c);
    if (tractor.children.length) options.push(tractor);
    for (const unit of [...new Set(actions.filter((a) => a.quad).map((a) => a.quad.unit))]) {
      const own = actions.filter((a) => a.quad === unit.quad);
      options.push({
        label: unit.name,
        color: unit.spec.bodyColor,
        hint: unit.quad === c.quad && c.isSeated ? 'she\'s on it' : null,
        children: own.map((a) => ({ label: a.short ?? a.label, run: answer(a) })),
      });
    }
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
    this.hud.toast(quad.parkBrake ? 'Parking brake on' : 'Parking brake off', 1.2);
  }

  mount(unit) {
    if (this.player.isRiding || this.tooFastToMount(unit.quad)) return;
    this.player.mount(unit.quad);
    this.favourQuad(unit, this.favour.p.favouriteQuad);
    unit.quad.setRider(this.player, this.input);
    this.lastUnit = unit;
    this.input.takeWheelSteps();
    if (unit.quad.parkBrake) this.hud.toast('Parking brake is on (Space)', 2);
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
    for (const [lx, lz] of candidates) {
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

  /** E on a quad with the jump leads in hand. */
  clampLeads(quad) {
    const result = this.leads.clamp(quad);
    if (result === 'first') this.hud.toast('Clamped on. Now the other end on a running quad');
    else if (result === 'joined') this.hud.toast('Leads on: a running quad charges a flat one. Keep them close, nose to nose');
  }

  putLeadsDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.leads.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  putToolboxDown() {
    const p = this.player.position;
    const yaw = this.player.yaw;
    this.toolbox.putDown(new THREE.Vector3(p.x - Math.sin(yaw) * 0.7, 0, p.z - Math.cos(yaw) * 0.7), yaw);
  }

  // Loop -----------------------------------------------------------------

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), MAX_FRAME_DT);
    const input = this.input;

    if (input.wasPressed('KeyH')) this.hud.toggleHelp();
    if (input.wasPressed('Backquote')) this.debugGui.toggle();
    if (input.wasPressed('KeyJ')) this.toggleHitch();
    if (input.wasPressed('KeyN')) this.recallGirls();
    if (input.wasPressed('KeyM')) {
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
      if (input.wasPressed('Space')) this.toggleParkBrake(this.riddenUnit.quad);
      if (input.wasPressed('KeyE')) this.tryDismount();
    } else if (this.workshop.isOpen) {
      this.workshop.handleInput(input);
    } else if (this.bench.isOpen) {
      this.interaction.clear();
      this.bench.handleInput(input);
    } else if (this.climb) {
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
        this.lastUnit = focused.unit;
      }
      if (focused && input.wasPressed('KeyE')) focused.interact();
      this.pushOnFoot(input, focused?.unit);
      // B: sit on the back of a quad with nobody driving; sooner or later a girl comes and takes you for a ride.
      if (focused?.unit && input.wasPressed('KeyB') && this.canSitOnBack(focused.unit.quad)) this.mountPillion(focused.unit);
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
        if (c.state === 'stowed' && focused?.unit === this.tractorUnit && !this.handsFull) {
          if (this.trailer.hitched) this.hud.toast('Unhitch the trailer first: the chain goes on the same drawbar', 2.4);
          else c.take(this.camera);
        } else if (c.state === 'carried') c.stow();
      }
      if (this.hose.held && input.wasPressed('KeyG')) this.hose.putBack();
      else if (this.can.held && input.wasPressed('KeyG')) this.putCanDown();
      else if (this.toolbox.held && input.wasPressed('KeyG')) this.putToolboxDown();
      else if (this.leads.held && input.wasPressed('KeyG')) this.putLeadsDown();
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
    this.updateWearLedger();
    this.updateQuirks(dt, ridden);
    this.updateHandbrake(dt);
    this.skills.update(dt);
    this.updateRequests(dt, ridden);
    this.updatePlaces(dt);
    this.updatePranks(dt, ridden);
    this.updateRevOff(dt, ridden);
    this.updateHorns(dt, ridden);
    this.updateTractorWatch(dt);
    this.updateTractorRunaway(dt, ridden);
    this.updateHayRide(dt, ridden);
    this.updateMudguard(dt, ridden);
    this.updateTractorGo(dt, ridden);
    this.updateLPlates(dt);
    this.updateQuadTalk(dt, ridden);
    this.updateWarming(dt);
    this.updateHeadStart(dt, ridden);
    this.updateDoughnuts(dt);
    this.updateJumps(dt);
    this.updateNicking(dt, ridden);
    this.updateTea(dt, ridden);
    this.updateJumpers(dt);
    this.updateDieselMistake(dt, ridden);
    this.updateRecall(dt);
    if (!this.recalling) this.updateConvoy(dt, ridden);
    this.updateDashReading(dt, ridden);
    if (!this.recalling) this.updateRace(dt, ridden);
    this.updateSmokeSense(dt);
    this.updateHaze(dt);
    this.updateThrottleGrab(dt, ridden);
    this.updateRockPrank(dt);
    this.updateBanter(dt, ridden);
    for (const c of this.companions) {
      c.update(dt, c.quad.unit.vibration, {
        position: this.camera.position,
        forward: this.camera.getWorldDirection(this.viewForward),
        isRiding: this.player.isRiding,
        talking: this.menu.isOpen && this.talkingTo === c,
      });
      c.sounds.ensure();
      c.voice.update(dt, {
        listener: this.camera.position,
        ridden,
        units: this.girlUnits,
        drivers: this.drivers,
        ledger: this.wearLedger,
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
    this.updateLoft(dt);
    this.audioHub.setPouring(pouring, dt);
    this.audioHub.update(dt, this.camera);
    this.rideWind.update(dt, board ? board.quad.speed : 0);
    this.world.update(dt, board ? board.quad.position : this.player.position, this.camera);
    this.updateWeather(dt);
    this.updateHud(dt);

    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  fixedUpdate(dt) {
    this.player.fixedUpdate(dt);
    this.winch?.fixedUpdate(dt, this.winchReel);
    this.chain.fixedUpdate(dt);
    if (this.leads.update(dt, this.camera.position) === 'pulledOff') this.hud.toast('The jump leads came off');
    for (const unit of this.units) unit.fixedUpdate(dt);
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
    if (this.chain.state === 'carried') {
      this.hud.setStatus('Tow chain\nE on a quad to hook it on, X to put it back\nThen drive the tractor off, forwards');
    } else if (this.winch?.state === 'carried') {
      this.hud.setStatus('Winch hook\nE on a quad to hook it on, X to put it back');
    } else if (this.hose.held) {
      this.hud.setStatus('Hose\nHold E to spray, G to put it back');
    } else if (this.leads.held) {
      this.hud.setStatus('Jump leads\nE on a quad to clamp one end, then another quad for the other\nG to put them down');
    } else if (this.toolbox.held) {
      this.hud.setStatus('Toolbox\nTake it to a quad that is switched off\nG to put it down');
    } else if (this.can.held) {
      this.hud.setStatus(`Jerry can  ${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${fuelText(this.can.oil, this.can.diesel)}\nG to put it down`);
    } else if (this.riddenUnit === this.tractorUnit && this.trailer.canHitch(this.tractorUnit.quad)) {
      this.hud.setStatus('The drawbar is at the trailer\'s ring\nJ to hitch it on');
    } else {
      this.hud.setStatus('');
    }
    // Anything the tractor has to say (the starter in gear, a gear change without the clutch) to whoever's at it.
    for (const u of this.units) {
      const note = u.quad.takeNote();
      if (note && (u === this.riddenUnit || u.quad.position.distanceTo(this.player.position) < 6)) this.hud.toast(note, 2.2);
    }
    this.hud.update(dt);
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

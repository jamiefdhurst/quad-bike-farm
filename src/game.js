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
import { QUAD_SPECS, EXTRA_SPECS } from './vehicle/quadSpecs.js';
import { pickFleet } from './vehicle/fleet.js';
import { applyIdle, applyVariation, pickIdle } from './vehicle/quadVariation.js';
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
import { WearLedger, LEDGER_PARAM_RANGES } from './engine/wearLedger.js';
import { Pranks, PRANK_PARAM_RANGES } from './npc/pranks.js';
import { RevOff, REVOFF_PARAM_RANGES } from './npc/revOff.js';
import { DEFAULT_LOFT_PARAMS, LOFT_PARAM_RANGES, onLoft, Climb, Hiding, StrawDrop } from './world/loft.js';
import { StrawFall } from './effects/strawFall.js';
import { Places, PLACE_PARAM_RANGES, isFine, nearestSpot, restStay } from './npc/places.js';
import { Requests, REQUEST_PARAM_RANGES } from './npc/requests.js';
import { Skills, SKILL_PARAM_RANGES, COACHING } from './npc/skills.js';
import { Banter } from './npc/banter.js';
import { RideOffer, pickOfferer } from './npc/rideOffer.js';
import { BANTER } from './npc/banterLines.js';
import { BanterWatch } from './npc/banterWatch.js';
import { JerryCan, DEFAULT_JERRY_CAN_PARAMS, JERRY_CAN_PARAM_RANGES, PREMIX_CAN_COLOURS } from './items/jerryCan.js';
import { OilBottle, OIL_BOTTLE_PARAM_RANGES } from './items/oilBottle.js';
import { ratioText } from './engine/lubrication.js';
import { FuelTank } from './items/fuelTank.js';
import { Toolbox } from './items/toolbox.js';
import { JumpLeads, JUMP_LEAD_PARAM_RANGES } from './items/jumpLeads.js';
import { Hose, HOSE_PARAM_RANGES } from './items/hose.js';
import { Winch, WINCH_PARAM_RANGES } from './items/winch.js';
import { Weather, pickWeatherKind } from './world/weather.js';
import { Rain } from './effects/rain.js';

import { washMud } from './effects/mudBuildUp.js';
import { Workshop } from './workshop/workshop.js';
import { PodRack } from './vehicle/pods.js';
import { buildPod } from './vehicle/dashPod.js';
import { DashClock, CLOCK_START_RANGE, pickReading, setDashClock } from './vehicle/dashState.js';
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
    console.info(
      `This game: ${this.units
        .map((u, i) => `${u.name} ${spawns[i].where}, idle ${u.idleRpm} rpm, roughness ${u.variation.roughness.toFixed(2)}, ${u.variation.litres.toFixed(1)} L`)
        .join('; ')}`,
    );
    // What the hour meters and odometers show, the dash clock, and where the two accessory pods start. Each has its own seeded
    // stream, so a seed keeps its layout and these repeat too.
    const usageRandom = createRandom(this.seed ^ 0xd45b);
    for (const unit of this.units) {
      unit.quad.usage.hours = pickReading(unit.spec.hoursRange ?? [0, 0], usageRandom);
      unit.quad.usage.odoMiles = pickReading(unit.spec.odoRange ?? [0, 0], usageRandom);
    }
    setDashClock(new DashClock(pickReading(CLOCK_START_RANGE, createRandom(this.seed ^ 0xc10c))));
    this.podRack = new PodRack(this.units.map((u) => u.id));
    this.podRack.place(createRandom(this.seed ^ 0x90d5));
    this.pods = { analogue: buildPod('analogue'), digital: buildPod('digital') };
    for (const unit of this.units) {
      const kind = this.podRack.podOn(unit.id);
      if (kind) unit.quad.fitPod(this.pods[kind]);
    }
    console.info(`Pods: ${this.podRack.describe((id) => this.units.find((u) => u.id === id).name)}`);
    this.updateSmokeScale();
    // This game's weather, picked after everything else so a seed keeps its layout (?weather=rain forces one).
    const forced = new URLSearchParams(location.search).get('weather');
    this.weather = new Weather(forced ?? pickWeatherKind(random), random);
    this.world.setWeather(this.weather);
    this.rain = new Rain(this.scene);
    console.info(`Weather: ${this.weather.name}`);
    // She starts beside a random quad in the yard; the player starts facing it.
    this.homeUnit = this.units[home];
    this.lastUnit = this.homeUnit;

    // The companions (src/npc/characters.js), each starting beside her own quad in the yard.
    const yard = this.units.filter((u, i) => u !== this.homeUnit && spawns[i].where === spawns[home].where);
    const homes = [this.homeUnit, ...yard, ...this.units.filter((u) => u !== this.homeUnit && !yard.includes(u))];
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
      c.quads = this.units.map((u) => u.quad);
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
    this.itemHome = {}; // where a hidden item was taken from, by name

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
          if (this.hose.held) {
            const muddy = Math.round(Math.max(unit.mud.state.body, unit.mud.state.wheels) * 100);
            return { text: muddy > 0 ? `Hold E to wash the ${unit.label} (${muddy}% muddy)   ·   G put the hose back` : `The ${unit.label} is clean   ·   G put the hose back` };
          }
          if (this.toolbox.held) return this.workshop.prompt(unit);
          if (this.can.held) {
            const pct = Math.round(quad.fuel.level * 100);
            if (quad.fuel.space < 0.01) return { text: `The ${unit.label} is full   ·   G put the can down` };
            if (this.can.litres < 0.01) return { text: 'The can is empty   ·   G put the can down' };
            return { text: `Hold E to fill the ${unit.label} (${pct}%) with ${ratioText(this.can.oil)}   ·   G put the can down` };
          }
          if (quad.isTipped) return `Right the ${unit.label}`;
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger && this.herOnBack(quad)) return { text: `${this.herAtTheFront(quad).name}'s driving and ${this.herOnBack(quad).name}'s on the back: no room` };
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger) return `Get on the back (${this.herAtTheFront(quad).name}'s driving)`;
          const winchKey = this.winch?.unit === unit && this.winch.state === 'stowed' ? '   X winch cable' : '';
          return {
            action: `Ride the ${unit.label}`,
            keys: [['K', 'Ignition'], ['R', 'Start'], ...(quad.engine.params.pullStart ? [['P', 'Pull-start']] : []), ['Q Z', 'Choke'], ['F', 'Fuel tap'], ...(this.canSitOnBack(quad) ? [['B', 'Sit on the back']] : []), ...(winchKey ? [['X', 'Winch cable']] : [])],
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
          if (this.can.held || this.hose.held) return; // E is for pouring or spraying while you're holding those
          if (this.toolbox.held) return this.workshop.open(unit);
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
          const poured = quad.fuel.add(this.can.take(wanted), this.can.oil) > 0;
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
    this.oilBottle = new OilBottle({ scene: this.scene, world: this.world, position: L.oilBottle, yaw: L.oilBottle.yaw });
    for (const can of [this.petrolCan, this.premixCan]) {
      this.interaction.add({
        target: can.proxy,
        isAvailable: () => !this.handsFull,
        prompt: () => `Pick up the ${can === this.premixCan ? 'yellow' : 'red'} jerry can (${can.litres.toFixed(1)} L, ${ratioText(can.oil)})`,
        interact: () => can.pickUp(this.camera),
      });
    }
    this.interaction.add({
      target: this.oilBottle.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Two-stroke oil: bring a jerry can to add some' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to add oil to the can (${ratioText(this.can.oil)})` };
      },
      interact: () => {},
      hold: (dt) => this.can.held && this.can.addOil(this.oilBottle.params.pourRate * dt) > 0,
    });
    this.interaction.add({
      target: this.fuelTank.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Petrol tank: bring the jerry can to fill it' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to fill the jerry can (${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${ratioText(this.can.oil)})` };
      },
      interact: () => {},
      hold: (dt) => this.can.held && this.can.fill(this.can.params.fillRate * dt) > 0,
    });

    // A toolbox by the petrol tank, for tinkering with the quads (see workshop.js).
    this.toolbox = new Toolbox({ scene: this.scene, world: this.world, position: L.toolbox, yaw: L.toolbox.yaw });
    this.toolbox.model.position.y += L.toolbox.lift ?? 0; // up on the barn workbench
    this.workshop = new Workshop(this);
    this.bench = new Bench(this);
    // A hosepipe for washing the mud off.
    this.hose = new Hose({ scene: this.scene, world: this.world, position: L.hose, yaw: L.hose.yaw });
    // The green quad's winch, for pulling a stuck quad out of a bog.
    const winchUnit = this.units.find((u) => u.spec.winch);
    this.winch = winchUnit ? new Winch({ scene: this.scene, unit: winchUnit }) : null;
    this.winchReel = false;
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
    registerTuning('Oil bottle', this.oilBottle.params, OIL_BOTTLE_PARAM_RANGES);
    registerTuning('Hose', this.hose.params, HOSE_PARAM_RANGES);
    registerTuning('Favour', this.favour.p, FAVOUR_PARAM_RANGES);
    this.wearLedger ??= new WearLedger();
    registerTuning('Who wore it out', this.wearLedger.p, LEDGER_PARAM_RANGES);
    registerTuning('Pranks', this.pranks.p, PRANK_PARAM_RANGES);
    registerTuning('Rev-offs', this.revOff.p, REVOFF_PARAM_RANGES);
    registerTuning('Jump leads', this.leads.params, JUMP_LEAD_PARAM_RANGES);
    registerTuning('Skills', this.skills.p, SKILL_PARAM_RANGES);
    registerTuning('Places', this.places.p, PLACE_PARAM_RANGES);
    registerTuning('Hayloft', this.loftParams, LOFT_PARAM_RANGES);
    registerTuning('Favours asked', this.requests.p, REQUEST_PARAM_RANGES);
    if (this.winch) registerTuning('Winch', this.winch.params, WINCH_PARAM_RANGES);
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
    const speak = (speaker, text, opts) => (byId[speaker]?.params.voice ? byId[speaker].voice.speak(text, opts) : 0);
    this.banter.update(dt, triggers, speak, this.talkFloor.left <= 0 && !this.menu.isOpen);
    this.talkFloor.banter = this.banter.busy;
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
    return this.premixCan?.held ? this.premixCan : this.petrolCan;
  }

  /** Pouring this can into that quad is a mistake: 'straight' petrol in a two-stroke, 'premix' in a four-stroke. */
  mixWrongFor(quad, can) {
    if (quad.engine.params.strokes === 2) return can.oil < 0.002 ? 'straight' : null;
    return can.oil > 0.004 ? 'premix' : null;
  }

  get handsFull() {
    return this.petrolCan.held || this.premixCan.held || this.hose.held || this.toolbox.held || this.leads.held || this.winch?.state === 'carried';
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
    for (const unit of this.units) {
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
      quads: this.units.map((u) => ({
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

  // Pranks -----------------------------------------------------------------

  /** What the prank logic needs to know about the farm right now. */
  prankContext(ridden) {
    const item = (thing, name) => ({ x: thing.model.position.x, z: thing.model.position.z, held: thing.held, home: this.itemHome[name] ?? thing.model.position });
    return {
      you: { x: this.player.position.x, z: this.player.position.z, riding: ridden?.spec.id ?? null },
      girls: this.companions.map((c) => ({ id: c.character.id, free: c.fsm.is('idle') && !this.menu.isOpen, mood: this.favour.mood(c.character.id) })),
      quads: this.units.map((u) => ({
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
    const quad = a.quad ? this.units.find((u) => u.spec.id === a.quad).quad : null;
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
    const friend = c.others().find((o) => o.fsm.is('idle') && o.getActions(this.units.map((u) => u.quad)).find((x) => x.kind === action.kind && x.quad === action.quad));
    const refusable = ['giveRide', 'follow', 'drive', 'start', 'mount', 'mountRack'].includes(action.kind);
    if (friend && refusable && Math.random() < Math.max(this.favour.refuseChance(c.character.id), this.requests.refuseChance(c.character.id))) {
      c.voice.say('refuseRequest', { force: true });
      const take = friend.getActions(this.units.map((u) => u.quad)).find((x) => x.kind === action.kind && x.quad === action.quad);
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
    const actions = c.getActions(this.units.map((u) => u.quad));
    if (!actions.length) {
      this.hud.toast('She\'s busy');
      return;
    }
    // She answers when you ask her something.
    const answer = (a) => () => this.askHer(c, a);
    // On the wheel: anything not about a particular quad, then a slice for each
    // quad (nearest her first) opening a ring of what she could do with it.
    const options = actions.filter((a) => !a.quad).map((a) => ({ label: a.label, run: answer(a) }));
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
    quad.setRider(null, null);
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
    if (input.wasPressed('KeyM')) {
      this.audioHub.params.muted = !this.audioHub.params.muted;
      this.hud.toast(this.audioHub.params.muted ? 'Sound off' : 'Sound on', 1.2);
    }

    for (const unit of this.units) unit.quad.setRemote(null);
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
    this.skills.update(dt);
    this.updateRequests(dt, ridden);
    this.updatePlaces(dt);
    this.updatePranks(dt, ridden);
    this.updateRevOff(dt, ridden);
    this.updateRockPrank(dt);
    this.updateBanter(dt, ridden);
    for (const c of this.companions) {
      c.update(dt, c.quad.unit.vibration, {
        position: this.camera.position,
        isRiding: this.player.isRiding,
        talking: this.menu.isOpen && this.talkingTo === c,
      });
      c.sounds.ensure();
      c.voice.update(dt, {
        listener: this.camera.position,
        ridden,
        units: this.units,
        drivers: this.drivers,
        ledger: this.wearLedger,
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
    this.updateHose(dt);
    this.updateWinch();
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
    if (this.winch?.state === 'carried') {
      this.hud.setStatus('Winch hook\nE on a quad to hook it on, X to put it back');
    } else if (this.hose.held) {
      this.hud.setStatus('Hose\nHold E to spray, G to put it back');
    } else if (this.leads.held) {
      this.hud.setStatus('Jump leads\nE on a quad to clamp one end, then another quad for the other\nG to put them down');
    } else if (this.toolbox.held) {
      this.hud.setStatus('Toolbox\nTake it to a quad that is switched off\nG to put it down');
    } else if (this.can.held) {
      this.hud.setStatus(`Jerry can  ${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L, ${ratioText(this.can.oil)}\nG to put it down`);
    } else {
      this.hud.setStatus('');
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

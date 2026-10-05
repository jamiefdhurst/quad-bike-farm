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
import { QUAD_SPECS } from './vehicle/quadSpecs.js';
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
import { Banter } from './npc/banter.js';
import { RideOffer, pickOfferer } from './npc/rideOffer.js';
import { BANTER } from './npc/banterLines.js';
import { BanterWatch } from './npc/banterWatch.js';
import { JerryCan, DEFAULT_JERRY_CAN_PARAMS, JERRY_CAN_PARAM_RANGES } from './items/jerryCan.js';
import { FuelTank } from './items/fuelTank.js';
import { Toolbox } from './items/toolbox.js';
import { Hose, HOSE_PARAM_RANGES } from './items/hose.js';
import { Winch, WINCH_PARAM_RANGES } from './items/winch.js';
import { Weather, pickWeatherKind } from './world/weather.js';
import { Rain } from './effects/rain.js';
import { washMud } from './effects/mudBuildUp.js';
import { Workshop } from './workshop/workshop.js';
import { Interaction } from './interaction/interaction.js';
import { Wheel } from './interaction/wheel.js';
import { Hud } from './hud/hud.js';
import { DebugGui } from './debug/debugGui.js';

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
    const { placed: spawns, home } = randomiseQuadSpawns(this.world.spawn, QUAD_SPECS.length, random);

    this.units = QUAD_SPECS.map(
      (spec, i) =>
        new QuadUnit({
          spec,
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
            return { text: `Hold E to fill the ${unit.label} (${pct}%)   ·   G put the can down` };
          }
          if (quad.isTipped) return `Right the ${unit.label}`;
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger && this.herOnBack(quad)) return { text: `${this.herAtTheFront(quad).name}'s driving and ${this.herOnBack(quad).name}'s on the back: no room` };
          if (this.herAtTheFront(quad) && quad.hasPillion && !quad.passenger) return `Get on the back (${this.herAtTheFront(quad).name}'s driving)`;
          const winchKey = this.winch?.unit === unit && this.winch.state === 'stowed' ? '   X winch cable' : '';
          return {
            action: `Ride the ${unit.label}`,
            keys: [['K', 'Ignition'], ['R', 'Start'], ['Q Z', 'Choke'], ['F', 'Fuel tap'], ...(this.canSitOnBack(quad) ? [['B', 'Sit on the back']] : []), ...(winchKey ? [['X', 'Winch cable']] : [])],
          };
        },
        interact: () => {
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
            }
            return false;
          }
          if (!this.can.held || this.tooFastToMount(quad)) return false;
          const wanted = Math.min(this.can.params.pourRate * dt, quad.fuel.space);
          return quad.fuel.add(this.can.take(wanted)) > 0;
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
    this.can = new JerryCan({
      scene: this.scene,
      world: this.world,
      position: canSpot,
      yaw: canSpot.yaw,
      params: { ...DEFAULT_JERRY_CAN_PARAMS },
    });
    this.interaction.add({
      target: this.can.proxy,
      isAvailable: () => !this.handsFull,
      prompt: () => `Pick up the jerry can (${this.can.litres.toFixed(1)} L)`,
      interact: () => this.can.pickUp(this.camera),
    });
    this.interaction.add({
      target: this.fuelTank.proxy,
      prompt: () => {
        if (!this.can.held) return { text: 'Petrol tank: bring the jerry can to fill it' };
        if (this.can.space < 0.01) return { text: 'The jerry can is full' };
        return { text: `Hold E to fill the jerry can (${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L)` };
      },
      interact: () => {},
      hold: (dt) => this.can.held && this.can.fill(this.can.params.fillRate * dt) > 0,
    });

    // A toolbox by the petrol tank, for tinkering with the quads (see workshop.js).
    this.toolbox = new Toolbox({ scene: this.scene, world: this.world, position: L.toolbox, yaw: L.toolbox.yaw });
    this.workshop = new Workshop(this);
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
    this.interaction.add({
      target: this.toolbox.proxy,
      isAvailable: () => !this.handsFull,
      prompt: () => 'Pick up the toolbox',
      interact: () => this.toolbox.pickUp(this.camera),
    });

    // Start facing the quad she's standing by, wherever it ended up.
    const q = this.homeUnit.quad.position;
    const p = this.player.position;
    this.player.yaw = Math.atan2(-(q.x - p.x), -(q.z - p.z));

    registerTuning('Sound', this.audioHub.params, SOUND_PARAM_RANGES);
    registerTuning('Jerry can', this.can.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Hose', this.hose.params, HOSE_PARAM_RANGES);
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
    const unit = this.boardUnit;
    const waiting = !!unit && this.player.seat === 'pillion' && unit.quad.speed < 0.5 && !this.menu.isOpen && !this.passengerPlan && !this.herOn(unit.quad);
    if (!offer.update(dt, waiting)) return;
    const girls = this.companions.filter((c) => c.canOfferRide(unit.quad)).map((c) => ({ c, distance: c.root.position.distanceTo(unit.quad.position) }));
    const pick = pickOfferer(girls);
    if (!pick) return offer.rest(); // nobody free: try again later
    pick.c.offerRide(unit.quad);
    this.offeredBy = pick.c;
  }

  /** On the back while she drives. */
  mountPillion(unit) {
    if (this.player.isRiding) return;
    this.player.mount(unit.quad, 'pillion');
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
    const triggers = this.banterWatch.triggers(dt, { companions: this.companions, ridden, you: this.camera.position, wheelOpen: this.menu.isOpen });
    const byId = Object.fromEntries(this.companions.map((c) => [c.character.id, c]));
    const speak = (speaker, text, opts) => (byId[speaker]?.params.voice ? byId[speaker].voice.speak(text, opts) : 0);
    this.banter.update(dt, triggers, speak, this.talkFloor.left <= 0 && !this.menu.isOpen);
    this.talkFloor.banter = this.banter.busy;
  }

  /** Rain round you and its sound, and the wind on the exhaust smoke. */
  updateWeather(dt) {
    const w = this.weather;
    this.rain.update(dt, this.camera, w.rain, w.wind);
    this.audioHub.setRain(w.rain);
    for (const unit of this.units) {
      const s = unit.smoke.params;
      s.baseWindX ??= s.windX;
      s.baseWindZ ??= s.windZ;
      s.windX = s.baseWindX * w.wind;
      s.windZ = s.baseWindZ * w.wind;
    }
  }

  /** Carrying the can, the hose, the toolbox or the winch hook. */
  get handsFull() {
    return this.can.held || this.hose.held || this.toolbox.held || this.winch?.state === 'carried';
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
    this.openWheel(`Ask ${c.name} to`, actions, c);
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
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

  // Companion menu ---------------------------------------------------------

  openCompanionMenu(c) {
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
    const answer = (a) => () => (a.run(), c.voice.onRequest(a.kind));
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
    this.menu.open(title, options);
  }

  closeMenu() {
    if (this.menu.isOpen) this.menu.close();
    this.player.lookEnabled = true;
    this.player.moveEnabled = true;
  }

  // Riding ---------------------------------------------------------------

  mount(unit) {
    if (this.player.isRiding || this.tooFastToMount(unit.quad)) return;
    this.player.mount(unit.quad);
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
      if (input.wasPressed('KeyE')) this.tryDismount();
    } else if (this.workshop.isOpen) {
      this.workshop.handleInput(input);
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
        menuOpen: this.menu.isOpen,
        talkingToHer: this.menu.isOpen && this.talkingTo === c,
        weather: this.weather,
        pouring,
      });
    }
    const board = this.boardUnit;
    if (!this.debugCamera) this.player.update(dt, alpha, board ? board.vibration : null);
    this.can.pouring = pouring;
    this.can.update(dt);
    this.updateHose(dt);
    this.updateWinch();
    this.workshop.update(dt);
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
    this.hud.setPrompt(typeof p === 'string' ? (p ? { action: p } : null) : p.action ? p : p.text);
    // No readout for the quad: its dash is all you get.
    if (this.winch?.state === 'carried') {
      this.hud.setStatus('Winch hook\nE on a quad to hook it on, X to put it back');
    } else if (this.hose.held) {
      this.hud.setStatus('Hose\nHold E to spray, G to put it back');
    } else if (this.toolbox.held) {
      this.hud.setStatus('Toolbox\nTake it to a quad that is switched off\nG to put it down');
    } else if (this.can.held) {
      this.hud.setStatus(`Jerry can  ${this.can.litres.toFixed(1)} / ${this.can.params.capacity} L\nG to put it down`);
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

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
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from './audio/audioParams.js';
import { Companion } from './npc/companion.js';
import { DEFAULT_COMPANION_PARAMS, COMPANION_PARAM_RANGES } from './npc/companionParams.js';
import { JerryCan, DEFAULT_JERRY_CAN_PARAMS, JERRY_CAN_PARAM_RANGES } from './items/jerryCan.js';
import { FuelTank } from './items/fuelTank.js';
import { Interaction } from './interaction/interaction.js';
import { Menu } from './interaction/menu.js';
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
    this.menu = new Menu(document.getElementById('hud'));
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

    // Where things start varies a little each game; ?seed=N repeats a layout.
    this.seed = startSeed();
    const random = createRandom(this.seed);
    console.info(`Layout seed ${this.seed} (add ?seed=${this.seed} to the URL to repeat it)`);
    const spawns = randomiseQuadSpawns(this.world.spawn, QUAD_SPECS.length, random);

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
        .map((u) => `${u.name} idle ${u.idleRpm} rpm, roughness ${u.variation.roughness.toFixed(2)}, ${u.variation.litres.toFixed(1)} L`)
        .join('; ')}`,
    );
    this.updateSmokeScale();
    this.lastUnit = this.units[0];

    this.companion = new Companion({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      quad: this.units[0].quad,
      gltf: this.models.companion,
      params: { ...DEFAULT_COMPANION_PARAMS },
    });
    this.interaction.add({
      target: this.companion.proxy,
      prompt: () => 'Talk to her',
      interact: () => this.openCompanionMenu(),
    });

    for (const unit of this.units) {
      const quad = unit.quad;
      unit.interaction = this.interaction.add({
        unit,
        target: quad.proxy,
        prompt: () => {
          if (this.can.held) {
            const pct = Math.round(quad.fuel.level * 100);
            if (quad.fuel.space < 0.01) return { text: `The ${unit.label} is full   ·   G put the can down` };
            if (this.can.litres < 0.01) return { text: 'The can is empty   ·   G put the can down' };
            return { text: `Hold E to fill the ${unit.label} (${pct}%)   ·   G put the can down` };
          }
          if (quad.isTipped) return `Right the ${unit.label}`;
          return `Ride the ${unit.label}   ·   K ignition   R start   Q/Z choke   F fuel tap`;
        },
        interact: () => {
          if (this.can.held) return; // E is for pouring while you're holding the can
          if (quad.isTipped) quad.rightItself();
          else this.mount(unit);
        },
        hold: (dt) => {
          if (!this.can.held) return false;
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
      isAvailable: () => !this.can.held,
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

    // Start facing the quad she's standing by, wherever it ended up.
    const q = this.units[0].quad.position;
    const p = this.player.position;
    this.player.yaw = Math.atan2(-(q.x - p.x), -(q.z - p.z));

    registerTuning('Sound', this.audioHub.params, SOUND_PARAM_RANGES);
    registerTuning('Jerry can', this.can.params, JERRY_CAN_PARAM_RANGES);
    registerTuning('Player', this.player.params, PLAYER_PARAM_RANGES);
    registerTuning('Companion', this.companion.params, COMPANION_PARAM_RANGES);
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
    this.hud.toggleHelp(true);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // Which quad -------------------------------------------------------------

  /** The quad the player is riding, if any. */
  get riddenUnit() {
    return this.player.isRiding ? this.player.vehicle.unit : null;
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

  openCompanionMenu() {
    const actions = this.companion.getActions(this.units.map((u) => u.quad));
    if (!actions.length) {
      this.hud.toast('She\'s busy');
      return;
    }
    this.menu.open('Ask her to', actions);
    this.player.lookEnabled = false;
    this.player.moveEnabled = false;
  }

  closeMenu() {
    if (this.menu.isOpen) this.menu.close();
    this.player.lookEnabled = true;
    this.player.moveEnabled = true;
  }

  // Riding ---------------------------------------------------------------

  mount(unit) {
    if (this.player.isRiding) return;
    this.player.mount(unit.quad);
    unit.quad.setRider(this.player, this.input);
    this.lastUnit = unit;
    this.input.takeWheelSteps();
  }

  tryDismount() {
    const quad = this.riddenUnit.quad;
    if (Math.abs(quad.forwardSpeed) > this.player.params.dismountSpeed) {
      this.hud.toast('Slow down to get off');
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

  /** Free spot beside the bike for the player's feet, trying left, right, behind, then in front. */
  findDismountSpot(quad) {
    const RAPIER = this.RAPIER;
    const shape = new RAPIER.Capsule(PLAYER_CAPSULE.halfHeight, PLAYER_CAPSULE.radius);
    const terrain = this.world.terrain.collider;
    const candidates = [
      [1.0, -0.15],
      [-1.0, -0.15],
      [0, -1.7],
      [0, 1.8],
    ];
    for (const [lx, lz] of candidates) {
      const p = quad.localToWorld(lx, 0, lz);
      const feetY = this.world.heightAt(p.x, p.z) + 0.05;
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
    if (this.player.isRiding) {
      this.interaction.clear();
      this.riddenUnit.quad.handleFrameInput(dt);
      if (input.wasPressed('KeyE')) this.tryDismount();
    } else if (this.menu.isOpen) {
      this.menu.handleInput(input);
      if (!this.menu.isOpen) this.closeMenu();
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
      // Holding E pours fuel or fills the can.
      if (focused?.hold && input.isDown('KeyE') && focused.hold(dt)) pouring = true;
      if (this.can.held && input.wasPressed('KeyG')) this.putCanDown();
    }

    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    const alpha = this.accumulator / FIXED_DT;

    for (const unit of this.units) unit.update(dt, alpha);
    const ridden = this.riddenUnit;
    this.companion.update(dt, this.companion.quad.unit.vibration, {
      position: this.camera.position,
      isRiding: this.player.isRiding,
      talking: this.menu.isOpen,
    });
    if (!this.debugCamera) this.player.update(dt, alpha, ridden ? ridden.vibration : null);
    this.can.pouring = pouring;
    this.can.update(dt);
    this.audioHub.setPouring(pouring, dt);
    this.audioHub.update(dt, this.camera);
    this.world.update(dt, ridden ? ridden.quad.position : this.player.position, this.camera);
    this.updateHud(dt);

    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  fixedUpdate(dt) {
    this.player.fixedUpdate(dt);
    for (const unit of this.units) unit.fixedUpdate(dt);
    this.physics.step();
    for (const unit of this.units) unit.recordTransform();
  }

  updateHud(dt) {
    const f = this.interaction.focused;
    // A prompt is either an E action (a string) or plain text ({ text }).
    const p = f ? f.prompt() : '';
    this.hud.setPrompt(typeof p === 'string' ? (p ? `E  ${p}` : '') : p.text);
    const unit = this.riddenUnit ?? this.focusedUnit;
    if (unit) {
      const e = unit.engine;
      const quad = unit.quad;
      const mph = Math.abs(quad.forwardSpeed) * 2.237;
      const bars = Math.round(e.temperature * 10);
      const fuelBars = Math.round(quad.fuel.level * 10);
      const stalledNote = e.lastStallReason === 'noFuel' ? ' (out of fuel?)' : ' (R to restart)';
      this.hud.setStatus(
        [
          unit.name,
          `Engine   ${e.state}${e.state === 'stalled' ? stalledNote : ''}   (warm idle ${unit.idleRpm} rpm, roughness ${unit.engine.params.baseRoughness.toFixed(2)})`,
          `Temp     ${'▮'.repeat(bars)}${'▯'.repeat(10 - bars)}`,
          `Fuel     ${'▮'.repeat(fuelBars)}${'▯'.repeat(10 - fuelBars)}  ${quad.fuel.litres.toFixed(1)} L, tap ${quad.fuel.tap.toUpperCase()}`,
          `Choke    ${Math.round(quad.choke * 100)}%`,
          `Speed    ${mph.toFixed(0)} mph${quad.reverse ? '  R' : ''}`,
          ...(this.can.held ? [`Can      ${this.can.litres.toFixed(1)} L`] : []),
        ].join('\n'),
      );
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

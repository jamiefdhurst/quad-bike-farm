import * as THREE from 'three';
import { Input } from './core/input.js';
import { registerTuning } from './core/tuning.js';
import { loadModels } from './world/assets.js';
import { World } from './world/world.js';
import { Player, PLAYER_CAPSULE } from './player/player.js';
import { DEFAULT_PLAYER_PARAMS, PLAYER_PARAM_RANGES } from './player/playerParams.js';
import { EngineModel } from './engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS, ENGINE_PARAM_RANGES } from './engine/engineParams.js';
import { Quad } from './vehicle/quad.js';
import { DEFAULT_VEHICLE_PARAMS, VEHICLE_PARAM_RANGES } from './vehicle/vehicleParams.js';
import { VibrationModel } from './vibration/vibrationModel.js';
import { DEFAULT_VIBRATION_PARAMS, VIBRATION_PARAM_RANGES } from './vibration/vibrationParams.js';
import { EngineAudio } from './audio/engineAudio.js';
import { DEFAULT_AUDIO_PARAMS, AUDIO_PARAM_RANGES } from './audio/audioParams.js';
import { Companion } from './npc/companion.js';
import { DEFAULT_COMPANION_PARAMS, COMPANION_PARAM_RANGES } from './npc/companionParams.js';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS, SMOKE_PARAM_RANGES } from './effects/exhaustSmoke.js';
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

    this.engine = new EngineModel(DEFAULT_ENGINE_PARAMS);
    this.quad = new Quad({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      engine: this.engine,
      params: { ...DEFAULT_VEHICLE_PARAMS },
    });

    this.vibration = new VibrationModel({ ...DEFAULT_VIBRATION_PARAMS });
    this.smoke = new ExhaustSmoke(this.scene, (x, z) => this.world.heightAt(x, z), { ...DEFAULT_SMOKE_PARAMS });
    this.updateSmokeScale();
    this.audio = new EngineAudio({ ...DEFAULT_AUDIO_PARAMS });
    this.input.on('firstinteraction', () => this.audio.unlock());

    this.companion = new Companion({
      scene: this.scene,
      physics: this.physics,
      RAPIER: this.RAPIER,
      world: this.world,
      quad: this.quad,
      gltf: this.models.companion,
      params: { ...DEFAULT_COMPANION_PARAMS },
    });
    this.interaction.add({
      target: this.companion.proxy,
      prompt: () => 'Talk to her',
      interact: () => this.openCompanionMenu(),
    });

    this.interaction.add({
      target: this.quad.proxy,
      prompt: () => (this.quad.isTipped ? 'Right the quad' : 'Ride the quad'),
      interact: () => (this.quad.isTipped ? this.quad.rightItself() : this.mount()),
    });

    registerTuning('Engine', this.engine.params, ENGINE_PARAM_RANGES);
    registerTuning('Vibration', this.vibration.params, VIBRATION_PARAM_RANGES);
    registerTuning('Audio', this.audio.params, AUDIO_PARAM_RANGES);
    registerTuning('Smoke', this.smoke.params, SMOKE_PARAM_RANGES);
    registerTuning('Vehicle', this.quad.params, VEHICLE_PARAM_RANGES, {
      onChange: () => this.quad.physics.applyParams(),
    });
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
      this.audio.unlock();
      this.input.requestPointerLock();
    });
    this.input.on('lockchange', (locked) => {
      overlay.classList.toggle('hidden', locked);
      if (!locked) this.closeMenu();
    });
    this.hud.toggleHelp(true);
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // Companion menu ---------------------------------------------------------

  openCompanionMenu() {
    const actions = this.companion.getActions();
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

  mount() {
    if (this.player.isRiding) return;
    this.player.mount(this.quad);
    this.quad.setRider(this.player, this.input);
    this.input.takeWheelSteps();
  }

  tryDismount() {
    if (Math.abs(this.quad.forwardSpeed) > this.player.params.dismountSpeed) {
      this.hud.toast('Slow down to get off');
      return;
    }
    const spot = this.findDismountSpot();
    if (!spot) {
      this.hud.toast('No room to get off here');
      return;
    }
    this.quad.setRider(null, null);
    this.player.dismount(spot, this.quad.yaw + Math.PI);
  }

  /** Free spot beside the bike for the player's feet, trying left, right, behind, then in front. */
  findDismountSpot() {
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
      const p = this.quad.localToWorld(lx, 0, lz);
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

  // Loop -----------------------------------------------------------------

  frame() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), MAX_FRAME_DT);
    const input = this.input;

    if (input.wasPressed('KeyH')) this.hud.toggleHelp();
    if (input.wasPressed('Backquote')) this.debugGui.toggle();
    if (input.wasPressed('KeyM')) {
      this.audio.params.muted = !this.audio.params.muted;
      this.hud.toast(this.audio.params.muted ? 'Sound off' : 'Sound on', 1.2);
    }

    if (this.player.isRiding) {
      this.quad.handleFrameInput(dt);
      if (input.wasPressed('KeyE')) this.tryDismount();
      this.interaction.clear();
    } else if (this.menu.isOpen) {
      this.menu.handleInput(input);
      if (!this.menu.isOpen) this.closeMenu();
    } else {
      input.takeWheelSteps();
      const focused = this.interaction.update(this.player, this.player.params.interactRange);
      if (focused && input.wasPressed('KeyE')) focused.interact();
    }

    this.accumulator += dt;
    while (this.accumulator >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accumulator -= FIXED_DT;
    }
    const alpha = this.accumulator / FIXED_DT;

    this.engine.update(dt, this.quad.engineControls());
    this.vibration.update(dt, this.engine);
    this.quad.update(dt, alpha, this.vibration);
    this.companion.update(dt, this.vibration);
    this.smoke.update(dt, this.engine, this.quad.exhaustTip, this.quad.velocity);
    if (!this.debugCamera) this.player.update(dt, alpha, this.vibration);
    this.audio.update(dt, this.engine, this.quad.position, this.camera);
    this.world.update(dt, this.player.isRiding ? this.quad.position : this.player.position, this.camera);
    this.updateHud(dt);

    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }

  fixedUpdate(dt) {
    this.player.fixedUpdate(dt);
    this.quad.fixedUpdate(dt);
    this.physics.step();
    this.quad.recordTransform();
  }

  updateHud(dt) {
    const f = this.interaction.focused;
    this.hud.setPrompt(f ? f.prompt() : '');
    if (this.player.isRiding) {
      const e = this.engine;
      const mph = Math.abs(this.quad.forwardSpeed) * 2.237;
      const bars = Math.round(e.temperature * 10);
      this.hud.setStatus(
        [
          `Engine   ${e.state}${e.state === 'stalled' ? ' (R to restart)' : ''}`,
          `Temp     ${'▮'.repeat(bars)}${'▯'.repeat(10 - bars)}`,
          `Choke    ${Math.round(this.quad.choke * 100)}%`,
          `Speed    ${mph.toFixed(0)} mph${this.quad.reverse ? '  R' : ''}`,
        ].join('\n'),
      );
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
    this.smoke?.setViewport(window.innerHeight * this.renderer.getPixelRatio(), this.camera.fov);
  }
}

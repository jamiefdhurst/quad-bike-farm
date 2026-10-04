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
import { Interaction } from './interaction/interaction.js';
import { Hud } from './hud/hud.js';

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

    this.interaction.add({
      target: this.quad.proxy,
      prompt: () => (this.quad.isTipped ? 'Right the quad' : 'Ride the quad'),
      interact: () => (this.quad.isTipped ? this.quad.rightItself() : this.mount()),
    });

    registerTuning('Engine', this.engine.params, ENGINE_PARAM_RANGES);
    registerTuning('Vehicle', this.quad.params, VEHICLE_PARAM_RANGES);
    registerTuning('Player', this.player.params, PLAYER_PARAM_RANGES);

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
    overlay.addEventListener('click', () => this.input.requestPointerLock());
    this.input.on('lockchange', (locked) => overlay.classList.toggle('hidden', locked));
    this.renderer.setAnimationLoop(() => this.frame());
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

    if (this.player.isRiding) {
      this.quad.handleFrameInput();
      if (input.wasPressed('KeyE')) this.tryDismount();
      this.interaction.clear();
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
    this.quad.update(dt, alpha, null);
    if (!this.debugCamera) this.player.update(dt, alpha, null);
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
      this.hud.setStatus(
        [
          `Engine   ${e.state}${e.state === 'stalled' ? ' (R to restart)' : ''}`,
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
  }
}

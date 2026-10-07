import * as THREE from 'three';
import { buildQuadModel, poseSuspension, setHeadlights, setTaillights } from './quadModel.js';
import { FuelSystem } from './fuelSystem.js';
import { QuadPhysics, QUAD_LAYOUT } from './quadPhysics.js';
import { Drivetrain } from './drivetrain.js';
import { QuirkSet } from './quirks.js';
import { headlightLook, taillightLevel } from './headlight.js';
import { TyreSet } from './tyres.js';
import { frostAfter, frostedColour, DEFAULT_FROST_PARAMS } from './seatFrost.js';
import { ManualDrivetrain, gearLabel } from './manualDrivetrain.js';
import { AutoShifter } from './autoShifter.js';
import { poseTractorControls } from './tractorModel.js';
import { EngineLoad } from './engineLoad.js';
import { waterGulp } from '../engine/water.js';
import { AirFilter } from './airFilter.js';
import { CruiseControl } from './cruise.js';
import { Creep, mayCreep, DEFAULT_CREEP_PARAMS } from './creep.js';
import { Bog } from './bog.js';
import { Sump, hasSump, oilPressureLamp } from './sump.js';
import { Faults } from './faults.js';
import { reverseAllowed, chokeReach, DEFAULT_CONTROLS_PARAMS } from './controls.js';
import { advanceUsage, isNeutral, dashClock, lampStates } from './dashState.js';

// Height of the ground below the chassis origin with the bike at rest.
const GROUND_OFFSET = -0.36;
const CHOKE_STEP = 0.1;
const CHOKE_MORE_KEY = 'KeyQ';
const CHOKE_LESS_KEY = 'KeyZ';
// Holding a choke key steps again after this delay, then at this interval.
const CHOKE_REPEAT_DELAY = 0.35;
const CHOKE_REPEAT_INTERVAL = 0.12;
// The manual controls: Shift is the clutch, 1 to 4 the gears, 0 neutral and B reverse. The tractor also sets the quads' choke keys and
// automatic drive aside: Q and Z move its hand throttle and O pulls its stop knob.
const CLUTCH_KEYS = ['ShiftLeft', 'ShiftRight'];
const GEAR_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit0: 0, KeyB: -1 };
const HAND_THROTTLE_RATE = 0.35; // per second the hand throttle moves while its key is held
const HAND_THROTTLE_UP_KEY = 'KeyQ';
const HAND_THROTTLE_DOWN_KEY = 'KeyZ';
const STOP_KNOB_KEY = 'KeyO'; // not X (the tow chain and winch) or C (look back)
const NOTE_SECONDS = 2.5;

/**
 * The quad as a game object: rider controls, drivetrain, Rapier physics and
 * the visual model, with the engine model plugged in from outside.
 */
export class Quad {
  /**
   * @param {object} opts
   * @param {string} opts.label   How it's referred to in prompts, e.g. "red quad".
   * @param {object} opts.spawn   { x, z, yaw } where it starts.
   * @param {number} [opts.bodyColor]
   * @param {string} [opts.dashStyle]  One of DASH_STYLES, see dash.js.
   * @param {string} [opts.style]      Body style, see buildQuadModel.
   * @param {object} opts.fuelParams   See fuelSystem.js.
   */
  constructor({ scene, physics, RAPIER, world, engine, params, label = 'quad', spawn, bodyColor, dashStyle, style, scale = 1, solo = false, plateNumber, fuelParams, build, layout = QUAD_LAYOUT, groundOffset = GROUND_OFFSET, gearbox = null, tractor = false, proxy = null, wheelShake = 0.6, noHeadlight = false, steadyLights = false, reverseStyle = 'knee', chokeStyle = 'thumb', tapStyle = 'left', controlsParams = DEFAULT_CONTROLS_PARAMS }) {
    this.reverseStyle = reverseStyle; // where its reverse is and what it takes (controls.js)
    this.chokeStyle = chokeStyle;
    this.tapStyle = tapStyle;
    this.controlsParams = controlsParams;
    this.handOff = 1; // how much steering you keep while a hand is off the bars for the choke
    this.pushDir = 0; // set by the game while someone on foot shoves it along: +1 forwards, -1 backwards, 0 not
    this.pushLeft = 0; // seconds since it was last pushed, counting down: the roll watch doesn't blame anyone for a quad being pushed
    this.noHeadlight = noHeadlight; // the lamp is only for show (the yellow and orange): it never lights
    this.steadyLights = steadyLights; // a battery runs the headlight, so it doesn't follow the engine (headlight.js)
    this.wheelShake = wheelShake; // how much of the body's vibration the wheels share (the tractor's shake more than the quads', which share about 0.6 of it)
    this.scale = scale; // 1, or smaller for the kids' quad: the model and the physics chassis both shrink by this
    this.world = world;
    this.engine = engine;
    this.params = params;
    this.label = label;
    this.spawn = spawn;

    this.layout = layout;
    this.groundOffset = groundOffset; // chassis origin to ground, at rest
    this.model = build ? build({ dashStyle }) : buildQuadModel({ bodyColor, dashStyle, style, solo, plateNumber, chokeStyle, tapStyle });
    this.model.scale.setScalar(scale);
    this.dash = this.model.userData.dash;
    this.fuel = new FuelSystem(fuelParams);
    this.faults = new Faults();
    this.sump = hasSump({ ...engine.params, tractor }) ? new Sump() : null; // the four-strokes' engine oil; the game deals each its level (sump.js)
    this.sumpClock = 0;
    // A layout's outrigger wheels (the mini moto's) are never the flat one.
    if (layout.wheels.some((w) => w.outrigger) || layout.wheels.length !== 4) {
      this.faults.tyreWheels = layout.wheels.flatMap((w, i) => (w.outrigger ? [] : [i]));
      this.faults.wheelSides = layout.wheels.map((w) => ({ side: w.x >= 0 ? 1 : -1, front: !!w.front }));
    }
    this.filter = new AirFilter(); // clogs with mud and puddles; cleaned at the toolbox
    this.tripMiles = 0;
    this.usage = { hours: 0, odoMiles: 0 }; // what the hour meter and odometer show; the game sets the starting readings
    this.pod = null; // the accessory pod fitted to the bars, if any (see pods.js)
    scene.add(this.model);
    const part = (name) => this.model.getObjectByName(name);
    this.body = part('body');
    this.bodyRoot = part('bodyRoot');
    this.bodyRoot.position.y = this.groundOffset;
    this.handlebars = part('handlebars');
    this.handlebarsBase = this.handlebars.position.clone();
    this.fuelTap = part('fuelTap');
    this.chokeLever = part('chokeLever');
    this.riderHands = part('riderHands');
    this.cameraAnchor = part('cameraAnchor');
    this.pillionCameraAnchor = part('pillionCameraAnchor');
    this.pillionAnchor = part('pillionAnchor') ?? null; // every spec's model has one
    this.rackAnchor = part('rackAnchor') ?? null; // only quads with a front rack
    this.mugAnchor = part('mugAnchor') ?? null; // the same quads' rear rack: where a girl leaves her tea (items/mug.js)
    this.rackRider = null; // the girl sitting on the front rack, if any
    this.riderAnchor = part('riderAnchor');
    // Whoever sits on a smaller quad is still full size: undo the model's scale on the anchors people hang from.
    for (const a of [this.riderAnchor, this.pillionAnchor, this.rackAnchor, this.mugAnchor, this.cameraAnchor, this.pillionCameraAnchor]) a?.scale.setScalar(1 / scale);
    this.exhaustTip = part('exhaustTip');
    this.wheels = layout.wheels.map((w) => ({ ...w, topY: w.y ?? layout.topY, object: part(w.name), spin: part(w.name).getObjectByName('spin') }));
    // Wheel centre heights in bodyRoot space, for posing the suspension arms.
    this.wheelHeights = this.wheels.map(() => 0);
    this.exhaustFlap = part('exhaustFlap') ?? null; // the tractor's upright exhaust has a flap that lifts with each beat
    this.flap = 0; // how far it's lifted, 0..1

    // Invisible box used for "look at it and press E". Reaches about 1.45 m
    // off the ground so it's easy to target from a few metres away.
    const box = proxy ?? { w: 1.25, h: 1.45, d: 2.2 };
    this.proxy = new THREE.Mesh(
      new THREE.BoxGeometry(box.w, box.h, box.d),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.position.y = this.groundOffset + box.h / 2;
    this.model.add(this.proxy);

    const s = spawn;
    this.physics = new QuadPhysics(physics, RAPIER, params, {
      x: s.x,
      y: world.heightAt(s.x, s.z) - this.groundOffset * scale + 0.05 * scale,
      z: s.z,
      yaw: s.yaw,
    }, scale, layout);
    this.lightTime = 0;
    this.seatFrost = 0; // 0 bare to 1 white over; the game sets it on a freezing day, and sitting on it clears it (seatFrost.js)
    this.seatMaterial = this.model.userData.seatMaterial ?? null;
    this.seatBase = this.seatMaterial ? { color: this.seatMaterial.color.getHex(), roughness: this.seatMaterial.roughness } : null;
    this.shownFrost = 0;
    this.tyres = new TyreSet(); // pressures, brands and tread (tyres.js); the game deals this game's
    this.physics.tyres = this.tyres;
    this.tyres.useLayout(layout.wheels);
    this.physics.applyParams();
    // The tractor has a clutch pedal and a gearbox rather than a CVT; everything reads the same drivetrain fields.
    this.manual = !!gearbox; // a clutch and gearbox: the tractor and the manual quads
    this.tractor = tractor; // the tractor's own controls and body on top of that
    this.gearbox = gearbox;
    this.shifter = new AutoShifter(); // what the girls do with the clutch and lever when one of them drives
    this.drivetrain = this.manual ? new ManualDrivetrain(params, gearbox) : new Drivetrain(params);
    this.handSetting = gearbox?.handStart ?? 0; // the tractor's hand throttle, 0..1: it stays where it was put, even with nobody on it
    this.quirks = new QuirkSet(); // this game's oddities (quirks.js); the game gives it the ones it picked
    this.note = null; // something to tell whoever's at the controls, taken by the game (see takeNote)
    this.bog = new Bog(); // how far it's sunk into a bog (bog.js)
    this.towed = false; // on the end of the winch: brakes off
    this.engineLoad = new EngineLoad(params);
    this.cruise = new CruiseControl(params);
    this.creep = new Creep(DEFAULT_CREEP_PARAMS); // the tractor walking off by itself in first (creep.js)
    this.creeping = false;
    this.creepLimit = 0;
    this.creepStalled = false; // it has just stalled against something while creeping: the game reads this and clears it

    // Controls, set by the rider.
    this.rider = null;
    this.input = null;
    this.remoteInput = null; // set while someone on foot is looking at the bike
    this.helperStarter = false; // she's holding the starter button
    this.helperPull = false; // she's holding the pull-start cord
    this.lastLeft = null; // who last got off it and whether they set the parking brake: { who: 'you' | a girl's id, braked } (handbrake.js)
    this.parkBrake = false; // the parking brake: wheels locked, so the throttle only revs the engine (toggled with Space)
    this.helperThrottle = 0; // she's blipping the throttle (a quad's starting knack)
    this.churn = 0; // 0..1 the ground torn up under the wheels, whatever it is (a girl's doughnuts: npc/doughnuts.js): it acts as mud
    this.wheelie = 0; // radians she wants the nose up, a girl showing off (npc/showOff.js); wheelieShown eases towards it
    this.wheelieShown = 0;
    this.handThrottle = 0; // a girl on the back reaching round to open it over your hand (npc/throttleGrab.js)
    this.pullHeld = 0; // seconds the cord's been held, until it's let go (the yank)
    this.passenger = null; // you, riding on the back while she drives
    this.driver = null; // someone else at the controls (her), see setDriver()
    this.throttle = 0;
    this.brake = 0;
    this.steer = 0;
    this.reverse = false;
    this.choke = 0;
    this.starter = false;
    this.displayChoke = 0;
    this.displayRpm = 0;
    // Set while it carries on with nobody on it: { steer, stuckTime }, see carryOn().
    this.ghost = null;

    this.prevPos = new THREE.Vector3();
    this.currPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.currQuat = new THREE.Quaternion();
    this.recordTransform();
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
    this.model.position.copy(this.currPos);
    this.model.quaternion.copy(this.currQuat);
  }

  get hasRack() {
    return !!this.rackAnchor;
  }

  get hasPillion() {
    return !!this.pillionAnchor;
  }

  get forwardSpeed() {
    return this.physics.forwardSpeed;
  }

  get speed() {
    return this.physics.speed;
  }

  get position() {
    return this.model.position;
  }

  get velocity() {
    return this.physics.body.linvel();
  }

  get yaw() {
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
    return Math.atan2(fwd.x, fwd.z);
  }

  /** Sine of the climb: how far its nose points up (negative downhill). */
  get climb() {
    return new THREE.Vector3(0, 0, 1).applyQuaternion(this.currQuat).y;
  }

  /** True while all four wheels are off the ground. */
  get airborne() {
    return this.physics.airborne;
  }

  /** How upright it is: 1 level, 0 on its side. */
  get upY() {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.currQuat).y;
  }

  /** True when the bike is on its side or roof. */
  get isTipped() {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.currQuat);
    return up.y < 0.45;
  }

  setRider(rider, input) {
    this.rider = rider;
    this.input = input;
    this.riderHands.visible = !!rider;
    this.ghost = null;
    if (!rider) {
      this.throttle = 0;
      this.starter = false;
    }
  }

  /**
   * Someone other than the player at the controls: an object whose `controls`
   * ({ throttle, brake, steer, starter, reverse }, throttle and brake 0..1,
   * steer -1..1 positive left) are read each physics step in place of the
   * rider's keys. The player getting on takes over from it. Pass null to clear.
   */
  setDriver(driver) {
    this.driver = driver;
    this.ghost = null;
    if (!driver) this.churn = 0;
    if (!driver && this.tractor) this.shifter = new AutoShifter(); // Jess's go leaves her clumsy shifter behind
    if (!driver && this.manual && !this.input) this.parkInNeutral(); // she leaves it in neutral when she gets off
    if (!driver && !this.input) {
      this.throttle = 0;
      this.starter = false;
      this.reverse = false;
    }
  }

  /** One step of her gear changing: where the lever goes and whether she has the clutch down. */
  shift(dt, throttle, brake, fwd) {
    const d = this.drivetrain;
    const out = this.shifter.update(dt, { gear: d.gear, gears: this.gearbox.gears, topSpeed: (g) => d.topSpeed(g), speed: Math.abs(fwd), throttle, brake, reverse: !!this.driver?.controls.reverse });
    this.clutchHeld = out.clutch;
    if (out.gear !== d.gear) d.select(out.gear, true);
    return throttle * (out.throttleScale ?? 1); // a novice sometimes comes off the throttle as the clutch bites
  }

  /** Neutral, clutch up, with nothing left for the shifter to finish. */
  parkInNeutral() {
    this.drivetrain.setGear(0);
    this.shifter.reset();
    this.clutchHeld = false;
  }

  /** True while it's driving itself after the rider jumped off. */
  get isGhostRiding() {
    return !!this.ghost;
  }

  /**
   * The rider has just jumped off at speed: hold the speed and steering it had,
   * as if the throttle and bars were stuck where they were. Physics does the
   * rest. Lets go when it tips, stalls or gets stuck. Call after setRider(null).
   * Returns whether it carried on.
   */
  carryOn(throttle = 0) {
    if (this.rider || !this.engine.isRunning || this.isTipped) return false;
    const speed = Math.abs(this.forwardSpeed);
    if (speed < 0.5) return false;
    this.cruise.engage(speed, throttle);
    this.ghost = { steer: this.steer, stuckTime: 0 };
    return true;
  }

  /**
   * The rider got off a quad that wasn't going anywhere while they had the throttle open: it stays revving, as if the cable
   * stuck there. Call after setRider(null). Lets go when it stalls or tips, or you get back on. Returns whether it held.
   */
  holdRev(throttle) {
    if (this.rider || !this.engine.isRunning || this.isTipped || throttle < this.params.revHoldMin) return false;
    this.ghost = { steer: this.steer, stuckTime: 0, hold: throttle };
    return true;
  }

  /** Lets go of the stuck throttle and bars; it coasts and parks like any riderless quad. */
  releaseGhost() {
    this.ghost = null;
    this.throttle = 0;
  }

  /** Cruise throttle for this step, or null once it's time to let go. */
  ghostThrottle(dt, fwd) {
    const p = this.params;
    const g = this.ghost;
    if (this.isTipped || !this.engine.isRunning) return null;
    if (g.hold !== undefined) return g.hold; // revving on the spot: the throttle stays where it was left
    // Moving the other way to the way it was going (bounced off something) counts as stuck.
    const along = this.reverse ? -fwd : fwd;
    g.stuckTime = along < this.cruise.target * p.ghostStuckSpeed ? g.stuckTime + dt : 0;
    if (g.stuckTime > p.ghostStuckTime) return null;
    return this.cruise.update(dt, along, this.reverse ? p.reverseThrottle : 1);
  }

  /**
   * Lets someone standing next to the bike work the ignition, starter and choke
   * while looking at it. Pass null when they look away.
   */
  setRemote(input) {
    this.remoteInput = input;
  }

  /** Discrete inputs (key presses), handled once per frame, from the rider or someone beside the bike. */
  handleFrameInput(dt) {
    const input = this.input ?? this.remoteInput;
    if (!input) return;
    if (this.input) input.takeWheelSteps();
    if (input.wasPressed('KeyK')) this.engine.toggleIgnition();
    if (input.wasPressed('KeyF') && !this.fuel.params.noTap) {
      if (this.quirks.pressTap()) this.fuel.cycleTap();
      else this.say('The fuel tap is stiff: keep working it');
    }
    if (this.manual) this.manualKeys(input);
    // An automatic's reverse is a button, pressed with the brake held (the two-strokes have none).
    if (this.input && !this.manual && !this.tractor && input.wasPressed('KeyB') && this.reverseCheck(input)) this.reverse = true;
    this.handOff = 1;
    if (!this.tractor) {
      const reach = chokeReach(this.chokeStyle, Math.abs(this.forwardSpeed), !!this.input, this.controlsParams);
      const keys = [CHOKE_MORE_KEY, CHOKE_LESS_KEY];
      if (reach.ok) {
        if (keys.some((k) => input.isDown(k))) this.handOff = reach.steer; // a hand is off the bars while you reach for it
        this.chokeKey(dt, input, CHOKE_MORE_KEY, 1);
        this.chokeKey(dt, input, CHOKE_LESS_KEY, -1);
      } else if (keys.some((k) => input.wasPressed(k))) this.say(reach.why);
    }
    if (input.wasPressed('KeyT') && this.isTipped) this.rightItself();
  }

  /** The gear lever, and the tractor's stop knob. */
  manualKeys(input) {
    if (this.tractor && input.wasPressed(STOP_KNOB_KEY)) this.engine.stopKnob();
    if (!this.input) return; // standing beside it you can reach the knob but not the lever
    for (const [code, gear] of Object.entries(GEAR_KEYS)) {
      if (!input.wasPressed(code)) continue;
      if (gear < 0) {
        const ok = this.reverseCheck(input);
        if (!ok) continue;
      }
      const r = this.drivetrain.select(gear);
      if (r === 'clutch') this.say('Clutch in (hold Shift) to change gear');
      else if (r === 'missed') this.say('Missed the gear: it is in neutral. Clutch down a moment longer');
    }
  }

  /** Whether this quad's reverse can be engaged right now by whoever is at it; says why not if it can't (controls.js). */
  reverseCheck(input) {
    const r = reverseAllowed(this.reverseStyle, { speed: Math.abs(this.forwardSpeed), steering: input.isDown('KeyA') || input.isDown('KeyD'), braking: input.isDown('KeyS') }, this.controlsParams);
    if (!r.ok) this.say(r.why);
    return r.ok;
  }

  /** A manual's starter interlock: in neutral or with the clutch down, never in gear with the pedal up. The girls just take it out of gear. */
  starterAllowed() {
    if (!this.manual || this.drivetrain.mayCrank) return true;
    if (!this.input && !this.remoteInput) {
      this.drivetrain.setGear(0);
      return true;
    }
    this.say('It is in gear: hold Shift for the clutch, or put it in neutral (0), to use the starter');
    return false;
  }

  /** Tells whoever's at the controls something, for a moment; the game shows it (takeNote). */
  say(text) {
    if (this.note?.text === text) return; // still showing it
    this.note = { text, left: NOTE_SECONDS };
  }

  /** The current note if it's new since last asked, else null. */
  takeNote() {
    const n = this.note;
    if (!n || n.shown) return null;
    n.shown = true;
    return n.text;
  }

  /** One choke step per press, repeating while the key is held. */
  chokeKey(dt, input, code, direction) {
    const timers = (this.chokeTimers ??= {});
    let step = false;
    if (input.wasPressed(code)) {
      step = true;
      timers[code] = CHOKE_REPEAT_DELAY;
    } else if (input.isDown(code)) {
      timers[code] -= dt;
      if (timers[code] <= 0) {
        step = true;
        timers[code] += CHOKE_REPEAT_INTERVAL;
      }
    }
    if (step) {
      this.choke = Math.round(THREE.MathUtils.clamp(this.choke + direction * CHOKE_STEP, 0, 1) * 10) / 10;
    }
  }

  fixedUpdate(dt) {
    const p = this.params;
    const fwd = this.forwardSpeed;
    let throttleInput = 0;
    let brakeInput = 0;
    let steerInput = 0;

    if (this.tractor && this.input) {
      // The tractor: foot throttle and brake, a hand throttle that stays put, a clutch pedal and a gear lever.
      const input = this.input;
      steerInput = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
      throttleInput = input.isDown('KeyW') ? 1 : 0;
      brakeInput = input.isDown('KeyS') ? 1 : 0;
      this.clutchHeld = CLUTCH_KEYS.some((k) => input.isDown(k));
      this.handSetting = THREE.MathUtils.clamp(
        this.handSetting + ((input.isDown(HAND_THROTTLE_UP_KEY) ? 1 : 0) - (input.isDown(HAND_THROTTLE_DOWN_KEY) ? 1 : 0)) * HAND_THROTTLE_RATE * dt,
        0,
        1,
      );
      this.starter = input.isDown('KeyR') && this.starterAllowed();
    } else if (this.input) {
      const input = this.input;
      const w = input.isDown('KeyW');
      const s = input.isDown('KeyS');
      steerInput = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
      this.starter = input.isDown('KeyR') && this.starterAllowed();
      if (this.manual) this.clutchHeld = CLUTCH_KEYS.some((k) => input.isDown(k));

      if (this.manual) {
        // The lever decides which way it goes: W is throttle and S the brake, never reverse.
        throttleInput = w ? 1 : 0;
        brakeInput = s ? 1 : 0;
      } else {
        if (w) {
          if (this.reverse && fwd < -0.3) brakeInput = 1;
          else {
            this.reverse = false;
            throttleInput = 1;
          }
        }
        if (s) {
          // With the reverse button pressed (handleFrameInput) S backs it up; otherwise S is only the brake.
          if (this.reverse) throttleInput = p.reverseThrottle;
          else brakeInput = 1;
        }
      }
      if (!this.reverse && !brakeInput) throttleInput = Math.max(throttleInput, this.handThrottle);
    } else {
      // Someone beside the bike can still hold the starter.
      this.starter = ((!!this.remoteInput && this.remoteInput.isDown('KeyR')) || this.helperStarter) && this.starterAllowed();
      this.clutchHeld = false;
      throttleInput = this.helperThrottle;
      if (this.driver) {
        const c = this.driver.controls;
        if (!!c.reverse !== this.reverse && Math.abs(fwd) < 0.3) this.reverse = !!c.reverse;
        throttleInput = c.throttle;
        brakeInput = c.brake;
        steerInput = c.steer;
        this.starter ||= !!c.starter;
      } else if (this.ghost) {
        const cruise = this.ghostThrottle(dt, fwd);
        if (cruise === null) this.releaseGhost();
        else throttleInput = cruise;
      }
      // A girl driving a manual works the clutch and lever herself. A runaway keeps whatever gear it was left in.
      if (this.driver && this.manual) throttleInput = this.shift(dt, throttleInput, brakeInput, fwd);
    }

    // The hand throttle holds the engine up wherever it was left, ridden or not.
    if (this.tractor) throttleInput = Math.max(throttleInput, this.handSetting);

    // Left in first with the hand throttle open and nobody on it, the tractor walks off by itself; against a hedge it stalls.
    if (this.tractor) {
      const c = this.creep.update(dt, {
        allowed: mayCreep({ attended: !!(this.input || this.driver), running: this.engine.isRunning, gear: this.drivetrain.gear, hand: this.handSetting, parkBrake: this.parkBrake, tipped: this.isTipped, towed: this.towed }),
        hand: this.handSetting,
        speed: fwd,
      });
      this.creeping = c.creeping;
      this.creepLimit = c.limit;
      if (c.stall && this.engine.stopKnob()) this.creepStalled = true;
    }

    // The recoil pull-start (the two-strokes): hold P to draw the cord, let go to yank.
    const pullDown = this.input ? this.input.isDown('KeyP') : (!!this.remoteInput && this.remoteInput.isDown('KeyP')) || this.helperPull;
    if (pullDown) this.pullHeld += dt;
    else if (this.pullHeld > 0) {
      this.engine.pull(this.pullHeld);
      this.pullHeld = 0;
    }

    // Faults that develop: a sticking cable holds the throttle open, a flat tyre pulls the bars over.
    this.faults.update(dt, { running: this.engine.isRunning, speed: Math.abs(fwd), throttle: throttleInput });
    this.filter.update(dt, { running: this.engine.isRunning, speed: fwd, mud: Math.max(...this.physics.wheelInfo.map((w) => w.mud ?? 0)), puddle: Math.max(...this.physics.wheelInfo.map((w) => w.puddle ?? 0)) });
    // She has the sense to switch off a quad whose throttle has stuck open.
    if (this.driver && this.faults.stuck && this.engine.isRunning && this.faults.heldThrottle > 0.3) this.engine.setIgnition(false);
    this.throttle = this.faults.stickThrottle(dt, throttleInput, this.engine.isRunning);
    this.brake = brakeInput;

    if (this.ghost) {
      // The bars stay where they were left.
      this.steer = this.ghost.steer;
    } else {
      // Steering lock reduces with speed.
      // Someone sat on the front rack makes the bars a little heavier.
      const rackLoad = this.rackRider ? 1 - p.rackSteerLoss : 1;
      const maxSteer = (((p.maxSteerDeg * Math.PI) / 180) * rackLoad) / (1 + p.steerSpeedReduction * Math.abs(fwd));
      this.steer += (steerInput * this.handOff * maxSteer - this.steer) * Math.min(1, p.steerRate * dt);
    }

    const e = this.engine;
    this.drivetrain.update({
      dt,
      clutchHeld: this.clutchHeld,
      rpm: e.rpm,
      power: e.power,
      running: e.isRunning,
      throttle: this.throttle,
      brake: this.brake,
      forwardSpeed: fwd,
      slope: this.climb,
      speedLimit: this.creeping ? this.creepLimit : Infinity,
      reverse: this.reverse,
      maxRpm: e.params.maxRpm,
      lugDrop: e.isRunning ? Math.max(0, e.freeTargetRpm - e.targetRpm) : 0,
    });
    if (this.manual) this.reverse = this.drivetrain.gear < 0; // the lever decides, not S held at a stop
    if (this.manual && this.drivetrain.takeEvent() === 'jumped') this.say('It jumped out of gear');
    const d = this.drivetrain;
    this.engineLoad.update(dt, {
      throttle: this.throttle,
      brake: this.brake,
      forwardSpeed: fwd,
      reverse: this.reverse,
      driveForce: d.driveForce,
      available: d.available,
      clutch: d.clutch,
      coupled: d.coupled,
      mass: p.mass,
      wheels: this.physics.wheelLoads(),
      grip: this.physics.traction.putDown, // wheelspin from last step
    });

    // In a bog it sinks, faster with the wheels spinning, and the mud holds it.
    const at = this.physics.body.translation();
    const lin = this.physics.body.linvel();
    // A wet day makes the bogs worse.
    const wet = this.world.wet ?? 0;
    const inBog = Math.min(1, (this.world.bogAt?.(at.x, at.z) ?? 0) * (0.85 + 0.3 * wet));
    const groundSpeed = Math.hypot(lin.x, lin.z);
    // Held by the mud with the power on, the wheels churn round without it going anywhere.
    const churn = inBog > 0.1 && Math.abs(d.driveForce) > 300 && groundSpeed < 1 ? (Math.abs(d.driveForce) / p.maxDriveForce) * 6 * (1 - groundSpeed) : 0;
    this.physics.bogSpin += (churn - this.physics.bogSpin) * Math.min(1, dt * 4);
    this.bog.update(dt, { bog: inBog, spin: this.physics.spinSlip, speed: groundSpeed, drive: d.driveForce });
    const hold = this.bog.holdForce(p.mass);

    let brake = this.brake * p.maxBrake;
    // Someone at the controls with nothing pressed and stopped: it holds itself. With nobody on it (and not carrying on by itself) it only
    // holds if the parking brake was set, or it rolls off down a slope; the tractor still holds itself. Not while it's being winched.
    const attended = !!(this.input || this.ghost || this.driver || this.creeping);
    const idle = !this.towed && (attended ? throttleInput === 0 && Math.abs(fwd) < 0.5 : this.parkBrake || this.tractor);
    if (this.driver) this.parkBrake = false; // she takes it off before she sets off
    if (idle) brake = Math.max(brake, p.parkingBrake);
    if (this.parkBrake && (this.input || this.ghost)) brake = p.maxBrake; // a stuck throttle with nobody on it doesn't undo it
    const rolling = p.rollingResistance * this.tyres.rollingFactor; // harder tyres roll easier
    brake = Math.max(brake, rolling);
    // Wheel brakes alone let a parked quad creep down a slope, so a stationary one is held.
    this.physics.setParked((idle && throttleInput === 0 && Math.abs(fwd) < 0.3) || (this.parkBrake && Math.abs(fwd) < 0.3));

    // Rapier's raycast wheels ignore the brake on a wheel with any engine force
    // (even engine braking on the overrun), so braking drops the drive. The bog's
    // hold takes its share of the drive first.
    const drive = brake > rolling ? 0 : this.drivetrain.driveForce;
    this.physics.hold = hold + this.bog.dragForce(inBog, p.mass, groundSpeed);
    this.physics.applyControls({
      driveForce: Math.sign(drive) * Math.max(0, Math.abs(drive) * this.faults.driveFactor - hold),
      brake,
      steer: this.steer + this.faults.steerPull + this.quirks.brakePull(this.brake),
      mudAt: (x, z) => Math.max(this.world.mudAt(x, z), this.churn),
      puddleAt: (x, z) => this.world.puddleAt?.(x, z) ?? 0,
      bogAt: (x, z) => this.world.bogAt?.(x, z) ?? 0,
      wet,
      dt,
    });
    // Someone on foot shoving it along its length (the game sets pushDir while they hold the key); not with the parking brake on.
    this.pushLeft = Math.max(0, this.pushLeft - dt);
    if (this.pushDir && !this.input && !this.driver && !this.parkBrake && !this.isTipped && !this.towed) {
      this.pushLeft = 1;
      this.physics.setParked(false);
      this.physics.pushAlong(this.pushDir * this.controlsParams.pushSpeed, dt);
    }
    this.physics.update(dt);
  }

  /** Record the chassis transform after the physics step, for interpolation. */
  recordTransform() {
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
    const t = this.physics.body.translation();
    const r = this.physics.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currQuat.set(r.x, r.y, r.z, r.w);
  }

  /** Burns fuel for this frame and refills the float bowl from the tank. */
  updateFuel(dt) {
    const e = this.engine;
    this.fuel.update(dt, { rpm: e.rpm, throttle: e.throttle, choke: e.choke, running: e.isRunning });
    this.sump?.step(dt, { running: e.isRunning, work: e.lubeWork });
    this.sumpClock += dt;
  }

  /** The toolbox drain after red diesel: tank and carb emptied, the engine's soak cleared. Returns the litres lost. */
  drainFuel() {
    this.engine.dieselSoak = 0;
    return this.fuel.drain();
  }

  /** Water going up the intake, per second: the deepest puddle under a wheel, ploughed through fast. */
  waterGulp() {
    let puddle = 0;
    for (const w of this.physics.wheelInfo) puddle = Math.max(puddle, w.puddle);
    return waterGulp(puddle, this.speed, this.engine.params);
  }

  /** Engine controls for this frame. */
  engineControls() {
    return {
      starter: this.starter,
      throttle: this.throttle,
      choke: this.choke,
      load: this.drivetrain.engineLoad,
      driveLoad: this.engineLoad.driveLoad,
      resistLoad: this.engineLoad.resistLoad,
      overrunRpm: this.engineLoad.overrunRpm,
      fuel: this.fuel.bowlLevel,
      oil: this.fuel.oil,
      sump: this.sump?.level ?? 1,
      oilBurn: this.sump ? this.sump.burnSmoke(this.engine.throttle, Math.max(0, this.engine.rpm - this.engine.params.idleRpmWarm)) : 0,
      slip: this.faults.slip,
      dirt: this.faults.dirt,
      clog: this.filter.clog,
      gulp: this.waterGulp(),
      diesel: this.fuel.bowlDiesel,
      speed: this.forwardSpeed,
      ambient: this.world.warmth ?? 0.5,
      chill: this.world.chill ?? 0,
      sheltered: this.world.covered?.(this.position.x, this.position.z) ?? false,
    };
  }

  update(dt, alpha, vibration) {
    this.model.position.lerpVectors(this.prevPos, this.currPos, alpha);
    // Sunk into a bog, it sits lower in the mud.
    this.model.position.y -= this.bog.sink * this.bog.p.sinkDepth;
    this.model.quaternion.slerpQuaternions(this.prevQuat, this.currQuat, alpha);

    // A wheelie is only for show: the body and front wheels tip up about the rear axle.
    this.wheelieShown += (this.wheelie - this.wheelieShown) * Math.min(1, dt * (this.wheelie > this.wheelieShown ? 3 : 2));
    const lift = this.wheelieShown;
    const rearZ = this.rearAxleZ ??= Math.max(...this.wheels.map((w) => w.z));
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      const st = this.physics.wheelState(i);
      w.object.position.set(w.x, w.topY - st.suspension / this.scale, w.z);
      if (this.wheelShake && vibration) {
        // The same heave, pitch and roll as the body, taken at the wheel's own spot.
        const b = vibration.body;
        w.object.position.y += this.wheelShake * (b.heave - w.z * b.pitch + w.x * b.roll);
      }
      w.object.position.y += (rearZ - w.z) * lift;
      w.object.rotation.y = st.steering;
      w.spin.rotation.x = st.rotation;
      this.wheelHeights[i] = w.object.position.y - this.groundOffset;
    }
    if (this.model.userData.suspension) poseSuspension(this.model, this.wheelHeights);

    // Vibration rocks the sprung body and shakes the bars on top of steering.
    const v = vibration;
    this.body.position.set(0, (v ? v.body.heave : 0) + rearZ * lift, 0);
    // A two-wheeler leans into the corner (for show: the outriggers keep it up).
    const lean = this.model.userData.leans ? -this.steer * Math.min(1, Math.abs(this.speed) / 6) * 0.3 : 0;
    this.leanShown = (this.leanShown ?? 0) + (lean - (this.leanShown ?? 0)) * Math.min(1, dt * 5);
    this.body.rotation.set((v ? v.body.pitch : 0) + lift, 0, (v ? v.body.roll : 0) + this.leanShown);
    this.handlebars.position.copy(this.handlebarsBase);
    if (v) this.handlebars.position.add(new THREE.Vector3(v.bars.x, v.bars.y, 0));
    this.handlebars.rotation.set(0, this.steer * (this.model.userData.steerGain ?? 0.85) + (v ? v.bars.yaw : 0), v ? v.bars.roll : 0);

    this.updateDash(dt);
    this.updateQuirks(dt, vibration);
    this.updateFrost(dt);
    if (this.note && (this.note.left -= dt) <= 0) this.note = null;
    this.updateFlap(dt);
  }

  /** The tractor's exhaust flap lifts with each firing beat and rattles as it falls back, so it chatters at idle and stands open when revved. */
  updateFlap(dt) {
    if (!this.exhaustFlap) return;
    const e = this.engine;
    for (const pulse of e.pulses) if (pulse.type === 'fire') this.flap = Math.min(1, this.flap + 0.55 * pulse.strength);
    this.flap *= Math.exp(-dt * 14);
    // Held up by the exhaust pressure when revved, a little jitter on top so it rattles.
    const open = e.isRunning ? Math.min(1, 0.15 + e.throttle * 0.6 + this.flap * 0.5) : 0;
    const rattle = e.isRunning ? Math.sin(e.time * 140) * 0.06 * (0.3 + this.flap) : 0;
    this.exhaustFlap.rotation.x = -(open * 1.15 + rattle);
  }

  /** Stands a pod ({ group, update }) on the bars' mount, at full size even on the small quad. Returns false if there's no mount. */
  fitPod(pod) {
    const mount = this.model.userData.podMount;
    if (!mount || this.pod) return false;
    mount.add(pod.group);
    mount.scale.setScalar(1 / this.scale);
    this.pod = pod;
    return true;
  }

  /** Takes the fitted pod off and returns it. */
  removePod() {
    const pod = this.pod;
    if (pod) pod.group.parent?.remove(pod.group);
    this.pod = null;
    return pod;
  }

  /** Frost on the seat, cleared by whoever sits on it, shown as a tint on the seat material. */
  updateFrost(dt) {
    if (!this.seatMaterial || (this.seatFrost <= 0 && this.shownFrost <= 0)) return;
    this.seatFrost = frostAfter(this.seatFrost, !!(this.rider || this.driver || this.passenger), dt);
    if (Math.abs(this.seatFrost - this.shownFrost) < 0.01 && this.seatFrost > 0) return;
    this.shownFrost = this.seatFrost;
    this.seatMaterial.color.setHex(frostedColour(this.seatBase.color, this.seatFrost));
    this.seatMaterial.roughness = this.seatBase.roughness + (DEFAULT_FROST_PARAMS.frostRoughness - this.seatBase.roughness) * this.seatFrost;
  }

  /** The quirks that act on the quad itself: the choke creeping on with the shake, the tap's press window. */
  updateQuirks(dt, vibration) {
    const q = this.quirks;
    q.update(dt);
    const step = q.chokeCreep(dt, { running: this.engine.isRunning, shake: vibration?.intensity ?? 0, choke: this.choke });
    if (step) this.choke = Math.round((this.choke + step) * 10) / 10;
  }

  updateDash(dt) {
    const e = this.engine;
    const speed = Math.abs(this.forwardSpeed);
    this.tripMiles += (speed * dt) / 1609.34;
    advanceUsage(this.usage, { running: e.isRunning, speedMps: speed, dt });
    const f = this.fuel;
    const clock = dashClock();
    const state = {
      rpm: e.rpm,
      maxRpm: e.params.maxRpm,
      redline: e.params.redlineRpm,
      speedMph: speed > 0.2 ? speed * 2.237 : 0,
      ...this.quirks.dash({ fuelLevel: f.level, temperature: e.temperature, overheat: e.gaugeHeat }, dt, speed > 1),
      reserveLevel: f.params.reserveLitres / f.params.tankCapacity,
      oilLow: !!this.sump && oilPressureLamp({ running: e.isRunning, level: this.sump.level, rpm: e.rpm, idleRpm: e.params.idleRpmWarm, t: this.sumpClock }),
      tap: f.tap,
      coldBelow: e.params.warmLightThreshold,
      ignition: e.hasPower, // the dash goes dark on a flat battery
      keyOn: e.ignitionOn,
      tripMiles: this.tripMiles,
      odoMiles: this.usage.odoMiles,
      hours: this.usage.hours,
      reverse: this.reverse,
      neutral: this.manual
        ? e.hasPower && this.drivetrain.neutral
        : isNeutral({ ignition: e.hasPower && e.ignitionOn, reverse: this.reverse, speedMps: this.forwardSpeed, rpm: e.rpm, clutchEngageRpm: this.params.clutchEngageRpm }),
      gear: this.manual ? gearLabel(this.drivetrain.gear) : null,
      glow: e.glowLit,
      parkBrake: this.parkBrake, // the UTV's dash has a lamp for it
      hand: this.handSetting,
      clock: clock.text(),
      seconds: clock.seconds(),
    };
    this.lamps = lampStates(state); // what the dash's warning lamps show, for the girl on the back to read out
    this.dash.update(state);
    this.pod?.update(state);
    // The light follows the engine (headlight.js) unless this quad has a battery for it, and the flickering-headlight quirk dips it further.
    this.lightTime += dt;
    const look = headlightLook({
      keyOn: e.ignitionOn,
      running: e.isRunning,
      cranking: e.state === 'cranking',
      rpm: e.rpm,
      idle: e.params.idleRpmWarm,
      max: e.params.maxRpm,
      roughness: e.roughness,
      erratic: e.erratic,
      steady: this.steadyLights,
      time: this.lightTime,
    });
    const lit = e.ignitionOn && !this.noHeadlight;
    const level = look.level * this.quirks.headlight(dt);
    setHeadlights(this.model, lit, level, look.colour);
    setTaillights(this.model, lit ? taillightLevel(level, this.brake > 0.1) : 0); // the same supply, so a brake light needs it too

    if (this.tractor) poseTractorControls(this.model, { gear: this.drivetrain.gear, hand: this.handSetting, pedal: this.drivetrain.pedal });
    this.displayChoke += (this.choke - this.displayChoke) * Math.min(1, 12 * dt);
    // Off: lever forward. Full: pulled back towards the rider.
    if (this.chokeStyle === 'knob') this.chokeLever.position.z = this.chokeLever.userData.baseZ - this.displayChoke * 0.05; // pulled out towards you
    else if (this.chokeStyle === 'plunger') this.chokeLever.position.y = this.chokeLever.userData.baseY - this.displayChoke * 0.045; // pulled down
    else this.chokeLever.rotation.x = 0.5 - this.displayChoke * 1.45;
    // Fuel tap: forward for ON, down for RESERVE, back for OFF.
    const tapAngle = { on: 0, reserve: Math.PI / 2, off: Math.PI }[f.tap];
    this.fuelTap.rotation.x += (tapAngle - this.fuelTap.rotation.x) * Math.min(1, 15 * dt);
  }

  /** Moves the parked quad to a spot and heading (a girl nudging it straight by hand). */
  placeAt(x, z, yaw) {
    // Keeps the height it was sitting at (plus any slope), rather than dropping it from above each frame, so it stays on its wheels.
    const here = this.physics.body.translation();
    const y = here.y + this.world.heightAt(x, z) - this.world.heightAt(here.x, here.z);
    this.physics.reset(x, y, z, yaw);
    this.recordTransform();
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
  }

  rightItself() {
    const p = this.currPos;
    const yaw = this.yaw;
    this.physics.reset(p.x, this.world.heightAt(p.x, p.z) - this.groundOffset * this.scale + 0.3 * this.scale, p.z, yaw);
    this.recordTransform();
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
  }

  /** World position at a local offset from the chassis (x left, z forward). */
  localToWorld(x, y, z) {
    return this.model.localToWorld(new THREE.Vector3(x, y, z));
  }
}

export { GROUND_OFFSET };

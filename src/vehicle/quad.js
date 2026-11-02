import * as THREE from 'three';
import { idealAdvance } from '../engine/ignitionTiming.js';
import { lampSupply } from '../engine/charging.js';
import { buildQuadModel, poseSuspension, setHeadlights, setTaillights, setSignalLamps, poseSignalControls, poseParkBrake } from './quadModel.js';
import { FuelSystem } from './fuelSystem.js';
import { QuadPhysics, QUAD_LAYOUT } from './quadPhysics.js';
import { unscaleAnchors } from './unscaleAnchors.js';
import { Drivetrain } from './drivetrain.js';
import { QuirkSet } from './quirks.js';
import { headlightLook, taillightLevel } from './headlight.js';
import { Spotlamps } from './spotlamps.js';
import { addSpotlamps, setSpotlamps } from './spotlampModel.js';
import { Snorkel } from './snorkel.js';
import { addSnorkel, setSnorkel } from './snorkelModel.js';
import { LightSwitch, LIGHT_MODES, SIMPLE_LIGHT_MODES, lightLook, lightLamps } from './lightSwitch.js';
import { poseBarPod, poseThumbThrottle, POD } from './foremanControls.js';
import { Indicators, INDICATOR_PARAMS } from './indicators.js';
import { Wipers } from './wipers.js';
import { poseWipers, poseWiperStalk } from './wiperModel.js';
import { SeatBelts, BELT_SEATS, beltLampMode, beltLampLit } from './seatBelts.js';
import { TyreSet } from './tyres.js';
import { wearLook, wornTyre } from './detail/tread.js';
import { frostTexture } from './frostTexture.js';
import { frostAfter, frostedColour, DEFAULT_FROST_PARAMS } from './seatFrost.js';
import { ManualDrivetrain, gearLabel } from './manualDrivetrain.js';
import { AutoShifter, grindsGear } from './autoShifter.js';
import { poseTractorControls } from './tractorModel.js';
import { poseLandyControls, poseSeatTips, LANDY_REAR_SEATS } from './landRoverModel.js';
import { poseSeriesDoors, poseSeriesTailgate } from './seriesModel.js';
import { poseDefenderBackDoor } from './defenderModel.js';
import { poseFiestaHatch } from './fiestaModel.js';
import { pose309Hatch } from './p309Model.js';
import { poseCorsaHatch } from './corsaModel.js';
import { Tailgate } from './tailgate.js';
import { poseCarControls, poseCarSeats } from './carModel.js';

import { poseUtvControls, poseUtvBelts, poseUtvDoors } from './utvModel.js';
import { DoorSwing } from './doorSwing.js';
import { EngineLoad } from './engineLoad.js';
import { waterGulp, deepWaterGulp } from '../engine/water.js';
import { AirFilter } from './airFilter.js';
import { CarbIcing } from './carbIcing.js';
import { dustLevel } from '../world/dust.js';
import { CruiseControl } from './cruise.js';
import { Creep, mayCreep, DEFAULT_CREEP_PARAMS } from './creep.js';
import { stepPedalKey, DEFAULT_BRAKE_KEY_PARAMS, DEFAULT_THROTTLE_KEY_PARAMS } from './pedalKeys.js';
import { Bog } from './bog.js';
import { Sump, hasSump, oilPressureLamp } from './sump.js';
import { stepHand } from './handLever.js';
import { chainWear } from './chainShape.js';
import { Faults, clutchSlipping, clutchSlipUnderPower, applyTyreFaults } from './faults.js';
import { CrashWatch, damageFor, DEFAULT_CRASH_PARAMS } from './crashDamage.js';
import { toppleLoad } from './topple.js';
import { BikeLean, DEFAULT_BIKE_PARAMS } from './bikeLean.js';
import { RiderLean, DEFAULT_RIDER_LEAN_PARAMS } from './riderLean.js';
import { holdsItself } from './handbrake.js';
import { BrakeState } from './brakeState.js';
import { FrozenCable } from './frozenCable.js';
import { SeatSpring, UpAccel, DEFAULT_SEAT_PARAMS } from './seatRide.js';
import { DriveSwitch, driveEffects, DEFAULT_DRIVE_PARAMS } from './driveMode.js';
import { fuelWaterLevel } from './fuelWater.js';
import { DEFAULT_DIESEL_WAX_PARAMS, stepWax } from './dieselWax.js';
import { StickyStarter, DEFAULT_STICKY_PARAMS } from './stickyStarter.js';
import { DEFAULT_BLEED_PARAMS, runsDry, stepBleed } from './bleeding.js';
import { strengthEffects, bonusFor } from './strength.js';
import { reverseAllowed, chokeReach, hasChoke, DEFAULT_CONTROLS_PARAMS } from './controls.js';
import { advanceUsage, isNeutral, dashClock, lampStates } from './dashState.js';

const REAR_SEATS = Object.keys(LANDY_REAR_SEATS); // a back bench's seats, where a model has one (the 200TDi)

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
const GEAR_KEYS = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit0: 0, KeyB: -1 };
const HAND_THROTTLE_UP_KEY = 'KeyQ';
const HAND_THROTTLE_DOWN_KEY = 'KeyZ';
const STOP_KNOB_KEY = 'KeyO'; // not X (the tow chain and winch) or C (look back)
const PULL_KEY = 'KeyO'; // the recoil pull-start's: P is the lights (the tractor, which has the stop knob on O, has no pull-start)
// The Land Rover's hand throttle, a knob on the dash: Q and Z are its choke, so the brackets open and close it.
const HAND_KNOB_OUT_KEY = 'BracketRight';
const HAND_KNOB_IN_KEY = 'BracketLeft';
const NOTE_SECONDS = 2.5;

/**
 * The quad as a game object: rider controls, drivetrain, Rapier physics and
 * the visual model, with the engine model plugged in from outside.
 */
/** Throttle and brake from W and S on a manual: forwards W goes and S stops; in reverse gear S goes (backwards) and W stops. */
export function pedals(w, s, reverse) {
  const go = reverse ? s : w;
  const stop = reverse ? w : s;
  return [go ? 1 : 0, stop ? 1 : 0];
}

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
  constructor({ scene, physics, RAPIER, world, engine, params, label = 'quad', spawn, bodyColor, dashStyle, style, scale = 1, solo = false, plateNumber, fuelParams, build, layout = QUAD_LAYOUT, groundOffset = GROUND_OFFSET, gearbox = null, tractor = false, proxy = null, wheelShake = 0.6, noHeadlight = false, steadyLights = false, decay = null, reverseStyle = 'knee', chokeStyle = 'thumb', tapStyle = 'left', controlsParams = DEFAULT_CONTROLS_PARAMS, drive = null, wipers = null, handLever = false, crank = null, landRover = false, utv = false, car = false, lightSwitch = false, barLights = false, driverStand = null, benchStand = null, chainDrive = false, strengthSpec = null }) {
    this.strengthSpec = strengthSpec;
    this.reverseStyle = reverseStyle; // where its reverse is and what it takes (controls.js)
    this.chokeStyle = chokeStyle;
    this.tapStyle = tapStyle;
    this.controlsParams = controlsParams;
    this.drive = drive ? new DriveSwitch(drive) : null; // the 2WD / 4WD switch (and diff lock), on the red and blue only (driveMode.js)
    this.handLever = handLever; // a hand throttle knob as well as the tractor's lever (the Land Rover's, on its dash)
    this.crank = crank; // the Land Rover's starting handle (crankHandle.js), worked from the front
    this.atCrank = false; // set by the game while you stand at the front, looking at it
    this.kicked = false; // the handle has just kicked back (the game reads and clears it)
    this.landRover = landRover;
    this.car = car; // the girls' cars (carModel.js): cab vehicles like the Land Rovers, with two seats in front and two behind
    this.utv = utv;
    this.hornHeld = false; // set by the game while the horn sounds (the UTV's wheel pad sinks)
    this.radio = null; // the Land Rovers' and the girls' cars' radio, fitted by the unit (radio.js)
    this.barLights = barLights ? new LightSwitch('low', barLights === 'switch' ? SIMPLE_LIGHT_MODES : LIGHT_MODES) : null; // the red's lights and HI / LO rockers on the bars: P cycles them, starting dipped (headlights follow the engine as they always did; the switch only turns them off or to main beam)
    this.lights = lightSwitch ? new LightSwitch() : null; // the UTV's and the Land Rovers' three-way light switch: off, dipped, main beam (lightSwitch.js)
    this.signals = lightSwitch ? new Indicators() : null; // and their indicators and hazards (indicators.js)
    this.signalClick = null; // the relay's tick: 'on' or 'off' on the frame the lamp changes (the game plays it and clears it)
    this.wipers = wipers ? new Wipers(wipers) : null; // the windscreen wipers, on everything with a screen: X steps the stalk (wipers.js)
    this.wiperClick = false; // the stalk has moved a notch this frame (the game plays it and clears it)
    this.belts = lightSwitch || landRover ? new SeatBelts() : null; // the UTV's and the Land Rover's seat belts (seatBelts.js)
    this.driverStand = driverStand; // where a girl climbs in to drive from, on the model's right: the UTV and Land Rover step in through a door ({ x, z } in the model's frame, x negative: the right)
    this.benchStand = benchStand; // where you get in and out beside the bench, on the model's left (the other side from the driver's door), same frame as above
    this.driveParams = DEFAULT_DRIVE_PARAMS;
    this.driveShown = 0; // the switch's rocker, eased towards the mode: 0 for 2WD, 1 for 4WD
    this.driveEffects = driveEffects('4wd', this.driveParams); // what the mode does this step; a quad with no switch keeps its own drive
    this.handOff = 1; // how much steering you keep while a hand is off the bars for the choke
    this.pushDir = 0; // set by the game while someone on foot shoves it along: +1 forwards, -1 backwards, 0 not
    this.pushLeft = 0; // seconds since it was last pushed, counting down: the roll watch doesn't blame anyone for a quad being pushed
    this.noHeadlight = noHeadlight; // the lamp is only for show (the yellow and orange): it never lights
    this.steadyLights = steadyLights; // a battery runs the headlight, so it doesn't follow the engine (headlight.js)
    this.towJam = false; // a trailer on the hook is folded against it: no more reversing into it (vehicle/trailer.js)
    this.rackLoad = { kg: 0, driveFactor: 1, brakeFactor: 1 }; // what a load on the rear rack takes off the drive and brakes (vehicle/rackLoad.js)
    this.tow = { driveFactor: 1, brakeFactor: 1 }; // what a trailer on the hook takes off its drive and brakes (vehicle/towing.js)
    this.wheelShake = wheelShake; // how much of the body's vibration the wheels share (the tractor's shake more than the quads', which share about 0.6 of it)
    this.scale = scale; // 1, or smaller for the kids' quad: the model and the physics chassis both shrink by this
    this.world = world;
    this.engine = engine;
    this.params = params;
    this.label = label;
    this.spawn = spawn;

    this.layout = layout;
    this.groundOffset = groundOffset; // chassis origin to ground, at rest
    this.model = build ? build({ dashStyle }) : buildQuadModel({ bodyColor, dashStyle, style, solo, plateNumber, chokeStyle, tapStyle, driveSwitch: drive, decay });
    this.model.scale.setScalar(scale);
    this.dash = this.model.userData.dash;
    // Spotlamps are fitted at the bench to the quads and the Land Rovers (not the tractor, the UTV or the cars), by their headlamps (spotlamps.js).
    this.spotlamps = new Spotlamps(!tractor && !utv && !car && !noHeadlight && !!addSpotlamps(this.model));
    // A snorkel is fitted at the bench to the Land Rovers only (snorkel.js).
    this.snorkel = new Snorkel(landRover && !!addSnorkel(this.model));
    this.fuel = new FuelSystem(fuelParams);
    this.faults = new Faults();
    this.faults.hasBoot = !engine.params.compressionIgnition; // nor an intake boot to split
    this.faults.hasBattery = !engine.params.noStarter; // a pull-start-only machine has no battery to corrode
    if (engine.params.compressionIgnition || engine.params.injected) this.faults.prone.carb = 0; // a diesel or an injected engine has no carb to get dirty
    if (tractor) this.faults.prone.belt = 0; // and the tractor has a clutch and gearbox, not a belt
    this.faults.hasValves = engine.params.strokes !== 2; // every four-stroke has valves to go out of adjustment; a two-stroke has none
    this.faults.hasClutch = !!gearbox && !tractor && !landRover && !car && !utv; // a manual quad's plate wears with slipping it; the cars' and tractor's are not modelled
    this.clutchSlip = 0; // 0..1 how far a worn clutch is slipping under power just now (clutchSlipUnderPower)
    this.faults.hasChain = chainDrive; // only the chain-driven ones can stretch one
    this.lastUp = 0; // vertical speed last step, for the jolt a slack chain slaps on
    this.crashWatch = new CrashWatch({ ...DEFAULT_CRASH_PARAMS }); // a hard hit or landing can bend a rod or a rim (crashDamage.js)
    this.lastCrash = null; // { impact, bent: [{ kind, wheel, level }] } the last one, for the panel
    this.faults.steerWheels = layout.wheels.flatMap((w, i) => (!w.outrigger && (w.front ?? i < 2) ? [i] : []));
    this.sump = hasSump(engine.params) ? new Sump() : null; // every four-stroke's engine oil; the game deals each its level (sump.js)
    this.faults.hasSump = !!this.sump; // so a gasket can weep
    this.sumpClock = 0;
    // A layout's outrigger wheels (the mini moto's) are never the flat one.
    if (layout.wheels.some((w) => w.outrigger) || layout.wheels.length !== 4) {
      this.faults.tyreWheels = layout.wheels.flatMap((w, i) => (w.outrigger ? [] : [i]));
      this.faults.wheelSides = layout.wheels.map((w) => ({ side: w.x >= 0 ? 1 : -1, front: !!w.front }));
    }
    this.carbIce = new CarbIcing(undefined, !engine.params.compressionIgnition && !engine.params.injected); // ice in the carb on a cold, damp day (carbIcing.js); a diesel or an injected engine has no carb
    this.iceHits = []; // 'crack' / 'break' from wheels on puddle ice, taken by takeIceHits()
    this.bleedParams = DEFAULT_BLEED_PARAMS; // a diesel run dry and bled at the lift pump (bleeding.js); the game swaps in this game's tuning
    this.waxParams = DEFAULT_DIESEL_WAX_PARAMS; // diesel waxing in a hard frost (dieselWax.js); the game swaps in this game's tuning
    this.iceCable = new FrozenCable(); // a throttle cable frozen on a frosty morning (frozenCable.js); the game gives it this game's tuning and deals it
    this.brakes = new BrakeState(); // wet and binding brakes (brakeState.js); the game gives it this game's tuning and deals the binding ones
    this.filter = new AirFilter(); // clogs with mud, puddles and dust; cleaned at the toolbox
    this.dust = 0; // 0..1 how much dust it is throwing up (fast over dry stubble)
    this.dustIn = 0; // 0..1 the thickest cloud of another quad's it is in (the game sets it)
    this.tripMiles = 0;
    this.usage = { hours: 0, odoMiles: 0 }; // what the hour meter and odometer show; the game sets the starting readings
    this.pod = null; // the accessory pod fitted to the bars, if any (see pods.js)
    scene.add(this.model);
    const part = (name) => this.model.getObjectByName(name);
    this.body = part('body');
    this.chainDrive = part('chainDrive')?.userData.drive ?? null; // the chain and sprockets of a chain-driven model (detail/chainDrive.js)
    if (this.chainDrive) (this.model.userData.liveMaterials ??= []).push(...this.chainDrive.materials);
    this.bodyRoot = part('bodyRoot');
    this.bodyRoot.position.y = this.groundOffset;
    this.handlebars = part('handlebars');
    this.handlebarsBase = this.handlebars.position.clone();
    this.fuelTap = part('fuelTap');
    this.sedimentWater = part('sedimentWater'); // the water showing in the glass bowl under the tap (not on the diesels, which have no tap)
    this.chokeLever = part('chokeLever');
    this.kickStart = part('kickStart'); // the old bike's pedal, its advance-retard lever's arm and the carb's tickler (bantamModel.js): posed from the engine's state
    this.advanceArm = part('advanceArm');
    this.tickler = part('tickler');
    this.tickleShown = 0; // how far the tickler's button is down, 0..1
    this.kickLocked = false; // the kickstart is seized (the old bike's barn job): a kick does nothing
    this.kickBack = 0; // seconds left of a kick-back for the game to react to (a girl says something); it counts down by itself
    this.driveRocker = part('driveSwitchRocker'); // the 2WD / 4WD rocker on the bars (the red and blue)
    this.diffLockButton = part('diffLockButton'); // the blue's diff lock button beside it
    this.riderHands = part('riderHands');
    this.cameraAnchor = part('cameraAnchor');
    this.pillionCameraAnchor = part('pillionCameraAnchor');
    this.benchCameras = { left: part('cameraLeft') ?? null, mid: part('cameraMid') ?? null }; // your eyes in the UTV's and Land Rover's other seats
    // And in the 200TDi's back bench, which it alone has (its belts too).
    this.rearSeats = REAR_SEATS.filter((s) => part(`camera${s[0].toUpperCase()}${s.slice(1)}`));
    for (const s of this.rearSeats) this.benchCameras[s] = part(`camera${s[0].toUpperCase()}${s.slice(1)}`);
    if (this.belts && this.rearSeats.length) this.belts = new SeatBelts(undefined, [...BELT_SEATS, ...this.rearSeats]);
    this.seatTips = { left: 0, driver: 0 }; // the 200TDi's front backrests, tipped forward to let someone into the back (0..1)
    this.pillionAnchor = part('pillionAnchor') ?? null; // every spec's model has one
    this.rackAnchor = part('rackAnchor') ?? null; // only quads with a front rack
    this.mugAnchor = part('mugAnchor') ?? null; // the same quads' rear rack: where a girl leaves her tea (items/mug.js)
    this.rackRider = null; // the girl sitting on the front rack, if any
    this.riderAnchor = part('riderAnchor');
    // Whoever sits on a smaller quad is still full size: undo the model's scale on the anchors people hang from.
    unscaleAnchors(this.model, scale);
    // Each seat rides on its own spring (seatRide.js): the anchor, and your eyes if you sit there, move with it.
    this.seatParams = { ...DEFAULT_SEAT_PARAMS };
    this.seatUp = new UpAccel();
    this.seatSlams = []; // { kind, strength, up } this step, for the girls sat there to react to
    this.seatRides = [];
    const seat = (kind, ...names) => {
      const objs = names.map(part).filter(Boolean).map((o) => ({ o, y: o.position.y, z: o.position.z }));
      if (objs.length) this.seatRides.push({ kind, spring: new SeatSpring(kind, this.seatParams), objs });
    };
    seat('pillion', 'pillionAnchor', 'pillionCameraAnchor');
    seat('rack', 'rackAnchor');
    seat('front', 'seatLeft', 'cameraLeft');
    seat('front', 'seatMid', 'cameraMid');
    for (const r of this.rearSeats) seat('rear', `seat${r[0].toUpperCase()}${r.slice(1)}`, `camera${r[0].toUpperCase()}${r.slice(1)}`);
    seat('bed', 'bedSeat');
    this.exhaustTip = part('exhaustTip');
    this.wheels = layout.wheels.map((w) => ({ ...w, topY: w.y ?? layout.topY, object: part(w.name), spin: part(w.name).getObjectByName('spin') }));
    // Wheel centre heights in bodyRoot space, for posing the suspension arms.
    this.wheelHeights = this.wheels.map(() => 0);
    this.exhaustFlap = part('exhaustFlap') ?? null; // the tractor's upright exhaust has a flap that lifts with each beat
    this.towHitch = part('towHitch') ?? null; // a towing jaw at the back (the Land Rover's), for the little trailer
    this.crankHole = part('crankHole') ?? null; // the starting handle's hole in the front bumper
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
      y: world.heightAt(s.x, s.z) - this.groundOffset * scale + 0.05 * scale - (layout.spawnSag ?? 0), // already sunk on its springs, if it has any to sink on
      z: s.z,
      yaw: s.yaw,
    }, scale, layout);
    this.lightTime = 0;
    this.seatFrost = 0; // 0 bare to 1 white over; the game sets it on a freezing day, and sitting on it clears it (seatFrost.js)
    this.dayFrost = null; // the day's frost now (Weather.frost, set by the game each frame): the seat's frosts or thaws towards it
    this.seatMaterial = this.model.userData.seatMaterial ?? null;
    this.seatBase = this.seatMaterial ? { color: this.seatMaterial.color.getHex(), roughness: this.seatMaterial.roughness } : null;
    this.shownFrost = 0;
    this.tyres = new TyreSet(); // pressures, brands and tread (tyres.js); the game deals this game's
    this.physics.tyres = this.tyres;
    this.riderLean = this.model.userData.riderLean ? new RiderLean(DEFAULT_RIDER_LEAN_PARAMS) : null; // the three-wheeler's rider leaning in (riderLean.js)
    this.bike = this.model.userData.bike ? new BikeLean(DEFAULT_BIKE_PARAMS) : null; // a two-wheeler's balance and lean (bikeLean.js)
    this.tyres.useLayout(layout.wheels);
    this.physics.applyParams();
    // The tractor has a clutch pedal and a gearbox rather than a CVT; everything reads the same drivetrain fields.
    this.manual = !!gearbox; // a clutch and gearbox: the tractor and the manual quads
    this.tractor = tractor; // the tractor's own controls and body on top of that
    this.gearbox = gearbox;
    this.shifter = new AutoShifter(); // what the girls do with the clutch and lever when one of them drives
    this.declutched = false; // set when you double-declutch into a gear with no synchromesh; npc/watching.js reads and clears it
    this.drivetrain = this.manual ? new ManualDrivetrain(params, gearbox) : new Drivetrain(params);
    this.handSetting = gearbox?.handStart ?? 0; // the tractor's hand throttle, 0..1: it stays where it was put, even with nobody on it
    this.stickyParams = DEFAULT_STICKY_PARAMS; // the game swaps in this game's tuning
    this.sticky = null; // a StickyStarter if this vehicle has worn starter brushes (stickyStarter.js); the game deals it
    this.quirks = new QuirkSet(); // this game's oddities (quirks.js); the game gives it the ones it picked
    this.note = null; // something to tell whoever's at the controls, taken by the game (see takeNote)
    this.bog = new Bog(); // how far it's sunk into a bog (bog.js)
    this.pinned = null; // { pos, quat } while it is on the bale trailer's ramps or bed: the trailer holds its body there
    this.loadedOn = null; // the bale trailer carrying it, while it is
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
    this.helperPull = false; // she's holding the pull-start cord (or the Land Rover's starting handle)
    this.helperGrip = 'along'; // how she holds the starting handle: 'round' (it can kick back) or 'along'
    this.pullByHer = false;
    this.lastLeft = null; // who last got off it and whether they set the parking brake: { who: 'you' | a girl's id, braked } (handbrake.js)
    this.pto = { throttle: 0, load: 0 }; // a hydraulic fitting at work (the tractor's log splitter): the throttle its governor holds and the load it puts on the engine, both 0..1
    this.parkBrake = false; // the parking brake: wheels locked, so the throttle only revs the engine (toggled with Space)
    this.startTrouble = 0; // how many goes the last start by a girl took (npc/keepAlive.js reads it)
    this.helperThrottle = 0; // she's blipping the throttle (a quad's starting knack)
    this.tyreMud = []; // 0..1 per wheel, mud the tyre is carrying (world/roadMud.js)
    this.churn = 0; // 0..1 the ground torn up under the wheels, whatever it is (a girl's doughnuts: npc/doughnuts.js): it acts as mud
    this.wheelie = 0; // radians she wants the nose up, a girl showing off (npc/showOff.js); wheelieShown eases towards it
    this.wheelieShown = 0;
    this.handThrottle = 0; // a girl on the back reaching round to open it over your hand (npc/throttleGrab.js)
    this.pullHeld = 0; // seconds the cord's been held, until it's let go (the yank)
    this.passenger = null; // you, riding on the back while she drives
    this.backRider = false; // a girl on the back (the game sets it each step), for the toppling weight
    this.driver = null; // someone else at the controls (her), see setDriver()
    this.throttle = 0;
    this.brake = 0;
    this.throttleKey = 0; // how far you've opened the throttle on the keyboard (pedalKeys.js)
    this.brakeKey = 0; // and squeezed the brake
    this.steer = 0;
    this.reverse = false;
    this.choke = 0;
    this.starter = false;
    this.displayChoke = 0;
    this.displayPark = 0; // the bar lever's squeeze, eased
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

  /** The UTV and Land Rover: you can ride in the bench's other seats while a girl drives. */
  get hasBench() {
    return !!this.benchCameras.left;
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

  /** How steep, muddy and tarmacked it is under it now (the wheels' own last readings, 0..1 for the last two): strength.js and the girls' judging. */
  groundUnder() {
    const w = this.physics.wheels;
    const mean = (k) => w.reduce((s, x) => s + (x[k] || 0), 0) / w.length;
    return { climb: this.climb, mud: mean('mud'), tarmac: mean('tarmac'), speed: Math.abs(this.physics.forwardSpeed) };
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
    return up.y < 0.45 || !!this.bike?.fallen; // a bike that has gone down may be lying at a lean it could otherwise ride at
  }

  /** Hard knocks while someone is at the controls: a hit on a post or a bad landing can bend a rod or a rim (crashDamage.js). */
  /** The shed's faults on the tyres and the sump (shedFaults.js): the air seeping out, the cold morning's ceiling, the odd tyre, the weeping gasket. */
  shedEffects(dt) {
    if (this.tyres) applyTyreFaults(this.tyres, this.faults, dt);
    if (this.sump) this.sump.level = Math.max(0, this.sump.level - this.faults.gasketLoss(dt, this.engine.isRunning));
  }

  checkCrash(dt) {
    if (!this.rider && !this.driver) return this.crashWatch.reset(); // parked: stopping it by hand isn't a crash
    const impact = this.crashWatch.update(dt, this.physics.body.linvel());
    if (impact) this.crash(impact);
  }

  /** An impact (from crashDamage.js, `dir` being the way it was shoved in the world) bends what it bends. Returns what it bent. */
  crash(impact) {
    const local = new THREE.Vector3(impact.dir.x, 0, impact.dir.z).applyQuaternion(this.currQuat.clone().invert());
    const eligible = new Set(this.faults.tyreWheels);
    const wheels = this.wheels.flatMap((w, i) => (eligible.has(i) ? [{ x: w.x, z: w.z, front: !!(w.front ?? i < 2), index: i }] : []));
    const bent = damageFor(impact, wheels, { x: local.x, z: local.z }, this.crashWatch.params, this.faults.random);
    for (const b of bent) this.faults.damage(b.kind, b.level, b.wheel);
    this.lastCrash = { impact, bent };
    return bent;
  }

  /** For the panel: the obstacle dead ahead and the quad knocked straight back off it. */
  crashHeadOn(strength = 1) {
    const front = this.wheels.filter((w, i) => w.front ?? i < 2);
    const rear = this.wheels.filter((w, i) => !(w.front ?? i < 2));
    const mean = (ws) => ws.reduce((a, w) => a + w.z, 0) / Math.max(1, ws.length);
    const ahead = Math.sign(mean(front) - mean(rear)) || 1; // which way along the model's length is forward
    const dir = new THREE.Vector3(0, 0, -ahead).applyQuaternion(this.currQuat);
    return this.crash({ type: 'hit', strength, dir: { x: dir.x, z: dir.z } });
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
    if (!driver && (this.tractor || this.landRover || this.car)) this.shifter = new AutoShifter(); // Jess's go leaves her clumsy shifter behind
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
    if (out.gear !== d.gear) {
      // Jess forces first and second without the speed matched, and grinds them (a gearbox with no synchromesh on those); Amy double-declutches.
      if (grindsGear(this.shifter, this.gearbox, out.gear, fwd)) this.shifter.crunches++;
      d.select(out.gear, true);
    }
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
    if (this.engine.params.manualTiming) this.timingKeys(input, dt);
    if (this.engine.params.tickler && input.wasPressed('KeyY')) this.tickle();
    if (this.crank && !this.input && this.atCrank) {
      // The starting handle's grip: 1 thumb round it (the natural way, and the one that kicks back), 2 thumb alongside the fingers.
      if (input.wasPressed('Digit1')) this.crank.setGrip('round');
      if (input.wasPressed('Digit2')) this.crank.setGrip('along');
    }
    if (input.wasPressed('KeyF') && !this.fuel.params.noTap) {
      if (this.quirks.pressTap()) this.fuel.cycleTap();
      else this.say('The fuel tap is stiff: keep working it');
    }
    if (this.drive && this.input) this.driveKeys(input);
    if (this.lights && this.input && input.wasPressed('KeyP')) this.lights.cycle();
    if (this.barLights && this.input && input.wasPressed('KeyP')) this.barLights.cycle();
    if (this.spotlamps.fitted && this.input && input.wasPressed('Digit9')) this.say(this.spotlamps.toggle() ? 'Spotlamps on' : 'Spotlamps off');
    if (this.radio && this.input && input.wasPressed('KeyI')) this.radioKey(input);
    if (this.signals && this.input) {
      if (input.wasPressed('Comma')) this.signals.press('left');
      if (input.wasPressed('Period')) this.signals.press('right');
      if (input.wasPressed('Equal')) this.signals.press('hazard');
    }
    if (this.wipers && this.input && input.wasPressed('KeyX')) this.wipers.step();
    if (this.manual) this.manualKeys(input);
    // An automatic's reverse is a button, pressed with the brake held (the two-strokes have none).
    if (this.input && !this.manual && !this.tractor && input.wasPressed('KeyB') && this.reverseCheck(input)) this.reverse = true;
    this.handOff = 1;
    if (!this.tractor && hasChoke(this.engine.params)) { // (an injected engine or a diesel has no choke: Jess's Corsa, your car)
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

  /** The old bike's advance-retard lever on the left bar: [ eases it towards retarded, ] towards advanced (from the seat, or reaching over from beside it). */
  timingKeys(input, dt) {
    const e = this.engine;
    const rate = e.params.advanceRate ?? 0.6;
    if (input.isDown('BracketLeft')) e.advance = Math.max(0, e.advance - rate * dt);
    if (input.isDown('BracketRight')) e.advance = Math.min(1, e.advance + rate * dt);
  }

  /** A press on the carb's tickler (Y): the engine floods a little fuel in, and the button goes down. */
  tickle() {
    if (this.engine.tickle()) {
      this.tickleShown = 1;
      this.say(this.engine.tickled > this.engine.params.tickleFloodAbove ? 'That is a lot of petrol: it will be flooded' : 'Tickled');
    }
  }

  /** The gear lever, and the tractor's stop knob. */
  manualKeys(input) {
    if (this.tractor && input.wasPressed(STOP_KNOB_KEY)) {
      this.engine.stopKnob();
      this.stopPull = 1; // the knob comes out for a moment (poseTractorControls)
    }
    if (!this.input) return; // standing beside it you can reach the knob but not the lever
    for (const [code, gear] of Object.entries(GEAR_KEYS)) {
      if (!input.wasPressed(code)) continue;
      if (gear < 0) {
        const ok = this.reverseCheck(input);
        if (!ok) continue;
      }
      const ip = this.engine.params;
      const revs = THREE.MathUtils.clamp((this.engine.rpm - ip.idleRpmWarm) / (ip.maxRpm - ip.idleRpmWarm), 0, 1);
      const r = this.drivetrain.select(gear, false, this.forwardSpeed, revs);
      if (r === 'ok' && gear > 0 && gear <= (this.gearbox.crashGears ?? 0) && Math.abs(this.forwardSpeed) > (this.gearbox.crashSpeed ?? 1)) this.declutched = true; // a girl watching sees it
      if (r === 'crunch') this.say('Crunch! No synchromesh on first or second: nearly stop, or double-declutch (neutral, clutch up, rev to match, clutch down)');
      else if (r === 'mismatch') this.say('Crunch! The revs do not match the road speed: blip the throttle in neutral to match them');
      else if (r === 'clutch') this.say('Clutch in (hold Shift) to change gear');
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

  /** G flips between 2WD and 4WD; U puts the diff lock in and out where there is one. A switch on the bars, so always in reach. It says
   * nothing: you look at the switch, or the pod if one's fitted. */
  driveKeys(input) {
    const d = this.drive;
    if (input.wasPressed('KeyG')) d.toggle();
    if (d.hasLock && input.wasPressed('KeyU')) d.toggleLock();
  }

  /** I switches the radio on and off; with Shift held it is louder, with Alt quieter. It needs the key on, and says so when it hasn't it. */
  radioKey(input) {
    const r = this.radio;
    if (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) r.louder();
    else if (input.isDown('AltLeft') || input.isDown('AltRight')) r.quieter();
    else r.toggle();
    if (r.on && !this.engine.hasPower) this.say('The radio needs the key on');
    else this.say(r.on ? `Radio ${Math.round(r.volume * 100)}%` : 'Radio off');
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

  /** Your throttle from the keys (`target`: 1, or the automatics' gentler reverse), opened gradually while held (pedalKeys.js). */
  squeezeThrottle(target, dt) {
    // On a trigger the pedal is where your finger is, so there is no squeezing it in over a second.
    const pedal = this.reverse ? 'KeyS' : 'KeyW';
    if (this.input?.fromPad?.(pedal)) this.throttleKey = this.input.amount(pedal);
    else this.throttleKey = stepPedalKey(this.throttleKey, target > 0, dt, DEFAULT_THROTTLE_KEY_PARAMS);
    return target * this.throttleKey;
  }

  fixedUpdate(dt) {
    // On the bale trailer's ramps or bed: its body is held where the trailer puts it (vehicle/hayTrailer.js), nothing else about it runs.
    if (this.pinned) {
      this.physics.pin(this.pinned.pos, this.pinned.quat);
      return;
    }
    const p = this.params;
    const fwd = this.forwardSpeed;
    let throttleInput = 0;
    let brakeInput = 0;
    let steerInput = 0;

    if (this.tractor && this.input) {
      // The tractor: foot throttle and brake, a hand throttle that stays put, a clutch pedal and a gear lever.
      const input = this.input;
      steerInput = input.steerAxis();
      // In reverse gear S is the throttle (backwards) and W the brake, as on every other vehicle.
      [throttleInput, brakeInput] = pedals(input.isDown('KeyW'), input.isDown('KeyS'), this.reverse);
      throttleInput = this.squeezeThrottle(throttleInput, dt);
      this.clutchHeld = CLUTCH_KEYS.some((k) => input.isDown(k));
      this.handSetting = stepHand(this.handSetting, input.isDown(HAND_THROTTLE_UP_KEY), input.isDown(HAND_THROTTLE_DOWN_KEY), dt);
      this.starter = input.isDown('KeyR') && this.starterAllowed();
    } else if (this.input) {
      const input = this.input;
      const w = input.isDown('KeyW');
      const s = input.isDown('KeyS');
      steerInput = input.steerAxis();
      this.starter = input.isDown('KeyR') && this.starterAllowed();
      if (this.manual) this.clutchHeld = CLUTCH_KEYS.some((k) => input.isDown(k));
      if (this.handLever) {
        this.handSetting = stepHand(this.handSetting, input.isDown(HAND_KNOB_OUT_KEY), input.isDown(HAND_KNOB_IN_KEY), dt);
      }

      if (this.manual) {
        // The lever decides which way it goes. In reverse gear S is the throttle (backwards) and W the brake, as on the automatics.
        [throttleInput, brakeInput] = pedals(w, s, this.reverse);
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
      throttleInput = this.squeezeThrottle(throttleInput, dt);
      if (!this.reverse && !brakeInput) throttleInput = Math.max(throttleInput, this.handThrottle);
    } else {
      // Someone beside the bike can still hold the starter.
      this.starter = ((!!this.remoteInput && this.remoteInput.isDown('KeyR')) || this.helperStarter) && this.starterAllowed();
      this.clutchHeld = false;
      // And the hand throttle can be raised and lowered from the ground beside it, with the keys it has on the seat.
      const beside = this.remoteInput;
      if (beside && !this.driver && this.tractor) this.handSetting = stepHand(this.handSetting, beside.isDown(HAND_THROTTLE_UP_KEY), beside.isDown(HAND_THROTTLE_DOWN_KEY), dt);
      else if (beside && !this.driver && this.handLever) this.handSetting = stepHand(this.handSetting, beside.isDown(HAND_KNOB_OUT_KEY), beside.isDown(HAND_KNOB_IN_KEY), dt);
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
    // On the keyboard the brake squeezes in while the key is held rather than snatching full on (pedalKeys.js), as the throttle does.
    const brakePedal = this.reverse ? 'KeyW' : 'KeyS';
    if (this.input?.fromPad?.(brakePedal)) this.brakeKey = brakeInput > 0 ? this.input.amount(brakePedal) : 0;
    else this.brakeKey = this.input ? stepPedalKey(this.brakeKey, brakeInput > 0, dt, DEFAULT_BRAKE_KEY_PARAMS) : 0;
    if (this.input) brakeInput = this.brakeKey;
    else this.throttleKey = 0;

    // The hand throttle holds the engine up wherever it was left, ridden or not.
    if (this.tractor || this.handLever) throttleInput = Math.max(throttleInput, this.handSetting);

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

    // The recoil pull-start (the two-strokes): hold O to draw the cord, let go to yank. The Land Rover's starting handle works the same
    // way, but only from the front of it, and not while you're nursing your hand.
    // A girl swinging it (helperPull) holds it her own way (helperGrip): Jess wraps her thumb round it, Amy never does.
    const byYou = !!this.remoteInput && this.atCrank && this.crank?.ready && this.remoteInput.isDown('KeyP');
    const byHer = this.helperPull && this.crank?.ready;
    const pullDown = this.crank
      ? byYou || byHer // the Series' starting handle, from the front on foot (its lights are on P too, but only from the seat)
      : this.lights
      ? false // P is the UTV's and the 200TDi's light switch
      : this.input ? this.input.isDown(PULL_KEY) : (!!this.remoteInput && this.remoteInput.isDown(PULL_KEY)) || this.helperPull;
    if (pullDown) {
      this.pullHeld += dt;
      this.pullByHer = !!this.crank && !byYou;
    } else if (this.pullHeld > 0) {
      const locked = this.kickLocked;
      const swung = locked ? null : this.engine.pull(this.pullHeld);
      this.pullHeld = 0;
      if (locked) this.say('The kickstart is seized solid: free it at the bench first');
      else if (this.engine.params.kickStart && swung === 0 && this.engine.kicked > 0) {
        this.kickBack = this.engine.kicked; // it fired against the piston and the pedal came back at your foot
        this.say('Ow! It kicked back: the lever is too far advanced. Retard it with [ and try again');
      }
      if (swung !== null && this.crank?.swing(this.pullByHer ? this.helperGrip : undefined) === 'kick') {
        // Thumb round the handle: it caught a compression and spun back. No turn, and a sore hand.
        this.engine.pullLeft = 0;
        if (!this.pullByHer) this.kicked = true; // hers is the girl's own business (crankAttempt.js)
        if (!this.pullByHer) this.say('Ow! It kicked back. Thumb alongside your fingers, not round the handle (2)');
      }
    }
    this.crank?.update(dt);

    // Faults that develop: a sticking cable holds the throttle open, a flat tyre pulls the bars over.
    const up = this.physics.body.linvel().y;
    const jolt = dt > 0 ? Math.abs(up - this.lastUp) / dt : 0;
    this.lastUp = up;
    const slipNow = this.manual && this.faults.hasClutch ? clutchSlipping(this.drivetrain, { running: this.engine.isRunning, throttle: throttleInput, slope: this.climb, speed: fwd }, this.faults.params) : 0;
    this.faults.update(dt, { running: this.engine.isRunning, speed: Math.abs(fwd), throttle: throttleInput, jolt, clutchSlip: slipNow, punctureFactor: this.tyres.punctureFactor, temperature: this.world.weather?.temperature ?? 12 });
    this.shedEffects(dt);
    this.clutchSlip = this.manual && this.drivetrain.gear !== 0 ? clutchSlipUnderPower(this.faults.clutchWear, this.drivetrain.clutch > 0.5 ? this.throttle : 0, this.faults.params) : 0;
    this.checkCrash(dt);
    this.dust = this.world.dustParams ? dustLevel(this.world.dustParams, this.world.stubbleAt?.(this.position.x, this.position.z) ?? 0, this.world.wet ?? 0, fwd) : 0;
    this.filter.update(dt, { running: this.engine.isRunning, speed: fwd, dust: Math.max(this.dust, this.dustIn) * (this.world.dustParams?.filterBoost ?? 1), mud: Math.max(...this.physics.wheelInfo.map((w) => w.mud ?? 0)), puddle: Math.max(...this.physics.wheelInfo.map((w) => w.puddle ?? 0)) });
    // She has the sense to switch off a quad whose throttle has stuck open.
    if (this.driver && ((this.faults.stuck && this.faults.heldThrottle > 0.3) || (this.iceCable.mode === 'open' && this.iceCable.frozen && this.iceCable.held > 0.3)) && this.engine.isRunning) this.engine.setIgnition(false);
    this.throttle = this.iceCable.throttle(this.faults.stickThrottle(dt, throttleInput, this.engine.isRunning), this.engine.isRunning);
    this.brake = brakeInput;

    if (this.ghost) {
      // The bars stay where they were left.
      this.steer = this.ghost.steer;
    } else {
      // Steering lock reduces with speed.
      // Someone sat on the front rack makes the bars a little heavier.
      const rackLoad = this.rackRider ? 1 - p.rackSteerLoss : 1;
      const fx = this.drive ? this.driveEffects : null;
      const maxSteer = (((p.maxSteerDeg * Math.PI) / 180) * rackLoad * (fx?.steerScale ?? 1)) / (1 + p.steerSpeedReduction * Math.abs(fwd));
      this.steer += (steerInput * this.handOff * maxSteer - this.steer) * Math.min(1, p.steerRate * (fx?.steerRate ?? 1) * dt);
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
      mass: p.mass + this.rackLoad.kg,
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

    this.brakes.update(dt, { puddle: Math.max(0, ...this.physics.wheelInfo.map((w) => w.puddle ?? 0)), speed: fwd, pressure: this.brake });
    let brake = this.brake * p.maxBrake * this.tow.brakeFactor * this.rackLoad.brakeFactor * this.brakes.grip * this.faults.brakeFactor; // wet brakes barely bite until they dry
    // Someone at the controls with nothing pressed and stopped: it holds itself, unless it's an automatic on a steep slope, which rolls back.
    // With nobody on it (and not carrying on by itself) it only holds if the parking brake was set, or it rolls off down a slope; the tractor
    // still holds itself. Not while it's being winched (vehicle/handbrake.js).
    const attended = !!(this.input || this.ghost || this.driver || this.creeping);
    const idle = holdsItself({ towed: this.towed, attended, throttle: throttleInput, speed: fwd, parkBrake: this.parkBrake, tractor: this.tractor, manual: this.manual, climb: this.climb }, p.selfHoldSlope);
    if (this.driver) this.parkBrake = false; // she takes it off before she sets off
    if (idle) brake = Math.max(brake, p.parkingBrake);
    if (this.parkBrake && (this.input || this.ghost)) brake = p.maxBrake; // a stuck throttle with nobody on it doesn't undo it
    // Stubble and tarmac roll easier than grass (world/surfaces.js), judged where the quad is.
    const feel = this.world.surfaceFeelAt?.(this.position.x, this.position.z) ?? { roll: 1 };
    this.physics.setGroundDrag(feel.roll);
    const rolling = p.rollingResistance * this.tyres.rollingFactor * feel.roll; // harder tyres roll easier
    brake = Math.max(brake, rolling);
    // Wheel brakes alone let a parked quad creep down a slope, so a stationary one is held.
    this.physics.setParked((idle && throttleInput === 0 && Math.abs(fwd) < 0.3) || (this.parkBrake && Math.abs(fwd) < 0.3));

    // Rapier's raycast wheels ignore the brake on a wheel with any engine force
    // (even engine braking on the overrun), so braking drops the drive. The bog's
    // hold takes its share of the drive first.
    const drive = brake > rolling ? 0 : this.drivetrain.driveForce;
    if (this.drive) {
      this.driveEffects = driveEffects(this.drive.mode, this.driveParams);
      this.physics.frontDriven = this.driveEffects.frontDriven;
      this.physics.traction.gripScale = this.driveEffects.gripScale;
    }
    this.physics.hold = hold + this.bog.dragForce(inBog, p.mass, groundSpeed) + this.brakes.drag * p.mass; // a binding brake drags
    let wheelSteer = this.steer + this.faults.steerPull + this.faults.rodPull + this.tyres.steerPull + this.quirks.brakePull(this.brake);
    if (this.bike) wheelSteer = this.balanceBike(dt, wheelSteer);
    // Its hidden strength (strength.js): a little more drive uphill or on tarmac, a little more grip in mud or on tarmac.
    const sf = this.strengthSpec ? strengthEffects(this.strengthSpec, this.groundUnder()) : null;
    this.physics.strengthGrip = this.strengthSpec ? { mud: bonusFor(this.strengthSpec, 'mud'), tarmac: bonusFor(this.strengthSpec, 'tarmac') } : null;
    this.physics.applyControls({
      driveForce: (sf?.drive ?? 1) * Math.sign(drive) * (this.towJam && drive < 0 ? 0 : 1) * Math.max(0, Math.abs(drive) * this.faults.driveFactor * (1 - this.faults.params.clutchDriveLoss * this.clutchSlip) * this.tyres.driveFactor * this.tow.driveFactor * this.rackLoad.driveFactor * (this.drive ? this.driveEffects.driveScale : 1) - hold),
      brake,
      steer: wheelSteer,
      mudAt: (x, z) => Math.max(this.world.mudAt(x, z), this.churn),
      puddleAt: (x, z) => this.world.puddleAt?.(x, z) ?? 0,
      iceAt: this.world.puddleIce ? (x, z) => this.world.puddleIce.coverAt(x, z) : undefined,
      iceGrip: this.world.puddleIce?.params.gripSlip,
      bogAt: (x, z) => this.world.bogAt?.(x, z) ?? 0,
      feelAt: this.world.surfaceFeelAt ? (x, z) => this.world.surfaceFeelAt(x, z) : undefined,
      tarmacAt: this.world.tarmacAt ? (x, z) => this.world.tarmacAt(x, z) : undefined,
      wet,
      dt,
    });
    // Wheels on a puddle's ice load it until it cracks and breaks (world/puddleIce.js); the ride sounds take what happened.
    if (this.world.puddleIce) {
      for (const w of this.physics.wheelInfo) {
        if (w.ice <= 0.2) continue;
        const hit = this.world.puddleIce.load(w.point.x, w.point.z, w.load, groundSpeed, dt);
        if (hit && this.iceHits.length < 8) this.iceHits.push(hit);
      }
    }
    // Mud on the tyres: picked up on the track and in bogs, wiped off on grass, left on the road (world/roadMud.js).
    if (this.world.roadMud) {
      const wheels = this.physics.wheelInfo;
      for (let i = 0; i < wheels.length; i++) {
        const w = wheels[i];
        if (w.contact) this.tyreMud[i] = this.world.roadMud.roll(this.tyreMud[i] ?? 0, w.point.x, w.point.z, groundSpeed * dt, Math.max(w.mud, w.puddle * 0.7));
      }
    }
    // Every wheel on the move wears the ground under it, more with wheelspin, more in the wet (world/groundWear.js).
    if (this.world.wear && groundSpeed + this.physics.spinSlip > 0.3) {
      const weight = Math.min(2, Math.max(0.6, p.mass / 300));
      for (const w of this.physics.wheelInfo) {
        if (w.contact) this.world.wear.trample(w.point.x, w.point.z, groundSpeed * dt, { spin: w.driven ? this.physics.spinSlip : 0, wet, dt, weight });
      }
    }
    // Every wheel on the move presses the long grass of the hay patch flat, and it springs back (world/grassTracks.js).
    if (this.world.grassTracks && groundSpeed > 0.3) {
      for (const w of this.physics.wheelInfo) {
        if (w.contact) this.world.grassTracks.press(w.point.x, w.point.z, groundSpeed);
      }
    }
    // Tread wears with every metre rolled, faster on tarmac and under wheelspin, slower in mud (tyres.js).
    if (!this.pinned && (groundSpeed > 0.2 || this.physics.spinSlip > 0.05)) {
      const wheels = this.physics.wheelInfo;
      for (let i = 0; i < wheels.length; i++) {
        const w = wheels[i];
        if (!w.contact) continue;
        this.tyres.wearWheel(i, {
          metres: groundSpeed * dt,
          tarmac: this.world.roadMud?.tarmacAt(w.point.x, w.point.z) ?? 0,
          mud: Math.max(w.mud ?? 0, w.puddle ?? 0),
          spin: this.physics.spinSlip,
          seconds: dt,
          driven: !!w.driven,
        });
      }
    }
    // Someone on foot shoving it along its length (the game sets pushDir while they hold the key); not with the parking brake on.
    this.pushLeft = Math.max(0, this.pushLeft - dt);
    if (this.pushDir && !this.input && !this.driver && !this.parkBrake && !this.isTipped && !this.towed) {
      this.pushLeft = 1;
      this.physics.setParked(false);
      this.physics.pushAlong(this.pushDir * this.controlsParams.pushSpeed, dt);
    } else if (this.pushDir && this.driver?.stranded && !this.parkBrake && !this.isTipped && !this.towed) {
      // A girl stuck in a bog, working the throttle while you shove (npc/stranded.js): it loosens in the mud, and moves off once it is free.
      this.pushLeft = 1;
      this.bog.shove(dt);
      if (!this.bog.stuck) this.physics.pushAlong(this.pushDir * this.controlsParams.pushSpeed, dt);
    }
    // Whoever's aboard, sat up on it, leans it further over on a slope (vehicle/topple.js).
    const load = toppleLoad(p, { front: !!(this.rider || this.driver), back: !!(this.passenger || this.backRider) });
    if (load > 0) this.physics.topple(load, dt);
    if (this.bike) this.physics.rollTorque(this.bike.out.rollTorque, dt);
    if (this.riderLean) {
      const bars = Math.max(-1, Math.min(1, this.steer / ((p.maxSteerDeg * Math.PI) / 180)));
      this.physics.rollTorque(this.riderLean.update(dt, { bars, speed: this.physics.forwardSpeed, aboard: !!(this.rider || this.driver), girl: !!this.driver }), dt);
    }
    this.physics.update(dt);
  }

  /**
   * A two-wheeler's balance for this step (bikeLean.js): returns the front wheel's angle and sets the tyres' grip; the roll torque it asks
   * for is applied just before the physics steps. Only you can come off it: a girl riding asks for a gentle lean and one with nobody on
   * it holds itself up.
   */
  balanceBike(dt, barAngle) {
    const p = this.params;
    const { lean, rate } = this.physics.lean();
    const live = this.physics.wheelInfo.filter((w) => w.contact);
    const grip = live.length ? live.reduce((a, w) => a + w.grip, 0) / live.length / p.grassFrictionSlip : 1;
    const wasFallen = this.bike.fallen;
    const out = this.bike.update(dt, {
      lean,
      leanRate: rate,
      speed: this.physics.forwardSpeed,
      bars: Math.max(-1, Math.min(1, this.steer / ((p.maxSteerDeg * Math.PI) / 180))),
      barAngle,
      throttle: this.throttle,
      brake: this.brake,
      grip,
      safe: !this.input,
      gentle: !!this.driver,
    });
    this.physics.gripMul = this.physics.wheels.map((w) => (w.front ? out.frontGrip : out.rearGrip));
    if (!wasFallen && this.bike.fallen) this.engine.setIgnition(false); // it stalls, or you kill it, on the way down
    return out.steer;
  }

  /** A two-wheeler goes over on its side now, whoever is on it, and the engine dies (a girl who has lost it, motoGo.js). */
  fallOver(side) {
    if (!this.bike || this.bike.fallen) return;
    this.bike.forceFall(side);
    this.engine.setIgnition(false);
  }

  /** Record the chassis transform after the physics step, for interpolation. */
  recordTransform() {
    this.prevPos.copy(this.currPos);
    this.prevQuat.copy(this.currQuat);
    const t = this.physics.body.translation();
    const r = this.physics.body.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currQuat.set(r.x, r.y, r.z, r.w).normalize(); // a drifted length would stretch whatever is attached to the model
  }

  /** Burns fuel for this frame and refills the float bowl from the tank. */
  updateFuel(dt) {
    const e = this.engine;
    const w = this.world;
    const ip = e.params;
    this.carbIce.update(dt, {
      running: e.isRunning,
      throttle: this.throttle,
      revs: Math.max(0, (e.rpm - ip.idleRpmWarm) / (ip.maxRpm - ip.idleRpmWarm)),
      temperature: w.temperature ?? 12,
      damp: Math.max(w.weather?.rain ?? 0, 0.8 * (w.weather?.wet ?? 0)),
      engineTemp: e.temperature,
    });
    if (ip.compressionIgnition) {
      this.fuel.wax = stepWax(this.fuel.wax, dt, {
        temperature: w.temperature ?? 12,
        running: e.isRunning,
        engineTemp: e.temperature,
        covered: !!w.covered?.(this.position.x, this.position.z),
        sun: w.warmth ?? 0,
        antiGel: this.fuel.antiGel,
      }, this.waxParams);
      if (runsDry(this.fuel.bowlLevel, e.isRunning || this.starter, this.bleedParams)) this.fuel.airLock = 1;
    }
    this.fuel.update(dt, { rpm: e.rpm, throttle: e.throttle, choke: e.choke, running: e.isRunning, climb: this.climb });
    this.sump?.step(dt, { running: e.isRunning, work: e.lubeWork });
    this.sumpClock += dt;
  }

  /** The toolbox drain after red diesel: tank and carb emptied, the engine's soak cleared. Returns the litres lost. */
  /** Whether this one has a fuel line that can fill with air: a diesel does. */
  get canAirLock() {
    return !!this.engine.params.compressionIgnition;
  }

  /**
   * Works the lift pump's priming lever for dt seconds. It needs fuel in the tank to push; returns false (and does nothing) if there is none.
   * At the end of a full bleed a little fuel is in the bowl again.
   */
  bleed(dt) {
    if (!this.canAirLock || this.fuel.airLock <= 0) return true;
    if (this.fuel.litres <= 0) return false;
    const before = this.fuel.airLock;
    this.fuel.airLock = stepBleed(before, dt, { pumping: true }, this.bleedParams);
    if (before > 0 && this.fuel.airLock <= 0) this.fuel.bowl = Math.max(this.fuel.bowl, this.fuel.params.bowlCapacity);
    return true;
  }

  drainFuel() {
    this.engine.dieselSoak = 0;
    return this.fuel.drain();
  }

  /** What the wheels did to puddle ice since last asked: 'crack' and 'break', for the sound. */
  takeIceHits() {
    return this.iceHits.splice(0);
  }

  /** Water going up the intake, per second: the deepest puddle under a wheel, ploughed through fast. */
  waterGulp() {
    let puddle = 0;
    let boost = 1;
    let deep = 0;
    for (const w of this.physics.wheelInfo) {
      puddle = Math.max(puddle, w.puddle);
      if (w.puddle > 0.5) boost = Math.max(boost, this.world.gulpBoostAt?.(w.point.x, w.point.z) ?? 1);
      if (w.puddle > 0.8) deep = Math.max(deep, this.world.deepWaterAt?.(w.point.x, w.point.z) ?? 0);
    }
    const snorkel = this.snorkel.effect();
    return Math.max(waterGulp(puddle, this.speed, this.engine.params, snorkel) * boost, deepWaterGulp(deep, this.engine.params, snorkel));
  }

  /** Gives this vehicle worn starter brushes (stickyStarter.js), or takes them away. */
  giveSticky(on, random = Math.random) {
    this.sticky = on ? new StickyStarter(this.stickyParams, random) : null;
  }

  /** Engine controls for this frame. */
  engineControls() {
    const e = this.engine;
    if (this.sticky && this.sticky.step(this.starter, e.isRunning, e.temperature)) this.say('The starter only clicks, and the dash is bright: it is not the battery. Try a tap on it with the spanner');
    // A manual in gear with the clutch up turns at the road's pace: its speed over the gear's top speed times its full-throttle revs.
    const d = this.drivetrain;
    const geared = this.manual && d.gear !== 0;
    const gearTop = geared ? d.topSpeed(d.gear) : 0;
    return {
      gearRpm: geared && gearTop > 0 ? (Math.abs(this.forwardSpeed) / gearTop) * this.engine.params.maxRpm : 0,
      gearLock: geared ? d.clutch * (1 - this.clutchSlip) : 0, // a slipping clutch lets the revs run away from the road
      starter: this.starter,
      throttle: Math.max(this.throttle, this.pto.throttle),
      choke: this.choke,
      load: this.drivetrain.engineLoad,
      driveLoad: Math.max(this.engineLoad.driveLoad, this.pto.load),
      resistLoad: Math.max(this.engineLoad.resistLoad, this.pto.load),
      overrunRpm: this.engineLoad.overrunRpm,
      fuel: this.fuel.bowlLevel,
      oil: this.fuel.oil,
      sump: this.sump?.level ?? 1,
      oilBurn: this.sump ? Math.max(this.sump.burnSmoke(this.engine.throttle, Math.max(0, this.engine.rpm - this.engine.params.idleRpmWarm)), this.engine.isRunning ? this.sump.overSmoke() : 0) : 0,
      slip: Math.max(this.faults.slip, this.clutchSlip), // the belt's or the clutch's: the revs flare and the load doesn't hold them down
      dirt: this.faults.dirt,
      terminals: this.faults.terminalCorrosion,
      airLeak: this.faults.airLeak,
      exhaustLeak: this.faults.exhaustLeak,
      valveLoose: this.faults.valveLoose,
      valveTight: this.faults.valveTight,
      clog: Math.min(1, this.filter.clog + (this.sump?.airboxChoke ?? 0)),
      ice: this.carbIce.ice,
      gulp: this.waterGulp(),
      diesel: this.fuel.bowlDiesel,
      additive: this.fuel.additive,
      fuelWater: fuelWaterLevel(this.fuel.bowlWater, this.fuel.waterParams),
      wax: this.fuel.wax,
      airLock: this.fuel.airLock,
      starterStuck: !!this.sticky?.stuck,
      speed: this.forwardSpeed,
      ambient: this.world.warmth ?? 0.5,
      chill: this.world.chill ?? 0,
      dayTemp: this.world.temperature ?? 12,
      dayDamp: this.world.damp ?? this.engine.params.airRefDamp,
      sheltered: this.world.warmCover?.(this.position.x, this.position.z) ?? false,
    };
  }

  /** A worn tyre shows it: its mesh swaps to a copy with the tread worn down (detail/tread.js), by looks so it only changes now and then. */
  showTread(w) {
    const look = wearLook(this.tyres.tread[w.front ? 'front' : 'rear']);
    if (look === w.tyreLook) return;
    w.tyreLook = look;
    if (w.tyreMesh === undefined) w.tyreMesh = w.spin.children.find((c) => c.geometry?.userData.tyre) ?? null;
    if (w.tyreMesh) w.tyreMesh.geometry = wornTyre(w.tyreMesh.geometry, look);
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
    const backZ = this.backAxleZ ??= Math.min(...this.wheels.map((w) => w.z)); // +Z is forward, so the back wheels are the lowest
    let rearTurn = 0;
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
      // A bent rod toes that wheel out of line, and a bent rim makes its wheel wobble once a turn.
      const wobble = this.faults.wheelWobble(i);
      w.object.rotation.y = st.steering + this.faults.wheelToe(i) + wobble * Math.sin(st.rotation);
      w.object.rotation.z = wobble * 0.5 * Math.cos(st.rotation);
      // A raked front end (the mini moto's) turns about the bars' vertical axis, which is behind the axle: swing the wheel round it.
      const pivotZ = this.model.userData.steerPivotZ;
      if (pivotZ !== undefined && w.front) {
        const turn = w.object.rotation.y;
        w.object.position.x += (w.z - pivotZ) * Math.sin(turn);
        w.object.position.z += (w.z - pivotZ) * (Math.cos(turn) - 1);
      }
      w.spin.rotation.x = st.rotation;
      if (w.z === backZ) rearTurn = st.rotation;
      this.showTread(w);
      this.wheelHeights[i] = w.object.position.y - this.groundOffset;
    }
    if (this.model.userData.suspension) poseSuspension(this.model, this.wheelHeights);
    if (this.chainDrive) {
      // The chain hangs as slack as the fault says, and its sprockets turn with the rear wheel.
      this.chainDrive.set(chainWear(this.faults));
      this.chainDrive.spin(rearTurn);
    }

    // Vibration rocks the sprung body and shakes the bars on top of steering.
    const v = vibration;
    this.body.position.set(0, (v ? v.body.heave : 0) + rearZ * lift, 0);
    this.body.rotation.set((v ? v.body.pitch : 0) + lift, 0, v ? v.body.roll : 0);
    this.handlebars.position.copy(this.handlebarsBase);
    if (v) this.handlebars.position.add(new THREE.Vector3(v.bars.x, v.bars.y, 0));
    this.handlebars.rotation.set(0, (this.bike ? this.bike.out.steer : this.steer) * (this.model.userData.steerGain ?? 0.85) + (v ? v.bars.yaw : 0), v ? v.bars.roll : 0);

    this.updateSeats(dt, vibration);
    this.updateDash(dt);
    this.updateQuirks(dt, vibration);
    this.updateFrost(dt);
    if (this.note && (this.note.left -= dt) <= 0) this.note = null;
    this.updateFlap(dt);
  }

  /** Moves each seat on its own spring from the frame's bumps, and notes any that slam (seatRide.js). */
  updateSeats(dt, vibration) {
    this.seatSlams.length = 0;
    if (!this.seatRides.length || dt <= 0) return;
    const body = vibration?.body;
    const accel = this.seatUp.update(dt, this.model.position.y + (body?.heave ?? 0), this.seatParams);
    for (const r of this.seatRides) {
      // Further behind the middle (the model's +z is the back) rides the pitch harder.
      const lift = -r.objs[0].z * this.scale * (body?.pitch ?? 0) * r.spring.param('pitch');
      const { offset, slam } = r.spring.update(dt, accel, lift);
      for (const s of r.objs) s.o.position.y = s.y + offset / this.scale;
      if (slam) this.seatSlams.push(slam);
    }
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
    if (this.model.userData.podPost) this.model.userData.podPost.visible = true;
    return true;
  }

  /** Takes the fitted pod off and returns it. */
  removePod() {
    const pod = this.pod;
    if (pod) pod.group.parent?.remove(pod.group);
    this.pod = null;
    if (this.model.userData.podPost) this.model.userData.podPost.visible = false;
    return pod;
  }

  /** Frost on the seat, cleared by whoever sits on it, shown as a tint on the seat material. */
  updateFrost(dt) {
    if (!this.seatMaterial || (this.seatFrost <= 0 && this.shownFrost <= 0 && !(this.dayFrost > 0))) return;
    this.seatFrost = frostAfter(this.seatFrost, !!(this.rider || this.driver || this.passenger), dt, DEFAULT_FROST_PARAMS, this.dayFrost ?? null);
    if (Math.abs(this.seatFrost - this.shownFrost) < 0.01 && this.seatFrost > 0) return;
    this.shownFrost = this.seatFrost;
    this.seatMaterial.color.setHex(frostedColour(this.seatBase.color, this.seatFrost));
    this.seatMaterial.roughness = this.seatBase.roughness + (DEFAULT_FROST_PARAMS.frostRoughness - this.seatBase.roughness) * this.seatFrost;
    // The grain of the ice: a speckled bump, and a faint cold glow so it still reads in the shade. The map is added once (a recompile).
    if (this.seatFrost > 0 && !this.seatMaterial.bumpMap) {
      this.seatMaterial.bumpMap = frostTexture();
      this.seatMaterial.needsUpdate = true;
    }
    this.seatMaterial.bumpScale = DEFAULT_FROST_PARAMS.bumpScale * this.seatFrost;
    this.seatMaterial.emissive.setHex(DEFAULT_FROST_PARAMS.glow).multiplyScalar(this.seatFrost);
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
    advanceUsage(this.usage, { running: e.isRunning, speedMps: speed, dt, timeScale: dashClock().rate() });
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
      cranking: e.state === 'cranking', // the UTV's key turns on to START while it is cranking
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
      fourWd: this.drive ? this.drive.frontDriven : null, // the 4WD lamp on the red and blue's dashes (null: no switch)
      diffLock: this.drive?.hasLock ? this.drive.locked : null, // null: no diff lock to show
      hand: this.handSetting,
      choke: this.choke, // the Land Rover's dash has a lamp for it
      hazardLit: !!this.signals && this.signals.mode === 'hazard' && this.signals.lit, // the 200TDi's hazard button on its cluster flashes
      hazardOn: !!this.signals && this.signals.mode === 'hazard', // and its hazard rocker on the centre stack is down while they are on
      radioOn: !!this.radio?.on, // the radios' rockers and displays
      battery: this.engine.battery, // the 200TDi's volts gauge
      indicatorLamps: this.signals ? this.signals.sides : null, // the green arrows, { left, right } (null: no indicators)
      lightLamps: this.lights ? lightLamps(this.lights.mode, e.hasPower) : null, // the UTV's lights and main beam lamps (null: no switch)
      beltLamp: this.belts ? beltLampLit(beltLampMode(e.ignitionOn, this.belts.anyUnbelted), clock.seconds()) : null, // and its seat belt lamp, flashing while someone sits unbelted
      clock: clock.text(),
      seconds: clock.seconds(),
    };
    this.shownFuel = state.fuelLevel; // what the fuel gauge reads, lies and all (the tank dip compares it with the real level)
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
    const barMode = this.barLights?.mode;
    const lit = e.ignitionOn && !this.noHeadlight && barMode !== 'off';
    // A UTV's lights are the switch's (the key must be on as well), not the engine's. The red's switch only turns the engine's light off or
    // to main beam: a longer, whiter, brighter reach, at the brightness the engine gives it.
    const beams = this.lights ? lightLook(this.lights.mode, e.hasPower) : barMode === 'high' ? lightLook('high', true) : null;
    // Lamps on the battery's supply load it, and dim when it is weak and the revs are low (engine/charging.js); the old quads' run off the magneto.
    const onBattery = lit && (this.lights ? beams.level > 0 : this.steadyLights);
    // Spotlamps always run off the battery, and the key must be on as well; they load it on top of the headlamps.
    const spotSupply = this.spotlamps.fitted && this.spotlamps.on ? lampSupply(e.battery, e.rpm, e.params.idleRpmWarm, e.params.maxRpm, e.params.batteryWeakBelow) : 1;
    this.spotlamps.update(dt, e.ignitionOn && e.hasPower, spotSupply);
    setSpotlamps(this.model, this.spotlamps.fitted, this.spotlamps.level);
    setSnorkel(this.model, this.snorkel.fitted);
    e.lightLoad = Math.min(1, (onBattery ? 1 : 0) + this.spotlamps.load);
    const supply = onBattery ? lampSupply(e.battery, e.rpm, e.params.idleRpmWarm, e.params.maxRpm, e.params.batteryWeakBelow) : 1;
    const level = (this.lights ? beams.level : look.level) * this.quirks.headlight(dt) * supply;
    setHeadlights(this.model, lit, level, beams ? beams.colour : look.colour, beams);
    // For the real light the pool gives the lit vehicles (effects/vehicleLights.js).
    this.headlightLevel = lit ? level : 0;
    this.headlightColour = beams ? beams.colour : look.colour;
    this.headlightReach = beams?.reach ?? 1;
    if (this.radio) this.radio.update(dt, { power: e.hasPower, cranking: e.state === 'cranking', rev: Math.min(1, e.rpm / (e.params.maxRpm || 6000)) });
    if (this.signals) {
      const sides = this.signals.update(dt, Math.max(-1, Math.min(1, this.steer / ((this.params.maxSteerDeg * Math.PI) / 180))), e.hasPower && e.ignitionOn);
      if (this.signals.click) this.signalClick = this.signals.click;
      poseSignalControls(this.model, { mode: this.signals.mode, lit: this.signals.lit });
      setSignalLamps(this.model, { ...sides, reverse: this.reverse && e.hasPower && e.ignitionOn ? INDICATOR_PARAMS.reverseGlow : 0 });
    }
    if (this.wipers) {
      const notch = this.wipers.positions().indexOf(this.wipers.setting);
      if (this.wipers.moved) this.wiperClick = true; // (read before update clears it: the stalk can move with the key off)
      poseWipers(this.model, this.wipers.update(dt, e.hasPower && e.ignitionOn));
      poseWiperStalk(this.model, notch, this.wipers.speeds.length);
    }
    setTaillights(this.model, lit ? taillightLevel(level, this.brake > 0.1) : 0); // the same supply, so a brake light needs it too

    if (this.tractor) {
      this.stopPull = Math.max(0, (this.stopPull ?? 0) - dt * 1.6);
      this.displayPark += ((this.parkBrake ? 1 : 0) - this.displayPark) * Math.min(1, 10 * dt);
      poseTractorControls(this.model, { gear: this.drivetrain.gear, hand: this.handSetting, pedal: this.drivetrain.pedal, brake: this.brake, throttle: this.throttleKey ?? 0, park: this.displayPark, stop: this.stopPull });
    }
    if (this.utv) {
      poseUtvControls(this.model, { reverse: this.reverse, neutral: state.neutral, fourWd: !!this.drive?.frontDriven, locked: !!this.drive?.locked, lights: this.lights.mode, horn: this.hornHeld, park: this.parkBrake });
      poseUtvBelts(this.model, this.belts.worn());
      // The door nets swing out, at the side used, for a few seconds when you get on or off and while a girl steps in or climbs down; shut the rest of the time.
      this.doorSwing ??= new DoorSwing();
      poseUtvDoors(this.model, this.doorSwing.update(dt, { speed: this.speed, aboard: { right: !!(this.driver || this.rider), left: !!this.passenger && !(this.driver || this.rider) }, boarding: this.doorBoarding ?? {} }));
    }
    if (this.landRover) {
      poseLandyControls(this.model, { gear: this.drivetrain.gear, gears: this.gearbox.gears, fourWd: !!this.drive?.frontDriven, locked: !!this.drive?.locked, choke: this.choke, hand: this.handSetting, park: this.parkBrake, clutch: this.clutchHeld ? 1 : 0, brake: this.brake, throttle: this.throttleKey });
      poseUtvBelts(this.model, this.belts.worn()); // the same belt names as the UTV's
      if (this.rearSeats.length) poseSeatTips(this.model, this.seatTips);
      // The doors swing out at the side used, as the UTV's nets do (the Series' and the 200TDi's), and T drops the Series' tailgate or swings the
      // 200TDi's back door out on its hinge.
      this.doorSwing ??= new DoorSwing();
      poseSeriesDoors(this.model, this.doorSwing.update(dt, { speed: this.speed, aboard: { right: !!(this.driver || this.rider), left: !!this.passenger && !(this.driver || this.rider) }, boarding: this.doorBoarding ?? {} }));
      this.tailgate ??= new Tailgate();
      this.tailgate.update(dt, { speed: this.speed });
      poseSeriesTailgate(this.model, this.tailgate.open);
      poseDefenderBackDoor(this.model, this.tailgate.open);
    }
    if (this.car) {
      poseCarControls(this.model, { gear: this.drivetrain.gear, gears: this.gearbox.gears, choke: this.choke, park: this.parkBrake, clutch: this.clutchHeld ? 1 : 0, brake: this.brake, throttle: this.throttleKey });
      poseUtvBelts(this.model, this.belts.worn());
      poseCarSeats(this.model, this.seatTips);
      // The Fiesta's doors swing out at the side used (as the Land Rovers'), and T lifts its hatch (a model without them poses nothing).
      this.doorSwing ??= new DoorSwing();
      poseSeriesDoors(this.model, this.doorSwing.update(dt, { speed: this.speed, aboard: { right: !!(this.driver || this.rider), left: !!this.passenger && !(this.driver || this.rider) }, boarding: this.doorBoarding ?? {} }));
      this.tailgate ??= new Tailgate();
      this.tailgate.update(dt, { speed: this.speed });
      ({ corsa: poseCorsaHatch, p309: pose309Hatch }[this.model.userData.carKind] ?? poseFiestaHatch)(this.model, this.tailgate.open);
    }
    if (!this.utv && !this.landRover && !this.tractor && !this.car) {
      this.displayPark += ((this.parkBrake ? 1 : 0) - this.displayPark) * Math.min(1, 14 * dt);
      poseParkBrake(this.model, this.displayPark);
    }
    this.displayChoke += (this.choke - this.displayChoke) * Math.min(1, 12 * dt);
    // Off: lever forward. Full: pulled back towards the rider.
    if (!this.chokeLever) { /* an injected engine has no choke to pose */ }
    else if (this.chokeStyle === 'knob') this.chokeLever.position.z = this.chokeLever.userData.baseZ - this.displayChoke * 0.05; // pulled out towards you
    else if (this.chokeStyle === 'plunger') this.chokeLever.position.y = this.chokeLever.userData.baseY - this.displayChoke * (this.chokeLever.userData.travel ?? 0.045); // pulled down
    else if (this.chokeStyle === 'slide') this.chokeLever.position.x = this.chokeLever.userData.baseX - this.displayChoke * POD.slide; // pulled along its slot to apply
    else this.chokeLever.rotation.x = 0.5 - this.displayChoke * 1.45;
    if (this.kickStart) {
      // The pedal rests forward and down; a kick (the engine's pullLeft) swings it down and back and a spring brings it home; a kick-back flings it forward.
      const pull = this.engine.pullLeft > 0 ? 1 - this.engine.pullLeft / Math.max(0.01, this.engine.params.pullSeconds) : 0;
      this.kickBack = Math.max(0, this.kickBack - dt);
      this.kickStart.rotation.x = this.kickStart.userData.restAngle + 1.5 * Math.sin(pull * Math.PI) - 0.5 * Math.min(1, this.engine.kicked / 0.3) - (this.pullHeld > 0 ? 0.12 : 0);
    }
    // A girl driving it works the lever as she goes: it follows what the revs want (she does not leave it where it bites).
    if (this.driver && !this.input && e.params.manualTiming && e.isRunning) e.advance += (idealAdvance(e.rpm, e.params.idleRpmWarm, e.params.maxRpm, e.params) - e.advance) * Math.min(1, 2 * dt);
    if (this.advanceArm) {
      this.advanceShown ??= this.engine.advance;
      this.advanceShown += (this.engine.advance - this.advanceShown) * Math.min(1, 12 * dt);
      this.advanceArm.rotation.x = 0.55 - this.advanceShown * 1.1; // retarded: the arm is up; advanced: it is down
    }
    if (this.tickler) {
      this.tickleShown = Math.max(0, this.tickleShown - 5 * dt);
      this.tickler.userData.baseY ??= this.tickler.position.y;
      this.tickler.position.y = this.tickler.userData.baseY - this.tickleShown * (this.tickler.userData.travel ?? 0.01);
    }
    poseThumbThrottle(this.model, this.throttle); // the red's and blue's thumb throttle lever moves; the others' stay still (poseThumbThrottle checks)
    if (this.barLights) poseBarPod(this.model, { lights: this.barLights.mode, keyOn: e.ignitionOn, cranking: e.state === 'cranking' });
    if (this.drive && this.driveRocker) {
      this.driveShown += ((this.drive.frontDriven ? 1 : 0) - this.driveShown) * Math.min(1, 15 * dt);
      this.driveRocker.rotation.x = 0.35 - this.driveShown * 0.7; // top pressed in for 4WD
      if (this.diffLockButton) this.diffLockButton.position.y = this.diffLockButton.userData.baseY - (this.drive.locked ? 0.006 : 0);
    }
    // Fuel tap: forward for ON, down for RESERVE, back for OFF.
    const tapAngle = { on: 0, reserve: Math.PI / 2, off: Math.PI }[f.tap];
    const bowl = this.sedimentWater;
    if (bowl) {
      const fill = f.sediment;
      bowl.visible = fill > 0.03;
      bowl.scale.y = Math.max(0.001, fill);
      bowl.position.y = bowl.userData.bottom + fill * bowl.userData.full * 0.5; // settles at the bottom
    }
    if (this.fuelTap) this.fuelTap.rotation.x += (tapAngle - this.fuelTap.rotation.x) * Math.min(1, 15 * dt);
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

  /** Lays it on its side where it stands (the debug panel's way of tipping it). */
  tipOver() {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 1.75));
    const t = this.physics.body.translation();
    this.physics.body.setTranslation({ x: t.x, y: t.y + 0.25, z: t.z }, true);
    this.physics.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  rightItself() {
    this.bike?.recover();
    this.riderLean?.recover();
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

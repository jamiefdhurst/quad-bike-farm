// Keyboard and mouse state with per-frame edge detection.
// Keys are tracked by KeyboardEvent.code so the layout doesn't matter. A gamepad (input/gamepad.js) is polled each frame and counts as
// keys held and tapped in the same sets, plus analogue amounts for the stick and triggers, so the rest of the game reads one thing.

import { KEYS_EVENT, keyStorage, loadBindings, makeKeyMap, translate } from '../input/keyMap.js';
import { PadController, padStatus, DEFAULT_PAD_PARAMS } from '../input/gamepad.js';

const NO_PAD = { start: false, select: false, radial: null };

export class Input {
  constructor(element) {
    this.element = element;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelSteps = 0;
    this.mouseButtonsPressed = new Set();
    this.mouseButtonsDown = new Set();
    this.pointerLocked = false;
    this.listeners = { lockchange: [], firstinteraction: [], padchange: [] };
    this.hadInteraction = false;

    // The gamepad: its keys are in `down` too, and `padDown` says which of them came from it (a trigger is an amount, not a key).
    this.padParams = { ...DEFAULT_PAD_PARAMS };
    this.pad = new PadController(this.padParams);
    this.padDown = new Set();
    this.padTaps = new Set();
    this.padMove = { x: 0, y: 0, mag: 0 };
    this.padSteer = 0;
    this.padTrigger = { throttle: 0, brake: 0 };
    this.padState = NO_PAD;
    this.padPlaying = false; // started from the pad: no pointer lock to say the game has the mouse
    window.addEventListener?.('gamepadconnected', () => this.listeners.padchange.forEach((fn) => fn(this.padNames())));
    window.addEventListener?.('gamepaddisconnected', () => this.listeners.padchange.forEach((fn) => fn(this.padNames())));

    // Remapped keys (input/keyMap.js): the player's own keys stand in for the game's codes, read from the browser's storage and
    // changed from the key editor on the pause card, which says so with an event.
    this.keyMap = makeKeyMap(loadBindings(keyStorage()));
    window.addEventListener?.(KEYS_EVENT, (e) => {
      this.keyMap = makeKeyMap(e.detail ?? {});
      this.down.clear();
    });
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => {
      for (const code of [...this.down]) if (!this.padDown.has(code)) this.down.delete(code);
      this.mouseButtonsDown.clear();
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      this.noteInteraction();
      if (!this.pointerLocked) return;
      this.mouseButtonsPressed.add(e.button);
      this.mouseButtonsDown.add(e.button);
      // Middle-click would otherwise start autoscroll in some browsers.
      if (e.button === 1) e.preventDefault();
    });
    document.addEventListener('mouseup', (e) => this.mouseButtonsDown.delete(e.button));
    document.addEventListener(
      'wheel',
      (e) => {
        if (!this.pointerLocked) return;
        e.preventDefault();
        // One notch is one step regardless of the device's delta scale.
        this.wheelSteps += Math.sign(e.deltaY);
      },
      { passive: false },
    );
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.element;
      this.listeners.lockchange.forEach((fn) => fn(this.pointerLocked));
    });
  }

  /** The ids of the gamepads the browser can see (it only lists one once a button has been pressed on it). */
  padNames() {
    const list = (typeof navigator !== 'undefined' && navigator.getGamepads?.()) || [];
    return [...list].filter((g) => g && g.connected).map((g) => g.id);
  }

  padStatus() {
    return padStatus(this.padNames());
  }

  /**
   * Reads the pad once a frame, before anything asks for a key. ctx = { mode: 'foot' | 'ride' | 'menu' | 'paused', menu, seat, gear, gears, bucketOpen }.
   * Returns { start, select, radial } for the game to act on.
   */
  poll(dt, ctx) {
    const list = (typeof navigator !== 'undefined' && navigator.getGamepads?.()) || [];
    const raw = [...list].find((g) => g && g.connected && g.buttons?.length >= 12) ?? null;
    const s = this.pad.update(raw, dt, ctx);
    // Keys the pad lets go of are released, keys it takes up are pressed, and its taps are down for this frame only.
    for (const code of this.padDown) {
      if (!s.held.has(code)) {
        this.padDown.delete(code);
        this.down.delete(code);
        this.released.add(code);
      }
    }
    for (const code of s.held) {
      if (this.padDown.has(code)) continue;
      this.padDown.add(code);
      if (!this.down.has(code)) this.pressed.add(code);
      this.down.add(code);
    }
    for (const code of this.padTaps) if (!this.padDown.has(code)) this.down.delete(code);
    this.padTaps.clear();
    for (const code of s.taps) {
      if (!this.down.has(code) || !this.padDown.has(code)) this.pressed.add(code);
      if (!this.down.has(code)) this.padTaps.add(code);
      this.down.add(code);
    }
    this.mouseDX += s.look.x;
    this.mouseDY += s.look.y;
    this.padMove = s.move;
    this.padSteer = s.steer;
    this.padTrigger = { throttle: s.throttle, brake: s.brake };
    this.padState = s.connected ? s : NO_PAD;
    if (s.connected && (s.start || s.held.size || s.taps.length)) this.noteInteraction();
    return this.padState;
  }

  /** How far a pedal key is in: a trigger's amount if the pad is holding it, otherwise all the way or not at all. */
  amount(code) {
    if (this.padDown.has(code)) {
      if (code === 'KeyW') return this.padTrigger.throttle;
      if (code === 'KeyS') return this.padTrigger.brake;
    }
    return this.down.has(code) ? 1 : 0;
  }

  /** Whether the pad, not the keyboard, is holding this key. */
  fromPad(code) {
    return this.padDown.has(code);
  }

  /** -1 to 1, left positive: the stick if it is leaned, otherwise A and D. */
  steerAxis() {
    if (this.padSteer) return this.padSteer;
    return (this.down.has('KeyA') ? 1 : 0) - (this.down.has('KeyD') ? 1 : 0);
  }

  on(event, fn) {
    this.listeners[event].push(fn);
  }

  noteInteraction() {
    if (this.hadInteraction) return;
    this.hadInteraction = true;
    this.listeners.firstinteraction.forEach((fn) => fn());
  }

  onKeyDown(e) {
    this.noteInteraction();
    if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    if (e.repeat) return;
    const code = translate(this.keyMap, e.code);
    if (!code) return;
    this.down.add(code);
    this.pressed.add(code);
  }

  onKeyUp(e) {
    const code = translate(this.keyMap, e.code);
    if (!code) return;
    this.down.delete(code);
    this.released.add(code);
  }

  requestPointerLock() {
    // From the pad there is no click to allow it, so it may well be refused; the game plays on without it.
    if (!this.pointerLocked) this.element.requestPointerLock?.()?.catch?.(() => {});
  }

  exitPointerLock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  isMouseDown(button) {
    return this.mouseButtonsDown.has(button);
  }

  wasClicked(button = 0) {
    return this.mouseButtonsPressed.has(button);
  }

  /** Returns and clears the accumulated mouse movement. */
  takeMouseDelta() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  /** Returns and clears the accumulated wheel notches (positive = scrolled down). */
  takeWheelSteps() {
    const s = this.wheelSteps;
    this.wheelSteps = 0;
    return s;
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouseButtonsPressed.clear();
  }
}

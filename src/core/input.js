// Keyboard and mouse state with per-frame edge detection.
// Keys are tracked by KeyboardEvent.code so the layout doesn't matter.

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
    this.listeners = { lockchange: [], firstinteraction: [] };
    this.hadInteraction = false;

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => {
      this.down.clear();
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
    this.down.add(e.code);
    this.pressed.add(e.code);
  }

  onKeyUp(e) {
    this.down.delete(e.code);
    this.released.add(e.code);
  }

  requestPointerLock() {
    if (!this.pointerLocked) this.element.requestPointerLock?.();
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

/**
 * Minimal state machine for NPC behaviour. Each state is an object with
 * optional enter(data), update(dt) and exit() hooks, called with `this` bound
 * to the owner so states can reach the NPC directly.
 */
export class StateMachine {
  constructor(owner, states, initial) {
    this.owner = owner;
    this.states = states;
    this.name = null;
    this.data = null;
    this.time = 0;
    this.transition(initial);
  }

  get current() {
    return this.states[this.name];
  }

  is(...names) {
    return names.includes(this.name);
  }

  transition(name, data = {}) {
    if (!this.states[name]) throw new Error(`Unknown state: ${name}`);
    this.current?.exit?.call(this.owner);
    this.name = name;
    this.data = data;
    this.time = 0;
    this.current.enter?.call(this.owner, data);
  }

  update(dt) {
    this.time += dt;
    this.current.update?.call(this.owner, dt, this.data);
  }
}

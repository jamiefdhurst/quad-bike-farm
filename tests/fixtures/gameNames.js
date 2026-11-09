// Not run: read by tests/gameNames.test.js. A class named Game, a host that asks it for names, and the ways of asking.
export class Game {
  constructor() {
    this.hud = {};
    this.set = new Set();
  }
  toast() {}
  get paused() { return false; }
  init() {
    this.farm = {};
    this.farm.day = 1;
    this.count += 1;
    this.useThis(this.hud, this.ghostField);
    const f = () => this.arrowGhost;
    return f;
  }
}

export class FixtureHost {
  constructor(game) {
    this.g = game;
  }
  go() {
    const g = this.g;
    this.g.toast('fine');
    this.g.renamedAway();
    g.farm.day;
    g.alsoGone();
    const { hud, vanished } = this.g;
    this.game.paused;
    return [hud, vanished, [1].filter((g) => g.ghost)];
  }
}

export function fromOutside(g, game) {
  g.showForced = true;
  Object.assign(game, { setFromAssign: 1 });
  return [g.showForced, game.setFromAssign, g.neverSet];
}

// What the smoke test does with the game once it is up (#767): every girl action for each girl who can do it, every vehicle verb, E on every prompt
// that offers an action, a ride on every vehicle and every scene. Each is read from the game's own list (`girlActions(game).all`, `VEHICLE_VERBS`,
// `game.interaction.items`, `game.units`, `SCENES`), so a new one is covered with nothing added here, and each stage reports how many it ran so a list
// that came back empty fails (smoke.mjs). A throw in anything done is caught and returned as a problem naming it: the frame guard would only see what
// throws on a frame.
//
// These functions run in the page (puppeteer sends their source), so each is self-contained and takes what it needs as its argument.

/** Prompts the smoke test does not press E on, because they end the run: matched on the game's own object for each, with why. */
export const PROMPTS_LEFT_OUT = [
  { name: 'wallCalendar', why: 'E on it calls it a day: the girls drive home, the farm saves and the page loads again as the next day' },
];

/** Girl actions left out for the same reason. Empty today: none of them ends the day or wipes the farm (the panel's buttons for those are not in `girlActions`). */
export const GIRL_ACTIONS_LEFT_OUT = [];

/** Vehicle verbs left out for the same reason. Empty today. */
export const VEHICLE_VERBS_LEFT_OUT = [];

/** Whether a vehicle verb has a vehicle to be done on: some are for one kind (`rackcan` a quad with a rack, `backcan` a Land Rover). Every verb is done on every kind. */
export const VERB_WAIT_MS = 40;
export const ACTION_WAIT_MS = 60;
export const RIDE_MS = 1500;

/**
 * Every girl action for each girl who can do it, each started with the girls stood about and free. Returns { ran, problems }.
 * @param {{ wait: number, leftOut: string[], vehicle: string }} o
 */
export async function doGirlActions({ wait, leftOut, vehicle }) {
  const g = game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const problems = [];
  let ran = 0;
  const unit = g.units.find((u) => u.id === vehicle) ?? g.units[0];
  const all = g.console.host.girls().flatMap((id) => g.console.host.girlVerbs(id).map((a) => ({ id, a })));
  for (const { id, a } of all) {
    if (leftOut.includes(a.verb)) continue;
    const c = g.companions.find((x) => x.character.id === id);
    for (const key of [...c.holds.keys()]) c.release(key);
    g.settleGirl(c);
    c.settled.left = 0.1;
    try {
      g.console.host.girlVerb(id, a.verb, a.vehicle ? unit.id : undefined);
      ran++;
    } catch (e) {
      problems.push(`girl action ${id} ${a.verb} threw: ${e.message}`);
    }
    await sleep(wait);
  }
  for (const c of g.companions) {
    for (const key of [...c.holds.keys()]) c.release(key);
    g.settleGirl(c);
  }
  return { ran, listed: all.length, problems };
}

/** Every vehicle verb on every vehicle (a verb that does not fit one says so and does nothing, which is fine). Returns { ran, listed, problems }. */
export async function doVehicleVerbs({ wait, leftOut }) {
  const g = game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const problems = [];
  let ran = 0;
  const verbs = g.console.host.vehicleVerbs.map((v) => v.name).filter((v) => !leftOut.includes(v));
  for (const u of g.units) {
    for (const v of verbs) {
      try {
        g.console.host.vehicleVerb(u.id, v);
        ran++;
      } catch (e) {
        problems.push(`vehicle verb ${u.id} ${v} threw: ${e.message}`);
      }
      await sleep(wait);
    }
  }
  return { ran, listed: verbs.length * g.units.length, problems };
}

/**
 * E on every prompt in `game.interaction.items`, as the player would: stood beside it, only when it is available and its prompt offers an action,
 * `hold` called for a few frames when it is held. Whatever opens afterwards is closed. Returns { ran, listed, problems }.
 */
export async function pressPrompts({ wait, leftOut }) {
  const g = game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const problems = [];
  let ran = 0;
  // Off whatever you are on, driving it or on the back of a girl's (she may need a moment to stop).
  const getOff = async () => {
    for (let i = 0; i < 20 && g.boardUnit; i++) {
      if (g.riddenUnit) g.tryDismount();
      else g.getOffBack();
      if (g.boardUnit) await sleep(250);
    }
  };
  const skip = new Set(leftOut.map((n) => g[n]?.group ?? g[n]).filter(Boolean));
  const closeAll = () => {
    for (const k of Object.keys(g)) {
      const v = g[k];
      if (v && typeof v === 'object' && v.isOpen === true && typeof v.close === 'function') v.close();
    }
    if (g.hiding?.active) g.stopHiding();
  };
  // A prompt that offers an action: a string ("Pick up the can") or { action }, not a line saying why not ({ text } or { info }).
  const offersAction = (p) => typeof p === 'string' || !!p?.action;
  const promptText = (item) => {
    try {
      const p = item.prompt();
      return (typeof p === 'string' ? p : JSON.stringify(p)).slice(0, 60);
    } catch {
      return '?';
    }
  };
  const items = [...g.interaction.items];
  for (const item of items) {
    if (skip.has(item.target)) continue;
    try {
      if (item.isAvailable && !item.isAvailable()) continue;
      if (!offersAction(item.prompt())) continue;
      const box = new g.camera.position.constructor();
      const t = item.target;
      t.updateWorldMatrix?.(true, false);
      box.setFromMatrixPosition(t.matrixWorld);
      const y = g.world.groundHeightAt(box.x + 1, box.z);
      if (!g.riddenUnit) g.player.moveTo({ x: box.x + 1, y: y + 0.5, z: box.z });
      g.interaction.focused = item;
      item.interact();
      if (item.hold) for (let i = 0; i < 5; i++) item.hold(0.1);
      ran++;
    } catch (e) {
      problems.push(`prompt "${promptText(item)}" threw: ${e.message}`);
    }
    await sleep(wait);
    closeAll();
    await getOff();
  }
  closeAll();
  return { ran, listed: items.length, problems };
}

/** Each vehicle mounted, started, the throttle held for a moment, and got off. Returns { ran, listed, problems }. */
export async function rideEach({ ms }) {
  const g = game;
  const sleep = (t) => new Promise((r) => setTimeout(r, t));
  // Off whatever you are on, driving it or on the back of a girl's (she may need a moment to stop).
  const getOff = async () => {
    for (let i = 0; i < 20 && g.boardUnit; i++) {
      if (g.riddenUnit) g.tryDismount();
      else g.getOffBack();
      if (g.boardUnit) await sleep(250);
    }
  };
  const problems = [];
  let ran = 0;
  for (const c of g.companions) g.settleGirl(c); // so none is driving off with you on the back
  for (const u of [...g.units]) {
    try {
      await getOff();
      const at = u.quad.position;
      if (u.quad.rider || u.quad.driver || g.companions.some((c) => c.quad === u.quad && c.fsm.is('driving', 'seated'))) continue; // someone has it
      g.player.moveTo({ x: at.x + 2, y: g.world.groundHeightAt(at.x + 2, at.z) + 0.5, z: at.z });
      g.mount(u);
      if (g.riddenUnit !== u) throw new Error('could not get on');
      g.console.host.vehicleVerb(u.id, 'start');
      g.input.down.add('KeyW');
      await sleep(ms);
      g.input.down.delete('KeyW');
      await sleep(ms / 3);
      await getOff();
      ran++;
    } catch (e) {
      g.input.down.delete('KeyW');
      problems.push(`riding ${u.id} threw: ${e.message}`);
    }
  }
  await getOff();
  if (g.boardUnit) problems.push('could not get off the last vehicle');
  return { ran, listed: g.units.length, problems };
}

/** Every scene in SCENES, then `scene end`. A scene that stops at a line says so in what it returns (runScene catches), which is a problem. */
export async function runEveryScene({ wait }) {
  const g = game;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const problems = [];
  let ran = 0;
  // Off whatever you are on, driving it or on the back of a girl's (she may need a moment to stop).
  const getOff = async () => {
    for (let i = 0; i < 20 && g.boardUnit; i++) {
      if (g.riddenUnit) g.tryDismount();
      else g.getOffBack();
      if (g.boardUnit) await sleep(250);
    }
  };
  const scenes = g.console.host.scenes();
  for (const s of scenes) {
    await getOff();
    const out = g.console.host.runScene(s.id, g.console.shell);
    if (out.failed) problems.push(`scene ${s.id}: ${out.join(' / ')}`);
    else ran++;
    await sleep(wait);
  }
  g.console.host.runScene('end', g.console.shell);
  return { ran, listed: scenes.length, problems };
}

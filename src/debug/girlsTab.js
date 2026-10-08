// The debug panel's Girls tab: one folder per girl (what she is doing and what you can make her do, her favour, the romance
// and her skills), then one for the two of them and the farm. Actions come first in each, state after.
import { pickTrick } from '../npc/showOff.js';
import { rampPoint } from '../npc/jumps.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

/** A read-only line over a getter. */
const show = (f, label, get) => f.add({ get v() { return get(); } }, 'v').name(label).listen().disable();
/** A slider that writes back. */
const slider = (f, label, get, put, min, max, step = 0.01) => f.add({ get v() { return get(); }, set v(x) { put(x); } }, 'v', min, max, step).name(label).listen();
const tick = (f, label, get, put) => f.add({ get v() { return get(); }, set v(x) { put(x); } }, 'v').name(label).listen();
const button = (f, label, fn) => f.add({ fn }, 'fn').name(label);

/** @param {import('./debugGui.js').DebugGui} d */
export function buildGirlsTab(d) {
  const g = d.game;
  const girl = (id) => g.companions.find((c) => c.character.id === id);
  const free = (c) => (c.fsm.is('idle') ? true : g.hud.toast(`${c.name} is busy: call her back to the barn first (the bell)`) && false);
  /** The quads she could take now, nearest to `from` first. */
  const freeQuads = (c, from, extra = () => true) =>
    g.girlUnits.map((u) => u.quad).filter((q) => c.mayRide(q) && c.canDrive(q) && !c.takenByOther(q) && !q.rider && extra(q))
      .sort((a, b) => a.position.distanceTo(from) - b.position.distanceTo(from));

  for (const id of g.companions.map((c) => c.character.id)) {
    const name = cap(id);
    const c = girl(id);
    const f = d.addFolder('Girls', name);

    // --- Things to make her do, at the top.
    const romance = g.romance;
    button(f, `${name} asks you round the back of the barn`, () => {
      const e = romance.invite(id, 'barn');
      if (!e) return g.hud.toast(`${name} has already asked (or is locked in)`);
      g.handleRomanceEvent(e);
    });
    button(f, `${name} asks you for the quad (needs her favourite free)`, () => {
      const e = romance.invite(id, 'quad');
      if (!e) return g.hud.toast(`${name} has already asked (or is locked in)`);
      if (!g.handleRomanceEvent(e)) g.hud.toast(`${name}'s favourite quad isn't free to sit on`);
    });
    button(f, `Go round the back of the barn with ${name} now`, () => {
      if (g.tryst) return g.hud.toast('Already at it');
      if (!free(c)) return;
      if (!romance.pendingFor(id)) romance.invite(id, 'barn');
      g.startTryst(c, 'barn');
    });
    button(f, `${name} drives the vehicle picked on the Vehicles tab`, () => {
      if (!free(c)) return;
      const u = d.unit();
      if (!c.mayRide(u.quad) || !c.canDrive(u.quad) || c.takenByOther(u.quad) || u.quad.rider) return g.hud.toast(`${name} can't or won't drive the ${u.name} right now`);
      c.requestDrive(u.quad);
      g.hud.toast(`${name} is off to drive the ${u.name}`);
    });
    button(f, `${name} rides on the back of it`, () => {
      if (!free(c)) return;
      const u = d.unit();
      if (!c.canRidePillion(u.quad)) return g.hud.toast(`${name} can't ride on the ${u.name}`);
      c.requestMount(u.quad);
    });
    button(f, `${name} jumps the ramp`, () => {
      if (!free(c)) return;
      c.selfEvents.push('jumps');
      if (!g.sendToRamp(c)) g.hud.toast(`${name} cannot find a free quad, or the line to the ramp is blocked`);
    });
    button(f, `${name} fetches or hangs up a jumper`, () => {
      const what = g.jumpers.toggle(id);
      g.hud.toast(what === 'fetch' ? `${name} will go and put a jumper on once she is stood about` : `${name} will go and hang her jumper up once she is stood about`);
    });
    button(f, `${name} grabs the throttle (next ride with her on the back)`, () => {
      g.throttleGrab.forced = id;
      g.hud.toast(`Ride with ${name} on the back (moving): she will grab the throttle`);
    });
    button(f, `Fall out with ${name} at fault`, () => !g.fallingOut.active && g.handleFallingOut(g.fallingOut.begin('digs', id)));
    if (id === 'amy') {
      button(f, 'Amy lines the quads up by the barn', () => {
        if (!free(c)) return;
        const job = c.planLineUp(0);
        if (!job) return g.hud.toast('The quads are already in a row (or none are free)');
        c.lineUpOn = true;
        c.startLineUp(job);
      });
    }
    if (id === 'jess') {
      button(f, 'Jess parks one crooked', () => {
        if (!free(c)) return;
        const job = c.planLineUp(1);
        if (!job) return g.hud.toast('No free quad');
        c.startLineUp(job);
      });
      button(f, 'Jess does doughnuts', () => {
        if (!free(c)) return;
        const quads = freeQuads(c, c.root.position, (q) => q.position.distanceTo(c.root.position) < 60);
        const plan = c.doughnutPlan();
        if (!quads.length || !plan) return g.hud.toast('Jess cannot find a free quad or a clear stretch of field');
        c.selfEvents.push('doughnuts');
        c.requestDrive(quads[0], { doughnut: plan });
      });
      button(f, 'Jess shows off to you', () => {
        if (!free(c)) return;
        const quads = freeQuads(c, c.root.position, (q) => !q.tractor).sort((a, b) => (b.engine.params.strokes === 2) - (a.engine.params.strokes === 2));
        if (!quads.length) return g.hud.toast('No free quad');
        c.selfEvents.push('showOff');
        c.requestDrive(quads[0], { showOff: { trick: pickTrick(quads[0].engine.params.strokes === 2, g.showOffParams), p: g.showOffParams } });
      });
      button(f, 'Jess nicks the nearest quad', () => {
        if (!free(c)) return;
        const quads = freeQuads(c, g.player.position);
        if (!quads.length) return g.hud.toast('No free quad');
        g.startNick(c, quads[0]);
      });
      button(f, 'Jess pours red diesel into a quad', () => {
        g.dieselMistake.forced = true;
        g.hud.toast('Jess will fill a parked quad from the diesel can as soon as she is stood about');
      });
      button(f, 'Jess names the quads now', () => {
        g.quadNames.p.firstNameAfter = 0;
        g.quadNames.p.nameEvery = 5;
        g.quadNames.nextAt = 0;
        g.hud.toast('Jess will name the quads, one every 5 seconds, when she is free and you are near');
      });
    }

    // --- What she is doing.
    show(f, 'doing', () => c.state + (c.quad && c.fsm.is('seated', 'mounting', 'driving', 'starting') ? ` (${c.quad.label})` : ''));
    show(f, 'her quad', () => g.ownership.claims[id] ?? 'none');
    show(f, 'tidying', () => c.lineUpStatus);
    show(f, 'race score', () => `${g.race.tally[id]?.wins ?? 0} won, ${g.race.tally[id]?.losses ?? 0} lost`);
    show(f, 'jump score', () => { const s = g.jumpWatch.score[id]; return s ? JSON.stringify(s) : 'none yet'; });

    // --- How she rates you, and the romance.
    const fav = f.addFolder('Favour and romance');
    show(fav, 'favour score', () => round(g.favour.scores[id]));
    show(fav, 'standing', () => `${round(g.favour.standing(id))} (${g.favour.mood(id)})`);
    button(fav, 'Favour her +5', () => g.favour.add(id, 5));
    button(fav, 'Neglect her -5', () => g.favour.add(id, -5));
    button(fav, 'Reset her favour', () => (g.favour.scores[id] = 0));
    show(fav, 'invitation open', () => { const p = romance.pendingFor(id); return p ? `${p.kind}, ${Number.isFinite(p.until) ? Math.max(0, Math.round(p.until - romance.clock)) + ' s left' : 'accepted'}` : 'none'; });
    show(fav, 'next she would ask', () => `${romance.nextKind(id)}, ${Math.max(0, Math.round(romance.girls[id].nextInvite - romance.clock))} s of cooldown`);
    slider(fav, 'trips round the back', () => romance.girls[id].visits, (v) => (romance.girls[id].visits = Math.round(v)), 0, 6, 1);
    tick(fav, 'locked in (yours for the game)', () => romance.girls[id].locked, (v) => {
      romance.girls[id].locked = v;
      if (v) g.favour.lock(id, romance.p.lockScore);
      else g.favour.unlock(id);
    });
    button(fav, 'Throw her off a quad (betray)', () => {
      if (romance.betray(id)) g.favour.unlock(id, romance.p.betrayScore);
      c.voice.say('betrayed', { force: true });
    });
    fav.close();

    // --- What she is good at.
    const sk = f.addFolder('Skills');
    for (const skill of Object.keys(g.skills.levels[id])) slider(sk, skill, () => round(g.skills.level(id, skill)), (v) => g.skills.set(id, skill, v), 0, 1);
    sk.close();
  }

  // --- The two of them, and the farm.
  const both = d.addFolder('Girls', 'Both girls and the farm');
  button(both, 'Call the girls back to the barn (as the bell does)', () => g.recallGirls());
  button(both, 'Start a race now', () => {
    if (g.race.active) return g.hud.toast('A race is already on');
    g.race.forced = true;
    g.hud.toast('A race will start as soon as both girls are stood about (and not on a quad)');
  });
  button(both, 'Start a drag race now', () => {
    if (g.race.active || g.drag.active) return g.hud.toast('A race is already on');
    g.drag.forced = true;
    g.hud.toast('A drag race will start as soon as both girls are stood about, with you on a quad');
  });
  button(both, 'Start follow the leader now', () => {
    if (g.convoy.active) return g.hud.toast('They are already out');
    g.convoy.forced = true;
    g.hud.toast('Follow the leader will start as soon as both girls are stood about');
  });
  button(both, 'A girl leaves her tea on a rack', () => {
    g.tea.forced = true;
    g.hud.toast('A free girl will put her tea on a rack');
  });
  button(both, 'Take me to the jump', () => {
    const r = g.world.layout.jumpRamp;
    if (!r) return;
    if (g.riddenUnit) return g.hud.toast('Get off first');
    const at = rampPoint(r, r.length * 0.6, 3.5);
    g.player.moveTo({ x: at.x, y: g.world.heightAt(at.x, at.z) + 0.5, z: at.z });
  });
  button(both, 'They fall out now', () => !g.fallingOut.active && g.handleFallingOut(g.fallingOut.begin('digs')));
  button(both, 'They make up now', () => g.fallingOut.active && g.handleFallingOut(g.fallingOut.end()));
  button(both, 'Put the L plates on Amy\'s quad', () => g.lPlates.put('quad'));
  button(both, 'Put the L plates on the tractor', () => g.lPlates.put('tractor'));
  button(both, 'Take the L plates off', () => g.lPlates.put('none'));
  const fo = g.fallingOut;
  show(both, 'fallen out', () => (fo.active ? `yes, ${fo.cause.kind} (${fo.fault} at fault), ${Math.round(fo.remaining)} s left` : `no, friction ${round(fo.friction, 1)}`));
  show(both, 'race', () => g.race.phase);
  show(both, 'follow the leader', () => (g.convoy.active ? `${g.convoy.phase}: ${g.convoy.leader} leads, ${g.convoy.swapsDone} swaps` : 'idle'));
  show(both, 'throttle grab', () => (g.throttleGrab.grab?.girl ? `${g.throttleGrab.grab.girl} (${g.throttleGrab.grab.phase})` : g.throttleGrab.forced ? `${g.throttleGrab.forced} waiting` : 'none'));
  show(both, 'jump now', () => {
    const c = g.companions.find((o) => o.fsm.is('driving') && o.drive?.jump);
    const run = c?.drive.jump.run;
    return run ? `${c.character.id}: ${run.phase}, go ${run.went + 1} of ${run.goes}` : 'nobody';
  });
  show(both, 'L plates are on', () => g.lPlates.where);
  show(both, 'the day', () => `${g.weather.temperature} °C (${g.weather.band}), chill ${g.weather.chill.toFixed(2)}, frost ${g.weather.frost.toFixed(2)}`);
  for (const u of g.girlUnits) {
    const names = g.quadNames.names[u.spec.id];
    show(both, `${u.name} is`, () => `${g.ownership.ownerOf(u.spec.id) ?? 'nobody'}'s${names ? ` (${names}${g.quadNames.announced.has(u.spec.id) ? '' : ', not said yet'})` : ''}`);
  }
}

// The debug panel's Girls tab: one folder per girl (what she is doing and what you can make her do, her favour, the romance
// and her skills), then one for the two of them and the farm. Actions come first in each, state after.
import { girlActions } from './girlActions.js';
import { NEEDS, NEED_LABELS } from '../npc/needs.js';
import { describeMind, OFFER_KINDS } from '../npc/chooser.js';
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
  const actions = girlActions(g);

  for (const id of g.companions.map((c) => c.character.id)) {
    const name = cap(id);
    const c = girl(id);
    const f = d.addFolder('Girls', name);

    // --- Things to make her do, at the top (girlActions.js, which the console uses too).
    const romance = g.romance;
    for (const a of actions.forGirl(id)) button(f, a.label.replace('%', name), () => a.run(id, a.vehicle ? d.unit() : undefined));

    // --- What she is doing.
    show(f, 'doing', () => c.state + (c.quad && c.fsm.is('seated', 'mounting', 'driving', 'starting') ? ` (${c.quad.label})` : ''));
    show(f, 'free', () => { const a = c.availability(); return a.free ? 'yes' : `no: ${a.why}`; });
    show(f, 'looking at', () => c.attention.describe());
    show(f, 'reacting', () => c.reactingText);
    show(f, 'numbness', () => (c.numbPlan ? `walking it off (${c.numbPlan.phase})` : `${round(c.numbness.value)} of 1`));
    show(f, 'her quad', () => g.ownership.claims[id] ?? 'none');
    show(f, 'tidying', () => c.lineUpStatus);
    show(f, 'race score', () => `${g.race.tally[id]?.wins ?? 0} won, ${g.race.tally[id]?.losses ?? 0} lost`);
    show(f, 'jump score', () => { const s = g.jumpWatch.score[id]; return s ? JSON.stringify(s) : 'none yet'; });

    // --- Why she does what she does: what she wants (settable) and what she chose for it (npc/needs.js, npc/chooser.js).
    const why = f.addFolder('Why');
    for (const n of NEEDS) slider(why, `wants ${NEED_LABELS[n]}`, () => c.needs[n], (v) => (c.needs[n] = v), 0, 1, 0.01);
    show(why, 'chose', () => describeMind(c.mind).chose);
    show(why, 'nearly chose', () => describeMind(c.mind).nearly);
    show(why, 'next', () => describeMind(c.mind).next);
    show(why, 'set on', () => c.intent.describe((k) => OFFER_KINDS[k]?.label ?? k));
    show(why, 'pace', () => `${c.paceMul.toFixed(2)} times her walk${c.pace ? ` (${c.pace})` : ''}`);
    button(why, 'Stop her on her way (as if you asked her something)', () => c.interrupt());
    button(why, 'Think now', () => (c.mind.thinkIn = 0));

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
  show(both, 'comparing notes', () => (g.comparing.busy ? `${g.comparing.last?.first} and ${g.comparing.last?.second}, ${g.comparing.steps.length} steps to go` : 'no'));
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

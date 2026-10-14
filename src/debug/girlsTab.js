// The debug panel's Girls tab: one folder per girl, then one for the two of them and the farm. Inside a girl's folder: what she is
// doing now (four lines), "Why" (open), "Make her do", then closed folders for her other state, her clothes and mud, her favour and
// romance and her skills, so both girls fit on the screen at once. The shared folder is a set of closed subfolders by subject
// (the games, the day, the workshop, the jobs, the animals and the lane, the farm's memory, getting about), never a flat list.
import { buttonText } from './buttonText.js';
import { girlActions } from './girlActions.js';
import { NEEDS, NEED_LABELS } from '../npc/needs.js';
import { describeMind, OFFER_KINDS } from '../npc/chooser.js';
import { rampPoint } from '../npc/jumps.js';
import { OUTFIT_KINDS, describeOutfit, completeStyle, outfitsFor } from '../npc/outfits.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const round = (v, n = 2) => Math.round(v * 10 ** n) / 10 ** n;

/** A read-only line over a getter. */
const show = (f, label, get) => {
  // The value sits in a narrow input, so a long one is cut off; the whole of it is the tooltip.
  let c;
  const read = () => {
    const v = get();
    if (c) c.domElement.title = String(v);
    return v;
  };
  c = f.add({ get v() { return read(); } }, 'v').name(label).listen().disable();
  return c;
};
/** A slider that writes back. */
const slider = (f, label, get, put, min, max, step = 0.01) => f.add({ get v() { return get(); }, set v(x) { put(x); } }, 'v', min, max, step).name(label).listen();
const tick = (f, label, get, put) => f.add({ get v() { return get(); }, set v(x) { put(x); } }, 'v').name(label).listen();
/** A button; text past the first bracket or colon is its tooltip, so the label stays on one line (buttonText.js). */
const button = (f, label, fn) => {
  const { text, hint } = buttonText(label);
  const c = f.add({ fn }, 'fn').name(text);
  if (hint !== text) c.domElement.title = hint;
  return c;
};

/** @param {import('./debugGui.js').DebugGui} d */
export function buildGirlsTab(d) {
  const g = d.game;
  const girl = (id) => g.companions.find((c) => c.character.id === id);
  const actions = girlActions(g);


  for (const id of g.companions.map((c) => c.character.id)) {
    const name = cap(id);
    const c = girl(id);
    const f = d.addFolder('Girls', name);

    const romance = g.romance;

    // --- What she is doing now: only what you glance at.
    show(f, 'doing', () => c.state + (c.quad && c.fsm.is('seated', 'mounting', 'driving', 'starting') ? ` (${c.quad.label})` : ''));
    show(f, 'free', () => { const a = c.availability(); return a.free ? 'yes' : `no: ${a.why}`; });
    show(f, 'looking at', () => c.attention.describe());
    show(f, 'reacting', () => c.reactingText);

    // --- Why she does what she does: what she wants (settable) and what she chose for it (npc/needs.js, npc/chooser.js).
    const why = f.addFolder('Why');
    for (const n of NEEDS) slider(why, `wants ${NEED_LABELS[n]}`, () => c.needs[n], (v) => (c.needs[n] = v), 0, 1, 0.01);
    show(why, 'chose', () => describeMind(c.mind).chose);
    show(why, 'nearly chose', () => describeMind(c.mind).nearly);
    show(why, 'next', () => describeMind(c.mind).next);
    show(why, 'set on', () => c.intent.describe((k) => OFFER_KINDS[k]?.label ?? k));
    show(why, 'pace', () => `${c.paceMul.toFixed(2)} times her walk${c.pace ? ` (${c.pace})` : ''}`);
    button(why, 'Stop her on her way (as if asked)', () => c.interrupt());
    button(why, 'Think now', () => (c.mind.thinkIn = 0));

    // --- Things to make her do (girlActions.js, which the console uses too), folded away so her details stay in view.
    const act = f.addFolder('Make her do');
    for (const a of actions.forGirl(id)) button(act, a.label.replace('%', name), () => a.run(id, a.vehicle ? d.unit() : undefined));
    act.close();

    // --- The rest of what she is up to, and what she keeps.
    const st = f.addFolder('Her state');
    show(st, 'with her friend', () => g.pairState(id));
    show(st, 'waiting about', () => c.waitingText());
    show(st, 'numbness', () => (c.numbPlan ? `walking it off (${c.numbPlan.phase})` : `${round(c.numbness.value)} of 1`));
    show(st, 'drive somewhere', () => (c.drive?.trip ? `${c.drive.trip.name} (${c.drive.trip.stage === 'there' ? 'on the way' : 'on the way back'})` : 'no'));
    show(st, 'her quad', () => g.ownership.claims[id] ?? 'none');
    show(st, 'tidying', () => c.lineUpStatus);
    show(st, 'race score', () => `${g.race.tally[id]?.wins ?? 0} won, ${g.race.tally[id]?.losses ?? 0} lost`);
    show(st, 'jump score', () => { const s = g.jumpWatch.score[id]; return s ? JSON.stringify(s) : 'none yet'; });
    st.close();

    // --- What she has on (dealt each day, npc/outfits.js), and how mucky she is.
    const wear = f.addFolder('Clothes and mud');
    const style = () => completeStyle(c.outfit.style);
    const kinds = Object.fromEntries(outfitsFor(c.character.outfitOdds).map((k) => [OUTFIT_KINDS[k].label, k]));
    show(wear, 'wearing', () => describeOutfit(style()));
    show(wear, 'her helmet', () => g.headgear.describe(id));
    show(wear, 'her coat', () => g.coats.describe(id));
    wear.add({ get v() { return style().kind; }, set v(x) { c.setStyle({ ...style(), kind: x }); } }, 'v', kinds).name('outfit').listen();
    tick(wear, 'plaid worn open', () => style().plaidOpen, (v) => c.setStyle({ ...style(), plaidOpen: v }));
    tick(wear, 'collar popped', () => style().popped, (v) => c.setStyle({ ...style(), popped: v }));
    slider(wear, 'polo buttons undone', () => c.outfit.poloOpen ?? 0, (v) => c.setPoloOpen(v), 0, 5, 1);
    slider(wear, 'plaid buttons undone', () => style().plaidButtons, (v) => c.setStyle({ ...style(), plaidButtons: Math.round(v) }), 0, 4, 1);
    slider(wear, 'under polo buttons undone', () => style().underOpen, (v) => c.setStyle({ ...style(), underOpen: Math.round(v) }), 0, 5, 1);
    show(wear, 'mud and dust', () => `${round(c.mucky.mud)} mud (${round(c.mucky.wet)} wet), ${round(c.mucky.dust)} dust`);
    slider(wear, 'mud on her', () => c.mucky.mud, (v) => (c.mucky.mud = v), 0, 1, 0.01);
    slider(wear, 'dust on her', () => c.mucky.dust, (v) => (c.mucky.dust = v), 0, 1, 0.01);
    wear.close();

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

  // --- The two of them, and the farm: closed subfolders by subject, each with its readouts first and its buttons after.
  const both = d.addFolder('Girls', 'Both girls and the farm');
  const sub = (title) => { const s = both.addFolder(title); s.close(); return s; };
  const toast = (m) => g.hud.toast(m);
  const goTo = (at) => {
    if (g.riddenUnit) return toast('Get off first');
    g.player.moveTo(at);
  };

  // The girls as a pair, and the day's goings on between them.
  const day = sub('The girls together');
  button(day, 'Call the girls back (as the bell does)', () => g.recallGirls());
  const fo = g.fallingOut;
  show(day, 'fallen out', () => (fo.active ? `yes, ${fo.cause.kind} (${fo.fault} at fault), ${Math.round(fo.remaining)} s left` : `no, friction ${round(fo.friction, 1)}`));
  button(day, 'They fall out now', () => !g.fallingOut.active && g.handleFallingOut(g.fallingOut.begin('digs')));
  button(day, 'They make up now', () => g.fallingOut.active && g.handleFallingOut(g.fallingOut.end()));
  show(day, 'comparing notes', () => (g.comparing.busy ? `${g.comparing.last?.first} and ${g.comparing.last?.second}, ${g.comparing.steps.length} steps to go` : 'no'));
  show(day, 'follow the leader', () => (g.convoy.active ? `${g.convoy.phase}: ${g.convoy.leader} leads, ${g.convoy.swapsDone} swaps` : 'idle'));
  button(day, 'Start follow the leader now', () => {
    if (g.convoy.active) return toast('They are already out');
    g.convoy.forced = true;
    toast('Follow the leader will start as soon as both girls are stood about');
  });
  show(day, 'throttle grab', () => (g.throttleGrab.grab?.girl ? `${g.throttleGrab.grab.girl} (${g.throttleGrab.grab.phase})` : g.throttleGrab.forced ? `${g.throttleGrab.forced} waiting` : 'none'));
  show(day, 'Jess\'s dare', () => g.dares.describe());
  show(day, 'a phone call', () => `${g.phoneCalls.describe()}${g.companions.map((c) => (g.favour.moodLeft(c.character.id) > 0 ? `; ${c.name} in a mood for ${Math.round(g.favour.moodLeft(c.character.id))} s` : '')).join('')}`);
  show(day, 'lights to work by', () => g.workLight.describe());
  button(day, 'A girl leaves her tea on a rack', () => {
    g.tea.forced = true;
    toast('A free girl will put her tea on a rack');
  });
  for (const u of g.girlUnits) {
    const names = g.quadNames.names[u.spec.id];
    show(day, `${u.name} is`, () => `${g.ownership.ownerOf(u.spec.id) ?? 'nobody'}'s${names ? ` (${names}${g.quadNames.announced.has(u.spec.id) ? '' : ', not said yet'})` : ''}`);
  }
  show(day, 'L plates are on', () => g.lPlates.where);
  button(day, 'Put the L plates on Amy\'s quad', () => g.lPlates.put('quad'));
  button(day, 'Put the L plates on the tractor', () => g.lPlates.put('tractor'));
  button(day, 'Take the L plates off', () => g.lPlates.put('none'));
  button(day, 'Helmet on or hung up (you)', () => g.toggleYourGear('you'));
  button(day, 'Goggles on or hung up (you)', () => g.toggleYourGear('goggles'));

  // Races and runs, and the records they keep. Asking for one is as Enter does: they leave what they are doing, and if they can't,
  // it says why (npc/asking.js).
  const games = sub('Races, runs and records');
  show(games, 'race', () => g.race.phase);
  show(games, 'hill climb', () => (g.hillClimb.active ? `${g.hillClimb.girl} (${g.hillClimb.phase})` : g.hillClimb.youArmed ? 'you are asked for' : 'idle'));
  show(games, 'cone course', () => (g.coneCourse.active ? `${g.coneCourse.girl} (${g.coneCourse.phase})` : g.coneCourse.youArmed ? 'you are asked for' : 'idle'));
  show(games, 'cones down', () => `${g.coneField.downCount} of ${g.coneField.cones.length}`);
  show(games, 'jump now', () => {
    const c = g.companions.find((o) => o.fsm.is('driving') && o.drive?.jump);
    const run = c?.drive.jump.run;
    return run ? `${c.character.id}: ${run.phase}, go ${run.went + 1} of ${run.goes}` : 'nobody';
  });
  show(games, 'records', () => g.records.lines().map((l) => `${l.label}: ${l.text}`).join('; '));
  show(games, 'last ask', () => g.lastAsk ?? (g.asking ? `asking for the ${g.asking.kind}, ${Math.round(g.asking.age)} s` : 'none'));
  for (const [kind, label] of [['race', 'lap race'], ['drag', 'drag race'], ['climb', 'hill climb'], ['cones', 'cone course']]) {
    show(games, `${label}: what is in the way`, () => { const p = g.askNow(kind); return p.length ? p.join('; ') : 'nothing'; });
    button(games, `Ask the girls for the ${label} now`, () => g.askGirls(kind));
  }
  button(games, 'Knock all the cones down', () => g.coneField.cones.forEach((c) => Object.assign(c, { down: true, dx: 0, dz: 1 })));
  button(games, 'Stand the cones up', () => g.standCones());
  button(games, 'Clear the records', () => {
    g.records.bests = {};
    g.records.byQuad = {};
    g.jobBoardView.refresh();
  });

  // The weather and the light, which change over a game.
  const sky = sub('The day and the weather');
  show(sky, 'the clock', () => `${g.daylight.text()}, ${Math.round(g.daylight.darkness * 100)}% dark, falling ${g.daylight.drop.toFixed(1)} °C into the night`);
  slider(sky, 'time of day (hours)', () => g.daylight.hour, (v) => g.setTime(v), 0, 30, 0.05);
  show(sky, 'the day', () => `${g.weather.temperature} °C (${g.weather.band}), chill ${g.weather.chill.toFixed(2)}, frost ${g.weather.frost.toFixed(2)}`);
  show(sky, 'the forecast', () => g.forecast.describe(g.daylight.hour));
  button(sky, 'Turn the weather now (as forecast)', () => toast(g.turnWeatherNow() ? `The weather is turning to ${g.weather.name}` : 'This weather has nowhere to turn'));
  button(sky, 'Lightning, close', () => g.strikeNow(150));
  button(sky, 'Lightning, far off', () => g.strikeNow(2400));
  show(sky, 'the stream', () => `${Math.round(g.world.streamLevel.level * 100)}% up, ${(g.world.streamLevel.rise * 100).toFixed(0)} cm above usual, running ${g.world.streamLevel.flow.toFixed(1)}x`);
  slider(sky, 'stream level (0 low, 1 full)', () => g.world.streamLevel.level, (v) => g.setStreamLevel(v), 0, 1, 0.05);
  show(sky, 'the puddles', () => g.world.puddleIce.describe());
  slider(sky, 'ice on the puddles (0 open water)', () => g.world.puddleIce.thickness[0] ?? 0, (v) => g.world.puddleIce.setAll(v), 0, 1, 0.05);
  button(sky, 'Break the ice on the puddles', () => g.world.puddleIce.breakAll());

  // The workshop and the barn's kit: the bench, charger, generator and the spares.
  const shop = sub('Workshop, generator and spares');
  show(shop, 'a girl at the bench', () => g.girlBench.describe());
  show(shop, 'their cars', () => g.describeCars());
  show(shop, 'the battery charger', () => g.describeCharger());
  button(shop, 'Take the battery off the charger', () => g.debugChargerClear());
  show(shop, 'the generator', () => g.describeGenerator());
  show(shop, 'starting the generator', () => g.generatorStart.describe());
  button(shop, 'Pull the generator\'s cord', () => g.debugGeneratorPull());
  button(shop, 'Switch the generator off', () => g.switchGeneratorOff());
  button(shop, 'Fill the generator\'s tank', () => g.debugGeneratorFuel(g.generator.params.tank));
  button(shop, 'Empty the generator\'s tank', () => g.debugGeneratorFuel(0));
  show(shop, 'the spares shelf', () => g.sparesShelf.describe());
  button(shop, 'Fill the spares shelf', () => g.sparesShelf.debugSetAll(g.sparesShelf.params.maxOnShelf));
  button(shop, 'Empty the spares shelf', () => g.sparesShelf.debugSetAll(0));
  button(shop, 'Order a pack of each spare', () => g.sparesShelf.debugOrderAll());
  button(shop, 'Open the parcel', () => (g.spares.hasParcel ? g.sparesShelf.collect() : toast('There is no parcel at the barn door')));

  // The farm's jobs: the board, the muck, the bales and the bonfire.
  const jobs = sub('Jobs: the board, muck, bales and bonfire');
  show(jobs, 'the board', () => g.jobBoard.lines().map((l) => `${l.done ? '[x]' : '[ ]'} ${l.text}`).join('; ') || 'nothing on');
  show(jobs, 'muck in the tub', () => `${Math.round(g.muck.load * 100)}%, ${g.muck.laid} patches laid on the stubble${g.muck.done ? ', done' : ''}`);
  button(jobs, 'Fill the trailer with muck', () => g.debugFillMuck());
  button(jobs, 'Muck job done now', () => g.debugFinishMuck());
  button(jobs, 'Empty the tub and clear the ground', () => g.debugResetMuck());
  slider(jobs, 'Bale spike arms (0 down, 1 up)', () => g.baleRig.lift.lift, (v) => (g.baleRig.lift.lift = v), 0, 1, 0.01);
  show(jobs, 'On the spike', () => g.baleRig.held?.id ?? 'nothing');
  button(jobs, 'Put the bale on the spike down', () => g.baleRig.putDown());
  button(jobs, 'Silage job done now', () => g.debugFinishSilage());
  button(jobs, 'Put the silage bales back', () => g.debugResetBales());
  show(jobs, 'The bonfire', () => `${g.bonfire.state}, ${g.bonfire.piled} of ${g.bonfireParams.heapsNeeded} on the pile, ${Math.round(g.bonfire.intensity * 100)}% blaze${g.bonfire.damp ? ', smoky' : ''}`);
  button(jobs, 'Build and light the bonfire', () => g.debugLightFire());
  button(jobs, 'Put the bonfire out', () => g.bonfire.putOut() || toast('It is not lit'));
  button(jobs, 'Clear the bonfire, restore brushwood', () => g.debugResetFire());
  button(jobs, 'Take a photo now', () => g.photos.press() || toast('The camera is not ready'));
  button(jobs, 'Take all the photos down', () => g.photos.clear());

  // Animals, the fence, the gates and what comes along the lane.
  const out = sub('Animals, gates and the lane');
  show(out, 'wildlife', () => `${g.rabbits.rabbits.filter((r) => r.mode !== 'down').length} rabbits about (${g.rabbits.rabbits.filter((r) => r.mode === 'caught').length} in a beam), pheasants ${g.pheasants.birds.map((b) => b.mode).join('/')}`);
  button(out, 'Flush the nearest pheasant', () => g.debugFlushPheasant());
  show(out, 'the cat', () => `${g.cat.mode}${g.cat.perchId != null ? ` on ${g.cat.perchId}` : ''}${g.cat.purring ? ', purring' : ''}`);
  button(out, 'Call the cat over to you', () => g.debugCat('call'));
  button(out, 'Put the cat asleep on the nearest vehicle', () => g.debugCat('perch') || toast('No open vehicle to put it on'));
  button(out, 'Shoo the cat', () => g.debugCat('shoo') || toast('The cat is not near enough, or is already off'));
  button(out, 'Keep the cat in the barn / let it out', () => g.debugCat('shelter'));
  show(out, 'the dog', () => `${g.dog.mode}${g.dog.riding ? ` on ${g.dog.rackId}` : ''}${g.dog.target ? ` after ${g.dog.target}` : ''}`);
  button(out, 'Call the dog over to you', () => g.debugDog('call'));
  button(out, 'Put the dog on your rack', () => g.debugDog('ride') || toast('You need to be on a quad with a rear rack'));
  button(out, 'Get the dog down off the rack', () => g.debugDog('down') || toast('She is not on a rack'));
  button(out, 'Send the dog after the nearest moving vehicle', () => g.debugDog('chase') || toast('Nothing else is moving'));
  button(out, 'Make the dog bark', () => g.debugDog('bark'));
  show(out, 'electric fence', () => `${g.fence.live ? 'on' : 'off'}; last zapped: ${g.fence.lastZap ? `${g.fence.lastZap.id} (${g.fence.lastZap.kind})` : 'nobody yet'}`);
  button(out, 'Zap you on the fence', () => g.debugZapFence());
  show(out, 'the lane and the gates', () => `${g.trafficHost.describe()}; south gate ${g.trafficHost.gate('south').isOpen ? 'open' : 'shut'}, big gate ${g.trafficHost.gate('road').isOpen ? 'open' : 'shut'}, grid gate ${g.trafficHost.gate('grid')?.isOpen ? 'open' : 'shut'}`);
  button(out, 'Swing the south gate', () => g.trafficHost.toggle(g.trafficHost.gate('south')));
  button(out, 'Swing the big gate', () => g.trafficHost.toggle(g.trafficHost.gate('road')));
  button(out, 'Swing the cattle grid gate', () => g.trafficHost.toggle(g.trafficHost.gate('grid')));
  button(out, 'Send a vehicle along the lane', () => g.trafficHost.debugPass());
  button(out, 'Send the post van', () => g.trafficHost.debugVisit('post') || toast('A visitor is already about'));
  button(out, 'Send a neighbour', () => g.trafficHost.debugVisit('neighbour') || toast('A visitor is already about'));

  // The farm's memory and the end of the day.
  const mem = sub('The farm that remembers');
  show(mem, 'the farm that remembers', () => g.farmText());
  show(mem, 'the calendar says', () => g.endOfDayNow().text);
  button(mem, 'Save the farm now', () => toast(g.saveFarm() ? 'Farm saved' : 'Not saved (a seeded game, wiped, or not started)'));
  button(mem, 'Call it a day now (fade, save)', () => g.callItADay({ force: true }));
  button(mem, 'Wipe the farm (new one next load)', () => {
    g.wipeFarm();
    toast('Farm wiped: the next load deals a new one');
  });

  // Moving you about the farm.
  const go = sub('Take me to...');
  button(go, 'the hill climb start', () => {
    const s = g.climbGates[0];
    goTo({ x: s.x - s.tx * 4, y: g.world.heightAt(s.x, s.z) + 0.5, z: s.z - s.tz * 4 });
  });
  button(go, 'the cone course start', () => {
    const s = g.coneGates[0];
    goTo({ x: s.x - s.tx * 4, y: g.world.heightAt(s.x, s.z) + 0.5, z: s.z - s.tz * 4 });
  });
  button(go, 'the rock at the top of the hill', () => {
    const v = g.flaskSpot;
    if (v) goTo({ x: v.x, y: g.world.heightAt(v.x, v.z) + 0.5, z: v.z + 2.5 });
  });
  button(go, 'the jump', () => {
    const r = g.world.layout.jumpRamp;
    if (!r) return;
    const at = rampPoint(r, r.length * 0.6, 3.5);
    goTo({ x: at.x, y: g.world.heightAt(at.x, at.z) + 0.5, z: at.z });
  });
  button(go, 'the bonfire', () => {
    const b = g.world.layout.bonfire;
    goTo({ x: b.x, y: g.world.heightAt(b.x, b.z) + 0.5, z: b.z + 5 });
  });
}

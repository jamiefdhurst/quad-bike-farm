// Things you can make a girl do on demand, shared by the debug panel's Girls tab (a button each) and the console (`girl amy drive red`),
// so both do exactly what the game does. Each action calls the real game methods and says what happened with a toast.
import { pickTrick } from '../npc/showOff.js';
import { cleanUp } from '../npc/muddiness.js';
import { standBy } from '../npc/pair.js';
import { WAITING_IDLES } from '../npc/waiting.js';
import { exhaustSideOf } from '../npc/exhaustBurn.js';

/**
 * @typedef {object} GirlAction
 * @property {string} verb       what the console calls it
 * @property {string} label      the panel's button text, `%` standing for her name
 * @property {string[]} [girls]  only these girls can do it (all of them if left out)
 * @property {boolean} [vehicle] needs a vehicle: the panel passes the one picked, the console the one typed
 * @property {(id: string, unit?: object) => void} run
 */

/** @param {import('../game.js').Game} g */
export function girlActions(g) {
  const girl = (id) => g.companions.find((c) => c.character.id === id);
  const toast = (t) => g.hud.toast(t);
  const nameOf = (id) => girl(id).name;
  /** She has to be free when you ask (npc/availability.js); otherwise says what has her and returns false. */
  const free = (id) => {
    const c = girl(id);
    const a = c.availability({ asked: true });
    if (a.free) return true;
    toast(`${c.name} is busy (${a.why}): call her back to the barn first (the bell)`);
    return false;
  };
  /** The quads she could take now, nearest to `from` first. */
  const freeQuads = (c, from, extra = () => true) =>
    g.girlUnits
      .map((u) => u.quad)
      .filter((q) => c.mayRide(q) && c.canDrive(q) && !c.takenByOther(q) && !q.rider && extra(q))
      .sort((a, b) => a.position.distanceTo(from) - b.position.distanceTo(from));

  /** Her friend (the other girl). */
  const friendOf = (id) => g.companions.find((o) => o.character.id !== id);

  /** @type {GirlAction[]} */
  const actions = [
    {
      verb: 'pair-up',
      label: '% goes and stands with her friend',
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const f = friendOf(id);
        if (g.fallingOut.active) return toast('They have fallen out: she keeps away from her');
        g.handlePairEvent(g.pair.take({ key: 'pairUp', girl: id, friend: f.character.id, to: standBy(c.root.position, f.root.position, g.pair.p) }));
      },
    },
    {
      verb: 'cat',
      label: 'The cat goes over to %',
      run: (id) => {
        if (!g.debugCat('visit', id)) toast('The cat is asleep on something: shoo it first');
      },
    },
    {
      verb: 'dog',
      label: 'The dog goes after %\'s boots',
      run: (id) => {
        if (!g.debugDog('boots', id)) toast('She has to be walking: send her somewhere first');
      },
    },
    {
      verb: 'tag-along',
      label: 'Her friend leaves, % tags along',
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const f = friendOf(id);
        if (g.fallingOut.active) return toast('They have fallen out: she keeps away from her');
        if (!f.availability({ asked: true }).free) return toast(`${f.name} is busy, so there is nobody to follow`);
        f.wander();
        g.handlePairEvent(g.pair.take({ key: 'tagAlong', girl: id, friend: f.character.id, side: g.pair.sideOf({ x: c.root.position.x, z: c.root.position.z }, { x: f.root.position.x, z: f.root.position.z, heading: f.heading }) }));
      },
    },
    {
      verb: 'invite-barn',
      label: '% asks you round the back of the barn',
      run: (id) => {
        const e = g.romance.invite(id, 'barn');
        if (!e) return toast(`${nameOf(id)} has already asked (or is locked in)`);
        g.handleRomanceEvent(e);
      },
    },
    {
      verb: 'invite-quad',
      label: '% asks you for the quad (needs her favourite free)',
      run: (id) => {
        const e = g.romance.invite(id, 'quad');
        if (!e) return toast(`${nameOf(id)} has already asked (or is locked in)`);
        if (!g.handleRomanceEvent(e)) toast(`${nameOf(id)}'s favourite quad isn't free to sit on`);
      },
    },
    {
      verb: 'barn-now',
      label: 'Go round the barn with % now',
      run: (id) => {
        if (g.tryst) return toast('Already at it');
        if (!free(id)) return;
        if (!g.romance.pendingFor(id)) g.romance.invite(id, 'barn');
        g.startTryst(girl(id), 'barn');
      },
    },
    {
      verb: 'shelter',
      label: '% shelters in the nearest cab',
      run: (id) => {
        if (!free(id)) return;
        toast(g.sendToCab(id, 'rain') ? `${nameOf(id)} is off to the nearest cab` : `No cab free for ${nameOf(id)}`);
      },
    },
    ...['grid', 'bumpy', 'mudguard'].map((kind) => ({
      verb: `ask-${kind}`,
      label: { grid: '% asks for the cattle grid again', bumpy: '% asks for the bumpy way', mudguard: '% asks to sit on the tractor (start it)' }[kind],
      run: (id) => {
        const e = g.requests.force(id, kind);
        if (!e) return toast(`${nameOf(id)} has asked for something already`);
        girl(id).voice.say(`ask${kind[0].toUpperCase()}${kind.slice(1)}`, { force: true });
      },
    })),
    {
      verb: 'buzz-sit',
      label: '% sits on the roughest quad',
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const q = g.girlUnits.map((u) => u.quad).filter((x) => x.hasPillion && c.mayRide(x) && c.canRidePillion(x)).sort((a, b) => b.engine.wear - a.engine.wear)[0];
        if (!q) return toast(`${nameOf(id)} has nowhere to sit`);
        c.requestBuzzSit(q);
        c.voice.say('selfBuzz', { force: true });
        toast(`${nameOf(id)} is off to sit on the ${q.unit.name}`);
      },
    },
    // Her reactions (npc/reactions.js), each from something 3 m in front of her.
    ...[
      ['flinch', '% flinches'],
      ['stepBack', '% steps back from something'],
      ['coverEars', '% covers her ears'],
      ['gasp', '% gasps, hands to her mouth'],
      ['cheer', '% cheers'],
      ['turnAway', '% turns away from smoke'],
      ['wave', '% waves at someone going by'],
      ['pose', '% poses for the camera'],
      ['face', '% pulls a face for the camera'],
      ['palm', '% puts a hand up: put that away'],
    ].map(([type, label]) => ({
      verb: type.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
      label,
      run: (id) => {
        const c = girl(id);
        const free = c.root.parent === g.scene;
        const at = free ? c.root.position : c.quad.position;
        const h = free ? c.heading : c.quad.yaw;
        const from = { x: at.x + Math.sin(h) * 3, y: at.y + 0.8, z: at.z + Math.cos(h) * 3 };
        if (!c.react(type, { from, force: true })) toast(`${nameOf(id)} can't do that now (it needs her ${type === 'stepBack' || type === 'turnAway' ? 'stood about' : 'hands free'})`);
      },
    })),
    {
      verb: 'bang',
      label: 'Make a bang behind % (she should turn and look)',
      run: (id) => {
        const c = girl(id);
        // Eight metres behind her, wherever she is (on a seat she faces the way the vehicle does).
        const free = c.root.parent === g.scene;
        const at = free ? c.root.position : c.quad.position;
        const h = free ? c.heading : c.quad.yaw;
        g.notice('bang', { x: at.x - Math.sin(h) * 8, y: at.y + 0.5, z: at.z - Math.cos(h) * 8 }, { key: 'debug' });
        toast(`A bang behind ${nameOf(id)}`);
      },
    },
    {
      verb: 'numb',
      label: '% goes numb now: gets off, walks it off, stretches and gets back on (needs her on the back of a quad)',
      run: (id) => toast(girl(id).forceNumb() ? `${nameOf(id)}'s bum has gone numb` : `${nameOf(id)} needs to be sat on the back of a quad`),
    },
    {
      verb: 'compare',
      label: 'Both girls compare quads now (needs each to have felt some shake)',
      run: () => {
        const exists = (id) => g.girlUnits.some((u) => u.spec.id === id);
        const plan = g.comparing.plan(g.companions.map((c) => ({ id: c.character.id, buzz: c.content.buzz })), exists, { force: false });
        if (!plan) return toast('Neither girl has felt any shake yet: sit on a running quad for a while first');
        g.runComparing(g.comparing.update(0, { girls: [], floorFree: false }));
        toast(`${plan.first} and ${plan.second} compare notes${plan.agree ? ' (they agree)' : plan.swap ? ' (and swap)' : ' (and disagree)'}`);
      },
    },
    {
      verb: 'minds-fix',
      label: '% minds you fixed her favourite (says her line now)',
      run: (id) => {
        const c = girl(id);
        const fav = c.voice.favourite;
        if (!fav) return toast(`${nameOf(id)} has no favourite yet`);
        g.dontFix.force(id, fav);
        toast(c.voice.onFixedFavourite() ? `${nameOf(id)} minds` : `${nameOf(id)} is too far away to say`);
      },
    },
    ...['ramp', 'ford', 'fence', 'bank'].map((kind) => ({
      verb: `dare-${kind}`,
      label: `% dares you at ${{ ramp: 'the ramp', ford: 'the ford', fence: 'the fence', bank: 'the bank' }[kind]} (you have two minutes; she cheers or calls you chicken)`,
      girls: ['jess'],
      run: (id) => g.startDare(id, kind),
    })),
    {
      verb: 'phone-call',
      label: "%'s phone rings: she wanders off out of earshot, takes it, and comes back with news (or sometimes in a mood that lasts a few minutes)",
      run: (id) => g.startPhoneCall(id),
    },
    {
      verb: 'phone-call-bad',
      label: '% takes a call that goes badly (stands lower with you for a few minutes)',
      run: (id) => g.startPhoneCall(id, true),
    },
    {
      verb: 'car-go',
      label: '% drives her own car out and back (the Fiesta for Amy, the Corsa for Jess)',
      run: (id) => {
        if (!free(id)) return;
        const kind = g.carGoContext(g.riddenUnit).girls[id]?.car;
        if (!kind) return toast(`${nameOf(id)} has no car here`);
        if (!g.goFree(kind)) return toast(`Someone is in or at her ${g.landys[kind].spec.name} just now`);
        g.handleCarGoEvent({ type: 'carGo', girl: id, vehicle: kind });
      },
    },
    {
      verb: 'bench-work',
      label: '% works on the bench quad (needs one parked there, off, and the toolbox on the bench; Jess makes a hash of it and hands it to you)',
      run: (id) => g.startGirlBench(id),
    },
    {
      verb: 'flask',
      label: '% pours the tea at the rock (walks there from wherever she is; needs dry, light weather)',
      run: (id) => {
        if (!free(id)) return;
        if (g.flask.active) return toast('Someone already has the flask out');
        if (!g.fineForFlask()) return toast('It is too wet or too dark for the flask');
        toast(g.askForFlask(girl(id)) ? `${nameOf(id)} is off to the rock with the flask` : `${nameOf(id)} can't just now`);
      },
    },
    {
      verb: 'fire',
      label: '% sits on a log by the bonfire (needs it lit and blazing: build one with the button on the shared section)',
      run: (id) => {
        if (!free(id)) return;
        if (!g.bonfire.blazing) return toast('The bonfire is not blazing yet');
        toast(g.askForFire(girl(id)) ? `${nameOf(id)} is off to sit by the fire` : `${nameOf(id)} can't just now`);
      },
    },
    {
      verb: 'warm-sit',
      label: '% warms up the picked vehicle (needs it off, and a seat)',
      vehicle: true,
      run: (id, unit) => {
        if (!free(id)) return;
        const c = girl(id);
        if (unit.quad.engine.isRunning || !g.warmSitSpot(c, unit)) return toast(`${nameOf(id)} can't: it needs to be off, with a free seat for her`);
        g.warmUpFor(c, unit, true);
        toast(`${nameOf(id)} is off to start it and sit on it`);
      },
    },
    {
      verb: 'wait-ready',
      label: '% starts a quad and waits for you',
      run: (id) => {
        if (!free(id)) return;
        toast(g.askToWait(girl(id), true) ? `${nameOf(id)} is off to get a quad ready` : `${nameOf(id)} can't find a quad with a free back seat`);
      },
    },
    {
      verb: 'sulk',
      label: '% sulks alone in a Land Rover (skips the row)',
      run: (id) => {
        if (!free(id)) return;
        if (!g.sulking.begin(id, 'forced')) return toast(`${nameOf(g.sulking.who)} is already sulking`);
        toast(`${nameOf(id)} is off to sulk in a Land Rover`);
      },
    },
    {
      verb: 'keep-alive',
      label: '% keeps the picked vehicle alive (needs it running, nobody on it)',
      vehicle: true,
      run: (id, unit) => {
        if (!free(id)) return;
        toast(g.sendToKeepAlive(girl(id), unit, true) ? `${nameOf(id)} is off to sit on the back and hold the idle` : `${nameOf(id)} can't: it needs to be running with nobody on it, and a free seat`);
      },
    },
    {
      verb: 'warm-up',
      label: '% warms up in a Land Rover',
      run: (id) => {
        if (!free(id)) return;
        toast(g.sendToCab(id, 'cold') ? `${nameOf(id)} is off to a Land Rover` : `No Land Rover free for ${nameOf(id)}`);
      },
    },
    {
      verb: 'moto',
      label: '% has a go on the mini moto (Jess wobbles, gets braver and comes off on the grass; Amy says she is not getting on it)',
      run: (id) => {
        const c = girl(id);
        const u = g.units.find((x) => x.spec.miniMoto);
        if (!u) return toast('There is no mini moto on the farm this game');
        if (c.refusesMoto(u.quad)) {
          c.refuseMoto();
          return toast(`${c.name} won't touch the mini moto`);
        }
        if (!free(id)) return;
        if (!c.mayRide(u.quad) || !c.canDrive(u.quad) || c.takenByOther(u.quad) || u.quad.rider) return toast(`${c.name} can't have a go on the mini moto right now`);
        c.requestDrive(u.quad);
        toast(`${c.name} is off to have a go on the mini moto`);
      },
    },
    {
      verb: 'drive',
      label: '% drives the picked vehicle',
      vehicle: true,
      run: (id, u) => {
        const c = girl(id);
        if (!free(id)) return;
        // The tractor, the UTV and the Land Rover are her "go": same as asking from the wheel, so the bookkeeping (her own quad, Amy's day) is the game's.
        const kind = g.goKindOf?.(u.quad);
        if (kind) {
          if (!g.goFree(kind) || !c.canDrive(u.quad)) return toast(`${c.name} can't or won't drive the ${u.name} right now`);
          g.startGo(c, kind);
          return toast(`${c.name} is off to drive the ${u.name}`);
        }
        if (!c.mayRide(u.quad) || !c.canDrive(u.quad) || c.takenByOther(u.quad) || u.quad.rider) return toast(`${c.name} can't or won't drive the ${u.name} right now`);
        c.requestDrive(u.quad);
        toast(`${c.name} is off to drive the ${u.name}`);
      },
    },
    {
      verb: 'outing',
      label: '% drives somewhere and back (a place picked from the farm, by the gateways)',
      run: (id) => {
        const c = girl(id);
        if (!free(id)) return;
        const q = freeQuads(c, c.root.position)[0];
        if (!q) return toast(`${c.name} has no quad she can take`);
        c.outingForced = true; // the next drive goes somewhere for certain
        c.requestDrive(q);
        toast(`${c.name} is off for a drive somewhere`);
      },
    },
    {
      verb: 'back-seat',
      label: '% gets in the back of the 200TDi',
      run: (id) => {
        const c = girl(id);
        const l = g.landys?.defender;
        if (!l?.unit) return toast('The 200TDi isn\'t on the farm this game');
        if (!free(id)) return;
        g.askIntoLandy(c, l, { back: true }); // as asking from her wheel: it says if she can't
        if (c.traSlot?.rear) toast(`${c.name} is getting in the back of the 200TDi`);
      },
    },
    {
      verb: 'start',
      label: '% starts the picked vehicle (the starting handle on a flat Land Rover)',
      vehicle: true,
      run: (id, u) => {
        const c = girl(id);
        if (!free(id)) return;
        const kind = g.goKindOf?.(u.quad);
        const ok = kind ? g.canAskStart(c, kind) : !u.quad.engine.isRunning && !u.quad.rider && !u.quad.isTipped;
        if (!ok) return toast(`${c.name} can't start the ${u.name} right now`);
        c.requestStart(u.quad);
        toast(`${c.name} is off to start the ${u.name}`);
      },
    },
    {
      verb: 'push-start',
      label: '% bump-starts the picked vehicle (you in the seat, the clutch in)',
      vehicle: true,
      run: (id, u) => {
        const c = girl(id);
        if (!free(id)) return;
        if (!c.canPushStart(u.quad)) return toast(`${c.name} can't push the ${u.name}: it needs a clutch, to be stopped, and you in the seat`);
        c.requestPush(u.quad);
        toast(`${c.name} is off to push the ${u.name}`);
      },
    },
    {
      verb: 'steer-tow',
      label: '% steers the towed quad (hook the rope from the Vehicles tab first)',
      run: (id) => {
        const c = girl(id);
        if (!free(id)) return;
        const rope = g.towRope;
        const quad = rope.state === 'hooked' ? rope.target : null;
        if (!quad) return toast('The tow rope is not hooked on anything: use "Hook the tow rope on it" on the Vehicles tab');
        if (!c.canSteerTowed(quad, rope)) return toast(`${c.name} can't steer it right now (somebody is on it, or it is moving)`);
        c.requestTowSteer(quad, rope);
        toast(`${c.name} is off to steer the towed quad`);
      },
    },
    {
      verb: 'ride',
      label: '% rides on the back of it',
      vehicle: true,
      run: (id, u) => {
        const c = girl(id);
        if (!free(id)) return;
        if (!c.canRidePillion(u.quad)) return toast(`${c.name} can't ride on the ${u.name}`);
        c.requestMount(u.quad);
      },
    },
    {
      verb: 'ramp',
      label: '% jumps the ramp',
      run: (id) => {
        const c = girl(id);
        if (!free(id)) return;
        c.selfEvents.push('jumps');
        if (!g.sendToRamp(c)) toast(`${c.name} cannot find a free quad, or the line to the ramp is blocked`);
      },
    },
    {
      verb: 'helmet',
      label: '% fetches or hangs up her helmet',
      run: (id) => {
        const what = g.headgear.toggle(id);
        toast(what === 'fetch' ? `${nameOf(id)} will go and get her helmet once she is stood about` : `${nameOf(id)} will go and hang her helmet up once she is stood about`);
      },
    },
    {
      verb: 'jumper',
      label: '% fetches or hangs up a jumper',
      run: (id) => {
        const what = g.jumpers.toggle(id);
        toast(what === 'fetch' ? `${nameOf(id)} will go and put a jumper on once she is stood about` : `${nameOf(id)} will go and hang her jumper up once she is stood about`);
      },
    },
    {
      verb: 'coat',
      label: '% fetches or hangs up a wax jacket',
      run: (id) => {
        const what = g.coats.toggle(id);
        toast(what === 'fetch' ? `${nameOf(id)} will go and put a coat on once she is stood about` : `${nameOf(id)} will go and hang her coat up once she is stood about`);
      },
    },
    {
      verb: 'hood',
      label: "% puts her coat's hood up or down (for a minute)",
      run: (id) => {
        if (!g.coats.worn[id]) return toast(`${nameOf(id)} has no coat on`);
        toast(g.coats.toggleHood(id) ? `${nameOf(id)} puts her hood up` : `${nameOf(id)} puts her hood down`);
      },
    },
    {
      verb: 'throttle',
      label: '% grabs the throttle (next ride with her on the back)',
      run: (id) => {
        g.throttleGrab.forced = id;
        toast(`Ride with ${nameOf(id)} on the back (moving): she will grab the throttle`);
      },
    },
    {
      verb: 'fallout',
      label: 'Fall out with % at fault',
      run: (id) => {
        if (!g.fallingOut.active) g.handleFallingOut(g.fallingOut.begin('digs', id));
      },
    },
    {
      verb: 'lineup',
      label: 'Amy lines the quads up by the barn',
      girls: ['amy'],
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const job = c.planLineUp(0);
        if (!job) return toast('The quads are already in a row (or none are free)');
        c.lineUpOn = true;
        c.startLineUp(job);
      },
    },
    {
      verb: 'crooked',
      label: 'Jess parks one crooked',
      girls: ['jess'],
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const job = c.planLineUp(1);
        if (!job) return toast('No free quad');
        c.startLineUp(job);
      },
    },
    {
      verb: 'doughnuts',
      label: 'Jess does doughnuts',
      girls: ['jess'],
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const quads = freeQuads(c, c.root.position, (q) => q.position.distanceTo(c.root.position) < 60);
        const plan = c.doughnutPlan();
        if (!quads.length || !plan) return toast('Jess cannot find a free quad or a clear stretch of field');
        c.selfEvents.push('doughnuts');
        c.requestDrive(quads[0], { doughnut: plan });
      },
    },
    {
      verb: 'showoff',
      label: 'Jess shows off to you',
      girls: ['jess'],
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const quads = freeQuads(c, c.root.position, (q) => !q.tractor).sort((a, b) => (b.engine.params.strokes === 2) - (a.engine.params.strokes === 2));
        if (!quads.length) return toast('No free quad');
        c.selfEvents.push('showOff');
        c.requestDrive(quads[0], { showOff: { trick: pickTrick(quads[0].engine.params.strokes === 2, g.showOffParams), p: g.showOffParams } });
      },
    },
    {
      verb: 'nick',
      label: 'Jess nicks the nearest quad',
      girls: ['jess'],
      run: (id) => {
        if (!free(id)) return;
        const c = girl(id);
        const quads = freeQuads(c, g.player.position);
        if (!quads.length) return toast('No free quad');
        g.startNick(c, quads[0]);
      },
    },
    {
      verb: 'climb',
      label: '% climbs the hill against the clock',
      run: (id) => {
        if (!free(id)) return;
        if (g.hillClimb.active) return toast('Somebody is already climbing');
        const c = girl(id);
        const quads = freeQuads(c, g.player.position, (q) => !q.bog.stuck);
        if (!quads.length) return toast('No free quad');
        const unit = g.girlUnits.find((u) => u.quad === quads[0]);
        g.startHillClimb(g.hillClimb.take({ key: 'climb', girl: id, pick: unit.spec.id }));
        toast(`${nameOf(id)} sets off for the cones past the stream`);
      },
    },
    {
      verb: 'cones',
      label: '% runs the cone course',
      run: (id) => {
        if (!free(id)) return;
        if (g.coneCourse.active) return toast('Somebody is already on the cone course');
        const c = girl(id);
        const quads = freeQuads(c, g.player.position, (q) => !q.bog.stuck);
        if (!quads.length) return toast('No free quad');
        const unit = g.girlUnits.find((u) => u.quad === quads[0]);
        g.startConeCourse(g.coneCourse.take({ key: 'cones', girl: id, pick: unit.spec.id }));
        toast(`${nameOf(id)} sets off for the cone course`);
      },
    },
    {
      verb: 'diesel',
      label: 'Jess pours red diesel into a quad',
      girls: ['jess'],
      run: () => {
        g.dieselMistake.forced = true;
        toast('Jess will fill a parked quad from the diesel can as soon as she is stood about');
      },
    },
    {
      verb: 'names',
      label: 'Jess names the quads now',
      girls: ['jess'],
      run: () => {
        g.quadNames.p.firstNameAfter = 0;
        g.quadNames.p.nameEvery = 5;
        g.quadNames.nextAt = 0;
        toast('Jess will name the quads, one every 5 seconds, when she is free and you are near');
      },
    },
  ];
  actions.push({
    verb: 'splash',
    label: '% gets splashed with mud and dust',
    run: (id) => {
      const m = girl(id).mucky;
      m.mud = 0.8;
      m.dust = 0.6;
      m.wet = 1;
      m.noticedMud = m.noticedDust = false;
      m.sinceRemark = 1e9;
    },
  });
  actions.push({
    verb: 'clean',
    label: '% is scrubbed clean',
    run: (id) => cleanUp(girl(id).mucky),
  });
  actions.push({
    verb: 'start-generator',
    label: '% goes and starts the generator',
    run: (id) => {
      if (!free(id)) return;
      if (g.generator.running) return toast('The generator is already running');
      if (g.generator.fuel <= 0) return toast('The generator has no diesel in it: fill it first');
      const e = g.generatorStart.force(g.generatorStartContext(), id);
      if (e) g.handleGeneratorStart(e);
    },
  });
  actions.push({
    verb: 'guide-trailer',
    label: '% guides you back with the trailer',
    girls: ['amy'],
    run: (id) => {
      const ride = g.riddenUnit;
      if (!ride || !g.trailerOf(ride.quad)) return toast('Ride something with a trailer hitched first');
      if (g.trailerGuide.active) return toast('She is already guiding you back');
      if (!free(id)) return;
      g.handleTrailerGuide(g.trailerGuide.take({ girl: id }));
    },
  });
  actions.push({
    verb: 'light-me',
    label: '% lights you up with a vehicle (after dark)',
    run: (id) => g.askWorkLight(girl(id)),
  });
  actions.push({
    verb: 'burn-leg',
    label: '% burns her leg on the exhaust',
    run: (id) => {
      const c = girl(id);
      if (!c.fsm.is('seated') || !exhaustSideOf(c.quad)) return toast(`${c.name} has to be sat on a quad with an exhaust on one side`);
      c.forceBurn = true;
      c.requestStandBeside(c.quad);
    },
  });
  // Each way of waiting that fits what's about her (npc/waiting.js), started now.
  for (const [name, w] of Object.entries(WAITING_IDLES)) {
    actions.push({
      verb: `wait-${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`,
      label: `% waits, ${w.label}${w.needs === 'wheel' ? ' (a tyre within reach)' : w.needs === 'seat' ? ' (a seat within reach)' : ''}`,
      run: (id) => {
        const why = girl(id).forceWaiting(name);
        if (why) toast(`${nameOf(id)} can't: ${why}`);
      },
    });
  }
  return {
    all: actions,
    /** The actions this girl can do. */
    forGirl: (id) => actions.filter((a) => !a.girls || a.girls.includes(id)),
    find: (id, verb) => actions.find((a) => a.verb === verb.toLowerCase() && (!a.girls || a.girls.includes(id))),
  };
}

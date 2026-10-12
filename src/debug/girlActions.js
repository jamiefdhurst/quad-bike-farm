// Things you can make a girl do on demand, shared by the debug panel's Girls tab (a button each) and the console (`girl amy drive red`),
// so both do exactly what the game does. Each action calls the real game methods and says what happened with a toast.
import { pickTrick } from '../npc/showOff.js';
import { cleanUp } from '../npc/muddiness.js';
import { standBy } from '../npc/pair.js';
import { WAITING_IDLES } from '../npc/waiting.js';

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
      verb: 'tag-along',
      label: 'Her friend wanders off and % tags along',
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
      label: 'Go round the back of the barn with % now',
      run: (id) => {
        if (g.tryst) return toast('Already at it');
        if (!free(id)) return;
        if (!g.romance.pendingFor(id)) g.romance.invite(id, 'barn');
        g.startTryst(girl(id), 'barn');
      },
    },
    {
      verb: 'shelter',
      label: '% gets into the nearest cab out of the rain',
      run: (id) => {
        if (!free(id)) return;
        toast(g.sendToCab(id, 'rain') ? `${nameOf(id)} is off to the nearest cab` : `No cab free for ${nameOf(id)}`);
      },
    },
    ...['grid', 'bumpy', 'mudguard'].map((kind) => ({
      verb: `ask-${kind}`,
      label: { grid: '% asks you to take her over the cattle grid again', bumpy: '% asks you to go the bumpy way', mudguard: '% asks you to start the tractor so she can sit on its mudguard' }[kind],
      run: (id) => {
        const e = g.requests.force(id, kind);
        if (!e) return toast(`${nameOf(id)} has asked for something already`);
        girl(id).voice.say(`ask${kind[0].toUpperCase()}${kind.slice(1)}`, { force: true });
      },
    })),
    {
      verb: 'buzz-sit',
      label: '% goes and sits on the roughest quad near her for the shake',
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
      label: 'Both girls compare which quads shake them most now (needs each to have felt some shake)',
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
      label: '% minds that you fixed up her favourite (says her line now)',
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
      label: `% dares you to ${{ ramp: 'jump the ramp', ford: 'take the ford flat out', fence: 'touch the electric fence', bank: 'ride the mini moto down the steepest bank' }[kind]} (you have two minutes; she cheers or calls you chicken)`,
      girls: ['jess'],
      run: (id) => g.startDare(id, kind),
    })),
    {
      verb: 'bench-work',
      label: '% works on the quad in the bay at the bench (needs one parked there, off, and the toolbox on the bench; Jess makes a hash of it and hands it to you)',
      run: (id) => g.startGirlBench(id),
    },
    {
      verb: 'flask',
      label: '% goes up to the rock at the top of the hill and pours the tea (walks there from wherever she is; needs dry, light weather)',
      run: (id) => {
        if (!free(id)) return;
        if (g.flask.active) return toast('Someone already has the flask out');
        if (!g.fineForFlask()) return toast('It is too wet or too dark for the flask');
        toast(g.askForFlask(girl(id)) ? `${nameOf(id)} is off to the rock with the flask` : `${nameOf(id)} can't just now`);
      },
    },
    {
      verb: 'warm-sit',
      label: '% starts the picked vehicle and sits on it while it warms (needs it off, and a seat)',
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
      label: '% gets a quad going and waits on the back for you, revving and tooting',
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
      label: '% sits on the back of the picked vehicle and keeps it alive (needs it running, nobody on it)',
      vehicle: true,
      run: (id, unit) => {
        if (!free(id)) return;
        toast(g.sendToKeepAlive(girl(id), unit, true) ? `${nameOf(id)} is off to sit on the back and hold the idle` : `${nameOf(id)} can't: it needs to be running with nobody on it, and a free seat`);
      },
    },
    {
      verb: 'warm-up',
      label: '% starts a Land Rover and sits in it to get warm',
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
      label: '% drives the vehicle picked on the Vehicles tab',
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
      label: '% drives somewhere on the farm and back (a place picked from the farm, by the gateways)',
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
      label: '% starts the vehicle picked on the Vehicles tab (the starting handle on a flat Land Rover)',
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
      label: '% pushes the vehicle picked on the Vehicles tab to bump-start it (you in the seat, the clutch in)',
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
      verb: 'jumper',
      label: '% fetches or hangs up a jumper',
      run: (id) => {
        const what = g.jumpers.toggle(id);
        toast(what === 'fetch' ? `${nameOf(id)} will go and put a jumper on once she is stood about` : `${nameOf(id)} will go and hang her jumper up once she is stood about`);
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
    verb: 'light-me',
    label: '% brings a vehicle round to light you up (after dark)',
    run: (id) => g.askWorkLight(girl(id)),
  });
  // Each way of waiting that fits what's about her (npc/waiting.js), started now.
  for (const [name, w] of Object.entries(WAITING_IDLES)) {
    actions.push({
      verb: `wait-${name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`,
      label: `% waits about ${w.label}${w.needs === 'wheel' ? ' (a tyre within reach)' : w.needs === 'seat' ? ' (a seat within reach)' : ''}`,
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

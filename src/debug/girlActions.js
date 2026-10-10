// Things you can make a girl do on demand, shared by the debug panel's Girls tab (a button each) and the console (`girl amy drive red`),
// so both do exactly what the game does. Each action calls the real game methods and says what happened with a toast.
import { pickTrick } from '../npc/showOff.js';

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
  /** She has to be stood about; otherwise says so and returns false. */
  const free = (id) => {
    const c = girl(id);
    if (c.fsm.is('idle')) return true;
    toast(`${c.name} is busy: call her back to the barn first (the bell)`);
    return false;
  };
  /** The quads she could take now, nearest to `from` first. */
  const freeQuads = (c, from, extra = () => true) =>
    g.girlUnits
      .map((u) => u.quad)
      .filter((q) => c.mayRide(q) && c.canDrive(q) && !c.takenByOther(q) && !q.rider && extra(q))
      .sort((a, b) => a.position.distanceTo(from) - b.position.distanceTo(from));

  /** @type {GirlAction[]} */
  const actions = [
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
  return {
    all: actions,
    /** The actions this girl can do. */
    forGirl: (id) => actions.filter((a) => !a.girls || a.girls.includes(id)),
    find: (id, verb) => actions.find((a) => a.verb === verb.toLowerCase() && (!a.girls || a.girls.includes(id))),
  };
}

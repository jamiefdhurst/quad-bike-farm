// The girls' minds in the running game: each girl's needs and mood moving with her day, and every couple of seconds weighing what she could
// do against them and taking the best (needs.js, chooser.js). The offers come from the features that have moved out of game.js and are asked
// here. game.js builds this and calls updateMinds() inside the frame guard; .claude/rules/girls-minds.md has the rules.

import * as THREE from 'three';
import { choose, mainNeed, nextThink, OFFER_KINDS } from './chooser.js';
import { agendaKey } from './agenda.js';
import { GO_KINDS } from './tractorGo.js';
import { showOffBoost } from '../world/kids.js';
import { underCover } from './soaking.js';

export class MindsHost {
  constructor(game) {
    this.g = game;
    this.needsAt = null;
  }

  /**
   * The girls' minds (npc/needs.js, npc/chooser.js): each girl's needs move with what she's doing and where she is, and every couple of
   * seconds while she's free she weighs what she could do against them and takes the best. With autonomy off nothing new starts. A
   * girl only doing something idle (sat resting, warming her hands) weighs only the urgent things, like shelter from the rain.
   */
  updateMinds(dt, ridden) {
    const g = this.g;
    for (const c of g.companions) {
      const ctx = this.needsContext(c);
      c.needs.update(dt, ctx, c.params);
      g.favour.setWant(c.character.id, c.needs.attention); // her jealousy is what 'neglected' is made of (favour.js)
      const swing = c.mood.update(dt, c.needs, ctx, c.params);
      if (swing && c.availability().canRemark) c.voice.say(swing === 'low' ? 'moodLow' : 'moodHigh', { chance: 1 });
      c.wetNow = ctx.wet;
      c.warmedNow = ctx.warmed; // and what warms and chills her, for how soaked she is (updateSoaking)
      c.chillNow = ctx.chill;
      // What the day is doing, for the ways she waits about (npc/waiting.js): the cold, the sun, a shower coming on.
      const w = g.weather;
      c.waitWeather = { chill: ctx.chill, wet: ctx.wet, sun: Math.min(1, w.def.sky.sunIntensity / 2.6) * (1 - w.rain) * w.sunUp, clouding: Math.max(0, w.target - w.rain), shiver: c.soaked.cold };
      c.intent.update(dt, `${c.fsm.name}:${c.fsm.data?.goal ?? ''}`);
      c.memory.update(dt, c.params);
      // What she has in mind for the day, said early on once she's stood about with nothing holding her (npc/agenda.js).
      if (c.agenda.due(dt) && c.availability().canRemark) {
        c.agenda.mention();
        c.voice.say(agendaKey(c.agenda.id), { chance: 1 });
      }
      const m = c.mind;
      m.since += dt;
      if ((m.thinkIn -= dt) > 0) continue;
      m.thinkIn = nextThink(c.params.thinkEvery, c.params.sleepySlowThink * c.needs.sleep); // sleepy, she thinks slowly
      if (!c.params.ownMind) {
        m.waiting = 'her own mind is off';
        continue;
      }
      const a = c.availability();
      // Sat about on a quad of her own choosing she can choose to get off; doing something idle, only something urgent takes her.
      const sitting = !a.free && (c.sittingAbout() || g.lessonGirls(ridden).includes(c.character.id));
      const urgentOnly = !a.free && !sitting && c.interruptible();
      if (!a.free && !urgentOnly && !sitting) {
        m.waiting = a.why;
        continue;
      }
      m.waiting = null;
      // Something you stopped her doing is still on her mind, so she's keener on it for a while (npc/intent.js).
      // Sleepy, she can't be bothered with anything but a doze (companionParams: sleepyLazy).
      const lazy = 1 - c.params.sleepyLazy * c.needs.sleep;
      let offers = this.offersFor(c, ridden).map((o) => ({ ...o, weight: o.weight * c.intent.boost(o.key, c.params) * c.memory.weight(o.key) * c.agenda.boost(o.key, c.params) * showOffBoost(o.key, g.trafficHost.kidsWatching, g.trafficHost.kidsParams) * (o.key === 'doze' || OFFER_KINDS[o.key]?.urgent ? 1 : lazy * c.mood.keen(c.params)) }));
      if (sitting) offers = offers.filter((o) => OFFER_KINDS[o.key]?.fromSeat);
      else if (urgentOnly) offers = offers.filter((o) => OFFER_KINDS[o.key]?.urgent);
      // Free again with a plan to carry on (npc/plans.js): the second part, if it's still on offer, is taken without weighing.
      const planned = a.free ? c.intent.nextStep(offers) : null;
      const { pick: chosen, scored } = choose(c.needs, offers, c.params);
      const pick = planned ?? chosen;
      // What she weighed and didn't take, for the debug panel's "nearly chose".
      m.scored = scored.filter((s) => s.offer !== pick).slice(0, 4).map((s) => ({ key: s.offer.key, score: s.score }));
      if (!pick) continue;
      const need = mainNeed(pick, c.needs);
      g.trafficHost.girlChose(c, pick.key);
      // Wanting company, she may ask you along first and wait for your answer (npc/askAlong.js).
      if (g.askBeforeGoing(c, pick, planned)) {
        m.last = { key: pick.key, need, score: scored[0].score, asking: true };
        m.since = 0;
        continue;
      }
      pick.take();
      c.needs.met(OFFER_KINDS[pick.key].satisfies);
      c.chose();
      // She walks to it at its pace, and on her way she can be stopped (npc/intent.js).
      c.pace = OFFER_KINDS[pick.key].pace ?? null;
      if (c.intent.chose(pick.key, `${c.fsm.name}:${c.fsm.data?.goal ?? ''}`)) c.voice.say('resumed', { urgent: true, chance: 0.8 });
      else {
        // Something that went badly or well before: she says so now and then (npc/memory.js).
        const feeling = c.memory.attitude(pick.key, c.params);
        if (feeling) c.voice.say(feeling < 0 ? 'memoryWary' : 'memoryKeen', { urgent: true, chance: c.params.memoryLineChance });
      }
      m.last = { key: pick.key, need, score: scored[0].score };
      m.since = 0;
    }
  }

  /** Everything this girl could choose to do now (npc/chooser.js): her boredom choices and what the moved features offer her. */
  offersFor(c, ridden) {
    const g = this.g;
    const id = c.character.id;
    const mine = (list, act) => list.filter((o) => o.girl === id).map((o) => ({ ...o, take: () => act(o) }));
    const cabs = g.cabShelterContext();
    return [
      ...c.boredOffers(c.viewer),
      ...mine(g.warming.offers(g.warmingContext()), (o) => g.handleWarmingEvent(g.warming.take(o))),
      ...mine(g.cabShelter.offers(cabs), (o) => {
        const e = g.cabShelter.take(o, cabs);
        if (e) g.handleCabEvent(e);
      }),
      ...mine(g.places.offers(g.placesContext()), (o) => g.handlePlaceAction(g.places.take(o))),
      ...mine(g.dares.offers(g.daresContext()), (o) => g.handleDare(g.dares.take(o))),
      ...mine(g.phoneCalls.offers(g.phoneContext()), (o) => g.handlePhoneCall(g.phoneCalls.take(o))),
      ...mine(g.girlBench.offers(g.girlBenchContext()), (o) => g.handleGirlBench(g.girlBench.take(o))),
      ...mine(g.trailerGuide.offers(g.trailerGuideContext(ridden)), (o) => g.handleTrailerGuide(g.trailerGuide.take(o))),
      ...mine(g.workLight.offers(g.workLightContext(c)), (o) => {
        c.voice.say('workLightOffer', { urgent: true, force: true });
        g.handleWorkLight(g.workLight.take(o));
      }),
      ...mine(g.hayLoading?.offers(g.fieldWork.hayLoadContext()) ?? [], (o) => {
        g.companions.find((g) => g.character.id === o.girl).voice.say('hayGo', { urgent: true, force: true });
        g.fieldWork.handleHayLoad(g.hayLoading.take(o));
      }),
      ...g.lostOffers(c),
      ...mine(g.generatorStart.offers(g.generatorStartContext()), (o) => {
        g.companions.find((g) => g.character.id === o.girl).voice.say('generatorGo', { urgent: true, force: true });
        g.handleGeneratorStart(g.generatorStart.take(o));
      }),
      ...mine(g.tidyUp.offers(g.tidyUpContext()), (o) => g.handleTidyUp(g.tidyUp.take(o))),
      ...mine(g.tidyLoad.offers(g.tidyLoadContext()), (o) => {
        g.companions.find((g) => g.character.id === o.girl).voice.say(o.mode === 'load' ? 'tidyLoadIn' : 'tidyLoadOut', { urgent: true, force: true });
        g.handleTidyLoad(g.tidyLoad.take(o));
      }),
      ...mine(g.tea.offers(g.teaContext(ridden)), (o) => g.handleTeaEvent(g.tea.take(o))),
      ...mine(g.flask.offers(g.flaskContext(ridden)), (o) => g.handleFlaskEvent(g.flask.take(o))),
      ...mine(g.lunch.offers(g.lunchContext()), (o) => g.handleLunchEvent(g.lunch.take(o))),
      ...mine(g.hutHost.offers(), (o) => g.hutHost.take(o)),
      ...mine(g.fireSit.offers(g.fireSitContext()), (o) => g.handleFireEvent(g.fireSit.take(o, g.fireSit.seatsLeft(g.fireSpots.length)))),
      ...(g.hiding.active ? [] : mine(g.requests.offers(g.requestContext(ridden)), (o) => g.handleRequestEvent(g.requests.take(o)))),
      ...mine(g.jumpers.offers(g.jumpersContext()), (o) => g.handleJumperEvent(g.jumpers.take(o))),
      ...mine(g.coats.offers(g.jumpersContext()), (o) => g.handleCoatEvent(g.coats.take(o))),
      ...mine(g.headgear.offers(g.headgearContext()), (o) => g.handleHeadgearEvent(g.headgear.take(o))),
      ...mine(g.dieselMistake.offers(g.dieselContext(ridden)), (o) => g.handleDieselEvent(g.dieselMistake.take(o))),
      ...mine(g.pranks.offers(g.prankContext(ridden)), (o) => g.handlePrankEvent(g.pranks.take(o))),
      ...g.conkerOffers(c, ridden),
      ...g.rockPrankOffers(c),
      ...mine(g.headStart.offers(g.headStartContext()), (o) => g.handleHeadStartEvent(g.headStart.take(o))),
      ...mine(g.practising.offers(g.practiseContext()), (o) => g.handlePractiseGo(g.practising.take(o))),
      ...mine(g.nicking.offers(g.nickContext(ridden)), (o) => g.handleNickEvent(g.nicking.take(o))),
      ...(GO_KINDS.some((k) => g.goVehicle(k)) ? mine(g.tractorGo.offers(g.tractorGoContext(ridden)), (o) => g.handleGoEvent(g.tractorGo.take(o))) : []),
      ...mine(g.carGo.offers(g.carGoContext(ridden)), (o) => g.handleCarGoEvent(g.carGo.take(o))),
      ...this.lPlateOffers(id),
      ...this.togetherOffers(c, ridden),
      ...(g.tryst ? [] : mine(g.romance.offers(g.romanceContext()), (o) => {
        const e = g.romance.take(o);
        if (e) g.handleRomanceEvent(e);
      })),
      ...g.lessonOffers(id, ridden),
      ...c.seatOffers(),
    ];
  }

  /** The L plates, as offers for this girl (npc/lPlates.js). */
  lPlateOffers(id) {
    const g = this.g;
    const ctx = g.lPlatesContext();
    if (!ctx) return [];
    return g.lPlates.offers(ctx).filter((o) => o.girl === id).map((o) => ({ ...o, take: () => g.handleLPlateEvent(g.lPlates.take(o)) }));
  }

  /** The things the two of them do together, as offers for this girl: a ride together, a race, Jess's drag dare, comparing notes. */
  togetherOffers(c, ridden) {
    const g = this.g;
    if (g.recalling) return [];
    const id = c.character.id;
    const mine = (list, act) => list.filter((o) => o.girl === id).map((o) => ({ ...o, take: () => act(o) }));
    const compare = g.comparingContext();
    return [
      ...mine(g.makeUp.offers(g.makeUpContext()), (o) => g.handleMakeUp(g.makeUp.take(o))),
      ...mine(g.convoy.offers(g.convoyContext(ridden)), (o) => g.handleConvoyEvent(g.convoy.take(o))),
      ...(g.drag.active || g.hillClimb.active || g.coneCourse.active
        ? []
        : mine(g.race.offers(g.raceContext(ridden)), (o) => g.handleRaceEvent(g.race.take(o))).map((o) => ({
            ...o,
            takeAlone: () => g.handleRaceEvent(g.race.take({ ...o, youRiding: null })), // she goes without you after a not now
          }))),
      ...(g.race.active || g.hillClimb.active || g.coneCourse.active ? [] : mine(g.drag.offers(g.dragContext(ridden)), (o) => g.dragApproach(g.drag.take(o), ridden))),
      ...mine(g.hillClimb.offers(g.climbContext(ridden)), (o) => g.startHillClimb(g.hillClimb.take(o))),
      ...mine(g.coneCourse.offers(g.climbContext(ridden, 'cones')), (o) => g.startConeCourse(g.coneCourse.take(o))),
      ...mine(g.comparing.offers(compare), (o) => g.runComparing(g.comparing.take(o, compare))),
      ...mine(g.pair.offers(g.pairContext()), (o) => g.handlePairEvent(g.pair.take(o))),
    ];
  }

  /** What moves a girl's needs this frame (npc/needs.js): the cold where she is, who's near, how fast she's going, what she's at. */
  needsContext(c) {
    const g = this.g;
    const p = c.params;
    const at = c.root.getWorldPosition(this.needsAt ??= new THREE.Vector3());
    const inBarn = g.world.inBarn(at.x, at.z);
    const inCab = g.cabShelter.of(c.character.id)?.state === 'in';
    const inHut = g.hutHost.inside(at.x, at.z);
    const onBoard = c.root.parent !== g.scene;
    const aboardSpec = onBoard && c.quad ? g.units.find((u) => u.quad === c.quad)?.spec.id ?? null : null; // a cab or a roof keeps the rain off her too
    const covered = underCover({ inBarn, inCab, inHut, aboardSpec });
    c.coveredNow = covered; // in the barn, the hut or a cab, for what she says about the dark (companionVoice.watchWeather)
    const w = g.weather;
    // A dull or wet day feels cold (as warming hands always had it), and a cold one colder.
    const dayChill = Math.min(1, Math.max(0, (0.6 - w.warmth) / 0.6) * 0.8 + w.chill * 0.5);
    const ridingWith = onBoard && (g.riddenUnit?.quad === c.quad || c.others().some((o) => o.quad === c.quad && o.root.parent !== g.scene));
    const youAway = Math.hypot(g.camera.position.x - at.x, g.camera.position.z - at.z);
    let near = youAway;
    let friendAway = Infinity;
    let friendFromYou = Infinity;
    for (const o of c.others()) {
      const op = o.root.getWorldPosition(g.needsOther ??= new THREE.Vector3());
      friendAway = Math.min(friendAway, op.distanceTo(at));
      friendFromYou = Math.min(friendFromYou, Math.hypot(g.camera.position.x - op.x, g.camera.position.z - op.z));
    }
    near = Math.min(near, friendAway);
    // Jealousy (the attention need): you're with her if you're close or she's on your quad; she's with her friend if one is close.
    const youNear = youAway < p.needAttentionRange || (onBoard && g.riddenUnit?.quad === c.quad);
    const speed = onBoard && c.quad ? Math.abs(c.quad.speed) : 0;
    return {
      chill: covered ? 0 : dayChill,
      cold: c.soaked.cold, // soaked through and chilled by it: it keeps her wanting somewhere warm (needs.js)
      wet: !covered && w.rain > 0.25 && !g.coats.worn[c.character.id], // a wax jacket keeps the rain off
      warmed: !!c.warmingAt || inCab || inBarn || g.hutHost.warmsAt(at.x, at.z) || g.bonfire.warms(Math.hypot(at.x - g.world.layout.bonfire.x, at.z - g.world.layout.bonfire.z)),
      alone: near > p.needLonelyRange && !ridingWith,
      together: near < p.needCloseRange || ridingWith,
      thrill: Math.min(1, speed / 12 + (onBoard && c.quad?.airborne ? 0.5 : 0)),
      active: c.fsm.is('walking', 'driving', 'mounting', 'dismounting', 'starting', 'cranking', 'pushing', 'pranking', 'boarding', 'shuffling'),
      sitting: c.fsm.is('resting', 'seated', 'onTrailer'),
      dozing: c.isDozing,
      hour: g.daylight?.hour ?? 12, // hunger builds towards lunchtime (needs.js)
      eating: g.lunch.phase(c.character.id) === 'eat',
      idle: c.availability().free || c.sittingAbout(), // sat about on a quad she chose is as good as stood about
      purposeRate: c.purposeRate ?? 0,
      youNear,
      withFriend: friendAway < p.needCloseRange,
      youWithFriend: friendFromYou < p.needAttentionRange,
    };
  }
}

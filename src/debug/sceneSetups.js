// The parts of the scenes that need the game itself rather than console lines: dressing the girls, putting the mini moto in the paddock
// with Jess, the flock where you can see it. Each takes the game and a `say(line)` that runs a console line (and throws if it fails),
// and returns the lines to show. The game methods are the ones the in-game actions use, so a scene shows what play would.
import { girlActions } from './girlActions.js';
import { findFlockSpot } from '../world/flock.js';
import { completeStyle, outfitsFor } from '../npc/outfits.js';
import { wardrobeLook, styleFor, describeLook } from './wardrobe.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../core/graphics.js';

const HOLD = 'scene';
const ground = (g, x, z) => g.world.heightAt(x, z);

/** Whether a girl is on her feet and free to be put somewhere: not still on a vehicle or getting down from one (the opening's hay trailer). */
const onFeet = (c) => c.fsm.is('idle', 'walking');
const stillDown = (g) => {
  const slow = g.companions.filter((c) => !onFeet(c)).map((c) => c.name);
  return slow.length ? [`${slow.join(' and ')} not on foot yet (still getting down from something): run it again in a few seconds`] : [];
};

/** Stands a girl at a spot facing a point, held there until `scene end`. */
function stand(g, c, x, z, facing) {
  g.settleGirl(c);
  const h = Math.atan2(facing.x - x, facing.z - z);
  c.root.position.set(x, ground(g, x, z), z);
  c.heading = h;
  c.root.rotation.y = h;
  c.hold(HOLD, 'a scene has her standing here (scene end lets her go)');
}

/** Before any scene: off whatever you are on, driving it or riding on the back (the console's tp refuses while you are on one). */
export function getOff(g) {
  if (g.riddenUnit) g.tryDismount();
  else if (g.boardUnit) g.getOffBack();
}

/** Lets the girls go about their day again. */
export function endScene(g) {
  for (const c of g.companions) c.release(HOLD);
  g.graphics.hedgeFullDistance = DEFAULT_GRAPHICS_PARAMS.hedgeFullDistance;
  g.graphics.treeFullDistance = DEFAULT_GRAPHICS_PARAMS.treeFullDistance;
  return ['the girls are free again, and the hedges go back to swapping at their usual distance'];
}

export function wardrobe(g, say) {
  const me = g.world.layout.yard; // not the player's position: that only catches up with `tp` on the next physics step
  say(`tp me ${me.x} ${me.z} 0`); // facing south, the girls stood in front of you
  const look = wardrobeLook(g.sceneCounters?.wardrobe ?? 0);
  g.sceneCounters = { ...g.sceneCounters, wardrobe: look.number }; // look.number is one past the index shown: the next run shows the next look
  // Take everything off the rack first so the two girls never fight over a jumper.
  for (const c of g.companions) {
    const id = c.character.id;
    g.jumpers.hung(id);
    g.coats.hung(id);
  }
  g.companions.forEach((c, i) => {
    const id = c.character.id;
    stand(g, c, me.x + (i === 0 ? -1.3 : 1.3), me.z + 4, me);
    c.setStyle({ ...completeStyle(c.outfit.style), ...styleFor(look, id, (k) => outfitsFor(c.character.outfitOdds).includes(k)) });
    const jumper = g.jumpers.list[i];
    const coat = g.coats.list[i];
    if (look.layer.jumper && jumper) {
      g.jumpers.dressed(id, jumper.id);
      c.setJumper(g.jumpers.colourOf(jumper.id));
    } else c.setJumper(null);
    if (look.layer.coat && coat) {
      g.coats.dressed(id, coat.id);
      c.setCoat(g.coats.colourOf(coat.id));
      g.coats.hoodHeld[id] = { up: look.layer.hood, until: g.coats.clock + 3600 };
      c.setHood(look.layer.hood);
    } else {
      c.setCoat(null);
      delete g.coats.hoodHeld[id];
    }
  });
  g.showRack();
  return [describeLook(look), ...stillDown(g), 'run it again for the next look, scene end lets the girls go'];
}

export function moto(g, say) {
  const u = g.units.find((x) => x.spec.miniMoto);
  if (!u) return ['this farm has no mini moto (one is bought from the barn\'s ads and turns up the next morning), so there is nothing to put in the paddock'];
  const p = g.world.layout.paddock;
  if (!p) return ['this farm has no paddock (the new farm\'s is Home Ground, so ride the mini moto there with tp me home)'];
  const jess = g.companions.find((c) => c.character.id === 'jess');
  if (u.quad.rider || u.quad.driver) return ['the mini moto has someone on it already: scene end, then reset it'];
  u.quad.placeAt(p.x, p.z, Math.PI / 2); // along the paddock, nose to the yard
  say(`tp me ${p.x + p.half + 6} ${p.z} 270`);
  g.settleGirl(jess);
  jess.root.position.set(p.x + 3, ground(g, p.x + 3, p.z + 2), p.z + 2);
  girlActions(g).find('jess', 'tz65').run('jess');
  return ['the mini moto is in the paddock and Jess is going for it', 'she may refuse it or come off, as she would in play'];
}

export function flock(g, say) {
  const [cx, cz] = g.world.layout.hill.climb.points[0];
  if (!g.flock) return ['there is no flock on this farm'];
  // By the climb's first cones if the flock's half of the hill is there, else on the nearest ground it has (the fence leaves it one half, and the day may rest the other).
  const allowed = g.hillFlockAllowed;
  let at = { x: cx, z: cz + 14 };
  if (allowed && !allowed(at.x, at.z)) {
    const p = g.world.layout.hill.pasture;
    at = findFlockSpot(allowed, { minX: p.minX + 8, maxX: p.maxX - 8, minZ: p.minZ + 20, maxZ: p.maxZ - 8 }, () => 0.5) ?? at;
  }
  g.flock.place(at);
  say(`tp me ${at.x} ${at.z - 8} 0`);
  return ['the flock is grazing on its half of the hill, just past the stream where the ground allows; walk on and they will look up'];
}

export function flask(g, say) {
  const v = g.flaskSpot;
  if (!v) return ['there is no rock for the flask on this farm'];
  const amy = g.companions.find((c) => c.character.id === 'amy');
  say('weather fair');
  say('weather.time 15');
  g.settleGirl(amy);
  amy.root.position.set(v.x + 3, ground(g, v.x + 3, v.z), v.z);
  say(`tp me ${v.x - 3} ${v.z - 3} 0`);
  girlActions(g).find('amy', 'flask').run('amy');
  return ['Amy is a few steps from the rock with the flask, and you are beside it'];
}

/** Two things in today's log and the wait before the girls bring them up cut to a few seconds, with you stood by them. */
export function earlier(g) {
  g.dayEvents.add('race', { winner: 'jess', loser: 'amy' });
  g.dayEvents.add('stranded', { girl: 'amy', how: 'tip', quad: 'Finch' });
  g.earlierParams.earlierAfter = 30;
  return ['Jess has beaten Amy in a race and Amy has tipped a quad, as far as the day goes; stand near them and wait half a minute or so'];
}

/**
 * The hedges' far strips (world/hedgeFar.js) and the far oaks and bushes (world/scatter.js, #837) brought in to 25 m, so most of what you see from the
 * yard is the far version and you can compare.
 */
export function farHedges(g) {
  g.graphics.hedgeFullDistance = 25;
  g.graphics.treeFullDistance = 25;
  return ['every hedge more than 25 m from you is its plain far strip (usually 150 m), and every oak and bush the lighter far one (usually 70 m); walk along a hedge to see the swap, scene end puts it back'];
}

/** The tractor at the woodpile with the splitter on it, running and held, a round on the beam and you beside it (#338). Not lines alone,
 * as a farm with no tractor or log yard has nothing for them to set. */
export function splitter(g, say) {
  const yard = g.world.layout.logYard;
  const q = g.tractorUnit?.quad;
  if (!yard || !q || !g.logStack || !g.units.includes(g.tractorUnit)) return ['this farm has no tractor and woodpile, so there is nowhere to split'];
  if (q.rider || q.driver) return ['the tractor has someone on it: get them off, then run the scene again'];
  if (g.tractorWork.splitterTrailerOn()) return ['a trailer is on the tractor\'s drawbar, which hides the splitter: unhitch it, then run the scene again'];
  q.placeAt(yard.park.x, yard.park.z, yard.park.yaw);
  // placeAt moves the body; the model only follows on the next frame, and where you stand is read from the model, so bring it now.
  q.model.position.copy(q.currPos);
  q.model.quaternion.copy(q.currQuat);
  q.model.updateMatrixWorld(true);
  say('farm.splitter true');
  say(`start ${g.tractorUnit.id}`);
  q.parkBrake = true;
  const loaded = g.tractorWork.debugLoadRound();
  const me = g.tractorWork.beamSide();
  say(`tp me ${me.x.toFixed(1)} ${me.z.toFixed(1)} ${Math.round(me.heading)}`);
  return [
    loaded ? 'the tractor is running with its brake on and a round on the splitter: hold E at the beam to push the ram through it' : 'no round left in the piles to put on the beam (the Farm tab\'s "Empty the log stack (rounds dealt back)" deals them again)',
    'listen for the pump\'s whine as the ram moves, the strain as it meets the round, and the hiss as it comes back',
  ];
}

export const SETUPS = { farHedges, prepare: getOff, wardrobe, moto, flock, flask, earlier, splitter, end: endScene };

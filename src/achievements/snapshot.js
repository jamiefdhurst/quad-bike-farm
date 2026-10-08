// What the bucket list needs to know about the game this frame, read off the running game (achievements.js says what each field means).
// Kept apart from achievements.js so that stays pure; the places are plain boxes in the farm's layout.

const NOT_QUADS = ['tractor', 'utv', 'landrover', 'rusty'];

const inBox = (p, minX, maxX, minZ, maxZ) => p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;

/** Which of the listed places a point is in (PLACES in achievements.js). */
export function placesAt(p, layout) {
  const out = [];
  const h = layout.hill;
  const ford = h.stream.ford;
  if (Math.abs(p.x - h.lane.x) < ford.halfWidth + 1 && Math.abs(p.z - h.stream.z) < h.stream.halfWidth + 1.5) out.push('ford');
  if (inBox(p, h.pasture.minX, h.pasture.maxX, h.pasture.minZ, h.pasture.maxZ)) out.push('pasture');
  if (inBox(p, h.wood.minX, h.wood.maxX, h.wood.minZ, h.wood.maxZ)) out.push('wood');
  const db = layout.dutchBarn;
  if (inBox(p, db.x - db.halfX - 2, db.x + db.halfX + 2, db.z - db.halfZ - 2, db.z + db.halfZ + 2)) out.push('dutchBarn');
  const fs = layout.fieldShed;
  if (inBox(p, fs.x - fs.halfX - 2, fs.x + fs.halfX + 2, fs.z - fs.halfZ - 2, fs.z + fs.halfZ + 2)) out.push('fieldShed');
  const r = layout.road;
  if (inBox(p, r.fromX, r.fromX + r.grid.length + 0.5, r.z - r.halfWidth, r.z + r.halfWidth)) out.push('cattleGrid');
  if (p.x >= r.pad.x - r.pad.radius && Math.abs(p.z - r.z) <= r.pad.radius) out.push('farEnd');
  return out;
}

export function achievementSnapshot(game, ridden) {
  const layout = game.world.layout;
  const board = game.boardUnit;
  const pos = board ? board.quad.position : game.player.position;
  let riding = null;
  if (board) {
    const q = board.quad;
    const ramp = layout.jumpRamp;
    const lipX = ramp.x + Math.sin(ramp.yaw) * ramp.length;
    const lipZ = ramp.z + Math.cos(ramp.yaw) * ramp.length;
    const seat = game.player.seat === 'rider' ? 'rider' : 'pillion';
    riding = {
      id: board.id,
      seat,
      speed: Math.abs(q.speed),
      airborne: q.airborne,
      tipped: q.isTipped,
      yaw: q.yaw,
      nearRamp: Math.hypot(q.position.x - lipX, q.position.z - lipZ),
      running: board.engine.isRunning,
      girlsOnBoard: game.companions.filter((c) => c.quad === q && c.fsm.is('mounting', 'seated', 'shuffling')).length,
      driver: seat === 'pillion' ? (game.companions.find((c) => c.quad === q && c.fsm.is('driving'))?.character.id ?? null) : null,
    };
  }
  const idOf = (quad) => game.units.find((u) => u.quad === quad)?.id;
  const pulling = [];
  if (game.winch?.state === 'hooked' && game.winch.target) pulling.push({ id: idOf(game.winch.target), by: 'winch' });
  if (game.chain.state === 'hooked' && game.chain.target) pulling.push({ id: idOf(game.chain.target), by: 'chain' });
  const quads = game.units.filter((u) => !NOT_QUADS.includes(u.id));
  return {
    riding,
    quadIds: quads.map((u) => u.id),
    running: game.units.filter((u) => u.engine.isRunning).map((u) => u.id),
    stuck: game.units.filter((u) => u.quad.bog.stuck).map((u) => u.id),
    pulling,
    tippedIds: game.units.filter((u) => u.quad.isTipped).map((u) => u.id),
    favoured: game.companions.filter((c) => game.favour.mood(c.character.id) === 'favoured').map((c) => c.character.id),
    places: placesAt(pos, layout),
    weather: game.weather.name,
    rain: game.weather.rain,
    washing: !!game.washing,
  };
}

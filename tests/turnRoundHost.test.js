import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { roadNetwork } from '../src/world/roads.js';
import { turnRoundLines } from '../src/world/turnRound.js';
import { TurnRoundHost } from '../src/world/turnRoundHost.js';
import { TURN_ROUND_TOAST, AMY_TURN_ROUND_LINES, JESS_TURN_ROUND_LINES } from '../src/npc/turnRoundLines.js';

const two = LAYOUT;
const net = roadNetwork(two);
const lines = Object.fromEntries(turnRoundLines(net, two.turnRound, two.ground).map((l) => [l.id, l]));

/** A stand-in game: the player (on foot, or on a vehicle that records where it is placed), the HUD's fade and toast, and the girls with a voice that records what she says. */
function standIn({ on = null, girls = [] } = {}) {
  const fades = [];
  const toasts = [];
  const g = {
    world: { layout: two, roads: net, groundHeightAt: () => 0 },
    hud: { setFade: (v) => fades.push(v), toast: (t) => toasts.push(t) },
    player: { isRiding: false, vehicle: null, position: { x: 0, z: 0 }, yaw: 0, moveTo(p) { this.position = { x: p.x, z: p.z }; } },
    companions: girls.map(({ id, at }) => ({ character: { id }, root: { position: { x: at.x, z: at.z } }, quad: null, said: [], voice: { say(key) { this.said.push(key); } } })),
  };
  for (const c of g.companions) c.voice.said = c.said;
  if (on) {
    const v = { position: { x: 0, z: 0 }, yaw: 0, placed: [], placeAt(x, z, yaw) { this.position = { x, z }; this.yaw = yaw; this.placed.push({ x, z, yaw }); } };
    g.player.isRiding = true;
    g.player.vehicle = v;
  }
  return { g, fades, toasts, host: new TurnRoundHost(g) };
}

/** Moves you from `a` to `b` in 20 steps and then stands still for `seconds`, as the game's frames would. */
function cross(h, set, a, b, seconds = 3) {
  for (let i = 0; i <= 20; i++) {
    set({ x: a.x + ((b.x - a.x) * i) / 20, z: a.z + ((b.z - a.z) * i) / 20 });
    h.update(0.016);
  }
  for (let t = 0; t < seconds; t += 0.05) h.update(0.05);
}

describe('being turned round in the running game (#687)', () => {

  it('on foot and alone: fades, puts you 25 m back up the lane facing home, and gives the one toast', () => {
    const { g, fades, toasts, host } = standIn();
    const l = lines['lane-north'];
    const set = (p) => (g.player.position = p);
    cross(host, set, { x: l.point.x - 2, z: l.point.z }, { x: l.point.x + 1, z: l.point.z });
    expect(toasts).toEqual([TURN_ROUND_TOAST]);
    expect(TURN_ROUND_TOAST).toBe('Nothing needs doing in town today.');
    expect(Math.max(...fades)).toBe(1);
    expect(fades.at(-1)).toBe(0);
    expect(net.onRoad('lane', g.player.position.x, g.player.position.z)).toBe(true);
    expect(Math.hypot(g.player.position.x - l.point.x, g.player.position.z - l.point.z)).toBeGreaterThan(20);
    // Facing home: the player's yaw is a heading less a half turn, so looking along the lane away from the A-road.
    const look = { x: -Math.sin(g.player.yaw), z: -Math.cos(g.player.yaw) };
    expect(look.x).toBeLessThan(-0.7); // west, then south down the lane: away from the junction
  });

  it('on a vehicle with a girl aboard: the vehicle and the girl go back together, stopped and facing home, and she says why', () => {
    const { g, fades, toasts, host } = standIn({ on: true, girls: [{ id: 'amy', at: { x: 0, z: 0 } }, { id: 'jess', at: { x: 500, z: 500 } }] });
    const l = lines['lane-north'];
    const v = g.player.vehicle;
    g.companions[0].quad = v; // she is on it
    const set = (p) => { v.position = p; g.companions[0].root.position = { ...p }; };
    cross(host, set, { x: l.point.x - 2, z: l.point.z }, { x: l.point.x + 1, z: l.point.z });
    expect(v.placed).toHaveLength(1);
    expect(net.onRoad('lane', v.placed[0].x, v.placed[0].z)).toBe(true);
    const h = { x: Math.sin(v.placed[0].yaw), z: Math.cos(v.placed[0].yaw) };
    expect(h.x).toBeLessThan(-0.7); // facing away from the A-road
    expect(g.companions[0].said).toEqual(['turnRound']);
    expect(g.companions[1].said).toEqual([]); // the one who is with you, not the other
    expect(toasts).toEqual([]); // her line, not a toast too
    expect(fades.at(-1)).toBe(0);
    expect(Array.isArray(AMY_TURN_ROUND_LINES.turnRound.lines) && AMY_TURN_ROUND_LINES.turnRound.lines.length).toBeGreaterThanOrEqual(4);
    expect(JESS_TURN_ROUND_LINES.turnRound.length).toBeGreaterThanOrEqual(4);
  });

  it('turns you round at the village street\'s junction and at the lane\'s southern line, and the south has its own line', () => {
    for (const [id, key] of [['village', 'turnRound'], ['lane-south', 'turnRoundSouth']]) {
      const { g, host } = standIn({ on: true, girls: [{ id: 'jess', at: { x: 0, z: 0 } }] });
      const l = lines[id];
      const v = g.player.vehicle;
      const along = id === 'village' ? { x: 1, z: 0 } : { x: 0, z: 1 };
      const set = (p) => { v.position = p; g.companions[0].root.position = { ...p }; };
      cross(host, set, { x: l.point.x - along.x * 2, z: l.point.z - along.z * 2 }, { x: l.point.x + along.x, z: l.point.z + along.z });
      expect(v.placed, id).toHaveLength(1);
      expect(g.companions[0].said, id).toEqual([key]);
      expect(Math.hypot(v.placed[0].x - l.point.x, v.placed[0].z - l.point.z)).toBeGreaterThan(20);
    }
  });

  it('leaves the fade alone while you are not being turned round (the romance has it then)', () => {
    const { g, fades, host } = standIn();
    g.player.position = { x: two.road.fromX + 20, z: two.road.z };
    for (let i = 0; i < 30; i++) host.update(0.016);
    expect(fades).toEqual([]);
  });
});

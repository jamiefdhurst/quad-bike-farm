import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { cone, CONE_KINDS, buildStartLine, buildClimbCones, buildConeCourse } from '../src/world/startLine.js';
import { startPrompt, yourAsks } from '../src/npc/yourAsks.js';
import { climbGates } from '../src/npc/hillClimb.js';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';

const bodyColour = (c) => c.children[0].material.color.getHex();
const flat = () => 0;

describe('start and finish cones', () => {
  it('are green to start, blue to finish and orange for anything else', () => {
    expect(bodyColour(cone('start'))).toBe(CONE_KINDS.start.colour);
    expect(bodyColour(cone('finish'))).toBe(CONE_KINDS.finish.colour);
    expect(bodyColour(cone())).toBe(CONE_KINDS.orange.colour);
    expect(new Set([CONE_KINDS.start.colour, CONE_KINDS.finish.colour, CONE_KINDS.orange.colour]).size).toBe(3);
  });

  it('say START and FINISH in words, and a plain cone says nothing', () => {
    expect(CONE_KINDS.start.word).toBe('START');
    expect(CONE_KINDS.finish.word).toBe('FINISH');
    expect(CONE_KINDS.orange.word).toBeNull();
  });

  it('make the lap line green', () => {
    const scene = new THREE.Scene();
    const track = new Track(LAYOUT.trackPoints);
    const g = buildStartLine(scene, flat, track, 0.1, LAYOUT.trackHalfWidth);
    expect(g.children.length).toBe(4);
    for (const c of g.children) expect(c.userData.kind).toBe('start');
  });

  it('make a climb green at the start, blue at the finish, plain between, the ends larger', () => {
    const scene = new THREE.Scene();
    const gates = climbGates(LAYOUT.hill.climb);
    const g = buildClimbCones(scene, flat, gates);
    const kinds = g.children.map((c) => c.userData.kind);
    expect(kinds.filter((k) => k === 'start')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'finish')).toHaveLength(4);
    expect(kinds.filter((k) => k === 'orange')).toHaveLength((gates.length - 2) * 2);
    const scale = (k) => g.children.find((c) => c.userData.kind === k).scale.x;
    expect(scale('start')).toBeGreaterThan(scale('orange'));
    expect(scale('finish')).toBe(scale('start'));
  });

  it('leave Amy\'s cone course orange', () => {
    const { cones } = buildConeCourse(new THREE.Scene(), flat, [{ x: 0, z: 0 }, { x: 1, z: 1 }]);
    for (const p of cones) expect(p.children[0].userData.kind).toBe('orange');
  });
});

describe('the prompt at a climb\'s start', () => {
  it('tells you Enter times the climb you are at', () => {
    expect(startPrompt({ pit: true })).toEqual({ action: 'Time the pit climb', key: 'Enter' });
    expect(startPrompt({ climb: true })).toEqual({ action: 'Time the hill climb', key: 'Enter' });
  });

  it('says nothing anywhere else, and the wheel has the climb it names', () => {
    expect(startPrompt({ cones: true, drag: true })).toBeFalsy();
    expect(yourAsks({ riding: true, near: { pit: true } }).map((a) => a.id)).toContain('pit');
  });
});

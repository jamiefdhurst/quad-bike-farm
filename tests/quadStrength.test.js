import { describe, it, expect } from 'vitest';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { STRENGTH_KINDS, STRENGTH_PARAMS, strengthOf, bonusFor, strengthEffects, groundKind } from '../src/vehicle/strength.js';
import { QuadOpinion, OPINION_PARAMS, hunchOf, disagreements, agreements } from '../src/npc/quadOpinion.js';
import { STRENGTH_BANTER } from '../src/npc/strengthLines.js';
import { BANTER_TIMING } from '../src/npc/banter.js';

const spec = (id) => QUAD_SPECS.find((s) => s.id === id);
const truthOf = (id, kind) => bonusFor(spec(id), kind);
const ids = QUAD_SPECS.map((s) => s.id);
const flat = { climb: 0, mud: 0, tarmac: 0 };

describe('a quad\'s hidden strength', () => {
  it('names a real strength on each of the five, and none on the others', () => {
    for (const s of QUAD_SPECS) expect(STRENGTH_KINDS).toContain(strengthOf(s));
    for (const s of EXTRA_SPECS) expect(strengthOf(s)).toBe(null);
  });
  it('covers every strength at least once', () => {
    for (const k of STRENGTH_KINDS) expect(QUAD_SPECS.some((s) => strengthOf(s) === k)).toBe(true);
  });
  it('gives nothing on ground that does not suit it', () => {
    for (const s of QUAD_SPECS) expect(strengthEffects(s, flat)).toEqual({ drive: 1, mudGrip: 1, tarmacGrip: 1 });
  });
  it('helps a hill quad on a slope, in proportion up to the full grade', () => {
    const red = spec('red');
    const full = strengthEffects(red, { ...flat, climb: STRENGTH_PARAMS.hillGrade });
    const half = strengthEffects(red, { ...flat, climb: STRENGTH_PARAMS.hillGrade / 2 });
    expect(full.drive).toBeCloseTo(1 + STRENGTH_PARAMS.amount);
    expect(half.drive).toBeCloseTo(1 + STRENGTH_PARAMS.amount / 2);
    expect(strengthEffects(red, { ...flat, climb: -0.3 }).drive).toBe(1); // downhill is no help
    expect(strengthEffects(spec('blue'), { ...flat, climb: 0.3 }).drive).toBe(1); // another quad's strength
  });
  it('helps a mud quad in mud and a tarmac quad on tarmac', () => {
    expect(strengthEffects(spec('green'), { ...flat, mud: 1 }).mudGrip).toBeCloseTo(1 + STRENGTH_PARAMS.amount);
    expect(strengthEffects(spec('green'), { ...flat, tarmac: 1 }).tarmacGrip).toBe(1);
    const t = strengthEffects(spec('orange'), { ...flat, tarmac: 1 });
    expect(t.tarmacGrip).toBeCloseTo(1 + STRENGTH_PARAMS.amount);
    expect(t.drive).toBeGreaterThan(1);
  });
  it('is small enough not to be felt in one ride', () => {
    expect(STRENGTH_PARAMS.amount).toBeLessThanOrEqual(0.12);
  });
  it('judges the ground a girl is riding on', () => {
    expect(groundKind({ climb: 0.2, mud: 0, tarmac: 0, speed: 5 })).toBe('hill');
    expect(groundKind({ climb: 0, mud: 0.8, tarmac: 0, speed: 5 })).toBe('mud');
    expect(groundKind({ climb: 0, mud: 0, tarmac: 1, speed: 5 })).toBe('tarmac');
    expect(groundKind({ climb: 0.2, mud: 0, tarmac: 0, speed: 0.5 })).toBe(null);
    expect(groundKind({ climb: 0, mud: 0, tarmac: 0, speed: 5 })).toBe(null);
  });
});

describe('what the girls make of them', () => {
  const ride = (op, seconds) => {
    for (const id of ids) for (const k of STRENGTH_KINDS) op.ride(seconds, id, k);
  };
  it('has no view before she has ridden a quad there', () => {
    const op = new QuadOpinion('jess');
    expect(op.best('hill', ids, truthOf)).toBe(null);
    op.ride(OPINION_PARAMS.minSeconds - 1, 'red', 'hill');
    expect(op.view('red', 'hill', truthOf('red', 'hill'))).toBe(null);
  });
  it('needs two quads to compare', () => {
    const op = new QuadOpinion('jess');
    op.ride(100, 'red', 'hill');
    expect(op.best('hill', ids, truthOf)).toBe(null);
  });
  it('has her own hunch, steady between loads and different from her friend\'s', () => {
    expect(hunchOf('jess:red:hill')).toBe(hunchOf('jess:red:hill'));
    expect(hunchOf('jess:red:hill')).not.toBe(hunchOf('amy:red:hill'));
  });
  it('ends up right once she has ridden enough', () => {
    for (const girl of ['jess', 'amy']) {
      const op = new QuadOpinion(girl);
      ride(op, OPINION_PARAMS.tau * 12);
      expect(op.best('hill', ids, truthOf)).toBe('red');
      expect(['blue', 'green']).toContain(op.best('mud', ids, truthOf));
      expect(['yellow', 'orange']).toContain(op.best('tarmac', ids, truthOf));
    }
  });
  it('and agrees with her friend when they both have', () => {
    const a = new QuadOpinion('jess');
    const b = new QuadOpinion('amy');
    ride(a, OPINION_PARAMS.tau * 12);
    ride(b, OPINION_PARAMS.tau * 12);
    expect(disagreements(a, b, ids, truthOf).filter((d) => d.kind === 'hill')).toEqual([]);
    expect(agreements(a, b, ids, truthOf).some((x) => x.kind === 'hill' && x.id === 'red')).toBe(true);
  });
  it('can start by disagreeing, from hunches alone', () => {
    let differs = false;
    const a = new QuadOpinion('jess');
    const b = new QuadOpinion('amy');
    for (const id of ids) for (const k of STRENGTH_KINDS) { a.ride(OPINION_PARAMS.minSeconds, id, k); b.ride(OPINION_PARAMS.minSeconds, id, k); }
    differs = disagreements(a, b, ids, truthOf).length > 0;
    expect(differs).toBe(true);
  });
  it('leans her choice of quad towards the ones she rates, and not at all with no view', () => {
    const op = new QuadOpinion('amy');
    expect(op.keenness('red', truthOf, STRENGTH_PARAMS.amount)).toBe(0);
    op.ride(OPINION_PARAMS.tau * 12, 'red', 'hill');
    expect(op.keenness('red', truthOf, STRENGTH_PARAMS.amount)).toBeGreaterThan(0.8);
  });
  it('keeps half of it in the save, and loads a save without any', () => {
    const op = new QuadOpinion('amy');
    op.ride(400, 'red', 'hill');
    const again = new QuadOpinion('amy');
    again.restore(op.capture());
    expect(again.seconds('red', 'hill')).toBeCloseTo(400 * OPINION_PARAMS.kept);
    again.restore(undefined);
    expect(again.seconds('red', 'hill')).toBe(0);
    again.restore({ red: { hill: 'lots', nonsense: 5 }, ghost: null });
    expect(again.seconds('red', 'hill')).toBe(0);
  });
  it('never keeps more than the cap', () => {
    const op = new QuadOpinion('amy');
    op.ride(1e9, 'red', 'hill');
    expect(op.seconds('red', 'hill')).toBe(OPINION_PARAMS.cap);
  });
});

describe('the lines they argue in', () => {
  it('have a timing, a kind and a girl who starts, for every case', () => {
    for (const e of STRENGTH_BANTER) {
      expect(BANTER_TIMING[e.when]).toBeTruthy();
      expect(STRENGTH_KINDS).toContain(e.roles.kind);
      expect(e.lines.length).toBeGreaterThan(1);
    }
    for (const k of STRENGTH_KINDS) {
      for (const starter of ['jess', 'amy']) expect(STRENGTH_BANTER.filter((e) => e.when === 'strengths' && e.roles.kind === k && e.roles.starter === starter).length).toBeGreaterThan(0);
      expect(STRENGTH_BANTER.some((e) => e.when === 'strengthsAgree' && e.roles.kind === k)).toBe(true);
    }
  });
  it('never name a quad, use an em dash or call the player anything but you', () => {
    for (const e of STRENGTH_BANTER) for (const [, text] of e.lines) {
      expect(text).not.toMatch(/—|–/);
      expect(text).not.toMatch(/\b(red|blue|yellow|green|orange)\b/i);
    }
  });
});

describe('in the farm save', () => {
  it('round-trips through captureGirls and restoreGirls at half strength', async () => {
    const { captureGirls, restoreGirls } = await import('../src/farm/farmState.js');
    const mk = (id) => ({ character: { id }, memory: { capture: () => ({}), restore() {} }, opinion: new QuadOpinion(id), params: {} });
    const girls = [mk('jess'), mk('amy')];
    girls[0].opinion.ride(300, 'red', 'hill');
    const parts = { favour: { scores: {}, ids: [] }, fallingOut: { friction: 0, active: false }, skills: { levels: {}, ids: [] }, romance: { girls: {}, ids: [] } };
    const saved = captureGirls({ ...parts, companions: girls });
    expect(saved.opinions.jess.red.hill).toBe(300);
    const fresh = [mk('jess'), mk('amy')];
    restoreGirls({ ...parts, companions: fresh }, JSON.parse(JSON.stringify(saved)));
    expect(fresh[0].opinion.seconds('red', 'hill')).toBeCloseTo(300 * OPINION_PARAMS.kept);
    expect(fresh[1].opinion.seconds('red', 'hill')).toBe(0);
    restoreGirls({ ...parts, companions: fresh }, { favour: {} }); // an older save has none
  });
});

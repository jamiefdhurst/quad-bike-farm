import { describe, it, expect } from 'vitest';
import { FAQ_SECTIONS, VEHICLE_NOTES, GIRL_NOTES, faqTips } from '../src/faq/faqContent.js';
import { ALL_VEHICLE_SPECS, vehicleFacts } from '../src/faq/facts.js';
import { parseGitLog, longDate } from '../src/faq/changes.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { CONTROLS, controlsHtml } from '../src/hud/controls.js';
import { logoSvg } from '../src/start/logo.js';

const allProse = () => [
  ...FAQ_SECTIONS.flatMap((s) => [s.title, s.intro ?? '', ...s.entries.flatMap((e) => [e.q, e.a, e.tip ?? ''])]),
  ...Object.values(VEHICLE_NOTES).flatMap((n) => [n.blurb, ...(n.tips ?? [])]),
  ...Object.values(GIRL_NOTES).flatMap((n) => [n.blurb, ...(n.traits ?? [])]),
];

describe('FAQ content keeps up with the game', () => {
  it('has a note for every vehicle that can be on the farm, and none for one that is gone', () => {
    const ids = ALL_VEHICLE_SPECS.map((s) => s.id);
    for (const id of ids) expect(VEHICLE_NOTES[id]?.blurb, `VEHICLE_NOTES.${id} in src/faq/faqContent.js`).toBeTruthy();
    for (const id of Object.keys(VEHICLE_NOTES)) expect(ids, `VEHICLE_NOTES.${id} has no spec`).toContain(id);
  });

  it('has a note for every girl, and none for one that is gone', () => {
    const ids = CHARACTERS.map((c) => c.id);
    for (const id of ids) expect(GIRL_NOTES[id]?.blurb, `GIRL_NOTES.${id} in src/faq/faqContent.js`).toBeTruthy();
    for (const id of Object.keys(GIRL_NOTES)) expect(ids, `GIRL_NOTES.${id} has no character`).toContain(id);
  });

  it('gives every vehicle its engine, gearbox and tank from the spec', () => {
    for (const spec of ALL_VEHICLE_SPECS) {
      const labels = vehicleFacts(spec).map(([k]) => k);
      expect(labels, spec.id).toEqual(expect.arrayContaining(['Engine', 'Gearbox', 'Tank']));
    }
    const facts = (id) => Object.fromEntries(vehicleFacts(ALL_VEHICLE_SPECS.find((s) => s.id === id)));
    expect(facts('yellow').Engine).toMatch(/Two-stroke/);
    expect(facts('tractor').Engine).toMatch(/Diesel/);
    expect(facts('tractor').Gearbox).toMatch(/three gears/);
    expect(facts('blue').Gearbox).toBe('Automatic');
  });
});

describe('FAQ sections', () => {
  it('have unique ids, a title and questions with answers', () => {
    const ids = FAQ_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of FAQ_SECTIONS) {
      expect(s.title).toBeTruthy();
      expect(s.entries.length, s.id).toBeGreaterThan(0);
      for (const e of s.entries) {
        expect(e.q, s.id).toBeTruthy();
        expect(e.a.trim().length, e.q).toBeGreaterThan(20);
      }
    }
  });

  it('have no two questions the same (each gets a link of its own)', () => {
    const qs = FAQ_SECTIONS.flatMap((s) => s.entries.map((e) => e.q.toLowerCase()));
    expect(new Set(qs).size).toBe(qs.length);
  });

  it('are written without em dashes', () => {
    for (const text of allProse()) expect(text, text.slice(0, 60)).not.toMatch(/—/);
  });

  it('call the player "you", never he or she', () => {
    for (const text of allProse()) expect(text, text.slice(0, 60)).not.toMatch(/\bthe player\b/i);
  });

  it('have plenty of short tips for the start screen, none of them spoilers', () => {
    const tips = faqTips();
    expect(tips.length).toBeGreaterThanOrEqual(15);
    for (const t of tips) expect(t.length, t).toBeLessThanOrEqual(140);
    const spoilers = FAQ_SECTIONS.flatMap((s) => s.entries).filter((e) => e.spoiler && e.tip);
    expect(spoilers).toEqual([]);
  });
});

describe('the controls list', () => {
  it('has sections with lines, rendered for the help panel', () => {
    expect(CONTROLS.length).toBeGreaterThan(5);
    const html = controlsHtml();
    for (const c of CONTROLS) {
      expect(c.lines.length, c.title).toBeGreaterThan(0);
      expect(html).toContain(`<h3>${c.title}</h3>`);
    }
  });
});

describe('recently changed', () => {
  const log = [
    '2026-10-09\tGive the UTV a Gator-style body',
    '2026-10-09\tAdd fourteen more TODO items: chains',
    '2026-10-08\tLet the girls share a quad',
    '2026-10-08\tDescribe the bell and mark it done',
    '2026-10-08\tWrite down the test of new models in DECISIONS.md',
    '2026-10-07\tPut a bell on a post by the barn doors',
    'not a log line',
  ].join('\n');

  it('groups by day, newest first, and leaves out housekeeping', () => {
    expect(parseGitLog(log)).toEqual([
      { date: '2026-10-09', items: ['Give the UTV a Gator-style body'] },
      { date: '2026-10-08', items: ['Let the girls share a quad'] },
      { date: '2026-10-07', items: ['Put a bell on a post by the barn doors'] },
    ]);
  });

  it('stops at the limit, and copes with no log', () => {
    expect(parseGitLog(log, { limit: 2 }).flatMap((d) => d.items)).toHaveLength(2);
    expect(parseGitLog('')).toEqual([]);
    expect(parseGitLog(undefined)).toEqual([]);
  });

  it('writes dates the British way', () => {
    expect(longDate('2026-10-08')).toBe('8 October 2026');
  });
});

describe('the logo', () => {
  it('is an SVG with the name and the byline', () => {
    const svg = logoSvg();
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('QUAD BIKE');
    expect(svg).toContain('FARM');
    expect(svg).toContain('by Jamie Hurst');
  });

  it('keeps its filter ids apart when two are on one page', () => {
    const a = logoSvg({ prefix: 'a' });
    const b = logoSvg({ prefix: 'b' });
    const ids = (s) => [...s.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    for (const id of ids(a)) expect(ids(b)).not.toContain(id);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AREAS, readPlaces, resolvePlace, currentWalk, whereItFits, placeLine, placeFor, section, hasSection, withSection, walkTitle, untickedOnly, triedItem, foldedSection,
} from '../tools/walkIssue.mjs';

const places = readPlaces(readFileSync(resolve('docs/farm-plan.md'), 'utf8'));
const issue = (where, labels = []) => ({ body: `What it does.\n\n## Where it fits\n\n${where}\n\n## Done when\n\n- It works`, labels: labels.map((name) => ({ name })) });

describe('the places on the farm plan', () => {
  it('reads every row of the table, with a plain row part of the bold place above it', () => {
    const walk = (name) => places.find((p) => p.name === name)?.walk;
    expect(walk('The farmstead')).toBe('the farmstead');
    expect(walk('The barn')).toBe('the farmstead');
    expect(walk('Room to turn')).toBe('the farmstead');
    expect(walk('Hollow Wood')).toBe('Hollow Wood');
    expect(walk('Six arable fields')).toBe('the arable fields');
    expect(walk("The neighbour's")).toBe("the neighbour's");
    expect(places.length).toBeGreaterThan(30);
  });

  it('knows a field of the arable by its own name', () => {
    expect(placeFor(issue('- **Place:** Lane Field, by the gate.'), places).place).toBe('the arable fields');
  });
});

describe('the place an item goes to', () => {
  it('takes the **Place:** line', () => {
    const r = placeFor(issue("- **Place:** Hill Pasture's south and east edges (`docs/farm-plan.md`), down to Back Lane.\n- **Ties into:** the lane."), places);
    expect(r).toEqual({ place: 'Hill Pasture', why: '"Hill Pasture" in its Where it fits' });
  });

  it('takes the first place named, so the lane before the village it leads to', () => {
    expect(placeFor(issue("- **Place:** the lane's approach to Nether Thornby (`docs/farm-plan.md`)."), places).place).toBe('the lane');
  });

  it('takes the first sentence of a section with no **Place:** line', () => {
    expect(placeFor(issue("The neighbour's (`docs/farm-plan.md`): the yard about plan (950 to 1045, 250 to 335). Ties into the girls."), places).place)
      .toBe("the neighbour's");
  });

  it("doesn't take a place named only in what it ties into, or a word that is a place's name in other words", () => {
    const footsteps = issue('Milestone 6 (`docs/farm-plan.md`, "footsteps"). Surfaces: the barn floor is concrete, gravel is the stone tracks.', ['✨ feature', '🔊 sound']);
    expect(placeFor(footsteps, places).place).toBe('sound');
  });

  it('a building of the farmstead goes to the farmstead walk', () => {
    expect(placeFor(issue('- **Place:** the barn, its back wall (`docs/farm-plan.md`).'), places).place).toBe('the farmstead');
  });

  it("an item that isn't placed goes to its first area label, in the settings file's order", () => {
    expect(placeFor(issue('Not placed. The girls\' bodies.', ['🌾 world', '👭 girls']), places)).toEqual({
      place: 'the girls', why: 'not placed on the plan, so its first area label, 👭 girls' });
    expect(placeFor(issue('- **Place:** the whole farm (`docs/farm-plan.md`).', ['⚡ enhancement', '🌾 world']), places).place).toBe('the world');
    expect(placeFor({ body: 'No section at all.', labels: [{ name: '🏍️ vehicles' }] }, places).why).toMatch(/^no Where it fits/);
    expect(placeFor({ body: '', labels: [{ name: '🔨 task' }] }, places).place).toBe('the game');
  });

  it('names every area label the settings file has, in its order', () => {
    const settings = readFileSync(resolve('.github/settings.yml'), 'utf8');
    const order = AREAS.map(([label]) => settings.indexOf(`name: "${label}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('finds the section and the line in it', () => {
    expect(whereItFits('## Where it fits\n\nThe barn.\n')).toBe('The barn.');
    expect(whereItFits('Nothing here')).toBe('');
    expect(placeLine('- Not placed. Process only.')).toBe('Not placed.');
  });
});

describe('the section added to a walk', () => {
  const lines = '**Get there:** `tp me to barn`.\n\n## Try\n- [ ] The door opens\n\n**Right looks like:** a door.';

  it('is headed with the item and its PR, its own headings under that', () => {
    const text = section({ item: 945, pr: 'https://github.com/o/r/pull/1170', lines });
    expect(text.split('\n')[0]).toBe('## Try #945, merged in https://github.com/o/r/pull/1170');
    expect(text).toContain('### Try\n- [ ] The door opens');
  });

  it('refuses lines with nothing to tick', () => {
    expect(() => section({ item: 1, pr: 'x', lines: 'Have a look at it.' })).toThrow(/nothing to tick/);
  });

  it('opens a new walk with its intro, and adds to the end of one already open', () => {
    const fresh = withSection('', 'the barn', '## Try #1, merged in x\n\n- [ ] a');
    expect(fresh).toMatch(/^Everything merged for the barn that only eyes and ears can judge/);
    expect(fresh).toContain('`/test the barn`');
    const more = withSection(fresh, 'the barn', '## Try #2, merged in y\n\n- [ ] b');
    expect(more.indexOf('#1,')).toBeLessThan(more.indexOf('#2,'));
    expect(hasSection(more, 2)).toBe(true);
    expect(hasSection(more, 20)).toBe(false);
    expect(walkTitle('the barn')).toBe('Walk: the barn');
  });
});

describe('the walk a session names, and a full one', () => {
  it('takes a walk by its name, or a place by any of its names, so the barn is the farmstead\'s walk', () => {
    expect(resolvePlace('the farmstead', places)).toBe('the farmstead');
    expect(resolvePlace('The barn', places)).toBe('the farmstead');
    expect(resolvePlace('the farmhouse', places)).toBe('the farmstead');
    expect(resolvePlace("the neighbour's", places)).toBe("the neighbour's");
    expect(resolvePlace('the girls', places)).toBe('the girls');
  });

  it('refuses a name that is no walk, rather than opening a second one', () => {
    expect(() => resolvePlace('the shed out back', places)).toThrow(/isn't a place on docs\/farm-plan.md or an area. The walks are: .*the farmstead/);
  });

  it('adds to the latest part of a walk, and a full one is followed by part 2', () => {
    const open = [{ number: 1, title: 'Walk: the girls' }, { number: 9, title: 'Walk: the girls (2)' }, { number: 4, title: 'Walk: the girls next door' }];
    expect(currentWalk(open, 'the girls')).toMatchObject({ number: 9, part: 2 });
    expect(currentWalk(open.slice(0, 1), 'the girls')).toMatchObject({ number: 1, part: 1 });
    expect(currentWalk([{ number: 4, title: 'Walk: the girls next door' }], 'the girls')).toBeNull();
    expect(walkTitle('the girls', 2)).toBe('Walk: the girls (2)');
  });
});

describe('folding a testing issue into a walk', () => {
  const body = [
    'Try #945, merged in https://github.com/o/r/pull/1170 (v2.3.8).',
    '',
    '**Get there:** `tp me -273 470`.',
    '',
    '**Try**',
    '- [x] Done already',
    '  with a note under it',
    '- [ ] Ride south',
    '- [X] Also done',
    '',
    '## Also try #1172, merged in https://github.com/o/r/pull/1173',
    '',
    '- [ ] The follow-up',
  ].join('\n');

  it('reads the item and its PR from the first line', () => {
    expect(triedItem(body)).toEqual({ item: 945, pr: 'https://github.com/o/r/pull/1170' });
    expect(triedItem('From #97 (PR #596). The briefing.')).toEqual({ item: 97, pr: '#596' });
    expect(triedItem('Check the gamepad as a whole.')).toEqual({ item: null, pr: null });
  });

  it('keeps the unticked lines under its own heading, and leaves out the ticked ones', () => {
    const text = foldedSection({ number: 1171, title: 'Try: The hill', body });
    expect(text.split('\n')[0]).toBe('## Try #945, merged in https://github.com/o/r/pull/1170 (was #1171)');
    expect(text).toContain('- [ ] Ride south');
    expect(text).toContain('### Also try #1172');
    expect(text).not.toMatch(/Done already|with a note under it|Also done/);
    expect(text).not.toContain('(v2.3.8)');
  });

  it('keeps a first line that says more than the heading', () => {
    const more = foldedSection({ number: 934, title: 'Try: Benches', body: 'Try #809, merged in https://github.com/o/r/pull/931, with its fixes in #933.\n\n- [ ] a' });
    expect(more).toContain('with its fixes in #933');
  });

  it('turns a numbered list into lines to tick when it had none, and heads one with no item by its title', () => {
    const text = foldedSection({ number: 391, title: 'Try: Playing with a gamepad', body: 'Plug a pad in.\n\n1. Press Start\n2. Steer' });
    expect(text.split('\n')[0]).toBe('## Playing with a gamepad (was #391)');
    expect(text).toContain('- [ ] Press Start\n- [ ] Steer');
  });

  it('gives an empty one a line from its title, and has nothing to move when every line is ticked', () => {
    expect(foldedSection({ number: 1014, title: 'Try: Back Lane', body: '' })).toContain('- [ ] Back Lane (#1014 had nothing written down to try)');
    expect(foldedSection({ number: 5, title: 'Try: x', body: 'Try #4, merged in https://github.com/o/r/pull/6.\n\n- [x] a' })).toBeNull();
  });

  it('untickedOnly keeps the rest of the text as it was', () => {
    expect(untickedOnly('a\n- [x] b\n  c\n- [ ] d\n  e')).toBe('a\n- [ ] d\n  e');
  });
});

// A new map resets where things were and keeps everything else (#663): the farm save carries the layout version it was made on.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SAVE_KEY, LAYOUT_RESET_TOAST, openFarm, forLayout, validSave, writeSave, migrateSave } from '../src/farm/farmSave.js';
import { LAYOUT_VERSION } from '../src/world/layout.js';

// A save from today's game (layout 1) with every kind of kept position filled in. Today's game writes no layoutVersion.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/farm-on-layout-1.json', import.meta.url), 'utf8'));
const storageWith = (save) => ({ getItem: (k) => (k === SAVE_KEY ? JSON.stringify(save) : null), setItem() {}, removeItem() {} });
// The save is version 1, so the game reads it under today's vehicle ids (#589).
const migrated = migrateSave(fixture);
const POSITIONS = ['bales', 'lane', 'mowing', 'harrow', 'batteries', 'lostThings'];

describe('the layout version', () => {
  it('is 1 today, and the fixture is a layout 1 save that still validates', () => {
    expect(LAYOUT_VERSION).toBe(1);
    expect(fixture.layoutVersion).toBeUndefined();
    expect(validSave(fixture)).toBe(true);
  });

  it('is written with the save', () => {
    let stored;
    writeSave({ setItem: (k, v) => (stored = JSON.parse(v)) }, fixture);
    expect(stored.layoutVersion).toBe(LAYOUT_VERSION);
  });

  it('loads a save at the same layout version exactly as it is', () => {
    const farm = openFarm({ storage: storageWith(fixture) });
    expect(farm.layoutReset).toBe(false);
    expect(farm.save).toEqual(migrated);
    expect(openFarm({ storage: storageWith({ ...fixture, layoutVersion: 1 }) }).layoutReset).toBe(false);
  });

  it('keeps condition, money, favour, records and the calendar on another layout, and drops every position', () => {
    const farm = openFarm({ storage: storageWith(fixture), layoutVersion: 2 });
    expect(farm).toMatchObject({ continuing: true, layoutReset: true, day: fixture.day + 1, farmSeed: fixture.farmSeed });
    const s = farm.save;
    expect(s.layoutVersion).toBe(2);
    for (const key of POSITIONS) expect(s, key).not.toHaveProperty(key);
    expect(s.hay).toEqual({ stacked: 6 });
    expect(s.spray).toEqual({ tank: 0.6 });
    expect(s.boosterPack).toEqual({ charge: 0.8, where: 'loose' });
    for (const key of ['vehicles', 'fleet', 'market', 'shed', 'girls', 'records', 'challenges', 'bucket', 'learnt', 'logbook', 'stories', 'spares', 'generator', 'logs', 'mot', 'road', 'shows', 'photos', 'pods', 'headgear']) {
      expect(s[key], key).toEqual(migrated[key]);
    }
    expect(s.market.purse).toBe(340);
    expect(s.girls.favour).toEqual({ amy: 3, jess: 0 });
    expect(s.day).toBe(12);
  });

  it('leaves the saved file alone and handles a new farm or a seeded one', () => {
    const before = JSON.stringify(fixture);
    forLayout(fixture, 2);
    expect(JSON.stringify(fixture)).toBe(before);
    expect(forLayout(null, 2)).toEqual({ save: null, reset: false });
    expect(openFarm({ storage: storageWith(null) }).layoutReset).toBeUndefined();
    expect(openFarm({ search: '?seed=3', storage: storageWith(fixture), layoutVersion: 2 }).continuing).toBe(false);
  });

  it('says it once, in the plain voice', () => {
    expect(LAYOUT_RESET_TOAST).toBe('The farm has been laid out again. Your vehicles, money and the girls are as you left them.');
  });
});

import { describe, it, expect } from 'vitest';
import { Agenda, AGENDAS, AGENDA_IDS, agendaKey, dealAgenda } from '../src/npc/agenda.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { AMY_MIND_LINES, JESS_MIND_LINES } from '../src/npc/mindLines.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';

describe('her own day', () => {
  it('only names offer kinds there are, and has a line for each girl', () => {
    for (const id of AGENDA_IDS) {
      expect(AGENDAS[id].kinds.length, id).toBeGreaterThan(0);
      for (const k of AGENDAS[id].kinds) expect(OFFER_KINDS[k], `${id}: ${k}`).toBeTruthy();
      expect(AMY_MIND_LINES[agendaKey(id)], id).toBeTruthy();
      expect(JESS_MIND_LINES[agendaKey(id)], id).toBeTruthy();
    }
  });

  it('is dealt from odds that name real agendas, and never for a nought', () => {
    for (const c of CHARACTERS) for (const id of Object.keys(c.agendaOdds)) expect(AGENDAS[id], `${c.id}: ${id}`).toBeTruthy();
    expect(dealAgenda({ ramp: 1, tea: 0 }, () => 0.99)).toBe('ramp');
    expect(dealAgenda({ ramp: 1, tea: 3 }, () => 0.5)).toBe('tea');
    expect(dealAgenda({ ramp: 1, nonsense: 5 }, () => 0.99)).toBe('ramp');
    expect(dealAgenda({}, () => 0.5)).toBe(null);
    expect(dealAgenda(null)).toBe(null);
  });

  it('boosts only what is on it, and nothing with no agenda', () => {
    const a = new Agenda({ ramp: 1 }, P, () => 0.5);
    expect(a.boost('jumps', P)).toBe(P.agendaBoost);
    expect(a.boost('tea', P)).toBe(1);
    expect(new Agenda(null, P).boost('jumps', P)).toBe(1);
  });

  it('says so once, after a wait, and only then', () => {
    const a = new Agenda({ tea: 1 }, P, () => 0.5); // a wait of exactly agendaMention
    expect(a.due(P.agendaMention - 1)).toBe(false);
    expect(a.due(2)).toBe(true);
    expect(a.due(1)).toBe(true); // still due until she has said it (she may have been busy)
    a.mention();
    expect(a.due(100)).toBe(false);
    a.nudge();
    expect(a.due(0)).toBe(true);
  });

  it('can be swapped, and swapping to nothing clears it', () => {
    const a = new Agenda({ tea: 1 }, P);
    a.set('race', P);
    expect(a.boost('race', P)).toBe(P.agendaBoost);
    a.set('none', P);
    expect(a.id).toBe(null);
    expect(a.due(1000)).toBe(false);
    expect(a.describe()).toBe('nothing in particular');
  });
});

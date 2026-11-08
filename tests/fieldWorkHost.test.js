import { describe, it, expect } from 'vitest';
import { FieldWorkHost } from '../src/world/fieldWorkHost.js';

// A stand-in game: a board that ticks off what is on it, one girl to remark, and the field jobs' state the status lines read.
function standIn({ onBoard = ['spray', 'harrow', 'hay'] } = {}) {
  const log = [];
  const said = [];
  const here = { x: 0, distanceTo: () => 5 };
  const game = {
    farmJobs: { tickOff: (id, message) => (log.push(`tick ${id}`), onBoard.includes(id)) },
    hud: { toast: (text) => log.push(`toast ${text}`) },
    achievements: { note: (k) => log.push(`note ${k}`) },
    companions: [{ availability: () => ({ canRemark: true }), root: { position: { distanceTo: () => 5 } }, voice: { say: (k) => said.push(k) } }],
    sprayer: { model: { position: here } },
    harrows: { model: { position: here } },
    trailer: { model: { position: here } },
    spray: { tank: 0.5, out: false, boomWant: false },
    harrow: { isDown: false, downWant: false },
  };
  return { game, log, said, host: new FieldWorkHost(game) };
}

describe('FieldWorkHost', () => {
  it('ticks the spray job off and the girl remarks, or toasts plainly for a field done off the board', () => {
    const on = standIn();
    on.host.sprayDone();
    expect(on.log).toEqual(['tick spray']);
    expect(on.said).toEqual(['sprayDone']);
    const off = standIn({ onBoard: [] });
    off.host.sprayDone();
    expect(off.log).toEqual(['tick spray', 'toast Field sprayed']);
  });

  it('ticks the harrow job off the same way', () => {
    const off = standIn({ onBoard: [] });
    off.host.harrowDone();
    expect(off.log).toEqual(['tick harrow', 'toast Field harrowed']);
    expect(off.said).toEqual(['harrowDone']);
  });

  it('says what the sprayer and harrows are doing to whoever is pulling them', () => {
    const { host } = standIn();
    expect(host.sprayStatus()).toContain('50% in the tank');
    expect(host.sprayStatus()).toContain('T to fold the boom out');
    expect(host.harrowStatus()).toContain('T to lower the tines');
  });

  it('notes the hay made and ticks the job off when the last stage is over', () => {
    const { host, log, said } = standIn();
    host.hayStageChanged('done');
    expect(log).toEqual(['note hayMade', 'tick hay']);
    expect(said).toEqual(['hayDone']);
    expect(host.hayPhase).toBe('done');
  });
});

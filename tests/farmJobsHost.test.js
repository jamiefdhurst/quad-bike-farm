import { describe, it, expect } from 'vitest';
import { FarmJobsHost } from '../src/world/farmJobsHost.js';
import { MuckLoad, DEFAULT_MUCK_PARAMS } from '../src/world/farmJobs.js';

// A stand-in game: a board that ticks off what is on it, and the things the host tells when a job is done.
function standIn({ onBoard = ['muck'], girls = [] } = {}) {
  const log = [];
  const board = {
    cleared: false,
    complete: (id) => onBoard.includes(id) && (onBoard.splice(onBoard.indexOf(id), 1), (board.cleared = !onBoard.length), true),
  };
  const game = {
    jobBoard: board,
    jobBoardView: { refresh: () => log.push('refresh') },
    hud: { toast: (text, secs) => log.push(`toast ${text} ${secs}`) },
    achievements: { note: (k) => log.push(`note ${k}`) },
    companions: girls,
    tipTrailer: { model: { position: { x: 0 } } },
  };
  return { game, log, host: new FarmJobsHost(game) };
}

const girl = (name, distance, said, canRemark = true) => ({
  availability: () => ({ canRemark }),
  root: { position: { distanceTo: () => distance } },
  voice: { say: (key) => said.push(`${name}:${key}`) },
});

describe('FarmJobsHost', () => {
  it('ticks a job off with a toast, a redraw and the board-cleared note when it was the last', () => {
    const { host, log } = standIn();
    expect(host.tickOff('muck', 'Muck spread', 4)).toBe(true);
    expect(log).toEqual(['toast Muck spread 4', 'refresh', 'note boardCleared']);
  });

  it('says nothing and does nothing for a job that is not on today\'s board', () => {
    const { host, log } = standIn();
    expect(host.tickOff('hay', 'Hay stacked')).toBe(false);
    expect(log).toEqual([]);
  });

  it('does not note the board as cleared while jobs are left', () => {
    const { host, log } = standIn({ onBoard: ['muck', 'hay'] });
    host.tickOff('muck', 'Muck spread');
    expect(log).toEqual(['toast Muck spread 3', 'refresh']);
  });

  it('has the nearest free girl remark, or the farthest when asked for the other one', () => {
    const said = [];
    const { host } = standIn({ girls: [girl('far', 20, said), girl('near', 5, said), girl('busy', 1, said, false), girl('away', 40, said)] });
    host.say('muckStart');
    host.say('muckFull', true);
    expect(said).toEqual(['near:muckStart', 'far:muckFull']);
  });
});

describe('spreading the muck on the new farm (#691)', () => {
  // The trailer drives along z over the field `areaOf` names at its x: the muck counts only on the one the job names.
  function spreader() {
    const { game, log, host } = standIn();
    const laid = [];
    const field = { name: 'longpiece', label: 'Long Piece' };
    game.world = {
      layout: { jobFields: { muck: 'longpiece' }, fields: [field] },
      fields: { stubbleAt: () => 1, areaOf: (x) => (x < 100 ? 'lanefield' : 'longpiece') },
    };
    game.muck = new MuckLoad({ ...DEFAULT_MUCK_PARAMS });
    game.muck.load = 1;
    game.muck.started = true;
    game.muckView = { lay: (x, z) => laid.push([x, z]), setLoad: () => {} };
    game.tipTrailer = { model: { rotation: { y: 0 } }, motion: { x: 0, z: 0 }, signedSpeed: 1, bed: { tip: 0.4, p: { slideAt: 0.9 } } };
    const drive = (x, metres) => {
      for (let z = 0; z < metres; z += 0.5) {
        game.tipTrailer.motion = { x, z };
        host.updateMuck(0.5);
      }
    };
    return { game, log, host, laid, drive };
  }

  it('wastes muck spread on stubble in another field, and says which field the job wants', () => {
    const { game, log, laid, drive } = spreader();
    drive(50, 60);
    expect(game.muck.laid).toBe(0);
    expect(game.muck.done).toBe(false);
    const toasts = log.filter((l) => l.startsWith('toast'));
    expect(toasts.length).toBeGreaterThan(0); // once every few seconds, not every frame
    expect(toasts.length).toBeLessThan(10);
    for (const t of toasts) expect(t).toBe('toast Spread it on the stubble in Long Piece, not here 2');
    expect(laid.length).toBeGreaterThan(0); // the heap still drops where it fell, thinner
  });

  it('counts muck spread on the field the job names, and ticks the job off', () => {
    const { game, drive } = spreader();
    game.muck.load = 1;
    drive(150, 60);
    expect(game.muck.laid).toBeGreaterThan(0);
  });
});


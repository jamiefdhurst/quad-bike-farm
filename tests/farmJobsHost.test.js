import { describe, it, expect } from 'vitest';
import { FarmJobsHost } from '../src/world/farmJobsHost.js';

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

import { describe, it, expect, vi } from 'vitest';
import { JobBoardView } from '../src/world/jobBoard.js';

// Choosing a challenge on the chalkboard card closes the card at once, so the toast it raises isn't half behind it.
function setup(pressed) {
  vi.stubGlobal('document', { body: { classList: { add: () => {}, remove: () => {} } } });
  const order = [];
  const view = Object.create(JobBoardView.prototype);
  view.el = { style: { display: 'block' } };
  view.game = {
    player: { moveEnabled: false },
    startColdStart: vi.fn(() => order.push(`start:${view.isOpen ? 'open' : 'closed'}`)),
    judgeLineUp: vi.fn(() => order.push(`judge:${view.isOpen ? 'open' : 'closed'}`)),
  };
  const input = { takeWheelSteps: () => {}, wasPressed: (k) => k === pressed };
  return { view, input, order };
}

describe('the chalkboard card and its challenges', () => {
  it('closes before the cold start begins', () => {
    const { view, input, order } = setup('Digit1');
    view.handleInput(input);
    expect(order).toEqual(['start:closed']);
    expect(view.isOpen).toBe(false);
  });

  it('closes before the line-up is judged', () => {
    const { view, input, order } = setup('Digit2');
    view.handleInput(input);
    expect(order).toEqual(['judge:closed']);
    expect(view.isOpen).toBe(false);
  });

  it('stays open for other keys', () => {
    const { view, input } = setup('KeyX');
    view.handleInput(input);
    expect(view.isOpen).toBe(true);
  });
});

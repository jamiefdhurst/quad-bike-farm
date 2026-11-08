import { describe, it, expect, vi } from 'vitest';
import { ToolsHost } from '../src/items/toolsHost.js';

const host = () => ({
  player: { position: { x: 10, z: 20 }, yaw: 0 },
  can: { putDown: vi.fn() },
  toolbox: { putDown: vi.fn() },
});

describe('putting things down', () => {
  it('puts the toolbox just behind where you face, the way you face', () => {
    const g = host();
    new ToolsHost(g).putToolboxDown();
    const [spot, yaw] = g.toolbox.putDown.mock.calls[0];
    expect(spot.x).toBeCloseTo(10);
    expect(spot.z).toBeCloseTo(19.3);
    expect(yaw).toBe(0);
  });

  it('lays the jerry can across', () => {
    const g = host();
    new ToolsHost(g).putCanDown();
    expect(g.can.putDown.mock.calls[0][1]).toBeCloseTo(Math.PI / 2);
  });
});

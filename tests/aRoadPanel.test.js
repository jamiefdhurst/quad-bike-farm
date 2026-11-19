import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The panel's lane folder (src/debug/girlsTab.js) never builds in node (it makes DOM), so this reads its source: the A-road's buttons and the turn-round
// line are there beside Back Lane's, and call the methods the console's `lane.aRoad`, `lane.turnYouRound` and `lane.turnRound` call (#1022).
const panel = readFileSync(new URL('../src/debug/girlsTab.js', import.meta.url), 'utf8');
const tree = readFileSync(new URL('../src/console/gameTree.js', import.meta.url), 'utf8');

describe('the A-road in the panel and the console (#687, #1022)', () => {
  it('has a button to send a vehicle down the A-road, one to turn you round and a line saying where it stands, as the console has', () => {
    expect(panel).toContain("button(out, 'Send a vehicle down the A-road', () => g.trafficHost.debugARoad()");
    expect(panel).toContain("button(out, 'Turn you round', () => g.trafficHost.turnRound.debugStart()");
    expect(panel).toContain("show(out, 'being turned round', () => g.trafficHost.turnRound.describe())");
    expect(tree).toContain('g.trafficHost.debugARoad()');
    expect(tree).toContain('g.trafficHost.turnRound.debugStart()');
    expect(tree).toContain('g.trafficHost.turnRound.describe()');
  });
});

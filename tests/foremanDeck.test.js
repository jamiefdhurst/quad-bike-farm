import { describe, it, expect } from 'vitest';
import { DECK, deckRows, deckY, deckGeometry, flareGeometry, skirtBottom, bulkheadGeometry, topCoverGeometry, bodyTopY, coverY } from '../src/vehicle/foremanDeck.js';

// The red quad's decks and flares (TODO 88): sculpted, so no straight edges, and kept inside the width and short of the tyres.
describe('the Foreman’s decks', () => {
  for (const which of ['front', 'rear']) {
    const spec = DECK[which];
    it(`${which}: the plan outline is pulled in at the inner end and the face's corners, never wider than the deck`, () => {
      const rows = deckRows(DECK, spec);
      expect(rows[0].half).toBeLessThan(DECK.half - 0.05); // a swept tail, not a square end
      expect(rows[rows.length - 1].half).toBeLessThan(DECK.half - 0.05); // the face's bottom corners are angled in
      for (const r of rows) expect(r.half).toBeLessThanOrEqual(DECK.half);
      const mid = rows.find((r) => r.g === 0 && Math.abs(r.z - spec.z0) > 0.25);
      expect(mid.half).toBeCloseTo(DECK.half, 6);
    });

    it(`${which}: the rows run from the inner end to the face without doubling back`, () => {
      const dir = Math.sign(spec.zf - spec.z0);
      const rows = deckRows(DECK, spec);
      for (let i = 1; i < rows.length; i++) expect((rows[i].z - rows[i - 1].z) * dir).toBeGreaterThanOrEqual(-1e-9);
      expect(rows[rows.length - 1].z).toBeCloseTo(spec.zf, 6);
      expect(rows[rows.length - 1].dy).toBeCloseTo(-spec.faceH, 6);
    });

    it(`${which}: crowned and rolled, highest nearer the middle than at the edge`, () => {
      const r = deckRows(DECK, spec).find((row) => row.g === 0 && Math.abs(row.z - spec.z0) > 0.25);
      expect(deckY(DECK, spec, r, 0.3)).toBeGreaterThan(deckY(DECK, spec, r, r.half));
      expect(deckY(DECK, spec, r, r.half - 0.002)).toBeLessThan(spec.top - DECK.edgeDrop * 0.7);
    });

    it(`${which}: the geometry stays inside the width and the flare hangs outside the deck's edge`, () => {
      const g = deckGeometry(which);
      g.computeBoundingBox();
      expect(g.boundingBox.max.x).toBeLessThanOrEqual(DECK.half + 1e-6);
      for (const side of [-1, 1]) {
        const f = flareGeometry(which, which === 'front' ? 0.62 : -0.62, side);
        f.computeBoundingBox();
        expect(Math.abs(side > 0 ? f.boundingBox.max.x : f.boundingBox.min.x)).toBeGreaterThan(DECK.half);
      }
    });

    it(`${which}: the skirt follows the arch over the tyre and sweeps down to the footboard at the inner end`, () => {
      const wz = which === 'front' ? 0.62 : -0.62;
      expect(skirtBottom(DECK, spec, wz, wz)).toBeGreaterThan(0.3 + 0.3); // clear of the tyre's top
      expect(skirtBottom(DECK, spec, wz, spec.z0)).toBeCloseTo(DECK.lowEdge, 6);
    });
  }

  for (const which of ['front', 'rear']) {
    it(`${which}: a wall closes the deck's inner end, from the side panel out, hanging from the deck to the footboard`, () => {
      const spec = DECK[which];
      for (const side of [-1, 1]) {
        const g = bulkheadGeometry(which, side);
        g.computeBoundingBox();
        const b = g.boundingBox;
        const xs = side > 0 ? [b.min.x, b.max.x] : [-b.max.x, -b.min.x];
        expect(xs[0]).toBeCloseTo(0.266, 6); // it starts at the side panel's outer face, so there is no slot between the panel and the wing
        expect(xs[1]).toBeCloseTo(deckRows(DECK, spec)[0].half + 0.012, 6); // and ends on the skirt's outer face, at its own x
        expect(b.min.y).toBeCloseTo(DECK.lowEdge, 6); // down to the footboard, where the skirt's tail ends
        expect(b.max.y).toBeGreaterThan(spec.top - 0.1); // and up to the deck
        expect(Math.min(Math.abs(b.max.z - spec.z0), Math.abs(b.min.z - spec.z0))).toBeLessThan(1e-6); // meeting the deck's end at the skirt
        const back = which === 'front' ? spec.z0 - b.min.z : b.max.z - spec.z0;
        expect(back).toBeGreaterThanOrEqual(0.1 - 1e-6); // and leaving the panel the fillet's radius back from it, so the corner is round
      }
    });
  }
});

describe('the body between the decks', () => {
  it('has a top cover from one deck\'s end to the other\'s, as wide as the side panels and wider over the fillets', () => {
    const g = topCoverGeometry();
    g.computeBoundingBox();
    const b = g.boundingBox;
    expect(b.min.z).toBeCloseTo(DECK.rear.z0, 6);
    expect(b.max.z).toBeCloseTo(DECK.front.z0, 6);
    expect(b.max.x).toBeGreaterThan(0.266 + 0.09); // out over the fillets at the ends, so there is no hole above them
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getZ(i)) < 0.15) expect(Math.abs(pos.getX(i))).toBeLessThanOrEqual(0.27 + 1e-6);
  });

  it('follows one top line, which meets the decks\' ends without a step and is highest in the middle', () => {
    expect(bodyTopY(0.3)).toBeCloseTo(0.703, 3);
    expect(bodyTopY(-0.3)).toBeCloseTo(0.754, 3);
    expect(bodyTopY(0)).toBeGreaterThan(bodyTopY(0.3));
    expect(bodyTopY(0)).toBeGreaterThan(bodyTopY(-0.3));
    expect(bodyTopY(5)).toBe(bodyTopY(0.3)); // clamped beyond the ends
  });

  for (const which of ['front', 'rear']) {
    it(`${which}: the cover meets the deck's end edge at exactly the deck's height, all across`, () => {
      const spec = DECK[which];
      const row = deckRows(DECK, spec)[0];
      for (const x of [0, 0.1, 0.2, 0.266, 0.35, 0.45]) expect(coverY(DECK, x, spec.z0)).toBeCloseTo(deckY(DECK, spec, row, x), 9);
    });
  }
});

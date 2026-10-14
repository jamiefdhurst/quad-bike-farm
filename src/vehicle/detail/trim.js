import * as THREE from 'three';

// Interior trim drawn in code (TODO 340): vinyl with its grain, seat cloth, carpet, ribbed rubber mats, perforated headlining,
// door cards and grained plastic. Each is a small tiling canvas used as both the colour map (tinted by the material's colour) and
// the bump map, so it catches the light. What each looks like is pure (`TRIM_KINDS`, `trimPattern`, tested); the canvas is drawn
// once per kind and shared. A textured mesh isn't merged with others, so give a trim to big surfaces (a seat, a floor), not to
// every bracket.

export const TRIM_KINDS = {
  vinyl: { size: 128, repeat: 4, grain: 0.08, bump: 0.002 }, // seat and door vinyl: a fine pebbled grain
  cloth: { size: 128, repeat: 6, weave: 4, stripe: 0, bump: 0.0015 }, // seat cloth: a woven check
  stripeCloth: { size: 128, repeat: 3, weave: 4, stripe: 6, bump: 0.0015 }, // an '80s or '90s seat insert: woven with pinstripes
  carpet: { size: 128, repeat: 8, grain: 0.22, bump: 0.003 },
  rubberMat: { size: 128, repeat: 3, ribs: 10, bump: 0.004 }, // a floor mat: raised ribs
  headlining: { size: 128, repeat: 10, holes: 8, bump: 0.001 }, // perforated
  doorCard: { size: 128, repeat: 2, ribs: 6, grain: 0.06, bump: 0.002 }, // pressed horizontal ribs in vinyl
  plastic: { size: 128, repeat: 6, grain: 0.05, bump: 0.001 }, // dash and console plastic: a leathery grain
};

/** A small seeded random, so a texture comes out the same every time. */
function seeded(seed) {
  let v = seed;
  return () => ((v = (v * 16807) % 2147483647) / 2147483647);
}

/**
 * What to draw for a trim of `kind`, as grey levels (0..255) on a `size` square: a Uint8Array, pure. Lighter is higher in the bump
 * and lighter in the colour (multiplied by the material's colour).
 */
export function trimPattern(kind) {
  const k = TRIM_KINDS[kind];
  if (!k) throw new Error(`Unknown trim: ${kind}`);
  const n = k.size;
  const out = new Uint8Array(n * n);
  const rand = seeded(kind.length * 7919 + n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      let v = 0.78;
      if (k.weave) {
        const wx = Math.floor(x / k.weave) % 2;
        const wy = Math.floor(y / k.weave) % 2;
        v += wx === wy ? 0.1 : -0.1;
        if (k.stripe && x % (n / k.stripe) < 2) v += 0.18;
      }
      if (k.ribs) v += Math.cos((y / n) * Math.PI * 2 * k.ribs) > 0.3 ? 0.14 : -0.06;
      if (k.holes) {
        const cell = n / k.holes;
        const dx = (x % cell) - cell / 2;
        const dy = (y % cell) - cell / 2;
        if (dx * dx + dy * dy < 2.2) v -= 0.35;
      }
      if (k.grain) v += (rand() - 0.5) * k.grain * 2;
      out[y * n + x] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
  }
  return out;
}

const textures = new Map();

/** The tiling texture for a trim of `kind`, shared. */
export function trimTexture(kind) {
  if (textures.has(kind)) return textures.get(kind);
  const k = TRIM_KINDS[kind];
  const px = trimPattern(kind);
  const c = document.createElement('canvas');
  c.width = c.height = k.size;
  const g = c.getContext('2d');
  const img = g.createImageData(k.size, k.size);
  for (let i = 0; i < px.length; i++) {
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = px[i];
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(k.repeat, k.repeat);
  textures.set(kind, tex);
  return tex;
}

/**
 * A material for a trim of `kind` in `colour`: the pattern as its map and its bump. Needs UVs on the geometry (a box or plane has
 * them; the kit's lofts don't, so use it on panels, floors and liners).
 */
export function trimMaterial(kind, colour, { roughness = 0.75 } = {}) {
  const tex = trimTexture(kind);
  return new THREE.MeshStandardMaterial({ color: colour, map: tex, bumpMap: tex, bumpScale: TRIM_KINDS[kind].bump * 400, roughness });
}

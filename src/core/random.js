// Seeded randomness for anything decided once at the start (spawn spots and the
// like). ?seed=123 in the URL makes a layout repeatable; otherwise it's random.

export function createRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function startSeed() {
  const fromUrl = Number(new URLSearchParams(globalThis.location?.search ?? '').get('seed'));
  return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 1e9);
}

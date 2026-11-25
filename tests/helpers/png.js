import { inflateSync } from 'node:zlib';

// A PNG's pixels in node, for the tests that need the girls' real paint (her palette texture is 32 by 32, 8-bit RGBA). Only what that
// texture uses: 8 bits a channel, RGB or RGBA, not interlaced.

/** { width, height, data } with data RGBA, 4 bytes a pixel, rows from the top. */
export function decodePng(buf) {
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const [depth, type, , , interlace] = buf.subarray(24, 29);
  if (depth !== 8 || (type !== 2 && type !== 6) || interlace) throw new Error(`decodePng: unsupported (depth ${depth}, type ${type}, interlace ${interlace})`);
  const chunks = [];
  for (let at = 8; at < buf.length; ) {
    const len = buf.readUInt32BE(at);
    if (buf.toString('latin1', at + 4, at + 8) === 'IDAT') chunks.push(buf.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const bpp = type === 6 ? 4 : 3;
  const stride = width * bpp;
  const rows = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? rows[y * stride + x - bpp] : 0;
      const b = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? rows[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      rows[y * stride + x] = (v + pred) & 255;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data.set(rows.subarray(i * bpp, i * bpp + 3), i * 4);
    data[i * 4 + 3] = bpp === 4 ? rows[i * bpp + 3] : 255;
  }
  return { width, height, data };
}

/** The first image embedded in a .glb, as PNG bytes. */
export function glbImage(glb) {
  const len = glb.readUInt32LE(12);
  const json = JSON.parse(glb.toString('utf8', 20, 20 + len));
  const view = json.bufferViews[json.images[0].bufferView];
  const bin = 20 + len + 8;
  return glb.subarray(bin + (view.byteOffset ?? 0), bin + (view.byteOffset ?? 0) + view.byteLength);
}

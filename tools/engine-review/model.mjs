// The source-filter analysis for the engine model. From a recording's idle firings: its average spectrum, split into a broad
// slope (the firing pulse itself, which should brighten as the revs shorten it) and the resonances standing on it (pipe, silencer,
// body, which stay put), fitted as a few peaking filters. Dividing those out of the recording leaves its bare pulses; band-limited
// copies of them let the worklet play them up to 8 times faster without aliasing.

const SR = 48000;

export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k), s = Math.sin(a * k);
        const xr = re[i + k + len / 2] * c - im[i + k + len / 2] * s;
        const xi = re[i + k + len / 2] * s + im[i + k + len / 2] * c;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

/** Average power spectrum (Welch, Hann, half overlap). */
export function welch(x, N = 8192) {
  const pow = new Float64Array(N / 2);
  let n = 0;
  for (let off = 0; off + N <= x.length; off += N / 2, n++) {
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < N; i++) re[i] = x[off + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
    fft(re, im);
    for (let k = 0; k < N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
  }
  for (let k = 0; k < N / 2; k++) pow[k] /= Math.max(1, n);
  return pow;
}

// A grid of frequencies, 24 to the octave, 30 Hz to 14 kHz.
export const GRID = [];
for (let f = 30; f < 14000; f *= 2 ** (1 / 24)) GRID.push(f);

/** A power spectrum onto the grid, in dB, smoothed over `widthOct` octaves (Gaussian in log frequency). */
export function toGridDb(pow, N, widthOct) {
  const raw = GRID.map((f) => {
    const lo = Math.max(1, Math.floor(((f * 2 ** (-1 / 48)) / SR) * N));
    const hi = Math.max(lo + 1, Math.ceil(((f * 2 ** (1 / 48)) / SR) * N));
    let e = 0;
    for (let k = lo; k < hi; k++) e += pow[k];
    return 10 * Math.log10(e / (hi - lo) + 1e-30);
  });
  return smooth(raw, widthOct);
}

export function smooth(db, widthOct) {
  const sigma = widthOct * 24 / 2.355; // width as the Gaussian's full width at half maximum, in grid steps
  if (sigma < 0.5) return db.slice();
  const out = [];
  for (let i = 0; i < db.length; i++) {
    let s = 0, w = 0;
    for (let j = Math.max(0, i - Math.ceil(3 * sigma)); j <= Math.min(db.length - 1, i + Math.ceil(3 * sigma)); j++) {
      const k = Math.exp(-0.5 * ((j - i) / sigma) ** 2);
      s += db[j] * k;
      w += k;
    }
    out.push(s / w);
  }
  return out;
}

/** RBJ peaking filter coefficients. */
export function peakingCoefs(f, q, g) {
  const w = (2 * Math.PI * Math.min(f, SR * 0.45)) / SR;
  const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), A = 10 ** (g / 40);
  const a0 = 1 + alpha / A;
  return { b0: (1 + alpha * A) / a0, b1: (-2 * cos) / a0, b2: (1 - alpha * A) / a0, a1: (-2 * cos) / a0, a2: (1 - alpha / A) / a0 };
}

/** Its gain in dB at frequency `f`. */
export function peakingDb(pk, f) {
  const c = peakingCoefs(pk.f, pk.q, pk.g);
  const w = (2 * Math.PI * f) / SR;
  const re = (a0, a1, a2) => a0 + a1 * Math.cos(-w) + a2 * Math.cos(-2 * w);
  const im = (a1, a2) => a1 * Math.sin(-w) + a2 * Math.sin(-2 * w);
  const num = re(c.b0, c.b1, c.b2) ** 2 + im(c.b1, c.b2) ** 2;
  const den = re(1, c.a1, c.a2) ** 2 + im(c.a1, c.a2) ** 2;
  return 10 * Math.log10(num / den);
}

/**
 * Fits resonances to a dB curve (the spectrum over its slope) greedily: the largest deviation becomes a peaking filter with the
 * bandwidth where it falls to half its height, its response is taken off, and so on, up to `max` or until under `floorDb`.
 */
export function fitPeaks(rDb, { max = 12, floorDb = 1, from = 40, to = 10000 } = {}) {
  const r = rDb.slice();
  const peaks = [];
  for (let n = 0; n < max; n++) {
    let bi = -1;
    for (let i = 0; i < GRID.length; i++) if (GRID[i] >= from && GRID[i] <= to && (bi < 0 || Math.abs(r[i]) > Math.abs(r[bi]))) bi = i;
    const g = r[bi];
    if (Math.abs(g) < floorDb) break;
    let lo = bi, hi = bi;
    while (lo > 0 && Math.sign(r[lo - 1]) === Math.sign(g) && Math.abs(r[lo - 1]) > Math.abs(g) / 2) lo--;
    while (hi < GRID.length - 1 && Math.sign(r[hi + 1]) === Math.sign(g) && Math.abs(r[hi + 1]) > Math.abs(g) / 2) hi++;
    const bw = Math.max(1 / 24, (hi - lo + 1) / 24); // octaves
    const q = Math.min(20, Math.max(0.4, Math.sqrt(2 ** bw) / (2 ** bw - 1)));
    const pk = { f: +GRID[bi].toFixed(1), q: +q.toFixed(3), g: +Math.max(-18, Math.min(18, g)).toFixed(2) };
    peaks.push(pk);
    for (let i = 0; i < GRID.length; i++) r[i] -= peakingDb(pk, GRID[i]);
  }
  return peaks;
}

export function runPeaks(x, peaks, sign = 1) {
  const y = Float32Array.from(x);
  for (const pk of peaks) {
    const c = peakingCoefs(pk.f, pk.q, sign * pk.g);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = y[i];
      const o = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = o;
      y[i] = o;
    }
  }
  return y;
}

/** Fourth-order Butterworth low-pass at `fc`, two biquads. */
export function lowpass4(x, fc) {
  let y = Float32Array.from(x);
  for (const q of [0.5412, 1.3066]) {
    const w = (2 * Math.PI * fc) / SR, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q), a0 = 1 + alpha;
    const b0 = (1 - cos) / 2 / a0, b1 = (1 - cos) / a0, b2 = b0, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < y.length; i++) {
      const v = y[i];
      const o = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = o;
      y[i] = o;
    }
  }
  return y;
}

/** The grains of a kind, joined in recording order, as one signal. */
export function joinGrains(bank, data, filter) {
  const gs = bank.grains.filter(filter).sort((a, b) => a.start - b.start);
  const n = gs.reduce((s, g) => s + Math.round(g.dur * SR), 0);
  const out = new Float32Array(n);
  let o = 0;
  for (const g of gs) {
    const a = Math.round(g.start * SR), len = Math.round(g.dur * SR);
    out.set(data.subarray(a, a + len), o);
    o += len;
  }
  return out;
}

/**
 * Average power spectrum of single firings: each grain of `kind` cut into its `split` firings, each transformed on its own
 * (zero-padded), so the idle's rhythm (lines at the firing rate) doesn't show, only the envelope every firing shares.
 */
export function firingSpectrum(bank, data, kind, split = 1, N = 8192) {
  const pow = new Float64Array(N / 2);
  let n = 0;
  for (const g of bank.grains) {
    if (g.kind !== kind || g.ok === false) continue;
    const a = Math.round(g.start * SR), len = Math.round(g.dur * SR), each = Math.floor(len / split);
    for (let s = 0; s < split; s++) {
      const re = new Float64Array(N), im = new Float64Array(N);
      for (let i = 0; i < Math.min(each, N); i++) re[i] = data[a + s * each + i];
      fft(re, im);
      for (let k = 0; k < N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
      n++;
    }
  }
  for (let k = 0; k < N / 2; k++) pow[k] /= Math.max(1, n);
  return pow;
}

/**
 * The model's bank: the resonances of the idle firings of `kind` (each grain `split` firings) over their slope (smoothed
 * `slopeOct` octaves), fitted from 1.5 times the idle's firing rate up, the recording with them divided out, and band-limited copies
 * for 2, 4, 8 and 16 times faster.
 */
export function modelBank(bank, data, kind, { split = 1, slopeOct = 2, detailOct = 1 / 6, maxPeaks = 12 } = {}) {
  const rpms = bank.grains.filter((g) => g.kind === kind && g.ok !== false).map((g) => g.rpm).sort((a, b) => a - b);
  const firingHz = ((rpms[rpms.length >> 1] ?? 1000) / 120) * split;
  const detail = toGridDb(firingSpectrum(bank, data, kind, split), 8192, detailOct);
  const slope = smooth(detail, slopeOct);
  const peaks = fitPeaks(detail.map((d, i) => d - slope[i]), { max: maxPeaks, from: Math.max(50, 1.5 * firingHz) });
  const bare = runPeaks(data, peaks, -1);
  // levels[k] is safe played up to 2^k times faster: everything above 0.45 of the output's Nyquist / 2^k taken out.
  const levels = [bare, ...[1, 2, 3, 4].map((k) => lowpass4(bare, (0.45 * SR) / 2 ** (k + 1)))];
  return { ...bank, data: bare, levels, peaks, firingHz };
}

/**
 * Takes mechanical ticks (tappets and the like) out of a recording's idle grains of `kind`: where the part above `hz` jumps to
 * more than `over` times its level over the surrounding 20 ms, that part is faded out for a millisecond or two, leaving the firing's
 * body. Ticks belong to the engine's own valve-tick layer, which follows the revs on its own, not to every replayed firing.
 */
export function detick(bank, data, kind, { hz = 2500, over = 5 } = {}) {
  const out = Float32Array.from(data);
  const w = (2 * Math.PI * hz) / SR, cos = Math.cos(w), alpha = Math.sin(w) / (2 * 0.707), a0 = 1 + alpha;
  const hb0 = (1 + cos) / 2 / a0, hb1 = -(1 + cos) / a0, ha1 = (-2 * cos) / a0, ha2 = (1 - alpha) / a0;
  let removed = 0, total = 0;
  for (const g of bank.grains) {
    if (g.kind !== kind || g.ok === false) continue;
    const a = Math.max(0, Math.round(g.start * SR) - 480), z = Math.min(data.length, Math.round((g.start + g.dur) * SR) + 480);
    const n = z - a;
    const hp = new Float32Array(n);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) {
      const v = data[a + i];
      const y = hb0 * v + hb1 * x1 + hb0 * x2 - ha1 * y1 - ha2 * y2;
      x2 = x1; x1 = v; y2 = y1; y1 = y;
      hp[i] = y;
    }
    // Level of the top end in 0.25 ms steps, against the median of the 20 ms around it.
    const step = 12, lv = [];
    for (let i = 0; i + step <= n; i += step) {
      let e = 0;
      for (let k = 0; k < step; k++) e += hp[i + k] ** 2;
      lv.push(Math.sqrt(e / step));
    }
    const mask = new Float32Array(n);
    for (let j = 0; j < lv.length; j++) {
      const around = lv.slice(Math.max(0, j - 40), j + 40).sort((p, q) => p - q);
      if (lv[j] > over * around[around.length >> 1]) {
        // A tick: the top end faded out over 1.5 ms either side, on a raised-cosine edge.
        for (let k = -72; k < step + 72; k++) {
          const i = j * step + k;
          if (i < 0 || i >= n) continue;
          const edge = k < 0 ? (k + 72) / 72 : k >= step ? (step + 72 - k) / 72 : 1;
          mask[i] = Math.max(mask[i], 0.5 - 0.5 * Math.cos(Math.PI * edge));
        }
      }
    }
    for (let i = 0; i < n; i++) {
      out[a + i] = data[a + i] - hp[i] * mask[i];
      removed += mask[i];
    }
    total += n;
  }
  return { data: out, share: removed / Math.max(1, total) };
}

/**
 * A recording's firing burst: the median time until 80% of a firing's energy has gone, over the idle grains of `kind` cut into
 * `split` firings. Measured on the bare pulses (a model bank's data), it is what shortens with the revs while the resonances stay.
 */
export function burstSeconds(bank, data, kind, split = 1) {
  const d80 = [];
  for (const g of bank.grains) {
    if (g.kind !== kind || g.ok === false) continue;
    const a = Math.round(g.start * SR), len = Math.round(g.dur * SR), each = Math.floor(len / split);
    for (let s = 0; s < split; s++) {
      let tot = 0;
      for (let i = 0; i < each; i++) tot += data[a + s * each + i] ** 2;
      let acc = 0, i = 0;
      for (; i < each && acc < 0.8 * tot; i++) acc += data[a + s * each + i] ** 2;
      d80.push(i / SR);
    }
  }
  d80.sort((x, y) => x - y);
  return d80[d80.length >> 1];
}

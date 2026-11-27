// The engine review's measures of a render, pure: dropouts (gaps.mjs), ticks (ticks.mjs) and third-octave tone (sweep.mjs), shared
// with tests/engineSound.test.js (#856).

export { tickRate } from './ticks.mjs';

const SR = 48000;

// The level (dB) of each 5 ms window from `skip` seconds in to `skip` from the end, and how many are 20 dB under the median: a
// dropout, the engine gone quiet where it should be running.
export function dropouts(x, { sr = SR, skip = 0.3, windowMs = 5, under = 20 } = {}) {
  const W = Math.round((sr * windowMs) / 1000);
  const from = Math.round(skip * sr);
  const to = x.length - from;
  const rms = [];
  for (let o = from; o + W < to; o += W) {
    let s = 0;
    for (let i = 0; i < W; i++) s += x[o + i] ** 2;
    rms.push(10 * Math.log10(s / W + 1e-12));
  }
  const med = [...rms].sort((a, c) => a - c)[rms.length >> 1];
  const at = [];
  rms.forEach((r, k) => r < med - under && at.push(+((from + k * W) / sr).toFixed(3)));
  return { count: at.length, windows: rms.length, at };
}

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
        const c = Math.cos(a * k);
        const s = Math.sin(a * k);
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

// Power spectrum of the first N samples (Hann window), zero-padded when shorter.
export function spectrum(x, N = 32768) {
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const n = Math.min(N, x.length);
  for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n));
  fft(re, im);
  const pow = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) pow[i] = re[i] * re[i] + im[i] * im[i];
  return pow;
}

// Third-octave band levels from 40 Hz to 12 kHz, each in dB of the whole: the level taken out, so only the tone is left.
export function bandsDb(pow, sr = SR) {
  const N = pow.length * 2;
  let tot = 0;
  for (let k = 1; k < pow.length; k++) tot += pow[k];
  const bands = [];
  for (let f = 40; f < 12000; f *= 2 ** (1 / 3)) {
    const lo = Math.floor((f / sr) * N);
    const hi = Math.max(lo + 1, Math.floor(((f * 2 ** (1 / 3)) / sr) * N));
    let e = 1e-20;
    for (let k = lo; k < hi; k++) e += pow[k];
    bands.push(10 * Math.log10(e / tot));
  }
  return bands;
}

// How different two stretches sound: the mean difference of their third-octave levels, in dB, with each one's level taken out.
export function toneChange(a, b) {
  const A = bandsDb(spectrum(a));
  const B = bandsDb(spectrum(b));
  return A.reduce((s, v, k) => s + Math.abs(v - B[k]), 0) / A.length;
}

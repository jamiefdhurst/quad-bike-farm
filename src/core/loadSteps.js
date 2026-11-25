// How long each part of the load takes (#1107), as the browser's own performance measures, so `node tools/perf.mjs --steps` and the console's
// `perf` can name the slow ones inside "Building world…", which is one step on the loading screen. Pure but for `performance`, which node has too.

const PREFIX = 'load · ';

/** Runs `fn` and records how long it took under `name`; returns what it returned. */
export function timed(name, fn) {
  const start = performance.now();
  try {
    return fn();
  } finally {
    performance.measure?.(PREFIX + name, { start, end: performance.now() });
  }
}

/** For a long run of code: each `lap(name)` records the time since the last lap (or since this was made) under `name`. */
export function laps() {
  let start = performance.now();
  return (name) => {
    const end = performance.now();
    performance.measure?.(PREFIX + name, { start, end });
    start = end;
  };
}

/** Every part timed so far, slowest first: [{ name, ms }]. A part timed more than once is added up. */
export function loadSteps() {
  const ms = new Map();
  for (const e of performance.getEntriesByType?.('measure') ?? []) {
    if (!e.name.startsWith(PREFIX)) continue;
    const name = e.name.slice(PREFIX.length);
    ms.set(name, (ms.get(name) ?? 0) + e.duration);
  }
  return [...ms].map(([name, t]) => ({ name, ms: Math.round(t) })).sort((a, b) => b.ms - a.ms);
}

/** The slowest `n` parts in a line, for the Tune tab's "Frame time" folder: "world · props 1.1 s, game · the girls 0.9 s, ...", or '-' before any. */
export function slowestStepsText(steps = loadSteps(), n = 3) {
  return steps.length ? steps.slice(0, n).map((s) => `${s.name} ${(s.ms / 1000).toFixed(2)} s`).join(', ') : '-';
}

// For each vehicle: the revs it reaches against the revs its bank's usable grains were recorded at, for the kinds it plays up there.
import { readFileSync } from 'node:fs';
import { SPECS } from './render.mjs';
import { DEFAULT_AUDIO_PARAMS } from '../../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
const q = (r, f) => Math.round(r[Math.floor(f * (r.length - 1))] ?? 0);
console.log('vehicle   bank                 mode      maxRpm  revLo-Hi    pitchF div | rev grains: n  p50  p90  top   | idle grains top');
for (const s of SPECS) {
  const p = { ...DEFAULT_AUDIO_PARAMS, ...s.audio };
  const e = { ...DEFAULT_ENGINE_PARAMS, ...s.engine };
  const b = JSON.parse(readFileSync(`public/audio/${p.recBank}.json`, 'utf8'));
  const ok = b.grains.filter((g) => g.ok !== false);
  const idleKind = { rev: 'idle2', third: 'idle3' }[p.recIdleSource] ?? 'idle';
  const revKinds = p.engineSound === 'pulse' ? (p.pulseRevHi > p.pulseRevLo ? ['accel'] : []) : ['accel', 'idle3', 'idle2'];
  const rev = ok.filter((g) => revKinds.includes(g.kind)).map((g) => g.rpm).sort((a, b) => a - b);
  const idle = ok.filter((g) => g.kind === idleKind).map((g) => g.rpm).sort((a, b) => a - b);
  console.log(`${s.id.padEnd(9)} ${p.recBank.padEnd(20)} ${p.engineSound.padEnd(8)} ${String(e.maxRpm).padStart(6)}  ${p.engineSound === 'pulse' ? `${p.pulseRevLo}-${p.pulseRevHi}` : `${p.recBlendLo}-${p.recBlendHi}`}`.padEnd(60) + `${String(p.pulsePitchFollow).padStart(5)} ${String(p.pulseDivide).padStart(3)} | ${String(rev.length).padStart(4)} ${String(q(rev, 0.5)).padStart(5)} ${String(q(rev, 0.9)).padStart(5)} ${String(q(rev, 1)).padStart(6)} | ${q(idle, 1)}`);
}

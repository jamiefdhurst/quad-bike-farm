"""Cut engine recordings into single firing pulses for the recorded engine sound.

Reads mono 16-bit WAVs of the source recordings (see ASSETS.md for where they
come from), finds each firing pulse, and writes:

  public/audio/engine-bank.wav   the segments that are used, back to back
  public/audio/engine-bank.json  where every pulse ("grain") starts and ends,
                                 what rpm it was recorded at, and what kind it is

At runtime each pulse from the engine model plays one recorded pulse
(src/audio/engineWorklet.js), so the lumpiness, misfires and starter rhythm
of the engine model come through with real recorded sound.

Usage (needs numpy, and matplotlib for --plot):

  afconvert -f WAVE -d LEI16@44100 -c 1 379915.mp3 quad.wav     # or ffmpeg
  afconvert -f WAVE -d LEI16@44100 -c 1 419091.mp3 rev.wav
  python3 tools/slice_engine_audio.py --quad quad.wav --rev rev.wav [--plot out.png]
"""

import argparse
import json
import os
import wave

import numpy as np

SR = 44100
ENV_RATE = 4000  # envelope sample rate, Hz
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Which parts of which recording to use. Times in seconds.
SEGMENTS = [
    # kind,     source, start, end,  period range (s),  notes
    ('idle', 'quad', 1.60, 7.30, (0.06, 0.12)),
    ('idle', 'quad', 8.80, 12.0, (0.06, 0.12)),
    ('idle', 'quad', 17.0, 19.9, (0.06, 0.12)),
    ('accel', 'rev', 2.00, 3.05, (0.016, 0.045)),  # revving up, throttle open
    ('decel', 'rev', 3.15, 6.05, (0.016, 0.085)),  # falling back, throttle closed
    ('idle2', 'rev', 0.10, 1.95, (0.06, 0.09)),  # the rev recording's own idle, to blend across machines
]
ONESHOTS = [
    # The starter's own chug isn't regular enough to cut per compression stroke, so
    # cranking is an engage sound followed by a loop between two quiet points.
    ('starterEngage', 'quad', 0.08, 0.365),
    ('crankLoop', 'quad', 0.365, 1.329),
    ('shutdown', 'quad', 20.22, 21.2),  # the run-down once the ignition is cut
]


def load(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def envelope(x, smooth):
    k = max(1, int(SR * smooth))
    e = np.convolve(np.abs(x), np.ones(k) / k, mode='same')
    return e[:: SR // ENV_RATE]


def local_period(env, t, lo, hi, win):
    """Autocorrelation estimate of the pulse period around env index t."""
    a = max(0, t - win // 2)
    seg = env[a : a + win] - env[a : a + win].mean()
    ac = np.correlate(seg, seg, 'full')[len(seg) - 1 :]
    lo_i, hi_i = int(lo * ENV_RATE), min(int(hi * ENV_RATE), len(ac) - 1)
    return (lo_i + int(np.argmax(ac[lo_i:hi_i]))) / ENV_RATE


def find_peaks(env, lo, hi):
    """Follows the pulse train: each peak is the loudest point about one period after the last."""
    win = int(max(0.3, hi * 4) * ENV_RATE)
    p = local_period(env, win // 2, lo, hi, win)
    first = int(np.argmax(env[: int(p * ENV_RATE) + 1]))
    peaks = [first]
    while True:
        p = local_period(env, peaks[-1], lo, hi, win)
        a = peaks[-1] + int(0.72 * p * ENV_RATE)
        b = peaks[-1] + int(1.28 * p * ENV_RATE)
        if b >= len(env):
            break
        peaks.append(a + int(np.argmax(env[a:b])))
    return np.array(peaks) / ENV_RATE


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--quad', required=True)
    ap.add_argument('--rev', required=True)
    ap.add_argument('--plot')
    args = ap.parse_args()
    sources = {'quad': load(args.quad), 'rev': load(args.rev)}

    out = []  # concatenated audio
    cursor = 0
    grains = []
    oneshots = {}
    plot_data = []

    def append(x):
        nonlocal cursor
        start = cursor
        out.append(x)
        cursor += len(x)
        return start

    for kind, src, t0, t1, (lo, hi) in SEGMENTS:
        x = sources[src][int(t0 * SR) : int(t1 * SR)]
        smooth = 0.0012
        env = envelope(x, smooth)
        peaks = find_peaks(env, lo, hi)
        base = append(x)
        # Cut a little before each peak so every grain starts just ahead of its thump.
        for a, b in zip(peaks[:-1], peaks[1:]):
            period = b - a
            pre = min(0.004, 0.15 * period)
            s, e = a - pre, b - pre
            if s < 0:
                continue
            seg = x[int(s * SR) : int(e * SR)]
            grains.append(
                {
                    'kind': kind,
                    'start': (base + int(s * SR)) / SR,
                    'dur': round(e - s, 5),
                    'rpm': round(120 / period, 1),
                    'rms': round(float(np.sqrt(np.mean(seg**2))), 5),
                }
            )
        plot_data.append((kind, src, t0, x, peaks))

    for name, src, t0, t1 in ONESHOTS:
        x = sources[src][int(t0 * SR) : int(t1 * SR)].copy()
        if name == 'shutdown':
            fade = int(0.05 * SR)
            x[-fade:] *= np.linspace(1, 0, fade)
        oneshots[name] = {'start': append(x) / SR, 'dur': round(len(x) / SR, 5)}

    audio = np.concatenate(out)
    # Level-match the two machines where they meet: the rev recording's idle against the quad's idle.
    def median_rms(k):
        return float(np.median([g['rms'] for g in grains if g['kind'] == k]))

    rev_gain = median_rms('idle') / median_rms('idle2')

    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    with wave.open(os.path.join(ROOT, 'public', 'audio', 'engine-bank.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    bank = {
        'file': 'audio/engine-bank.wav',
        'sampleRate': SR,
        'strokes': 4,
        'crankRpm': 320,  # cranking speed the crank loop plays back at its natural rate
        'sourceGain': {'quad': 1.0, 'rev': round(rev_gain, 3)},
        'grains': grains,
        'oneshots': oneshots,
    }
    for g in grains:
        g['src'] = 'rev' if g['kind'] in ('accel', 'decel', 'idle2') else 'quad'
    with open(os.path.join(ROOT, 'public', 'audio', 'engine-bank.json'), 'w') as f:
        json.dump(bank, f, indent=1)

    for k in ('idle', 'idle2', 'accel', 'decel'):
        rpms = [g['rpm'] for g in grains if g['kind'] == k]
        print(f'{k:6s} {len(rpms):4d} grains, rpm {min(rpms):.0f} to {max(rpms):.0f}')
    print(f'rev source gain {rev_gain:.2f}, bank {len(audio) / SR:.1f} s')

    if args.plot:
        import matplotlib

        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        fig, axes = plt.subplots(len(plot_data), 1, figsize=(16, 2.2 * len(plot_data)))
        for ax, (kind, src, t0, x, peaks) in zip(axes, plot_data):
            t = np.arange(len(x)) / SR
            ax.plot(t, x, lw=0.3)
            for p in peaks:
                ax.axvline(p, color='r', lw=0.5)
            ax.set_title(f'{kind} ({src} from {t0}s): {len(peaks)} pulses', loc='left', fontsize=9)
            ax.set_xlim(0, min(t[-1], 1.2))
        plt.tight_layout()
        plt.savefig(args.plot, dpi=60)


if __name__ == '__main__':
    main()

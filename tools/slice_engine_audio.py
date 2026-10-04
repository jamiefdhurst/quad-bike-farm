"""Cut engine recordings into single firing pulses for the recorded engine sound.

Reads mono 16-bit WAVs of the source recordings (see ASSETS.md for where they
come from), finds each firing pulse, and writes:

  public/audio/<bank>.wav   the segments that are used, back to back
  public/audio/<bank>.json  where every pulse ("grain") starts and ends, its
                            pulse rate, and what kind it is

There are two banks: engine-bank (four-stroke quads) and engine-bank-2t
(two-stroke). A grain's "rpm" is 120 / pulse period whatever the engine type,
which is the rpm a four-stroke would be doing; the runtime picks grains by the
same measure, so two-strokes match up without special cases.

At runtime each pulse from the engine model plays one recorded pulse
(src/audio/engineWorklet.js), so the lumpiness, misfires and starter rhythm
of the engine model come through with real recorded sound.

Usage (needs numpy, and matplotlib for --plot):

  afconvert -f WAVE -d LEI16@44100 -c 1 379915.mp3 quad.wav     # or ffmpeg
  afconvert -f WAVE -d LEI16@44100 -c 1 419091.mp3 rev.wav
  python3 tools/slice_engine_audio.py engine-bank quad=quad.wav rev=rev.wav [--plot out.png]

  afconvert ... 450034.mp3 mx.wav;  afconvert ... 148868.mp3 crm.wav
  python3 tools/slice_engine_audio.py engine-bank-2t mx=mx.wav crm=crm.wav quad=quad.wav
"""

import argparse
import json
import os
import wave

import numpy as np

SR = 44100
# Every bank is scaled so its idle pulses sit at this loudness, so quads using
# different banks are equally loud at idle.
TARGET_IDLE_RMS = 0.2
ENV_RATE = 4000  # envelope sample rate, Hz
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Which parts of which recording each bank uses. Times in seconds.
#   segments: (kind, source, start, end, (shortest, longest pulse period in s))
#   oneshots: (name, source, start, end)
#   level: (kind, other kind) whose median loudness is matched, so the second
#          machine sits at the same level as the first where they meet.
BANKS = {
    'engine-bank': {
        'segments': [
            ('idle', 'quad', 1.60, 7.30, (0.06, 0.12)),
            ('idle', 'quad', 8.80, 12.0, (0.06, 0.12)),
            ('idle', 'quad', 17.0, 19.9, (0.06, 0.12)),
            ('accel', 'rev', 2.00, 3.05, (0.016, 0.045)),  # revving up, throttle open
            ('decel', 'rev', 3.15, 6.05, (0.016, 0.085)),  # falling back, throttle closed
            ('idle2', 'rev', 0.10, 1.95, (0.06, 0.09)),  # the rev recording's own idle, to blend across machines
        ],
        'oneshots': [
            # The starter's own chug isn't regular enough to cut per compression stroke, so
            # cranking is an engage sound followed by a loop between two quiet points.
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),  # the run-down once the ignition is cut
        ],
        'level': ('idle', 'idle2', 'rev'),
    },
    'engine-bank-2t': {
        # Idle from a two-stroke motocross bike (its later idle skips beats, so only
        # the steady stretches are used); revs from a Honda CRM250 pulling away
        # through the gears (rising sweeps) and backing off (falling sweeps). Starter
        # and shutdown borrow the quad recordings: the game has an electric start.
        'segments': [
            ('idle', 'mx', 24.0, 30.3, (0.022, 0.045)),
            ('idle', 'mx', 32.0, 40.5, (0.022, 0.045)),
            ('accel', 'crm', 6.8, 9.0, (0.0095, 0.03)),
            ('accel', 'crm', 10.0, 11.3, (0.0095, 0.02)),
            ('accel', 'crm', 12.6, 13.8, (0.0095, 0.02)),
            ('decel', 'crm', 11.4, 12.4, (0.0095, 0.02)),
            ('decel', 'crm', 14.0, 15.5, (0.0095, 0.025)),
            ('idle2', 'crm', 0.1, 1.9, (0.02, 0.045)),
        ],
        'oneshots': [
            ('starterEngage', 'quad', 0.08, 0.365),
            ('crankLoop', 'quad', 0.365, 1.329),
            ('shutdown', 'quad', 20.22, 21.2),
        ],
        'level': ('idle', 'idle2', 'crm'),
    },
}


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


def cut_points(x, peaks, smooth_env):
    """Where to cut before each thump: find where its attack starts, then take the
    quietest zero crossing just ahead of that, so a grain never carries the start
    of the next thump and never begins partway into its own."""
    cuts = []
    for i, p in enumerate(peaks):
        pi = min(int(p * SR), len(x) - 1)
        prev = int(peaks[i - 1] * SR) if i > 0 else max(0, pi - int(0.1 * SR))
        period = pi - prev
        # Attack start: walk back from the peak until the envelope drops near the local floor.
        floor_lo = prev + int(0.3 * period)
        floor = smooth_env[floor_lo:pi].min() if pi > floor_lo else 0
        level = floor + 0.2 * (smooth_env[pi] - floor)
        j = pi
        while j > floor_lo and smooth_env[j] > level:
            j -= 1
        # Quietest spot in the stretch just before the attack, snapped to a zero crossing.
        a = max(floor_lo, j - int(0.25 * period))
        q = a + int(np.argmin(smooth_env[a : j + 1])) if j > a else j
        lo, hi = max(1, q - int(0.0015 * SR)), min(len(x) - 1, q + int(0.0015 * SR))
        zc = [k for k in range(lo, hi) if x[k - 1] <= 0 < x[k]]
        cuts.append(min(zc, key=lambda k: abs(k - q)) if zc else q)
    return cuts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('bank', choices=sorted(BANKS))
    ap.add_argument('sources', nargs='+', help='name=path.wav for each source the bank uses')
    ap.add_argument('--plot')
    args = ap.parse_args()
    config = BANKS[args.bank]
    sources = {}
    for item in args.sources:
        name, path = item.split('=', 1)
        sources[name] = load(path)

    out = []  # concatenated audio
    cursor = 0
    grains = []
    oneshots = {}
    plot_data = []
    rejected = {}

    def append(x):
        nonlocal cursor
        start = cursor
        out.append(x)
        cursor += len(x)
        return start

    for kind, src, t0, t1, (lo, hi) in config['segments']:
        x = sources[src][int(t0 * SR) : int(t1 * SR)]
        env = envelope(x, 0.0012)
        peaks = find_peaks(env, lo, hi)
        k = int(SR * 0.0008)
        fine_env = np.convolve(np.abs(x), np.ones(k) / k, mode='same')
        cuts = cut_points(x, peaks, fine_env)
        base = append(x)
        durs = np.diff(cuts) / SR
        for i in range(len(cuts) - 1):
            s, e = cuts[i], cuts[i + 1]
            dur = (e - s) / SR
            # Overlap into the quiet stretch before the next thump, for crossfading at playback.
            tail = int(min(0.003, 0.12 * dur) * SR)
            seg_env = fine_env[s:e]
            n = len(seg_env)
            reason = None
            med = np.median(durs[max(0, i - 3) : i + 4])
            if abs(dur - med) / med > 0.2:
                reason = 'odd length'
            elif seg_env[int(n * 0.8) :].max() > 0.5 * seg_env[: int(n * 0.4)].max():
                reason = 'next thump in tail'
            if reason:
                rejected[reason] = rejected.get(reason, 0) + 1
                continue
            seg = x[s:e]
            grains.append(
                {
                    'kind': kind,
                    'start': (base + s) / SR,
                    'dur': round(dur, 5),
                    'tail': round(min(tail, len(x) - e) / SR, 5),
                    'rpm': round(120 / dur, 1),
                    'src': src,
                    'rms': round(float(np.sqrt(np.mean(seg**2))), 5),
                }
            )
        plot_data.append((kind, src, t0, x, np.array(cuts) / SR))

    for name, src, t0, t1 in config['oneshots']:
        x = sources[src][int(t0 * SR) : int(t1 * SR)].copy()
        if name == 'shutdown':
            fade = int(0.05 * SR)
            x[-fade:] *= np.linspace(1, 0, fade)
        oneshots[name] = {'start': append(x) / SR, 'dur': round(len(x) / SR, 5)}

    audio = np.concatenate(out)
    # Level-match the two machines where they meet: the rev recording's idle against the quad's idle.
    def median_rms(k):
        return float(np.median([g['rms'] for g in grains if g['kind'] == k]))

    base_kind, other_kind, other_src = config['level']
    other_gain = median_rms(base_kind) / median_rms(other_kind)
    norm = TARGET_IDLE_RMS / median_rms(base_kind)

    os.makedirs(os.path.join(ROOT, 'public', 'audio'), exist_ok=True)
    with wave.open(os.path.join(ROOT, 'public', 'audio', f'{args.bank}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    bank = {
        'file': f'audio/{args.bank}.wav',
        'sampleRate': SR,
        'strokes': 4,
        'crankRpm': 320,  # cranking speed the crank loop plays back at its natural rate
        'sourceGain': {**{name: round(norm, 3) for name in sources}, other_src: round(other_gain * norm, 3)},
        'grains': grains,
        'oneshots': oneshots,
    }
    with open(os.path.join(ROOT, 'public', 'audio', f'{args.bank}.json'), 'w') as f:
        json.dump(bank, f, indent=1)

    for k in ('idle', 'idle2', 'accel', 'decel'):
        rpms = [g['rpm'] for g in grains if g['kind'] == k]
        if not rpms:
            continue
        print(f'{k:6s} {len(rpms):4d} grains, rpm {min(rpms):.0f} to {max(rpms):.0f}')
    print(f'{other_src} gain {other_gain:.2f}, bank level x{norm:.2f}, {len(audio) / SR:.1f} s, rejected {rejected}')

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
            ax.set_title(f'{kind} ({src} from {t0}s): {len(peaks)} cuts', loc='left', fontsize=9)
            ax.set_xlim(0, min(t[-1], 1.2))
        plt.tight_layout()
        plt.savefig(args.plot, dpi=60)


if __name__ == '__main__':
    main()

"""Finds the steadiest idle in an engine recording, and its start and stop, for choosing recordings (#857).

  python3 tools/engine-review/idlescan.py rec.wav --rpm 650-1300 [--cyl 4] [--json]

Reads a mono 16-bit WAV (afconvert -f WAVE -d LEI16@44100 -c 1 in.mp3 out.wav). In 1 s windows every 0.25 s it finds the firing
period in the engine's idle range (the autocorrelation of the loudness envelope, firings = cylinders a cycle) and how strongly the
envelope repeats at it: near 1 an engine on its own, low with other noise over it or no engine at all. The idle is the longest run
of windows that repeat strongly (REPEAT_MIN or more, at a firing or at a whole cycle), keep within 6% of the run's rate and 4 dB of its
loudness, letting one stray window through at a time. Reported: its start, end and
length, its rpm, how much the rate wanders (the spread of each window's rpm, %), how strongly it repeats (its mean) and a single
score that ranks recordings by those (longer, steadier, cleaner is higher; under 20 s scores nothing).

The start is a rise from quiet (25 dB under the idle) to the idle's loudness before the idle, with the cranking until it catches;
the stop is a fall to quiet after it. Either is null when the recording has none; the start's `compression` is the time between
compressions while cranking, when they show.
"""

import argparse
import json
import wave

import numpy as np

ENV_RATE = 2000
# A window counts as idling if its envelope repeats this strongly. A lumpy idle at a steady rate reads 0.2 to 0.45 (the Jeep, 438105).
REPEAT_MIN = 0.2


def load(path):
    with wave.open(path) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
        if w.getnchannels() > 1:
            x = x.reshape(-1, w.getnchannels()).mean(axis=1)
    return x, sr


def envelope(x, sr):
    k = max(1, int(sr * 0.0015))
    env = np.convolve(np.abs(x), np.ones(k) / k, mode='same')
    return env[:: sr // ENV_RATE]


def windows(env, lo_s, hi_s, cyl, win=1.0, hop=0.25):
    n = int(win * ENV_RATE)
    lags = np.arange(int(lo_s * ENV_RATE), int(hi_s * ENV_RATE) + 1)
    out = []
    for i in range(0, len(env) - n, int(hop * ENV_RATE)):
        w = env[i : i + n]
        rms = float(np.sqrt(np.mean(w**2)))
        d = w - w.mean()
        den = float(np.dot(d, d))
        if den <= 0:
            out.append((i / ENV_RATE, 0.0, 0.0, rms))
            continue
        ac = np.array([np.dot(d[:-l], d[l:]) / den for l in lags])
        j = int(np.argmax(ac))
        # Refine the lag between samples (parabola through the peak) so the rate isn't stepped by the envelope's rate.
        frac = 0.0
        if 0 < j < len(ac) - 1:
            a, b, c = ac[j - 1], ac[j], ac[j + 1]
            frac = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0.0
        # A lumpy idle repeats more strongly at the whole cycle (every cylinder once) than at one firing: take the stronger.
        cyc = int(round((lags[j] + frac) * cyl))
        rep = float(ac[j])
        if cyc < n // 2:
            rep = max(rep, max(float(np.dot(d[:-l], d[l:]) / den) for l in range(cyc - 3, cyc + 4)))
        out.append((i / ENV_RATE, (lags[j] + frac) / ENV_RATE, rep, rms))
    return out


def longest_idle(ws, cyl, hop=0.25):
    best = None
    i = 0
    while i < len(ws):
        if ws[i][2] < REPEAT_MIN:
            i += 1
            continue
        j = i
        periods, levels = [ws[i][1]], [ws[i][3]]
        strays = 0
        while j + 1 < len(ws):
            t, p, r, rms = ws[j + 1]
            mp, ml = np.median(periods), np.median(levels)
            if r < REPEAT_MIN or abs(p / mp - 1) > 0.06 or abs(20 * np.log10(max(rms, 1e-9) / ml)) > 4:
                # One window out (a cough, a car passing) is let through if the next is back in; two in a row end the run.
                nxt = ws[j + 2] if j + 2 < len(ws) else None
                if strays or not nxt or nxt[2] < REPEAT_MIN or abs(nxt[1] / mp - 1) > 0.06 or abs(20 * np.log10(max(nxt[3], 1e-9) / ml)) > 4:
                    break
                strays += 1
                j += 1
                continue
            strays = 0
            periods.append(p)
            levels.append(rms)
            j += 1
        length = ws[j][0] - ws[i][0] + 1.0
        if best is None or length > best['length']:
            rpms = [30 * 4 / cyl / p for p in periods]  # a four-stroke fires cyl times in two turns: rpm = 120 / (period * cyl)
            best = {
                'start': round(ws[i][0], 2),
                'end': round(ws[j][0] + 1.0, 2),
                'length': round(length, 2),
                'rpm': round(float(np.median(rpms))),
                'wander': round(float(np.std(rpms) / np.mean(rpms) * 100), 2),
                'repeat': round(float(np.mean([w[2] for w in ws[i : j + 1]])), 3),
                'level': float(np.median(levels)),
            }
        i = j + 1
    return best


def start_and_stop(ws, idle, env):
    quiet = idle['level'] * 10 ** (-25 / 20)
    start = stop = None
    before = [w for w in ws if w[0] < idle['start']]
    # The last quiet window before the idle, then the first after it near the idle's loudness: cranking runs from one to the other.
    q = [w for w in before if w[3] < quiet]
    if q:
        t0 = q[-1][0] + 1.0
        loud = [w for w in before if w[0] >= t0 and w[3] > idle['level'] * 10 ** (-6 / 20)]
        start = {'from': round(t0, 2), 'caught': round(loud[0][0] + 0.5, 2) if loud else round(idle['start'], 2)}
        start['compression'] = compression_period(env, start['from'], start['caught'])
    after = [w for w in ws if w[0] > idle['end'] - 1.0]
    q = [w for w in after if w[3] < quiet]
    if q:
        stop = {'at': round(q[0][0] + 0.5, 2)}
    return start, stop


def compression_period(env, t0, t1):
    """The time between compressions while cranking (0.08 to 0.35 s: a starter turns an engine at about 85 to 375 rpm), or None."""
    d = env[int(t0 * ENV_RATE) : int(t1 * ENV_RATE)]
    lags = np.arange(int(0.08 * ENV_RATE), int(0.35 * ENV_RATE))
    if len(d) < 2 * lags[-1]:
        return None
    d = d - d.mean()
    den = float(np.dot(d, d)) or 1.0
    ac = np.array([np.dot(d[:-l], d[l:]) / den for l in lags])
    j = int(np.argmax(ac))
    return round(float(lags[j]) / ENV_RATE, 4) if ac[j] > 0.2 else None


def score(idle):
    if not idle or idle['length'] < 20:
        return 0.0
    return round(min(idle['length'], 60) / 60 * idle['repeat'] / (1 + idle['wander'] / 2), 3)


def scan(path, rpm_lo, rpm_hi, cyl):
    x, sr = load(path)
    env = envelope(x, sr)
    # The firing period at the top and bottom of the idle range.
    ws = windows(env, 120 / (rpm_hi * cyl), 120 / (rpm_lo * cyl), cyl)
    idle = longest_idle(ws, cyl)
    start, stop = start_and_stop(ws, idle, env) if idle else (None, None)
    if idle:
        idle['level'] = round(20 * np.log10(idle['level']), 1)
    return {'file': path, 'seconds': round(len(x) / sr, 2), 'idle': idle, 'start': start, 'stop': stop, 'score': score(idle)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('wav', nargs='+')
    ap.add_argument('--rpm', required=True, help='the idle range, lo-hi')
    ap.add_argument('--cyl', type=int, default=4)
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    lo, hi = map(float, a.rpm.split('-'))
    rows = [scan(p, lo, hi, a.cyl) for p in a.wav]
    if a.json:
        print(json.dumps(rows))
        return
    for r in sorted(rows, key=lambda r: -r['score']):
        i = r['idle']
        if not i:
            print(f"{r['file']}: no idle")
            continue
        print(f"{r['score']:.3f} {r['file']}: idle {i['start']}-{i['end']} s ({i['length']} s) at {i['rpm']} rpm, wanders {i['wander']}%, repeats {i['repeat']}, start {r['start']}, stop {r['stop']}")


if __name__ == '__main__':
    main()

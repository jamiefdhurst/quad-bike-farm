"""Cut the recorded ride sounds (mud squelches, puddle splashes, thuds into
dirt) out of CC0 recordings (see ASSETS.md) into one file the game loads.
The rest of the ride sound (tyres, grit, wind, knocks, rattles) is made in
src/audio/rideAudio.js.

Writes:

  public/audio/ride.wav   every clip, back to back
  public/audio/ride.json  where each clip starts and ends, by kind

Each kind is evened out to one loudness (loudest 20 ms), and every clip gets
a very short fade in, so the attack survives, and a longer fade out.

Usage (needs numpy):

  afconvert -f WAVE -d LEI16@44100 -c 1 207142.mp3 207142.wav     # or ffmpeg, for each source
  python3 tools/slice_ride_audio.py squelch=207142.wav splash=207139.wav steps=249930.wav thud=392008.wav fall=504626.wav

Source names are the ones in CLIPS below.
"""

import json
import os
import sys
import wave

import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_PEAK_RMS = {'squelch': 0.12, 'splash': 0.12, 'slosh': 0.1, 'thud': 0.2, 'crunch': 0.16}
FADE_IN = 0.002  # seconds
FADE_OUT = 0.08

# (kind, source, start, end) in seconds.
CLIPS = [
    # Boots pulling out of wet mud: the suck and slap of a tyre through mud.
    ('squelch', 'squelch', 0.33, 0.62),
    ('squelch', 'squelch', 2.72, 3.0),
    ('squelch', 'squelch', 4.04, 4.34),
    ('squelch', 'squelch', 4.81, 5.1),
    ('squelch', 'squelch', 5.56, 5.85),
    ('squelch', 'squelch', 6.17, 6.46),
    ('squelch', 'squelch', 6.92, 7.22),
    ('squelch', 'squelch', 7.73, 8.0),
    ('squelch', 'squelch', 8.51, 8.78),
    ('squelch', 'squelch', 10.96, 11.26),
    ('squelch', 'squelch', 12.38, 12.68),
    # Something landing in a puddle: a wheel hitting the water.
    ('splash', 'splash', 0.95, 1.9),
    ('splash', 'splash', 3.65, 4.6),
    # Running feet through a puddle: smaller splashes while in it.
    ('slosh', 'steps', 0.68, 1.0),
    ('slosh', 'steps', 1.06, 1.36),
    ('slosh', 'steps', 1.36, 1.76),
    ('slosh', 'steps', 1.77, 2.1),
    ('slosh', 'steps', 2.16, 2.46),
    ('slosh', 'steps', 2.45, 2.78),
    ('slosh', 'steps', 2.77, 3.15),
    # A heavy bag dropped on dirt: the ground's part of a landing.
    ('thud', 'thud', 1.255, 1.62),
    ('thud', 'thud', 12.86, 13.22),
    ('thud', 'thud', 17.965, 18.33),
    ('thud', 'thud', 21.285, 21.65),
    ('thud', 'thud', 26.67, 27.03),
    ('thud', 'thud', 35.04, 35.4),
    ('thud', 'thud', 40.66, 41.02),
    # A heavy body fall on dirt: the crunch of a big landing.
    ('crunch', 'fall', 0.38, 1.45),
]


def load(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def loudest_rms(x):
    n = int(0.02 * SR)
    return max(np.sqrt(np.mean(x[i : i + n] ** 2)) for i in range(0, max(1, len(x) - n), n // 2))


def main():
    sources = {}
    for item in sys.argv[1:]:
        name, path = item.split('=', 1)
        sources[name] = load(path)

    out = []
    cursor = 0
    clips = {}
    gap = np.zeros(int(0.03 * SR), dtype=np.float32)
    for kind, src, t0, t1 in CLIPS:
        x = sources[src][int(t0 * SR) : int(t1 * SR)].copy()
        x -= x.mean()
        x *= TARGET_PEAK_RMS[kind] / loudest_rms(x)
        x *= min(1, 0.9 / np.abs(x).max())  # never clip; the game scales them up if needed
        fi = int(FADE_IN * SR)
        fo = min(int(FADE_OUT * SR), len(x) // 2)
        x[:fi] *= np.linspace(0, 1, fi)
        x[-fo:] *= np.linspace(1, 0, fo) ** 2
        clips.setdefault(kind, []).append({'start': round(cursor / SR, 5), 'dur': round(len(x) / SR, 5), 'src': src})
        out += [x, gap]
        cursor += len(x) + len(gap)

    audio = np.concatenate(out)
    path = os.path.join(ROOT, 'public', 'audio', 'ride')
    with wave.open(path + '.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    with open(path + '.json', 'w') as f:
        json.dump({'file': 'audio/ride.wav', 'clips': clips}, f, indent=1)
    print(', '.join(f'{k} {len(v)}' for k, v in clips.items()), f'{len(audio) / SR:.1f} s, peak {np.abs(audio).max():.2f}')


if __name__ == '__main__':
    main()

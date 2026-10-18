"""Cut the companion's non-verbal sounds (sighs, hmms, laughs and so on) out of
CC0 recordings (see ASSETS.md) into one file the game loads.

Writes:

  public/audio/companion.wav   every clip, back to back
  public/audio/companion.json  where each clip starts and ends, by kind

Each clip is evened out to the same loudness and faded in and out, so the
quiet recordings sit with the loud ones.

Usage (needs numpy):

  afconvert -f WAVE -d LEI16@44100 -c 1 218311.mp3 218311.wav     # or ffmpeg, for each source
  python3 tools/slice_companion_audio.py sighA=218311.wav sighB=663651.wav ...

Source names are the ones in CLIPS below.
"""

import json
import os
import sys
import wave

import numpy as np

SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_RMS = 0.08  # loudness of the loudest 50 ms of every clip
FADE = 0.015  # seconds

# (kind, source, start, end) in seconds.
CLIPS = [
    # Sighs: four different women, so they vary.
    ('sigh', 'splice', 14.4, 17.3),
    ('sigh', 'splice', 20.6, 22.2),
    ('sigh', 'splice', 24.9, 26.4),
    ('sigh', 'splice', 36.6, 38.7),
    ('sigh', 'splice', 42.5, 44.6),
    ('sigh', 'exasperated', 0.25, 1.65),
    ('sigh', 'girl', 0.8, 1.95),
    ('sigh', 'woman', 0.0, 0.85),
    # "Hmm" with different inflections.
    ('hmm', 'hmms', 0.75, 1.75),
    ('hmm', 'hmms', 2.75, 3.9),
    ('hmm', 'hmms', 4.25, 5.25),
    ('hmm', 'hmms', 6.25, 7.0),
    ('hmm', 'hmms', 8.0, 8.95),
    ('hmm', 'hmms', 9.8, 10.85),
    ('hmm', 'hmms', 11.6, 12.65),
    ('hmm', 'hmms', 13.35, 14.4),
    # Short laughs.
    ('laugh', 'laugh', 0.05, 1.35),
    ('laugh', 'laugh', 1.65, 2.85),
    ('laugh', 'laugh', 3.6, 5.05),
    ('laugh', 'laugh', 5.75, 7.0),
    ('laugh', 'laugh', 17.35, 18.55),
    ('laugh', 'laugh', 18.95, 20.15),
    ('yawn', 'yawn', 0.55, 3.15),
    # Humming to herself, a phrase at a time.
    ('hum', 'hum', 0.55, 4.7),
    ('hum', 'hum', 6.0, 10.1),
    ('hum', 'hum', 10.85, 14.7),
    ('hum', 'hum', 15.75, 19.5),
    ('hum', 'hum', 20.3, 23.9),
    ('hum', 'hum', 25.0, 29.0),
    ('gasp', 'gasp', 0.12, 0.75),
    ('oh', 'oh', 0.02, 0.56),  # disappointed
]


def load(path):
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2, path
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def loudest_rms(x):
    n = int(0.05 * SR)
    return max(np.sqrt(np.mean(x[i : i + n] ** 2)) for i in range(0, max(1, len(x) - n), n // 2))


def main():
    sources = {}
    for item in sys.argv[1:]:
        name, path = item.split('=', 1)
        sources[name] = load(path)

    out = []
    cursor = 0
    clips = {}
    gap = np.zeros(int(0.05 * SR), dtype=np.float32)
    for kind, src, t0, t1 in CLIPS:
        x = sources[src][int(t0 * SR) : int(t1 * SR)].copy()
        x *= TARGET_RMS / loudest_rms(x)
        f = int(FADE * SR)
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
        clips.setdefault(kind, []).append({'start': round(cursor / SR, 5), 'dur': round(len(x) / SR, 5), 'src': src})
        out += [x, gap]
        cursor += len(x) + len(gap)

    audio = np.concatenate(out)
    path = os.path.join(ROOT, 'public', 'audio', 'companion')
    with wave.open(path + '.wav', 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes())
    with open(path + '.json', 'w') as f:
        json.dump({'file': 'audio/companion.flac', 'clips': clips}, f, indent=1)
    print(', '.join(f'{k} {len(v)}' for k, v in clips.items()), f'{len(audio) / SR:.1f} s, peak {np.abs(audio).max():.2f}')


if __name__ == '__main__':
    main()

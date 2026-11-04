"""Build the radio's music: download the CC0 tracks listed in tools/radio/music.json, make each mono at 32 kHz at an even level, cut to
`maxSeconds` with a fade, and write them as MP3 into public/audio/radio/ with public/audio/radio/music.json (what and how long).

Anything you drop into public/audio/radio-extra/<station>/ (dale or quarry; MP3, WAV, FLAC or M4A) is made the same way into
public/audio/radio/extra-<station>-NN.mp3 and listed in public/audio/radio/extra.json, to be shuffled in with the station's own music.
Run with `--extras-only` to do just that. Run from the repo with a Python that has soundfile, numpy and librosa:

  .scratch/cb/bin/python tools/build_radio_music.py
"""

import argparse
import glob
import json
import os
import re
import subprocess
import urllib.request

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'audio', 'radio')
EXTRA = os.path.join(ROOT, 'public', 'audio', 'radio-extra')
CACHE = os.path.join(ROOT, '.scratch', 'radio-music')
RATE = 32000
TARGET_RMS = 0.11
FADE = 3.0


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def decode(path):
    """Any source as mono float samples at RATE (afconvert reads MP3, WAV, FLAC and M4A; the result is cached beside the source)."""
    import librosa
    import soundfile as sf

    wav = path + '.wav'
    if not os.path.exists(wav):
        subprocess.run(['afconvert', '-f', 'WAVE', '-d', 'LEI16@44100', '-c', '1', path, wav], check=True)
    x, sr = sf.read(wav, dtype='float32')
    if x.ndim > 1:
        x = x.mean(axis=1)
    return librosa.resample(x, orig_sr=sr, target_sr=RATE).astype(np.float32)


def finish(x, max_seconds):
    """Takes the quiet lead-in off the start, cuts to length with a fade out and evens out the level."""
    lead = np.where(np.abs(x) > 0.01)[0]
    if len(lead):
        x = x[max(0, lead[0] - int(0.05 * RATE)) :]
    n = int(max_seconds * RATE)
    x = x[:n].copy()
    f = min(len(x), int(FADE * RATE))
    x[-f:] *= np.linspace(1, 0, f)
    x[: int(0.02 * RATE)] *= np.linspace(0, 1, int(0.02 * RATE))
    rms = np.sqrt(np.mean(x**2)) or 1
    x = x * (TARGET_RMS / rms)
    peak = np.abs(x).max()
    if peak > 0.95:
        x *= 0.95 / peak
    return x


def write(x, name):
    import soundfile as sf

    sf.write(os.path.join(OUT, name), x, RATE, format='MP3', subtype='MPEG_LAYER_III')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--extras-only', action='store_true')
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(CACHE, exist_ok=True)
    cfg = json.load(open(os.path.join(ROOT, 'tools', 'radio', 'music.json')))
    if not args.extras_only:
        for old in glob.glob(os.path.join(OUT, 'music-*.mp3')):
            os.remove(old)
        tracks = []
        for station, items in cfg['stations'].items():
            for n, it in enumerate(items):
                src = os.path.join(CACHE, f'{station}-{n:02d}-{slug(it["title"])}.src')
                if not os.path.exists(src):
                    req = urllib.request.Request(it['url'], headers={'User-Agent': 'Mozilla/5.0'})
                    with open(src, 'wb') as f:
                        f.write(urllib.request.urlopen(req, timeout=120).read())
                x = finish(decode(src), cfg['maxSeconds'])
                name = f'music-{station}-{n:02d}.mp3'
                write(x, name)
                tracks.append({'id': f'{station}-{n:02d}', 'station': station, 'title': it['title'], 'artist': it['artist'],
                               'file': f'audio/radio/{name}', 'seconds': round(len(x) / RATE, 2)})
                print(station, it['title'], round(len(x) / RATE), 's', os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB', flush=True)
        with open(os.path.join(OUT, 'music.json'), 'w') as f:
            json.dump({'tracks': tracks}, f, indent=1)
    extras = []
    for old in glob.glob(os.path.join(OUT, 'extra-*.mp3')):
        os.remove(old)
    for station in cfg['stations']:
        files = sorted(f for f in glob.glob(os.path.join(EXTRA, station, '*')) if f.lower().endswith(('.mp3', '.wav', '.flac', '.m4a')))
        for n, f in enumerate(files):
            x = finish(decode(f), cfg['maxSeconds'])
            name = f'extra-{station}-{n:02d}.mp3'
            write(x, name)
            extras.append({'id': f'x-{station}-{n:02d}', 'station': station, 'title': os.path.splitext(os.path.basename(f))[0], 'artist': '',
                           'file': f'audio/radio/{name}', 'seconds': round(len(x) / RATE, 2)})
    with open(os.path.join(OUT, 'extra.json'), 'w') as f:
        json.dump({'tracks': extras}, f, indent=1)
    print(f'{len(extras)} extra tracks')


if __name__ == '__main__':
    main()

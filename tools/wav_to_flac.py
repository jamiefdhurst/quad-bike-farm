#!/usr/bin/env python3
"""Moves each public/audio/*.wav to source/audio/ (kept in git, not shipped) and writes a lossless FLAC beside where it was, which is
what the game downloads (about half the size, sample-exact, so the engine banks' pulse slicing still lines up). Any json beside it that
names the wav in its "file" is pointed at the flac. Run it after tools/slice_engine_audio.py or tools/slice_companion_audio.py.

  .scratch/cb/bin/python tools/wav_to_flac.py [name ...]     (no names: every wav in public/audio)
"""
import glob, json, os, shutil, sys
import soundfile as sf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUB = os.path.join(ROOT, 'public', 'audio')
SRC = os.path.join(ROOT, 'source', 'audio')
os.makedirs(SRC, exist_ok=True)

names = sys.argv[1:] or [os.path.basename(p)[:-4] for p in glob.glob(os.path.join(PUB, '*.wav'))]
for name in sorted(names):
    wav = os.path.join(PUB, name + '.wav')
    if not os.path.exists(wav):
        continue
    data, rate = sf.read(wav, dtype='int16')
    sf.write(os.path.join(PUB, name + '.flac'), data, rate, format='FLAC', subtype='PCM_16')
    shutil.move(wav, os.path.join(SRC, name + '.wav'))
    js = os.path.join(PUB, name + '.json')
    if os.path.exists(js):
        with open(js) as f:
            doc = json.load(f)
        if doc.get('file') == f'audio/{name}.wav':
            doc['file'] = f'audio/{name}.flac'
            with open(js, 'w') as f:
                json.dump(doc, f, separators=(',', ':'), allow_nan=False)
    print(name, os.path.getsize(os.path.join(PUB, name + '.flac')))
